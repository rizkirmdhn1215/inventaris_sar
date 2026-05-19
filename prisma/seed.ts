import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { INTERNAL_BORROWERS_SEED } from './data/internal-borrowers';

const prisma = new PrismaClient();

function parseDdMmYyyy(value: string): Date | null {
  const parts = value.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => Number(p));
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

async function main() {
  console.log('Seeding initial admin user...');
  
  const hashedPassword = await hash('password123', 12);
  
  const admins = [
    { email: 'admin@sarpadang.go.id', name: 'Super Admin', role: 'superadmin' },
    { email: 'ryan@sarpadang.go.id', name: 'RYAN AGUS SYAPUTRA', role: 'admin' },
    { email: 'hari@sarpadang.go.id', name: 'HARI AGUSTIAN, S.A.P.', role: 'admin' },
  ];

  for (const a of admins) {
    const created = await prisma.admin.upsert({
      where: { email: a.email },
      update: { name: a.name, role: a.role },
      create: {
        email: a.email,
        password: hashedPassword,
        name: a.name,
        role: a.role,
      },
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

  console.log('Seeding internal borrowers...');
  for (const b of INTERNAL_BORROWERS_SEED) {
    const appointedAt = parseDdMmYyyy(b.appointedAt);
    await prisma.internalBorrower.upsert({
      where: { nip: b.nip },
      update: {
        name: b.name,
        pangkat: b.pangkat,
        jabatan: b.jabatan,
        appointedAt,
      },
      create: {
        nip: b.nip,
        name: b.name,
        pangkat: b.pangkat,
        jabatan: b.jabatan,
        appointedAt,
      },
    });
  }
  console.log(`Internal borrowers seeded: ${INTERNAL_BORROWERS_SEED.length}`);
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
