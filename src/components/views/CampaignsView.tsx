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
  RefreshCw
} from 'lucide-react';
import { OutreachRecord } from '@/types';

interface CampaignsViewProps {
  onShowToast: (title: string, desc?: string, type?: 'success' | 'info' | 'warning' | 'error') => void;
}

export const CampaignsView: React.FC<CampaignsViewProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(true);
  const [providerStatus, setProviderStatus] = useState<any>({
    email: { configured: false, provider: 'none', ready: false },
    sms: { configured: false, provider: 'none', ready: false },
    whatsapp: { configured: false, provider: 'none', ready: false },
  });
  const [metrics, setMetrics] = useState({
    totalOutreaches: 0,
    sentCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    emailCount: 0,
    smsCount: 0,
    whatsAppCount: 0,
  });
  const [outreachLogs, setOutreachLogs] = useState<OutreachRecord[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statusRes, historyRes] = await Promise.all([
        fetch('/api/outreach/status'),
        fetch('/api/outreach/history'),
      ]);

      const statusData = await statusRes.json();
      if (statusData.success) {
        setProviderStatus(statusData.providers);
        setMetrics(statusData.metrics);
      }

      const historyData = await historyRes.json();
      if (historyData.success) {
        setOutreachLogs(historyData.outreaches || []);
      }
    } catch (err: any) {
      console.error('Failed to load outreach data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
        <div>
          <h1 className="text-[16px] font-bold text-[#171717]">Cold Outreach & Multi-Channel Delivery</h1>
          <p className="text-[12px] text-[#6B7280]">
            Automated multi-channel outreach delivering personalized website audit insights & interactive prototypes.
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-1.5 rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            title="Refresh metrics"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
          </button>

          <a
            href="/api/outreach/export"
            download
            className="inline-flex items-center gap-1.5 rounded-md bg-white border border-[#D1D5DB] hover:bg-[#F9FAFB] text-[#374151] px-3.5 py-1.5 text-[12px] font-medium transition-all shadow-subtle cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-teal-700" />
            <span>Export Report (.xlsx)</span>
          </a>
        </div>
      </div>

      {/* Provider Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-lg border border-[#E5E7EB] bg-white shadow-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-teal-50 text-teal-700 border border-teal-200">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-[12.5px] font-bold text-[#171717]">Email Channel</h4>
              <p className="text-[11px] text-[#6B7280]">Provider: {providerStatus.email.provider || 'Resend'}</p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10.5px] font-bold border ${
              providerStatus.email.ready
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {providerStatus.email.ready ? 'CONNECTED' : 'NOT CONFIGURED'}
          </span>
        </div>

        <div className="p-3.5 rounded-lg border border-[#E5E7EB] bg-white shadow-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-[12.5px] font-bold text-[#171717]">SMS Channel</h4>
              <p className="text-[11px] text-[#6B7280]">Provider: {providerStatus.sms.provider || 'Twilio'}</p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10.5px] font-bold border ${
              providerStatus.sms.ready
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {providerStatus.sms.ready ? 'CONNECTED' : 'NOT CONFIGURED'}
          </span>
        </div>

        <div className="p-3.5 rounded-lg border border-[#E5E7EB] bg-white shadow-subtle flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-[12.5px] font-bold text-[#171717]">WhatsApp Channel</h4>
              <p className="text-[11px] text-[#6B7280]">Provider: Meta Cloud API v20.0</p>
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded text-[10.5px] font-bold border ${
              providerStatus.whatsapp.ready
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-amber-50 text-amber-800 border-amber-200'
            }`}
          >
            {providerStatus.whatsapp.ready ? 'CONNECTED' : 'NOT CONFIGURED'}
          </span>
        </div>
      </div>

      {/* Real Aggregate Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <span className="text-[11.5px] text-[#6B7280] block">Total Pitches Executed</span>
          <div className="text-[22px] font-bold text-[#171717] tabular-nums mt-1">
            {metrics.totalOutreaches}
          </div>
          <span className="text-[10.5px] text-slate-500 font-medium block mt-1">
            Recorded in persistent database
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <span className="text-[11.5px] text-[#6B7280] block">Delivered & Sent</span>
          <div className="text-[22px] font-bold text-emerald-600 tabular-nums mt-1">
            {metrics.deliveredCount + metrics.sentCount}
          </div>
          <span className="text-[10.5px] text-slate-500 font-medium block mt-1">
            Confirmed by live providers
          </span>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <span className="text-[11.5px] text-[#6B7280] block">Channels Utilized</span>
          <div className="text-[14px] font-bold text-[#171717] mt-2 space-y-0.5">
            <div>Email: <span className="text-teal-700 font-mono">{metrics.emailCount}</span></div>
            <div>SMS: <span className="text-indigo-700 font-mono">{metrics.smsCount}</span></div>
            <div>WhatsApp: <span className="text-emerald-700 font-mono">{metrics.whatsAppCount}</span></div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-[#E5E7EB] shadow-subtle">
          <span className="text-[11.5px] text-[#6B7280] block">Blocked / Failed Attempts</span>
          <div className="text-[22px] font-bold text-rose-600 tabular-nums mt-1">
            {metrics.failedCount}
          </div>
          <span className="text-[10.5px] text-slate-500 font-medium block mt-1">
            Protected by idempotency & safety guards
          </span>
        </div>
      </div>

      {/* Real Outreach Activity Log Table */}
      <div className="bg-white rounded-lg border border-[#E5E7EB] shadow-subtle overflow-hidden">
        <div className="p-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h3 className="text-[13.5px] font-semibold text-[#171717]">Outreach Transactions & Transmit Logs</h3>
          <span className="text-[11.5px] text-[#6B7280]">{outreachLogs.length} transmissions logged</span>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-slate-500 text-[12px]">
            <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
            <span>Loading delivery records...</span>
          </div>
        ) : outreachLogs.length === 0 ? (
          <div className="p-12 text-center">
            <Send className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <h4 className="text-[14px] font-semibold text-slate-800">No Outreach Transmissions Recorded</h4>
            <p className="text-[12px] text-slate-500 max-w-md mx-auto mt-1 mb-4">
              Personalized pitches can be generated directly from verified lead evidence in the Lead Drawer. Open any lead and click &quot;Send Outreach&quot; to review evidence and dispatch live.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[12px] border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Recipient</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provider</th>
                  <th className="px-4 py-3">Provider Message ID</th>
                  <th className="px-4 py-3">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-sans">
                {outreachLogs.map((log) => {
                  const isSuccess = log.status === 'SENT' || log.status === 'DELIVERED' || log.status === 'READ';
                  const isPending = log.status === 'QUEUED' || log.status === 'SENDING' || log.status === 'PENDING';
                  const isSuppressed = log.status === 'SUPPRESSED';

                  const badgeClass = isSuccess
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isPending
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : isSuppressed
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200';

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800 flex items-center gap-1.5">
                        {log.channel === 'EMAIL' ? (
                          <Mail className="h-3.5 w-3.5 text-slate-500" />
                        ) : log.channel === 'SMS' ? (
                          <Phone className="h-3.5 w-3.5 text-slate-500" />
                        ) : (
                          <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
                        )}
                        <span>{log.channel}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700">
                        {log.recipient}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10.5px] font-bold border ${badgeClass}`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 capitalize">
                        {log.provider}
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-500 max-w-[140px] truncate" title={log.providerMessageId || 'None'}>
                        {log.providerMessageId || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleDateString()} {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

