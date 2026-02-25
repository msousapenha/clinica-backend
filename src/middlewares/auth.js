const jwt = require('jsonwebtoken');

// A mesma chave que você usou no auth.js para gerar o token
const JWT_SECRET = process.env.JWT_SECRET || 'clinica-super-secreta-key';

module.exports = (req, res, next) => {
  // 1. Pega o cabeçalho de autorização da requisição
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ erro: 'Acesso negado. Token não fornecido.' });
  }

  // O padrão do mercado é enviar o token assim: "Bearer sdjfsdfksdfksdf..."
  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ erro: 'Token mal formatado.' });
  }

  const token = parts[1];

  // 2. Verifica se o token é válido e se foi assinado pela nossa API
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }

    // 3. Se deu tudo certo, injetamos as infos do usuário logado na requisição e deixamos passar (next)
    req.usuarioId = decoded.id;
    req.permissoes = decoded.permissoes; 
    
    return next();
  });
};