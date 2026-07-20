/**
 * Seed script — Crée le template "Demande d'accès"
 * Reproduit le formulaire Word original (FRM-IAM-002)
 *
 * Usage : npx tsx src/seed-access-template.ts
 */
import { PrismaClient } from '@prisma/client';
import * as readline from 'node:readline/promises';

const prisma = new PrismaClient();

interface ColDef {
  name: string;
  type: string;
  order: number;
  required?: boolean;
  options?: string[];
}

const COLUMNS: ColDef[] = [
  // ── Section 1 : Service ou Site Demandeur ──
  { name: 'Service ou Site', type: 'TEXT', order: 1, required: true },
  { name: 'Demandeur - Nom & Prénoms', type: 'TEXT', order: 2, required: true },
  { name: 'Demandeur - Identifiant', type: 'TEXT', order: 3 },
  { name: 'Demandeur - Fonction', type: 'TEXT', order: 4 },
  { name: 'Demandeur - Email', type: 'EMAIL', order: 5, required: true },

  // ── Section 2 : Création d'un nouveau compte ──
  { name: 'Nouveau compte - Nom & Prénoms', type: 'TEXT', order: 6 },
  { name: 'Nouveau compte - Fonction', type: 'TEXT', order: 7 },
  { name: 'Nouveau compte - Position hiérarchique', type: 'TEXT', order: 8 },
  { name: 'Nouveau compte - Email', type: 'EMAIL', order: 9 },
  { name: 'Nouveau compte - Identifiant', type: 'TEXT', order: 10 },
  { name: 'Nouveau compte - Matricule', type: 'TEXT', order: 11 },

  // ── Section 3 : Accès et Applications ──
  { name: 'Suite bureautique', type: 'DROPDOWN', order: 12, options: ['Oui', 'Non'] },
  { name: 'Office 365', type: 'DROPDOWN', order: 13, options: ['Oui', 'Non'] },

  { name: 'CYRUS', type: 'DROPDOWN', order: 14, options: ['Oui', 'Non'] },
  { name: 'CYRUS - Niveau accès', type: 'TEXT', order: 15 },
  { name: 'CYRUS - Profil témoin', type: 'TEXT', order: 16 },

  { name: 'ASTEN', type: 'DROPDOWN', order: 17, options: ['Oui', 'Non'] },
  { name: 'ASTEN - Niveau accès', type: 'TEXT', order: 18 },
  { name: 'ASTEN - Profil témoin', type: 'TEXT', order: 19 },

  { name: 'GPV', type: 'DROPDOWN', order: 20, options: ['Oui', 'Non'] },
  { name: 'GPV - Niveau accès', type: 'TEXT', order: 21 },
  { name: 'GPV - Profil témoin', type: 'TEXT', order: 22 },

  { name: 'LEGEND', type: 'DROPDOWN', order: 23, options: ['Oui', 'Non'] },
  { name: 'LEGEND - Niveau accès', type: 'TEXT', order: 24 },
  { name: 'LEGEND - Profil témoin', type: 'TEXT', order: 25 },

  { name: 'PROBI', type: 'DROPDOWN', order: 26, options: ['Oui', 'Non'] },
  { name: 'PROBI - Niveau accès', type: 'TEXT', order: 27 },
  { name: 'PROBI - Profil témoin', type: 'TEXT', order: 28 },

  { name: 'PROTRANS', type: 'DROPDOWN', order: 29, options: ['Oui', 'Non'] },
  { name: 'PROTRANS - Niveau accès', type: 'TEXT', order: 30 },
  { name: 'PROTRANS - Profil témoin', type: 'TEXT', order: 31 },

  { name: 'Accès par VPN', type: 'DROPDOWN', order: 32, options: ['Oui', 'Non'] },
  { name: 'VPN - Justification', type: 'TEXT', order: 33 },

  { name: 'Code caisse', type: 'DROPDOWN', order: 34, options: ['Oui', 'Non'] },
  { name: 'Dossiers partagés', type: 'LONG_TEXT', order: 35 },

  // ── Section 4 : Statut & Validation ──
  { name: 'Statut', type: 'DROPDOWN', order: 36, required: true, options: ['Brouillon', 'Soumis', 'Validé', 'Refusé'] },
  { name: 'Validateur - Nom & Prénoms', type: 'TEXT', order: 37 },
  { name: 'Validateur - Fonction', type: 'TEXT', order: 38 },
  { name: 'Avis', type: 'DROPDOWN', order: 39, options: ['Favorable', 'Défavorable'] },
  { name: 'Date validation', type: 'DATE', order: 40 },
];

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('\n🔧 Création du template "Demande d\'accès"\n');
  console.log(`Ce script va créer un tableau avec ${COLUMNS.length} colonnes.`);

  const adminEmail = await rl.question('Email admin (admin@example.com) : ') || 'admin@example.com';

  // Find admin user
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    console.error(`❌ Utilisateur "${adminEmail}" introuvable.`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`✅ Connecté en tant que ${admin.firstName} ${admin.lastName} (${admin.role})`);

  // Check if template already exists
  const existing = await prisma.table.findFirst({ where: { name: 'Demande d\'accès' } });
  if (existing) {
    const overwrite = await rl.question('⚠️  Un tableau "Demande d\'accès" existe déjà. Créer une copie ? (O/n) : ') || 'O';
    if (overwrite.toLowerCase() === 'n') {
      console.log('Annulé.');
      await prisma.$disconnect();
      return;
    }
  }

  // Create the table
  const table = await prisma.table.create({
    data: {
      name: existing ? `Demande d'accès (copie ${Date.now()})` : "Demande d'accès",
      description: 'Formulaire de demande d\'accès aux applications (FRM-IAM-002)',
      icon: 'file-text',
      color: '#d29922',
      createdBy: admin.id,
      views: {
        create: [
          {
            name: 'Toutes les demandes',
            type: 'TABLE',
            isDefault: true,
            createdBy: admin.id,
          },
        ],
      },
    },
  });

  console.log(`✅ Tableau "${table.name}" créé (id: ${table.id})`);

  // Create columns
  for (const col of COLUMNS) {
    await prisma.column.create({
      data: {
        tableId: table.id,
        name: col.name,
        type: col.type as any,
        required: col.required ?? false,
        order: col.order,
        options: col.options ?? undefined,
        createdBy: admin.id,
      },
    });
  }

  console.log(`✅ ${COLUMNS.length} colonnes créées`);

  // Create view columns
  const createdColumns = await prisma.column.findMany({
    where: { tableId: table.id },
    orderBy: { order: 'asc' },
  });
  const view = await prisma.view.findFirst({ where: { tableId: table.id } });
  if (view) {
    await prisma.viewColumn.createMany({
      data: createdColumns.map((c, i) => ({
        viewId: view.id,
        columnId: c.id,
        order: i,
        visible: true,
      })),
    });
    console.log('✅ Vue configurée avec toutes les colonnes visibles');
  }

  console.log(`\n🎉 Template prêt ! Rendez-vous sur http://localhost:5174/tables/${table.id}`);
  console.log('   pour voir et remplir le formulaire.\n');

  await prisma.$disconnect();
  rl.close();
}

main().catch((err) => {
  console.error('❌ Erreur :', err);
  prisma.$disconnect();
  process.exit(1);
});
