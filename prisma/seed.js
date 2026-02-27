// 1. ISSO TEM QUE SER A PRIMEIRA LINHA DO ARQUIVO!
require('dotenv').config(); 

// 2. Agora sim podemos importar o banco, pois as variáveis já existem
const prisma = require('../src/database');
const bcrypt = require('bcryptjs');

async function main() {
  console.log('Iniciando o seed...');

  const existe = await prisma.usuario.findUnique({
    where: { username: 'admin' },
  });

  if (!existe) {
    console.log('Criando usuário admin...');
    const senhaHash = await bcrypt.hash('admin123', 10);
    
    await prisma.usuario.create({
      data: {
        nome: 'Administrador',
        username: 'admin',
        senha: senhaHash,
        status: 'ativo',
        cargo: 'Administrador',
        atendePacientes: false,
        permissoes: [
            'dashboard', 'equipe', 'agenda', 'pacientes', 
            'financeiro', 'estoque', 'procedimentos', 'usuarios'
        ],
      },
    });
    console.log('Admin criado com sucesso!');
  } else {
    console.log('Admin já existe.');
  }
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });