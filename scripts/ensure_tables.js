const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SocialProfile" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "businessId" TEXT NOT NULL,
        "platform" TEXT NOT NULL,
        "profileUrl" TEXT,
        "username" TEXT,
        "displayName" TEXT,
        "description" TEXT,
        "followers" INTEGER,
        "displayFollowerCount" TEXT,
        "isRounded" BOOLEAN,
        "following" INTEGER,
        "posts" INTEGER,
        "subscribers" INTEGER,
        "videos" INTEGER,
        "likes" INTEGER,
        "verified" BOOLEAN,
        "createdAt" TIMESTAMP(3),
        "createdAtType" TEXT NOT NULL DEFAULT 'NOT_AVAILABLE',
        "firstSeenAt" TIMESTAMP(3),
        "lastActivityAt" TIMESTAMP(3),
        "source" TEXT NOT NULL,
        "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
        "createdAtSource" TEXT,
        "metricStatus" TEXT DEFAULT 'NOT_AVAILABLE',
        "metricSource" TEXT,
        "metricSourceType" TEXT DEFAULT 'NONE',
        "followersFetchedAt" TIMESTAMP(3),
        "verificationStatus" TEXT DEFAULT 'UNVERIFIED',
        "accountCreatedAt" TIMESTAMP(3),
        "accountCreatedDatePrecision" TEXT,
        "accountCreatedConfidence" TEXT,
        "accountCreatedStatus" TEXT DEFAULT 'NOT_AVAILABLE',
        "accountCreatedSourceType" TEXT,
        "accountCreatedSourceUrl" TEXT,
        "accountCreatedEvidenceText" TEXT,
        "accountCreatedFetchedAt" TIMESTAMP(3),
        "firstObservedAt" TIMESTAMP(3),
        "firstObservedSourceType" TEXT,
        "firstObservedSourceUrl" TEXT,
        "firstObservedEvidenceText" TEXT,
        "earliestPublicPostAt" TIMESTAMP(3),
        "earliestPublicPostSourceUrl" TEXT,
        "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "SocialProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SocialProfileSnapshot" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "profileId" TEXT NOT NULL,
        "followers" INTEGER,
        "displayFollowerCount" TEXT,
        "isRounded" BOOLEAN,
        "following" INTEGER,
        "posts" INTEGER,
        "subscribers" INTEGER,
        "videos" INTEGER,
        "likes" INTEGER,
        "isVerified" BOOLEAN,
        "metricStatus" TEXT DEFAULT 'NOT_AVAILABLE',
        "metricSourceType" TEXT DEFAULT 'NONE',
        "accountCreatedAt" TIMESTAMP(3),
        "accountCreatedAtType" TEXT DEFAULT 'NOT_AVAILABLE',
        "accountCreatedDatePrecision" TEXT,
        "accountCreatedConfidence" TEXT,
        "accountCreatedStatus" TEXT DEFAULT 'NOT_AVAILABLE',
        "accountCreatedSourceType" TEXT,
        "accountCreatedSourceUrl" TEXT,
        "accountCreatedEvidenceText" TEXT,
        "accountCreatedFetchedAt" TIMESTAMP(3),
        "firstObservedAt" TIMESTAMP(3),
        "firstObservedSourceType" TEXT,
        "firstObservedSourceUrl" TEXT,
        "firstObservedEvidenceText" TEXT,
        "earliestPublicPostAt" TIMESTAMP(3),
        "earliestPublicPostSourceUrl" TEXT,
        "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "source" TEXT NOT NULL,
        CONSTRAINT "SocialProfileSnapshot_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "SocialProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GoogleBusinessProfile" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "businessId" TEXT NOT NULL,
        "placeId" TEXT NOT NULL UNIQUE,
        "rating" DOUBLE PRECISION,
        "reviewCount" INTEGER,
        "googleMapsUrl" TEXT,
        "businessStatus" TEXT DEFAULT 'OPERATIONAL',
        "priceLevel" INTEGER,
        "profileCreatedAt" TIMESTAMP(3),
        "profileCreatedAtType" TEXT NOT NULL DEFAULT 'NOT_AVAILABLE',
        "firstSeenAt" TIMESTAMP(3),
        "lastCheckedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "GoogleBusinessProfile_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "ReviewSummary" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "businessId" TEXT NOT NULL UNIQUE,
        "googleProfileId" TEXT UNIQUE,
        "rating" DOUBLE PRECISION,
        "reviewCount" INTEGER,
        "reviewLevelDataAvailable" BOOLEAN NOT NULL DEFAULT false,
        "earliestAvailableReviewDate" TIMESTAMP(3),
        "source" TEXT NOT NULL DEFAULT 'google_places',
        "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "ReviewSummary_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "ReviewSummary_googleProfileId_fkey" FOREIGN KEY ("googleProfileId") REFERENCES "GoogleBusinessProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "SourceEvidence" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "field" TEXT NOT NULL,
        "value" TEXT NOT NULL,
        "source" TEXT NOT NULL,
        "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "confidence" TEXT NOT NULL DEFAULT 'HIGH',
        "metadata" TEXT,
        "businessId" TEXT,
        "socialProfileId" TEXT,
        CONSTRAINT "SourceEvidence_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT "SourceEvidence_socialProfileId_fkey" FOREIGN KEY ("socialProfileId") REFERENCES "SocialProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    console.log('TABLES_CREATED_OR_VERIFIED_SUCCESSFULLY');
  } catch (err) {
    console.error('ERROR_CREATING_TABLES:', err);
  } finally {
    await prisma.$disconnect();
  }
}

run();
