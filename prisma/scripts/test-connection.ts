import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.$queryRawUnsafe('SELECT 1 AS ok');
  console.log('✅ DB connection successful:', result);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ DB connection failed:', e.message);
    await prisma.$disconnect();
    process.exit(1);
  });
