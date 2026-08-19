import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = 'rize@sarpadang.go.id';
  const password = '500201Asd!';
  const name = 'Rize';
  const role = 'superadmin';

  const hashedPassword = await hash(password, 12);

  const admin = await prisma.admin.upsert({
    where: { email },
    update: {
      password: hashedPassword,
      name,
      role,
      locationId: null,
    },
    create: {
      email,
      password: hashedPassword,
      name,
      role,
      locationId: null,
    },
  });

  console.log(`✅ Super admin upserted:`);
  console.log(`   ID    : ${admin.id}`);
  console.log(`   Email : ${admin.email}`);
  console.log(`   Name  : ${admin.name}`);
  console.log(`   Role  : ${admin.role}`);
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
