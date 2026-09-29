'use client';

import React, { useState } from 'react';
import {
  Search,
  Gauge,
  CheckCircle2,
  Sparkles,
  LayoutTemplate,
  Compass,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

const WORKFLOW_STEPS = [
  {
    id: 1,
    title: 'Business Discovery',
    shortTitle: 'Discovery',
    label: 'STEP 01',
    icon: Search,
    color: 'teal',
    badge: 'Multi-source scraping',
    summary: 'Find high-intent local businesses by location and niche',
    preview: {
      action: 'Search Query: "Restaurants in Austin, TX"',
      result: '24 local establishments discovered with ratings > 4.5★',
      metric: 'Data Sources: Maps, Local Registries, Web Crawl',
      status: 'Ready for website diagnostics',
      statusColor: 'text-teal-700 bg-teal-50 border-teal-200/60',
    },
  },
  {
    id: 2,
    title: 'Website Analysis',
    shortTitle: 'Analysis',
    label: 'STEP 02',
    icon: Gauge,
    color: 'sky',
    badge: 'Automated audit',
    summary: 'Detect missing websites, broken viewports, and slow speeds',
    preview: {
      action: 'Target: "Osteria Bella Bistro"',
      result: 'Critical friction detected: Non-responsive mobile template',
      metric: 'Lighthouse Score: 32/100 • 6.8s load time • 0 Online Booking',
      status: 'High urgency redesign trigger',
      statusColor: 'text-amber-800 bg-amber-50 border-amber-200/60',
    },
  },
  {
    id: 3,
    title: 'Lead Qualification',
    shortTitle: 'Qualification',
    label: 'STEP 03',
    icon: CheckCircle2,
    color: 'emerald',
    badge: 'Opportunity scoring',
    summary: 'Filter out low-value leads and isolate high-ticket clients',
    preview: {
      action: 'Scoring Algorithm: Intent vs. Digital Gap',
      result: 'Opportunity Score: 94 / 100 (Tier 1 Prospect)',
      metric: 'Verified Owner Contact • 180+ Yelp Reviews • Active Foot Traffic',
      status: 'Qualified for personalized pitch',
      statusColor: 'text-emerald-800 bg-emerald-50 border-emerald-200/60',
    },
  },
  {
    id: 4,
    title: 'AI Outreach',
    shortTitle: 'Outreach',
    label: 'STEP 04',
    icon: Sparkles,
    color: 'purple',
    badge: 'Contextual copywriting',
    summary: 'Generate personalized messages citing exact conversion flaws',
    preview: {
      action: 'Generated Email Pitch with Dynamic Token Insertion',
      result: '"Hi team, noticed your mobile site takes 6+ seconds to load..."',
      metric: 'Hook: High Yelp volume vs. 0 digital table reservations',
      status: 'Ready to send with 1-click preview link',
      statusColor: 'text-purple-800 bg-purple-50 border-purple-200/60',
    },
  },
  {
    id: 5,
    title: 'Website Demo',
    shortTitle: 'Demo',
    label: 'STEP 05',
    icon: LayoutTemplate,
    color: 'teal',
    badge: 'Client-ready prototype',
    summary: 'Produce live interactive prototypes prospects can test',
    preview: {
      action: 'Automated Website Concept Generation',
      result: 'Prototype URL: osteriabella.leadpilot.demo',
      metric: 'Features: Mobile reservation engine, seasonal menu, hero gallery',
      status: 'Live shareable client concept',
      statusColor: 'text-teal-800 bg-teal-50 border-teal-200/60',
    },
  },
];

export function HeroVisual() {
  const [activeStep, setActiveStep] = useState(2); // Default to Step 2 (Website Analysis)

  const current = WORKFLOW_STEPS[activeStep - 1];
  const Icon = current.icon;

  return (
    <div className="w-full max-w-4xl mx-auto mt-8 sm:mt-12 mb-8 sm:mb-14 select-none px-2 sm:px-4">
      {/* Container card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.06)] overflow-hidden">
        
        {/* Top Workflow Steps Navigation Bar */}
        <div className="p-2 sm:p-2.5 bg-slate-50/80 border-b border-slate-200/80">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 sm:gap-2">
            {WORKFLOW_STEPS.map((step) => {
              const StepIcon = step.icon;
              const isActive = activeStep === step.id;
              return (
                <button
                  key={step.id}
                  onClick={() => setActiveStep(step.id)}
                  onMouseEnter={() => setActiveStep(step.id)}
                  className={`flex items-center gap-2 p-2 sm:p-2.5 rounded-xl text-left transition-all duration-200 ${
                    isActive
                      ? 'bg-white shadow-xs border border-slate-200 text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-white/60 border border-transparent'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-xs ${
                      isActive
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-200/70 text-slate-600'
                    }`}
                  >
                    <StepIcon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9.5px] uppercase tracking-wider font-bold text-slate-400">
                      {step.label}
                    </div>
                    <div className="text-[11.5px] sm:text-[12px] truncate">
                      <span className="hidden sm:inline">{step.title}</span>
                      <span className="sm:hidden">{step.shortTitle}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Interactive Live Demonstration Panel */}
        <div className="p-6 sm:p-8 bg-gradient-to-b from-white to-[#FAFAFC]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-mono font-bold text-teal-700 uppercase tracking-wider">
                  {current.label} • {current.badge}
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-950">
                {current.title}
              </h3>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-0.5">
                {current.summary}
              </p>
            </div>

            <span
              className={`self-start md:self-auto text-xs font-semibold px-3 py-1 rounded-full border ${current.preview.statusColor}`}
            >
              {current.preview.status}
            </span>
          </div>

          {/* Realistic SaaS Step Preview Box */}
          <div className="mt-6 p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200/70 space-y-3 font-sans">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px] uppercase tracking-wider">
                Simulation Feed
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Live Engine
              </span>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500">
                {current.preview.action}
              </div>
              <div className="text-sm font-semibold text-slate-900">
                {current.preview.result}
              </div>
              <div className="text-xs text-slate-400">
                {current.preview.metric}
              </div>
            </div>
          </div>

          {/* Step progression indicators */}
          <div className="mt-6 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <span>Interactive Step:</span>
              <span className="font-semibold text-slate-700">
                {activeStep} of 5
              </span>
            </div>
            <div className="text-slate-400 text-[11px]">
              Click any step above to inspect the workflow
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
