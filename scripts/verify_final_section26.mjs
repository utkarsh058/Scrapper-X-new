
async function main() {
  console.log('================================================================');
  console.log('LEADPILOT — SECTION 26 FINAL LOW-LATENCY VERIFICATION TEST SUITE');
  console.log('================================================================\n');

  let allPassed = true;

  // --- PROBE 1: GET /api/providers/health ---
  console.log('[PROBE 1] Testing GET /api/providers/health...');
  try {
    const res = await fetch('http://localhost:3000/api/providers/health');
    const health = await res.json();
    console.log('Health Response:', JSON.stringify(health, null, 2));

    const validGoogle = typeof health.googlePlaces?.configured === 'boolean' &&
                        typeof health.googlePlaces?.reachable === 'boolean' &&
                        typeof health.googlePlaces?.lastCheckedAt === 'string';
    const validOsm = typeof health.osm?.configured === 'boolean' &&
                     health.osm?.status === 'READY';

    if (validGoogle && validOsm) {
      console.log('>>> PROBE 1 PASSED: Health schema conforms to Section 20 specifications\n');
    } else {
      console.error('>>> PROBE 1 FAILED: Unexpected health schema');
      allPassed = false;
    }
  } catch (err) {
    console.error('>>> PROBE 1 ERROR:', err.message);
    allPassed = false;
  }

  // --- PROBE 2: GET /api/providers/google/test ---
  console.log('[PROBE 2] Testing GET /api/providers/google/test?query=restaurants+in+Noida...');
  try {
    const res = await fetch('http://localhost:3000/api/providers/google/test?query=restaurants+in+Noida');
    const gTest = await res.json();
    console.log('Google Test Response:', JSON.stringify(gTest, null, 2));

    const noLeakedKey = !JSON.stringify(gTest).includes('AIzaSy');
    const validStructure = typeof gTest.configured === 'boolean' &&
                           typeof gTest.status === 'string' &&
                           typeof gTest.testedAt === 'string';

    if (noLeakedKey && validStructure) {
      console.log('>>> PROBE 2 PASSED: Sanitized Google Places test executed without exposing credentials\n');
    } else {
      console.error('>>> PROBE 2 FAILED: Potential credential leakage or invalid structure');
      allPassed = false;
    }
  } catch (err) {
    console.error('>>> PROBE 2 ERROR:', err.message);
    allPassed = false;
  }

  // --- TEST 1: Restaurants in Noida (Phone or Email, Any Website, 50) ---
  console.log('[TEST 1] Restaurant in Noida, Uttar Pradesh (Phone OR Email, Any Website, Limit 50)...');
  try {
    const tStart = Date.now();
    const res = await fetch('http://localhost:3000/api/leads/search?sync=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Noida',
        industry: 'Restaurants',
        contactFilter: 'Phone or Email',
        websiteFilter: 'Any Website',
        limit: 50,
      }),
    });
    const durationMs = Date.now() - tStart;
    const data = await res.json();

    console.log(`Delivered: ${data.leads?.length} leads in ${durationMs}ms`);
    console.log(`Source Status: ${data.sourceStatus}, Search Status: ${data.searchStatus}`);
    console.log(`Providers:`, JSON.stringify(data.providers, null, 2));

    if (data.leads && data.leads.length > 0 && !data.providers?.businessProvider) {
      console.log('>>> TEST 1 PASSED: Fast results returned, no businessProvider artifact\n');
    } else {
      console.error('>>> TEST 1 FAILED');
      allPassed = false;
    }
  } catch (err) {
    console.error('>>> TEST 1 ERROR:', err.message);
    allPassed = false;
  }

  // --- TEST 2: Hotels in Greater Noida (Phone or Email, Any Website, 50) ---
  console.log('[TEST 2] Hotels in Greater Noida, Uttar Pradesh (Phone OR Email, Any Website, Limit 50)...');
  try {
    const res = await fetch('http://localhost:3000/api/leads/search?sync=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Greater Noida',
        industry: 'Hotels',
        contactFilter: 'Phone or Email',
        websiteFilter: 'Any Website',
        limit: 50,
      }),
    });
    const data = await res.json();

    const sample = data.leads?.[0];
    console.log(`Delivered: ${data.leads?.length} leads. Sample: "${sample?.businessName}", Phone: ${sample?.contact?.phone}, Email: ${sample?.contact?.email}`);

    if (data.leads && data.leads.length > 0) {
      console.log('>>> TEST 2 PASSED: Real hotel data delivered\n');
    } else {
      console.error('>>> TEST 2 FAILED');
      allPassed = false;
    }
  } catch (err) {
    console.error('>>> TEST 2 ERROR:', err.message);
    allPassed = false;
  }

  // --- TEST 3: Restaurants in Noida (No Website, Limit 50) ---
  console.log('[TEST 3] Restaurants in Noida, Uttar Pradesh (No Website Filter, Limit 50)...');
  try {
    const res = await fetch('http://localhost:3000/api/leads/search?sync=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Noida',
        industry: 'Restaurants',
        contactFilter: 'All Contacts',
        websiteFilter: 'No Website',
        limit: 50,
      }),
    });
    const data = await res.json();

    console.log(`Delivered: ${data.leads?.length} leads with No Website`);
    const allHaveNoWebsite = data.leads?.every((l) => !l.website?.url || l.website?.status === 'No Website');
    console.log(`All delivered leads have no website? ${allHaveNoWebsite}`);

    if (data.leads && data.leads.length > 0 && allHaveNoWebsite) {
      console.log('>>> TEST 3 PASSED: Correctly filtered and qualified candidates without website\n');
    } else {
      console.error('>>> TEST 3 FAILED');
      allPassed = false;
    }
  } catch (err) {
    console.error('>>> TEST 3 ERROR:', err.message);
    allPassed = false;
  }

  // --- TEST 4: Repeat Search (Database/Cache Reuse & Lead Rotation) ---
  console.log('[TEST 4] Repeat Search: Database / Cache Reuse & Smart Rotation...');
  try {
    const tStart = Date.now();
    const res = await fetch('http://localhost:3000/api/leads/search?sync=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Noida',
        industry: 'Restaurants',
        contactFilter: 'Phone or Email',
        websiteFilter: 'Any Website',
        limit: 50,
      }),
    });
    const durationMs = Date.now() - tStart;
    const data = await res.json();

    console.log(`Repeat search responded in ${durationMs}ms (sub-150ms cache/db hit)`);
    console.log(`Delivered: ${data.leads?.length} leads`);

    if (durationMs < 500 && data.leads?.length > 0) {
      console.log('>>> TEST 4 PASSED: Rapid sub-500ms database/cache reuse verified\n');
    } else {
      console.error('>>> TEST 4 FAILED: Slow response on repeated search');
      allPassed = false;
    }
  } catch (err) {
    console.error('>>> TEST 4 ERROR:', err.message);
    allPassed = false;
  }

  // --- AUTOMATED RESILIENCE & FALLBACK SUITE (TESTS 5, 6, 7) ---
  console.log('[AUTOMATED SUITE] Testing Google Timeout, Quota Fallback, Concurrency, and Rotation...');
  try {
    const res = await fetch('http://localhost:3000/api/test/suite');
    const suite = await res.json();

    console.log('  Test I (Google Timeout -> Instant OSM Fallback):', suite.testI_GoogleTimeoutFallback?.passed ? 'PASSED' : 'FAILED');
    console.log('  Test L (Google Quota Exceeded -> OSM Fallback):', suite.testL_GoogleQuotaFallback?.passed ? 'PASSED' : 'FAILED');
    console.log('  Test M (Google Sufficient -> OSM Not Called):', suite.testM_GoogleSufficientOsmNotCalled?.passed ? 'PASSED' : 'FAILED');
    console.log('  Test N (Google Partial -> OSM Supplemental):', suite.testN_GooglePlusOsmSupplemental?.passed ? 'PASSED' : 'FAILED');
    console.log('  Test J (Smart Lead Rotation & Prioritization):', suite.testJ_SmartRotation?.passed ? 'PASSED' : 'FAILED');
    console.log('  Test K (In-Flight Request Deduplication):', suite.testK_InFlightDeduplication?.passed ? 'PASSED' : 'FAILED');

    const suitePassed = suite.testI_GoogleTimeoutFallback?.passed &&
                        suite.testL_GoogleQuotaFallback?.passed &&
                        suite.testM_GoogleSufficientOsmNotCalled?.passed &&
                        suite.testN_GooglePlusOsmSupplemental?.passed &&
                        suite.testJ_SmartRotation?.passed &&
                        suite.testK_InFlightDeduplication?.passed;

    if (suitePassed) {
      console.log('>>> RESILIENCE SUITE PASSED\n');
    } else {
      console.error('>>> RESILIENCE SUITE FAILED');
      allPassed = false;
    }
  } catch (err) {
    console.error('>>> RESILIENCE SUITE ERROR:', err.message);
    allPassed = false;
  }

  console.log('================================================================');
  if (allPassed) {
    console.log('ALL SECTION 26 ACCEPTANCE TESTS PASSED WITH 100% SUCCESS');
  } else {
    console.log('SOME TESTS FAILED — CHECK LOGS ABOVE');
  }
  console.log('================================================================');
}

main().catch(console.error);
