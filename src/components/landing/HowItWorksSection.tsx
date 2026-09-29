'use client';

import React from 'react';
import { Search, Gauge, Filter, Send, ArrowRight } from 'lucide-react';

const STEPS = [
  {
    step: '01',
    name: 'Find Businesses',
    title: 'Discover businesses based on industry and location.',
    detail:
      'Search across local maps, directories, and registries to find brick-and-mortar operations in your target cities.',
    icon: Search,
  },
  {
    step: '02',
    name: 'Analyze Websites',
    title: 'Identify businesses with no website or website problems.',
    detail:
      'Detect non-responsive mobile layouts, slow load times, outdated codebases, and missing direct booking channels.',
    icon: Gauge,
  },
  {
    step: '03',
    name: 'Qualify Leads',
    title: 'Filter businesses based on contact information and opportunity.',
    detail:
      'Prioritize businesses with verified owner phone, email, active customer reviews, and high commercial redesign intent.',
    icon: Filter,
  },
  {
    step: '04',
    name: 'Reach & Convert',
    title: 'Generate personalized outreach and website demos.',
    detail:
      'Create context-aware email pitches and share automated interactive prototypes that showcase their future website.',
    icon: Send,
  },
];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28 bg-[#FAFAFC] border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold tracking-wider uppercase text-slate-700 mb-3">
            Workflow Overview
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-950 leading-tight">
            How LeadPilot Works
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal">
            A predictable four-step workflow from raw discovery to signed web design clients.
          </p>
        </div>

        {/* 4-Step Horizontal Flow with Connecting Line */}
        <div className="relative">
          {/* Subtle horizontal connecting line (visible on desktop) */}
          <div className="hidden lg:block absolute top-[28px] left-[6%] right-[6%] h-[1px] bg-slate-200 -z-0" />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
            {STEPS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="group relative flex flex-col justify-between p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200"
                >
                  <div>
                    {/* Step Marker */}
                    <div className="flex items-center justify-between mb-5">
                      <div className="w-11 h-11 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-sm shadow-xs group-hover:bg-teal-600 transition-colors">
                        <Icon className="w-4 h-4 text-teal-300 group-hover:text-white transition-colors" />
                      </div>
                      <span className="text-xs font-mono font-bold tracking-wider text-slate-400 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200/60">
                        {item.step}
                      </span>
                    </div>

                    {/* Step Title */}
                    <h3 className="text-base font-bold text-slate-900 tracking-tight leading-snug mb-2 group-hover:text-slate-950">
                      {item.name}
                    </h3>

                    {/* Step Subtitle */}
                    <h4 className="text-xs font-semibold text-teal-700 leading-snug mb-3">
                      {item.title}
                    </h4>

                    {/* Step Detail */}
                    <p className="text-[12.5px] text-slate-500 leading-relaxed font-normal group-hover:text-slate-700 transition-colors">
                      {item.detail}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
