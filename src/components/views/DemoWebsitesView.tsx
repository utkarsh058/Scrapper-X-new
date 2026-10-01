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
  AlertCircle
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

  const demoProspects = useMemo(() => {
    return leads.filter((l) => !l.websiteUrl || l.websiteStatus === 'Needs Improvement' || l.websiteStatus === 'No Website');
  }, [leads]);

  const copyDemoLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://leadpilot.app/preview/${id}`);
    onShowToast('Concept Link Copied', `Client concept link copied for cold outreach.`, 'success');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">Client Demo Website Prototypes</h1>
          <p className="text-[12px] text-[#6B7280]">
            Interactive personalized landing page prototypes built to showcase during cold outreach for leads needing modernization.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-[#D1D5DB] rounded-md bg-white p-0.5 text-[11.5px]">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                deviceMode === 'desktop' ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-[#6B7280]'
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors cursor-pointer ${
                deviceMode === 'mobile' ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-[#6B7280]'
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
        <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-[#F1F3F5] pb-2">
            <h3 className="text-[13.5px] font-bold text-[#171717]">Prototype Prospects</h3>
            <span className="rounded-full bg-teal-50 text-teal-800 px-2 py-0.5 text-[11px] font-semibold border border-teal-200">
              {demoProspects.length} high-need leads
            </span>
          </div>

          {demoProspects.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-[12px]">
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
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/50 shadow-xs'
                        : 'border-[#E5E7EB] hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-[13px] text-[#171717] leading-snug">
                        {lead.businessName}
                      </span>
                      <span className="text-[10px] uppercase font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200 shrink-0">
                        {lead.websiteStatus}
                      </span>
                    </div>

                    <div className="text-[11.5px] text-[#6B7280] mt-1">
                      <span>{lead.industry}</span> • <span>{lead.location.city}</span>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[11px]">
                      <span className="text-teal-800 font-medium">Opportunity Score: {lead.leadScore}/100</span>
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
            <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle p-16 text-center text-slate-500 text-[13px]">
              Select a business on the left to preview an interactive concept.
            </div>
          ) : (
            <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle overflow-hidden">
              {/* Browser chrome header */}
              <div className="bg-slate-900 px-4 py-2 flex items-center justify-between text-white text-[12px]">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  </div>
                  <span className="text-slate-400 font-mono text-[11px] ml-2">LeadPilot Prototype Engine</span>
                </div>
                <div className="bg-slate-800 px-3 py-0.5 rounded text-[11px] text-slate-300 font-mono">
                  preview/{selectedDemoLead.id}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => copyDemoLink(selectedDemoLead.id, e)}
                    className="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>

              {/* Real Data Rendered Prototype */}
              <div
                className={`p-8 bg-[#F8FAFC] flex justify-center min-h-[460px] ${
                  deviceMode === 'mobile'
                    ? 'max-w-xs mx-auto border-x border-[#E2E8F0] shadow-lg my-4 rounded-xl'
                    : ''
                }`}
              >
                <div className="w-full space-y-6 text-center">
                  {/* Navbar mockup */}
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="font-bold text-slate-900 text-[13px] tracking-tight">
                      {selectedDemoLead.businessName}
                    </span>
                    <div className="flex items-center gap-3 text-[11.5px] text-slate-600">
                      <span className="hover:text-teal-700 cursor-pointer">Services</span>
                      <span className="hover:text-teal-700 cursor-pointer">About</span>
                      <button className="rounded bg-teal-700 px-2.5 py-1 text-[11px] text-white font-medium">
                        Book Online
                      </button>
                    </div>
                  </div>

                  {/* Hero section with real business attributes */}
                  <div className="py-6 space-y-3">
                    <span className="inline-block rounded-full bg-teal-50 border border-teal-200 px-3 py-0.5 text-[10.5px] font-semibold text-teal-800">
                      Top Rated {selectedDemoLead.category} in {selectedDemoLead.location.city}
                    </span>
                    <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                      Professional {selectedDemoLead.category} Services Built For You
                    </h2>
                    <p className="text-[12.5px] text-slate-600 max-w-md mx-auto leading-relaxed">
                      Instant online booking, mobile-first appointment confirmation, and direct inquiries.
                    </p>

                    <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5">
                      <button className="rounded-md bg-teal-700 hover:bg-teal-800 px-4 py-2 text-[12px] font-semibold text-white shadow-sm">
                        Select Appointment Time
                      </button>
                      {selectedDemoLead.phone && (
                        <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                          Call {selectedDemoLead.phone}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Trust badges */}
                  <div className="p-4 rounded-lg bg-white border border-slate-200 grid grid-cols-3 gap-3 text-left">
                    <div>
                      <span className="text-[10.5px] text-slate-500 block">Location</span>
                      <span className="text-[12px] font-bold text-slate-900">
                        {selectedDemoLead.location.city}, {selectedDemoLead.location.state || 'India'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10.5px] text-slate-500 block">Mobile Optimized</span>
                      <span className="text-[12px] font-bold text-teal-800">100% Responsive</span>
                    </div>
                    <div>
                      <span className="text-[10.5px] text-slate-500 block">Direct Booking</span>
                      <span className="text-[12px] font-bold text-slate-900">Enabled</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
