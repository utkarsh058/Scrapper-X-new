'use client';

import React from 'react';

const CATEGORIES = [
  'AGENCIES',
  'SALES TEAMS',
  'WEB STUDIOS',
  'MARKETING TEAMS',
  'FREELANCERS',
];

export function TrustSection() {
  return (
    <section className="py-10 border-y border-slate-100 bg-[#FAFAFC]/60">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center">
        <p className="text-[13px] sm:text-[14px] font-medium text-slate-500 mb-6">
          Built for agencies, sales teams and businesses looking for their next opportunity.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-x-8 sm:gap-x-14 gap-y-4">
          {CATEGORIES.map((category, idx) => (
            <div
              key={idx}
              className="group flex items-center gap-2 cursor-default select-none"
            >
              <span className="text-[11.5px] sm:text-[12.5px] font-semibold tracking-[0.18em] text-slate-400 group-hover:text-slate-800 transition-colors duration-200">
                {category}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
