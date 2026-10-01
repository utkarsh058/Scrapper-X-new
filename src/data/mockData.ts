/**
 * LeadPilot — Real Data Mandate Notice
 * 
 * In accordance with production specifications, ALL mock businesses, fake names,
 * fake phone numbers, fake emails, fabricated website audits, and hardcoded demo records
 * have been permanently purged.
 * 
 * Real data is discovered via Google Places / OpenStreetMap and persisted canonically
 * into Prisma SQLite database (prisma/dev.db).
 */

import { Lead, MetricSummary } from '../types';

export const mockMetricSummary: MetricSummary = {
  businessesFound: 0,
  noWebsite: 0,
  poorWebsite: 0,
  qualifiedLeads: 0,
  totalLeads: 0,
  totalLeadsChange: 0,
  newLeads: 0,
  newLeadsChange: 0,
  noWebsiteChange: 0,
  poorWebsiteChange: 0,
  contactable: 0,
  contactablePercentage: 0,
};

export const mockLeads: Lead[] = [];

export const mockCampaigns: any[] = [];

export const mockNotifications: any[] = [];
