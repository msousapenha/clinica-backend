const express = require('express');
const router = express.Router();
const prisma = require('../database');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware);

// LISTAR (Apenas ativos ou todos, dependendo da query ?todos=true)
router.get('/', async (req, res) => {
  const { todos } = req.query;
  const where = todos ? {} : { status: 'ativo' };
  const lista = await prisma.procedimento.findMany({ 
    where,
    orderBy: { nome: 'asc' } 
  });
  res.json(lista);
});

// CRIAR
router.post('/', async (req, res) => {
  const { nome, valor } = req.body;
  try {
    const novo = await prisma.procedimento.create({
      data: { 
        nome, 
        valor: parseFloat(valor),
        status: 'ativo'
      }
    });
    res.status(201).json(novo);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao criar procedimento' });
  }
});

// ATUALIZAR
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, valor, status } = req.body;
  try {
    const atualizado = await prisma.procedimento.update({
      where: { id },
      data: { 
        nome, 
        valor: parseFloat(valor),
        status 
      }
    });
    res.json(atualizado);
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao atualizar' });
  }
});

// DELETAR (Soft Delete - Inativar)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.procedimento.update({
      where: { id },
      data: { status: 'inativo' }
    });
    res.json({ mensagem: 'Procedimento inativado com sucesso' });
  } catch (erro) {
    res.status(500).json({ erro: 'Erro ao deletar' });
  }
});

module.exports = router;