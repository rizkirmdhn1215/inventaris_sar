import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { INTERNAL_BORROWERS_SEED } from './data/internal-borrowers';

const prisma = new PrismaClient();

const KPP_PADANG_ID = '00000000-0000-4000-8000-000000000001';

function parseDdMmYyyy(value: string): Date | null {
  const parts = value.trim().split('/');
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map((p) => Number(p));
  if (!day || !month || !year) return null;
  return new Date(year, month - 1, day);
}

async function main() {
  console.log('Seeding locations...');
  await prisma.location.upsert({
    where: { slug: 'kpp-padang' },
    update: { name: 'KPP Padang', type: 'kpp', isActive: true, sortOrder: 0 },
    create: {
      id: KPP_PADANG_ID,
      slug: 'kpp-padang',
      name: 'KPP Padang',
      type: 'kpp',
      description: 'Kantor Pencarian dan Pertolongan Padang',
      isActive: true,
      sortOrder: 0,
    },
  });

  console.log('Seeding initial admin user...');

  const hashedPassword = await hash('password123', 12);

  const admins = [
    { email: 'admin@sarpadang.go.id', name: 'Super Admin', role: 'superadmin', locationId: null as string | null },
  ];

  for (const a of admins) {
    const created = await prisma.admin.upsert({
      where: { email: a.email },
      update: { name: a.name, role: a.role, locationId: a.locationId },
      create: {
        email: a.email,
        password: hashedPassword,
        name: a.name,
        role: a.role,
        locationId: a.locationId,
      },
    });
    console.log(`Admin upserted: ${created.email} (${created.name})`);
  }

  const categories = [
    'Alat Potong',
    'Komunikasi',
    'Tali Temali',
    'SCBA',
    'Medis',
    'Navigasi',
    'Penerangan',
    'Water Rescue',
  ];

  for (const name of categories) {
    await prisma.itemCategory.upsert({
      where: {
        locationId_name: { locationId: KPP_PADANG_ID, name },
      },
      update: {},
      create: { locationId: KPP_PADANG_ID, name },
    });
  }

  console.log('Categories seeded.');

  console.log('Seeding internal borrowers...');
  for (const b of INTERNAL_BORROWERS_SEED) {
    const appointedAt = parseDdMmYyyy(b.appointedAt);
    if (b.nip) {
      await prisma.internalBorrower.upsert({
        where: {
          locationId_nip: { locationId: KPP_PADANG_ID, nip: b.nip },
        },
        update: {
          name: b.name,
          pangkat: b.pangkat,
          jabatan: b.jabatan,
          appointedAt,
        },
        create: {
          locationId: KPP_PADANG_ID,
          nip: b.nip,
          name: b.name,
          pangkat: b.pangkat,
          jabatan: b.jabatan,
          appointedAt,
        },
      });
    }
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
