import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial admin user...');
  
  const hashedPassword = await hash('password123', 12);
  
  const admins = [
    { email: 'admin@sarpadang.go.id', name: 'Super Admin' },
    { email: 'ryan@sarpadang.go.id', name: 'RYAN AGUS SYAPUTRA' },
    { email: 'hari@sarpadang.go.id', name: 'HARI AGUSTIAN, S.A.P.' },
  ];

  for (const a of admins) {
    const created = await prisma.admin.upsert({
      where: { email: a.email },
      update: { name: a.name },
      create: { email: a.email, password: hashedPassword, name: a.name },
    });
    console.log(`Admin upserted: ${created.email} (${created.name})`);
  }
  
  // Seed sample categories
  const categories = [
    'Alat Potong',
    'Komunikasi',
    'Tali Temali',
    'SCBA',
    'Medis',
    'Navigasi',
    'Penerangan',
    'Water Rescue'
  ];

  for (const name of categories) {
    await prisma.itemCategory.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  
  console.log('Categories seeded.');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
