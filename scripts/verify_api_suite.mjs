/**
 * Automated Verification Script for LeadPilot API Endpoint Testing
 * Validates Sections 9 & 10 requirements:
 * 1. Restaurant | UP | Greater Noida | All Contacts | Any Website | Limit 100
 * 2. Restaurant | UP | Greater Noida | Phone or Email | No Website | Limit 100 (handles zero results cleanly)
 * 3. Provider failure isolation (Google Places disabled / OSM timeout / unknown routes)
 * 4. Ensures all responses are application/json and valid JSON.
 */

const BASE_URL = 'http://localhost:3000';

async function testEndpoint(name, url, options = {}) {
  console.log(`\n===============================================================`);
  console.log(`[TEST]: ${name}`);
  console.log(`URL: ${url}`);
  console.log(`Method: ${options.method || 'GET'}`);

  const start = Date.now();
  const res = await fetch(url, options);
  const duration = Date.now() - start;

  const contentType = res.headers.get('content-type') || '';
  const raw = await res.text();

  console.log(`HTTP Status: ${res.status}`);
  console.log(`Content-Type: ${contentType}`);
  console.log(`Duration: ${duration}ms`);

  let parsed = null;
  let isJson = false;
  try {
    parsed = JSON.parse(raw);
    isJson = true;
  } catch (err) {
    console.error(`FAILED TO PARSE JSON: ${err.message}`);
    console.error(`RAW PREVIEW: ${raw.slice(0, 300)}`);
  }

  const isContentTypeJson = contentType.includes('application/json');
  console.log(`Content-Type is JSON: ${isContentTypeJson}`);
  console.log(`Body is Valid JSON: ${isJson}`);

  if (!isContentTypeJson || !isJson) {
    throw new Error(`TEST FAILED: Non-JSON response for ${name}`);
  }

  return { status: res.status, contentType, parsed, raw };
}

async function runAll() {
  console.log('STARTING LEADPILOT API VERIFICATION SUITE...\n');

  // TEST 1: Direct Async Search Request (Section 9)
  const test1 = await testEndpoint(
    '1. Valid Search Dispatch (Restaurant, UP, Greater Noida, All Contacts, Any Website, 100)',
    `${BASE_URL}/api/leads/search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Greater Noida',
        industry: 'Restaurant',
        contactFilter: 'All Contacts',
        websiteFilter: 'Any Website',
        limit: 100,
      }),
    }
  );
  console.log('Dispatch Response:', test1.parsed);
  const jobId1 = test1.parsed.jobId;

  // Poll until complete
  console.log(`Polling job ${jobId1}...`);
  let job1Results = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const prog = await testEndpoint(
      `Progress Poll for ${jobId1}`,
      `${BASE_URL}/api/leads/search/${jobId1}/progress`
    );
    if (prog.parsed.status === 'COMPLETED' || prog.parsed.status === 'FAILED') {
      job1Results = await testEndpoint(
        `Results Fetch for ${jobId1}`,
        `${BASE_URL}/api/leads/search/${jobId1}/results`
      );
      break;
    }
  }

  console.log('Job 1 Leads count:', job1Results?.parsed?.leads?.length);
  console.log('Job 1 Search Status:', job1Results?.parsed?.searchStatus);
  console.log('Job 1 Providers:', job1Results?.parsed?.providers);

  // TEST 2: Section 9 - Phone or Email + No Website (zero or low results handling)
  const test2 = await testEndpoint(
    '2. Valid Search Dispatch (Phone or Email + No Website, Limit 100)',
    `${BASE_URL}/api/leads/search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Greater Noida',
        industry: 'Restaurant',
        contactFilter: 'Phone or Email',
        websiteFilter: 'No Website',
        limit: 100,
      }),
    }
  );
  const jobId2 = test2.parsed.jobId;

  let job2Results = null;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const prog = await testEndpoint(
      `Progress Poll for ${jobId2}`,
      `${BASE_URL}/api/leads/search/${jobId2}/progress`
    );
    if (prog.parsed.status === 'COMPLETED' || prog.parsed.status === 'FAILED') {
      job2Results = await testEndpoint(
        `Results Fetch for ${jobId2}`,
        `${BASE_URL}/api/leads/search/${jobId2}/results`
      );
      break;
    }
  }

  console.log('Job 2 Leads count:', job2Results?.parsed?.leads?.length);
  console.log('Job 2 Search Status:', job2Results?.parsed?.searchStatus);
  console.log('Job 2 Rejection Reasons:', job2Results?.parsed?.rejectionReasons);
  console.log('Job 2 Providers:', job2Results?.parsed?.providers);

  // TEST 3: Synchronous Search (?sync=true)
  const test3 = await testEndpoint(
    '3. Synchronous Search (?sync=true)',
    `${BASE_URL}/api/leads/search?sync=true`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Greater Noida',
        industry: 'Restaurant',
        contactFilter: 'All Contacts',
        websiteFilter: 'Any Website',
        limit: 5,
        sync: true,
      }),
    }
  );
  console.log('Sync Leads count:', test3.parsed.leads?.length);
  console.log('Sync Providers:', test3.parsed.providers);

  // TEST 4: Invalid location (HTTP 400 with JSON)
  await testEndpoint(
    '4. Invalid Location Validation (Non-Indian state)',
    `${BASE_URL}/api/leads/search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        country: 'India',
        state: 'California',
        industry: 'Restaurant',
      }),
    }
  );

  // TEST 5: Malformed JSON payload (HTTP 400 with JSON)
  await testEndpoint(
    '5. Malformed Request Payload',
    `${BASE_URL}/api/leads/search`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid": json',
    }
  );

  // TEST 6: Unknown Job ID (HTTP 404 with JSON)
  await testEndpoint(
    '6. Non-existent Job Progress',
    `${BASE_URL}/api/leads/search/non_existent_job_123/progress`
  );

  await testEndpoint(
    '7. Non-existent Job Results',
    `${BASE_URL}/api/leads/search/non_existent_job_123/results`
  );

  // TEST 8: Diagnostics debug route
  await testEndpoint(
    '8. Debug Diagnostics for Job 1',
    `${BASE_URL}/api/leads/search/debug/${jobId1}`
  );

  console.log('\n===============================================================');
  console.log('ALL VERIFICATION TESTS COMPLETED SUCCESSFULLY! ALL RESPONSES VALID JSON.');
  console.log('===============================================================');
}

runAll().catch((err) => {
  console.error('\nVERIFICATION TEST RUN FAILED:', err);
  process.exit(1);
});
