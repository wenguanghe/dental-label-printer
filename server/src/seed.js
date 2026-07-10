import { pinyin } from 'pinyin-pro';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function getPinyin(name) {
  return pinyin(name, { pattern: 'first', toneType: 'none', type: 'array' })
    .join('')
    .toLowerCase();
}

const seedData = {
  INSTRUMENT: [
    '探针', '口镜', '镊子', '拔牙钳', '牙龈分离器',
    '刮治器', '充填器', '车针', '根管锉', '洁牙机手柄',
    '光固化灯头', '涡轮手机', '弯手机', '直手机', '印模托盘'
  ],
  STERILIZER: ['张三', '李四', '王五', '赵六'],
  CHECKER: ['护士长刘', '护士长陈', '质控员周'],
  FURNACE: ['1号炉', '2号炉', '3号炉']
};

async function seed() {
  for (const [type, names] of Object.entries(seedData)) {
    for (const name of names) {
      await prisma.dictionary.upsert({
        where: { type_name: { type, name } },
        update: {},
        create: { type, name, pinyin: getPinyin(name) }
      });
    }
  }
  console.log('Seed data inserted successfully!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
