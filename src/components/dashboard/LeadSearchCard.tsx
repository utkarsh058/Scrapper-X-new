'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building, 
  MapPin, 
  Mail, 
  Globe, 
  Layers, 
  ArrowRight, 
  Loader2, 
  Check, 
  ChevronDown,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { ContactFilter, WebsiteFilter, NumberOfLeads } from '@/types';
import { INDIAN_STATES_AND_UTS, getCitiesForState } from '@/data/indiaLocations';
import { getCitiesForCanadianProvince } from '@/data/canadaLocations';
import { USA_REGIONS, CANADA_REGIONS, INDIA_REGIONS } from '@/lib/location/RegionRegistry';

export interface LeadFilterCriteria {
  country: 'India' | 'United States' | 'Canada' | string;
  countryCode?: 'IN' | 'US' | 'CA';
  state: string;
  city: string;
  industry: string;
  contact: ContactFilter;
  website: WebsiteFilter;
  limit: NumberOfLeads;
  excludePerfectRating?: boolean;
}

interface LeadSearchCardProps {
  initialCriteria?: Partial<LeadFilterCriteria>;
  isSearchingExternal?: boolean;
  liveProgressLog?: { actorId: string; stepName: string; message: string; count?: number; timestamp: string }[];
  onSearchStart?: () => void;
  onSearchSubmit?: (criteria: LeadFilterCriteria) => void;
  onViewLeads?: () => void;
}

export const LeadSearchCard: React.FC<LeadSearchCardProps> = ({
  initialCriteria,
  isSearchingExternal = false,
  liveProgressLog = [],
  onSearchStart,
  onSearchSubmit,
  onViewLeads,
}) => {
  // 1. COUNTRY SELECTION: US, CA, IN
  const [selectedCountry, setSelectedCountry] = useState<'United States' | 'Canada' | 'India'>(
    (initialCriteria?.country as any) || 'India'
  );

  // 2. INDUSTRY: Predefined or Custom
  const [selectedIndustry, setSelectedIndustry] = useState(initialCriteria?.industry || 'Restaurants');
  const [isCustomIndustry, setIsCustomIndustry] = useState(false);
  const [customIndustryText, setCustomIndustryText] = useState('');

  // 3. REGION (State / Province / Territory) & CITY
  const [selectedState, setSelectedState] = useState(
    initialCriteria?.state || (selectedCountry === 'United States' ? 'California' : selectedCountry === 'Canada' ? 'Ontario' : 'Uttar Pradesh')
  );
  const [selectedCity, setSelectedCity] = useState(
    initialCriteria?.city || (selectedCountry === 'United States' ? 'Los Angeles' : selectedCountry === 'Canada' ? 'Toronto' : 'Noida')
  );
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [customCityText, setCustomCityText] = useState('');

  // When Country changes
  const handleCountryChange = (newCountry: 'United States' | 'Canada' | 'India') => {
    setSelectedCountry(newCountry);
    setIsCustomCity(false);
    setCustomCityText('');
    if (newCountry === 'United States') {
      setSelectedState('California');
      setSelectedCity('Los Angeles');
    } else if (newCountry === 'Canada') {
      setSelectedState('Ontario');
      setSelectedCity('Toronto');
    } else {
      setSelectedState('Uttar Pradesh');
      setSelectedCity('Noida');
    }
  };

  // 4. CONTACT: Dropdown
  const [contact, setContact] = useState<ContactFilter>(initialCriteria?.contact || 'All Contacts');

  // 5. WEBSITE: Dropdown
  const [website, setWebsite] = useState<WebsiteFilter>(initialCriteria?.website || 'All Websites');

  // 6. RESULTS LIMIT: Dropdown
  const [limit, setLimit] = useState<NumberOfLeads>(initialCriteria?.limit || 100);

  // 7. 5-STAR EXCLUSION TOGGLE (Section 14 & 35 requirement)
  const [excludePerfectRating, setExcludePerfectRating] = useState<boolean>(
    initialCriteria?.excludePerfectRating !== undefined ? initialCriteria.excludePerfectRating : true
  );

  // Background automated multi-step crawler progress
  const [jobState, setJobState] = useState<'idle' | 'running' | 'completed'>('idle');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Available cities for the selected region
  const availableCities = selectedCountry === 'India' 
    ? getCitiesForState(selectedState)
    : selectedCountry === 'Canada'
    ? getCitiesForCanadianProvince(selectedState)
    : selectedCountry === 'United States'
    ? selectedState === 'California' ? ['Los Angeles', 'San Francisco', 'San Diego', 'San Jose', 'Sacramento']
    : selectedState === 'New York' ? ['New York City', 'Buffalo', 'Rochester', 'Albany', 'Syracuse']
    : selectedState === 'Texas' ? ['Houston', 'Dallas', 'Austin', 'San Antonio', 'Fort Worth']
    : selectedState === 'Florida' ? ['Miami', 'Orlando', 'Tampa', 'Jacksonville', 'Fort Lauderdale']
    : selectedState === 'Illinois' ? ['Chicago', 'Springfield', 'Naperville', 'Peoria', 'Rockford']
    : []
    : [];

  const handleStateChange = (newState: string) => {
    setSelectedState(newState);
    setIsCustomCity(false);
    setCustomCityText('');
    if (selectedCountry === 'India') {
      const cities = getCitiesForState(newState);
      if (cities.length > 0) {
        setSelectedCity(cities[0]);
      } else {
        setSelectedCity('All cities in this state');
      }
    } else if (selectedCountry === 'Canada') {
      const cities = getCitiesForCanadianProvince(newState);
      if (cities.length > 0) {
        setSelectedCity(cities[0]);
      } else {
        setSelectedCity('All cities in this province');
      }
    } else {
      setSelectedCity('');
    }
  };

  const activeIndustry = isCustomIndustry && customIndustryText.trim()
    ? customIndustryText.trim()
    : selectedIndustry;

  const activeCity = isCustomCity && customCityText.trim()
    ? customCityText.trim()
    : selectedCity;

  const steps = [
    { 
      label: `Finding businesses in ${activeCity ? `${activeCity}, ` : ''}${selectedState}, ${selectedCountry}...`, 
      desc: 'Querying Google Places & verified registries' 
    },
    { 
      label: 'Fetching real business details...', 
      desc: 'Extracting verified phone numbers, emails & addresses' 
    },
    { 
      label: 'Checking available websites...', 
      desc: 'Testing DNS, SSL certificates & HTTP reachability' 
    },
    { 
      label: 'Analyzing website status & mobile UX...', 
      desc: 'Auditing viewport tags, forms, CTA & conversion links' 
    },
    { 
      label: 'Preparing your leads...', 
      desc: `Returning verified results up to ${limit}` 
    },
  ];

  const popularIndustries = [
    'Restaurants',
    'Hotels',
    'Cafes',
    'Gyms',
    'Salons',
    'Hospitals',
    'Clinics',
    'Real Estate',
    'Education',
    'Retail',
    'Automotive',
    'Travel',
    'Construction',
    'Other',
  ];

  const contactOptions: { value: ContactFilter; label: string }[] = [
    { value: 'All Contacts', label: 'All Contacts' },
    { value: 'Has Phone or Email', label: 'Phone or Email (At least one)' },
    { value: 'Email + Phone', label: 'Email + Phone (Both)' },
    { value: 'Email Only', label: 'Email Only' },
    { value: 'Phone Only', label: 'Phone Only' },
    { value: 'No Contact', label: 'No Contact' },
  ];

  const websiteOptions: { value: WebsiteFilter; label: string }[] = [
    { value: 'Any Website', label: 'Any Website' },
    { value: 'Website Available', label: 'Website Available' },
    { value: 'Needs Improvement', label: 'Needs Improvement' },
    { value: 'Working', label: 'Working' },
    { value: 'No Website', label: 'No Website' },
    { value: 'Unreachable', label: 'Unreachable' },
  ];

  const limitOptions: NumberOfLeads[] = [25, 50, 100, 250, 500];

  const isSearching = jobState === 'running' || isSearchingExternal;

  const handleStartSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSearching) return;

    setJobState('running');
    setCurrentStepIndex(0);
    if (onSearchStart) {
      onSearchStart();
    }

    const countryCode: 'US' | 'CA' | 'IN' = 
      selectedCountry === 'United States' ? 'US' : 
      selectedCountry === 'Canada' ? 'CA' : 'IN';

    const criteria: LeadFilterCriteria = {
      country: selectedCountry,
      countryCode,
      state: selectedState,
      city: activeCity === 'All cities in this state' || activeCity === 'All cities in this province' ? '' : activeCity,
      industry: activeIndustry,
      contact,
      website,
      limit,
      excludePerfectRating,
    };

    // Simulated progress steps for real discovery fetch & website inspection
    setTimeout(() => setCurrentStepIndex(1), 500);
    setTimeout(() => setCurrentStepIndex(2), 1100);
    setTimeout(() => setCurrentStepIndex(3), 1800);
    setTimeout(() => setCurrentStepIndex(4), 2500);
    setTimeout(() => {
      setJobState('completed');
      if (onSearchSubmit) {
        onSearchSubmit(criteria);
      }
      if (onViewLeads) {
        onViewLeads();
      }
    }, 2900);
  };

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white p-5 sm:p-6 shadow-xs select-none">
      {/* Top Header */}
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F1F5F9] pb-4">
        <div>
          <h2 className="text-[17px] font-bold text-[#0F172A] tracking-tight flex items-center gap-2">
            <span>Find Leads</span>
            <span className="text-[11px] font-semibold text-teal-800 bg-teal-50 border border-teal-200/80 px-2 py-0.5 rounded-md">
              USA • Canada • India Multi-Country
            </span>
          </h2>
          <p className="text-[12.5px] text-[#64748B] mt-0.5">
            Discover real businesses across the United States, Canada, and India via Google Places and verified registries. Audits websites and extracts authenticated social metrics.
          </p>
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-lg">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          <span>Google Places • Real Data</span>
        </div>
      </div>

      {/* Main Search Configuration Form */}
      <form onSubmit={handleStartSearch} className="space-y-4">
        {/* Row 1: Location & Industry */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {/* 1. COUNTRY */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              Country
            </label>
            <div className="relative">
              <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
              <select
                value={selectedCountry}
                onChange={(e) => handleCountryChange(e.target.value as any)}
                disabled={isSearching}
                className="w-full h-11 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-8 text-[12.5px] font-medium text-[#0F172A] focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none transition-all cursor-pointer appearance-none shadow-2xs hover:border-[#94A3B8] disabled:bg-[#F8FAFC]"
              >
                <option value="United States">United States (USA)</option>
                <option value="Canada">Canada</option>
                <option value="India">India</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>

          {/* 2. STATE / PROVINCE */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              {selectedCountry === 'United States' ? 'State (50 States + DC)' : selectedCountry === 'Canada' ? 'Province / Territory' : 'State / UT (India)'}
            </label>
            <div className="relative">
              <Compass className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
              <select
                value={selectedState}
                onChange={(e) => handleStateChange(e.target.value)}
                disabled={isSearching}
                className="w-full h-11 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-8 text-[12.5px] font-medium text-[#0F172A] focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none transition-all cursor-pointer appearance-none shadow-2xs hover:border-[#94A3B8] disabled:bg-[#F8FAFC]"
              >
                {selectedCountry === 'United States' && USA_REGIONS.map((r) => (
                  <option key={r.code} value={r.name}>
                    {r.name} ({r.code})
                  </option>
                ))}
                {selectedCountry === 'Canada' && (
                  <>
                    <optgroup label="Provinces">
                      {CANADA_REGIONS.filter(r => r.regionType === 'PROVINCE').map((r) => (
                        <option key={r.code} value={r.name}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Territories">
                      {CANADA_REGIONS.filter(r => r.regionType === 'TERRITORY').map((r) => (
                        <option key={r.code} value={r.name}>
                          {r.name} ({r.code})
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
                {selectedCountry === 'India' && (
                  <>
                    <optgroup label="States">
                      {INDIAN_STATES_AND_UTS.filter(s => s.type === 'State').map((s) => (
                        <option key={s.name} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Union Territories">
                      {INDIAN_STATES_AND_UTS.filter(s => s.type === 'Union Territory').map((ut) => (
                        <option key={ut.name} value={ut.name}>
                          {ut.name}
                        </option>
                      ))}
                    </optgroup>
                  </>
                )}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>

          {/* 3. CITY */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              City / Metro
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
              {availableCities.length > 0 ? (
                <select
                  value={isCustomCity ? '__custom_city__' : selectedCity}
                  onChange={(e) => {
                    if (e.target.value === '__custom_city__') {
                      setIsCustomCity(true);
                    } else {
                      setIsCustomCity(false);
                      setSelectedCity(e.target.value);
                    }
                  }}
                  disabled={isSearching}
                  className="w-full h-11 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-8 text-[12.5px] font-medium text-[#0F172A] focus:border-[#0F172A] focus:outline-none cursor-pointer appearance-none shadow-2xs hover:border-[#94A3B8] disabled:bg-[#F8FAFC]"
                >
                  <option value="">All cities in {selectedState}</option>
                  {availableCities.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value="__custom_city__" className="font-semibold text-teal-700">
                    + Type Custom City...
                  </option>
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="e.g. Los Angeles, Toronto..."
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  disabled={isSearching}
                  className="w-full h-11 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-3 text-[12.5px] font-medium text-[#0F172A] focus:border-[#0F172A] focus:outline-none shadow-2xs hover:border-[#94A3B8] disabled:bg-[#F8FAFC]"
                />
              )}
              {availableCities.length > 0 && (
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8] pointer-events-none" />
              )}
            </div>

            {availableCities.length > 0 && isCustomCity && (
              <div className="pt-1">
                <input
                  type="text"
                  placeholder="Type city or locality name..."
                  value={customCityText}
                  onChange={(e) => setCustomCityText(e.target.value)}
                  disabled={isSearching}
                  className="w-full h-9 rounded-lg border border-teal-500 bg-teal-50/30 px-3 text-[12px] font-medium text-[#0F172A] focus:outline-none"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* 4. INDUSTRY */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              Industry
            </label>
            <div className="relative">
              <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
              <select
                value={isCustomIndustry ? '__custom__' : selectedIndustry}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomIndustry(true);
                  } else {
                    setIsCustomIndustry(false);
                    setSelectedIndustry(e.target.value);
                  }
                }}
                disabled={isSearching}
                className="w-full h-11 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-8 text-[12.5px] font-medium text-[#0F172A] focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none transition-all cursor-pointer appearance-none shadow-2xs hover:border-[#94A3B8] disabled:bg-[#F8FAFC]"
              >
                {popularIndustries.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
                <option value="__custom__" className="font-semibold text-teal-700">
                  + Custom Industry...
                </option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8] pointer-events-none" />
            </div>

            {isCustomIndustry && (
              <div className="pt-1">
                <input
                  type="text"
                  placeholder="e.g. Wedding photographers, Architects..."
                  value={customIndustryText}
                  onChange={(e) => setCustomIndustryText(e.target.value)}
                  disabled={isSearching}
                  className="w-full h-9 rounded-lg border border-teal-500 bg-teal-50/30 px-3 text-[12px] font-medium text-[#0F172A] focus:outline-none focus:ring-1 focus:ring-teal-600"
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* 5. RESULTS LIMIT */}
          <div className="space-y-1.5">
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              Results Limit
            </label>
            <div className="relative">
              <Layers className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] pointer-events-none" />
              <select
                value={limit}
                onChange={(e) => setLimit(Number(e.target.value) as NumberOfLeads)}
                disabled={isSearching}
                className="w-full h-11 min-h-[44px] rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-8 text-[12.5px] font-medium text-[#0F172A] focus:border-[#0F172A] focus:ring-1 focus:ring-[#0F172A] focus:outline-none transition-all cursor-pointer appearance-none shadow-2xs hover:border-[#94A3B8] disabled:bg-[#F8FAFC]"
              >
                {limitOptions.map((num) => (
                  <option key={num} value={num}>
                    {num} leads
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Row 2: Secondary Filters & 5-Star Rule */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-1">
          {/* Contact Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              Contact Filter
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8] pointer-events-none" />
              <select
                value={contact}
                onChange={(e) => setContact(e.target.value as ContactFilter)}
                disabled={isSearching}
                className="w-full h-9 rounded-lg border border-[#CBD5E1] bg-white pl-8 pr-7 text-[12px] font-medium text-[#0F172A] focus:border-[#0F172A] focus:outline-none cursor-pointer appearance-none shadow-2xs"
              >
                {contactOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>

          {/* Website Filter */}
          <div className="space-y-1">
            <label className="block text-[11px] font-bold text-[#475569] uppercase tracking-wider">
              Website Filter
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#94A3B8] pointer-events-none" />
              <select
                value={website}
                onChange={(e) => setWebsite(e.target.value as WebsiteFilter)}
                disabled={isSearching}
                className="w-full h-9 rounded-lg border border-[#CBD5E1] bg-white pl-8 pr-7 text-[12px] font-medium text-[#0F172A] focus:border-[#0F172A] focus:outline-none cursor-pointer appearance-none shadow-2xs"
              >
                {websiteOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-[#94A3B8] pointer-events-none" />
            </div>
          </div>

          {/* 5-Star Rating Exclusion Toggle */}
          <div className="flex items-end pb-0.5">
            <label className="inline-flex items-center gap-2 cursor-pointer select-none text-[12px] text-[#334155] font-medium bg-[#F8FAFC] border border-[#CBD5E1] px-3 h-9 rounded-lg hover:border-[#94A3B8] transition-colors w-full">
              <input
                type="checkbox"
                checked={excludePerfectRating}
                onChange={(e) => setExcludePerfectRating(e.target.checked)}
                disabled={isSearching}
                className="rounded text-teal-700 focus:ring-teal-700 h-4 w-4 border-slate-300"
              />
              <span className="truncate">Exclude 5.0★ (Prioritize realistic ratings)</span>
            </label>
          </div>
        </div>

        {/* Primary Action Button Row */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-[#F1F5F9]">
          <div className="text-[12px] text-[#64748B] flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-teal-500 shrink-0" />
            <span>
              Targeting: <strong className="text-[#0F172A]">{activeIndustry}</strong> in{' '}
              <strong className="text-[#0F172A]">
                {activeCity ? `${activeCity}, ` : ''}{selectedState}, {selectedCountry}
              </strong>{' '}
              • Limit: <strong className="text-[#0F172A]">{limit}</strong>
              {excludePerfectRating && (
                <span className="ml-1 text-emerald-700 font-semibold">• Exclude 5★</span>
              )}
            </span>
          </div>

          <button
            type="submit"
            disabled={isSearching}
            className="inline-flex items-center justify-center gap-2 h-11 min-h-[44px] px-6 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-[13px] font-semibold transition-all shadow-xs disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer btn-pressable self-end sm:self-auto w-full sm:w-auto"
          >
            {isSearching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-teal-400" />
                <span>Searching Google Places...</span>
              </>
            ) : (
              <>
                <span>Find Leads</span>
                <ArrowRight className="h-4 w-4 text-teal-400" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* Progress State Feedback (Real-World Actor Engine Observability) */}
      {isSearching && (
        <div className="mt-4 p-4 rounded-xl border border-teal-200/80 bg-teal-50/50 animate-fade-in space-y-2.5">
          <div className="flex items-center justify-between text-[12.5px]">
            <span className="font-semibold text-[#0F172A] flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-700" />
              <span>
                {liveProgressLog.length > 0
                  ? liveProgressLog[liveProgressLog.length - 1].message
                  : steps[currentStepIndex].label}
              </span>
            </span>
            <span className="text-[11.5px] text-teal-800 font-semibold">
              {liveProgressLog.length > 0
                ? `${liveProgressLog.length} Engine Steps Completed`
                : `Step ${currentStepIndex + 1} of 5`}
            </span>
          </div>

          {liveProgressLog.length > 0 ? (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
              {liveProgressLog.slice(-5).map((log, idx) => (
                <div
                  key={`${log.timestamp}-${idx}`}
                  className="flex items-center justify-between text-[11.5px] p-2 rounded-lg bg-white border border-teal-200 shadow-2xs"
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-3 w-3 text-teal-600 shrink-0" />
                    <span className="font-medium text-[#0F172A]">{log.message}</span>
                  </div>
                  {log.count !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-bold">
                      {log.count} records
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11.5px]">
              {steps.map((st, idx) => {
                const isPast = idx < currentStepIndex;
                const isCurrent = idx === currentStepIndex;

                return (
                  <div
                    key={st.label}
                    className={`p-2 rounded-lg border transition-all ${
                      isPast
                        ? 'bg-white border-teal-300 text-teal-900 font-medium'
                        : isCurrent
                        ? 'bg-teal-100/70 border-teal-400 text-teal-950 font-bold ring-1 ring-teal-400/50'
                        : 'bg-white/60 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      {isPast ? (
                        <Check className="h-3 w-3 text-teal-700" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-teal-600" />
                      )}
                      <span className="truncate text-[11px]">{st.label.replace('...', '')}</span>
                    </div>
                    <p className="text-[10px] text-[#64748B] mt-0.5 truncate">{st.desc}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
