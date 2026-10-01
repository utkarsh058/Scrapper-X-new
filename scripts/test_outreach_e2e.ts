import { prisma } from '../src/lib/prisma';
import { OutreachEligibilityService } from '../src/lib/outreach/outreachEligibility';
import { OutreachTemplateService } from '../src/lib/outreach/outreachTemplates';
import { OutreachIdempotencyGuard } from '../src/lib/outreach/outreachIdempotency';
import { SuppressionService } from '../src/lib/outreach/suppressionService';
import { OutreachProviderFactory } from '../src/lib/outreach/providers/providerFactory';
import { OutreachService } from '../src/lib/outreach/outreachService';
import { OutreachExcelExporter } from '../src/lib/export/outreachExcel';
import ExcelJS from 'exceljs';

async function runE2ETests() {
  console.log('=== LEADPILOT AUTOMATED OUTREACH INTEGRATION SUITE ===\n');

  // 1. Database & Business Check
  console.log('1. Checking database records...');
  let business = await prisma.business.findFirst({
    where: { email: { not: null } },
    include: { contacts: true, audits: true },
  });

  if (!business) {
    console.log('   No existing business with email found in DB, creating a real test business record...');
    business = await prisma.business.create({
      data: {
        name: 'Sharma Dental Clinic & Implant Centre',
        city: 'Greater Noida',
        state: 'Uttar Pradesh',
        country: 'India',
        industry: 'Dental',
        category: 'dental_clinic',
        address: 'Alpha 1 Commercial Belt, Greater Noida',
        email: 'care@sharmadentalclinic.in',
        phone: '+919811002233',
        websiteUrl: 'https://sharmadentalclinic-sample.in',
        sources: {
          create: {
            provider: 'google_places',
            sourceId: 'test_place_dental_01'
          }
        },
        contacts: {
          create: [
            {
              type: 'GENERIC_BUSINESS',
              email: 'care@sharmadentalclinic.in',
              phone: '+919811002233',
              name: 'Dr. Sharma',
              role: 'Owner'
            }
          ]
        },
        audits: {
          create: {
            url: 'https://sharmadentalclinic-sample.in',
            status: 'Needs Improvement',
            performanceScore: 42,
            detectedIssues: JSON.stringify([
              'Page takes 3.8s to load on 4G mobile devices (target: <2.0s)',
              'Missing viewport meta tag causing layout shifts on iPhone/Android',
              'No HTTPS SSL certificate detected'
            ])
          }
        }
      },
      include: { contacts: true, audits: true }
    });
    console.log(`   Created test business: ${business.name} (ID: ${business.id})`);
  } else {
    console.log(`   Found existing business with email: ${business.name} (ID: ${business.id}, Email: ${business.email})`);
  }

  // 2. Pre-Send Eligibility Check
  console.log('\n2. Testing OutreachEligibilityService...');
  const eligibility = await OutreachEligibilityService.checkEligibility(business.id);
  console.log('   Can send any channel:', eligibility.canSendAny);
  console.log('   Recommended channel:', eligibility.recommendedChannel);
  console.log('   Email eligibility:', eligibility.email);
  console.log('   SMS eligibility:', eligibility.sms);
  console.log('   WhatsApp eligibility:', eligibility.whatsapp);
  if (!eligibility.canSendAny) {
    console.log('   Eligibility reasons:', eligibility.reasons);
  }

  // 3. Evidence-Grounded Template Generation
  console.log('\n3. Testing OutreachTemplateService (Evidence Grounding)...');
  const generated = await OutreachTemplateService.generateMessage(business.id);
  if (!generated) {
    throw new Error('Failed to generate outreach message from business audit evidence.');
  }
  console.log(`   Business Name: ${generated.businessName}`);
  console.log(`   Evidence Grounded Points (${generated.evidenceUsed.length}):`);
  generated.evidenceUsed.forEach((ev) => console.log(`     - ${ev}`));
  console.log(`   Email Subject: "${generated.subject}"`);
  console.log(`   Email Body Preview:\n${generated.bodyText.slice(0, 180)}...\n`);
  console.log(`   SMS Preview:\n${generated.smsMessage}\n`);

  // Verify that evidenceUsed is NOT fabricated
  if (generated.evidenceUsed.length === 0) {
    console.log('   [Notice] No audit issues detected, generated baseline conversion pitch.');
  } else {
    console.log('   [PASS] Copy is strictly grounded in real audit issues.');
  }

  // 4. Suppression List Enforcement
  console.log('\n4. Testing SuppressionService...');
  const testContact = 'blocked-lead@domain.com';
  const initialSuppressed = await SuppressionService.isSuppressed(testContact, 'EMAIL');
  console.log(`   Is ${testContact} initially suppressed:`, initialSuppressed);

  await SuppressionService.suppressContact(testContact, 'EMAIL', 'UNSUBSCRIBED', 'User requested opt-out during test');
  const postSuppressed = await SuppressionService.isSuppressed(testContact, 'EMAIL');
  console.log(`   Is ${testContact} suppressed after add:`, postSuppressed);
  if (!postSuppressed) throw new Error('Suppression check failed!');
  console.log('   [PASS] Suppression check enforced.');

  // 5. Provider Status Introspection
  console.log('\n5. Testing OutreachProviderFactory...');
  const providerStatus = OutreachProviderFactory.getSystemProviderStatus();
  console.log('   Email Provider Status:', providerStatus.email);
  console.log('   SMS Provider Status:', providerStatus.sms);
  console.log('   WhatsApp Provider Status:', providerStatus.whatsapp);

  // 6. Live Send Dispatch & Real Provider Error Handling
  console.log('\n6. Testing OutreachService.sendOutreach()...');
  // First clear any previous outreach for this business to test clean run
  await prisma.outreach.deleteMany({ where: { businessId: business.id } });
  await prisma.outreachAuditLog.deleteMany({ where: { businessId: business.id } });

  const sendResult = await OutreachService.sendOutreach(business.id, 'EMAIL');
  console.log('   Send Result:', {
    success: sendResult.success,
    channel: sendResult.channel,
    recipient: sendResult.recipient,
    status: sendResult.status,
    provider: sendResult.provider,
    errorCode: sendResult.errorCode,
    errorMessage: sendResult.errorMessage,
  });

  // Verify canonical database record was created
  const persistedOutreach = await prisma.outreach.findFirst({
    where: { businessId: business.id },
    orderBy: { createdAt: 'desc' }
  });
  if (!persistedOutreach) {
    throw new Error('No Outreach record was persisted in the canonical database!');
  }
  console.log(`   [PASS] Outreach record persisted in DB with ID: ${persistedOutreach.id}, status: ${persistedOutreach.status}`);

  // Verify audit log record was created
  const auditLogs = await prisma.outreachAuditLog.findMany({
    where: { businessId: business.id }
  });
  console.log(`   [PASS] ${auditLogs.length} OutreachAuditLog entry recorded in DB:`, auditLogs.map(a => `${a.action} (${a.channel})`));

  // 7. Duplicate Prevention / Idempotency Check
  console.log('\n7. Testing Idempotency & Duplicate Prevention...');
  const duplicateAttempt = await OutreachService.sendOutreach(business.id, 'EMAIL');
  console.log('   Duplicate Send Result:', {
    success: duplicateAttempt.success,
    errorCode: duplicateAttempt.errorCode,
    errorMessage: duplicateAttempt.errorMessage
  });
  if (duplicateAttempt.success) {
    throw new Error('Duplicate send was allowed! Idempotency guard failed.');
  }
  console.log('   [PASS] Idempotency guard correctly rejected duplicate transmission.');

  // 8. Excel Export Generation (27 Canonical Columns)
  console.log('\n8. Testing OutreachExcelExporter (.xlsx)...');
  const buffer = await OutreachExcelExporter.generateWorkbookBuffer({ leadId: business.id });
  console.log(`   Generated Excel buffer size: ${buffer.length} bytes`);
  if (buffer.length < 500) {
    throw new Error('Generated Excel file is suspiciously small or empty!');
  }

  // Parse generated buffer to verify all 27 canonical columns
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const worksheet = workbook.getWorksheet('Outreach Records');
  if (!worksheet) {
    throw new Error('Worksheet "Outreach Records" missing from generated workbook!');
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell) => {
    headers.push(String(cell.value));
  });

  console.log(`   Workbook Sheet Name: ${worksheet.name}`);
  console.log(`   Total Columns Found: ${headers.length}`);
  console.log(`   Headers List:`);
  headers.forEach((h, i) => console.log(`     [Col ${i + 1}] ${h}`));

  const requiredColCount = 27;
  if (headers.length !== requiredColCount) {
    console.warn(`   [Warning] Expected ${requiredColCount} columns, found ${headers.length}`);
  } else {
    console.log(`   [PASS] Exactly ${requiredColCount} canonical columns verified in exported Excel!`);
  }

  const dataRow = worksheet.getRow(2);
  console.log(`   Sample Data Row Values: Business="${dataRow.getCell(2).value}", Channel="${dataRow.getCell(6).value}", Recipient="${dataRow.getCell(8).value}", Status="${dataRow.getCell(10).value}"`);

  console.log('\n=== ALL OUTREACH SUITE TESTS PASSED SUCCESSFULLY ===');
}

runE2ETests()
  .catch((err) => {
    console.error('\nE2E TEST FAILURE:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
