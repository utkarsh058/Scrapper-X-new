// LeadPilot Multi-Source Engine Live Acceptance Test Suite (Phase 18 & 19)

const BASE_URL = 'http://localhost:3000';

const TEST_CASES = [
  {
    id: 1,
    name: 'Test 1: Cafe in Greater Noida (All Contacts, Any Website, 50)',
    payload: {
      industry: 'Cafe',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 50,
    },
  },
  {
    id: 2,
    name: 'Test 2: Cafe in Greater Noida (Phone or Email, Any Website, 50)',
    payload: {
      industry: 'Cafe',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'Has Phone or Email',
      websiteFilter: 'Any Website',
      limit: 50,
    },
  },
  {
    id: 3,
    name: 'Test 3: Restaurant in Delhi (Phone or Email, Website Available, 100)',
    payload: {
      industry: 'Restaurant',
      state: 'Delhi',
      city: 'Delhi',
      contactFilter: 'Has Phone or Email',
      websiteFilter: 'Website Available',
      limit: 100,
    },
  },
  {
    id: 4,
    name: 'Test 4: Hotel in Mumbai (All Contacts, Any Website, 100)',
    payload: {
      industry: 'Hotel',
      state: 'Maharashtra',
      city: 'Mumbai',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 100,
    },
  },
  {
    id: 5,
    name: 'Test 5: Restaurant in Bangalore (No Contact, No Website, 50)',
    payload: {
      industry: 'Restaurant',
      state: 'Karnataka',
      city: 'Bangalore',
      contactFilter: 'No Contact',
      websiteFilter: 'No Website',
      limit: 50,
    },
  },
  {
    id: 6,
    name: 'Test 6: Cafe in Delhi (Phone or Email, Needs Improvement, 500)',
    payload: {
      industry: 'Cafe',
      state: 'Delhi',
      city: 'Delhi',
      contactFilter: 'Has Phone or Email',
      websiteFilter: 'Needs Improvement',
      limit: 500,
    },
  },
];

async function pollJob(jobId) {
  const maxAttempts = 150;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const res = await fetch(`${BASE_URL}/api/leads/search/${jobId}/progress`);
    if (!res.ok) continue;
    const data = await res.json();
    if (data.status === 'COMPLETED' || data.status === 'FAILED') {
      const resultsRes = await fetch(`${BASE_URL}/api/leads/search/${jobId}/results`);
      return await resultsRes.json();
    }
  }
  throw new Error(`Job ${jobId} timed out after ${maxAttempts} seconds`);
}

async function runTest(testCase) {
  console.log(`\n======================================================================`);
  console.log(`RUNNING ${testCase.name}`);
  console.log(`Payload:`, JSON.stringify(testCase.payload, null, 2));
  console.log(`----------------------------------------------------------------------`);

  const startTime = Date.now();
  const dispatchRes = await fetch(`${BASE_URL}/api/leads/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(testCase.payload),
  });

  const dispatchData = await dispatchRes.json();
  if (!dispatchData.success) {
    console.error(`FAILED to dispatch job:`, dispatchData);
    return;
  }

  const jobId = dispatchData.jobId;
  console.log(`Job Dispatched: ${jobId}. Polling execution...`);

  const result = await pollJob(jobId);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  // Fetch full diagnostics
  const debugRes = await fetch(`${BASE_URL}/api/leads/search/debug/${jobId}`);
  const debugData = debugRes.ok ? await debugRes.json() : null;
  const diag = debugData?.diagnostics || {};

  console.log(`\n[RESULTS for ${testCase.name} in ${elapsed}s]:`);
  console.log(`Status:              ${result.status} (${result.searchStatus || diag.sourceStatus})`);
  console.log(`Status Reason:       ${result.statusReason || diag.statusReason}`);
  console.log(`Provider Counts:`);
  console.log(`  - OSM Overpass:    ${diag.osmRawCount ?? 'N/A'}`);
  console.log(`  - Web Search:      ${diag.webRawCount ?? 'N/A'}`);
  console.log(`  - Directory:       ${diag.directoryRawCount ?? 'N/A'}`);
  console.log(`Pipeline Metrics:`);
  console.log(`  - Total Discovered:${diag.totalDiscovered ?? result.pipelineStats?.rawOsmCount ?? 0}`);
  console.log(`  - Normalized:      ${diag.normalizedCount ?? 'N/A'}`);
  console.log(`  - Deduplicated:    ${diag.deduplicatedCount ?? result.pipelineStats?.deduplicatedCount ?? 0}`);
  console.log(`  - Location Valid:  ${diag.locationVerifiedCount ?? 'N/A'}`);
  console.log(`  - Contacts Found:  ${diag.contactCount ?? 0}`);
  console.log(`  - Websites Found:  ${diag.websiteCount ?? 0}`);
  console.log(`  - Qualified:       ${diag.counters?.qualifiedCount ?? 0}`);
  console.log(`  - Final Delivered: ${result.leads?.length ?? 0} (Requested: ${testCase.payload.limit})`);
  console.log(`Rejection Reasons:  `, JSON.stringify(diag.rejectionReasons || result.rejectionReasons || {}, null, 2));
  console.log(`Provider Statuses:  `, JSON.stringify(diag.providerStatuses || {}, null, 2));

  // Inspect first 3 sample leads for provenance and validity
  const sampleLeads = (result.leads || []).slice(0, 3);
  console.log(`\nSample Real Delivered Leads (${sampleLeads.length}):`);
  sampleLeads.forEach((lead, idx) => {
    console.log(`  [${idx + 1}] Name:     ${lead.businessName}`);
    console.log(`      Category: ${lead.category || lead.industry}`);
    console.log(`      Location: ${lead.location?.city || lead.city}, ${lead.location?.state || lead.state}`);
    console.log(`      Address:  ${lead.location?.address || lead.address}`);
    console.log(`      Phone:    ${lead.contact?.phone || lead.phone || 'null'}`);
    console.log(`      Email:    ${lead.contact?.email || lead.email || 'null'}`);
    console.log(`      Website:  ${lead.website?.url || lead.websiteUrl || 'null'} (Status: ${lead.website?.status || lead.websiteStatus})`);
    console.log(`      Sources:  ${JSON.stringify(lead.sources || [lead.source])}`);
  });
}

async function main() {
  console.log(`Starting LeadPilot Multi-Source Live Acceptance Tests against ${BASE_URL}...`);
  for (const testCase of TEST_CASES) {
    try {
      await runTest(testCase);
    } catch (err) {
      console.error(`ERROR in ${testCase.name}:`, err);
    }
  }
  console.log(`\n======================================================================`);
  console.log(`ALL TEST RUNS FINISHED.`);
  console.log(`======================================================================\n`);
}

main().catch(console.error);
