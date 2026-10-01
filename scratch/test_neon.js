const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  try {
    const count = await prisma.business.count();
    const jobCount = await prisma.job.count();
    console.log('CONNECTION: OK');
    console.log('Business count:', count);
    console.log('Job count:', jobCount);

    const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`;
    console.log('Tables:', tables.map(t => t.table_name).join(', '));

    // Safe write test: upsert a test business and immediately check it
    const testId = 'neon_test_connection_check';
    const biz = await prisma.business.upsert({
      where: { id: testId },
      update: { name: 'Neon Connection Test (Safe to delete)', updatedAt: new Date() },
      create: {
        id: testId,
        name: 'Neon Connection Test (Safe to delete)',
        category: 'TEST',
        industry: 'TEST',
        country: 'India',
        businessStatus: 'TEST',
      },
    });
    console.log('Write test: OK, id =', biz.id);

    // Read it back
    const readBack = await prisma.business.findUnique({ where: { id: testId } });
    console.log('Read test: OK, name =', readBack?.name);

    // Clean up test record
    await prisma.business.delete({ where: { id: testId } });
    console.log('Cleanup: OK');

  } catch(e) {
    console.error('FAILED:', e.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

test();
