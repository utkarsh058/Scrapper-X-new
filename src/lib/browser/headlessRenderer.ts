import fs from 'fs';
import puppeteer from 'puppeteer-core';
import { validateUrlForSsrf } from '@/lib/security/ssrfProtection';
import * as cheerio from 'cheerio';

export type RenderMode =
  | 'HTTP_ONLY'
  | 'JS_FALLBACK_TRIGGERED'
  | 'JS_RENDER_SUCCESS'
  | 'JS_RENDER_TIMEOUT'
  | 'JS_RENDER_FAILED';

export interface RenderResult {
  success: boolean;
  html: string | null;
  status: RenderMode;
  durationMs: number;
  error?: string;
}

/**
 * Searches for a usable Google Chrome or Chromium executable on the host system.
 */
export function findSystemBrowserExecutable(): string | undefined {
  const candidatePaths = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : undefined,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ].filter(Boolean) as string[];

  return candidatePaths.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

/**
 * Detects whether the initial HTML returned by an HTTP fetch is likely a client-side
 * single-page application (SPA) where critical content requires JavaScript hydration.
 */
export function isLikelyClientSideSpa(html: string, $: cheerio.CheerioAPI): boolean {
  if (!html) return false;

  // 1. Root app containers that are empty or have minimal content
  const rootAppSelectors = ['#root', '#app', '#__next', '#___gatsby', 'app-root', '#svelte', '#app-mount', '#main-app'];
  let hasEmptyRootContainer = false;
  for (const sel of rootAppSelectors) {
    const el = $(sel);
    if (el.length > 0) {
      const text = el.text().trim();
      if (text.length < 100) {
        hasEmptyRootContainer = true;
        break;
      }
    }
  }

  // 2. Explicit noscript notices ("You need to enable JavaScript to run this app")
  const hasNoScriptWarning = /<noscript[^>]*>[\s\S]*?(?:enable javascript|javascript is required|javascript to run this app)[\s\S]*?<\/noscript>/i.test(html);

  // 3. JavaScript bundle-heavy scripts (React, Vue, Angular, Vite, Webpack, Next.js)
  const scriptTags = $('script[src]');
  const hasAppBundle = scriptTags.toArray().some((el) => {
    const src = $(el).attr('src') || '';
    return (
      /(?:main|app|bundle|vendor|runtime|chunk|client)[._-][a-zA-Z0-9._-]+\.js/i.test(src) ||
      /\/static\/js\//i.test(src) ||
      /\/_next\/static\//i.test(src) ||
      /\/assets\//i.test(src) ||
      /vite\/client/i.test(src)
    );
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const bodyTextLength = bodyText.length;
  const hasH1 = $('h1').length > 0;
  const hasCta = $('a[href^="tel:"], a[href^="mailto:"], button, form').length > 0;

  // SPA Rule 1: Root container with minimal text + script bundle or noscript
  if (hasEmptyRootContainer && (hasAppBundle || hasNoScriptWarning)) return true;

  // SPA Rule 2: noscript warning with very small body
  if (hasNoScriptWarning && bodyTextLength < 250) return true;

  // SPA Rule 3: Very small body text (< 120 chars) + bundle scripts + missing H1
  if (bodyTextLength < 120 && hasAppBundle && !hasH1) return true;

  // SPA Rule 4: Empty root container + no H1 + small body (< 300 chars)
  if (hasEmptyRootContainer && !hasH1 && bodyTextLength < 300) return true;

  // SPA Rule 5: Empty root container + no H1 + missing CTA
  if (hasEmptyRootContainer && !hasH1 && !hasCta) return true;

  return false;
}

export interface HeadlessRenderOptions {
  timeoutMs?: number;
  executablePath?: string;
  allowLocalForTesting?: boolean;
}

/**
 * Renders a URL in a tightly bounded headless browser session.
 * Aborts images, fonts, media, and stylesheets for speed.
 * Enforces SSRF protection before navigation and on subrequests.
 */
export async function renderPageWithHeadlessBrowser(
  targetUrl: string,
  options: HeadlessRenderOptions = {}
): Promise<RenderResult> {
  const startTime = Date.now();
  const timeoutMs = options.timeoutMs || 4500;

  let sanitizedUrl = targetUrl;

  // 1. Strict SSRF check before browser navigation (unless local testing explicitly authorized)
  if (!options.allowLocalForTesting) {
    const ssrfCheck = await validateUrlForSsrf(targetUrl);
    if (!ssrfCheck.valid || !ssrfCheck.sanitizedUrl) {
      return {
        success: false,
        html: null,
        status: 'JS_RENDER_FAILED',
        durationMs: Date.now() - startTime,
        error: `SSRF Security Block: ${ssrfCheck.reason || 'Restricted destination'}`,
      };
    }
    sanitizedUrl = ssrfCheck.sanitizedUrl;
  }
  const executablePath = options.executablePath || findSystemBrowserExecutable();

  if (!executablePath) {
    return {
      success: false,
      html: null,
      status: 'JS_RENDER_FAILED',
      durationMs: Date.now() - startTime,
      error: 'No Chrome/Chromium executable available on system',
    };
  }

  let browser: any = null;
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    const launchPromise = async (): Promise<RenderResult> => {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-extensions',
          '--blink-settings=imagesEnabled=false',
        ],
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (compatible; LeadPilotHeadlessBot/2.0; +https://leadpilot.io/bot)');

      // Intercept and abort heavy assets + private subrequests
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const resType = req.resourceType();
        if (['image', 'media', 'font', 'stylesheet'].includes(resType)) {
          req.abort().catch(() => {});
          return;
        }

        const reqUrl = req.url().toLowerCase();
        if (
          !options.allowLocalForTesting &&
          (reqUrl.includes('localhost') ||
            reqUrl.includes('127.0.0.1') ||
            reqUrl.includes('169.254.') ||
            reqUrl.includes('0.0.0.0'))
        ) {
          req.abort().catch(() => {});
          return;
        }

        req.continue().catch(() => {});
      });

      // Navigate with bounded timeout
      await page.goto(sanitizedUrl, {
        waitUntil: 'domcontentloaded',
        timeout: Math.min(timeoutMs, 4000),
      });

      // Bounded wait for client-side hydration
      await page
        .waitForFunction(
          () => {
            const hasH1 = document.querySelector('h1');
            const root = document.getElementById('root') || document.getElementById('app') || document.getElementById('__next');
            const hasRootChildren = root && root.childNodes.length > 0 && root.textContent && root.textContent.trim().length > 10;
            return Boolean(hasH1 || hasRootChildren);
          },
          { timeout: 800 }
        )
        .catch(() => {});

      const renderedHtml = await page.content();
      const durationMs = Date.now() - startTime;

      return {
        success: true,
        html: renderedHtml,
        status: 'JS_RENDER_SUCCESS',
        durationMs,
      };
    };

    const timeoutPromise = new Promise<RenderResult>((resolve) => {
      timeoutHandle = setTimeout(() => {
        resolve({
          success: false,
          html: null,
          status: 'JS_RENDER_TIMEOUT',
          durationMs: Date.now() - startTime,
          error: `Rendering timed out after ${timeoutMs}ms`,
        });
      }, timeoutMs);
    });

    const result = await Promise.race([launchPromise(), timeoutPromise]);
    if (timeoutHandle) clearTimeout(timeoutHandle);
    return result;
  } catch (err: any) {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    const durationMs = Date.now() - startTime;
    const isTimeout = err.name === 'TimeoutError' || (err.message && err.message.toLowerCase().includes('timeout'));

    return {
      success: false,
      html: null,
      status: isTimeout ? 'JS_RENDER_TIMEOUT' : 'JS_RENDER_FAILED',
      durationMs,
      error: err.message || 'Headless rendering encountered an error',
    };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
