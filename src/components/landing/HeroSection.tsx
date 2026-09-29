'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { HeroVisual } from './HeroVisual';

export function HeroSection() {
  return (
    <section className="relative pt-32 sm:pt-40 pb-16 sm:pb-20 overflow-hidden text-center">
      {/* Subtle background ambient mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[520px] pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[650px] sm:w-[850px] h-[400px] bg-gradient-to-b from-teal-50/50 via-slate-50/30 to-transparent rounded-full blur-3xl opacity-75" />
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* 1. Small label above headline */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-50 border border-slate-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.02)] mb-6 sm:mb-7">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
          <span className="text-[12px] sm:text-[12.5px] font-medium tracking-tight text-slate-700">
            AI-powered lead intelligence
          </span>
        </div>

        {/* 2. MAIN HEADLINE - Strongest visual element */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-bold tracking-[-0.035em] text-slate-950 leading-[1.08] sm:leading-[1.06] max-w-4xl mx-auto">
          Find businesses that need a{' '}
          <span className="relative whitespace-nowrap">
            <span className="relative z-10 text-slate-900">better website.</span>
            <span className="absolute left-0 bottom-1 sm:bottom-2 w-full h-[6px] sm:h-[8px] bg-teal-200/50 -z-0 rounded-full" />
          </span>
        </h1>

        {/* 3. Supporting Text - Short, sharp, professional */}
        <p className="mt-5 sm:mt-6 text-base sm:text-lg md:text-[19px] text-slate-600 font-normal leading-relaxed max-w-2xl mx-auto">
          LeadPilot helps agencies and freelancers discover businesses, identify website opportunities, qualify leads, personalize outreach and create website demos.
        </p>

        {/* 4. CTA Buttons */}
        <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-[14px] font-semibold text-white bg-slate-950 hover:bg-slate-800 transition-all duration-200 shadow-sm hover:shadow hover:scale-[1.01] active:scale-[0.99]"
          >
            <span>Start Finding Leads</span>
            <ArrowRight className="w-4 h-4 text-teal-300" />
          </Link>

          <a
            href="#how-it-works"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-full text-[14px] font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all duration-200"
          >
            <span>See How It Works</span>
          </a>
        </div>

        {/* 5. Subtle Trust Line below buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-y-2 gap-x-4 text-[12px] text-slate-500 font-normal">
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-teal-600" />
            Free discovery credits
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-teal-600" />
            No credit card required
          </span>
          <span className="text-slate-300 hidden sm:inline">•</span>
          <span className="inline-flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-teal-600" />
            Client-ready demo generation
          </span>
        </div>
      </div>

      {/* 6. Refined Interactive Workflow Visual */}
      <HeroVisual />
    </section>
  );
}
