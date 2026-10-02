export interface WebsiteBadgeConfig {
  label: string;
  badgeClass: string;
  dotClass: string;
}

/**
 * Returns the badge configuration for displaying a lead's website status in the UI.
 * Accurately reflects the actual stored website status without falsely converting
 * "Working" into "Website Available".
 */
export function getLeadWebsiteStatusBadge(lead: {
  website?: { status?: string; hasWebsite?: boolean; url?: string };
  websiteStatus?: string;
  websiteUrl?: string;
}): WebsiteBadgeConfig {
  const status = (lead.website?.status || lead.websiteStatus || '').trim();
  const upper = status.toUpperCase().replace(/[\s_-]+/g, '_');
  const hasWeb = lead.website?.hasWebsite !== false && Boolean(lead.website?.url || lead.websiteUrl);

  if (!hasWeb || upper === 'NO_WEBSITE') {
    return {
      label: 'No Website',
      badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
      dotClass: 'bg-rose-500',
    };
  }

  if (upper === 'NEEDS_IMPROVEMENT' || upper === 'NEEDS_WEBSITE_IMPROVEMENT') {
    return {
      label: 'Needs Improvement',
      badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
      dotClass: 'bg-amber-500',
    };
  }

  if (upper === 'UNREACHABLE' || upper === 'WEBSITE_UNREACHABLE') {
    return {
      label: 'Unreachable',
      badgeClass: 'bg-red-50 text-red-700 border border-red-200',
      dotClass: 'bg-red-500',
    };
  }

  if (upper === 'WORKING' || upper === 'LIVE') {
    return {
      label: 'Working',
      badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      dotClass: 'bg-emerald-500',
    };
  }

  // Safe fallback for unknown or missing status
  return {
    label: status || 'Unknown',
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    dotClass: 'bg-slate-400',
  };
}
