'use client';

import React, { useState } from 'react';
import { 
  X, 
  Search, 
  MapPin, 
  Filter, 
  Sparkles, 
  Check, 
  Layers, 
  Sliders, 
  Zap, 
  Database,
  Building,
  Target
} from 'lucide-react';

interface FindLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const FindLeadsModal: React.FC<FindLeadsModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [industry, setIndustry] = useState('Dental & Orthodontics');
  const [location, setLocation] = useState('Austin, TX');
  const [radius, setRadius] = useState('25 miles');
  const [noWebsiteOnly, setNoWebsiteOnly] = useState(false);
  const [poorWebsiteOnly, setPoorWebsiteOnly] = useState(true);
  const [verifiedContactOnly, setVerifiedContactOnly] = useState(true);
  const [isDiscovering, setIsDiscovering] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleStartDiscovery = (e: React.FormEvent) => {
    e.preventDefault();
    setIsDiscovering(true);

    setTimeout(() => {
      setIsDiscovering(false);
      onClose();
      onShowToast(
        'Discovery Batch Queued',
        `Searching ${industry} in ${location} (${radius}). Est. 35-60 leads will be enriched.`,
        'success'
      );
    }, 900);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] select-none animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg rounded-xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EAECEF] bg-[#FAFAFB]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
              <Target className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-bold text-[#171717]">Discover New Business Leads</h3>
              <p className="text-[11px] text-[#6B7280]">Target local businesses with high conversion opportunities</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded text-[#9CA3AF] hover:text-[#171717] hover:bg-[#F3F4F6] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Discovery form */}
        <form onSubmit={handleStartDiscovery} className="p-5 space-y-4 text-[12.5px]">
          {/* Industry Selection */}
          <div>
            <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
              Target Industry / Niche
            </label>
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] px-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
            >
              <option value="Dental & Orthodontics">Dental & Orthodontics</option>
              <option value="Roofing & Solar Contractors">Roofing & Solar Contractors</option>
              <option value="HVAC & Plumbing Services">HVAC & Plumbing Services</option>
              <option value="Commercial Auto & Fleet Repair">Commercial Auto & Fleet Repair</option>
              <option value="Family Law & Legal Practices">Family Law & Legal Practices</option>
              <option value="Wealth Management & Accounting">Wealth Management & Accounting</option>
              <option value="Architecture & Interior Design">Architecture & Interior Design</option>
            </select>
          </div>

          {/* Location & Radius */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                Target Metro / City
              </label>
              <div className="relative">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9CA3AF]" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Denver, CO"
                  className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] pl-8 pr-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                Radius
              </label>
              <select
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] px-2 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
              >
                <option value="10 miles">10 miles</option>
                <option value="25 miles">25 miles</option>
                <option value="50 miles">50 miles</option>
                <option value="Statewide">Statewide</option>
              </select>
            </div>
          </div>

          {/* Qualification Filters */}
          <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] p-3 space-y-2.5">
            <span className="text-[11.5px] font-semibold text-[#374151] block">
              Lead Qualification Filters
            </span>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={poorWebsiteOnly}
                onChange={(e) => setPoorWebsiteOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-teal-700 focus:ring-teal-600"
              />
              <span className="text-[12px] text-[#374151]">
                Target businesses with <strong className="text-amber-800">Poor / Slow Websites</strong> (Speed &lt; 50)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={noWebsiteOnly}
                onChange={(e) => setNoWebsiteOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-teal-700 focus:ring-teal-600"
              />
              <span className="text-[12px] text-[#374151]">
                Include businesses with <strong className="text-rose-800">No Website Detected</strong>
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={verifiedContactOnly}
                onChange={(e) => setVerifiedContactOnly(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-teal-700 focus:ring-teal-600"
              />
              <span className="text-[12px] text-[#374151]">
                Require verified direct owner email or phone number
              </span>
            </label>
          </div>

          {/* Estimated Pipeline yield */}
          <div className="flex items-center justify-between p-2.5 rounded-md bg-teal-50/70 border border-teal-200/80 text-[11.5px] text-teal-950">
            <div className="flex items-center gap-1.5">
              <Database className="h-3.5 w-3.5 text-teal-700" />
              <span>Est. Discovery Pool: <strong>48 - 72 Qualified Leads</strong></span>
            </div>
            <span className="font-semibold text-teal-800">~2 credits</span>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[12px] font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isDiscovering}
              className="flex items-center gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white px-4 py-1.5 text-[12.5px] font-medium transition-all shadow-subtle disabled:opacity-50"
            >
              {isDiscovering ? (
                <>
                  <Zap className="h-3.5 w-3.5 animate-spin" />
                  <span>Launching Scraper...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span>Run Lead Discovery</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
