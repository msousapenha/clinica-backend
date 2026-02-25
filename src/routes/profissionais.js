const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');

// 1. Importa o Middleware de Autenticação
const authMiddleware = require('../middlewares/auth');

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// 2. APLICA O SEGURANÇA NA PORTA! 
// Qualquer rota abaixo desta linha vai exigir um token JWT válido.
router.use(authMiddleware);

// Middleware extra apenas para garantir que o usuário logado tem a permissão certa
const verificarPermissaoEquipe = (req, res, next) => {
  if (!req.permissoes.includes('equipe')) {
    return res.status(403).json({ erro: 'Acesso negado. Você não tem permissão para gerenciar a equipe.' });
  }
  next();
};

// 1. CREATE: Cadastrar um novo profissional
router.post('/', async (req, res) => {
  try {
    const { nome, especialidade, conselho, telefone, comissao, status } = req.body;
    
    // Validação básica
    if (!nome) {
      return res.status(400).json({ erro: 'Nome e WhatsApp são obrigatórios' });
    }

    const novoProfissional = await prisma.profissional.create({
      data: {
        nome,
        especialidade,
        conselho,
        telefone,
        comissao,
        status: status || 'ativo',
      },
    });

    res.status(201).json(novoProfissional);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar profissional' });
  }
});

// 2. READ: Listar todos os profissionals
router.get('/', async (req, res) => {
  try {
    const profissionais = await prisma.profissional.findMany({
      orderBy: { nome: 'asc' },
    });
    res.json(profissionais);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar profissionais' });
  }
});

// 3. READ: Buscar um profissional específico pelo ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const profissional = await prisma.profissional.findUnique({
      where: { id },
    });

    if (!profissional) {
      return res.status(404).json({ erro: 'Profissional não encontrado' });
    }

    res.json(profissional);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar o profissional' });
  }
});

// 4. UPDATE: Atualizar dados do profissional
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, especialidade, conselho, telefone, comissao, status } = req.body;

    const profissionalAtualizado = await prisma.profissional.update({
      where: { id },
      data: {
        nome,
        especialidade,
        conselho,
        telefone,
        comissao,
        status,
      },
    });

    res.json(profissionalAtualizado);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar profissional' });
  }
});

// 5. DELETE: Remover um profissional
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.profissional.delete({
      where: { id },
    });

    res.status(204).send(); // 204 = No Content (Sucesso sem corpo na resposta)
  } catch (error) {
    res.status(500).json({ erro: error });
  }
});

module.exports = router;