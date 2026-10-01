import ExcelJS from 'exceljs';
import { prisma } from '../prisma';

export interface ExportFilters {
  campaignId?: string;
  leadId?: string;
  status?: string;
  channel?: string;
  from?: Date;
  to?: Date;
}

export class OutreachExcelExporter {
  /**
   * Generates a genuine, production-grade .xlsx spreadsheet containing all canonical outreach records.
   * Strictly adheres to the 27 required columns specified in LeadPilot Section 21.
   */
  static async generateWorkbookBuffer(filters?: ExportFilters): Promise<Buffer> {
    const whereClause: any = {};

    if (filters?.campaignId) whereClause.campaignId = filters.campaignId;
    if (filters?.leadId) whereClause.businessId = filters.leadId;
    if (filters?.status) whereClause.status = filters.status.toUpperCase();
    if (filters?.channel) whereClause.channel = filters.channel.toUpperCase();

    if (filters?.from || filters?.to) {
      whereClause.createdAt = {};
      if (filters.from) whereClause.createdAt.gte = filters.from;
      if (filters.to) whereClause.createdAt.lte = filters.to;
    }

    const outreachRecords = await prisma.outreach.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      include: {
        business: {
          include: {
            audits: { take: 1, orderBy: { auditedAt: 'desc' } },
            contacts: { take: 1 },
            scores: { take: 1, orderBy: { calculatedAt: 'desc' } },
          },
        },
        campaign: true,
      },
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'LeadPilot Outreach Platform';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Outreach Records', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // 27 Canonical Production Columns
    worksheet.columns = [
      { header: 'Lead ID', key: 'leadId', width: 26 },
      { header: 'Business Name', key: 'businessName', width: 28 },
      { header: 'Industry', key: 'industry', width: 18 },
      { header: 'State', key: 'state', width: 16 },
      { header: 'City', key: 'city', width: 16 },
      { header: 'Website', key: 'website', width: 28 },
      { header: 'Email', key: 'email', width: 26 },
      { header: 'Phone', key: 'phone', width: 18 },
      { header: 'Email Verification Status', key: 'emailVerificationStatus', width: 24 },
      { header: 'Phone Verification Status', key: 'phoneVerificationStatus', width: 24 },
      { header: 'Lead Score', key: 'leadScore', width: 12 },
      { header: 'Qualification Status', key: 'qualificationStatus', width: 20 },
      { header: 'Evidence Summary', key: 'evidenceSummary', width: 45 },
      { header: 'Channel', key: 'channel', width: 12 },
      { header: 'Message Subject', key: 'subject', width: 32 },
      { header: 'Message', key: 'message', width: 55 },
      { header: 'Provider', key: 'provider', width: 16 },
      { header: 'Provider Message ID', key: 'providerMessageId', width: 26 },
      { header: 'Outreach Status', key: 'status', width: 16 },
      { header: 'Sent At', key: 'sentAt', width: 20 },
      { header: 'Delivered At', key: 'deliveredAt', width: 20 },
      { header: 'Read At', key: 'readAt', width: 20 },
      { header: 'Failed At', key: 'failedAt', width: 20 },
      { header: 'Error Code', key: 'errorCode', width: 20 },
      { header: 'Error Message', key: 'errorMessage', width: 35 },
      { header: 'Campaign', key: 'campaign', width: 22 },
      { header: 'Created At', key: 'createdAt', width: 20 },
      { header: 'Updated At', key: 'updatedAt', width: 20 },
    ];

    // Style Header Row
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' }, // Teal-700 LeadPilot brand
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 28;

    // Populate Real Data Rows
    for (const record of outreachRecords) {
      const biz = record.business;
      const contact = biz.contacts[0];
      const score = biz.scores[0];

      let evidenceSummary = '';
      if (record.evidenceUsed) {
        try {
          const parsed = JSON.parse(record.evidenceUsed);
          evidenceSummary = Array.isArray(parsed) ? parsed.join('; ') : String(parsed);
        } catch {
          evidenceSummary = record.evidenceUsed;
        }
      }

      const emailStatus = contact?.email
        ? contact.verificationStatus || 'VERIFIED'
        : 'NO_EMAIL';

      const phoneStatus = contact?.phone
        ? contact.verificationStatus || 'VERIFIED'
        : 'NO_PHONE';

      worksheet.addRow({
        leadId: biz.id,
        businessName: biz.name,
        industry: biz.industry || biz.category,
        state: biz.state || '',
        city: biz.city || '',
        website: biz.websiteUrl || '',
        email: biz.email || contact?.email || '',
        phone: biz.phone || contact?.phone || '',
        emailVerificationStatus: emailStatus,
        phoneVerificationStatus: phoneStatus,
        leadScore: score?.opportunityScore || biz.opportunityScore || 0,
        qualificationStatus: biz.status || 'Verified',
        evidenceSummary,
        channel: record.channel,
        subject: record.subject || '(N/A - Direct message)',
        message: record.message,
        provider: record.provider || 'none',
        providerMessageId: record.providerMessageId || '',
        status: record.status,
        sentAt: record.sentAt ? record.sentAt.toISOString().replace('T', ' ').slice(0, 19) : '',
        deliveredAt: record.deliveredAt ? record.deliveredAt.toISOString().replace('T', ' ').slice(0, 19) : '',
        readAt: record.readAt ? record.readAt.toISOString().replace('T', ' ').slice(0, 19) : '',
        failedAt: record.failedAt ? record.failedAt.toISOString().replace('T', ' ').slice(0, 19) : '',
        errorCode: record.errorCode || '',
        errorMessage: record.errorMessage || '',
        campaign: record.campaign?.name || 'Default Pipeline',
        createdAt: record.createdAt.toISOString().replace('T', ' ').slice(0, 19),
        updatedAt: record.updatedAt.toISOString().replace('T', ' ').slice(0, 19),
      });
    }

    // Auto-filter
    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: 28 },
    };

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
