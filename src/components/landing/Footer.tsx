'use client';

import React from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-slate-200/80 pt-16 pb-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 lg:gap-12 mb-12">
          {/* Brand info (spans 2 cols on md) */}
          <div className="col-span-2 space-y-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center text-teal-400">
                <Compass className="w-4 h-4" />
              </div>
              <span className="text-base font-bold text-slate-900 tracking-tight">
                LeadPilot
              </span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60">
                AI
              </span>
            </Link>

            <p className="text-xs sm:text-[13px] text-slate-500 leading-relaxed max-w-sm">
              The automated B2B lead-generation platform engineered to uncover
              businesses with high-value website opportunities and initiate
              contextual outreach.
            </p>

            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>All systems operational • v1.4</span>
            </div>
          </div>

          {/* Column 1: Product */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Product
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <a href="#solutions" className="hover:text-slate-950 transition-colors">
                  Solutions
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="hover:text-slate-950 transition-colors">
                  How It Works
                </a>
              </li>
              <li>
                <a href="#ai-outreach" className="hover:text-slate-950 transition-colors">
                  AI Outreach
                </a>
              </li>
              <li>
                <a href="#website-demos" className="hover:text-slate-950 transition-colors">
                  Website Demos
                </a>
              </li>
            </ul>
          </div>

          {/* Column 2: Company */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Company
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <a href="#about" className="hover:text-slate-950 transition-colors">
                  About
                </a>
              </li>
              <li>
                <a href="#contact" className="hover:text-slate-950 transition-colors">
                  Contact
                </a>
              </li>
            </ul>
          </div>

          {/* Column 3: Legal */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Legal
            </h4>
            <ul className="space-y-2 text-xs text-slate-600">
              <li>
                <a href="#privacy" className="hover:text-slate-950 transition-colors">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#terms" className="hover:text-slate-950 transition-colors">
                  Terms
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div>
            © {new Date().getFullYear()} LeadPilot. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <span>FIND BUSINESSES → IDENTIFY OPPORTUNITIES → REACH CLIENTS</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
