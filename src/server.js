require('dotenv').config();

const express = require('express');
const cors = require('cors');

// Importação das rotas
const pacientesRoutes = require('./routes/pacientes');
const profissionaissRoutes = require('./routes/profissionais');
const agendamentosRoutes = require('./routes/agendamentos'); //
const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const estoqueRoutes = require('./routes/estoque');
const procedimentoRoutes = require('./routes/procedimentos');
const financeiroRoutes = require('./routes/financeiro');


const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Rota de Healthcheck
app.get('/api/status', (req, res) => {
  res.json({ status: 'API da Clínica rodando perfeitamente! 🚀' });
});

// Acoplando as rotas modularizadas
app.use('/api/pacientes', pacientesRoutes);
app.use('/api/profissionais', profissionaissRoutes);
app.use('/api/agendamentos', agendamentosRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/estoque', estoqueRoutes);
app.use('/api/procedimentos', procedimentoRoutes);
app.use('/api/financeiro', financeiroRoutes);

// Tratamento para rotas não encontradas (404)
app.use((req, res) => {
  res.status(404).json({ erro: 'Endpoint não encontrado.' });
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});