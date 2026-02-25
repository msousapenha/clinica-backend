const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 👇 Usando a conexão centralizada que criamos para não estourar o banco!
const prisma = require('../database');

const router = express.Router();

// Chave secreta para assinar o token (Idealmente deve vir do .env)
const JWT_SECRET = process.env.JWT_SECRET || 'clinica-super-secreta-key';

router.post('/login', async (req, res) => {
  try {
    const { username, senha } = req.body;

    // 1. Busca o usuário
    const usuario = await prisma.usuario.findUnique({ where: { username } });
    if (!usuario || usuario.status !== 'ativo') {
      return res.status(401).json({ erro: 'Credenciais inválidas ou usuário inativo.' });
    }

    // 2. Compara a senha digitada com o hash salvo no banco
    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Credenciais inválidas.' });
    }

    // 3. Gera o token de acesso (válido por 8 horas)
    const token = jwt.sign(
      { id: usuario.id, username: usuario.username, permissoes: usuario.permissoes },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // 4. Devolve o token e os dados básicos (sem a senha!)
    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        username: usuario.username,
        permissoes: usuario.permissoes
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ erro: 'Erro interno no servidor.' });
  }
});

module.exports = router;