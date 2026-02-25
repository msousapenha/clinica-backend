const express = require('express');
const router = express.Router();
const prisma = require('../database');
const authMiddleware = require('../middlewares/auth');

// Protege todas as rotas com autenticação
router.use(authMiddleware);

// LISTAR AGENDAMENTOS (Com filtros opcionais de data)
router.get('/', async (req, res) => {
  try {
    const { inicio, fim } = req.query;
    const where = {};

    if (inicio && fim) {
      where.dataHorario = {
        gte: new Date(inicio),
        lte: new Date(fim)
      };
    }

    const agendamentos = await prisma.agendamento.findMany({
      where,
      include: {
        paciente: true,
        profissional: true,
        procedimentos: true // Inclui os procedimentos vinculados
      },
      orderBy: { dataHorario: 'asc' }
    });

    res.json(agendamentos);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar agendamentos.' });
  }
});

// CRIAR AGENDAMENTO
router.post('/', async (req, res) => {
  try {
    const { dataHorario, pacienteId, profissionalId, status } = req.body;

    const novoAgendamento = await prisma.agendamento.create({
      data: {
        dataHorario: new Date(dataHorario),
        status: status || 'Agendado',
        pacienteId,
        profissionalId: profissionalId || null
      }
    });

    res.status(201).json(novoAgendamento);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar agendamento.' });
  }
});

// ATUALIZAR AGENDAMENTO (Data, Hora, Profissional, Status simples)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { dataHorario, status, profissionalId } = req.body;

    const agendamentoAtualizado = await prisma.agendamento.update({
      where: { id },
      data: {
        dataHorario: dataHorario ? new Date(dataHorario) : undefined,
        status,
        profissionalId
      }
    });

    res.json(agendamentoAtualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao atualizar agendamento.' });
  }
});

// DELETAR AGENDAMENTO
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.agendamento.delete({ where: { id } });
    res.json({ mensagem: 'Agendamento removido com sucesso.' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao remover agendamento.' });
  }
});

// ==============================================================================
// ROTA ESPECIAL: FINALIZAR ATENDIMENTO (O "Coração" do Sistema)
// ==============================================================================
router.post('/:id/finalizar', async (req, res) => {
  const { id } = req.params;
  // Recebe: texto da evolução, insumos gastos (array) e procedimentos realizados (array de IDs)
  const { textoEvolucao, insumos, procedimentosIds } = req.body; 

  try {
    // 1. Busca o agendamento para garantir que existe e pegar dados do paciente
    const agendamento = await prisma.agendamento.findUnique({
      where: { id },
      include: { paciente: true } // Necessário para colocar o nome na receita financeira
    });

    if (!agendamento) return res.status(404).json({ erro: "Agendamento não encontrado" });

    // INÍCIO DA TRANSAÇÃO (Tudo ou Nada)
    await prisma.$transaction(async (tx) => {
      
      // 2. Atualiza Status e Conecta os Procedimentos Realizados
      await tx.agendamento.update({
        where: { id },
        data: { 
          status: 'Concluído',
          procedimentos: {
            // Conecta os IDs enviados pelo frontend
            connect: procedimentosIds ? procedimentosIds.map(procId => ({ id: procId })) : []
          }
        }
      });

      // 3. Cria a Evolução no Prontuário (Se houver texto)
      if (textoEvolucao) {
        await tx.evolucao.create({
          data: {
            texto: textoEvolucao,
            pacienteId: agendamento.pacienteId,
            profissionalId: agendamento.profissionalId,
            data: new Date()
          }
        });
      }

      // 4. Baixa de Estoque (Se houver insumos)
      if (insumos && insumos.length > 0) {
        for (const item of insumos) {
          // Verifica saldo antes de baixar
          const produto = await tx.produto.findUnique({ where: { id: item.produtoId } });
          
          if (!produto || produto.qtd < item.qtd) {
            throw new Error(`Estoque insuficiente para: ${produto?.nome || 'Produto desconhecido'}`);
          }

          // Registra a saída no histórico
          await tx.movimentacao.create({
            data: {
              tipo: 'SAIDA',
              qtd: parseInt(item.qtd),
              valorUnitario: produto.precoMedio, // Usa preço médio para relatórios de custo
              produtoId: item.produtoId,
              agendamentoId: id, // Vincula a este agendamento
              fornecedor: 'Consumo em Consulta'
            }
          });

          // Subtrai do saldo atual
          await tx.produto.update({
            where: { id: item.produtoId },
            data: { qtd: { decrement: parseInt(item.qtd) } }
          });
        }
      }

      // 5. FINANCEIRO: Lança Receitas (Uma para cada procedimento)
      if (procedimentosIds && procedimentosIds.length > 0) {
        // Busca os detalhes (nome e valor) dos procedimentos selecionados
        const procedimentosDb = await tx.procedimento.findMany({
          where: { id: { in: procedimentosIds } }
        });

        // Loop para criar uma receita individual para cada serviço
        for (const proc of procedimentosDb) {
          await tx.transacao.create({
            data: {
              tipo: 'RECEITA',
              categoria: 'PROCEDIMENTO',
              descricao: `${proc.nome} - ${agendamento.paciente?.nome}`, // Ex: "Botox - Maria"
              valor: parseFloat(proc.valor),
              data: new Date(),
              agendamentoId: id // Todos vinculados ao mesmo agendamento pai
            }
          });
        }
      }

    }); // FIM DA TRANSAÇÃO

    res.json({ mensagem: "Atendimento finalizado com sucesso!" });

  } catch (error) {
    console.error("Erro ao finalizar:", error);
    // Retorna mensagem de erro amigável (ex: estoque insuficiente)
    res.status(400).json({ erro: error.message || "Erro ao processar finalização." });
  }
});

module.exports = router;