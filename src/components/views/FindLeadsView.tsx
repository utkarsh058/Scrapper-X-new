'use client';

import React, { useState } from 'react';
import { 
  Search, 
  MapPin, 
  Filter, 
  Target, 
  Zap, 
  Database, 
  Layers, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  Building,
  RotateCcw
} from 'lucide-react';
import { Lead } from '@/types';

interface FindLeadsViewProps {
  onSelectLead: (lead: Lead) => void;
  onOpenQuickAudit: (lead: Lead) => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
  onNavigate?: (tab: 'leads' | 'overview') => void;
}

export const FindLeadsView: React.FC<FindLeadsViewProps> = ({
  onSelectLead,
  onOpenQuickAudit,
  onShowToast,
  onNavigate,
}) => {
  const [industry, setIndustry] = useState('Dental & Healthcare');
  const [location, setLocation] = useState('Austin, TX');
  const [radius, setRadius] = useState('25 miles');
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredBatches, setDiscoveredBatches] = useState([
    {
      id: 'batch-1',
      title: 'Austin Dental & Cosmetic Clinics',
      location: 'Austin, TX • 25mi radius',
      leadsFound: 42,
      noWebsite: 11,
      needsImprovement: 24,
      date: 'Today, 10:15 AM',
      status: 'Completed',
    },
    {
      id: 'batch-2',
      title: 'Denver Roofing & Storm Contractors',
      location: 'Denver, CO • 50mi radius',
      leadsFound: 68,
      noWebsite: 19,
      needsImprovement: 33,
      date: 'Yesterday, 3:30 PM',
      status: 'Completed',
    },
    {
      id: 'batch-3',
      title: 'Phoenix Commercial HVAC Repair',
      location: 'Phoenix, AZ • 15mi radius',
      leadsFound: 31,
      noWebsite: 8,
      needsImprovement: 16,
      date: 'Sep 26, 2026',
      status: 'Completed',
    }
  ]);

  const runNewScan = (e: React.FormEvent) => {
    e.preventDefault();
    setIsScanning(true);

    setTimeout(() => {
      setIsScanning(false);
      const newBatch = {
        id: `batch-${Date.now()}`,
        title: `${location} ${industry}`,
        location: `${location} • ${radius}`,
        leadsFound: 38,
        noWebsite: 9,
        needsImprovement: 21,
        date: 'Just now',
        status: 'Completed',
      };
      setDiscoveredBatches([newBatch, ...discoveredBatches]);
      onShowToast('Lead Discovery Finished', `Discovered 38 qualified leads for ${industry} in ${location}.`, 'success');
    }, 1100);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header Description */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">Automated Lead Discovery Engine</h1>
          <p className="text-[12px] text-[#6B7280]">
            Scan local regions for businesses with missing websites or websites needing improvement, and extract verified owner contact info.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-teal-50 px-2.5 py-1 text-[11.5px] font-medium text-teal-800 border border-teal-200">
            Monthly Quota: 482 / 500 Credits
          </span>
        </div>
      </div>

      {/* Discovery Configuration Form */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle p-5">
        <h2 className="text-[13.5px] font-semibold text-[#171717] mb-3 flex items-center gap-2">
          <Target className="h-4 w-4 text-teal-700" />
          <span>Configure Discovery Parameters</span>
        </h2>

        <form onSubmit={runNewScan} className="space-y-4 text-[12.5px]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                Industry or Niche
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] px-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
              >
                <option value="Dental & Healthcare">Dental & Healthcare</option>
                <option value="Roofing & Solar Contractors">Roofing & Solar Contractors</option>
                <option value="Commercial HVAC & Plumbing">Commercial HVAC & Plumbing</option>
                <option value="Auto Repair & Fleet Collision">Auto Repair & Fleet Collision</option>
                <option value="Family Law & Wealth Advisory">Family Law & Wealth Advisory</option>
                <option value="Custom Fabrication & Welding">Custom Fabrication & Welding</option>
              </select>
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                Target Metro / City
              </label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Austin, TX"
                  className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] pl-8 pr-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                Search Radius
              </label>
              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] px-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
              >
                <option value="10 miles">10 miles</option>
                <option value="25 miles">25 miles</option>
                <option value="50 miles">50 miles</option>
                <option value="100 miles">100 miles</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#F1F3F5]">
            <div className="flex items-center gap-4 text-[12px] text-[#4B5563]">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-700" />
                <span>Enrich Owner Phone & Email</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" defaultChecked className="rounded border-gray-300 text-teal-700" />
                <span>Automated Website Speed Check</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isScanning}
              className="flex items-center gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white px-4 py-2 text-[12.5px] font-medium transition-all shadow-subtle disabled:opacity-50"
            >
              {isScanning ? (
                <>
                  <Zap className="h-3.5 w-3.5 animate-spin" />
                  <span>Scanning Local Registries & Maps...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span>Launch Lead Discovery Run</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Discovered Batches History */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle overflow-hidden">
        <div className="p-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-[#171717]">Discovery Batch History</h3>
          <span className="text-[11.5px] text-[#6B7280]">Real-time pipeline sync</span>
        </div>

        <div className="divide-y divide-[#F1F3F5]">
          {discoveredBatches.map((batch) => (
            <div
              key={batch.id}
              className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-[#F9FAFB] transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[#171717] text-[13px]">{batch.title}</span>
                  <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10.5px] font-medium text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    {batch.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 text-[11.5px] text-[#6B7280]">
                  <span>{batch.location}</span>
                  <span>•</span>
                  <span>{batch.date}</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-[12px]">
                <div className="text-right">
                  <span className="font-bold text-[#171717] tabular-nums">{batch.leadsFound} Leads</span>
                  <div className="text-[11px] text-[#6B7280]">
                    <span className="text-rose-700 font-medium">{batch.noWebsite} No Site</span> •{' '}
                    <span className="text-amber-700 font-medium">{batch.needsImprovement} Needs Improvement</span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onShowToast('Viewing Batch', `Filtered table to ${batch.title}.`, 'info');
                    if (onNavigate) onNavigate('leads');
                  }}
                  className="flex items-center gap-1 rounded border border-[#D1D5DB] bg-white px-3 py-1.5 text-[11.5px] font-medium text-[#374151] hover:bg-[#F3F4F6] shadow-subtle"
                >
                  <span>View in Leads</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
