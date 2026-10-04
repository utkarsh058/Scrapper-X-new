const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "displayFollowerCount" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "isRounded" BOOLEAN;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "displayFollowerCount" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "isRounded" BOOLEAN;');
    console.log('MIGRATION_SUCCESS');
  } catch (err) {
    console.error('MIGRATION_ERROR:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
