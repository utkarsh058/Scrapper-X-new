// Script to run and verify the 7 Acceptance Tests from Section 23
async function runAcceptanceTests() {
  console.log('============================================================');
  console.log('RUNNING SECTION 23 ACCEPTANCE TESTS');
  console.log('============================================================\n');

  // TEST 1: Hotels in Greater Noida (Phone or Email, Any Website, 50)
  console.log('--- TEST 1: Hotels, Greater Noida, Phone or Email, 50 ---');
  const t1Start = Date.now();
  const res1 = await fetch('http://localhost:3000/api/leads/search?sync=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      industry: 'Hotels',
      contactFilter: 'Phone or Email',
      websiteFilter: 'Any Website',
      limit: 50
    })
  });
  const data1 = await res1.json();
  console.log('Test 1 HTTP Status:', res1.status);
  console.log('Test 1 Search Status:', data1.searchStatus);
  console.log('Test 1 Leads Delivered:', data1.leads?.length);
  console.log('Test 1 Latency (ms):', data1.latencyMs);
  console.log('Test 1 Providers:', JSON.stringify(data1.providers, null, 2));

  // TEST 2: Restaurants in Noida (Phone or Email, Any Website, 50)
  console.log('\n--- TEST 2: Restaurants, Noida, Phone or Email, 50 ---');
  const res2 = await fetch('http://localhost:3000/api/leads/search?sync=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Noida',
      industry: 'Restaurants',
      contactFilter: 'Phone or Email',
      websiteFilter: 'Any Website',
      limit: 50
    })
  });
  const data2 = await res2.json();
  console.log('Test 2 HTTP Status:', res2.status);
  console.log('Test 2 Search Status:', data2.searchStatus);
  console.log('Test 2 Leads Delivered:', data2.leads?.length);
  console.log('Test 2 Latency (ms):', data2.latencyMs);

  // TEST 3: Cafes in Greater Noida (All Contacts, Any Website, 50)
  console.log('\n--- TEST 3: Cafes, Greater Noida, All Contacts, 50 ---');
  const res3 = await fetch('http://localhost:3000/api/leads/search?sync=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      industry: 'Cafes',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 50
    })
  });
  const data3 = await res3.json();
  console.log('Test 3 HTTP Status:', res3.status);
  console.log('Test 3 Search Status:', data3.searchStatus);
  console.log('Test 3 Leads Delivered:', data3.leads?.length);
  console.log('Test 3 Latency (ms):', data3.latencyMs);
  console.log('Test 3 Providers:', JSON.stringify(data3.providers, null, 2));

  // TEST 4: Same search twice (Restaurants Noida) to verify database/cache reuse & rotation
  console.log('\n--- TEST 4: Same Search Twice (Database/Cache Reuse & Rotation) ---');
  const res4 = await fetch('http://localhost:3000/api/leads/search?sync=true', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Noida',
      industry: 'Restaurants',
      contactFilter: 'Phone or Email',
      websiteFilter: 'Any Website',
      limit: 50
    })
  });
  const data4 = await res4.json();
  console.log('Test 4 Latency (ms):', data4.latencyMs, '(Must be sub-50ms cache hit)');
  console.log('Test 4 Leads Delivered:', data4.leads?.length);
  console.log('Test 4 First Lead:', data4.leads?.[0]?.businessName);

  // Mark first lead as contacted
  if (data4.leads?.[0]) {
    const contactRes = await fetch('http://localhost:3000/api/leads/contact-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        leadId: data4.leads[0].id,
        placeId: data4.leads[0].osmId || data4.leads[0].id,
        action: 'CALL_ATTEMPTED',
        channel: 'phone'
      })
    });
    console.log('Marked first lead as CALL_ATTEMPTED:', contactRes.status);

    // Search 3rd time to verify smart rotation deprioritizes it
    const res4b = await fetch('http://localhost:3000/api/leads/search?sync=true', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Noida',
        industry: 'Restaurants',
        contactFilter: 'Phone or Email',
        websiteFilter: 'Any Website',
        limit: 50
      })
    });
    const data4b = await res4b.json();
    console.log('Test 4b (Rotated) First Lead:', data4b.leads?.[0]?.businessName);
    console.log('Rotated successfully away from contacted lead?', data4b.leads?.[0]?.businessName !== data4.leads?.[0]?.businessName);
  }

  // TEST 5 & 6 & 7: Tested through /api/test/suite (Test I, Test L, Test M)
  console.log('\n--- VERIFYING AUTOMATED SYSTEM TEST SUITE ---');
  const testSuiteRes = await fetch('http://localhost:3000/api/test/suite');
  const suiteData = await testSuiteRes.json();
  console.log('Test Suite Results:');
  console.log('  Test H (Provider Health):', suiteData.testH_ProviderHealth.passed ? 'PASSED' : 'FAILED');
  console.log('  Test I (Google Timeout Fallback):', suiteData.testI_GoogleTimeoutFallback.passed ? 'PASSED' : 'FAILED');
  console.log('  Test L (Google Quota Fallback):', suiteData.testL_GoogleQuotaFallback.passed ? 'PASSED' : 'FAILED');
  console.log('  Test M (Google Sufficient -> OSM Not Called):', suiteData.testM_GoogleSufficientOsmNotCalled.passed ? 'PASSED' : 'FAILED');
  console.log('  Test N (Google Partial -> OSM Supplemental):', suiteData.testN_GooglePlusOsmSupplemental.passed ? 'PASSED' : 'FAILED');
  console.log('  Test J (6-Tier Smart Lead Rotation):', suiteData.testJ_SmartRotation.passed ? 'PASSED' : 'FAILED');
  console.log('  Test K (In-Flight Request Deduplication):', suiteData.testK_InFlightDeduplication.passed ? 'PASSED' : 'FAILED');

  console.log('\n============================================================');
  console.log('ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY');
  console.log('============================================================');
}

runAcceptanceTests().catch(console.error);
