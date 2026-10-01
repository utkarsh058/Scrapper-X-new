'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { LeadSearchCard } from '@/components/dashboard/LeadSearchCard';
import { StatCards } from '@/components/dashboard/StatCards';
import { LeadsTable } from '@/components/dashboard/LeadsTable';
import { LeadDetailDrawer } from '@/components/dashboard/LeadDetailDrawer';
import { QuickAuditModal } from '@/components/dashboard/QuickAuditModal';
import { FindLeadsModal } from '@/components/dashboard/FindLeadsModal';
import { ExportModal } from '@/components/dashboard/ExportModal';
import { CommandPalette } from '@/components/common/CommandPalette';
import { ToastContainer } from '@/components/common/Toast';

import { FindLeadsView } from '@/components/views/FindLeadsView';
import { WebsiteAuditView } from '@/components/views/WebsiteAuditView';
import { CampaignsView } from '@/components/views/CampaignsView';
import { AIMessagesView } from '@/components/views/AIMessagesView';
import { DemoWebsitesView } from '@/components/views/DemoWebsitesView';
import { SettingsView } from '@/components/views/SettingsView';

import { NavTab, Lead, ToastMessage, ContactFilter, WebsiteFilter, NumberOfLeads, SearchSummary } from '@/types';
import { LeadFilterCriteria } from '@/components/dashboard/LeadSearchCard';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Real Leads state (Loaded from canonical persistent database)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchSummary, setSearchSummary] = useState<SearchSummary | null>(null);
  const [searchErrorMessage, setSearchErrorMessage] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [auditTargetLead, setAuditTargetLead] = useState<Lead | null>(null);

  // Load real persisted leads on initial mount
  React.useEffect(() => {
    fetch('/api/leads?limit=100')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.leads) && data.leads.length > 0) {
          setLeads(data.leads);
          setHasSearched(true);
        }
      })
      .catch(() => {});
  }, []);

  // Modals & Panels state
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFindLeadsModalOpen, setIsFindLeadsModalOpen] = useState(false);
  const [isQuickAuditModalOpen, setIsQuickAuditModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportSelectedLeads, setExportSelectedLeads] = useState<Lead[]>([]);

  // Search lifecycle states
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  // Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (
    title: string,
    description?: string,
    type: 'success' | 'info' | 'warning' | 'error' = 'success'
  ) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newToast: ToastMessage = { id, title, description, type };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Global keyboard shortcut for Command Palette
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleOpenQuickAudit = (lead?: Lead) => {
    setAuditTargetLead(lead || null);
    setIsQuickAuditModalOpen(true);
  };

  const handleOpenExport = (selected: Lead[] = []) => {
    setExportSelectedLeads(selected);
    setIsExportModalOpen(true);
  };

  const handleLeadSearchStart = () => {
    setIsSearching(true);
    setSearchErrorMessage(null);
  };

  const handleLeadSearchSubmit = async (criteria: LeadFilterCriteria) => {
    setIsSearching(true);
    setSearchErrorMessage(null);

    try {
      const response = await fetch('/api/leads/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          country: 'India',
          state: criteria.state,
          city: criteria.city,
          industry: criteria.industry,
          contactFilter: criteria.contact,
          websiteFilter: criteria.website,
          limit: criteria.limit,
        }),
      });

      const data = await response.json();

      setIsSearching(false);
      setHasSearched(true);

      if (data.success) {
        setLeads(data.leads || []);
        setSearchSummary(data.summary || null);
        setSearchErrorMessage(null);

        if (data.leads && data.leads.length > 0) {
          addToast(
            'Search Complete',
            `Discovered ${data.leads.length} real businesses in ${criteria.city ? `${criteria.city}, ` : ''}${criteria.state}.`,
            'success'
          );
        } else {
          addToast(
            'Search Complete',
            `No matching businesses found in ${criteria.city ? `${criteria.city}, ` : ''}${criteria.state}.`,
            'info'
          );
        }
      } else {
        setLeads([]);
        setSearchSummary(null);
        setSearchErrorMessage(data.error || 'Failed to fetch businesses.');
        addToast('Search Notice', data.error || 'Failed to fetch businesses.', 'warning');
      }
    } catch (err: any) {
      setIsSearching(false);
      setHasSearched(true);
      setLeads([]);
      setSearchSummary(null);
      const msg = err.message || 'Unable to connect to Google Places search API.';
      setSearchErrorMessage(msg);
      addToast('Search Error', msg, 'error');
    }
  };

  const handleScrollToLeads = () => {
    const tableEl = document.getElementById('leads-section');
    if (tableEl) {
      tableEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8F9FA] text-[#0F172A] font-sans antialiased">
      {/* 1. Clean Compact Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 2. Top Header */}
        <Header
          activeTab={activeTab}
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onShowToast={addToast}
          onNavigateTab={setActiveTab}
        />

        {/* 3. Page Content Container */}
        <main className="flex-1 p-6 overflow-y-auto max-w-[1400px] w-full mx-auto space-y-6">
          {/* MAIN DASHBOARD (OVERVIEW) */}
          {activeTab === 'overview' && (
            <div className="space-y-6 animate-fade-in">
              {/* Search Configuration Section */}
              <LeadSearchCard
                isSearchingExternal={isSearching}
                onSearchStart={handleLeadSearchStart}
                onSearchSubmit={handleLeadSearchSubmit}
                onViewLeads={handleScrollToLeads}
              />

              {/* Dedicated Search Results Section */}
              <LeadsTable
                leads={leads}
                summary={searchSummary}
                errorMessage={searchErrorMessage}
                onSelectLead={setSelectedLead}
                onQuickAudit={handleOpenQuickAudit}
                onOpenExportModal={handleOpenExport}
                onShowToast={addToast}
                hasSearched={hasSearched}
                isSearching={isSearching}
              />
            </div>
          )}

          {/* ALL LEADS VIEW */}
          {activeTab === 'leads' && (
            <div className="space-y-5 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-[#E2E8F0] shadow-2xs">
                <div>
                  <h1 className="text-[17px] font-bold text-[#0F172A] tracking-tight">All Discovered Leads</h1>
                  <p className="text-[12.5px] text-[#64748B] mt-0.5">
                    Browse and inspect all businesses discovered by your searches.
                  </p>
                </div>
              </div>

              <LeadsTable
                leads={leads}
                summary={searchSummary}
                errorMessage={searchErrorMessage}
                onSelectLead={setSelectedLead}
                onQuickAudit={handleOpenQuickAudit}
                onOpenExportModal={handleOpenExport}
                onShowToast={addToast}
                hasSearched={true}
                isSearching={false}
              />
            </div>
          )}

          {/* FIND LEADS VIEW */}
          {activeTab === 'find-leads' && (
            <FindLeadsView
              onSelectLead={setSelectedLead}
              onOpenQuickAudit={handleOpenQuickAudit}
              onShowToast={addToast}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}

          {/* WEBSITE AUDIT VIEW */}
          {activeTab === 'website-audit' && (
            <WebsiteAuditView
              leads={leads}
              onSelectLead={setSelectedLead}
              onOpenQuickAudit={handleOpenQuickAudit}
              onShowToast={addToast}
            />
          )}

          {/* CAMPAIGNS VIEW */}
          {activeTab === 'campaigns' && (
            <CampaignsView onShowToast={addToast} />
          )}

          {/* AI MESSAGES VIEW */}
          {activeTab === 'ai-messages' && (
            <AIMessagesView onShowToast={addToast} />
          )}

          {/* DEMO WEBSITES VIEW */}
          {activeTab === 'demo-websites' && (
            <DemoWebsitesView
              leads={leads}
              onSelectLead={setSelectedLead}
              onShowToast={addToast}
            />
          )}

          {/* SETTINGS VIEW */}
          {activeTab === 'settings' && (
            <SettingsView onShowToast={addToast} />
          )}
        </main>
      </div>

      {/* 7. Slide-over Lead Detail Drawer */}
      <LeadDetailDrawer
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onQuickAudit={handleOpenQuickAudit}
        onShowToast={addToast}
      />

      {/* Quick Audit Modal */}
      <QuickAuditModal
        isOpen={isQuickAuditModalOpen}
        lead={auditTargetLead}
        onClose={() => setIsQuickAuditModalOpen(false)}
        onShowToast={addToast}
      />

      {/* Find Leads Modal */}
      <FindLeadsModal
        isOpen={isFindLeadsModalOpen}
        onClose={() => setIsFindLeadsModalOpen(false)}
        onShowToast={addToast}
        onSearchSubmitted={(criteria) => {
          handleLeadSearchSubmit({
            country: 'India',
            state: criteria.state,
            city: criteria.city,
            industry: criteria.industry,
            contact: 'All Contacts',
            website: 'All Websites',
            limit: (criteria.limit as any) || 50,
          });
        }}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        selectedLeads={exportSelectedLeads}
        onClose={() => setIsExportModalOpen(false)}
        onShowToast={addToast}
      />

      {/* Command Palette (Cmd + K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => {
          setActiveTab(tab);
          setIsCommandPaletteOpen(false);
        }}
        onSelectLead={(lead) => {
          setSelectedLead(lead);
          setIsCommandPaletteOpen(false);
        }}
        onOpenFindLeadsModal={() => {
          setIsCommandPaletteOpen(false);
          setIsFindLeadsModalOpen(true);
        }}
        onOpenQuickAudit={() => {
          setIsCommandPaletteOpen(false);
          setIsQuickAuditModalOpen(true);
        }}
        onOpenExportModal={() => {
          setIsCommandPaletteOpen(false);
          setIsExportModalOpen(true);
        }}
        leads={leads}
      />

      {/* Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </div>
  );
}
