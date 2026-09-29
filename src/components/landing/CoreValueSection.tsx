'use client';

import React, { useState } from 'react';
import {
  Building2,
  Globe2,
  Target,
  Sparkles,
  TrendingUp,
  ArrowRight,
  CheckCircle,
  FileText,
} from 'lucide-react';

const PIPELINE_STAGES = [
  {
    id: 'business',
    step: '01',
    label: 'BUSINESS',
    title: 'Discovered Business',
    icon: Building2,
    badge: 'Raw Lead',
    summary: 'Osteria Bella',
    sub: 'Austin, TX • 4.8★ (184 reviews)',
    cardDetail: {
      type: 'Local Italian Dining & Wine Bar',
      contact: 'Phone & Social verified • 1 location',
      traffic: 'High foot-traffic area',
    },
  },
  {
    id: 'status',
    step: '02',
    label: 'WEBSITE STATUS',
    title: 'Digital Health Audit',
    icon: Globe2,
    badge: 'Diagnostic',
    summary: 'Non-Responsive / Outdated',
    sub: 'Fails mobile tests • 6.9s load time',
    cardDetail: {
      type: 'Desktop only template from 2013',
      contact: 'No online menu or table reservations',
      traffic: 'SSL Certificate expiring soon',
    },
  },
  {
    id: 'opportunity',
    step: '03',
    label: 'OPPORTUNITY',
    title: 'Opportunity Identified',
    icon: Target,
    badge: 'High Value',
    summary: 'Turnkey Website Redesign',
    sub: 'Mobile booking & modern menu system',
    cardDetail: {
      type: 'Immediate client value proposition',
      contact: 'High chance of accepting modernization demo',
      traffic: 'Competitors rank higher for "Italian Austin"',
    },
  },
  {
    id: 'score',
    step: '04',
    label: 'LEAD SCORE',
    title: 'Algorithmic Qualification',
    icon: TrendingUp,
    badge: 'Qualified',
    summary: 'Score 94 / 100',
    sub: 'Tier 1 priority prospect',
    cardDetail: {
      type: 'Solvent business + acute website friction',
      contact: 'Owner email & direct phone resolved',
      traffic: 'Ready for outreach sequence',
    },
  },
  {
    id: 'message',
    step: '05',
    label: 'AI MESSAGE',
    title: 'Contextual AI Outreach',
    icon: Sparkles,
    badge: 'Ready to Send',
    summary: 'Personalized Pitch + Demo',
    sub: 'Specific to Osteria Bella\'s friction',
    cardDetail: {
      type: 'Cites mobile friction & foot-traffic gap',
      contact: 'Includes interactive mockup demo link',
      traffic: '3.4x higher reply rate than generic copy',
    },
  },
];

export function CoreValueSection() {
  const [activeStage, setActiveStage] = useState(2); // Default to Opportunity

  return (
    <section id="product" className="py-20 sm:py-28 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-50 text-[11px] font-semibold tracking-wider uppercase text-teal-800 border border-teal-200/60 mb-3">
            Conceptual Pipeline
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-950 leading-tight">
            From business data to real opportunities.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            LeadPilot turns scattered business information into actionable prospects
            you can actually contact.
          </p>
        </div>

        {/* 5-Step Pipeline Nav Bar */}
        <div className="flex items-center justify-between overflow-x-auto pb-4 gap-2 mb-8 no-scrollbar">
          {PIPELINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const isSelected = activeStage === idx;
            return (
              <button
                key={stage.id}
                onClick={() => setActiveStage(idx)}
                className={`flex-1 min-w-[170px] p-3.5 rounded-xl border text-left transition-all duration-200 ${
                  isSelected
                    ? 'bg-slate-950 text-white border-slate-900 shadow-md scale-[1.02]'
                    : 'bg-[#FAFAFC] text-slate-700 border-slate-200/80 hover:bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      isSelected ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  >
                    STAGE {stage.step}
                  </span>
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isSelected ? 'text-teal-300' : 'text-slate-400'
                    }`}
                  />
                </div>
                <div className="text-xs font-bold tracking-tight truncate">
                  {stage.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Conceptual Product Visualizer Card */}
        <div className="bg-[#FAFAFC] border border-slate-200/90 rounded-3xl p-6 sm:p-10 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.06)]">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            {/* Left: Progression Context */}
            <div className="lg:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-teal-100/80 text-teal-800">
                Step {PIPELINE_STAGES[activeStage].step} of 05
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-slate-950 tracking-tight">
                {PIPELINE_STAGES[activeStage].title}
              </h3>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Raw data alone isn&apos;t enough. LeadPilot applies website diagnostics
                and business scoring to elevate generic contact records into qualified
                sales opportunities with immediate context.
              </p>

              <div className="pt-3 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>{PIPELINE_STAGES[activeStage].cardDetail.type}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>{PIPELINE_STAGES[activeStage].cardDetail.contact}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <CheckCircle className="w-4 h-4 text-teal-600 shrink-0" />
                  <span>{PIPELINE_STAGES[activeStage].cardDetail.traffic}</span>
                </div>
              </div>
            </div>

            {/* Right: Rich Interactive Visual Card of the Active Stage */}
            <div className="lg:col-span-7">
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
                {/* Visualizer Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center font-bold">
                      {PIPELINE_STAGES[activeStage].step}
                    </div>
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-teal-700">
                        {PIPELINE_STAGES[activeStage].label}
                      </div>
                      <div className="text-sm font-bold text-slate-900">
                        {PIPELINE_STAGES[activeStage].summary}
                      </div>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                    {PIPELINE_STAGES[activeStage].badge}
                  </span>
                </div>

                {/* Simulated Visual Pipeline Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Target Entity
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      Osteria Bella Bistro
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      4.8★ • 184 Reviews • Austin TX
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Detected Friction
                    </div>
                    <div className="text-sm font-bold text-amber-700">
                      Non-Mobile Viewport
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      6.9s load time • 0 Online Booking
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      Opportunity Score
                    </div>
                    <div className="text-sm font-bold text-teal-700">
                      94 / 100 (Tier 1)
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      High margin client • High conversion trigger
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mb-1">
                      AI Action
                    </div>
                    <div className="text-sm font-bold text-slate-900">
                      Generate Tailored Copy
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Embed interactive redesign prototype
                    </div>
                  </div>
                </div>

                {/* Progress bar across stages */}
                <div className="pt-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 font-medium mb-1.5">
                    <span>Pipeline Progress</span>
                    <span className="font-mono text-teal-700 font-bold">
                      {((activeStage + 1) / 5) * 100}% Complete
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-teal-600 transition-all duration-300 rounded-full"
                      style={{ width: `${((activeStage + 1) / 5) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
