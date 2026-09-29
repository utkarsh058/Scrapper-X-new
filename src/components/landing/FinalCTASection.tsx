'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export function FinalCTASection() {
  return (
    <section className="py-20 sm:py-28 bg-[#FAFAFC] border-t border-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 text-white p-8 sm:p-14 md:p-16 text-center shadow-[0_24px_60px_-15px_rgba(15,23,42,0.3)]">
          {/* Subtle atmospheric glow inside card */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Pill Badge */}
          <div className="relative z-10 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-teal-300 text-xs font-semibold tracking-wider uppercase mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            Start Growing Today
          </div>

          {/* Headline */}
          <h2 className="relative z-10 text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-tight max-w-2xl mx-auto">
            Find your next website client.
          </h2>

          {/* Supporting Text */}
          <p className="relative z-10 mt-4 sm:mt-5 text-base sm:text-lg text-slate-300 font-normal leading-relaxed max-w-xl mx-auto">
            Discover businesses. Identify opportunities. Start better conversations.
          </p>

          {/* CTA Buttons */}
          <div className="relative z-10 mt-8 sm:mt-10 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
            <Link
              href="/signup"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-semibold text-slate-950 bg-white hover:bg-slate-100 transition-all duration-200 shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Start Finding Leads</span>
              <ArrowRight className="w-4 h-4 text-teal-600" />
            </Link>

            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full text-sm font-medium text-white hover:text-slate-200 bg-white/5 hover:bg-white/10 border border-white/15 transition-all duration-200"
            >
              <span>See How It Works</span>
            </a>
          </div>

          {/* Trust bullets */}
          <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-y-2 gap-x-6 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              Free discovery credits included
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              Instant client prototype generator
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
