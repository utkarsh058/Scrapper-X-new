'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { TrustSection } from '@/components/landing/TrustSection';
import { ProductPreviewSection } from '@/components/landing/ProductPreviewSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { HowItWorksSection } from '@/components/landing/HowItWorksSection';
import { AIOutreachSection } from '@/components/landing/AIOutreachSection';
import { WebsiteDemoSection } from '@/components/landing/WebsiteDemoSection';
import { FinalCTASection } from '@/components/landing/FinalCTASection';
import { Footer } from '@/components/landing/Footer';
import { DemoModal } from '@/components/landing/DemoModal';
import DashboardPage from '@/app/dashboard/page';
import { UnifiedAuthPage } from '@/components/auth/UnifiedAuthPage';
import { LayoutDashboard, Home, UserCheck, ArrowLeft, Sparkles } from 'lucide-react';

export default function CombinedApp() {
  const [activeView, setActiveView] = useState<'landing' | 'dashboard' | 'auth'>('landing');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin');
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const [selectedDemoBusiness, setSelectedDemoBusiness] = useState('Saffron & Spice Bistro');

  // Listen for query params on load or popstate
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const mode = params.get('mode');

      if (view === 'dashboard') {
        setActiveView('dashboard');
      } else if (view === 'auth' || view === 'login' || view === 'signup') {
        setActiveView('auth');
        if (mode === 'signup' || view === 'signup') setAuthMode('signup');
        else setAuthMode('signin');
      }
    }
  }, []);

  const handleNavigate = (view: 'landing' | 'dashboard' | 'auth', mode: 'signin' | 'signup' = 'signin') => {
    setActiveView(view);
    if (view === 'auth') {
      setAuthMode(mode);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenDemo = (businessName: string) => {
    setSelectedDemoBusiness(businessName);
    setIsDemoModalOpen(true);
  };

  return (
    <div className="relative min-h-screen bg-white">
      {/* ========================================================================= */}
      {/* 🚀 FLOATING UNIFIED SWITCHER BAR (Always available for 1-click toggling)  */}
      {/* ========================================================================= */}
      <aside 
        aria-label="Application View Switcher" 
        className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-1 sm:gap-2 p-1.5 rounded-full bg-slate-950/90 hover:bg-slate-950 text-white backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.35)] border border-slate-700/80 transition-all select-none animate-fade-in"
      >
        <button
          onClick={() => handleNavigate('landing')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeView === 'landing'
              ? 'bg-white text-slate-950 shadow-md scale-100'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <Home className="w-3.5 h-3.5" />
          <span>Landing Page</span>
        </button>

        <button
          onClick={() => handleNavigate('dashboard')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeView === 'dashboard'
              ? 'bg-teal-400 text-slate-950 shadow-md font-bold scale-100'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5 text-teal-600" />
          <span>Dashboard</span>
        </button>

        <button
          onClick={() => handleNavigate('auth', 'signin')}
          className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
            activeView === 'auth'
              ? 'bg-white text-slate-950 shadow-md scale-100'
              : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Sign In / Sign Up</span>
        </button>
      </aside>

      {/* ========================================================================= */}
      {/* 1. DASHBOARD VIEW (Rendered directly in-page)                             */}
      {/* ========================================================================= */}
      {activeView === 'dashboard' && (
        <div className="min-h-screen bg-[#F8FAFC]">
          {/* Quick Header Bar to return to Landing */}
          <div className="bg-slate-900 text-white px-4 py-2.5 flex items-center justify-between text-xs sm:text-sm font-medium border-b border-slate-800">
            <button
              onClick={() => handleNavigate('landing')}
              className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-teal-400" />
              <span>← Back to Landing Page</span>
            </button>
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="hidden sm:inline">Active Session: LeadPilot All-in-One</span>
            </div>
          </div>

          <DashboardPage />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. AUTH VIEW (Sign In / Sign Up in-page)                                  */}
      {/* ========================================================================= */}
      {activeView === 'auth' && (
        <div className="min-h-screen bg-[#F8F9FA] relative">
          <UnifiedAuthPage
            initialMode={authMode}
            onClose={() => handleNavigate('landing')}
            onSuccess={() => handleNavigate('dashboard')}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. LANDING PAGE VIEW (Default)                                            */}
      {/* ========================================================================= */}
      {activeView === 'landing' && (
        <div className="min-h-screen bg-white text-slate-900 selection:bg-teal-50 selection:text-teal-900">
          {/* 1. Floating Top Navigation */}
          <Navbar onNavigate={handleNavigate} />

          {/* 2. Main Page Content */}
          <main>
            {/* Hero Section with Interactive 5-Step Workflow Visualizer */}
            <HeroSection />

            {/* Category Trust Bar */}
            <TrustSection />

            {/* Interactive Product Preview (Search: Industry, Location, Leads & Opportunities) */}
            <ProductPreviewSection onPreviewDemo={handleOpenDemo} />

            {/* Problem Section: 01 No Website, 02 Weak Website, 03 Missed Opportunity */}
            <ProblemSection />

            {/* Core Product Capabilities (5 Focused Features) */}
            <FeaturesSection />

            {/* How It Works: 4 Clean Steps */}
            <HowItWorksSection />

            {/* AI Outreach: Contextual Outreach Generation */}
            <AIOutreachSection />

            {/* Website Demo Section: Interactive Client Prototypes */}
            <WebsiteDemoSection onPreviewDemo={handleOpenDemo} />

            {/* Final Conversion CTA Section */}
            <FinalCTASection />
          </main>

          {/* 3. Minimal Footer */}
          <Footer />

          {/* Interactive Prototype Lightbox Modal */}
          <DemoModal
            isOpen={isDemoModalOpen}
            businessName={selectedDemoBusiness}
            onClose={() => setIsDemoModalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
