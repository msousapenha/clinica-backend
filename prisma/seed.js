// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const senhaHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.usuario.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
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
  console.log({ admin });
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });