'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Globe, 
  ExternalLink, 
  Mail, 
  Phone, 
  MapPin, 
  Building2, 
  Sparkles, 
  MonitorPlay, 
  Copy, 
  Check, 
  Send, 
  Edit3, 
  FileSearch,
  Loader2
} from 'lucide-react';
import { Lead } from '@/types';

interface LeadDetailDrawerProps {
  lead: Lead | null;
  onClose: () => void;
  onQuickAudit: (lead: Lead) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const LeadDetailDrawer: React.FC<LeadDetailDrawerProps> = ({
  lead,
  onClose,
  onQuickAudit,
  onShowToast,
}) => {
  // Outreach state
  const [isGeneratingOutreach, setIsGeneratingOutreach] = useState(false);
  const [outreachMessage, setOutreachMessage] = useState<string | null>(null);
  const [isEditingOutreach, setIsEditingOutreach] = useState(false);
  const [copiedOutreach, setCopiedOutreach] = useState(false);

  // Demo state
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [demoReady, setDemoReady] = useState(false);
  const [previewDemoOpen, setPreviewDemoOpen] = useState(false);

  // Copy contact states
  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState(false);

  useEffect(() => {
    if (lead) {
      setOutreachMessage(null);
      setIsEditingOutreach(false);
      setDemoReady(lead.demoGenerated || false);
      setIsGeneratingDemo(false);
      setIsGeneratingOutreach(false);
      setPreviewDemoOpen(false);
    }
  }, [lead?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && lead) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lead, onClose]);

  if (!lead) return null;

  const detectedIssues = (lead.website.detectedIssues && lead.website.detectedIssues.length > 0)
    ? lead.website.detectedIssues
    : lead.auditIssues && lead.auditIssues.length > 0
    ? lead.auditIssues
    : lead.website.qualityReason
    ? [lead.website.qualityReason]
    : lead.website.hasWebsite
    ? ['All core technical and responsiveness checks passed']
    : ['No detected website found for this business'];

  const handleCopyPhone = () => {
    if (!lead.contact.phone) return;
    navigator.clipboard.writeText(lead.contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
    onShowToast('Phone Copied', lead.contact.phone, 'info');
  };

  const handleCopyEmail = () => {
    if (!lead.contact.email) return;
    navigator.clipboard.writeText(lead.contact.email);
    setCopiedEmail(true);
    setTimeout(() => setCopiedEmail(false), 2000);
    onShowToast('Email Copied', lead.contact.email, 'info');
  };

  const handleGenerateOutreach = () => {
    setIsGeneratingOutreach(true);
    setTimeout(() => {
      setIsGeneratingOutreach(false);
      const generated = `Hi ${lead.contact.name || 'there'},\n\nI was looking into ${lead.industry.toLowerCase()} businesses in ${lead.location.city} and came across ${lead.businessName}.\n\nI noticed ${
        lead.website.hasWebsite 
          ? `your website has detectable issues (${detectedIssues.slice(0, 2).join(', ')}), which could be costing you prospective clients.` 
          : `you don't currently have an active modern website, which means local customers are visiting competitors instead.`
      }\n\nWe put together a rapid interactive prototype showing how a streamlined modern site for ${lead.businessName} could boost conversions.\n\nWould you be open to a 30-second preview?\n\nBest,\nAlex Morgan\nLeadPilot`;
      setOutreachMessage(generated);
      onShowToast('AI Outreach Generated', `Created personalized pitch for ${lead.businessName}.`, 'success');
    }, 800);
  };

  const handleCopyOutreach = () => {
    if (!outreachMessage) return;
    navigator.clipboard.writeText(outreachMessage);
    setCopiedOutreach(true);
    setTimeout(() => setCopiedOutreach(false), 2000);
    onShowToast('Copied to Clipboard', 'Outreach message ready to paste.', 'success');
  };

  const handleSendOutreach = () => {
    onShowToast('Outreach Sent', `Message dispatched to ${lead.contact.email || lead.businessName}.`, 'success');
  };

  const handleGenerateDemo = () => {
    setIsGeneratingDemo(true);
    setTimeout(() => {
      setIsGeneratingDemo(false);
      setDemoReady(true);
      onShowToast('Demo Ready', `Demo website generated for ${lead.businessName}.`, 'success');
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/35 backdrop-blur-[2px] flex justify-end transition-opacity">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Drawer */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-2xl border-l border-[#E2E8F0] flex flex-col z-10 animate-slide-in-right select-none overflow-y-auto">
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#E2E8F0] flex items-start justify-between bg-white sticky top-0 z-20">
          <div>
            <h2 className="text-[17px] font-bold text-[#0F172A] tracking-tight">
              {lead.businessName}
            </h2>
            <div className="flex items-center gap-2 mt-1 text-[12px] text-[#64748B]">
              <span className="font-medium text-[#334155]">{lead.industry}</span>
              <span>•</span>
              <span>{lead.location.city}{lead.location.state ? `, ${lead.location.state}` : ''}</span>
            </div>
          </div>

          <button
            onClick={onClose}
            className="h-9 w-9 min-h-[36px] min-w-[36px] rounded-xl text-[#94A3B8] hover:text-[#0F172A] hover:bg-[#F1F5F9] flex items-center justify-center transition-colors btn-pressable cursor-pointer"
            title="Close drawer (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="p-6 space-y-6">
          {/* Section: Contact & Location */}
          <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[12.5px]">
            <div>
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
                Phone
              </span>
              {lead.contact.phone ? (
                <button
                  onClick={handleCopyPhone}
                  className="font-medium text-[#0F172A] hover:text-teal-700 flex items-center gap-1.5 transition-colors cursor-pointer btn-pressable min-h-[32px]"
                  title="Click to copy phone"
                >
                  <Phone className="h-3.5 w-3.5 text-[#94A3B8]" />
                  <span>{lead.contact.phone}</span>
                  {copiedPhone && <Check className="h-3 w-3 text-emerald-600" />}
                </button>
              ) : (
                <span className="text-[#94A3B8] text-[12px]">Not available</span>
              )}
            </div>

            <div>
              <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
                Email
              </span>
              {lead.contact.email ? (
                <button
                  onClick={handleCopyEmail}
                  className="font-medium text-[#0F172A] hover:text-teal-700 flex items-center gap-1.5 transition-colors truncate max-w-full cursor-pointer btn-pressable min-h-[32px]"
                  title="Click to copy email"
                >
                  <Mail className="h-3.5 w-3.5 text-[#94A3B8] shrink-0" />
                  <span className="truncate">{lead.contact.email}</span>
                  {copiedEmail && <Check className="h-3 w-3 text-emerald-600 shrink-0" />}
                </button>
              ) : (
                <span className="text-[#94A3B8] text-[12px]">Not available</span>
              )}
            </div>
          </div>

          {/* Section: Website & Status */}
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
                  Website
                </span>
                {lead.website.hasWebsite && lead.website.url ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://${lead.website.url}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium text-teal-700 hover:text-teal-800 hover:underline inline-flex items-center gap-1"
                    >
                      <span>{lead.website.url}</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>
                ) : (
                  <span className="text-[13px] font-medium text-[#0F172A]">
                    No Website
                  </span>
                )}
              </div>

              <div className="text-right">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
                  Website Status
                </span>
                {lead.website.status === 'Needs Website Improvement' || lead.website.status === 'Needs Improvement' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    Needs Improvement
                  </span>
                ) : lead.website.status === 'No Website' || !lead.website.hasWebsite ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                    No Website
                  </span>
                ) : lead.website.status === 'Website Unreachable' || lead.website.status === 'Unreachable' ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                    Unreachable
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Website Available
                  </span>
                )}
              </div>
            </div>

            {/* DETECTED WEBSITE ISSUES */}
            <div className="p-4 rounded-xl border border-[#E2E8F0] bg-white space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider">
                  Detected Website Issues
                </span>
                {lead.website.hasWebsite && detectedIssues.length > 0 && (
                  <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                    {detectedIssues.length} {detectedIssues.length === 1 ? 'issue' : 'issues'} detected
                  </span>
                )}
              </div>
              <ul className="space-y-1.5 text-[12.5px] text-[#334155]">
                {detectedIssues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold">•</span>
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Primary Actions: [ Audit Website ] [ Generate AI Message ] [ Create Website Demo ] */}
          <div className="space-y-3 pt-2">
            <span className="text-[11px] font-bold text-[#475569] uppercase tracking-wider block">
              Actions
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Audit Website Action */}
              <button
                onClick={() => onQuickAudit(lead)}
                className="flex items-center justify-center gap-1.5 h-10 min-h-[40px] px-3 rounded-xl border border-[#CBD5E1] bg-white text-[12px] font-medium text-[#0F172A] hover:bg-[#F8FAFC] transition-colors shadow-2xs cursor-pointer btn-pressable"
              >
                <FileSearch className="h-3.5 w-3.5 text-[#64748B]" />
                <span>Audit Website</span>
              </button>

              {/* Generate AI Message Action */}
              <button
                onClick={handleGenerateOutreach}
                disabled={isGeneratingOutreach}
                className="flex items-center justify-center gap-1.5 h-10 min-h-[40px] px-3 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-[12px] font-medium transition-colors shadow-2xs cursor-pointer disabled:opacity-75 btn-pressable"
              >
                {isGeneratingOutreach ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                )}
                <span>Generate AI Message</span>
              </button>

              {/* Create Website Demo Action */}
              <button
                onClick={handleGenerateDemo}
                disabled={isGeneratingDemo || demoReady}
                className={`flex items-center justify-center gap-1.5 h-10 min-h-[40px] px-3 rounded-xl text-[12px] font-medium transition-colors shadow-2xs cursor-pointer btn-pressable ${
                  demoReady
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 cursor-default'
                    : 'border border-[#CBD5E1] bg-white text-[#0F172A] hover:bg-[#F8FAFC]'
                }`}
              >
                {isGeneratingDemo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-600" />
                ) : (
                  <MonitorPlay className="h-3.5 w-3.5 text-teal-600" />
                )}
                <span>{demoReady ? 'Demo Ready' : 'Create Website Demo'}</span>
              </button>
            </div>
          </div>

          {/* 11. AI Outreach Section (revealed on action) */}
          {outreachMessage && (
            <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/40 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-600" />
                  AI Personalized Message
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setIsEditingOutreach(!isEditingOutreach)}
                    className="p-1 text-[#64748B] hover:text-[#0F172A] rounded transition-colors cursor-pointer"
                    title={isEditingOutreach ? 'Done editing' : 'Edit message'}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>

                  <button
                    onClick={handleCopyOutreach}
                    className="p-1 text-[#64748B] hover:text-[#0F172A] rounded transition-colors cursor-pointer"
                    title="Copy message"
                  >
                    {copiedOutreach ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {isEditingOutreach ? (
                <textarea
                  value={outreachMessage}
                  onChange={(e) => setOutreachMessage(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-[#CBD5E1] bg-white p-2.5 text-[12px] text-[#0F172A] focus:outline-none focus:border-[#0F172A]"
                />
              ) : (
                <div className="p-3 bg-white rounded-lg border border-[#E2E8F0] text-[12px] text-[#334155] whitespace-pre-line leading-relaxed">
                  {outreachMessage}
                </div>
              )}

              {/* Outreach Action buttons: [ Edit ] [ Copy ] [ Send ] */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => setIsEditingOutreach(!isEditingOutreach)}
                  className="px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[11.5px] font-medium text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
                >
                  {isEditingOutreach ? 'Save Edit' : 'Edit'}
                </button>

                <button
                  onClick={handleCopyOutreach}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-[11.5px] font-medium text-[#334155] hover:bg-[#F8FAFC] cursor-pointer"
                >
                  {copiedOutreach ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  <span>Copy</span>
                </button>

                <button
                  onClick={handleSendOutreach}
                  className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-[11.5px] font-semibold cursor-pointer"
                >
                  <Send className="h-3 w-3 text-teal-400" />
                  <span>Send</span>
                </button>
              </div>
            </div>
          )}

          {/* 12. Website Demo Section (revealed when demo is ready) */}
          {demoReady && (
            <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 flex items-center justify-between animate-fade-in">
              <div>
                <p className="text-[12.5px] font-bold text-[#0F172A] flex items-center gap-1.5">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Demo Ready
                </p>
                <p className="text-[11.5px] text-[#64748B] mt-0.5">
                  High-converting preview generated for {lead.businessName}.
                </p>
              </div>

              <button
                onClick={() => setPreviewDemoOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#0F172A] hover:bg-[#1E293B] text-white text-[12px] font-semibold transition-colors cursor-pointer"
              >
                <span>Preview Demo</span>
                <ExternalLink className="h-3 w-3 text-teal-400" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clean Demo Preview Modal */}
      {previewDemoOpen && (
        <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="text-[12px] font-medium text-slate-600 ml-2">
                  demo.leadpilot.ai/{lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '-')}
                </span>
              </div>
              <button
                onClick={() => setPreviewDemoOpen(false)}
                className="h-7 w-7 rounded-lg text-slate-400 hover:text-slate-800 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="h-40 rounded-xl bg-slate-900 text-white p-6 flex flex-col justify-center">
                <span className="text-teal-400 text-xs font-semibold uppercase tracking-wider">
                  {lead.industry} Demo Prototype
                </span>
                <h3 className="text-xl font-bold mt-1">
                  {lead.businessName}
                </h3>
                <p className="text-sm text-slate-300 mt-1">
                  Fast mobile reservation & high-converting client portal.
                </p>
                <div className="mt-4 flex gap-2">
                  <span className="px-3 py-1 rounded bg-teal-600 text-white text-xs font-medium">
                    Book Online Now
                  </span>
                  <span className="px-3 py-1 rounded bg-slate-800 text-slate-300 text-xs font-medium">
                    View Services
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-2">
                <span>Speed Benchmark: 98/100 Mobile Score</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`https://demo.leadpilot.ai/${lead.businessName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`);
                    onShowToast('Demo Link Copied', 'Shareable prototype URL copied to clipboard.', 'success');
                  }}
                  className="text-teal-700 font-semibold hover:underline"
                >
                  Copy Shareable Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
