const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const prisma = require('../database');
const authMiddleware = require('../middlewares/auth');

router.use(authMiddleware);

// LISTAR TODOS
router.get('/', async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nome: true, username: true, permissoes: true, status: true } // Não retorna a senha!
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao buscar usuários' });
  }
});

// CRIAR USUÁRIO
router.post('/', async (req, res) => {
  const { nome, username, senha, permissoes } = req.body;

  try {
    // Verifica se já existe
    const existe = await prisma.usuario.findUnique({ where: { username } });
    if (existe) return res.status(400).json({ erro: 'Usuário já existe.' });

    // Criptografa a senha
    const hashedPassword = await bcrypt.hash(senha, 10);

    const novoUsuario = await prisma.usuario.create({
      data: {
        nome,
        username,
        senha: hashedPassword,
        permissoes: permissoes || [], // Array de strings
        status: 'ativo'
      }
    });

    res.status(201).json({ 
      id: novoUsuario.id, 
      nome: novoUsuario.nome, 
      username: novoUsuario.username 
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro ao criar usuário' });
  }
});

// ATUALIZAR (Senha é opcional)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, username, permissoes, senha, status } = req.body;

  try {
    const dados = { nome, username, permissoes, status };

    // Só atualiza a senha se ela foi enviada
    if (senha && senha.trim() !== '') {
      dados.senha = await bcrypt.hash(senha, 10);
    }

    const atualizado = await prisma.usuario.update({
      where: { id },
      data: dados,
      select: { id: true, nome: true, username: true, permissoes: true, status: true }
    });

    res.json(atualizado);
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao atualizar' });
  }
});

// DELETAR (Ou inativar)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    // Opção 1: Hard Delete (Apaga do banco)
    await prisma.usuario.delete({ where: { id } });
    
    // Opção 2: Soft Delete (Recomendado se tiver vínculos)
    // await prisma.usuario.update({ where: { id }, data: { status: 'inativo' } });
    
    res.json({ mensagem: 'Usuário removido' });
  } catch (error) {
    res.status(500).json({ erro: 'Erro ao deletar' });
  }
});

module.exports = router;