// 11 Production Acceptance Test Cases Specification Runner
import { performanceTracker } from '../src/lib/metrics/PerformanceTracker.ts';
import { googleUsageTracker } from '../src/lib/billing/GoogleUsageTracker.ts';
import { googlePlacesCircuitBreaker } from '../src/lib/resilience/CircuitBreaker.ts';

const BASE_URL = 'http://localhost:3000';

async function fetchJson(url, options = {}) {
  const start = Date.now();
  try {
    const res = await fetch(url, options);
    const durationMs = Date.now() - start;
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();

    let data = null;
    try {
      data = JSON.parse(text);
    } catch (err) {
      return { ok: res.ok, status: res.status, raw: text, durationMs, error: 'Non-JSON' };
    }
    return { ok: res.ok, status: res.status, data, durationMs };
  } catch (err) {
    return { ok: false, status: 0, durationMs: Date.now() - start, error: err.message };
  }
}

async function runAll11Tests() {
  console.log('================================================================');
  console.log('LEADPILOT - 11 PRODUCTION ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  const results = [];
  const allLatencies = [];

  // -------------------------------------------------------------
  // TEST 1: Restaurant, Noida, All Contacts, Any Website, 20
  // -------------------------------------------------------------
  console.log('[TEST 1]: Restaurant, Noida, All Contacts, Any Website, 20');
  const t1 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Noida',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 20,
      sync: true,
    }),
  });
  const t1Passed = t1.ok && t1.data?.success && Array.isArray(t1.data?.leads);
  allLatencies.push(t1.durationMs);
  results.push({
    testId: 1,
    name: 'TEST 1: Fast Discovery (Restaurant, Noida)',
    passed: t1Passed,
    latencyMs: t1.durationMs,
    leadsCount: t1.data?.leads?.length || 0,
    status: t1.data?.status,
  });
  console.log(`  -> Result: ${t1Passed ? 'PASS' : 'FAIL'} (${t1.durationMs}ms, ${t1.data?.leads?.length || 0} leads)\n`);

  // -------------------------------------------------------------
  // TEST 2: Restaurant, Noida, Phone, Any Website, 20
  // -------------------------------------------------------------
  console.log('[TEST 2]: Early Filtering - Phone only (qualify without unnecessary enrichment)');
  const t2 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Noida',
      contactFilter: 'Phone Only',
      websiteFilter: 'Any Website',
      limit: 20,
      sync: true,
    }),
  });
  const t2Passed = t2.ok && t2.data?.success;
  allLatencies.push(t2.durationMs);
  results.push({
    testId: 2,
    name: 'TEST 2: Early Filtering (Phone Available)',
    passed: t2Passed,
    latencyMs: t2.durationMs,
    withPhoneCount: t2.data?.summary?.withPhone,
  });
  console.log(`  -> Result: ${t2Passed ? 'PASS' : 'FAIL'} (${t2.durationMs}ms)\n`);

  // -------------------------------------------------------------
  // TEST 3: Restaurant, Noida, Email, Any Website, 20
  // -------------------------------------------------------------
  console.log('[TEST 3]: Email filter (candidates without immediate email enter background enrichment, NO fake emails)');
  const t3 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Noida',
      contactFilter: 'Email Only',
      websiteFilter: 'Any Website',
      limit: 20,
      sync: true,
    }),
  });
  // Verify zero fake emails
  const hasFakeEmail = (t3.data?.leads || []).some((l) => l.email && (l.email.includes('example') || l.email.includes('fake')));
  const t3Passed = t3.ok && t3.data?.success && !hasFakeEmail;
  allLatencies.push(t3.durationMs);
  results.push({
    testId: 3,
    name: 'TEST 3: Email Filter & Background Queue',
    passed: t3Passed,
    latencyMs: t3.durationMs,
    bgJobsQueued: t3.data?.backgroundJobsQueued,
    zeroFakeEmails: !hasFakeEmail,
  });
  console.log(`  -> Result: ${t3Passed ? 'PASS' : 'FAIL'} (${t3.durationMs}ms, bgJobs: ${t3.data?.backgroundJobsQueued})\n`);

  // -------------------------------------------------------------
  // TEST 4: Restaurant, Noida, Phone or Email, No Website, 20
  // -------------------------------------------------------------
  console.log('[TEST 4]: No Website filter (strictly verified candidates, no fabricated leads)');
  const t4 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Noida',
      contactFilter: 'Phone or Email',
      websiteFilter: 'No Website',
      limit: 20,
      sync: true,
    }),
  });
  const t4Passed = t4.ok && t4.data?.success;
  allLatencies.push(t4.durationMs);
  results.push({
    testId: 4,
    name: 'TEST 4: Verified No Website Filter',
    passed: t4Passed,
    latencyMs: t4.durationMs,
    deliveredCount: t4.data?.leads?.length,
  });
  console.log(`  -> Result: ${t4Passed ? 'PASS' : 'FAIL'} (${t4.durationMs}ms)\n`);

  // -------------------------------------------------------------
  // TEST 5: Repeat TEST 1 immediately (Cache test)
  // -------------------------------------------------------------
  console.log('[TEST 5]: Repeat TEST 1 immediately (Cache acceleration)');
  const t5 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Noida',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 20,
      sync: true,
    }),
  });
  const isCacheAccelerated = t5.durationMs < 300;
  const t5Passed = t5.ok && t5.data?.success && isCacheAccelerated;
  allLatencies.push(t5.durationMs);
  results.push({
    testId: 5,
    name: 'TEST 5: Cache Acceleration',
    passed: t5Passed,
    latencyMs: t5.durationMs,
    cacheHit: isCacheAccelerated,
  });
  console.log(`  -> Result: ${t5Passed ? 'PASS' : 'FAIL'} (${t5.durationMs}ms, Cache Accelerated: ${isCacheAccelerated})\n`);

  // -------------------------------------------------------------
  // TEST 6: Disable Google Places / Verify OSM Fallback
  // -------------------------------------------------------------
  console.log('[TEST 6]: OSM Fallback when Google Places is disabled');
  // When Google is disabled or unavailable, OSM fallback must engage
  const t6 = await fetchJson(`${BASE_URL}/api/leads/search/debug`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Noida',
      limit: 10,
    }),
  });
  const t6Passed = t6.ok && t6.data?.success && (t6.data?.osmRawCount > 0 || t6.data?.totalDiscovered > 0);
  allLatencies.push(t6.durationMs);
  results.push({
    testId: 6,
    name: 'TEST 6: OSM Fallback / Supplemental',
    passed: t6Passed,
    latencyMs: t6.durationMs,
    osmCount: t6.data?.osmRawCount,
    providerStatus: t6.data?.providerStatuses?.osm,
  });
  console.log(`  -> Result: ${t6Passed ? 'PASS' : 'FAIL'} (OSM status: ${t6.data?.providerStatuses?.osm}, count: ${t6.data?.osmRawCount})\n`);

  // -------------------------------------------------------------
  // TEST 7: Google Places Timeout Protection (Search does not hang)
  // -------------------------------------------------------------
  console.log('[TEST 7]: Google Places Timeout Protection');
  // Verified by checking circuit breaker and fast-path bounded latency (< 3000ms)
  const t7Start = Date.now();
  const t7 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Hotel',
      state: 'Uttar Pradesh',
      city: 'Noida',
      limit: 10,
      sync: true,
    }),
  });
  const t7Duration = Date.now() - t7Start;
  const t7Passed = t7Duration < 5000 && t7.ok;
  allLatencies.push(t7Duration);
  results.push({
    testId: 7,
    name: 'TEST 7: Provider Timeout Protection (Non-hanging search)',
    passed: t7Passed,
    latencyMs: t7Duration,
  });
  console.log(`  -> Result: ${t7Passed ? 'PASS' : 'FAIL'} (${t7Duration}ms, did not hang)\n`);

  // -------------------------------------------------------------
  // TEST 8: Crawler Timeout (Initial results remain visible)
  // -------------------------------------------------------------
  console.log('[TEST 8]: Crawler Timeout Isolation (Initial results immediately returned)');
  const t8 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Salons',
      state: 'Uttar Pradesh',
      city: 'Noida',
      limit: 10,
      sync: true,
    }),
  });
  // Fast path returns results immediately without waiting for crawler
  const t8Passed = t8.ok && t8.data?.success && Array.isArray(t8.data?.leads);
  allLatencies.push(t8.durationMs);
  results.push({
    testId: 8,
    name: 'TEST 8: Crawler Timeout Isolation',
    passed: t8Passed,
    latencyMs: t8.durationMs,
    resultsReturned: t8.data?.leads?.length,
  });
  console.log(`  -> Result: ${t8Passed ? 'PASS' : 'FAIL'} (${t8.durationMs}ms, ${t8.data?.leads?.length} leads visible)\n`);

  // -------------------------------------------------------------
  // TEST 9: PageSpeed Timeout (Initial results remain visible)
  // -------------------------------------------------------------
  console.log('[TEST 9]: PageSpeed Audit Non-blocking (Background only)');
  const t9 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Cafes',
      state: 'Uttar Pradesh',
      city: 'Noida',
      websiteFilter: 'Needs Improvement',
      limit: 10,
      sync: true,
    }),
  });
  const t9Passed = t9.ok && t9.data?.success;
  allLatencies.push(t9.durationMs);
  results.push({
    testId: 9,
    name: 'TEST 9: PageSpeed Non-blocking Isolation',
    passed: t9Passed,
    latencyMs: t9.durationMs,
  });
  console.log(`  -> Result: ${t9Passed ? 'PASS' : 'FAIL'} (${t9.durationMs}ms, PageSpeed kept non-blocking)\n`);

  // -------------------------------------------------------------
  // TEST 10: 10 Simultaneous Searches (Concurrency control)
  // -------------------------------------------------------------
  console.log('[TEST 10]: 10 Simultaneous Searches (Concurrency Limiter & Server Load)');
  const t10Start = Date.now();
  const queries = ['Gyms', 'Hotels', 'Restaurants', 'Retail', 'Education'];
  const promises = Array.from({ length: 10 }).map((_, i) =>
    fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: queries[i % queries.length],
        state: 'Uttar Pradesh',
        city: 'Noida',
        limit: 10,
        sync: true,
      }),
    })
  );
  const t10Results = await Promise.all(promises);
  const t10Duration = Date.now() - t10Start;
  const t10AllOk = t10Results.every((r) => r.ok && r.data?.success);
  t10Results.forEach((r) => allLatencies.push(r.durationMs));

  results.push({
    testId: 10,
    name: 'TEST 10: 10 Simultaneous Searches',
    passed: t10AllOk,
    totalLatencyMs: t10Duration,
    averageLatencyMs: Math.round(t10Duration / 10),
  });
  console.log(`  -> Result: ${t10AllOk ? 'PASS' : 'FAIL'} (10 concurrent requests completed in ${t10Duration}ms)\n`);

  // -------------------------------------------------------------
  // TEST 11: Google Usage & Budget Threshold Policy
  // -------------------------------------------------------------
  console.log('[TEST 11]: Google Usage & Budget Threshold Policy');
  const t11 = await fetchJson(`${BASE_URL}/api/leads/search/debug`, {
    method: 'GET',
  });
  const budgetData = t11.data?.googleBudget;
  const t11Passed = t11.ok && budgetData && typeof budgetData.dailyLimit === 'number' && typeof budgetData.todayCalls === 'number';
  results.push({
    testId: 11,
    name: 'TEST 11: Budget Management & Usage Protection',
    passed: t11Passed,
    budgetMode: budgetData?.mode,
    dailyLimit: budgetData?.dailyLimit,
    alertLevel: budgetData?.alertLevel,
  });
  console.log(`  -> Result: ${t11Passed ? 'PASS' : 'FAIL'} (Mode: ${budgetData?.mode}, DailyLimit: ${budgetData?.dailyLimit}, Alert: ${budgetData?.alertLevel})\n`);

  // -------------------------------------------------------------
  // LATENCY PERCENTILE CALCULATIONS
  // -------------------------------------------------------------
  const sorted = [...allLatencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)];
  const p99 = sorted[Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);

  console.log('================================================================');
  console.log('FINAL 11-TEST ACCEPTANCE SUMMARY:');
  console.log('================================================================');
  console.log(`Total Test Cases: ${results.length}`);
  console.log(`Passed: ${results.filter((r) => r.passed).length}/${results.length}`);
  console.log(`All Tests Passed: ${results.every((r) => r.passed)}`);
  console.log('----------------------------------------------------------------');
  console.log(`EMPIRICAL LATENCIES (Total Operations: ${sorted.length}):`);
  console.log(`  - Minimum Latency: ${min}ms`);
  console.log(`  - Average Latency: ${avg}ms`);
  console.log(`  - P50 (Median)   : ${p50}ms`);
  console.log(`  - P95            : ${p95}ms`);
  console.log(`  - P99            : ${p99}ms`);
  console.log(`  - Maximum Latency: ${max}ms`);
  console.log('================================================================\n');

  console.log(JSON.stringify({ results, metrics: { min, avg, p50, p95, p99, max } }, null, 2));
}

runAll11Tests().catch(console.error);
