'use client';

import React from 'react';
import { Building2, GlobeX, AlertCircle, CheckCircle2 } from 'lucide-react';
import { MetricSummary } from '@/types';

interface StatCardsProps {
  metrics: MetricSummary;
  selectedFilter: string;
  onSelectFilter: (filter: string) => void;
}

export const StatCards: React.FC<StatCardsProps> = ({
  metrics,
  selectedFilter,
  onSelectFilter,
}) => {
  const cards = [
    {
      id: 'all',
      title: 'Businesses Found',
      value: (metrics.businessesFound ?? 1248).toLocaleString(),
      icon: Building2,
      iconColor: 'text-slate-600',
      iconBg: 'bg-slate-100',
    },
    {
      id: 'No Website',
      title: 'No Website',
      value: (metrics.noWebsite ?? 186).toLocaleString(),
      icon: GlobeX,
      iconColor: 'text-rose-600',
      iconBg: 'bg-rose-50',
    },
    {
      id: 'Needs Improvement',
      title: 'Needs Improvement',
      value: (metrics.poorWebsite ?? 324).toLocaleString(),
      icon: AlertCircle,
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-50',
    },
    {
      id: 'Email + Phone',
      title: 'Email + Phone',
      value: (metrics.qualifiedLeads ?? 472).toLocaleString(),
      icon: CheckCircle2,
      iconColor: 'text-teal-600',
      iconBg: 'bg-teal-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedFilter === card.id;

        return (
          <button
            key={card.id}
            type="button"
            onClick={() => onSelectFilter(card.id)}
            className={`flex flex-col text-left justify-between rounded-xl bg-white p-4 border transition-all cursor-pointer select-none group ${
              isSelected
                ? 'border-[#0F172A] ring-1 ring-[#0F172A] shadow-xs'
                : 'border-[#E2E8F0] hover:border-[#CBD5E1] shadow-2xs'
            }`}
          >
            {/* Top row: Label + Small Icon */}
            <div className="flex items-center justify-between w-full">
              <span className="text-[12px] font-medium text-[#64748B] group-hover:text-[#0F172A] transition-colors">
                {card.title}
              </span>
              <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${card.iconBg} ${card.iconColor}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>

            {/* Bottom: Big Clean Metric */}
            <div className="mt-3">
              <span className="text-[24px] font-bold tracking-tight text-[#0F172A] tabular-nums leading-none">
                {card.value}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
