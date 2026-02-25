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

// 1. CREATE: Cadastrar um novo paciente
router.post('/', async (req, res) => {
  try {
    const { nome, whatsapp, status } = req.body;
    
    // Validação básica
    if (!nome || !whatsapp) {
      return res.status(400).json({ erro: 'Nome e WhatsApp são obrigatórios' });
    }

    const novoPaciente = await prisma.paciente.create({
      data: {
        nome,
        whatsapp,
        status: status || 'ativo',
      },
    });

    res.status(201).json(novoPaciente);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar paciente' });
  }
});

// 2. READ: Listar todos os pacientes
router.get('/', async (req, res) => {
  try {
    const pacientes = await prisma.paciente.findMany({
      orderBy: { nome: 'asc' },
    });
    res.json(pacientes);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar pacientes' });
  }
});

// 3. READ: Buscar um paciente específico pelo ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const paciente = await prisma.paciente.findUnique({
      where: { id },
    });

    if (!paciente) {
      return res.status(404).json({ erro: 'Paciente não encontrado' });
    }

    res.json(paciente);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar o paciente' });
  }
});

// 4. UPDATE: Atualizar dados do paciente
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, whatsapp, status, ultimaVisita } = req.body;

    const pacienteAtualizado = await prisma.paciente.update({
      where: { id },
      data: {
        nome,
        whatsapp,
        status,
        ultimaVisita: ultimaVisita ? new Date(ultimaVisita) : undefined,
      },
    });

    res.json(pacienteAtualizado);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar paciente' });
  }
});

// 5. DELETE: Remover um paciente
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await prisma.paciente.delete({
      where: { id },
    });

    res.status(204).send(); // 204 = No Content (Sucesso sem corpo na resposta)
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar paciente' });
  }
});

// ==========================================
// PRONTUÁRIO: ANAMNESE E EVOLUÇÕES
// ==========================================

// 1. Buscar Anamnese do Paciente
router.get('/:id/anamnese', async (req, res) => {
  try {
    const { id } = req.params;
    const anamnese = await prisma.anamnese.findUnique({ where: { pacienteId: id } });
    res.json(anamnese || {}); // Retorna vazio se ainda não tiver preenchido
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar anamnese' });
  }
});

// 2. Salvar/Atualizar Anamnese (Usa o 'upsert' que cria se não existir ou atualiza se existir)
router.put('/:id/anamnese', async (req, res) => {
  try {
    const { id } = req.params;
    const { alergias, roacutan, gestanteLactante } = req.body;

    const anamnese = await prisma.anamnese.upsert({
      where: { pacienteId: id },
      update: { alergias, roacutan, gestanteLactante },
      create: { pacienteId: id, alergias, roacutan, gestanteLactante },
    });
    res.json(anamnese);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao salvar anamnese' });
  }
});

// 3. Buscar Evoluções do Paciente
router.get('/:id/evolucoes', async (req, res) => {
  try {
    const { id } = req.params;
    const evolucoes = await prisma.evolucao.findMany({
      where: { pacienteId: id },
      orderBy: { data: 'desc' }, // Traz as mais recentes primeiro
      include: { profissional: true } // Já traz o nome do profissional
    });
    res.json(evolucoes);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar evoluções' });
  }
});

// 4. Criar Nova Evolução
router.post('/:id/evolucoes', async (req, res) => {
  try {
    const { id } = req.params;
    const { texto, profissionalId } = req.body;

    const novaEvolucao = await prisma.evolucao.create({
      data: {
        texto,
        pacienteId: id,
        profissionalId: profissionalId || null
      },
      include: { profissional: true }
    });
    res.status(201).json(novaEvolucao);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao criar evolução' });
  }
});

// 5. Buscar Histórico de Consultas (Agendamentos daquele paciente)
router.get('/:id/consultas', async (req, res) => {
  try {
    const { id } = req.params;
    const consultas = await prisma.agendamento.findMany({
      where: { pacienteId: id },
      orderBy: { dataHorario: 'desc' },
      include: { profissional: true }
    });
    res.json(consultas);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar histórico de consultas' });
  }
});

module.exports = router;