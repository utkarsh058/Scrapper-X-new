'use client';

import React, { useState } from 'react';
import { X, ExternalLink, Smartphone, Monitor, CheckCircle, Sparkles } from 'lucide-react';

interface DemoModalProps {
  isOpen: boolean;
  businessName: string;
  onClose: () => void;
}

export function DemoModal({ isOpen, businessName, onClose }: DemoModalProps) {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Top Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 animate-pulse" />
            <span className="text-xs font-bold text-slate-800">
              Generated Concept Preview
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <span className="text-xs text-slate-500 font-medium">
              {businessName || 'ABC Restaurant'}
            </span>
          </div>

          {/* Device switcher */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-200/80 p-0.5 rounded-lg text-xs">
              <button
                onClick={() => setDevice('desktop')}
                className={`p-1.5 rounded-md transition-colors ${
                  device === 'desktop'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Desktop View"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`p-1.5 rounded-md transition-colors ${
                  device === 'mobile'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Mobile View"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body Preview Container */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/60 flex items-center justify-center">
          <div
            className={`transition-all duration-300 bg-white rounded-xl shadow-md border border-slate-200 overflow-hidden ${
              device === 'mobile'
                ? 'w-[360px] h-[580px]'
                : 'w-full max-w-3xl min-h-[460px]'
            }`}
          >
            {/* Fake website top nav */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white">
              <span className="font-bold text-sm text-slate-900 tracking-tight">
                {businessName || 'Osteria Bella'}
              </span>
              <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                <span>Menu</span>
                <span>Story</span>
                <span className="px-3 py-1 bg-slate-900 text-white rounded-full text-[11px]">
                  Book Table
                </span>
              </div>
            </div>

            {/* Fake website hero */}
            <div className="p-8 sm:p-12 text-center bg-gradient-to-b from-teal-50/40 to-white flex flex-col items-center justify-center space-y-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200/60">
                Fresh & Handcrafted Daily
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight max-w-md">
                Experience authentic gastronomy crafted with passion.
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm leading-relaxed">
                Modern online reservations, seasonal tasting menus, and seamless table ordering.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button className="px-5 py-2 rounded-full bg-slate-900 text-white text-xs font-medium shadow-sm">
                  Reserve Online
                </button>
                <button className="px-5 py-2 rounded-full bg-white text-slate-700 text-xs font-medium border border-slate-200">
                  View Full Menu
                </button>
              </div>
            </div>

            {/* Fake website features */}
            <div className="grid grid-cols-3 gap-4 p-6 border-t border-slate-100 bg-[#FAFAFC] text-center text-xs">
              <div className="p-3">
                <div className="font-bold text-slate-800">4.9★ Local Rating</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Over 200 reviews</div>
              </div>
              <div className="p-3">
                <div className="font-bold text-slate-800">100% Mobile Ready</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Fast 0.8s load time</div>
              </div>
              <div className="p-3">
                <div className="font-bold text-slate-800">Instant Booking</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Automated SMS confirm</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-teal-600" />
            Client-ready demo link can be shared via email, SMS or WhatsApp
          </span>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
}
