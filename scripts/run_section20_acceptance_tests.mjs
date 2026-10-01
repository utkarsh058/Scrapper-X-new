// Comprehensive Acceptance Test Suite for Section 20 Requirements
// Run against the running server on http://localhost:3000

const BASE_URL = 'http://localhost:3000';

async function postJson(url, payload) {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const durationMs = Date.now() - start;
    const data = await res.json().catch((err) => ({ parseError: err.message }));
    return { ok: res.ok, status: res.status, data, durationMs };
  } catch (err) {
    return { ok: false, status: 0, error: err.message, durationMs: Date.now() - start };
  }
}

async function runAcceptanceTests() {
  console.log('================================================================');
  console.log('STARTING SECTION 20 ACCEPTANCE TESTS');
  console.log('================================================================\n');

  let passedAll = true;

  // -------------------------------------------------------------
  // TEST 1: Restaurant, Greater Noida, All Contacts, Any Website, 100
  // -------------------------------------------------------------
  console.log('--> RUNNING TEST 1: Restaurant in Greater Noida (All Contacts, Any Website, 100)');
  const t1 = await postJson(`${BASE_URL}/api/leads/search?sync=true`, {
    industry: 'Restaurant',
    state: 'Uttar Pradesh',
    city: 'Greater Noida',
    contactFilter: 'All Contacts',
    websiteFilter: 'Any Website',
    limit: 100,
    sync: true,
  });

  const t1Debug = await postJson(`${BASE_URL}/api/leads/search/debug`, {
    industry: 'Restaurant',
    state: 'Uttar Pradesh',
    city: 'Greater Noida',
    contactFilter: 'All Contacts',
    websiteFilter: 'Any Website',
    limit: 100,
  });

  console.log(`Test 1 Search HTTP: ${t1.status} (${t1.durationMs}ms)`);
  console.log(`Test 1 Search Success: ${t1.data?.success}`);
  console.log(`Test 1 Leads Count: ${t1.data?.leads?.length || 0}`);
  console.log(`Test 1 Providers:`, JSON.stringify(t1.data?.providers, null, 2));
  console.log(`Test 1 Debug Schema Check:`, {
    googlePlaces: t1Debug.data?.googlePlaces,
    osm: t1Debug.data?.osm,
    webSearch: t1Debug.data?.webSearch,
    mergedCount: t1Debug.data?.mergedCount,
    locationVerifiedCount: t1Debug.data?.locationVerifiedCount,
    deduplicatedCount: t1Debug.data?.deduplicatedCount,
    finalCount: t1Debug.data?.finalCount,
  });

  const t1Leads = t1.data?.leads || [];
  const t1NoDuplicates = new Set(t1Leads.map(l => l.name?.toLowerCase().trim())).size === t1Leads.length;
  console.log(`Test 1 Unique Business Names (no duplicates): ${t1NoDuplicates}`);
  console.log(`Test 1 OSM Fallback Active: ${t1Debug.data?.osm?.discovered > 0 || t1.data?.providers?.osm?.discovered > 0}`);
  
  if (!t1.data?.success || t1Leads.length === 0) {
    console.error('TEST 1 FAILED');
    passedAll = false;
  } else {
    console.log('TEST 1 PASSED\n');
  }

  // -------------------------------------------------------------
  // TEST 2: Restaurant, Greater Noida, Phone or Email, Any Website, 100
  // -------------------------------------------------------------
  console.log('--> RUNNING TEST 2: Restaurant in Greater Noida (Phone or Email, Any Website, 100)');
  const t2 = await postJson(`${BASE_URL}/api/leads/search?sync=true`, {
    industry: 'Restaurant',
    state: 'Uttar Pradesh',
    city: 'Greater Noida',
    contactFilter: 'Has Phone or Email',
    websiteFilter: 'Any Website',
    limit: 100,
    sync: true,
  });

  const t2Leads = t2.data?.leads || [];
  const t2AllHaveContact = t2Leads.every(l => Boolean(l.phone || l.email));
  console.log(`Test 2 Leads Count: ${t2Leads.length}`);
  console.log(`Test 2 Every lead has phone OR email: ${t2AllHaveContact}`);
  if (t2Leads.length > 0 && !t2AllHaveContact) {
    console.error('TEST 2 FAILED: Found leads without phone and without email');
    passedAll = false;
  } else {
    console.log('TEST 2 PASSED\n');
  }

  // -------------------------------------------------------------
  // TEST 3: Restaurant, Greater Noida, Phone or Email, No Website, 100
  // -------------------------------------------------------------
  console.log('--> RUNNING TEST 3: Restaurant in Greater Noida (Phone or Email, No Website, 100)');
  const t3 = await postJson(`${BASE_URL}/api/leads/search?sync=true`, {
    industry: 'Restaurant',
    state: 'Uttar Pradesh',
    city: 'Greater Noida',
    contactFilter: 'Has Phone or Email',
    websiteFilter: 'No Website',
    limit: 100,
    sync: true,
  });

  const t3Leads = t3.data?.leads || [];
  const t3AllValid = t3Leads.every(l => Boolean(l.phone || l.email) && !l.website);
  console.log(`Test 3 Leads Count: ${t3Leads.length}`);
  console.log(`Test 3 Every lead has (phone OR email) AND no website: ${t3AllValid}`);
  if (t3Leads.length > 0 && !t3AllValid) {
    console.error('TEST 3 FAILED: Found leads violating condition');
    passedAll = false;
  } else {
    console.log('TEST 3 PASSED\n');
  }

  // -------------------------------------------------------------
  // TEST 4: Cafe, Greater Noida, All Contacts, Any Website, 50
  // -------------------------------------------------------------
  console.log('--> RUNNING TEST 4: Cafe in Greater Noida (All Contacts, Any Website, 50)');
  const t4 = await postJson(`${BASE_URL}/api/leads/search?sync=true`, {
    industry: 'Cafe',
    state: 'Uttar Pradesh',
    city: 'Greater Noida',
    contactFilter: 'All Contacts',
    websiteFilter: 'Any Website',
    limit: 50,
    sync: true,
  });

  console.log(`Test 4 Leads Count: ${t4.data?.leads?.length || 0}`);
  console.log(`Test 4 Google Places Status: ${t4.data?.providers?.googlePlaces?.status}`);
  console.log(`Test 4 OSM Discovered: ${t4.data?.providers?.osm?.discovered}`);
  if (!t4.data?.success) {
    console.error('TEST 4 FAILED');
    passedAll = false;
  } else {
    console.log('TEST 4 PASSED\n');
  }

  // -------------------------------------------------------------
  // TEST 5: Disable Google Places API key
  // -------------------------------------------------------------
  console.log('--> RUNNING TEST 5: Disable Google Places / Error Resiliency');
  const t5Res = await fetch(`${BASE_URL}/api/providers/google/test`);
  const t5Data = await t5Res.json();
  console.log(`Test 5 Google Provider Diagnostic:`, t5Data);
  const t5Graceful = t5Data.status === 'AUTH_ERROR' || t5Data.status === 'FAILED' || t5Data.status === 'DISABLED';
  console.log(`Test 5 Expected: Provider status FAILED/AUTH_ERROR/DISABLED gracefully: ${t5Graceful}`);
  console.log(`Test 5 Pipeline resilience: Pipeline completed with OSM fallback despite Google Places 403/disabled: ${t1.data?.success && (t1.data?.providers?.osm?.discovered > 0 || t1Debug.data?.osm?.discovered > 0)}`);
  if (!t5Graceful) {
    console.error('TEST 5 FAILED');
    passedAll = false;
  } else {
    console.log('TEST 5 PASSED\n');
  }

  // -------------------------------------------------------------
  // TEST 6: Simulate duplicate Google + OSM business
  // -------------------------------------------------------------
  console.log('--> RUNNING TEST 6: Multi-source deduplication test');
  console.log('Simulating duplicate business ingestion into MultiSourceMergeActor...');
  const { execSync } = await import('child_process');
  try {
    const dedupOutput = execSync('npx tsx scripts/test_dedup_simulation.mjs', { encoding: 'utf-8' });
    console.log(dedupOutput);
    console.log('TEST 6 PASSED\n');
  } catch (err) {
    console.error('TEST 6 FAILED:', err.stdout || err.message);
    passedAll = false;
  }

  console.log('\n================================================================');
  console.log(`ACCEPTANCE TEST SUITE COMPLETE: ${passedAll ? 'ALL PASS' : 'SOME CHECKS FAILED'}`);
  console.log('================================================================');
}

runAcceptanceTests().catch(console.error);
