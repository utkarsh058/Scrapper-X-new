'use client';

import React from 'react';

const PROBLEMS = [
  {
    number: '01',
    label: 'NO WEBSITE',
    title: 'Businesses with zero web presence',
    description:
      'Locate established businesses with strong offline foot traffic, active local customer reviews, but no functional digital storefront.',
    tag: 'Highest conversion potential',
  },
  {
    number: '02',
    label: 'WEAK WEBSITE',
    title: 'Slow, broken or non-mobile websites',
    description:
      'Spot outdated templates built years ago that take 6+ seconds to load, fail on mobile phones, or trigger browser security warnings.',
    tag: 'Urgent redesign trigger',
  },
  {
    number: '03',
    label: 'MISSED OPPORTUNITY',
    title: 'Missing direct conversion funnels',
    description:
      'Find active companies losing customers to competitors because their current website lacks online booking, forms, or clear calls to action.',
    tag: 'High-value pitch',
  },
];

export function ProblemSection() {
  return (
    <section id="solutions" className="py-20 sm:py-28 bg-white border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mb-14 sm:mb-18">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold tracking-wider uppercase text-slate-700 mb-3">
            Market Opportunity
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-950 leading-[1.12]">
            Your next client may already be online.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Thousands of businesses have no website, an outdated website, or a digital presence that isn&apos;t helping them convert customers.
          </p>
        </div>

        {/* 3 Minimal Problem Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {PROBLEMS.map((item, idx) => (
            <div
              key={idx}
              className="flex flex-col justify-between p-7 sm:p-8 rounded-2xl border border-slate-200/80 bg-[#FAFAFC] hover:bg-white hover:border-slate-300 hover:shadow-[0_12px_28px_rgba(0,0,0,0.04)] transition-all duration-200"
            >
              <div>
                {/* Number & Category */}
                <div className="flex items-center justify-between mb-5">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-300">
                    {item.number}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600">
                    {item.tag}
                  </span>
                </div>

                <div className="text-xs font-bold uppercase tracking-widest text-teal-700 mb-2">
                  {item.label}
                </div>

                <h3 className="text-lg font-bold text-slate-900 tracking-tight leading-snug mb-2.5">
                  {item.title}
                </h3>

                <p className="text-[13px] text-slate-600 leading-relaxed font-normal">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
