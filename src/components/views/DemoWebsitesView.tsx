'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  MonitorPlay, 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Eye, 
  Layers, 
  Smartphone, 
  Laptop,
  Plus,
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { Lead } from '@/types';

interface DemoWebsitesViewProps {
  leads?: Lead[];
  onSelectLead: (lead: Lead) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const DemoWebsitesView: React.FC<DemoWebsitesViewProps> = ({
  leads: propsLeads,
  onSelectLead,
  onShowToast,
}) => {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [leads, setLeads] = useState<Lead[]>(propsLeads || []);
  const [selectedDemoLead, setSelectedDemoLead] = useState<Lead | null>(null);
  const [generatedDemo, setGeneratedDemo] = useState<any | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (propsLeads && propsLeads.length > 0) {
      setLeads(propsLeads);
      setSelectedDemoLead(propsLeads[0]);
      return;
    }

    fetch('/api/leads?limit=25')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.leads) && data.leads.length > 0) {
          setLeads(data.leads);
          setSelectedDemoLead(data.leads[0]);
        }
      })
      .catch(() => {});
  }, [propsLeads]);

  // When selected lead changes, check or auto-generate demo
  useEffect(() => {
    if (!selectedDemoLead) {
      setGeneratedDemo(null);
      return;
    }

    // Auto-generate if not already generated
    const generate = async () => {
      setIsGenerating(true);
      try {
        const res = await fetch('/api/demo/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId: selectedDemoLead.id }),
        });
        const data = await res.json();
        if (data.success) {
          setGeneratedDemo(data);
        } else {
          setGeneratedDemo(null);
        }
      } catch {
        setGeneratedDemo(null);
      } finally {
        setIsGenerating(false);
      }
    };

    generate();
  }, [selectedDemoLead?.id]);

  const demoProspects = useMemo(() => {
    return leads.filter((l) => !l.websiteUrl || l.websiteStatus === 'Needs Improvement' || l.websiteStatus === 'No Website' || l.websiteStatus === 'Needs Website Improvement');
  }, [leads]);

  const copyDemoLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!generatedDemo?.previewUrl) return;
    const fullUrl = `${window.location.origin}${generatedDemo.previewUrl}`;
    navigator.clipboard.writeText(fullUrl);
    onShowToast('Hosted Preview Link Copied', fullUrl, 'success');
  };

  return (
    <div className="space-y-5 animate-fade-in font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-slate-900 tracking-tight">AI Website Demo Engine</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              Hosted Previews Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Generates high-converting, mobile-first website redesign concepts strictly grounded in each lead's audit findings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-slate-300 rounded-lg bg-white p-0.5 text-xs">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                deviceMode === 'desktop' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                deviceMode === 'mobile' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Mobile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Discovered Prospects Needing Website */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Prospects Needing Redesign</h3>
            <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-[11px] font-semibold border border-blue-200">
              {demoProspects.length} leads
            </span>
          </div>

          {demoProspects.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No businesses currently selected. Run a search to populate verified businesses that need modern websites.
            </div>
          ) : (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              {demoProspects.map((lead) => {
                const isSelected = selectedDemoLead?.id === lead.id;
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedDemoLead(lead)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/50 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 leading-snug">
                        {lead.businessName}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                        {lead.websiteStatus}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-500 mt-1">
                      <span>{lead.industry}</span> • <span>{lead.location.city}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-blue-700 font-semibold">Opportunity: {lead.leadScore}/100</span>
                      <span className="text-slate-400">Click to preview concept</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Live Interactive Concept Sandbox */}
        <div className="lg:col-span-2">
          {!selectedDemoLead ? (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-16 text-center text-slate-500 text-xs">
              Select a business on the left to preview an interactive concept.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              {/* Browser chrome header */}
              <div className="bg-slate-900 px-4 py-2.5 flex items-center justify-between text-white text-xs">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] ml-2">LeadPilot Demo Engine</span>
                </div>
                <div className="bg-slate-800 px-3 py-0.5 rounded text-[11px] text-slate-300 font-mono truncate max-w-xs">
                  {generatedDemo?.previewUrl || `/demo/preview/${selectedDemoLead.id}`}
                </div>
                <div className="flex items-center gap-2">
                  {generatedDemo?.previewUrl && (
                    <>
                      <button
                        onClick={copyDemoLink}
                        className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                        title="Copy hosted URL"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy Link</span>
                      </button>
                      <a
                        href={generatedDemo.previewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                        title="Open hosted preview in full tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Full Tab</span>
                      </a>
                    </>
                  )}
                </div>
              </div>

              {/* Rendered View */}
              <div className="bg-slate-950 p-4 flex justify-center items-center min-h-[500px]">
                {isGenerating ? (
                  <div className="text-center text-slate-400 space-y-2">
                    <Loader2 className="w-6 h-6 animate-spin text-blue-500 mx-auto" />
                    <div className="text-xs font-semibold">Generating tailored redesign from audit findings...</div>
                  </div>
                ) : generatedDemo?.htmlContent ? (
                  <div
                    className={`w-full bg-white rounded-lg overflow-hidden shadow-2xl transition-all duration-300 ${
                      deviceMode === 'mobile' ? 'max-w-sm h-[560px]' : 'max-w-full h-[560px]'
                    }`}
                  >
                    <iframe
                      srcDoc={generatedDemo.htmlContent}
                      title={`Preview for ${selectedDemoLead.businessName}`}
                      className="w-full h-full border-0"
                      sandbox="allow-scripts allow-same-origin allow-popups"
                    />
                  </div>
                ) : (
                  <div className="text-center text-slate-400 text-xs">
                    Failed to render concept. Click below to retry.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
