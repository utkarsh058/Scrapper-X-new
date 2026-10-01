'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  Download, 
  ChevronDown, 
  FileSpreadsheet, 
  FileText, 
  X, 
  Mail, 
  Phone, 
  AlertCircle,
  ExternalLink,
  Loader2,
  Globe,
  MapPin,
  Building,
  AlertTriangle,
  Send
} from 'lucide-react';
import { 
  Lead, 
  SearchSummary 
} from '@/types';

interface LeadsTableProps {
  leads: Lead[];
  summary?: SearchSummary | null;
  errorMessage?: string | null;
  onSelectLead: (lead: Lead) => void;
  onQuickAudit?: (lead: Lead) => void;
  onOpenExportModal?: (selectedLeads: Lead[]) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  hasSearched?: boolean;
  isSearching?: boolean;
}

export const LeadsTable: React.FC<LeadsTableProps> = ({
  leads,
  summary,
  errorMessage,
  onSelectLead,
  onShowToast,
  hasSearched = false,
  isSearching = false,
}) => {
  // In-results search query (filters within returned real records)
  const [searchQuery, setSearchQuery] = useState('');
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  // Close export dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset pagination when search query or leads change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, leads]);

  // Filter in-memory leads by in-results search bar
  const displayedLeads = useMemo(() => {
    if (!hasSearched) return [];
    const q = searchQuery.toLowerCase().trim();
    if (!q) return leads;

    return leads.filter((lead) => {
      return (
        lead.businessName.toLowerCase().includes(q) ||
        lead.industry.toLowerCase().includes(q) ||
        lead.location.city.toLowerCase().includes(q) ||
        (lead.location.address && lead.location.address.toLowerCase().includes(q)) ||
        (lead.contact.email && lead.contact.email.toLowerCase().includes(q)) ||
        (lead.contact.phone && lead.contact.phone.toLowerCase().includes(q)) ||
        (lead.website.url && lead.website.url.toLowerCase().includes(q))
      );
    });
  }, [leads, hasSearched, searchQuery]);

  // Pagination
  const totalPages = Math.ceil(displayedLeads.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLeads = useMemo(() => {
    return displayedLeads.slice(startIndex, startIndex + pageSize);
  }, [displayedLeads, startIndex, pageSize]);

  // Dynamic calculated summary directly from real results (Section 10)
  const dynamicSummary: SearchSummary = useMemo(() => {
    if (summary) return summary;
    const withPhone = leads.filter((l) => l.contact.phone && l.contact.phone !== 'Not available' && l.contact.phone !== 'N/A').length;
    const withEmail = leads.filter((l) => l.contact.email && l.contact.email !== 'Not available' && l.contact.email !== 'N/A').length;
    const emailAndPhone = leads.filter(
      (l) => l.contact.phone && l.contact.phone !== 'Not available' && l.contact.phone !== 'N/A' && l.contact.email && l.contact.email !== 'Not available' && l.contact.email !== 'N/A'
    ).length;
    const hasPhoneOrEmail = leads.filter(
      (l) => (l.contact.phone && l.contact.phone !== 'Not available' && l.contact.phone !== 'N/A') || (l.contact.email && l.contact.email !== 'Not available' && l.contact.email !== 'N/A')
    ).length;
    const noContact = leads.filter(
      (l) => (!l.contact.phone || l.contact.phone === 'Not available' || l.contact.phone === 'N/A') && (!l.contact.email || l.contact.email === 'Not available' || l.contact.email === 'N/A')
    ).length;
    const noWebsite = leads.filter((l) => l.website.status === 'No Website' || !l.website.hasWebsite).length;
    const websiteAvailable = leads.filter((l) => Boolean(l.website.url) && l.website.status !== 'No Website').length;
    const workingWebsite = leads.filter((l) => l.website.status === 'Working' || l.website.status === 'Website Available').length;
    const needsImprovement = leads.filter(
      (l) => l.website.status === 'Needs Improvement' || l.website.status === 'Needs Website Improvement'
    ).length;
    const unreachable = leads.filter((l) => l.website.status === 'Unreachable' || l.website.status === 'Website Unreachable').length;

    return {
      total: leads.length,
      withPhone,
      withEmail,
      emailAndPhone,
      hasPhoneOrEmail,
      noContact,
      noWebsite,
      websiteAvailable,
      workingWebsite,
      needsImprovement,
      unreachable,
    };
  }, [leads, summary]);

  // Export handler
  const handleExport = (format: 'CSV' | 'Excel') => {
    setIsExportDropdownOpen(false);
    if (leads.length === 0) {
      onShowToast('Export Notice', 'No leads available to export.', 'info');
      return;
    }

    const headers = [
      'Business',
      'Industry',
      'Location',
      'Address',
      'Phone',
      'Email',
      'Website',
      'Website Status',
      'Website Issues',
      'Source'
    ];

    const rows = leads.map((l) => [
      `"${l.businessName.replace(/"/g, '""')}"`,
      `"${l.industry.replace(/"/g, '""')}"`,
      `"${l.location.city}${l.location.state ? `, ${l.location.state}` : ''}"`,
      `"${(l.location.address || '').replace(/"/g, '""')}"`,
      `"${l.contact.phone || 'Not available'}"`,
      `"${l.contact.email || 'Not available'}"`,
      `"${l.website.url || 'Not available'}"`,
      `"${l.website.status}"`,
      `"${(l.website.detectedIssues || []).join('; ').replace(/"/g, '""')}"`,
      `"${l.source || 'Google Places + Firecrawl'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    onShowToast(`Exported ${leads.length} Leads`, `Saved as ${format} file.`, 'success');
  };

  // Render Website Status Cell
  const renderWebsiteStatusCell = (lead: Lead) => {
    const isNoWeb = !lead.website.hasWebsite || lead.website.status === 'No Website' || !lead.website.url;
    const isUnreachable = 
      lead.website.status === 'Unreachable' || 
      lead.website.status === 'Website Unreachable';
    const isNeedsImprovement = 
      lead.website.status === 'Needs Improvement' || 
      lead.website.status === 'Needs Website Improvement';

    if (isNoWeb) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
          No Website
        </span>
      );
    }

    if (isUnreachable) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          Unreachable
        </span>
      );
    }

    if (isNeedsImprovement) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Needs Improvement
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Working
      </span>
    );
  };

  // Export Outreach Report (.xlsx) from real canonical database records
  const handleExportOutreachExcel = () => {
    setIsExportDropdownOpen(false);
    window.location.href = '/api/outreach/export';
    onShowToast('Export Started', 'Generating 27-column Outreach Report (.xlsx)...', 'success');
  };

  // Render Outreach Status Cell
  const renderOutreachStatusCell = (lead: Lead) => {
    const raw = String(lead.outreachStatus || '').toUpperCase();

    if (raw === 'SENT' || raw === 'DELIVERED' || raw === 'READ') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          {raw === 'DELIVERED' ? 'Delivered' : raw === 'READ' ? 'Read' : 'Sent'}
        </span>
      );
    }

    if (raw === 'QUEUED' || raw === 'SENDING' || raw === 'PENDING') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
          Queued
        </span>
      );
    }

    if (raw === 'FAILED' || raw === 'BOUNCED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
          {raw === 'BOUNCED' ? 'Bounced' : 'Failed'}
        </span>
      );
    }

    if (raw === 'SUPPRESSED') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          Suppressed
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium text-slate-500 bg-slate-50 border border-slate-200">
        Not Contacted
      </span>
    );
  };

  return (
    <div id="leads-section" className="rounded-2xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
      {/* 1. DEDICATED RESULTS HEADER */}
      <div className="p-4 sm:p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
        <div>
          <h2 className="text-[13px] font-bold text-[#475569] tracking-wider uppercase">
            Search Results
          </h2>
          {hasSearched && !isSearching && leads.length > 0 && (
            <p className="text-[12px] text-[#64748B] mt-0.5">
              {leads.length} {leads.length === 1 ? 'real business' : 'real businesses'} discovered via OpenStreetMap & Website Audit
            </p>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search input for finding a specific business inside the results */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8]" />
            <input
              type="text"
              placeholder="Search businesses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!hasSearched || isSearching || leads.length === 0}
              className="w-full h-9 min-h-[36px] pl-9 pr-8 rounded-xl border border-[#CBD5E1] bg-white text-[12px] text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#0F172A] focus:outline-none transition-all shadow-2xs disabled:bg-[#F8FAFC] disabled:cursor-not-allowed"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#0F172A] p-0.5 rounded cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Export Button */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              disabled={!hasSearched || isSearching || leads.length === 0}
              className="inline-flex items-center gap-1.5 h-9 min-h-[36px] px-3.5 rounded-xl border border-[#CBD5E1] bg-white text-[12px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors shadow-2xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5 text-[#64748B]" />
              <span>Export</span>
              <ChevronDown className="h-3 w-3 text-[#94A3B8]" />
            </button>

            {isExportDropdownOpen && (
              <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-[#E2E8F0] bg-white shadow-lg py-1 z-30 animate-popover text-[12px]">
                <button
                  onClick={() => handleExport('CSV')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-teal-600" />
                  <span>Leads (CSV)</span>
                </button>
                <button
                  onClick={() => handleExport('Excel')}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[#334155] hover:bg-[#F8FAFC] hover:text-[#0F172A] transition-colors cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Leads (Excel)</span>
                </button>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={handleExportOutreachExcel}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-teal-800 font-semibold hover:bg-teal-50/50 transition-colors cursor-pointer"
                >
                  <Send className="h-3.5 w-3.5 text-teal-600" />
                  <span>Outreach Report (.xlsx)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. DYNAMIC REAL SUMMARY BAR (SECTION 10) */}
      {hasSearched && !isSearching && leads.length > 0 && (
        <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex flex-wrap items-center gap-3 text-[12px]">
          <span className="font-bold text-[#0F172A]">
            {dynamicSummary.total} Businesses Found
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#334155] font-medium">
            <strong className="text-[#0F172A]">{dynamicSummary.hasPhoneOrEmail}</strong> Phone or Email
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#334155] font-medium">
            <strong className="text-[#0F172A]">{dynamicSummary.emailAndPhone}</strong> Email + Phone
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#334155] font-medium">
            <strong className="text-[#0F172A]">{dynamicSummary.withPhone}</strong> Phone Available
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#334155] font-medium">
            <strong className="text-[#0F172A]">{dynamicSummary.withEmail}</strong> Email Available
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#334155] font-medium">
            <strong className="text-[#64748B]">{dynamicSummary.noContact}</strong> Without Contact
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#334155] font-medium">
            <strong className="text-rose-700">{dynamicSummary.noWebsite}</strong> No Website
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#334155] font-medium">
            <strong className="text-emerald-700">{dynamicSummary.workingWebsite}</strong> Working Website
          </span>
          <span className="text-[#CBD5E1]">•</span>
          <span className="text-[#334155] font-medium">
            <strong className="text-amber-700">{dynamicSummary.needsImprovement}</strong> Needs Improvement
          </span>
          {dynamicSummary.unreachable > 0 && (
            <>
              <span className="text-[#CBD5E1]">•</span>
              <span className="text-[#334155] font-medium">
                <strong className="text-red-700">{dynamicSummary.unreachable}</strong> Unreachable
              </span>
            </>
          )}
        </div>
      )}

      {/* 3. MAIN TABLE / STATES */}
      <div className="overflow-x-auto min-h-[300px]">
        {/* State A: Before Search is Run */}
        {!hasSearched && !isSearching && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in">
            <div className="h-12 w-12 rounded-2xl bg-[#F8FAFC] flex items-center justify-center text-[#64748B] mb-3.5 border border-[#E2E8F0]">
              <Search className="h-5 w-5 text-[#64748B]" />
            </div>
            <h3 className="text-[16px] font-bold text-[#0F172A]">
              Ready to find leads
            </h3>
            <p className="text-[13px] text-[#64748B] max-w-md mt-1.5 leading-relaxed">
              Choose your criteria and find real businesses.
            </p>
          </div>
        )}

        {/* State B: Search In Progress */}
        {isSearching && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in">
            <div className="h-12 w-12 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-700 mb-3.5 border border-teal-200">
              <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
            </div>
            <h3 className="text-[16px] font-bold text-[#0F172A]">
              Finding real businesses on Google Places & Firecrawl...
            </h3>
            <p className="text-[13px] text-[#64748B] max-w-md mt-1.5 leading-relaxed">
              Crawling websites, extracting verified emails, and analyzing technical quality.
            </p>
          </div>
        )}

        {/* State C: API Error */}
        {hasSearched && !isSearching && errorMessage && (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center animate-fade-in">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-700 mb-3.5 border border-amber-200">
              <AlertTriangle className="h-6 w-6 text-amber-600" />
            </div>
            <h3 className="text-[16px] font-bold text-[#0F172A]">
              Notice
            </h3>
            <p className="text-[13px] text-[#475569] max-w-md mt-1.5 leading-relaxed">
              {errorMessage}
            </p>
          </div>
        )}

        {/* State D: Search Finished, Zero Results */}
        {hasSearched && !isSearching && !errorMessage && leads.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in">
            <div className="h-12 w-12 rounded-2xl bg-[#F8FAFC] flex items-center justify-center text-[#64748B] mb-3.5 border border-[#E2E8F0]">
              <AlertCircle className="h-5 w-5 text-[#94A3B8]" />
            </div>
            <h3 className="text-[16px] font-bold text-[#0F172A]">
              No businesses found for these criteria.
            </h3>
            <p className="text-[13px] text-[#64748B] max-w-sm mt-1.5 leading-relaxed">
              Try changing your search criteria.
            </p>
          </div>
        )}

        {/* State E: Results Table (Section 9 Columns) */}
        {hasSearched && !isSearching && leads.length > 0 && (
          <table className="w-full text-left text-[12.5px] border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                <th className="px-5 py-3">Business</th>
                <th className="px-3 py-3">Industry</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Website</th>
                <th className="px-3 py-3">Website Status</th>
                <th className="px-4 py-3">Website Issues</th>
                <th className="px-3 py-3">Outreach</th>
                <th className="px-3 py-3">Source</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1F5F9]">
              {paginatedLeads.map((lead) => {
                const phone = lead.contact.phone || 'Not available';
                const email = lead.contact.email || 'Not available';
                const hasPhone = phone !== 'Not available';
                const hasEmail = email !== 'Not available';
                const hasUrl = Boolean(lead.website.url && lead.website.url.trim().length > 0);
                const issues = lead.website.detectedIssues || [];

                return (
                  <tr
                    key={lead.id}
                    onClick={() => onSelectLead(lead)}
                    className="hover:bg-[#F8FAFC] transition-colors cursor-pointer group"
                  >
                    {/* 1. Business */}
                    <td className="px-5 py-3.5 align-top">
                      <div className="flex flex-col">
                        <span className="font-semibold text-[#0F172A] group-hover:text-teal-700 transition-colors">
                          {lead.businessName}
                        </span>
                        {lead.category && (
                          <span className="text-[11px] text-[#64748B] capitalize">
                            {lead.category}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 2. Industry */}
                    <td className="px-3 py-3.5 align-top text-[#334155] font-medium whitespace-nowrap">
                      {lead.industry}
                    </td>

                    {/* 3. Location */}
                    <td className="px-3 py-3.5 align-top text-[#475569] max-w-[170px]">
                      <div className="flex flex-col text-[11.5px]">
                        <span className="font-medium text-[#0F172A]">
                          {lead.location.city}{lead.location.state ? `, ${lead.location.state}` : ''}
                        </span>
                        {lead.location.address && lead.location.address !== 'Not available' && (
                          <span className="text-[10.5px] text-[#64748B] truncate" title={lead.location.address}>
                            {lead.location.address}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 4. Phone */}
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      {hasPhone ? (
                        <div className="inline-flex items-center gap-1.5 text-[#0F172A] font-medium" title={phone}>
                          <Phone className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                          <span>{phone}</span>
                        </div>
                      ) : (
                        <span className="text-[#94A3B8]">N/A</span>
                      )}
                    </td>

                    {/* 5. Email */}
                    <td className="px-3 py-3.5 align-top">
                      {hasEmail ? (
                        <div className="inline-flex items-center gap-1.5 text-[#0F172A] font-medium" title={email}>
                          <Mail className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                          <span className="truncate max-w-[140px]">{email}</span>
                        </div>
                      ) : (
                        <span className="text-[#94A3B8]">N/A</span>
                      )}
                    </td>

                    {/* 6. Website */}
                    <td className="px-3 py-3.5 align-top">
                      {hasUrl ? (
                        <a
                          href={lead.website.url}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[11.5px] text-teal-700 hover:text-teal-900 font-medium hover:underline max-w-[130px] truncate"
                          title={lead.website.url || ''}
                        >
                          <span className="truncate">{lead.website.url?.replace(/^https?:\/\//i, '').replace(/\/$/, '') || 'Website'}</span>
                          <ExternalLink className="h-3 w-3 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <span className="text-[#94A3B8]">N/A</span>
                      )}
                    </td>

                    {/* 7. Website Status */}
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      {renderWebsiteStatusCell(lead)}
                    </td>

                    {/* 8. Website Issues (Section 9) */}
                    <td className="px-4 py-3.5 align-top max-w-[220px]">
                      {issues.length > 0 ? (
                        <div className="space-y-0.5 text-[11px] text-[#475569]">
                          <span className="font-semibold text-amber-800 block text-[10.5px]">
                            {issues.length} {issues.length === 1 ? 'issue' : 'issues'}:
                          </span>
                          <ul className="space-y-0.5 text-[10.5px] text-[#64748B]">
                            {issues.slice(0, 2).map((iss, i) => (
                              <li key={i} className="flex items-start gap-1 leading-snug">
                                <span className="text-amber-600 font-bold">•</span>
                                <span className="truncate">{iss}</span>
                              </li>
                            ))}
                            {issues.length > 2 && (
                              <li className="text-[10px] text-teal-700 font-medium">
                                +{issues.length - 2} more issues
                              </li>
                            )}
                          </ul>
                        </div>
                      ) : lead.website.hasWebsite ? (
                        <span className="text-[11px] text-emerald-700 font-medium">
                          No issues detected
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#94A3B8]">
                          —
                        </span>
                      )}
                    </td>

                    {/* 9. Outreach Status */}
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      {renderOutreachStatusCell(lead)}
                    </td>

                    {/* 10. Source */}
                    <td className="px-3 py-3.5 align-top whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-[#F1F5F9] text-[#475569] border border-[#E2E8F0]">
                        {lead.source || 'Google Places'}
                      </span>
                    </td>

                    {/* 10. Actions */}
                    <td className="px-4 py-3.5 align-top text-right whitespace-nowrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectLead(lead);
                        }}
                        className="inline-flex items-center justify-center h-8.5 min-h-[34px] px-3.5 rounded-xl border border-[#CBD5E1] bg-white text-[12px] font-medium text-[#0F172A] hover:bg-[#0F172A] hover:text-white transition-all btn-pressable shadow-2xs cursor-pointer"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination & Attribution Footer */}
      {hasSearched && !isSearching && (
        <div className="px-5 py-3 border-t border-[#E2E8F0] bg-[#FAFBFD] flex flex-col sm:flex-row items-center justify-between gap-2 text-[12px] text-[#64748B]">
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <span>
                Showing {startIndex + 1}–{Math.min(startIndex + pageSize, displayedLeads.length)} of {displayedLeads.length} results
              </span>
            )}
            <span className="text-[11px] text-[#94A3B8]">
              Data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline hover:text-[#0F172A]">OpenStreetMap contributors</a>
            </span>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[12px] text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                Previous
              </button>
              <span className="px-2 text-[#0F172A] font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 rounded-lg border border-[#CBD5E1] bg-white text-[12px] text-[#0F172A] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F8FAFC] transition-colors cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
