import { TargetPlan } from '../providers/types';
import { INDIAN_STATES_AND_UTS } from '../../data/indiaLocations';

/**
 * Target Planner Actor
 * Converts natural language search queries into structured lead generation criteria.
 */
export class TargetPlanner {
  parseNaturalLanguageTarget(query: string): TargetPlan {
    const raw = (query || '').trim();
    const lower = raw.toLowerCase();

    // 1. Identify Indian State & City
    let detectedState = 'Uttar Pradesh';
    let detectedCity: string | undefined = undefined;

    for (const stateObj of INDIAN_STATES_AND_UTS) {
      if (lower.includes(stateObj.name.toLowerCase())) {
        detectedState = stateObj.name;
        break;
      }
      for (const city of stateObj.cities) {
        if (lower.includes(city.toLowerCase())) {
          detectedState = stateObj.name;
          detectedCity = city;
          break;
        }
      }
      if (detectedCity) break;
    }

    // Common NCR alias checks
    if (lower.includes('greater noida')) {
      detectedCity = 'Greater Noida';
      detectedState = 'Uttar Pradesh';
    } else if (lower.includes('noida')) {
      detectedCity = 'Noida';
      detectedState = 'Uttar Pradesh';
    } else if (lower.includes('gurgaon') || lower.includes('gurugram')) {
      detectedCity = 'Gurugram';
      detectedState = 'Haryana';
    } else if (lower.includes('bangalore') || lower.includes('bengaluru')) {
      detectedCity = 'Bengaluru';
      detectedState = 'Karnataka';
    }

    // 2. Identify Industry Category
    let detectedIndustry = 'Restaurants';
    const industryKeywords: Record<string, string> = {
      dental: 'Clinics',
      dentist: 'Clinics',
      clinic: 'Clinics',
      hospital: 'Hospitals',
      restaurant: 'Restaurants',
      cafe: 'Cafes',
      hotel: 'Hotels',
      gym: 'Gyms',
      fitness: 'Gyms',
      salon: 'Salons',
      spa: 'Salons',
      school: 'Education',
      college: 'Education',
      supermarket: 'Retail',
      retail: 'Retail',
      realestate: 'Real Estate',
      'real estate': 'Real Estate',
      builder: 'Construction',
      automotive: 'Automotive',
      car: 'Automotive',
      manufacturing: 'Manufacturing',
      factory: 'Manufacturing',
      manufacturer: 'Manufacturing',
      wholesale: 'Wholesale',
      wholesaler: 'Wholesale',
      lawyer: 'Legal Services',
      'law firm': 'Legal Services',
      legal: 'Legal Services',
      accounting: 'Accounting',
      accountant: 'Accounting',
      'ca firm': 'Accounting',
      software: 'IT Services',
      'it company': 'IT Services',
      technology: 'IT Services',
      marketing: 'Marketing',
      'travel agency': 'Travel Agencies',
      travel: 'Travel Agencies',
      repair: 'Repair Services',
    };

    for (const [kw, ind] of Object.entries(industryKeywords)) {
      if (lower.includes(kw)) {
        detectedIndustry = ind;
        break;
      }
    }

    // 3. Website requirement
    let websiteRequirement: 'ANY' | 'NO_WEBSITE' | 'NEEDS_IMPROVEMENT' | 'WORKING' = 'ANY';
    if (lower.includes('no website') || lower.includes('without website') || lower.includes('missing website')) {
      websiteRequirement = 'NO_WEBSITE';
    } else if (lower.includes('redesign') || lower.includes('slow') || lower.includes('poor website') || lower.includes('needs improvement')) {
      websiteRequirement = 'NEEDS_IMPROVEMENT';
    }

    // 4. Contact requirement
    let contactRequirement: 'ANY' | 'PHONE_OR_EMAIL' | 'BOTH' | 'EMAIL_ONLY' | 'PHONE_ONLY' = 'ANY';
    if (lower.includes('email and phone') || lower.includes('both contact')) {
      contactRequirement = 'BOTH';
    } else if (lower.includes('with email') || lower.includes('email only')) {
      contactRequirement = 'EMAIL_ONLY';
    } else if (lower.includes('with phone') || lower.includes('phone only')) {
      contactRequirement = 'PHONE_ONLY';
    } else if (lower.includes('contactable') || lower.includes('phone or email')) {
      contactRequirement = 'PHONE_OR_EMAIL';
    }

    // 5. Target services
    const targetServices: string[] = [];
    if (lower.includes('redesign') || lower.includes('website')) targetServices.push('Website Modernization');
    if (lower.includes('seo') || lower.includes('search engine')) targetServices.push('Local SEO');
    if (lower.includes('social') || lower.includes('instagram') || lower.includes('facebook')) targetServices.push('Social Media Marketing');
    if (lower.includes('booking') || lower.includes('reservation')) targetServices.push('Online Booking System');
    if (targetServices.length === 0) targetServices.push('Digital Presence Enhancement');

    return {
      industry: detectedIndustry,
      location: {
        state: detectedState,
        city: detectedCity,
        country: 'India',
      },
      contactRequirement,
      websiteRequirement,
      minOpportunityScore: 60,
      targetServices,
      rawQuery: query,
    };
  }
}

export const targetPlanner = new TargetPlanner();
