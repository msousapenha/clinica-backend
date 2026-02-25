const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Instancia sem argumentos (o Prisma lê a var DATABASE_URL sozinho)
const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando o seed...');

  // Verifica se o admin já existe
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