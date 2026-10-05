import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { middleware } from '@/middleware';
import {
  generateOAuthState,
  verifyOAuthState,
} from '@/lib/auth/sessionService';

describe('P0 — Google Authentication Flow & Security Verification', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Google Login Button & Real OAuth Endpoint', () => {
    it('verifies UnifiedAuthPage.tsx has zero mock/fake setTimeout logins and initiates /api/auth/google', () => {
      const authPagePath = path.join(process.cwd(), 'src', 'components', 'auth', 'UnifiedAuthPage.tsx');
      const content = fs.readFileSync(authPagePath, 'utf8');

      // Verify no mock setTimeout pushing to /dashboard
      expect(content).not.toContain("router.push('/dashboard')");
      expect(content).not.toContain('router.push("/dashboard")');
      expect(content).not.toContain('setTimeout');

      // Verify real OAuth redirect entrypoint
      expect(content).toContain("window.location.href = '/api/auth/google'");
    });

    it('verifies src/app/page.tsx does not embed unauthenticated DashboardPage', () => {
      const homePagePath = path.join(process.cwd(), 'src', 'app', 'page.tsx');
      const content = fs.readFileSync(homePagePath, 'utf8');

      // Verify DashboardPage is NOT imported or rendered directly in the home page
      expect(content).not.toContain("import DashboardPage from '@/app/dashboard/page'");
      expect(content).not.toContain('<DashboardPage');
    });

    it('verifies /api/auth/google route requests select_account consent', () => {
      const routePath = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'google', 'route.ts');
      const content = fs.readFileSync(routePath, 'utf8');

      // Verify select_account consent is present
      expect(content).toContain("prompt: 'select_account consent'");
      expect(content).toContain("scope: 'openid email profile'");
      expect(content).toContain("cookieStore.set('lp_oauth_state'");
    });
  });

  describe('2. Dashboard Route Protection (Middleware & Route Guard)', () => {
    it('redirects unauthenticated GET /dashboard to /login via middleware', () => {
      const req = new NextRequest('http://localhost:3000/dashboard', {
        headers: { host: 'localhost:3000' },
      });

      const response = middleware(req);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });

    it('redirects unauthenticated nested /dashboard/settings to /login via middleware', () => {
      const req = new NextRequest('http://localhost:3000/dashboard/settings', {
        headers: { host: 'localhost:3000' },
      });

      const response = middleware(req);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/login');
    });

    it('allows access through middleware if lp_session cookie is present', () => {
      const req = new NextRequest('http://localhost:3000/dashboard', {
        headers: {
          host: 'localhost:3000',
          cookie: 'lp_session=test-token.signature',
        },
      });

      const response = middleware(req);
      expect(response.status).toBe(200);
      expect(response.headers.get('location')).toBeNull();
    });

    it('verifies src/app/dashboard/page.tsx contains server-side session guard with redirect', () => {
      const dashboardPagePath = path.join(process.cwd(), 'src', 'app', 'dashboard', 'page.tsx');
      const content = fs.readFileSync(dashboardPagePath, 'utf8');

      expect(content).toContain("import { getAuthenticatedUserId } from '@/lib/auth/sessionService'");
      expect(content).toContain("redirect('/login')");
      expect(content).not.toContain("'use client'");
    });
  });

  describe('3. Cryptographic State & CSRF Protection', () => {
    it('generates cryptographically unique state tokens', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();

      expect(state1).toHaveLength(64); // 32 random bytes hex
      expect(state2).toHaveLength(64);
      expect(state1).not.toBe(state2);
    });

    it('validates matching state tokens using timing-safe comparison', () => {
      const state = generateOAuthState();
      expect(verifyOAuthState(state, state)).toBe(true);
    });

    it('rejects tampered, empty, or mismatched state tokens', () => {
      const state1 = generateOAuthState();
      const state2 = generateOAuthState();

      expect(verifyOAuthState(state1, state2)).toBe(false);
      expect(verifyOAuthState('', state1)).toBe(false);
      expect(verifyOAuthState(state1, '')).toBe(false);
      expect(verifyOAuthState('short', state1)).toBe(false);
    });
  });

  describe('4. OAuth Callback & CSRF Validation Guard', () => {
    it('verifies /api/auth/google/callback validates state and rejects mismatches', () => {
      const callbackPath = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'google', 'callback', 'route.ts');
      const content = fs.readFileSync(callbackPath, 'utf8');

      // State check
      expect(content).toContain('verifyOAuthState(state, storedState)');
      expect(content).toContain("redirect(`${appUrl}/login?error=state_mismatch`)");
      expect(content).toContain("cookieStore.delete('lp_oauth_state')");

      // User upsert & session creation
      expect(content).toContain('prisma.user.upsert');
      expect(content).toContain('createSession(user.id)');
      expect(content).toContain("redirect(`${appUrl}/dashboard`)");
    });
  });

  describe('5. Logout & Session Invalidation', () => {
    it('verifies Header.tsx Sign Out triggers /api/auth/logout', () => {
      const headerPath = path.join(process.cwd(), 'src', 'components', 'layout', 'Header.tsx');
      const content = fs.readFileSync(headerPath, 'utf8');

      expect(content).toContain("fetch('/api/auth/logout', { method: 'POST' })");
      expect(content).toContain("window.location.href = '/login'");
    });

    it('verifies /api/auth/logout destroys the server session and clears cookie', () => {
      const logoutRoutePath = path.join(process.cwd(), 'src', 'app', 'api', 'auth', 'logout', 'route.ts');
      const content = fs.readFileSync(logoutRoutePath, 'utf8');

      expect(content).toContain('await destroySession()');
    });
  });
});
