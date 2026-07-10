import { PrismaClient } from '@prisma/client';
import { seed } from './seed.js';

const prisma = new PrismaClient();

const count = await prisma.dictionary.count();
if (count === 0) {
  console.log('[Docker] Seeding initial data...');
  await seed();
  console.log('[Docker] Seed complete.');
} else {
  console.log(`[Docker] Database already has ${count} dictionary entries, skipping seed.`);
}
await prisma.$disconnect();
