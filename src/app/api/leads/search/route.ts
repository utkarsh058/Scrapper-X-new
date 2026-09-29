import { NextRequest, NextResponse } from 'next/server';
import { isValidIndianState } from '@/data/indiaLocations';
import { resolveIndiaLocation } from '@/lib/geoResolver';
import { queryOverpassBusinesses } from '@/lib/overpassClient';
import { analyzeWebsiteQuality } from '@/lib/firecrawlAnalyzer';
import { leadsDb } from '@/lib/leadsDb';
import { Lead, SearchSummary, ContactFilter, WebsiteFilter } from '@/types';

/**
 * Evaluates whether a lead matches the selected Contact filter.
 */
function matchesContactFilter(lead: Lead, filter: ContactFilter | string): boolean {
  const hasPhone = Boolean(lead.phone && lead.phone.trim().length > 0);
  const hasEmail = Boolean(lead.email && lead.email.trim().length > 0);

  switch (filter) {
    case 'Email + Phone':
      return hasPhone && hasEmail;
    case 'Email Only':
      return hasEmail && !hasPhone;
    case 'Phone Only':
      return hasPhone && !hasEmail;
    case 'No Contact':
      return !hasPhone && !hasEmail;
    case 'Has Phone or Email':
    case 'Phone or Email':
      return hasPhone || hasEmail;
    case 'Has Email':
      return hasEmail;
    case 'Has Phone':
      return hasPhone;
    case 'All Contacts':
    case 'Any Contact':
    default:
      return true;
  }
}

/**
 * Evaluates whether a lead matches the selected Website filter.
 */
function matchesWebsiteFilter(lead: Lead, filter: WebsiteFilter | string): boolean {
  const hasWebsite = Boolean(lead.websiteUrl && lead.websiteUrl.trim().length > 0);
  const status = lead.websiteStatus;

  switch (filter) {
    case 'No Website':
      return !hasWebsite || status === 'No Website' || status === 'NO_WEBSITE';
    case 'Website Available':
      return hasWebsite;
    case 'Working':
      return hasWebsite && (status === 'Working' || status === 'WORKING');
    case 'Needs Improvement':
    case 'Needs Website Improvement':
      return hasWebsite && (status === 'Needs Improvement' || status === 'NEEDS_IMPROVEMENT');
    case 'Unreachable':
    case 'Website Unreachable':
      return hasWebsite && (status === 'Unreachable' || status === 'UNREACHABLE');
    case 'All Websites':
    case 'Any Website':
    default:
      return true;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      country = 'India',
      state,
      city,
      industry,
      contactFilter = 'All Contacts',
      websiteFilter = 'Any Website',
      limit = 100,
    } = body;

    // 1. Strict India-Only Location Validation
    if (country !== 'India') {
      return NextResponse.json(
        {
          success: false,
          error: 'Restricted to India only. Foreign locations are not permitted.',
          leads: [],
        },
        { status: 400 }
      );
    }

    if (!state || !isValidIndianState(state)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid Indian State or Union Territory: "${state}". Please select a valid region in India.`,
          leads: [],
        },
        { status: 400 }
      );
    }

    if (!industry || industry.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Industry is required.',
          leads: [],
        },
        { status: 400 }
      );
    }

    const requestedLimit = Math.min(Math.max(Number(limit) || 50, 10), 500);

    // 2. Resolve Geographic Search Area in India
    const bbox = await resolveIndiaLocation(state, city);

    // 3. Query OpenStreetMap (Overpass API)
    let discoveredLeads: Lead[] = [];
    try {
      discoveredLeads = await queryOverpassBusinesses({
        industry,
        state,
        city,
        bbox,
        limit: requestedLimit,
      });
    } catch (err: any) {
      console.error('[Search API] Overpass query error:', err);
      return NextResponse.json(
        {
          success: false,
          error: `Search limit or network timeout reached: ${err.message || 'Overpass service busy'}. Please try again shortly.`,
          leads: [],
        },
        { status: 503 }
      );
    }

    if (!discoveredLeads || discoveredLeads.length === 0) {
      const emptySummary: SearchSummary = {
        total: 0,
        withPhone: 0,
        withEmail: 0,
        emailAndPhone: 0,
        hasPhoneOrEmail: 0,
        noContact: 0,
        noWebsite: 0,
        websiteAvailable: 0,
        workingWebsite: 0,
        needsImprovement: 0,
        unreachable: 0,
      };

      return NextResponse.json({
        success: true,
        leads: [],
        summary: emptySummary,
        message: 'No businesses found for these criteria.',
      });
    }

    // 4. Website Analysis & Public Contact Extraction
    // Inspect reachable websites concurrently in batches of 6
    const BATCH_SIZE = 6;
    const matchedLeads: Lead[] = [];
    const analyzedLeads: Lead[] = [];

    for (let i = 0; i < discoveredLeads.length; i += BATCH_SIZE) {
      // Early stop if we have already satisfied the requested limit of matching leads
      if (matchedLeads.length >= requestedLimit) {
        break;
      }

      const batch = discoveredLeads.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (lead) => {
          if (!lead.websiteUrl) {
            lead.websiteStatus = 'No Website';
            lead.website.status = 'No Website';
            lead.website.hasWebsite = false;
            return lead;
          }

          try {
            const analysis = await analyzeWebsiteQuality(lead.websiteUrl);
            lead.websiteStatus = analysis.status;
            lead.websiteIssues = analysis.reasons;
            lead.websiteAudit = analysis.audit;

            // UI backward compatibility
            lead.website.status = analysis.status;
            lead.website.detectedIssues = analysis.reasons;
            lead.website.qualityReason = analysis.reasons[0];
            lead.website.pagesAnalyzed = analysis.pagesAnalyzed;
            lead.website.speedScore = analysis.speedScore;
            lead.website.mobileOptimized = analysis.mobileOptimized;
            lead.website.sslSecure = analysis.sslSecure;
            lead.website.hasWebsite = analysis.hasWebsite;

            // If website analysis discovered a public email and lead had none, set it
            if (analysis.publicEmail && !lead.email) {
              lead.email = analysis.publicEmail;
              lead.contact.email = analysis.publicEmail;
              lead.contact.hasEmail = true;
              lead.source = 'OSM + Website';
            }

            // If website analysis discovered a public phone and lead had none, set it
            if (analysis.publicPhone && !lead.phone) {
              lead.phone = analysis.publicPhone;
              lead.contact.phone = analysis.publicPhone;
              lead.contact.hasPhone = true;
              lead.source = 'OSM + Website';
            }

            // Recalculate contact type and score
            const hasPhone = Boolean(lead.phone);
            const hasEmail = Boolean(lead.email);
            lead.contact.hasPhone = hasPhone;
            lead.contact.hasEmail = hasEmail;
            lead.contact.verified = hasPhone || hasEmail;
            lead.contact.contactType = hasPhone && hasEmail 
              ? 'Email + Phone' 
              : hasPhone 
              ? 'Phone' 
              : hasEmail 
              ? 'Email' 
              : 'None';

            lead.leadScore = (hasPhone ? 30 : 0) + (hasEmail ? 40 : 0) + (lead.websiteUrl ? 20 : 10);
            return lead;
          } catch (auditErr) {
            console.warn(`[Search API] Failed auditing ${lead.websiteUrl}:`, auditErr);
            lead.websiteStatus = 'Working';
            lead.website.status = 'Working';
            return lead;
          }
        })
      );

      for (const lead of batchResults) {
        analyzedLeads.push(lead);
        if (matchesContactFilter(lead, contactFilter) && matchesWebsiteFilter(lead, websiteFilter)) {
          matchedLeads.push(lead);
        }
      }
    }

    // 6. Enforce Maximum Target Limit (Never fabricate results)
    const finalLeads = matchedLeads.slice(0, requestedLimit);

    // 7. Persist Matched Leads into Database
    try {
      leadsDb.upsertBatch(finalLeads);
    } catch (dbErr) {
      console.warn('[Search API] Failed caching leads to database:', dbErr);
    }

    // 8. Calculate Dynamic Real Statistics Strictly from Real Search Results
    const summary: SearchSummary = {
      total: finalLeads.length,
      withPhone: finalLeads.filter((l) => Boolean(l.phone)).length,
      withEmail: finalLeads.filter((l) => Boolean(l.email)).length,
      emailAndPhone: finalLeads.filter((l) => Boolean(l.email && l.phone)).length,
      hasPhoneOrEmail: finalLeads.filter((l) => Boolean(l.email || l.phone)).length,
      noContact: finalLeads.filter((l) => !l.email && !l.phone).length,
      noWebsite: finalLeads.filter((l) => !l.websiteUrl || l.websiteStatus === 'No Website').length,
      websiteAvailable: finalLeads.filter((l) => Boolean(l.websiteUrl)).length,
      workingWebsite: finalLeads.filter((l) => l.websiteStatus === 'Working').length,
      needsImprovement: finalLeads.filter((l) => l.websiteStatus === 'Needs Improvement').length,
      unreachable: finalLeads.filter((l) => l.websiteStatus === 'Unreachable').length,
    };

    // Record search job
    try {
      leadsDb.recordSearchJob({
        id: `job_${Date.now()}`,
        status: 'completed',
        criteria: {
          country: 'India',
          state,
          city,
          industry,
          contactFilter,
          websiteFilter,
          limit: requestedLimit,
        },
        totalDiscovered: discoveredLeads.length,
        totalMatched: finalLeads.length,
        summary,
        createdAt: new Date().toISOString(),
      });
    } catch {
      // Ignore search job record failure
    }

    return NextResponse.json({
      success: true,
      leads: finalLeads,
      summary,
      totalDiscovered: discoveredLeads.length,
      limit: requestedLimit,
      attribution: '© OpenStreetMap contributors',
    });
  } catch (error: any) {
    console.error('[Search API Fatal Error]:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred while searching for leads.',
        leads: [],
      },
      { status: 500 }
    );
  }
}
