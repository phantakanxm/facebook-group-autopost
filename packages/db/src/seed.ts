import { prisma } from './index.js';

async function main() {
  const user = await prisma.user.upsert({
    where: { id: 'default-user' },
    update: {},
    create: { id: 'default-user', name: 'Me' },
  });

  await prisma.setting.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  console.log('Seeded user:', user.id);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
