'use client';

import React, { useState, useEffect } from 'react';
import { 
  Send, 
  Plus, 
  Sparkles, 
  TrendingUp, 
  MessageSquare, 
  CheckCircle2, 
  Calendar,
  AlertCircle,
  Download,
  Mail,
  Phone,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  StopCircle,
  Check,
  ChevronRight,
  ExternalLink,
  Bot,
  Clock,
  UserCheck,
  ShieldAlert,
  ArrowRight
} from 'lucide-react';

interface CampaignsViewProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({ onShowToast }) => {
  const [activeSubTab, setActiveSubTab] = useState<'campaigns' | 'inbox' | 'meetings' | 'analytics'>('campaigns');
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [replies, setReplies] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [providers, setProviders] = useState<any>({
    llm: { configured: false, provider: 'none' },
    email: { configured: false, provider: 'none' },
    calendar: { configured: true, provider: 'internal' },
  });

  // Modal / Drawer states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedReply, setSelectedReply] = useState<any | null>(null);
  const [isCycleRunning, setIsCycleRunning] = useState(false);
  const [cycleReport, setCycleReport] = useState<any | null>(null);

  // Create Campaign Form state
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [campaignName, setCampaignName] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [useAiPersonalization, setUseAiPersonalization] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [campRes, meetRes, anaRes, autoRes, leadsRes] = await Promise.all([
        fetch('/api/campaigns').then((r) => r.json()).catch(() => ({})),
        fetch('/api/meetings').then((r) => r.json()).catch(() => ({})),
        fetch('/api/analytics/campaigns').then((r) => r.json()).catch(() => ({})),
        fetch('/api/autonomous/run').then((r) => r.json()).catch(() => ({})),
        fetch('/api/leads?limit=25').then((r) => r.json()).catch(() => ({})),
      ]);

      if (campRes.success) setCampaigns(campRes.campaigns || []);
      if (meetRes.success) setMeetings(meetRes.meetings || []);
      if (anaRes.success) setAnalytics(anaRes.analytics || null);
      if (autoRes.success) {
        setProviders(autoRes.providers || providers);
      }
      if (leadsRes.success && Array.isArray(leadsRes.leads)) {
        setAvailableLeads(leadsRes.leads);
      }

      // Load replies via assistant endpoint or recent replies
      const assistRes = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'getRecentReplies' }),
      }).then((r) => r.json()).catch(() => ({}));

      if (assistRes.success && Array.isArray(assistRes.dataSummary)) {
        setReplies(assistRes.dataSummary);
      }
    } catch (err: any) {
      console.error('Failed to load campaigns data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleStartCampaign = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/start`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onShowToast('Campaign Started', `Processed batch for ${data.processed || 0} leads.`, 'success');
        loadAllData();
      } else {
        onShowToast('Campaign Error', data.error || 'Failed to start campaign.', 'error');
      }
    } catch (err: any) {
      onShowToast('Network Error', err.message, 'error');
    }
  };

  const handlePauseCampaign = async (id: string) => {
    try {
      const res = await fetch(`/api/campaigns/${id}/pause`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        onShowToast('Campaign Paused', 'Outreach sequences paused.', 'info');
        loadAllData();
      }
    } catch (err: any) {
      onShowToast('Error', err.message, 'error');
    }
  };

  const handleRunAutonomousCycle = async () => {
    setIsCycleRunning(true);
    try {
      const res = await fetch('/api/autonomous/run', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setCycleReport(data);
        onShowToast(
          'Autonomous Cycle Complete',
          `Checked ${data.followupReport?.totalDueChecked || 0} due steps. Active campaigns: ${data.campaignsActive}`,
          'success'
        );
        loadAllData();
      } else {
        onShowToast('Cycle Error', data.error, 'error');
      }
    } catch (err: any) {
      onShowToast('Error', err.message, 'error');
    } finally {
      setIsCycleRunning(false);
    }
  };

  const handleCreateCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!campaignName.trim()) {
      onShowToast('Name Required', 'Please enter a campaign name.', 'warning');
      return;
    }
    if (selectedLeadIds.length === 0) {
      onShowToast('Select Leads', 'Please select at least one qualified lead.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campaignName.trim(),
          description: campaignDesc.trim(),
          leadIds: selectedLeadIds,
          useAiPersonalization,
        }),
      });

      const data = await res.json();
      if (data.success) {
        onShowToast('Campaign Created', `Created "${campaignName}" with ${selectedLeadIds.length} leads.`, 'success');
        setIsCreateModalOpen(false);
        setCampaignName('');
        setCampaignDesc('');
        setSelectedLeadIds([]);
        loadAllData();
      } else {
        onShowToast('Creation Failed', data.error, 'error');
      }
    } catch (err: any) {
      onShowToast('Error', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg font-bold text-slate-900 tracking-tight">AI Sales Automation & Sequences</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              Autonomous Engine
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real multi-lead email sequences, AI reply classification, automatic meeting scheduling, and conversion tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={handleRunAutonomousCycle}
            disabled={isCycleRunning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition cursor-pointer"
            title="Scan for due follow-ups and dispatch batch"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCycleRunning ? 'animate-spin text-blue-600' : ''}`} />
            <span>Run Cycle Now</span>
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </button>
        </div>
      </div>

      {/* Real Provider Readiness Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${providers.email.configured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Email Dispatch Provider</div>
              <div className="text-[11px] text-slate-500">
                {providers.email.configured ? `Active: ${providers.email.provider}` : 'NOT_CONFIGURED (Add RESEND_API_KEY)'}
              </div>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${providers.email.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {providers.email.configured ? 'READY' : 'STANDBY'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${providers.llm.configured ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">AI Intelligence Engine</div>
              <div className="text-[11px] text-slate-500">
                {providers.llm.configured ? `Active: ${providers.llm.provider}` : 'NOT_CONFIGURED (Template Fallback)'}
              </div>
            </div>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${providers.llm.configured ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
            {providers.llm.configured ? 'READY' : 'FALLBACK'}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-800">Meeting Automation</div>
              <div className="text-[11px] text-slate-500">
                {providers.calendar.provider} Engine
              </div>
            </div>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            OPERATIONAL
          </span>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2">
        <button
          onClick={() => setActiveSubTab('campaigns')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'campaigns'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Send className="w-3.5 h-3.5" />
          <span>Campaigns ({campaigns.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('inbox')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'inbox'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Inbound Replies & Action Router ({replies.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('meetings')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'meetings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>Meetings & Calendar ({meetings.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('analytics')}
          className={`flex items-center gap-2 py-2.5 px-4 text-xs font-bold border-b-2 transition cursor-pointer ${
            activeSubTab === 'analytics'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Sales Analytics</span>
        </button>
      </div>

      {/* SUB-TAB 1: CAMPAIGNS & SEQUENCES */}
      {activeSubTab === 'campaigns' && (
        <div className="space-y-4">
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
                <Send className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">No Multi-Lead Campaigns Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
                Launch your first automated multi-step email sequence. Target qualified leads with evidence-grounded AI copy.
              </p>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Create First Campaign</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {campaigns.map((cmp) => (
                <div key={cmp.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 flex flex-col justify-between hover:border-slate-300 transition">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900 leading-snug">{cmp.name}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{cmp.description || 'Standard 3-step sequence'}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        cmp.status === 'RUNNING' ? 'bg-emerald-100 text-emerald-800' :
                        cmp.status === 'PAUSED' ? 'bg-amber-100 text-amber-800' :
                        cmp.status === 'COMPLETED' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {cmp.status}
                      </span>
                    </div>

                    {/* Funnel Mini Stats */}
                    <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-100 text-center">
                      <div>
                        <div className="text-[10px] text-slate-400">Leads</div>
                        <div className="text-xs font-bold text-slate-800">{cmp.totalLeads}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Sent</div>
                        <div className="text-xs font-bold text-slate-800">{cmp.stats.sent}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Replies</div>
                        <div className="text-xs font-bold text-blue-600">{cmp.stats.replied}</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">Meetings</div>
                        <div className="text-xs font-bold text-emerald-600">{cmp.stats.meetings}</div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                    <span className="text-[10px] text-slate-400">
                      {cmp.stepsCount} Sequence Steps
                    </span>
                    <div className="flex items-center gap-1.5">
                      {cmp.status === 'RUNNING' ? (
                        <button
                          onClick={() => handlePauseCampaign(cmp.id)}
                          className="p-1.5 rounded-lg border border-slate-200 text-amber-600 hover:bg-amber-50 text-xs font-semibold transition cursor-pointer"
                          title="Pause sequence"
                        >
                          <Pause className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStartCampaign(cmp.id)}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5" />
                          <span>{cmp.status === 'PAUSED' ? 'Resume' : 'Start'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: INBOUND REPLIES & ACTION ROUTER */}
      {activeSubTab === 'inbox' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Classified Incoming Replies ({replies.length})
            </h3>
            <span className="text-[11px] text-slate-400">Automated Action Router Active</span>
          </div>

          {replies.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              No inbound email replies received yet. Replies received via webhook will appear here with AI classification and routed actions.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {replies.map((reply) => (
                <div
                  key={reply.replyId}
                  onClick={() => setSelectedReply(reply)}
                  className="p-4 hover:bg-slate-50 transition flex items-center justify-between gap-4 cursor-pointer"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{reply.businessName}</span>
                      <span className="text-[11px] text-slate-400">&lt;{reply.from}&gt;</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        reply.classification === 'INTERESTED' || reply.classification === 'MEETING_REQUEST' ? 'bg-emerald-100 text-emerald-800' :
                        reply.classification === 'QUESTION' ? 'bg-blue-100 text-blue-800' :
                        reply.classification === 'OOO' ? 'bg-amber-100 text-amber-800' :
                        reply.classification === 'NOT_INTERESTED' || reply.classification === 'UNSUBSCRIBE' ? 'bg-rose-100 text-rose-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {reply.classification}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 font-medium truncate">{reply.subject}</div>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Action: {reply.actionTaken || 'ROUTED'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-400">
                      {new Date(reply.receivedAt).toLocaleDateString()}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: MEETINGS & CALENDAR */}
      {activeSubTab === 'meetings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Meetings & Scheduled Discovery Calls ({meetings.length})
            </h3>
            <span className="text-[11px] text-slate-400">Integrated with Calendar Engine</span>
          </div>

          {meetings.length === 0 ? (
            <div className="p-10 text-center text-slate-400 text-xs">
              No meetings scheduled yet. Meetings are automatically requested when prospects reply with positive intent.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {meetings.map((m) => (
                <div key={m.id} className="p-4 hover:bg-slate-50 transition flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">{m.title}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        m.status === 'SCHEDULED' ? 'bg-emerald-100 text-emerald-800' :
                        m.status === 'REQUESTED' ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {m.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      Lead: {m.lead?.name} · Attendee: {m.attendeeEmail}
                    </div>
                    {m.meetingUrl && (
                      <a
                        href={m.meetingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline"
                      >
                        <span>Join Meeting Room</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-700">
                      {m.startTime ? new Date(m.startTime).toLocaleString() : 'Proposed'}
                    </div>
                    <div className="text-[10px] text-slate-400">{m.timeZone || 'Asia/Kolkata'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: SALES ANALYTICS */}
      {activeSubTab === 'analytics' && analytics && (
        <div className="space-y-5">
          {/* Key Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] text-slate-400 font-medium">Emails Sent</div>
              <div className="text-xl font-bold text-slate-900 mt-1">{analytics.totals.emailsSent}</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Delivery: {analytics.rates.deliveryRate}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] text-slate-400 font-medium">Replies Received</div>
              <div className="text-xl font-bold text-blue-600 mt-1">{analytics.totals.repliesReceived}</div>
              <div className="text-[10px] text-blue-600 font-semibold mt-1">Reply Rate: {analytics.rates.replyRate}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] text-slate-400 font-medium">Positive Interest</div>
              <div className="text-xl font-bold text-emerald-600 mt-1">{analytics.totals.interestedReplies}</div>
              <div className="text-[10px] text-emerald-600 font-semibold mt-1">Positive: {analytics.rates.positiveRate}</div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-[11px] text-slate-400 font-medium">Meetings Booked</div>
              <div className="text-xl font-bold text-purple-600 mt-1">{analytics.totals.meetingsBooked}</div>
              <div className="text-[10px] text-purple-600 font-semibold mt-1">Booking: {analytics.rates.meetingRate}</div>
            </div>
          </div>

          {/* Funnel Visual */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Conversion Funnel Progression</h3>
            <div className="space-y-3">
              {analytics.funnel.map((f: any, idx: number) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-32 text-xs font-medium text-slate-600 truncate">{f.stage}</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(5, Math.min(100, analytics.totals.leadsTargeted > 0 ? (f.count / analytics.totals.leadsTargeted) * 100 : 0))}%`,
                      }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs font-bold text-slate-800">{f.count}</span>
                  <span className="w-16 text-right text-[11px] text-slate-400">{f.rate || ''}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE CAMPAIGN MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl border border-slate-200 shadow-2xl p-6 space-y-5 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Create Autonomous Multi-Lead Campaign</h2>
                <p className="text-xs text-slate-500">Target leads with automated sequence follow-ups and AI copy.</p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCampaignSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Campaign Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Jaipur Real Estate Modernization"
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Offering free mobile landing page concept previews"
                  value={campaignDesc}
                  onChange={(e) => setCampaignDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 bg-blue-50 p-3 rounded-xl border border-blue-100">
                <input
                  type="checkbox"
                  id="useAi"
                  checked={useAiPersonalization}
                  onChange={(e) => setUseAiPersonalization(e.target.checked)}
                  className="rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="useAi" className="text-xs font-semibold text-blue-900 cursor-pointer">
                  Enable Evidence-Grounded AI Copywriting for every lead
                </label>
              </div>

              {/* Select Leads */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700">Select Qualified Leads ({selectedLeadIds.length} chosen)</label>
                  <button
                    type="button"
                    onClick={() => setSelectedLeadIds(availableLeads.map((l) => l.id))}
                    className="text-[11px] font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Select All ({availableLeads.length})
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-2 divide-y divide-slate-100">
                  {availableLeads.length === 0 ? (
                    <div className="text-xs text-slate-400 p-3 text-center">No leads found. Search and discover leads first.</div>
                  ) : (
                    availableLeads.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => toggleLeadSelection(l.id)}
                        className={`p-2 flex items-center justify-between text-xs rounded-lg transition cursor-pointer ${
                          selectedLeadIds.includes(l.id) ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div>
                          <div>{l.name}</div>
                          <div className="text-[10px] text-slate-400 font-normal">{l.category} · {l.city}</div>
                        </div>
                        {selectedLeadIds.includes(l.id) && <Check className="w-4 h-4 text-blue-600" />}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Create Campaign</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REPLY DETAILS DRAWER */}
      {selectedReply && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full shadow-2xl p-6 space-y-5 overflow-y-auto animate-slide-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Inbound Reply & AI Routing</h2>
                <p className="text-xs text-slate-500">{selectedReply.businessName}</p>
              </div>
              <button
                onClick={() => setSelectedReply(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-1.5">
                <div className="text-[11px] font-bold text-slate-500">SUBJECT</div>
                <div className="text-xs font-bold text-slate-900">{selectedReply.subject}</div>
                <div className="text-[11px] font-bold text-slate-500 mt-2">CLASSIFICATION</div>
                <div className="text-xs font-bold text-blue-600">{selectedReply.classification} (Confidence: {(selectedReply.confidence * 100).toFixed(0)}%)</div>
                <div className="text-[11px] font-bold text-slate-500 mt-2">ACTION ROUTED</div>
                <div className="text-xs font-bold text-emerald-600">{selectedReply.actionTaken}</div>
              </div>

              <div>
                <div className="text-xs font-bold text-slate-700 mb-1">Reply Message Body</div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                  {selectedReply.bodyText || selectedReply.subject}
                </div>
              </div>

              {selectedReply.aiDraftResponse && (
                <div>
                  <div className="text-xs font-bold text-purple-700 flex items-center gap-1 mb-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AI Suggested Reply Draft</span>
                  </div>
                  <div className="p-3 bg-purple-50/50 border border-purple-200 rounded-xl text-xs text-purple-900 whitespace-pre-wrap leading-relaxed">
                    {selectedReply.aiDraftResponse}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
