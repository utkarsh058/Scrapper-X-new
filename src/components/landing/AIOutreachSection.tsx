'use client';

import React, { useState } from 'react';
import { Sparkles, Edit3, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';

export function AIOutreachSection() {
  const [isEditing, setIsEditing] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState(
    `Hi ABC Restaurant team,\n\nI came across your business and noticed an opportunity to make it easier for customers to discover your services online.\n\nWe created a quick concept to show what that could look like.`
  );

  const handleRegenerate = () => {
    setIsRegenerating(true);
    setTimeout(() => {
      setMessage(
        `Hi ABC Restaurant team,\n\nI came across your restaurant while reviewing local dining options in Austin. You have strong customer reviews, but your current presence makes it difficult for customers to view your menu or book a table on mobile.\n\nWe prepared a quick interactive concept to show how a modern website could help capture those diners.`
      );
      setIsRegenerating(false);
    }, 450);
  };

  const handleCopy = () => {
    navigator.clipboard?.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section id="ai-outreach" className="py-20 sm:py-28 bg-[#FAFAFC] border-t border-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold tracking-wider uppercase text-slate-700 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-teal-600" />
            Contextual AI Outreach
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-950 leading-tight">
            Outreach that starts with context.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Instead of sending generic cold emails, LeadPilot generates outreach tailored to the specific opportunity discovered.
          </p>
        </div>

        {/* Clean Message Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.06)] overflow-hidden">
          
          {/* Card Header Bar */}
          <div className="px-6 py-4 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Target Business
              </span>
              <h4 className="text-sm font-bold text-slate-900 leading-none">
                ABC Restaurant
              </h4>
            </div>

            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                Opportunity
              </span>
              <span className="inline-block text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
                No website
              </span>
            </div>
          </div>

          {/* Message Area */}
          <div className="p-6 sm:p-8 space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
              <span className="text-slate-600 font-semibold">
                AI-Generated Pitch
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-1 hover:text-slate-900 transition-colors"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy message</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-5 rounded-xl bg-slate-50/80 border border-slate-200/70 text-slate-800 text-[14px] leading-relaxed font-sans whitespace-pre-line">
              {isRegenerating ? (
                <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  <span>Synthesizing tailored hook...</span>
                </div>
              ) : isEditing ? (
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  className="w-full bg-transparent border-none focus:outline-none resize-none text-[14px] leading-relaxed text-slate-800"
                />
              ) : (
                message
              )}
            </div>
          </div>

          {/* Action Buttons: [ Edit ] [ Regenerate ] */}
          <div className="px-6 py-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-500" />
              <span>{isEditing ? 'Save' : 'Edit'}</span>
            </button>

            <button
              type="button"
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-slate-500 ${
                  isRegenerating ? 'animate-spin' : ''
                }`}
              />
              <span>Regenerate</span>
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
