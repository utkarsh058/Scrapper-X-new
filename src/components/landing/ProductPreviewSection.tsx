'use client';

import React, { useState } from 'react';
import {
  Search,
  Filter,
  MapPin,
  Globe,
  Mail,
  Phone,
  ArrowRight,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface ProductPreviewSectionProps {
  onPreviewDemo?: (businessName: string) => void;
}

const PRESET_QUERIES = [
  {
    industry: 'Restaurants',
    location: 'Noida',
    websiteStatus: 'No Website',
    leads: [
      {
        id: '1',
        name: 'Saffron & Spice Bistro',
        location: 'Sector 18, Noida',
        category: 'North Indian Dining & Bar',
        reviews: '4.7★ (184 reviews)',
        websiteStatus: 'No Website Found',
        websiteColor: 'bg-rose-50 text-rose-700 border-rose-200/60',
        opportunity: 'High (Score 96)',
        opportunityColor: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
        outreachStatus: 'AI Pitch Ready',
        contact: 'Verified Phone & Email',
      },
      {
        id: '2',
        name: 'The Clay Oven Kitchen',
        location: 'Sector 62, Noida',
        category: 'Tandoor & Kebab Specialists',
        reviews: '4.6★ (128 reviews)',
        websiteStatus: 'Unclaimed Listing Only',
        websiteColor: 'bg-rose-50 text-rose-700 border-rose-200/60',
        opportunity: 'High (Score 93)',
        opportunityColor: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
        outreachStatus: 'AI Pitch Ready',
        contact: 'Verified Phone & Email',
      },
      {
        id: '3',
        name: 'Melt Cafe & Bakery',
        location: 'Sector 104, Noida',
        category: 'Artisanal Bakery & Desserts',
        reviews: '4.9★ (310 reviews)',
        websiteStatus: 'No Website Found',
        websiteColor: 'bg-rose-50 text-rose-700 border-rose-200/60',
        opportunity: 'High (Score 95)',
        opportunityColor: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
        outreachStatus: 'AI Pitch Ready',
        contact: 'Verified Phone & Instagram',
      },
    ],
  },
  {
    industry: 'Fitness Studios',
    location: 'Noida',
    websiteStatus: 'Fails Mobile',
    leads: [
      {
        id: '4',
        name: 'Pulse Athletic Club',
        location: 'Sector 50, Noida',
        category: 'HIIT & Functional Fitness',
        reviews: '4.8★ (92 reviews)',
        websiteStatus: 'Fails Mobile Viewport',
        websiteColor: 'bg-amber-50 text-amber-800 border-amber-200/60',
        opportunity: 'High (Score 91)',
        opportunityColor: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
        outreachStatus: 'AI Pitch Ready',
        contact: 'Verified Phone & Email',
      },
      {
        id: '5',
        name: 'Aura Yoga & Wellness',
        location: 'Sector 137, Noida',
        category: 'Vinyasa & Hot Yoga Studio',
        reviews: '4.9★ (140 reviews)',
        websiteStatus: '7.4s Slow Load Time',
        websiteColor: 'bg-amber-50 text-amber-800 border-amber-200/60',
        opportunity: 'Medium (Score 87)',
        opportunityColor: 'text-teal-700 bg-teal-50 border-teal-200/60',
        outreachStatus: 'AI Pitch Ready',
        contact: 'Verified Phone & Email',
      },
    ],
  },
  {
    industry: 'Dental Clinics',
    location: 'Noida',
    websiteStatus: 'Outdated CMS',
    leads: [
      {
        id: '6',
        name: 'Apex Smile Healthcare',
        location: 'Sector 29, Noida',
        category: 'Cosmetic Dentistry & Implants',
        reviews: '4.9★ (230 reviews)',
        websiteStatus: 'Outdated 2013 Template',
        websiteColor: 'bg-amber-50 text-amber-800 border-amber-200/60',
        opportunity: 'High (Score 92)',
        opportunityColor: 'text-emerald-700 bg-emerald-50 border-emerald-200/60',
        outreachStatus: 'AI Pitch Ready',
        contact: 'Verified Phone & Email',
      },
    ],
  },
];

export function ProductPreviewSection({ onPreviewDemo }: ProductPreviewSectionProps) {
  const [selectedCategoryIdx, setSelectedCategoryIdx] = useState(0);
  const activePreset = PRESET_QUERIES[selectedCategoryIdx];

  return (
    <section id="product" className="py-20 sm:py-28 bg-[#FAFAFC]/80 border-t border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="max-w-2xl mx-auto text-center mb-12 sm:mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-[11px] font-semibold tracking-wider uppercase text-slate-700 mb-3">
            <Search className="w-3.5 h-3.5 text-teal-600" />
            Interactive Workflow Demonstration
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-slate-950 leading-tight">
            From search query to qualified client.
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            LeadPilot filters thousands of local listings into verified prospects with detected website gaps.
          </p>
        </div>

        {/* Product Search Interface Card */}
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-[0_16px_40px_-12px_rgba(15,23,42,0.06)] overflow-hidden">
          
          {/* Query Bar */}
          <div className="p-4 sm:p-6 bg-slate-50/70 border-b border-slate-200/80">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              
              {/* Industry */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Industry
                </span>
                <select
                  value={selectedCategoryIdx}
                  onChange={(e) => setSelectedCategoryIdx(Number(e.target.value))}
                  className="w-full font-semibold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                >
                  <option value={0}>Restaurants</option>
                  <option value={1}>Fitness Studios</option>
                  <option value={2}>Dental Clinics</option>
                </select>
              </div>

              {/* Location */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Location
                </span>
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span>{activePreset.location}</span>
                </div>
              </div>

              {/* Website Status */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Website Status
                </span>
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{activePreset.websiteStatus}</span>
                </div>
              </div>

              {/* Contact Filter */}
              <div className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Contact
                </span>
                <div className="font-semibold text-slate-900 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Email + Phone</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex items-center">
                <button
                  type="button"
                  className="w-full h-full py-2.5 px-4 rounded-xl text-xs font-semibold text-white bg-slate-950 hover:bg-slate-800 transition-colors shadow-xs flex items-center justify-center gap-2"
                >
                  <Search className="w-3.5 h-3.5 text-teal-300" />
                  <span>Find Leads</span>
                </button>
              </div>

            </div>

            {/* Quick preset selector buttons */}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 overflow-x-auto pb-1">
              <span className="text-[11px] font-medium text-slate-400 shrink-0">
                Preset Queries:
              </span>
              {PRESET_QUERIES.map((preset, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedCategoryIdx(idx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    selectedCategoryIdx === idx
                      ? 'bg-slate-900 text-white'
                      : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.industry} in {preset.location}
                </button>
              ))}
            </div>
          </div>

          {/* Table / Results Header */}
          <div className="px-6 py-3 bg-slate-50/40 border-b border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px]">
              Showing {activePreset.leads.length} discovered opportunities in {activePreset.location}
            </span>
            <span className="text-[10.5px] italic text-slate-400">
              * Example live discovery dataset
            </span>
          </div>

          {/* Lead List Rows */}
          <div className="divide-y divide-slate-100">
            {activePreset.leads.map((lead) => (
              <div
                key={lead.id}
                className="p-5 sm:p-6 hover:bg-slate-50/60 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left: Lead Identity */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <h4 className="text-sm font-bold text-slate-900">
                      {lead.name}
                    </h4>
                    <span className="text-xs text-slate-400 font-normal">
                      • {lead.reviews}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-2">
                    <span>{lead.location}</span>
                    <span className="text-slate-300">•</span>
                    <span>{lead.category}</span>
                  </div>
                </div>

                {/* Center: Website Status & Opportunity Score */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${lead.websiteColor}`}
                  >
                    {lead.websiteStatus}
                  </span>

                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${lead.opportunityColor}`}
                  >
                    {lead.opportunity}
                  </span>

                  <span className="text-xs text-slate-500 px-2 py-1 rounded-md bg-slate-100/80">
                    {lead.contact}
                  </span>
                </div>

                {/* Right: Demo Action */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onPreviewDemo?.(lead.name)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-900 bg-white border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all duration-200 shadow-2xs"
                  >
                    <span>Preview Demo</span>
                    <ExternalLink className="w-3.5 h-3.5 text-teal-600" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Workflow Bottom Summary */}
          <div className="px-6 py-4 bg-slate-50/60 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Full flow: Business Identified → Website Flaw Tagged → AI Copy Drafted → 1-Click Demo</span>
            </div>
            <a
              href="#ai-outreach"
              className="text-teal-700 font-semibold hover:underline flex items-center gap-1"
            >
              <span>See generated outreach message</span>
              <ArrowRight className="w-3 h-3" />
            </a>
          </div>

        </div>

      </div>
    </section>
  );
}
