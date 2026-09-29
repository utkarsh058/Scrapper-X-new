'use client';

import React, { useState } from 'react';
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
  BarChart3
} from 'lucide-react';
import { mockLeads } from '@/data/mockData';
import { Lead } from '@/types';

interface WebsiteAuditViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenQuickAudit: (lead: Lead) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const WebsiteAuditView: React.FC<WebsiteAuditViewProps> = ({
  onSelectLead,
  onOpenQuickAudit,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const auditedLeads = mockLeads.filter(l => l.website.hasWebsite);

  const filtered = auditedLeads.filter(
    l => l.businessName.toLowerCase().includes(searchQuery.toLowerCase()) ||
         l.website.url?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         l.industry.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">Website Audit & Conversion Diagnostics</h1>
          <p className="text-[12px] text-[#6B7280]">
            Automated Lighthouse speed benchmarks, mobile responsiveness checks, and conversion leak analysis.
          </p>
        </div>
        <button
          onClick={() => onOpenQuickAudit(mockLeads[0])}
          className="flex items-center gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-1.5 text-[12.5px] font-medium transition-all shadow-subtle self-start sm:self-auto"
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
          <div className="text-[22px] font-bold text-[#171717] tabular-nums">48.2 / 100</div>
          <span className="text-[11px] text-rose-700 font-medium block mt-1">
            64% of discovered sites fail mobile speed thresholds
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <div className="flex items-center justify-between text-[11.5px] text-[#6B7280] mb-2">
            <span>Mobile Viewport Failures</span>
            <Smartphone className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-[22px] font-bold text-[#171717] tabular-nums">42.8%</div>
          <span className="text-[11px] text-[#6B7280] block mt-1">
            Unresponsive templates on modern iOS/Android
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <div className="flex items-center justify-between text-[11.5px] text-[#6B7280] mb-2">
            <span>Missing Online Booking / CTA</span>
            <BarChart3 className="h-4 w-4 text-teal-700" />
          </div>
          <div className="text-[22px] font-bold text-[#171717] tabular-nums">81.4%</div>
          <span className="text-[11px] text-emerald-700 font-medium block mt-1">
            Prime pitch target for instant demo sites
          </span>
        </div>
      </div>

      {/* Audit List Table */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle overflow-hidden">
        <div className="p-3.5 border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-semibold text-[#171717]">Audited Domains</h3>
            <span className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
              {filtered.length} websites
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
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-[#F9FAFB] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-semibold text-[#171717]">{lead.businessName}</span>
                      <a
                        href={`https://${lead.website.url}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11.5px] text-teal-800 hover:underline flex items-center gap-1 mt-0.5"
                      >
                        <span>{lead.website.url}</span>
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </a>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    <span className="text-[11.5px] text-[#4B5563]">{lead.industry}</span>
                  </td>

                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-12 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            (lead.website.speedScore || 0) > 70 ? 'bg-emerald-500' : 'bg-rose-500'
                          }`}
                          style={{ width: `${lead.website.speedScore || 20}%` }}
                        />
                      </div>
                      <span className="font-bold tabular-nums text-[12px] text-[#171717]">
                        {lead.website.speedScore || 30}
                      </span>
                    </div>
                  </td>

                  <td className="px-3 py-3">
                    {lead.website.mobileOptimized ? (
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
                    {lead.website.sslSecure ? (
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
                    <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 border border-amber-200">
                      {lead.website.issuesCount || 3} conversion issues
                    </span>
                  </td>

                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => onOpenQuickAudit(lead)}
                        className="px-2 py-1 rounded border border-[#D1D5DB] bg-white text-[11.5px] font-medium text-[#374151] hover:bg-[#F3F4F6]"
                      >
                        Re-check
                      </button>
                      <button
                        onClick={() => onSelectLead(lead)}
                        className="px-2.5 py-1 rounded bg-teal-700 hover:bg-teal-800 text-white text-[11.5px] font-medium"
                      >
                        Full Report
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
