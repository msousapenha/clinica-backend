const express = require('express');
const router = express.Router();
const prisma = require('../database');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware);

// LISTAR APENAS QUEM ATENDE PACIENTES (Para os selects de Agenda/Evolução)
router.get('/', async (req, res) => {
  try {
    const profissionais = await prisma.usuario.findMany({
      where: {
        atendePacientes: true,
        status: 'ativo'
      },
      select: {
        id: true,
        nome: true,
        especialidade: true,
        conselho: true,
        comissao: true
      },
      orderBy: { nome: 'asc' },
    });
    
    res.json(profissionais);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar lista de profissionais' });
  }
});

module.exports = router;