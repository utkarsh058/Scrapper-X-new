'use client';

import React, { useState } from 'react';
import { 
  X, 
  Download, 
  FileSpreadsheet, 
  Check, 
  Layers, 
  Database, 
  Table
} from 'lucide-react';
import { Lead } from '@/types';

interface ExportModalProps {
  isOpen: boolean;
  selectedLeads: Lead[];
  onClose: () => void;
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  selectedLeads,
  onClose,
  onShowToast,
}) => {
  const [format, setFormat] = useState<'csv' | 'xlsx' | 'json'>('csv');
  const [fields, setFields] = useState({
    businessName: true,
    industry: true,
    location: true,
    websiteUrl: true,
    websiteScore: true,
    contactName: true,
    contactEmail: true,
    contactPhone: true,
    leadScore: true,
    aiPitch: true,
  });
  const [isExporting, setIsExporting] = useState(false);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const count = selectedLeads.length > 0 ? selectedLeads.length : 2840;

  const toggleField = (key: keyof typeof fields) => {
    setFields((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      onClose();
      onShowToast(
        'Export Generated',
        `Downloaded ${count} leads in .${format.toUpperCase()} format with selected columns.`,
        'success'
      );
    }, 800);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px] select-none animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-md rounded-xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#EAECEF] bg-[#FAFAFB]">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-md bg-teal-50 border border-teal-200 text-teal-800 flex items-center justify-center">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[13.5px] font-bold text-[#171717]">Export Leads Pipeline</h3>
              <p className="text-[11px] text-[#6B7280]">Export {count} leads for cold outreach & CRM</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-6 w-6 rounded text-[#9CA3AF] hover:text-[#171717] hover:bg-[#F3F4F6] flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-[12.5px]">
          {/* Format Selection */}
          <div>
            <label className="block text-[11.5px] font-semibold text-[#374151] mb-1.5">
              Export Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'csv', label: 'CSV (.csv)', desc: 'Excel, Sheets, Clay' },
                { id: 'xlsx', label: 'Excel (.xlsx)', desc: 'Formatted table' },
                { id: 'json', label: 'JSON (.json)', desc: 'API / Raw objects' },
              ].map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFormat(item.id as any)}
                  className={`p-2 rounded-lg border text-left transition-all ${
                    format === item.id
                      ? 'border-teal-700 bg-teal-50/50 text-teal-950 font-semibold ring-1 ring-teal-700'
                      : 'border-[#E5E7EB] bg-[#F9FAFB] text-[#374151] hover:bg-white'
                  }`}
                >
                  <span className="block text-[12px]">{item.label}</span>
                  <span className="text-[10px] text-[#6B7280] font-normal">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fields checklist */}
          <div>
            <label className="block text-[11.5px] font-semibold text-[#374151] mb-1.5">
              Included Columns
            </label>
            <div className="grid grid-cols-2 gap-2 p-3 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB]">
              {[
                { key: 'businessName', label: 'Business & Legal Name' },
                { key: 'industry', label: 'Industry & Category' },
                { key: 'location', label: 'City, State, Address' },
                { key: 'websiteUrl', label: 'Website URL & Status' },
                { key: 'websiteScore', label: 'Speed & Diagnostics' },
                { key: 'contactName', label: 'Contact Full Name' },
                { key: 'contactEmail', label: 'Verified Email' },
                { key: 'contactPhone', label: 'Direct Phone' },
                { key: 'leadScore', label: 'Lead Score Rating' },
                { key: 'aiPitch', label: 'AI Outreach Script' },
              ].map((field) => (
                <label key={field.key} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(fields as any)[field.key]}
                    onChange={() => toggleField(field.key as any)}
                    className="h-3.5 w-3.5 rounded border-[#D1D5DB] text-teal-700 focus:ring-teal-600"
                  />
                  <span className="text-[11.5px] text-[#374151]">{field.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md border border-[#E5E7EB] bg-white text-[12px] font-medium text-[#4B5563] hover:bg-[#F3F4F6]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white px-4 py-1.5 text-[12.5px] font-medium transition-all shadow-subtle disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{isExporting ? 'Generating...' : `Export ${count} Leads`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
