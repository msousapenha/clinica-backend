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
router.post('/movimentacao', async (req, res) => {
  const { produtoId, qtd, valorUnitario, tipo, fornecedor, lote, validade } = req.body;
  // tipo: 'ENTRADA' ou 'SAIDA'

  try {
    // 1. Validação de Estoque (Apenas para SAÍDA)
    if (tipo === 'SAIDA') {
      const produtoAtual = await prisma.produto.findUnique({ where: { id: produtoId } });
      
      if (!produtoAtual) return res.status(404).json({ erro: "Produto não encontrado." });
      
      if (produtoAtual.qtd < parseInt(qtd)) {
        return res.status(400).json({ erro: `Estoque insuficiente. Disponível: ${produtoAtual.qtd}` });
      }
    }

    // INÍCIO DA TRANSAÇÃO
    const resultado = await prisma.$transaction(async (tx) => {
      
      // 2. Cria o registro no histórico (Movimentação)
      const novaMovimentacao = await tx.movimentacao.create({
        data: {
          tipo, 
          qtd: parseInt(qtd),
          valorUnitario: parseFloat(valorUnitario || 0),
          fornecedor: fornecedor || (tipo === 'SAIDA' ? 'Baixa Manual' : null),
          lote,
          validade: validade ? new Date(validade) : null,
          produtoId
        }
      });

      // 3. Atualiza o saldo do Produto
      await tx.produto.update({
        where: { id: produtoId },
        data: { 
          qtd: { 
            // Incrementa se ENTRADA, Decrementa se SAIDA
            [tipo === 'ENTRADA' ? 'increment' : 'decrement']: parseInt(qtd) 
          },
          // Opcional: Atualiza o preço médio na entrada se desejar
          // precoMedio: tipo === 'ENTRADA' ? parseFloat(valorUnitario) : undefined
        }
      });

      // 4. INTEGRAÇÃO FINANCEIRA: Se for ENTRADA (Compra), gera DESPESA
      if (tipo === 'ENTRADA') {
        const custoTotal = parseFloat(valorUnitario) * parseInt(qtd);

        // Só lança no financeiro se houver custo
        if (custoTotal > 0) {
          // Busca nome do produto para a descrição
          const prodInfo = await tx.produto.findUnique({ where: { id: produtoId } });

          await tx.transacao.create({
            data: {
              tipo: 'DESPESA',
              categoria: 'ESTOQUE',
              descricao: `Compra: ${prodInfo.nome} (${qtd} ${prodInfo.unidade}s)`,
              valor: custoTotal,
              data: new Date(),
              movimentacaoId: novaMovimentacao.id // Vincula a despesa a esta entrada de estoque
            }
          });
        }
      }

      return novaMovimentacao;
    });

    res.json(resultado);

  } catch (error) {
    console.error("Erro na movimentação:", error);
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