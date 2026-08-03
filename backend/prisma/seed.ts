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

  // Default request types
  const requestTypes = [
    { name: 'Création de profil', description: 'Création d\'un compte utilisateur sur la plateforme' },
    { name: 'Réinitialisation de mot de passe', description: 'Réinitialisation d\'un mot de passe oublié' },
    { name: 'Accès à une application', description: 'Demande d\'accès à une application ou un service' },
    { name: 'Autre demande', description: 'Toute autre demande nécessitant une validation' },
  ];
  for (const rt of requestTypes) {
    await prisma.requestType.upsert({
      where: { name: rt.name },
      update: {},
      create: rt,
    });
  }

  // Default system settings
  const defaultSettings: Record<string, string> = {
    NOTIFICATION_EMAIL: 'admin@example.com',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:8888',
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }

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
