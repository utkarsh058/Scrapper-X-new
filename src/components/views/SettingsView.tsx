'use client';

import React, { useState } from 'react';
import { 
  Settings, 
  Key, 
  Shield, 
  Sliders, 
  Bell, 
  Globe, 
  Save, 
  CheckCircle2, 
  CreditCard,
  Mail
} from 'lucide-react';

interface SettingsViewProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onShowToast }) => {
  const [activeSection, setActiveSection] = useState<'general' | 'scraper' | 'outreach' | 'api'>('general');
  const [agencyName, setAgencyName] = useState('Apex Growth Partners');
  const [senderEmail, setSenderEmail] = useState('utkarsh@leadpilot.agency');
  const [rateLimit, setRateLimit] = useState('40 requests/min');

  const saveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onShowToast('Settings Saved', 'Workspace configuration updated successfully.', 'success');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">Workspace Settings & Integrations</h1>
          <p className="text-[12px] text-[#6B7280]">
            Manage scraping throttle rates, sender domain authentication, and outreach automation parameters.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Settings Navigation */}
        <div className="space-y-1">
          {[
            { id: 'general', label: 'Agency Profile', icon: Settings },
            { id: 'scraper', label: 'Scraper Engine & Proxies', icon: Sliders },
            { id: 'outreach', label: 'Sender Domains & Email', icon: Mail },
            { id: 'api', label: 'API Keys & Webhooks', icon: Key },
          ].map((item) => {
            const Icon = item.icon;
            const isSelected = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-[12.5px] font-medium text-left transition-colors ${
                  isSelected
                    ? 'bg-teal-50 text-teal-800 font-semibold border border-teal-200/80'
                    : 'text-[#4B5563] hover:bg-[#F3F4F6]'
                }`}
              >
                <Icon className={`h-4 w-4 ${isSelected ? 'text-teal-700' : 'text-[#6B7280]'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Settings Form Body */}
        <div className="md:col-span-3 bg-white rounded-lg border border-[#E5E7EB] shadow-subtle p-5">
          <form onSubmit={saveSettings} className="space-y-4 text-[12.5px]">
            {activeSection === 'general' && (
              <div className="space-y-4">
                <h3 className="text-[14px] font-bold text-[#171717] border-b border-[#F1F3F5] pb-2">
                  Agency Profile
                </h3>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Agency / Business Name
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] px-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Primary Notification Email
                  </label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] px-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            )}

            {activeSection === 'scraper' && (
              <div className="space-y-4">
                <h3 className="text-[14px] font-bold text-[#171717] border-b border-[#F1F3F5] pb-2">
                  Scraper Throttling & Rotation
                </h3>

                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Concurrency & Rate Limit
                  </label>
                  <select
                    value={rateLimit}
                    onChange={(e) => setRateLimit(e.target.value)}
                    className="w-full rounded-md border border-[#D1D5DB] bg-[#F7F8FA] px-3 py-1.5 text-[12.5px] text-[#171717] focus:border-teal-700 focus:bg-white focus:outline-none"
                  >
                    <option value="20 requests/min">Conservative (20 req/min) - High Stealth</option>
                    <option value="40 requests/min">Standard (40 req/min) - Recommended</option>
                    <option value="80 requests/min">Turbo (80 req/min) - High Concurrency</option>
                  </select>
                </div>
              </div>
            )}

            {activeSection === 'outreach' && (
              <div className="space-y-4">
                <h3 className="text-[14px] font-bold text-[#171717] border-b border-[#F1F3F5] pb-2">
                  Sender Domain Authentication (DKIM/SPF)
                </h3>
                <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Domain <strong>leadpilot.agency</strong> is verified and ready for cold inbox delivery.</span>
                </div>
              </div>
            )}

            {activeSection === 'api' && (
              <div className="space-y-4">
                <h3 className="text-[14px] font-bold text-[#171717] border-b border-[#F1F3F5] pb-2">
                  LeadPilot Developer API
                </h3>
                <div>
                  <label className="block text-[11.5px] font-semibold text-[#374151] mb-1">
                    Live Secret Key
                  </label>
                  <div className="p-2.5 rounded-md border border-[#E5E7EB] bg-[#F7F8FA] font-mono text-[12px] text-[#374151]">
                    lp_live_948f10398bb2744c80a84d44ef
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-[#F1F3F5] flex justify-end">
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white px-4 py-1.5 text-[12.5px] font-medium transition-all shadow-subtle"
              >
                <Save className="h-3.5 w-3.5" />
                <span>Save Changes</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
