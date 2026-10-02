'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Globe,
  ExternalLink,
  Zap,
  Gauge,
  Smartphone,
  Search as SearchIcon,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Sparkles,
  ArrowRight,
  Code2,
  RefreshCw,
  HelpCircle,
} from 'lucide-react';
import { ComprehensiveAuditReport, AuditFinding } from '@/lib/audit/WebsiteAuditEngine';

interface FullAuditReportModalProps {
  isOpen: boolean;
  report: ComprehensiveAuditReport | null;
  isLoading?: boolean;
  onClose: () => void;
  onRecheck?: (url: string) => void;
  isRechecking?: boolean;
}

export const FullAuditReportModal: React.FC<FullAuditReportModalProps> = ({
  isOpen,
  report,
  isLoading = false,
  onClose,
  onRecheck,
  isRechecking = false,
}) => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'performance' | 'mobile' | 'seo' | 'conversion' | 'ux' | 'technical' | 'tech' | 'opportunities'
  >('overview');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const scoreBadgeColor = (score: number | null) => {
    if (score == null) return 'bg-slate-800 text-slate-400 border-slate-700';
    if (score >= 80) return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    if (score >= 50) return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'PASS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <CheckCircle2 className="h-3 w-3" /> PASS
          </span>
        );
      case 'FAIL':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/25">
            <ShieldAlert className="h-3 w-3" /> FAIL
          </span>
        );
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/25">
            <AlertTriangle className="h-3 w-3" /> WARNING
          </span>
        );
      case 'NOT_CHECKED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            <HelpCircle className="h-3 w-3" /> NOT CONFIGURED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
            UNAVAILABLE
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 w-full max-w-5xl max-h-[92vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-200">
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/60">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-400">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  {report?.businessName || report?.domain || 'Website Diagnostic Audit'}
                  {report?.isHttps && (
                    <span className="text-[11px] font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      HTTPS Secure
                    </span>
                  )}
                </h2>
                <div className="flex items-center gap-2 text-[12px] text-slate-400">
                  <a
                    href={report?.url}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-teal-400 transition-colors flex items-center gap-1 font-mono"
                  >
                    <span>{report?.url}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                  <span>•</span>
                  <span>Audited: {report ? new Date(report.auditedAt).toLocaleString() : 'N/A'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {report && onRecheck && (
              <button
                onClick={() => onRecheck(report.url)}
                disabled={isRechecking}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:bg-slate-800 text-[12px] font-medium flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isRechecking ? 'animate-spin text-teal-400' : ''}`} />
                <span>{isRechecking ? 'Auditing...' : 'Re-check'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="px-4 border-b border-slate-800/80 bg-slate-950 flex items-center gap-1 overflow-x-auto text-[12px] scrollbar-none">
          {[
            { id: 'overview', label: 'Overall Summary', icon: Sparkles },
            { id: 'performance', label: 'Performance (Core Web Vitals)', icon: Gauge },
            { id: 'mobile', label: 'Mobile & Viewport', icon: Smartphone },
            { id: 'seo', label: 'SEO Architecture', icon: SearchIcon },
            { id: 'conversion', label: 'Conversion & CTAs', icon: Zap },
            { id: 'ux', label: 'UX & Trust', icon: CheckCircle2 },
            { id: 'technical', label: 'Technical & Security', icon: ShieldCheck },
            { id: 'tech', label: 'Technologies', icon: Code2 },
            { id: 'opportunities', label: 'Modernization Blueprint', icon: ArrowRight },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as any)}
                className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? 'border-teal-400 text-white font-semibold'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-teal-400' : ''}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-6">
          {isLoading ? (
            <div className="py-20 text-center space-y-3">
              <RefreshCw className="h-8 w-8 text-teal-400 animate-spin mx-auto" />
              <p className="text-slate-300 font-medium">Running deep evidence-based audit...</p>
              <p className="text-[12px] text-slate-500">Checking SSL, Mobile Viewport, SEO tags, Conversion CTAs, and Core Web Vitals.</p>
            </div>
          ) : !report ? (
            <div className="py-20 text-center text-slate-400">No audit report available.</div>
          ) : (
            <>
              {/* SECTION: OVERVIEW */}
              {activeSection === 'overview' && (
                <div className="space-y-6">
                  {/* Category Scores Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-900 border border-teal-500/30 flex flex-col justify-between col-span-2 sm:col-span-1">
                      <span className="text-[11px] font-semibold text-teal-400 uppercase tracking-wider">Overall Score</span>
                      <div className="text-3xl font-extrabold text-white mt-2">
                        {report.scores.overall != null ? `${report.scores.overall}/100` : 'N/A'}
                      </div>
                      <span className="text-[10.5px] text-slate-400 mt-1">
                        {report.scores.overall != null ? 'Normalized index' : 'Insufficient data'}
                      </span>
                    </div>

                    {[
                      { title: 'Performance', score: report.scores.performance, sub: report.performance.configured ? 'Google PageSpeed' : 'Not Configured' },
                      { title: 'Mobile', score: report.scores.mobile, sub: report.mobile.viewportConfigured ? 'Viewport Pass' : 'Viewport Fail' },
                      { title: 'SEO', score: report.scores.seo, sub: `${report.seo.h1Tags.length > 0 ? 'H1 Present' : 'Missing H1'}` },
                      { title: 'Conversion', score: report.scores.conversion, sub: `${report.conversion.hasPhoneCta ? 'Phone Active' : 'No Phone'}` },
                      { title: 'UX & Trust', score: report.scores.ux, sub: `${report.ux.hasTrustSignals ? 'Social/Reviews' : 'Low Proof'}` },
                      { title: 'Technical', score: report.scores.technical, sub: `${report.isHttps ? 'HTTPS Valid' : 'Insecure HTTP'}` },
                    ].map((c) => (
                      <div key={c.title} className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
                        <span className="text-[11px] text-slate-400">{c.title}</span>
                        <div className={`text-2xl font-bold mt-1 tabular-nums ${c.score != null && c.score >= 70 ? 'text-emerald-400' : c.score != null && c.score >= 50 ? 'text-amber-400' : c.score != null ? 'text-rose-400' : 'text-slate-500'}`}>
                          {c.score != null ? c.score : 'N/A'}
                        </div>
                        <span className="text-[10px] text-slate-400 mt-1 truncate">{c.sub}</span>
                      </div>
                    ))}
                  </div>

                  {/* Summary Findings & Highlights */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                      <h4 className="text-[13px] font-bold text-white flex items-center gap-1.5">
                        <ShieldAlert className="h-4 w-4 text-rose-400" />
                        <span>Critical & High Severity Issues ({report.findings.filter((f) => f.status === 'FAIL').length})</span>
                      </h4>
                      <div className="space-y-2">
                        {report.findings.filter((f) => f.status === 'FAIL').length === 0 ? (
                          <div className="text-[12px] text-emerald-400 flex items-center gap-1.5 py-2">
                            <CheckCircle2 className="h-4 w-4" /> No critical failures detected.
                          </div>
                        ) : (
                          report.findings
                            .filter((f) => f.status === 'FAIL')
                            .slice(0, 5)
                            .map((f, i) => (
                              <div key={i} className="p-2.5 rounded-lg bg-rose-500/5 border border-rose-500/20 text-[12px] space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-semibold text-rose-300">{f.check}</span>
                                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 uppercase">
                                    {f.category}
                                  </span>
                                </div>
                                <p className="text-slate-300 text-[11.5px]">{f.evidence}</p>
                              </div>
                            ))
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                      <h4 className="text-[13px] font-bold text-white flex items-center gap-1.5">
                        <ArrowRight className="h-4 w-4 text-teal-400" />
                        <span>High-Value Modernization Opportunities ({report.opportunities.length})</span>
                      </h4>
                      <div className="space-y-2">
                        {report.opportunities.length === 0 ? (
                          <div className="text-[12px] text-slate-400 py-2">No modernization opportunities flagged.</div>
                        ) : (
                          report.opportunities.slice(0, 4).map((opp, i) => (
                            <div key={i} className="p-2.5 rounded-lg bg-teal-500/5 border border-teal-500/20 text-[12px] space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-teal-300">{opp.title}</span>
                                <span className="text-[10px] font-medium text-slate-400">{opp.recommendedService}</span>
                              </div>
                              <p className="text-[11.5px] text-slate-300">{opp.impact}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION: PERFORMANCE (CORE WEB VITALS) */}
              {activeSection === 'performance' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Gauge className="h-4 w-4 text-amber-400" />
                        <span>Google PageSpeed Insights & Core Web Vitals (Mobile)</span>
                      </h3>
                      <p className="text-[12px] text-slate-400 mt-0.5">
                        Real performance benchmarks evaluated directly from Google&apos;s Lighthouse auditing engine.
                      </p>
                    </div>
                    {report.performance.configured ? (
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px] font-semibold">
                        API Connected
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px] font-semibold">
                        Not Configured
                      </span>
                    )}
                  </div>

                  {!report.performance.configured ? (
                    <div className="p-6 rounded-xl bg-slate-900 border border-slate-800 text-center space-y-3">
                      <Gauge className="h-10 w-10 text-slate-600 mx-auto" />
                      <h4 className="text-base font-bold text-white">Google PageSpeed Insights Not Configured</h4>
                      <p className="text-[12.5px] text-slate-400 max-w-lg mx-auto">
                        To benchmark real live Core Web Vitals (LCP, INP, CLS, FCP, TTFB), set the server environment variable:
                      </p>
                      <code className="inline-block px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-teal-300 font-mono text-[12px]">
                        PAGESPEED_API_KEY=your_google_cloud_api_key
                      </code>
                      <p className="text-[11px] text-slate-500">
                        LeadPilot never shows fake or estimated PageSpeed scores.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Real Core Web Vitals Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[11px] text-slate-400 block mb-1">Performance Score</span>
                          <span className="text-2xl font-bold text-white">{report.performance.score ?? 'N/A'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1">Scale 0 - 100</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[11px] text-slate-400 block mb-1">LCP (Largest Contentful)</span>
                          <span className="text-2xl font-bold text-white">{report.performance.lcpMs ? `${(report.performance.lcpMs / 1000).toFixed(1)}s` : 'N/A'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1">Goal: &lt; 2.5s</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[11px] text-slate-400 block mb-1">INP / FID</span>
                          <span className="text-2xl font-bold text-white">{report.performance.inpMs ? `${report.performance.inpMs}ms` : 'N/A'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1">Goal: &lt; 200ms</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[11px] text-slate-400 block mb-1">CLS (Layout Shift)</span>
                          <span className="text-2xl font-bold text-white">{report.performance.cls ?? 'N/A'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1">Goal: &lt; 0.1</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[11px] text-slate-400 block mb-1">FCP (First Paint)</span>
                          <span className="text-2xl font-bold text-white">{report.performance.fcpMs ? `${(report.performance.fcpMs / 1000).toFixed(1)}s` : 'N/A'}</span>
                          <span className="text-[10px] text-slate-500 block mt-1">Goal: &lt; 1.8s</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                          <span className="text-[11px] text-slate-400 block mb-1">TTFB (Server Latency)</span>
                          <span className="text-2xl font-bold text-white">{report.performance.ttfbMs ? `${report.performance.ttfbMs}ms` : `${report.responseTimeMs}ms`}</span>
                          <span className="text-[10px] text-slate-500 block mt-1">Goal: &lt; 800ms</span>
                        </div>
                      </div>

                      {/* Performance Opportunities */}
                      {report.performance.opportunities.length > 0 && (
                        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
                          <h4 className="text-[13px] font-bold text-white">Google Lighthouse Optimization Opportunities</h4>
                          <div className="space-y-2">
                            {report.performance.opportunities.map((opp, i) => (
                              <div key={i} className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-[12px] flex items-center justify-between gap-3">
                                <div>
                                  <span className="font-semibold text-white block">{opp.title}</span>
                                  {opp.description && <span className="text-[11px] text-slate-400 block">{opp.description}</span>}
                                </div>
                                {opp.savings && (
                                  <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-mono text-[11px] font-bold whitespace-nowrap">
                                    {opp.savings}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* SECTION: MOBILE & VIEWPORT */}
              {activeSection === 'mobile' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Smartphone className="h-4 w-4 text-rose-400" />
                        <span>Mobile Responsiveness & Viewport Evaluation</span>
                      </h3>
                      <p className="text-[12px] text-slate-400">Verifying responsive design tags, overflow risks, and touch ergonomics.</p>
                    </div>
                    <span className="text-2xl font-bold text-white tabular-nums">{report.scores.mobile}/100</span>
                  </div>

                  <div className="space-y-2.5">
                    {report.findings
                      .filter((f) => f.category === 'Mobile')
                      .map((f, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-white text-[13px]">{f.check}</span>
                            {statusBadge(f.status)}
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-teal-300">
                            <strong>Evidence:</strong> {f.evidence}
                          </div>
                          <p className="text-[11.5px] text-slate-400">
                            <strong className="text-slate-300">Recommendation:</strong> {f.recommendation}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SECTION: SEO */}
              {activeSection === 'seo' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <SearchIcon className="h-4 w-4 text-teal-400" />
                        <span>On-Page SEO & Crawlability Structure</span>
                      </h3>
                      <p className="text-[12px] text-slate-400">Auditing metadata, headings, indexing directives, and schema markup.</p>
                    </div>
                    <span className="text-2xl font-bold text-white tabular-nums">{report.scores.seo}/100</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Title Length</span>
                      <span className="font-bold text-white text-base">{report.seo.titleLength} chars</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Meta Description</span>
                      <span className="font-bold text-white text-base">{report.seo.metaDescriptionLength} chars</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">H1 Count</span>
                      <span className="font-bold text-white text-base">{report.seo.h1Tags.length}</span>
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                      <span className="text-slate-400 block text-[11px]">Images Missing Alt</span>
                      <span className="font-bold text-white text-base">{report.seo.imagesMissingAlt} / {report.seo.totalImages}</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {report.findings
                      .filter((f) => f.category === 'SEO')
                      .map((f, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-white text-[13px]">{f.check}</span>
                            {statusBadge(f.status)}
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-teal-300">
                            <strong>Evidence:</strong> {f.evidence}
                          </div>
                          <p className="text-[11.5px] text-slate-400">
                            <strong className="text-slate-300">Recommendation:</strong> {f.recommendation}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SECTION: CONVERSION & CTAs */}
              {activeSection === 'conversion' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Zap className="h-4 w-4 text-teal-400" />
                        <span>Conversion Funnel & Call-to-Action Diagnostics</span>
                      </h3>
                      <p className="text-[12px] text-slate-400">Multi-page audit across homepage and subpages ({report.conversion.crawledPages.length} pages inspected).</p>
                    </div>
                    <span className="text-2xl font-bold text-white tabular-nums">{report.scores.conversion}/100</span>
                  </div>

                  {/* Summary Channels */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</span>
                      {report.conversion.hasPhoneCta ? <span className="text-emerald-400 font-bold">Present</span> : <span className="text-rose-400 font-bold">Missing</span>}
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp</span>
                      {report.conversion.hasWhatsappCta ? <span className="text-emerald-400 font-bold">Present</span> : <span className="text-rose-400 font-bold">Missing</span>}
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" /> Booking</span>
                      {report.conversion.hasBookingCta ? <span className="text-emerald-400 font-bold">Present</span> : <span className="text-amber-400 font-bold">Missing</span>}
                    </div>
                    <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between">
                      <span className="text-slate-400 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Lead Form</span>
                      {report.conversion.hasContactForm ? <span className="text-emerald-400 font-bold">Present</span> : <span className="text-rose-400 font-bold">Missing</span>}
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {report.findings
                      .filter((f) => f.category === 'Conversion')
                      .map((f, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-white text-[13px]">{f.check}</span>
                            {statusBadge(f.status)}
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-teal-300">
                            <strong>Evidence:</strong> {f.evidence}
                          </div>
                          <p className="text-[11.5px] text-slate-400">
                            <strong className="text-slate-300">Recommendation:</strong> {f.recommendation}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SECTION: UX & TRUST */}
              {activeSection === 'ux' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        <span>User Experience & Social Trust Indicators</span>
                      </h3>
                      <p className="text-[12px] text-slate-400">Auditing navigation clarity, proof points, reviews, and footer links.</p>
                    </div>
                    <span className="text-2xl font-bold text-white tabular-nums">{report.scores.ux}/100</span>
                  </div>

                  <div className="space-y-2.5">
                    {report.findings
                      .filter((f) => f.category === 'UX')
                      .map((f, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-white text-[13px]">{f.check}</span>
                            {statusBadge(f.status)}
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-teal-300">
                            <strong>Evidence:</strong> {f.evidence}
                          </div>
                          <p className="text-[11.5px] text-slate-400">
                            <strong className="text-slate-300">Recommendation:</strong> {f.recommendation}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SECTION: TECHNICAL */}
              {activeSection === 'technical' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                        <span>Technical Infrastructure & SSL Handshake</span>
                      </h3>
                      <p className="text-[12px] text-slate-400">Analyzing encryption, HTTP response codes, and security response headers.</p>
                    </div>
                    <span className="text-2xl font-bold text-white tabular-nums">{report.scores.technical}/100</span>
                  </div>

                  <div className="space-y-2.5">
                    {report.findings
                      .filter((f) => f.category === 'Technical')
                      .map((f, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-semibold text-white text-[13px]">{f.check}</span>
                            {statusBadge(f.status)}
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-slate-800/80 font-mono text-[11px] text-teal-300">
                            <strong>Evidence:</strong> {f.evidence}
                          </div>
                          <p className="text-[11.5px] text-slate-400">
                            <strong className="text-slate-300">Recommendation:</strong> {f.recommendation}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* SECTION: TECHNOLOGIES */}
              {activeSection === 'tech' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Code2 className="h-4 w-4 text-teal-400" />
                      <span>Detected Technologies & Platform Frameworks</span>
                    </h3>
                    <p className="text-[12px] text-slate-400 mt-0.5">
                      Identified directly from script signatures, HTML generator tags, and asset CDN headers.
                    </p>
                  </div>

                  {report.technologies.length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                      No prominent public CMS or framework signatures detected (custom static build or vanilla HTML).
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {report.technologies.map((t, i) => (
                        <div key={i} className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-bold text-white text-[13px]">{t.name}</span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-teal-500/10 text-teal-400 border border-teal-500/20 font-medium">
                              {t.category}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-slate-400">{t.evidence}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* SECTION: OPPORTUNITIES / MODERNIZATION BLUEPRINT */}
              {activeSection === 'opportunities' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-teal-950/40 to-slate-900 border border-teal-500/30">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-teal-400" />
                      <span>Evidence-Based Website Modernization Blueprint</span>
                    </h3>
                    <p className="text-[12px] text-slate-300 mt-1">
                      Actionable agency sales pitch & pitch deck points generated strictly from verified audit findings.
                    </p>
                  </div>

                  {report.opportunities.length === 0 ? (
                    <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                      This website is well-optimized with no high-severity modernization gaps detected.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {report.opportunities.map((opp, i) => (
                        <div key={i} className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2 hover:border-teal-500/40 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[13.5px] font-bold text-white">{opp.title}</span>
                            <span className="self-start sm:self-auto text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-500/15 text-teal-300 border border-teal-500/30">
                              Service: {opp.recommendedService}
                            </span>
                          </div>
                          <div className="p-2 rounded bg-slate-950 border border-slate-800 text-[11.5px] font-mono text-teal-300">
                            <strong>Observed Evidence:</strong> {opp.evidence}
                          </div>
                          <p className="text-[12px] text-slate-300">
                            <strong className="text-white">Business Impact:</strong> {opp.impact}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between text-[11.5px] text-slate-400">
          <span>LeadPilot Real-Data Audit Engine • Evidence Verified</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
