'use client';

import React from 'react';
import { ArrowRight, Monitor, LayoutTemplate } from 'lucide-react';

interface WebsiteDemoSectionProps {
  onPreviewDemo?: (category: string) => void;
}

const DEMOS = [
  {
    id: 'restaurant',
    category: 'Restaurant',
    businessName: 'Osteria Bella',
    subTitle: 'Woodfired Italian Cuisine & Wine Bar',
    url: 'osteriabella.leadpilot.demo',
    colorTheme: 'from-amber-900/10 via-orange-50/40 to-white',
    badge: 'Table Reservations & Menu',
    headline: 'Handcrafted pasta and authentic wood-fired pizzas.',
    cta: 'Reserve Online',
  },
  {
    id: 'fitness',
    category: 'Fitness Studio',
    businessName: 'Apex Pulse Lab',
    subTitle: 'High-Performance Functional Training',
    url: 'apexpulse.leadpilot.demo',
    colorTheme: 'from-teal-900/10 via-emerald-50/40 to-white',
    badge: 'Class Schedule & Pass Booking',
    headline: 'Elite athletic coaching, HIIT circuits, and recovery.',
    cta: 'Claim Free Pass',
  },
  {
    id: 'real-estate',
    category: 'Real Estate',
    businessName: 'Aura Modern Living',
    subTitle: 'Architectural Boutique Residences',
    url: 'auraliving.leadpilot.demo',
    colorTheme: 'from-slate-900/10 via-slate-100/40 to-white',
    badge: 'Virtual Tours & Inquiry Funnel',
    headline: 'Curated architectural penthouses and townhomes.',
    cta: 'Explore Listings',
  },
];

export function WebsiteDemoSection({ onPreviewDemo }: WebsiteDemoSectionProps) {
  return (
    <section id="website-demos" className="py-20 sm:py-28 bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold tracking-wider uppercase text-slate-700 mb-3">
            <LayoutTemplate className="w-3.5 h-3.5 text-teal-600" />
            Client-Ready Demos
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-950 leading-[1.12]">
            Don&apos;t just tell prospects.
            <br />
            <span className="text-teal-700">Show them.</span>
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            LeadPilot turns qualified leads into visual website concepts clients can click, test, and share before signing a contract.
          </p>
        </div>

        {/* 3 Clean Website Preview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
          {DEMOS.map((demo) => (
            <div
              key={demo.id}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-[#FAFAFC] overflow-hidden hover:border-slate-300 hover:shadow-[0_16px_36px_-8px_rgba(15,23,42,0.06)] hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Browser Bar */}
              <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                </div>
                <div className="px-2.5 py-0.5 rounded-md bg-slate-100 text-[10.5px] font-mono text-slate-500 tracking-tight flex items-center gap-1 truncate max-w-[170px]">
                  <span>🔒</span>
                  <span>{demo.url}</span>
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                  Concept
                </span>
              </div>

              {/* Mockup Preview Area */}
              <div
                className={`p-6 flex-1 bg-gradient-to-b ${demo.colorTheme} flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      {demo.category}
                    </span>
                    <span className="text-[10.5px] font-medium text-slate-600 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200/70">
                      {demo.badge}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug mb-1">
                    {demo.businessName}
                  </h3>
                  <p className="text-xs text-slate-500 mb-6">
                    {demo.subTitle}
                  </p>

                  {/* Simulated Hero Element */}
                  <div className="bg-white/90 rounded-xl p-4 border border-white/80 shadow-xs space-y-2.5 mb-4">
                    <p className="text-xs font-semibold text-slate-800 leading-snug">
                      &ldquo;{demo.headline}&rdquo;
                    </p>
                    <div className="inline-block px-2.5 py-1 rounded bg-slate-900 text-white text-[10.5px] font-medium shadow-2xs">
                      {demo.cta}
                    </div>
                  </div>
                </div>

                {/* Bottom CTA Button: "See a Demo →" as requested in Section 11 */}
                <div className="mt-6 pt-4 border-t border-slate-200/60">
                  <button
                    type="button"
                    onClick={() => onPreviewDemo?.(demo.businessName)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-800 bg-white hover:bg-slate-900 hover:text-white border border-slate-200 hover:border-slate-900 transition-all duration-200 shadow-2xs"
                  >
                    <span>See a Demo</span>
                    <ArrowRight className="w-3.5 h-3.5 text-teal-500" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
