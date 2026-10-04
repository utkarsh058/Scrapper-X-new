const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    console.log('Ensuring multi-country and multi-tenant schema in PostgreSQL...');

    // 1. Create Tenant table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Tenant" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "slug" TEXT NOT NULL UNIQUE,
        "allowedCountries" TEXT[] DEFAULT ARRAY['IN', 'US', 'CA'],
        "maxBusinessesPerSearch" INTEGER NOT NULL DEFAULT 500,
        "monthlyBusinessLimit" INTEGER NOT NULL DEFAULT 10000,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Create User table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "User" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "email" TEXT NOT NULL UNIQUE,
        "name" TEXT,
        "role" TEXT NOT NULL DEFAULT 'MEMBER',
        "tenantId" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure User table has tenantId and role if it already existed previously
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" TEXT NOT NULL DEFAULT 'MEMBER';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;`);

    // 3. Create Membership table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "Membership" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "userId" TEXT NOT NULL,
        "tenantId" TEXT NOT NULL,
        "role" TEXT NOT NULL DEFAULT 'MEMBER',
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Membership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "Membership_userId_tenantId_key" UNIQUE ("userId", "tenantId")
      );
    `);

    // 4. Create SearchJobRecord table
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SearchJobRecord" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "tenantId" TEXT NOT NULL,
        "userId" TEXT,
        "searchId" TEXT NOT NULL UNIQUE,
        "query" TEXT NOT NULL,
        "countryCode" TEXT NOT NULL DEFAULT 'IN',
        "regionCode" TEXT,
        "regionName" TEXT,
        "cityName" TEXT,
        "postalCode" TEXT,
        "status" TEXT NOT NULL DEFAULT 'CREATED',
        "requestedCount" INTEGER NOT NULL DEFAULT 50,
        "discoveredCount" INTEGER NOT NULL DEFAULT 0,
        "rawDiscoveredCount" INTEGER NOT NULL DEFAULT 0,
        "duplicatesCount" INTEGER NOT NULL DEFAULT 0,
        "deduplicatedCount" INTEGER NOT NULL DEFAULT 0,
        "excludedCount" INTEGER NOT NULL DEFAULT 0,
        "eligibleCount" INTEGER NOT NULL DEFAULT 0,
        "persistedCount" INTEGER NOT NULL DEFAULT 0,
        "failedCount" INTEGER NOT NULL DEFAULT 0,
        "error" TEXT,
        "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP(3),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SearchJobRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "SearchJobRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    `);

    // 5. Add columns to Business table safely
    await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "tenantId" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "countryCode" TEXT DEFAULT 'IN';`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "regionCode" TEXT;`);
    await prisma.$executeRawUnsafe(`ALTER TABLE "Business" ADD COLUMN IF NOT EXISTS "timezone" TEXT;`);

    // Add Foreign key constraint to Business if not existing
    try {
      await prisma.$executeRawUnsafe(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'Business_tenantId_fkey'
          ) THEN
            ALTER TABLE "Business" ADD CONSTRAINT "Business_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
          END IF;
        END $$;
      `);
    } catch (e) {
      console.warn('Foreign key check notice:', e.message);
    }

    // 6. Create indexes
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Business_tenantId_idx" ON "Business"("tenantId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Business_countryCode_idx" ON "Business"("countryCode");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SearchJobRecord_tenantId_idx" ON "SearchJobRecord"("tenantId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SearchJobRecord_searchId_idx" ON "SearchJobRecord"("searchId");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "SearchJobRecord_countryCode_idx" ON "SearchJobRecord"("countryCode");`);

    // 7. Seed default system tenant if absent
    const defaultTenant = await prisma.tenant.upsert({
      where: { slug: 'default-tenant' },
      update: {},
      create: {
        id: 'tenant_default',
        name: 'Default Organization',
        slug: 'default-tenant',
        allowedCountries: ['IN', 'US', 'CA'],
        maxBusinessesPerSearch: 500,
        monthlyBusinessLimit: 10000,
      },
    });

    console.log('Default Tenant ensured:', defaultTenant.id);
    console.log('MULTI_COUNTRY_AND_TENANT_SCHEMA_VERIFIED_SUCCESSFULLY');
  } catch (err) {
    console.error('ERROR_SETTING_UP_MULTI_COUNTRY_TABLES:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

run();
