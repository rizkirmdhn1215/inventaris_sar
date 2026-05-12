import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding initial admin user...');
  
  const hashedPassword = await hash('password123', 12);
  
  const admin = await prisma.admin.upsert({
    where: { email: 'admin@sarpadang.go.id' },
    update: {},
    create: {
      email: 'admin@sarpadang.go.id',
      password: hashedPassword,
      name: 'Super Admin',
    },
  });

  console.log(`Admin created: ${admin.email}`);
  
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
