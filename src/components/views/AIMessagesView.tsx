'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Copy, 
  Send, 
  Check, 
  Edit3, 
  Sliders, 
  RefreshCw, 
  MessageSquare,
  Video,
  Mail,
  Smartphone
} from 'lucide-react';

interface AIMessagesViewProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const AIMessagesView: React.FC<AIMessagesViewProps> = ({ onShowToast }) => {
  const [selectedTemplate, setSelectedTemplate] = useState<'cold-email' | 'loom-script' | 'sms' | 'roi'>('cold-email');
  const [tone, setTone] = useState('Direct & Data-Driven');

  const copyText = (text: string, title: string) => {
    navigator.clipboard.writeText(text);
    onShowToast('Copied to Clipboard', `${title} template copied.`, 'success');
  };

  const templates = {
    'cold-email': {
      title: 'Conversion Leak Cold Email',
      channel: 'Email',
      icon: Mail,
      subject: 'Quick question regarding {{BusinessName}}\'s mobile booking flow',
      body: `Hi {{OwnerFirstName}},\n\nI was reviewing leading {{Industry}} businesses in {{City}} and noticed {{BusinessName}} has stellar reviews ({{ReviewRating}} stars).\n\nHowever, when testing your website on an iPhone, it currently takes ~{{LoadSpeedSeconds}}s to load and lacks direct online booking. In {{City}}, our data shows that causes ~{{LostLeadsPerMonth}} prospective clients to bounce to nearby competitors each month.\n\nWe built a rapid 1-click interactive demo showing what a modern patient/client booking portal would look like for {{BusinessName}}:\n👉 {{CustomDemoURL}}\n\nNo pitch or obligation — take a 30-second look and let me know if you'd like the code or design assets.\n\nBest,\nUtkarsh Sharma\nLeadPilot Growth Agency`,
    },
    'loom-script': {
      title: '60-Second Loom Video Script',
      channel: 'Video Pitch',
      icon: Video,
      subject: 'Video Audit for {{OwnerFirstName}} (60 seconds)',
      body: `[0:00 - 0:10] "Hey {{OwnerFirstName}}, Utkarsh here. I have {{BusinessName}}'s website pulled up on my screen right now..."\n\n[0:10 - 0:30] "I ran a quick performance scan and noticed two major conversion leaks: first, your mobile viewport isn't adapting on iOS, and second, your contact form is throwing an SSL warning..."\n\n[0:30 - 0:50] "To show you what's possible, I already generated a functional prototype with instant booking at {{CustomDemoURL}}..."\n\n[0:50 - 1:00] "If you want me to transfer this over to your team or connect it to your domain, let me know! Have a great week."`,
    },
    'sms': {
      title: 'Direct SMS / WhatsApp Follow-up',
      channel: 'SMS & WhatsApp',
      icon: Smartphone,
      subject: 'Quick SMS',
      body: `Hey {{OwnerFirstName}} - saw {{BusinessName}} in {{City}}. Noticed your site is losing mobile inquiries due to slow load times. Built a 1-click demo site for you: {{CustomDemoURL}} - check it out!`,
    },
    'roi': {
      title: 'ROI & Revenue Loss Analysis',
      channel: 'Proposal Deck',
      icon: MessageSquare,
      subject: 'Estimated Revenue Impact Analysis for {{BusinessName}}',
      body: `Executive Summary for {{BusinessName}}:\n\n• Current Monthly Website Traffic: ~{{MonthlyVisitors}} visits\n• Current Mobile Bounce Rate: {{MobileBounceRate}}% (Industry benchmark: <35%)\n• Estimated Inquiries Lost: {{EstimatedLostInquiries}} / month\n• Conservative Opportunity Cost: \${{LostRevenueEstimate}} in new client revenue annually\n\nSolution Blueprint: Deploy modern headless landing experience with instant calendar booking and <1.2s Core Web Vitals.`,
    }
  };

  const active = templates[selectedTemplate];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">AI Outreach Copilot & Message Templates</h1>
          <p className="text-[12px] text-[#6B7280]">
            Dynamic personalization tokens automatically populated from website audit flaws.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11.5px] text-[#6B7280]">Outreach Tone:</span>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="rounded border border-[#D1D5DB] bg-[#F7F8FA] px-2.5 py-1 text-[12px] text-[#171717] focus:outline-none"
          >
            <option value="Direct & Data-Driven">Direct & Data-Driven</option>
            <option value="Casual & Friendly">Casual & Friendly</option>
            <option value="Consultative Expert">Consultative Expert</option>
            <option value="Urgent Opportunity">Urgent Opportunity</option>
          </select>
        </div>
      </div>

      {/* Main Copilot Editor */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Template Selector Sidebar */}
        <div className="space-y-2">
          <span className="text-[11.5px] font-semibold text-[#6B7280] uppercase tracking-wider block px-1">
            Outreach Channels
          </span>
          {Object.entries(templates).map(([key, item]) => {
            const Icon = item.icon;
            const isSelected = selectedTemplate === key;

            return (
              <button
                key={key}
                onClick={() => setSelectedTemplate(key as any)}
                className={`w-full p-3 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'border-teal-700 bg-teal-50/60 text-teal-950 font-semibold ring-1 ring-teal-700 shadow-sm'
                    : 'border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${isSelected ? 'text-teal-700' : 'text-[#6B7280]'}`} />
                  <span className="text-[12.5px]">{item.title}</span>
                </div>
                <span className="text-[11px] text-[#6B7280] font-normal block mt-1">
                  {item.channel}
                </span>
              </button>
            );
          })}
        </div>

        {/* Template Editor Box */}
        <div className="md:col-span-2 bg-white rounded-lg border border-[#E5E7EB] shadow-subtle p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#F1F3F5] pb-3">
            <div>
              <h3 className="text-[13.5px] font-bold text-[#171717]">{active.title}</h3>
              <p className="text-[11px] text-[#6B7280]">Channel: {active.channel}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => copyText(active.body, active.title)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-teal-700 hover:bg-teal-800 text-white text-[12px] font-medium shadow-subtle"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Script</span>
              </button>
            </div>
          </div>

          {active.subject && (
            <div>
              <span className="block text-[11px] font-semibold text-[#6B7280] mb-1">Subject Line</span>
              <div className="p-2.5 rounded-md border border-[#E5E7EB] bg-[#F7F8FA] text-[12.5px] font-medium text-[#171717]">
                {active.subject}
              </div>
            </div>
          )}

          <div>
            <span className="block text-[11px] font-semibold text-[#6B7280] mb-1">Message Body</span>
            <div className="p-4 rounded-lg border border-[#E5E7EB] bg-[#FAFAFB] font-mono text-[11.5px] text-[#374151] whitespace-pre-wrap leading-relaxed">
              {active.body}
            </div>
          </div>

          {/* Tokens Legend */}
          <div className="p-3 rounded-lg border border-teal-200 bg-teal-50/40">
            <span className="text-[11.5px] font-semibold text-teal-900 block mb-1">
              Active Dynamic Tokens
            </span>
            <div className="flex flex-wrap gap-1.5 text-[11px]">
              {[
                '{{BusinessName}}',
                '{{OwnerFirstName}}',
                '{{Industry}}',
                '{{City}}',
                '{{LoadSpeedSeconds}}',
                '{{LostLeadsPerMonth}}',
                '{{CustomDemoURL}}',
              ].map((token) => (
                <span key={token} className="px-1.5 py-0.5 rounded bg-white border border-teal-300 text-teal-800 font-mono">
                  {token}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
