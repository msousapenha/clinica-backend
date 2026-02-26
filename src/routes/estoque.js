const express = require('express');
const router = express.Router();
const prisma = require('../database');
const authMiddleware = require('../middlewares/auth');

// Protege todas as rotas
router.use(authMiddleware);

// ==============================================================================
// 1. LISTAR PRODUTOS (Catálogo)
// ==============================================================================
router.get('/produtos', async (req, res) => {
  try {
    const produtos = await prisma.produto.findMany({
      orderBy: { nome: 'asc' }
    });
    res.json(produtos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar produtos.' });
  }
});

// ==============================================================================
// 2. CADASTRAR NOVO PRODUTO
// ==============================================================================
router.post('/produtos', async (req, res) => {
  const { nome, categoria, unidade, min, precoMedio } = req.body;

  try {
    const novoProduto = await prisma.produto.create({
      data: {
        nome,
        categoria,
        unidade,
        min: parseInt(min || 0),
        precoMedio: parseFloat(precoMedio || 0)
      }
    });
    res.status(201).json(novoProduto);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao cadastrar produto.' });
  }
});

// ==============================================================================
// 3. REGISTRAR MOVIMENTAÇÃO (Entrada ou Saída)
// ==============================================================================
// ==============================================================================
// 3. REGISTRAR MOVIMENTAÇÃO (Entrada ou Saída)
// ==============================================================================
router.post('/movimentacao', async (req, res) => {
  const { produtoId, qtd, valorUnitario, tipo, fornecedor, lote, validade } = req.body;
  // tipo: 'ENTRADA' ou 'SAIDA'

  try {
    const qtdInt = parseInt(qtd);
    const valorFloat = parseFloat(valorUnitario || 0);

    // INÍCIO DA TRANSAÇÃO
    const resultado = await prisma.$transaction(async (tx) => {
      
      // 1. Busca o produto (precisamos dele para checar saldo e fazer a média)
      const produtoAtual = await tx.produto.findUnique({ where: { id: produtoId } });
      if (!produtoAtual) throw new Error("Produto não encontrado.");

      // 2. Validação de SAÍDA
      if (tipo === 'SAIDA' && produtoAtual.qtd < qtdInt) {
        throw new Error(`Estoque insuficiente. Disponível: ${produtoAtual.qtd}`);
      }
      
      // 3. Cria o registro no histórico (Movimentação)
      const novaMovimentacao = await tx.movimentacao.create({
        data: {
          tipo, 
          qtd: qtdInt,
          valorUnitario: valorFloat,
          fornecedor: fornecedor || (tipo === 'SAIDA' ? 'Baixa Manual' : null),
          lote,
          validade: validade ? new Date(validade) : null,
          produtoId
        }
      });

      // 4. CÁLCULO DO PREÇO MÉDIO PONDERADO (Apenas em Entradas)
      let novoPrecoMedio = parseFloat(produtoAtual.precoMedio || 0);
      
      if (tipo === 'ENTRADA') {
        const valorFinanceiroAtual = produtoAtual.qtd * novoPrecoMedio;
        const valorFinanceiroNovaEntrada = qtdInt * valorFloat;
        const novaQtdTotal = produtoAtual.qtd + qtdInt;
        
        // Evita divisão por zero
        if (novaQtdTotal > 0) {
          novoPrecoMedio = (valorFinanceiroAtual + valorFinanceiroNovaEntrada) / novaQtdTotal;
        }
      }

      // 5. Atualiza o saldo e o Preço Médio do Produto
      await tx.produto.update({
        where: { id: produtoId },
        data: { 
          qtd: { 
            [tipo === 'ENTRADA' ? 'increment' : 'decrement']: qtdInt 
          },
          // Atualiza o preço médio (se for SAIDA, mantém o valor que já estava)
          precoMedio: novoPrecoMedio
        }
      });

      // 6. INTEGRAÇÃO FINANCEIRA: Gera DESPESA se for compra
      if (tipo === 'ENTRADA' && valorFloat > 0) {
        const custoTotal = valorFloat * qtdInt;

        await tx.transacao.create({
          data: {
            tipo: 'DESPESA',
            categoria: 'ESTOQUE',
            descricao: `Compra: ${produtoAtual.nome} (${qtdInt} ${produtoAtual.unidade}s)`,
            valor: custoTotal,
            data: new Date()
            // Se você tiver o campo movimentacaoId no schema Transacao, adicione aqui:
            // movimentacaoId: novaMovimentacao.id
          }
        });
      }

      return novaMovimentacao;
    });

    res.status(201).json(resultado);

  } catch (error) {
    console.error("Erro na movimentação:", error);
    // Retorna para o front-end os erros específicos que lançamos na transação
    if (error.message.includes("Estoque insuficiente") || error.message.includes("Produto não encontrado")) {
      return res.status(400).json({ erro: error.message });
    }
    res.status(500).json({ erro: "Erro ao processar movimentação de estoque." });
  }
});

// ==============================================================================
// 4. LISTAR HISTÓRICO COMPLETO
// ==============================================================================
router.get('/historico', async (req, res) => {
  try {
    const historico = await prisma.movimentacao.findMany({
      include: { produto: true }, // Traz o nome do produto junto
      orderBy: { data: 'desc' },
      take: 100 // Limita aos últimos 100 registros para não pesar
    });
    res.json(historico);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar histórico.' });
  }
});

module.exports = router;