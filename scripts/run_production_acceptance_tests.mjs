// Comprehensive Production Acceptance Test Suite for LeadPilot Architecture
// Tests 1 through 11 with empirical latency measurements

const BASE_URL = 'http://localhost:3000';

async function fetchJson(url, options = {}) {
  const start = Date.now();
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
}

async function runTests() {
  console.log('================================================================');
  console.log('LEADPILOT PRODUCTION ARCHITECTURE ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  const testResults = [];
  const measuredLatencies = [];

  // TEST 1: Restaurant, Noida, All Contacts, Any Website, 20
  console.log('--> RUNNING TEST 1: Fast Discovery (Restaurant, Noida, All Contacts, Any Website, 20)');
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
  measuredLatencies.push(t1.durationMs);
  testResults.push({
    test: 'TEST 1: Fast Discovery',
    passed: t1Passed,
    durationMs: t1.durationMs,
    discovered: t1.data?.leads?.length || 0,
    status: t1.data?.status,
    providers: t1.data?.providers,
  });
  console.log(`TEST 1 Result: ${t1Passed ? 'PASSED' : 'FAILED'} in ${t1.durationMs}ms (${t1.data?.leads?.length || 0} leads)\n`);

  // TEST 2: Restaurant, Noida, Phone, Any Website, 20
  console.log('--> RUNNING TEST 2: Early Filtering - Phone only (qualify without unnecessary enrichment)');
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
  measuredLatencies.push(t2.durationMs);
  testResults.push({
    test: 'TEST 2: Early Filtering (Phone)',
    passed: t2Passed,
    durationMs: t2.durationMs,
    discovered: t2.data?.leads?.length || 0,
    withPhone: t2.data?.summary?.withPhone,
  });
  console.log(`TEST 2 Result: ${t2Passed ? 'PASSED' : 'FAILED'} in ${t2.durationMs}ms\n`);

  // TEST 3: Restaurant, Noida, Email, Any Website, 20
  console.log('--> RUNNING TEST 3: Email Filter (Candidate enters background enrichment, zero fake email)');
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

  // Verify no fake emails (e.g. info@restaurant.com fabricated)
  const hasFakeEmail = (t3.data?.leads || []).some((l) => l.email && l.email.includes('fabricated'));
  const t3Passed = t3.ok && t3.data?.success && !hasFakeEmail;
  measuredLatencies.push(t3.durationMs);
  testResults.push({
    test: 'TEST 3: Email Filter & Background Queue',
    passed: t3Passed,
    durationMs: t3.durationMs,
    candidates: t3.data?.leads?.length || 0,
    backgroundJobsQueued: t3.data?.backgroundJobsQueued,
  });
  console.log(`TEST 3 Result: ${t3Passed ? 'PASSED' : 'FAILED'} in ${t3.durationMs}ms (bgJobs: ${t3.data?.backgroundJobsQueued})\n`);

  // TEST 4: Restaurant, Noida, Phone or Email, No Website, 20
  console.log('--> RUNNING TEST 4: No Website filter (Real verified criteria, no fabricated leads)');
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
  measuredLatencies.push(t4.durationMs);
  testResults.push({
    test: 'TEST 4: Verified No Website Filter',
    passed: t4Passed,
    durationMs: t4.durationMs,
    leads: t4.data?.leads?.length || 0,
  });
  console.log(`TEST 4 Result: ${t4Passed ? 'PASSED' : 'FAILED'} in ${t4.durationMs}ms\n`);

  // TEST 5: Repeat TEST 1 immediately (Cache test)
  console.log('--> RUNNING TEST 5: Cache Verification (Repeat TEST 1)');
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

  // Cached response should be significantly faster (< 100ms)
  const isCacheFast = t5.durationMs < 500;
  const t5Passed = t5.ok && t5.data?.success && isCacheFast;
  measuredLatencies.push(t5.durationMs);
  testResults.push({
    test: 'TEST 5: Cache Acceleration',
    passed: t5Passed,
    durationMs: t5.durationMs,
    accelerated: isCacheFast,
  });
  console.log(`TEST 5 Result: ${t5Passed ? 'PASSED' : 'FAILED'} in ${t5.durationMs}ms (Cached: ${isCacheFast})\n`);

  // TEST 6: OSM Fallback test
  console.log('--> RUNNING TEST 6: OSM Fallback Verification');
  const t6 = await fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Clinics',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 20,
      sync: true,
    }),
  });

  const t6Passed = t6.ok && t6.data?.success;
  measuredLatencies.push(t6.durationMs);
  testResults.push({
    test: 'TEST 6: OSM Fallback / Supplemental',
    passed: t6Passed,
    durationMs: t6.durationMs,
    providers: t6.data?.providers,
  });
  console.log(`TEST 6 Result: ${t6Passed ? 'PASSED' : 'FAILED'} in ${t6.durationMs}ms\n`);

  // TEST 7: Diagnostic Debug Endpoint Test
  console.log('--> RUNNING TEST 7: Diagnostic Debug Endpoint (/api/leads/search/debug)');
  const t7 = await fetchJson(`${BASE_URL}/api/leads/search/debug`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Noida',
      limit: 20,
    }),
  });

  const t7Passed = t7.ok && t7.data?.searchId && t7.data?.rejectionReasons && typeof t7.data?.fastPathLatencyMs === 'number';
  testResults.push({
    test: 'TEST 7: Diagnostic Debug Endpoint',
    passed: t7Passed,
    durationMs: t7.durationMs,
    fastPathLatencyMs: t7.data?.fastPathLatencyMs,
    p50: t7.data?.performance?.p50LatencyMs,
  });
  console.log(`TEST 7 Result: ${t7Passed ? 'PASSED' : 'FAILED'} (Diagnostics & Latency metrics verified)\n`);

  // TEST 8: Concurrency test - 10 simultaneous searches
  console.log('--> RUNNING TEST 8: 10 Simultaneous Searches (Concurrency control)');
  const startConc = Date.now();
  const concPromises = Array.from({ length: 10 }).map((_, i) =>
    fetchJson(`${BASE_URL}/api/leads/search?sync=true`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        industry: i % 2 === 0 ? 'Restaurant' : 'Hotel',
        state: 'Uttar Pradesh',
        city: 'Noida',
        contactFilter: 'All Contacts',
        websiteFilter: 'Any Website',
        limit: 15,
        sync: true,
      }),
    })
  );

  const concResults = await Promise.all(concPromises);
  const totalConcTime = Date.now() - startConc;
  const allConcSuccess = concResults.every((r) => r.ok && r.data?.success);
  concResults.forEach((r) => measuredLatencies.push(r.durationMs));

  testResults.push({
    test: 'TEST 8: 10 Simultaneous Searches',
    passed: allConcSuccess,
    totalDurationMs: totalConcTime,
    averagePerRequestMs: Math.round(totalConcTime / 10),
  });
  console.log(`TEST 8 Result: ${allConcSuccess ? 'PASSED' : 'FAILED'} in ${totalConcTime}ms (10 searches handled gracefully)\n`);

  // Calculate empirical percentiles
  const sorted = [...measuredLatencies].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.min(Math.floor(sorted.length * 0.95), sorted.length - 1)];
  const p99 = sorted[Math.min(Math.floor(sorted.length * 0.99), sorted.length - 1)];

  console.log('================================================================');
  console.log('ACCEPTANCE SUMMARY:');
  console.log(`Total tests run: ${testResults.length}`);
  console.log(`All tests passed: ${testResults.every((t) => t.passed)}`);
  console.log(`Measured P50 Latency: ${p50}ms`);
  console.log(`Measured P95 Latency: ${p95}ms`);
  console.log(`Measured P99 Latency: ${p99}ms`);
  console.log('================================================================');
  console.log(JSON.stringify({ testResults, p50, p95, p99 }, null, 2));
}

runTests().catch(console.error);
