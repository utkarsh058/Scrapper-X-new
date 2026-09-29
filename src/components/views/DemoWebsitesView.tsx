'use client';

import React, { useState } from 'react';
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
  Plus
} from 'lucide-react';
import { mockLeads } from '@/data/mockData';
import { Lead } from '@/types';

interface DemoWebsitesViewProps {
  onSelectLead: (lead: Lead) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const DemoWebsitesView: React.FC<DemoWebsitesViewProps> = ({
  onSelectLead,
  onShowToast,
}) => {
  const [deviceMode, setDeviceMode] = useState<'desktop' | 'mobile'>('desktop');
  const [selectedDemoLead, setSelectedDemoLead] = useState<Lead>(mockLeads[0]);

  const demoLeads = mockLeads.filter(l => l.demoGenerated);

  const copyDemoLink = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`https://preview.leadpilot.agency/${id}`);
    onShowToast('Demo Link Copied', `Shareable client link ready for cold email.`, 'success');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">Client Demo Website Prototypes</h1>
          <p className="text-[12px] text-[#6B7280]">
            Interactive personalized landing page prototypes built to showcase during cold outreach.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center border border-[#D1D5DB] rounded-md bg-white p-0.5 text-[11.5px]">
            <button
              onClick={() => setDeviceMode('desktop')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                deviceMode === 'desktop' ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-[#6B7280]'
              }`}
            >
              <Laptop className="h-3.5 w-3.5" />
              <span>Desktop</span>
            </button>
            <button
              onClick={() => setDeviceMode('mobile')}
              className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                deviceMode === 'mobile' ? 'bg-teal-50 text-teal-800 font-semibold' : 'text-[#6B7280]'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Mobile</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Showcase Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Generated Demos List */}
        <div className="space-y-2.5">
          <span className="text-[11.5px] font-semibold text-[#6B7280] uppercase tracking-wider block px-1">
            Generated Prototypes ({demoLeads.length})
          </span>

          {demoLeads.map((lead) => {
            const isSelected = selectedDemoLead.id === lead.id;

            return (
              <div
                key={lead.id}
                onClick={() => setSelectedDemoLead(lead)}
                className={`p-3.5 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? 'border-teal-700 bg-teal-50/50 ring-1 ring-teal-700 shadow-sm'
                    : 'border-[#E5E7EB] bg-white hover:bg-[#F9FAFB]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-semibold text-[#171717] text-[13px]">{lead.businessName}</h4>
                    <span className="text-[11.5px] text-[#6B7280]">{lead.category} • {lead.location.city}</span>
                  </div>
                  <span className="rounded bg-teal-50 px-1.5 py-0.5 text-[9.5px] font-bold text-teal-800 border border-teal-200 shrink-0">
                    READY
                  </span>
                </div>

                <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#F1F3F5] text-[11px]">
                  <span className="text-[#6B7280] font-mono truncate max-w-[150px]">
                    /{lead.id}
                  </span>
                  <button
                    onClick={(e) => copyDemoLink(lead.id, e)}
                    className="text-teal-700 hover:text-teal-900 font-medium flex items-center gap-1"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy Link</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: Live Interactive Sandbox Preview */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-card overflow-hidden">
            {/* Browser top chrome */}
            <div className="px-4 py-2.5 bg-[#0F172A] border-b border-slate-700 flex items-center justify-between text-white text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </div>
              <div className="bg-slate-800 px-3 py-0.5 rounded text-[11px] text-slate-300 font-mono">
                https://preview.leadpilot.agency/{selectedDemoLead.id}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => copyDemoLink(selectedDemoLead.id, e)}
                  className="text-teal-400 hover:text-teal-300 flex items-center gap-1 text-[11px]"
                >
                  <Copy className="h-3 w-3" />
                  <span>Share</span>
                </button>
              </div>
            </div>

            {/* Simulated Live Website Render */}
            <div className={`p-8 bg-[#F8FAFC] flex justify-center min-h-[460px] ${deviceMode === 'mobile' ? 'max-w-xs mx-auto border-x border-[#E2E8F0] shadow-lg my-4 rounded-xl' : ''}`}>
              <div className="w-full space-y-6 text-center">
                {/* Navbar mockup */}
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <span className="font-bold text-slate-900 text-[13px] tracking-tight">
                    {selectedDemoLead.businessName}
                  </span>
                  <div className="flex items-center gap-3 text-[11.5px] text-slate-600">
                    <span className="hover:text-teal-700 cursor-pointer">Services</span>
                    <span className="hover:text-teal-700 cursor-pointer">Reviews</span>
                    <button className="rounded bg-teal-700 px-2.5 py-1 text-[11px] text-white font-medium">
                      Book Now
                    </button>
                  </div>
                </div>

                {/* Hero section mockup */}
                <div className="py-6 space-y-3">
                  <span className="inline-block rounded-full bg-teal-50 border border-teal-200 px-3 py-0.5 text-[10.5px] font-semibold text-teal-800">
                    Top Rated in {selectedDemoLead.location.city}, {selectedDemoLead.location.state}
                  </span>
                  <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                    Modern {selectedDemoLead.category} Services Built For You
                  </h2>
                  <p className="text-[12.5px] text-slate-600 max-w-md mx-auto leading-relaxed">
                    Schedule high-priority appointments online with zero wait time. Instant confirmation sent via SMS.
                  </p>

                  <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5">
                    <button className="rounded-md bg-teal-700 hover:bg-teal-800 px-4 py-2 text-[12px] font-semibold text-white shadow-sm">
                      Select Date & Time
                    </button>
                    <button className="rounded-md border border-slate-300 bg-white px-4 py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50">
                      Call {selectedDemoLead.contact.phone}
                    </button>
                  </div>
                </div>

                {/* Simulated trust badges */}
                <div className="p-4 rounded-lg bg-white border border-slate-200 grid grid-cols-3 gap-3 text-left">
                  <div>
                    <span className="text-[10.5px] text-slate-500 block">Google Rating</span>
                    <span className="text-[13px] font-bold text-slate-900">4.9 ★ (320+ reviews)</span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-500 block">Response Time</span>
                    <span className="text-[13px] font-bold text-teal-800">&lt; 15 mins</span>
                  </div>
                  <div>
                    <span className="text-[10.5px] text-slate-500 block">Service Area</span>
                    <span className="text-[13px] font-bold text-slate-900">{selectedDemoLead.location.city} Metro</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
