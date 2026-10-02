'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Globe2, 
  Search, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  Gauge, 
  Smartphone, 
  Lock, 
  ExternalLink,
  ArrowRight,
  Sparkles,
  BarChart3,
  RefreshCw,
  Loader2,
  FileSearch,
  X
} from 'lucide-react';
import { Lead } from '@/types';
import { FullAuditReportModal } from '@/components/dashboard/FullAuditReportModal';
import { ComprehensiveAuditReport } from '@/lib/audit/WebsiteAuditEngine';

interface WebsiteAuditViewProps {
  leads?: Lead[];
  onSelectLead: (lead: Lead) => void;
  onOpenQuickAudit: (lead?: Lead) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const WebsiteAuditView: React.FC<WebsiteAuditViewProps> = ({
  leads: propsLeads,
  onSelectLead,
  onOpenQuickAudit,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [leads, setLeads] = useState<Lead[]>(propsLeads || []);
  const [isLoading, setIsLoading] = useState(!propsLeads || propsLeads.length === 0);

  // Full Report modal state
  const [activeReport, setActiveReport] = useState<ComprehensiveAuditReport | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isReportLoading, setIsReportLoading] = useState(false);
  const [recheckingLeadId, setRecheckingLeadId] = useState<string | null>(null);
  const [isReportRechecking, setIsReportRechecking] = useState(false);

  // Audit Any URL modal state
  const [isAuditAnyUrlOpen, setIsAuditAnyUrlOpen] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [isAuditingCustomUrl, setIsAuditingCustomUrl] = useState(false);

  useEffect(() => {
    if (propsLeads && propsLeads.length > 0) {
      setLeads(propsLeads);
      setIsLoading(false);
      return;
    }

    // Fetch real persisted leads from database
    fetch('/api/leads?limit=50')
      .then((res) => res.json())
      .then((data) => {
        setIsLoading(false);
        if (data.success && Array.isArray(data.leads)) {
          setLeads(data.leads);
        }
      })
      .catch(() => setIsLoading(false));
  }, [propsLeads]);

  const auditedLeads = useMemo(() => {
    return leads.filter((l) => l.website?.hasWebsite || Boolean(l.websiteUrl));
  }, [leads]);

  const filtered = useMemo(() => {
    return auditedLeads.filter(
      (l) =>
        l.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.website?.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.websiteUrl?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.industry.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [auditedLeads, searchQuery]);

  // Aggregate statistics calculated strictly from real audit results
  const stats = useMemo(() => {
    if (auditedLeads.length === 0) {
      return {
        avgSpeed: 'Not Configured',
        speedSubtext: 'PageSpeed API key not configured or no evaluated sites',
        mobileFailPct: '0%',
        mobileSubtext: 'No sites evaluated yet',
        missingCtaPct: '0%',
        missingCtaSubtext: 'No sites evaluated yet',
      };
    }

    const scored = auditedLeads.filter((l) => l.website?.speedScore != null);
    const avgScore = scored.length > 0
      ? Math.round(scored.reduce((acc, l) => acc + (l.website.speedScore || 0), 0) / scored.length)
      : null;

    const evaluatedMobile = auditedLeads.filter((l) => l.website?.mobileOptimized !== undefined);
    const mobileFails = auditedLeads.filter((l) => l.website?.mobileOptimized === false).length;
    const mobileFailPct = evaluatedMobile.length > 0 
      ? `${Math.round((mobileFails / evaluatedMobile.length) * 100)}%` 
      : '0%';

    const missingCta = auditedLeads.filter((l) =>
      (l.websiteIssues || []).some((i) => 
        i.toLowerCase().includes('booking') || 
        i.toLowerCase().includes('form') ||
        i.toLowerCase().includes('cta') ||
        i.toLowerCase().includes('call')
      )
    ).length;
    const missingCtaPct = `${Math.round((missingCta / auditedLeads.length) * 100)}%`;

    return {
      avgSpeed: avgScore !== null ? `${avgScore} / 100` : 'Not Configured',
      speedSubtext: avgScore !== null 
        ? `Based on ${scored.length} evaluated domains` 
        : 'Google PageSpeed API key required',
      mobileFailPct,
      mobileSubtext: evaluatedMobile.length > 0 
        ? `${mobileFails} of ${evaluatedMobile.length} evaluated sites fail viewport checks`
        : 'Awaiting mobile layout scans',
      missingCtaPct,
      missingCtaSubtext: `${missingCta} of ${auditedLeads.length} sites lack clear booking / CTA`,
    };
  }, [auditedLeads]);

  // Trigger full report modal for a lead
  const handleOpenFullReport = async (lead: Lead) => {
    const rawUrl = lead.websiteUrl || lead.website?.url;
    if (!rawUrl) {
      onShowToast('No URL', 'This lead does not have an associated website URL.', 'warning');
      return;
    }

    setIsReportLoading(true);
    setIsReportModalOpen(true);
    setActiveReport(null);

    try {
      // 1. Try to fetch existing audit report
      const res = await fetch(`/api/audit?businessId=${encodeURIComponent(lead.id)}&url=${encodeURIComponent(rawUrl)}`);
      const data = await res.json();

      if (data.success && data.report) {
        setActiveReport(data.report);
        setIsReportLoading(false);
        return;
      }

      // 2. If not found in database, execute fresh live audit
      const auditRes = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: rawUrl,
          businessId: lead.id,
          leadId: lead.id,
          businessName: lead.businessName,
        }),
      });

      const auditData = await auditRes.json();
      if (auditData.success && auditData.report) {
        setActiveReport(auditData.report);
        
        // Update local lead record with verified audit findings
        updateLeadWithAudit(lead.id, auditData.report);
        onShowToast('Audit Complete', `Real data collected for ${auditData.report.domain}`, 'success');
      } else {
        onShowToast('Audit Notice', auditData.error || 'Failed to complete website audit.', 'warning');
        setIsReportModalOpen(false);
      }
    } catch (err: any) {
      onShowToast('Audit Error', err.message || 'Error executing website audit.', 'error');
      setIsReportModalOpen(false);
    } finally {
      setIsReportLoading(false);
    }
  };

  // Re-check action (table row or modal)
  const handleRecheckLead = async (leadId: string, url: string, businessName?: string) => {
    setRecheckingLeadId(leadId);
    setIsReportRechecking(true);

    try {
      const res = await fetch('/api/audit/recheck', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          businessId: leadId,
          businessName,
        }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        updateLeadWithAudit(leadId, data.report);
        if (isReportModalOpen) {
          setActiveReport(data.report);
        }
        onShowToast('Re-Check Complete', `Fresh audit finished for ${data.report.domain}`, 'success');
      } else {
        onShowToast('Re-Check Failed', data.error || 'Could not complete re-check.', 'warning');
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Network error during re-check.', 'error');
    } finally {
      setRecheckingLeadId(null);
      setIsReportRechecking(false);
    }
  };

  // Audit Any URL handler
  const handleAuditCustomUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = customUrlInput.trim();
    if (!target) {
      onShowToast('Missing URL', 'Please enter a valid website address.', 'warning');
      return;
    }

    setIsAuditingCustomUrl(true);
    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });

      const data = await res.json();
      if (data.success && data.report) {
        setIsAuditAnyUrlOpen(false);
        setCustomUrlInput('');
        setActiveReport(data.report);
        setIsReportModalOpen(true);
        onShowToast('Audit Generated', `Evidence collected for ${data.report.domain}`, 'success');
      } else {
        onShowToast('Audit Notice', data.error || 'Failed to complete audit.', 'warning');
      }
    } catch (err: any) {
      onShowToast('Error', err.message || 'Audit execution error.', 'error');
    } finally {
      setIsAuditingCustomUrl(false);
    }
  };

  const updateLeadWithAudit = (leadId: string, report: ComprehensiveAuditReport) => {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        const issues = report.findings
          .filter((f) => f.status === 'FAIL' || f.status === 'WARNING')
          .map((f) => f.check);

        return {
          ...l,
          websiteIssues: issues,
          auditIssues: issues,
          website: {
            ...l.website,
            hasWebsite: true,
            url: report.domain,
            speedScore: report.performance?.score != null ? report.performance.score : undefined,
            mobileOptimized: report.mobile?.viewportConfigured && !report.mobile?.hasHorizontalOverflowRisk,
            sslSecure: report.sslValid,
            detectedIssues: issues,
            status: issues.length > 0 ? 'Needs Website Improvement' : 'Website Available',
          },
        };
      })
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">Website Audit & Conversion Diagnostics</h1>
          <p className="text-[12px] text-[#6B7280]">
            Automated technical benchmarks, mobile responsiveness checks, and conversion leak analysis on real websites.
          </p>
        </div>
        <button
          onClick={() => setIsAuditAnyUrlOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-1.5 text-[12.5px] font-medium transition-all shadow-subtle self-start sm:self-auto cursor-pointer"
        >
          <Zap className="h-3.5 w-3.5" />
          <span>Audit Any URL</span>
        </button>
      </div>

      {/* Diagnostics Grid Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <div className="flex items-center justify-between text-[11.5px] text-[#6B7280] mb-2">
            <span>Avg. Page Speed</span>
            <Gauge className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-[20px] font-bold text-[#171717] tabular-nums">
            {stats.avgSpeed}
          </div>
          <span className="text-[11px] text-slate-500 font-medium block mt-1">
            {stats.speedSubtext}
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <div className="flex items-center justify-between text-[11.5px] text-[#6B7280] mb-2">
            <span>Mobile Viewport Failures</span>
            <Smartphone className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-[20px] font-bold text-[#171717] tabular-nums">
            {stats.mobileFailPct}
          </div>
          <span className="text-[11px] text-[#6B7280] block mt-1">
            {stats.mobileSubtext}
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <div className="flex items-center justify-between text-[11.5px] text-[#6B7280] mb-2">
            <span>Missing Online Booking / CTA</span>
            <BarChart3 className="h-4 w-4 text-teal-700" />
          </div>
          <div className="text-[20px] font-bold text-[#171717] tabular-nums">
            {stats.missingCtaPct}
          </div>
          <span className="text-[11px] text-[#6B7280] block mt-1">
            {stats.missingCtaSubtext}
          </span>
        </div>
      </div>

      {/* Audit List Table */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle overflow-hidden">
        <div className="p-3.5 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-semibold text-[#171717]">Audited Domains</h3>
            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
              {filtered.length} verified websites
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search website, company..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-[#E5E7EB] bg-[#F7F8FA] pl-8 pr-3 py-1 text-[12px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Globe2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <h4 className="text-[14px] font-semibold text-slate-800">No Audited Domains in Database</h4>
              <p className="text-[12px] text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Run a search on the Overview tab or click &quot;Audit Any URL&quot; to inspect a live website with real evidence.
              </p>
              <button
                onClick={() => setIsAuditAnyUrlOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-teal-700 text-white text-[12px] font-medium hover:bg-teal-800 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                <span>Audit a Website Now</span>
              </button>
            </div>
          ) : (
            <table className="w-full text-left text-[12.5px]">
              <thead className="border-b border-[#EAECEF] bg-[#FAFAFB] text-[11px] font-semibold text-[#6B7280] uppercase">
                <tr>
                  <th className="px-4 py-2.5">Business & URL</th>
                  <th className="px-3 py-2.5">Industry</th>
                  <th className="px-3 py-2.5">Speed Score</th>
                  <th className="px-3 py-2.5">Mobile Check</th>
                  <th className="px-3 py-2.5">SSL</th>
                  <th className="px-3 py-2.5">Detected Flaws</th>
                  <th className="px-4 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F1F3F5]">
                {filtered.map((lead) => {
                  const url = lead.websiteUrl || lead.website?.url;
                  const speed = lead.website?.speedScore;
                  const isMobileChecked = lead.website?.mobileOptimized !== undefined;
                  const isSslChecked = lead.website?.sslSecure !== undefined;
                  const hasAuditRecord = isMobileChecked || isSslChecked || speed != null || (lead.websiteIssues && lead.websiteIssues.length > 0);
                  const flaws = lead.websiteIssues?.length || lead.website?.detectedIssues?.length || 0;
                  const isRecheckingThis = recheckingLeadId === lead.id;

                  return (
                    <tr key={lead.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-semibold text-[#171717]">{lead.businessName}</span>
                          {url ? (
                            <a
                              href={url.startsWith('http') ? url : `https://${url}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-[11.5px] text-teal-800 hover:underline flex items-center gap-1 mt-0.5"
                            >
                              <span>{url.replace(/^https?:\/\//, '')}</span>
                              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                            </a>
                          ) : (
                            <span className="text-[11.5px] text-slate-400">No URL</span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <span className="text-[11.5px] text-[#4B5563]">{lead.industry}</span>
                      </td>

                      <td className="px-3 py-3">
                        {speed != null ? (
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${speed >= 80 ? 'bg-emerald-500' : speed >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`}
                                style={{ width: `${Math.max(5, Math.min(100, speed))}%` }}
                              />
                            </div>
                            <span className="font-bold tabular-nums text-[12px] text-[#171717]">
                              {speed}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-mono">Not Configured</span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {!isMobileChecked ? (
                          <span className="text-[11px] text-slate-400 font-mono">Not Checked</span>
                        ) : lead.website?.mobileOptimized ? (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Pass
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-rose-700 font-medium">
                            <ShieldAlert className="h-3 w-3" /> Fail
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {!isSslChecked ? (
                          <span className="text-[11px] text-slate-400 font-mono">Not Checked</span>
                        ) : lead.website?.sslSecure ? (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-emerald-700 font-medium">
                            <CheckCircle2 className="h-3 w-3" /> Valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11.5px] text-amber-700 font-medium">
                            <AlertTriangle className="h-3 w-3" /> Insecure
                          </span>
                        )}
                      </td>

                      <td className="px-3 py-3">
                        {!hasAuditRecord ? (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500 border border-slate-200">
                            Not Audited
                          </span>
                        ) : flaws === 0 ? (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
                            0 verified issues
                          </span>
                        ) : (
                          <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                            {flaws} verified issues
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            disabled={!url || isRecheckingThis}
                            onClick={() => url && handleRecheckLead(lead.id, url, lead.businessName)}
                            className="px-2 py-1 rounded border border-[#D1D5DB] bg-white text-[11.5px] font-medium text-[#374151] hover:bg-[#F3F4F6] cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                            title="Run a real-time re-check against the live website"
                          >
                            {isRecheckingThis && <Loader2 className="h-3 w-3 animate-spin text-teal-700" />}
                            <span>Re-check</span>
                          </button>
                          <button
                            disabled={!url}
                            onClick={() => handleOpenFullReport(lead)}
                            className="px-2.5 py-1 rounded bg-teal-700 hover:bg-teal-800 text-white text-[11.5px] font-medium cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
                          >
                            <span>Full Report</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Full Audit Report Modal */}
      <FullAuditReportModal
        isOpen={isReportModalOpen}
        report={activeReport}
        isLoading={isReportLoading}
        onClose={() => {
          setIsReportModalOpen(false);
          setActiveReport(null);
        }}
        onRecheck={(url) => {
          const matchingLead = leads.find((l) => (l.websiteUrl || l.website?.url)?.includes(new URL(url).hostname));
          handleRecheckLead(matchingLead?.id || 'manual', url, matchingLead?.businessName);
        }}
        isRechecking={isReportRechecking}
      />

      {/* Audit Any URL Modal */}
      {isAuditAnyUrlOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs select-none animate-fade-in"
          onClick={() => !isAuditingCustomUrl && setIsAuditAnyUrlOpen(false)}
        >
          <div 
            className="relative w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-md bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-bold text-slate-900">Audit Any Website URL</h3>
                  <p className="text-[11px] text-slate-500">Live multi-page crawl, SEO & conversion diagnostic</p>
                </div>
              </div>
              <button
                disabled={isAuditingCustomUrl}
                onClick={() => setIsAuditAnyUrlOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAuditCustomUrl} className="space-y-3.5">
              <div>
                <label className="block text-[11.5px] font-semibold text-slate-700 mb-1">
                  Website Domain or URL
                </label>
                <input
                  type="text"
                  required
                  disabled={isAuditingCustomUrl}
                  placeholder="https://example.com"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[12.5px] text-slate-900 placeholder-slate-400 focus:border-teal-700 focus:outline-none"
                />
                <span className="text-[10.5px] text-slate-500 mt-1 block">
                  Audits technical headers, viewport responsiveness, SEO meta tags, booking buttons, and technology stack.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={isAuditingCustomUrl}
                  onClick={() => setIsAuditAnyUrlOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAuditingCustomUrl}
                  className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[12px] font-semibold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isAuditingCustomUrl ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Auditing Live...</span>
                    </>
                  ) : (
                    <>
                      <FileSearch className="h-3.5 w-3.5" />
                      <span>Run Full Audit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
