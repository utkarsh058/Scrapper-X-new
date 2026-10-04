const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('Adding creation date and first observed columns to SocialProfile...');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "accountCreatedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "accountCreatedDatePrecision" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "accountCreatedConfidence" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "accountCreatedStatus" TEXT DEFAULT \'NOT_AVAILABLE\';');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "accountCreatedSourceType" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "accountCreatedSourceUrl" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "accountCreatedEvidenceText" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "accountCreatedFetchedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "firstObservedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "firstObservedSourceType" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "firstObservedSourceUrl" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "firstObservedEvidenceText" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "earliestPublicPostAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfile" ADD COLUMN IF NOT EXISTS "earliestPublicPostSourceUrl" TEXT;');

    console.log('Adding creation date and first observed columns to SocialProfileSnapshot...');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "accountCreatedDatePrecision" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "accountCreatedConfidence" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "accountCreatedStatus" TEXT DEFAULT \'NOT_AVAILABLE\';');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "accountCreatedSourceType" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "accountCreatedSourceUrl" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "accountCreatedEvidenceText" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "accountCreatedFetchedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "firstObservedAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "firstObservedSourceType" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "firstObservedSourceUrl" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "firstObservedEvidenceText" TEXT;');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "earliestPublicPostAt" TIMESTAMP(3);');
    await prisma.$executeRawUnsafe('ALTER TABLE "SocialProfileSnapshot" ADD COLUMN IF NOT EXISTS "earliestPublicPostSourceUrl" TEXT;');

    console.log('CREATION_DATE_MIGRATION_SUCCESS');
  } catch (err) {
    console.error('CREATION_DATE_MIGRATION_ERROR:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
