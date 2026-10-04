import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { commercialMilestoneService } from '@/services/commercial/CommercialMilestoneService';
import { CanonicalBusinessIdentity } from '@/types/canonical';

describe('Commercial Milestone Intelligence - Live Provider Tests', () => {
  const TEST_BUSINESS_ID = 'test-biz-live-milestone-1';

  beforeAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    try {
      await prisma.commercialMilestone.deleteMany({
        where: { businessId: TEST_BUSINESS_ID }
      });
      await prisma.business.deleteMany({
        where: { id: TEST_BUSINESS_ID }
      });
    } catch (e) {}

    await prisma.business.create({
      data: {
        id: TEST_BUSINESS_ID,
        name: 'Tech Corp India',
        category: 'Technology',
        industry: 'Software',
        country: 'India',
        businessStatus: 'OPERATIONAL',
        status: 'New'
      }
    });
  });

  afterAll(async () => {
    const { prisma } = await import('@/lib/prisma');
    try {
      await prisma.commercialMilestone.deleteMany({
        where: { businessId: TEST_BUSINESS_ID }
      });
      await prisma.business.deleteMany({
        where: { id: TEST_BUSINESS_ID }
      });
    } catch (e) {}
  });

  const baseIdentity: CanonicalBusinessIdentity = {
    name: 'Tech Corp India',
    category: 'Technology',
  };

  it('1. should parse GMV and strictly separate it from Revenue', async () => {
    const htmlText = `
      Tech Corp India today announced its quarterly results. 
      The company achieved a Gross Merchandise Value of Rs 500 Crore in Q3 2023. 
      However, the net revenue was much lower, standing at $10 Million.
    `;

    const milestones = await commercialMilestoneService.enrichMilestones(
      TEST_BUSINESS_ID,
      baseIdentity,
      {
        providedTexts: [
          { text: htmlText, sourceUrl: 'https://example.com/press', sourceType: 'PRIMARY' }
        ]
      }
    );

    expect(milestones.length).toBeGreaterThanOrEqual(2);

    const gmv = milestones.find(m => m.metricType === 'GMV');
    expect(gmv).toBeDefined();
    expect(gmv?.amount).toBe(5000000000); // 500 Crore
    expect(gmv?.currency).toBe('INR');
    expect(gmv?.period).toBe('Q3 2023');
    expect(gmv?.datePrecision).toBe('QUARTER');

    const revenue = milestones.find(m => m.metricType === 'REVENUE');
    expect(revenue).toBeDefined();
    expect(revenue?.amount).toBe(10000000); // 10 Million
    expect(revenue?.currency).toBe('USD');
  });

  it('2. should extract Sales figures and parse different date periods', async () => {
    const htmlText = `
      Record sales of €50M in FY2022.
    `;

    const milestones = await commercialMilestoneService.enrichMilestones(
      TEST_BUSINESS_ID,
      baseIdentity,
      {
        providedTexts: [
          { text: htmlText, sourceUrl: 'https://example.com/sales', sourceType: 'PRIMARY' }
        ]
      }
    );

    const sales = milestones.find(m => m.metricType === 'SALES');
    expect(sales).toBeDefined();
    expect(sales?.amount).toBe(50000000); 
    expect(sales?.currency).toBe('EUR');
    expect(sales?.period).toBe('FY2022');
    expect(sales?.datePrecision).toBe('YEAR');
  });

  it('3. should return empty (Not publicly available) when no valid milestones are found', async () => {
    const identity: CanonicalBusinessIdentity = { name: 'Ghost Biz', category: 'Unknown' };
    const htmlText = `This is a random page without any financial figures.`;

    const emptyMilestones = await commercialMilestoneService.enrichMilestones(
      TEST_BUSINESS_ID,
      identity,
      {
        providedTexts: [
          { text: htmlText, sourceUrl: 'https://example.com/about', sourceType: 'SECONDARY' }
        ]
      }
    );

    expect(emptyMilestones.length).toBe(0);
  });
  
  it('4. should extract ARR with USD currency correctly', async () => {
    const htmlText = `
      The startup's ARR stood at $2.5M by December 2023.
    `;

    const milestones = await commercialMilestoneService.enrichMilestones(
      TEST_BUSINESS_ID,
      baseIdentity,
      {
        providedTexts: [
          { text: htmlText, sourceUrl: 'https://example.com/arr', sourceType: 'PRIMARY' }
        ]
      }
    );

    const arr = milestones.find(m => m.metricType === 'ARR');
    expect(arr).toBeDefined();
    expect(arr?.amount).toBe(2500000); 
    expect(arr?.currency).toBe('USD');
    expect(arr?.period).toBe('DECEMBER 2023');
    expect(arr?.datePrecision).toBe('MONTH');
  });
});
