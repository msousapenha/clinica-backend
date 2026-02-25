const express = require('express');
const router = express.Router();
const prisma = require('../database');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware);

// LISTAR TRANSAÇÕES (Com filtro de data)
router.get('/', async (req, res) => {
  const { inicio, fim } = req.query;
  
  // Se não mandar data, pega o mês atual
  const dataInicio = inicio ? new Date(inicio) : new Date(new Date().setDate(1));
  const dataFim = fim ? new Date(fim) : new Date();

  // Ajusta o fim para o final do dia (23:59:59)
  dataFim.setHours(23, 59, 59, 999);

  const lista = await prisma.transacao.findMany({
    where: {
      data: { gte: dataInicio, lte: dataFim }
    },
    orderBy: { data: 'desc' }
  });
  
  res.json(lista);
});

// LANÇAMENTO MANUAL (Para Aluguel, Luz, etc)
router.post('/', async (req, res) => {
  const { descricao, valor, tipo, categoria, data } = req.body;
  try {
    const nova = await prisma.transacao.create({
      data: {
        descricao,
        valor: parseFloat(valor),
        tipo,
        categoria,
        data: data ? new Date(data) : new Date()
      }
    });
    res.json(nova);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao lançar transação.' });
  }
});

module.exports = router;