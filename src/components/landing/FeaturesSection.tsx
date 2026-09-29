'use client';

import React from 'react';
import {
  Search,
  Gauge,
  Filter,
  Sparkles,
  LayoutTemplate,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';

const FEATURES = [
  {
    icon: Search,
    title: 'Lead Discovery',
    description:
      'Discover high-potential local businesses by industry, location, and niche across maps and registries.',
    visual: {
      type: 'tag',
      label: 'Multi-Channel Scraper',
      content: 'Sector 18 Noida • Ratings > 4.5★',
    },
  },
  {
    icon: Gauge,
    title: 'Website Intelligence',
    description:
      'Run automatic audits for missing websites, broken mobile layouts, slow speeds, and expired SSL certificates.',
    visual: {
      type: 'metric',
      label: 'Automated Audit',
      content: 'Non-Responsive Mobile Viewport (6.8s load)',
    },
  },
  {
    icon: Filter,
    title: 'Lead Qualification',
    description:
      'Filter out dead leads and prioritize active businesses with verified phone, email, and acute website friction.',
    visual: {
      type: 'score',
      label: 'Opportunity Score',
      content: '94 / 100 • High Commercial Intent',
    },
  },
  {
    icon: Sparkles,
    title: 'AI Outreach',
    description:
      'Generate context-aware emails referencing specific conversion leaks rather than sending generic copy.',
    visual: {
      type: 'copy',
      label: 'Contextual Hook',
      content: '"Noticed your high foot traffic vs. 0 mobile booking..."',
    },
  },
  {
    icon: LayoutTemplate,
    title: 'Website Demo Generation',
    description:
      'Produce live interactive website concepts so clients can see, click, and experience their redesign upfront.',
    visual: {
      type: 'demo',
      label: 'Prototype Engine',
      content: 'osteriabella.leadpilot.demo (Live preview)',
    },
  },
];

export function FeaturesSection() {
  return (
    <section className="py-20 sm:py-28 bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold tracking-wider uppercase text-slate-700 mb-3">
            Core Platform Capabilities
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-950 leading-tight">
            Built for modern client acquisition.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Every feature is focused on turning raw local business data into paying web design clients.
          </p>
        </div>

        {/* 5 Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <div
                key={idx}
                className="group flex flex-col justify-between p-6 sm:p-7 rounded-2xl border border-slate-200/80 bg-[#FAFAFC]/60 hover:bg-white hover:border-slate-300 hover:shadow-[0_8px_24px_rgba(0,0,0,0.04)] transition-all duration-200"
              >
                <div>
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-xl bg-slate-900 text-teal-400 flex items-center justify-center mb-5 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">
                    {feat.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed font-normal mb-5">
                    {feat.description}
                  </p>
                </div>

                {/* Small Interactive Visual Component */}
                <div className="p-3 rounded-xl bg-white border border-slate-200/70 text-xs">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                    {feat.visual.label}
                  </div>
                  <div className="text-[11.5px] font-semibold text-slate-800 truncate">
                    {feat.visual.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </section>
  );
}
