const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../database');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware);

// LISTAR TODA A EQUIPE/USUÁRIOS
router.get('/', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { 
        id: true, 
        nome: true, 
        username: true, 
        permissoes: true, 
        status: true,
        cargo: true,
        atendePacientes: true,
        especialidade: true,
        conselho: true,
        telefone: true,
        comissao: true
      },
      orderBy: { nome: 'asc' }
    });
    res.json(usuarios);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao buscar equipe' });
  }
});

// CRIAR USUÁRIO / MEMBRO DA EQUIPE
router.post('/', async (req, res) => {
  const { 
    nome, username, senha, permissoes, cargo, 
    atendePacientes, especialidade, conselho, telefone, comissao 
  } = req.body;

  try {
    const existe = await prisma.usuario.findUnique({ where: { username } });
    if (existe) return res.status(400).json({ erro: 'Nome de usuário (login) já em uso.' });

    const hashedPassword = await bcrypt.hash(senha, 10);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        username,
        senha: hashedPassword,
        permissoes: permissoes || [], 
        cargo: cargo || 'Indefinido',
        atendePacientes: atendePacientes === true || atendePacientes === 'true',
        especialidade: especialidade || null,
        conselho: conselho || null,
        telefone: telefone || null,
        comissao: parseInt(comissao) || 0,
        status: 'ativo'
      },
      select: { id: true, nome: true, username: true, cargo: true } // Evita devolver a senha
    });

    res.status(201).json(novoUsuario);

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar membro da equipe' });
  }
});

// ATUALIZAR DADOS DO USUÁRIO
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { 
    nome, username, permissoes, senha, status, cargo, 
    atendePacientes, especialidade, conselho, telefone, comissao 
  } = req.body;

  try {
    const dados = { 
      nome, 
      username, 
      permissoes, 
      status,
      cargo,
      atendePacientes: atendePacientes === true || atendePacientes === 'true',
      especialidade,
      conselho,
      telefone,
      comissao: parseInt(comissao) || 0
    };

    // Só atualiza a senha se foi enviada e não está vazia
    if (senha && String(senha).trim() !== '') {
      dados.senha = await bcrypt.hash(senha, 10);
    }

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: dados,
      select: { 
        id: true, nome: true, username: true, permissoes: true, 
        status: true, cargo: true, atendePacientes: true 
      }
    });

    res.json(atualizado);
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao atualizar membro da equipe' });
  }
});

// DELETAR USUÁRIO
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.usuario.delete({ where: { id } });
    res.json({ mensagem: 'Membro da equipe removido' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao deletar. Verifique se o usuário possui agendamentos vinculados.' });
  }
});

// ROTA PARA O PRÓPRIO USUÁRIO TROCAR SUA SENHA
router.put('/perfil/senha', async (req, res) => {
  const { senha } = req.body;
  const usuarioId = req.usuarioId; // Pego do token pelo authMiddleware

  try {
    if (!senha || senha.trim().length < 4) {
      return res.status(400).json({ erro: 'Senha muito curta.' });
    }

    const hashedPassword = await bcrypt.hash(senha, 10);

    await prisma.usuario.update({
      where: { id: usuarioId },
      data: { senha: hashedPassword }
    });

    res.json({ mensagem: 'Senha atualizada com sucesso!' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao trocar senha.' });
  }
});

module.exports = router;