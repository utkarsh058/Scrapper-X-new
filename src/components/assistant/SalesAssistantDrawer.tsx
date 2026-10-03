'use client';

import React, { useState } from 'react';
import { Bot, Send, Sparkles, X, Loader2, CheckCircle2, MessageSquare, Calendar, TrendingUp } from 'lucide-react';

interface SalesAssistantDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolUsed?: string;
}

export const SalesAssistantDrawer: React.FC<SalesAssistantDrawerProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I am your AI Sales Copilot. I have real-time access to your database of leads, campaigns, inbound replies, and meetings. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (queryText?: string) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: textToSend.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend.trim(),
          history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.message,
            toolUsed: data.toolUsed,
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Error: ${data.error || 'Unable to retrieve answer.'}`,
          },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Network error: ${err.message}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickChips = [
    { label: 'Positive replies', query: 'Which leads replied positively?' },
    { label: 'Campaign performance', query: 'Show campaign reply rates and performance' },
    { label: 'Due follow-ups', query: 'Which follow-ups are due today?' },
    { label: 'Upcoming meetings', query: 'Show scheduled meetings' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-2xs flex justify-end font-sans">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between animate-slide-left border-l border-slate-200">
        {/* Top Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-slate-900">AI Sales Copilot</h2>
              <p className="text-[10px] text-slate-500">Grounded in real database context</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1 text-sm font-bold cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-xs'
                    : 'bg-slate-100 text-slate-800 rounded-bl-xs border border-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                {m.toolUsed && m.toolUsed !== 'none' && (
                  <div className="mt-2 pt-1.5 border-t border-slate-200 text-[10px] text-blue-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    <span>Verified via DB Tool: {m.toolUsed}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              <span>Querying database and preparing response...</span>
            </div>
          )}
        </div>

        {/* Bottom Input & Quick Chips */}
        <div className="p-4 border-t border-slate-100 space-y-2.5 bg-white">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {quickChips.map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(chip.query)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-600 border border-slate-200 transition cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              placeholder="Ask about leads, campaigns, or replies..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-hidden focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
