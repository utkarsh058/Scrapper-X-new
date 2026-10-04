/**
 * Provider Diagnostics Service
 * 
 * Strict Single Responsibility:
 * System startup & runtime configuration diagnostics for external providers and database.
 * 
 * Boundary Constraints:
 * - NEVER prints or logs raw API keys or database connection strings.
 * - Explicitly reports CONFIGURED vs NOT_CONFIGURED.
 * - Never claims a service is working when unconfigured.
 */

import { googlePlacesProvider } from '@/providers/google/GooglePlacesProvider';
import { osmOverpassProvider } from '@/providers/OSMOverpassProvider';
import { businessRepository } from '@/services/persistence/BusinessRepository';

export interface DiagnosticsReport {
  googlePlaces: {
    status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'DISABLED';
    enabled: boolean;
    hasKey: boolean;
    providerName: string;
    details: string;
  };
  database: {
    status: 'CONFIGURED' | 'NOT_CONFIGURED';
    connected: boolean;
    details: string;
  };
  openStreetMap: {
    status: 'AVAILABLE' | 'DISABLED';
    enabled: boolean;
    providerName: string;
  };
  socialIntelligence: {
    status: 'AVAILABLE';
    extractionEnabled: boolean;
    verificationEnabled: boolean;
  };
  socialProviders: {
    youtube: { status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' };
    instagram: { status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' };
    facebook: { status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' };
    linkedin: { status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' };
    tiktok: { status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' };
    x: { status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' };
    instagramOfficialApi: { status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' };
    instagramPublicWeb: { status: 'AVAILABLE' | 'NOT_AVAILABLE' | 'BLOCKED' };
    facebookOfficialApi: { status: 'CONFIGURED' | 'NOT_CONFIGURED' | 'ERROR' };
    facebookPublicWeb: { status: 'AVAILABLE' | 'NOT_AVAILABLE' | 'BLOCKED' };
  };
  environment: string;
  timestamp: string;
}

import { youTubeProvider } from '@/providers/social/YouTubeProvider';
import { instagramProvider } from '@/providers/social/InstagramProvider';
import { facebookProvider } from '@/providers/social/FacebookProvider';
import { linkedInProvider } from '@/providers/social/LinkedInProvider';
import { tikTokProvider } from '@/providers/social/TikTokProvider';
import { xProvider } from '@/providers/social/XProvider';

export class ProviderDiagnosticsService {
  public async getDiagnostics(): Promise<DiagnosticsReport> {
    const googleConfigured = googlePlacesProvider.isConfigured();
    const googleEnabled = process.env.GOOGLE_PLACES_ENABLED !== 'false';

    let googleStatus: 'CONFIGURED' | 'NOT_CONFIGURED' | 'DISABLED' = 'NOT_CONFIGURED';
    if (!googleEnabled) {
      googleStatus = 'DISABLED';
    } else if (googleConfigured) {
      googleStatus = 'CONFIGURED';
    }

    const dbConfigured = businessRepository.isDatabaseConfigured();
    let dbConnected = false;
    let dbDetails = 'DATABASE_URL is not set in environment.';

    if (dbConfigured) {
      const conn = await businessRepository.checkConnection();
      dbConnected = conn.connected;
      dbDetails = conn.connected
        ? 'Connected to PostgreSQL via Prisma.'
        : `Connection failed: ${conn.error}`;
    }

    const osmEnabled = process.env.OSM_ENABLED !== 'false';

    return {
      googlePlaces: {
        status: googleStatus,
        enabled: googleEnabled,
        hasKey: googleConfigured,
        providerName: googlePlacesProvider.name,
        details: googleConfigured
          ? 'Google Places API (New) key detected in server environment.'
          : 'Missing GOOGLE_PLACES_API_KEY or GOOGLE_MAPS_API_KEY in server environment.',
      },
      database: {
        status: dbConfigured ? 'CONFIGURED' : 'NOT_CONFIGURED',
        connected: dbConnected,
        details: dbDetails,
      },
      openStreetMap: {
        status: osmEnabled ? 'AVAILABLE' : 'DISABLED',
        enabled: osmEnabled,
        providerName: osmOverpassProvider.name,
      },
      socialIntelligence: {
        status: 'AVAILABLE',
        extractionEnabled: true,
        verificationEnabled: true,
      },
      socialProviders: {
        youtube: { status: youTubeProvider.getStatus() },
        instagram: { status: instagramProvider.getStatus() },
        facebook: { status: facebookProvider.getStatus() },
        linkedin: { status: linkedInProvider.getStatus() },
        tiktok: { status: tikTokProvider.getStatus() },
        x: { status: xProvider.getStatus() },
        instagramOfficialApi: { status: instagramProvider.getStatus() },
        instagramPublicWeb: { status: 'AVAILABLE' },
        facebookOfficialApi: { status: facebookProvider.getStatus() },
        facebookPublicWeb: { status: 'AVAILABLE' },
      },
      environment: process.env.NODE_ENV || 'development',
      timestamp: new Date().toISOString(),
    };
  }
}

export const providerDiagnosticsService = new ProviderDiagnosticsService();
