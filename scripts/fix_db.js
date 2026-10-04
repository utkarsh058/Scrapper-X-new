const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    // Add rawPayload if missing
    await prisma.$executeRawUnsafe(`ALTER TABLE "GoogleBusinessProfile" ADD COLUMN IF NOT EXISTS "rawPayload" TEXT;`);
    console.log('Added rawPayload column if not exists');

    // Also check SocialProfile displayFollowerCount and isRounded
    await prisma.$executeRawUnsafe(`ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "displayFollowerCount" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "isRounded" BOOLEAN;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "displayFollowerCount" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "isRounded" BOOLEAN;`);
    console.log('Added displayFollowerCount and isRounded if not exists');

    console.log('DB MIGRATION/FIX SUCCESSFUL');
  } catch (err) {
    console.error('DB FIX ERROR:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
