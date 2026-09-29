'use client';

import React, { useState } from 'react';
import { 
  Send, 
  Plus, 
  Play, 
  Pause, 
  Sparkles, 
  TrendingUp, 
  Eye, 
  MessageSquare, 
  CheckCircle2, 
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { mockCampaigns } from '@/data/mockData';

interface CampaignsViewProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({ onShowToast }) => {
  const [campaigns, setCampaigns] = useState(mockCampaigns);

  const toggleCampaignStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Active' ? 'Paused' : 'Active';
    setCampaigns(
      campaigns.map((c) => (c.id === id ? { ...c, status: nextStatus } : c))
    );
    onShowToast(
      `Campaign ${nextStatus}`,
      `Campaign has been updated to ${nextStatus.toLowerCase()}.`,
      nextStatus === 'Active' ? 'success' : 'info'
    );
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">Cold Outreach & Demo Campaigns</h1>
          <p className="text-[12px] text-[#6B7280]">
            Automated multi-channel outreach delivering personalized website audit videos & interactive prototypes.
          </p>
        </div>
        <button
          onClick={() => onShowToast('New Campaign Wizard', 'Campaign workflow editor opened.', 'info')}
          className="flex items-center gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white px-3.5 py-1.5 text-[12.5px] font-medium transition-all shadow-subtle self-start sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Create Campaign</span>
        </button>
      </div>

      {/* Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <span className="text-[11.5px] text-[#6B7280] block">Total Pitches Sent</span>
          <div className="text-[22px] font-bold text-[#171717] tabular-nums mt-1">302</div>
          <span className="text-[10.5px] text-emerald-700 font-medium block mt-1">+24% this week</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <span className="text-[11.5px] text-[#6B7280] block">Avg. Open Rate</span>
          <div className="text-[22px] font-bold text-[#171717] tabular-nums mt-1">68.2%</div>
          <span className="text-[10.5px] text-teal-800 font-medium block mt-1">3.2x industry average</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <span className="text-[11.5px] text-[#6B7280] block">Demo Link Click-Through</span>
          <div className="text-[22px] font-bold text-teal-900 tabular-nums mt-1">85 Clicks</div>
          <span className="text-[10.5px] text-[#6B7280] block mt-1">28.1% interactive engagement</span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <span className="text-[11.5px] text-[#6B7280] block">Meetings & Inquiries</span>
          <div className="text-[22px] font-bold text-emerald-700 tabular-nums mt-1">37 Responses</div>
          <span className="text-[10.5px] text-emerald-700 font-medium block mt-1">12.2% positive conversion</span>
        </div>
      </div>

      {/* Campaigns Table */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle overflow-hidden">
        <div className="p-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-[#171717]">Outreach Sequences</h3>
          <span className="text-[11.5px] text-[#6B7280]">{campaigns.length} campaigns</span>
        </div>

        <div className="divide-y divide-[#F1F3F5]">
          {campaigns.map((camp) => (
            <div
              key={camp.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#F9FAFB] transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-[#171717] text-[13.5px]">{camp.name}</span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                      camp.status === 'Active'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : camp.status === 'Paused'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        camp.status === 'Active' ? 'bg-emerald-500' : 'bg-amber-500'
                      }`}
                    />
                    {camp.status}
                  </span>
                </div>
                <p className="text-[11.5px] text-[#6B7280]">{camp.target}</p>
              </div>

              <div className="flex flex-wrap items-center gap-6 text-[12px]">
                <div>
                  <span className="text-[10.5px] text-[#6B7280] block">Sent</span>
                  <span className="font-bold text-[#171717] tabular-nums">{camp.sentCount}</span>
                </div>

                <div>
                  <span className="text-[10.5px] text-[#6B7280] block">Open Rate</span>
                  <span className="font-bold text-[#171717] tabular-nums">{camp.openRate}</span>
                </div>

                <div>
                  <span className="text-[10.5px] text-[#6B7280] block">Reply Rate</span>
                  <span className="font-bold text-teal-800 tabular-nums">{camp.replyRate}</span>
                </div>

                <div>
                  <span className="text-[10.5px] text-[#6B7280] block">Demos Viewed</span>
                  <span className="font-bold text-[#171717] tabular-nums">{camp.demosViewed}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCampaignStatus(camp.id, camp.status)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded border border-[#D1D5DB] bg-white text-[11.5px] font-medium text-[#374151] hover:bg-[#F3F4F6]"
                  >
                    {camp.status === 'Active' ? (
                      <>
                        <Pause className="h-3 w-3 text-amber-600" />
                        <span>Pause</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-3 w-3 text-emerald-600" />
                        <span>Resume</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
