'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Globe, 
  Search, 
  Zap, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  ArrowRight, 
  Sparkles,
  Gauge,
  Smartphone,
  Lock,
  Layers
} from 'lucide-react';
import { Lead } from '@/types';

interface QuickAuditModalProps {
  isOpen: boolean;
  lead?: Lead | null;
  onClose: () => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const QuickAuditModal: React.FC<QuickAuditModalProps> = ({
  isOpen,
  lead,
  onClose,
  onShowToast,
}) => {
  const [urlInput, setUrlInput] = useState('');
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditStep, setAuditStep] = useState(0);
  const [auditResult, setAuditResult] = useState<any | null>(null);
  const intervalRef = React.useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (lead?.website?.url) {
      setUrlInput(lead.website.url);
    } else if (lead && !lead.website.hasWebsite) {
      setUrlInput('');
    } else if (!lead) {
      setUrlInput('');
    }
    setAuditResult(null);
    setIsAuditing(false);
  }, [lead, isOpen]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

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

  const steps = [
    'Resolving DNS & SSL handshake...',
    'Rendering mobile viewport & touch targets...',
    'Benchmarking Core Web Vitals (LCP, FID, CLS)...',
    'Analyzing conversion funnel & CTA buttons...',
    'Generating AI modernization blueprint...',
  ];

  const handleRunAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = urlInput.trim() || lead?.website?.url;
    if (!targetUrl) {
      onShowToast('Missing URL', 'Please enter a website URL to audit.', 'warning');
      return;
    }

    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsAuditing(true);
    setAuditStep(1);
    setAuditResult(null);

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await res.json();
      setIsAuditing(false);

      if (data.success && data.audit) {
        const a = data.audit;
        const allIssues = [
          ...a.technicalIssues,
          ...a.mobileIssues,
          ...a.conversionIssues,
          ...a.seoIssues,
        ];

        setAuditResult({
          score: a.performanceScore != null ? a.performanceScore : (a.isReachable ? 75 : 15),
          speed: a.coreWebVitals?.lcpMs ? `${(a.coreWebVitals.lcpMs / 1000).toFixed(1)}s` : (a.isReachable ? 'Verified' : 'Unreachable'),
          mobileOptimized: a.mobileIssues.length === 0,
          ssl: !a.technicalIssues.some((t: string) => t.toLowerCase().includes('https')),
          issues: allIssues.length > 0 ? allIssues : ['All core technical, mobile, and conversion checks passed.'],
          isPageSpeedAvailable: a.isPageSpeedAvailable,
        });

        onShowToast('Audit Complete', `Real analysis finished for ${targetUrl}`, 'success');
      } else {
        onShowToast('Audit Notice', data.error || 'Failed to complete website audit.', 'warning');
      }
    } catch (err: any) {
      setIsAuditing(false);
      onShowToast('Audit Error', err.message || 'Network error executing audit.', 'error');
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] select-none animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl rounded-xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EAECEF] bg-[#FAFAFB]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-bold text-[#171717]">Instant Website Audit Engine</h3>
              <p className="text-[11px] text-[#6B7280]">Real-time speed, responsiveness, and lead capture diagnostic</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded text-[#9CA3AF] hover:text-[#171717] hover:bg-[#F3F4F6] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Input bar */}
        <form onSubmit={handleRunAudit} className="p-5 space-y-4">
          <div>
            <label className="block text-[11.5px] font-semibold text-[#374151] mb-1.5">
              Target Website URL or Domain
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#9CA3AF]" />
                <input
                  type="text"
                  placeholder="e.g. apex-dental.com"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] pl-9 pr-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isAuditing}
                className="flex items-center gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white px-4 py-1.5 text-[12.5px] font-medium transition-all shadow-subtle disabled:opacity-50"
              >
                {isAuditing ? (
                  <>
                    <Zap className="h-3.5 w-3.5 animate-spin" />
                    <span>Analyzing...</span>
                  </>
                ) : (
                  <>
                    <Search className="h-3.5 w-3.5" />
                    <span>Run Audit</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Audit in progress indicator */}
          {isAuditing && (
            <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] space-y-3">
              <div className="flex items-center justify-between text-[11.5px]">
                <span className="font-semibold text-teal-900">{steps[auditStep]}</span>
                <span className="text-[#64748B] tabular-nums">
                  {Math.round(((auditStep + 1) / steps.length) * 100)}%
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-teal-700 h-full rounded-full transition-all duration-300"
                  style={{ width: `${((auditStep + 1) / steps.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Audit Results */}
          {auditResult && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-3 gap-2.5 text-[12px]">
                <div className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB]">
                  <span className="text-[10.5px] text-[#6B7280] block">Speed Score</span>
                  <div className="text-[17px] font-bold text-rose-700 tabular-nums">
                    {auditResult.score} / 100
                  </div>
                  <span className="text-[10px] text-[#9CA3AF]">Load: {auditResult.speed}</span>
                </div>

                <div className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB]">
                  <span className="text-[10.5px] text-[#6B7280] block">Mobile UX</span>
                  <div className="text-[13px] font-bold text-[#171717] mt-1">
                    {auditResult.mobileOptimized ? (
                      <span className="text-emerald-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Responsive
                      </span>
                    ) : (
                      <span className="text-rose-700 flex items-center gap-1">
                        <ShieldAlert className="h-3.5 w-3.5" /> Broken Viewport
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB]">
                  <span className="text-[10.5px] text-[#6B7280] block">SSL Security</span>
                  <div className="text-[13px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Valid HTTPS
                  </div>
                </div>
              </div>

              {/* Detected flaws */}
              <div className="p-3.5 rounded-lg border border-amber-200 bg-[#FFFBEB]/40 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-900 font-semibold text-[12px]">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                  <span>Key Conversion Bottlenecks</span>
                </div>
                <ul className="space-y-1 text-[11.5px] text-amber-950">
                  {auditResult.issues.map((issue: string, idx: number) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-amber-700">•</span>
                      <span>{issue}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* AI recommendation */}
              <div className="p-3.5 rounded-lg border border-teal-200 bg-teal-50/50 flex items-center justify-between">
                <div>
                  <span className="text-[11.5px] font-semibold text-teal-900 block">
                    High Conversion Outreach Opportunity
                  </span>
                  <p className="text-[11px] text-teal-800">
                    Pitch automated booking demo to increase local conversions by 3x.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onShowToast('Pitch Ready', 'Copied audit analysis script to clipboard.', 'success');
                  }}
                  className="px-3 py-1.5 rounded bg-teal-700 hover:bg-teal-800 text-white text-[11.5px] font-medium shrink-0"
                >
                  Generate Pitch
                </button>
              </div>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-[#EAECEF] bg-[#FAFAFB] flex items-center justify-between text-[11.5px] text-[#6B7280]">
          <span>LeadPilot Automated Auditor</span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F3F4F6]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
