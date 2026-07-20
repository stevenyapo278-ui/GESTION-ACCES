import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Create default admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'System',
      role: Role.ADMIN,
    },
  });

  // Create demo editor user
  const editorPassword = await bcrypt.hash('editor123', 10);
  
  await prisma.user.upsert({
    where: { email: 'editor@example.com' },
    update: {},
    create: {
      email: 'editor@example.com',
      password: editorPassword,
      firstName: 'Jean',
      lastName: 'Dupont',
      role: Role.EDITOR,
    },
  });

  // Create demo reader user
  const readerPassword = await bcrypt.hash('reader123', 10);
  
  await prisma.user.upsert({
    where: { email: 'reader@example.com' },
    update: {},
    create: {
      email: 'reader@example.com',
      password: readerPassword,
      firstName: 'Marie',
      lastName: 'Martin',
      role: Role.READER,
    },
  });

  console.log('Seed completed successfully!');
  console.log('Admin: admin@example.com / admin123');
  console.log('Editor: editor@example.com / editor123');
  console.log('Reader: reader@example.com / reader123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
