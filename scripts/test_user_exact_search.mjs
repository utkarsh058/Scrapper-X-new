// Exact debug script testing the user's specific query
const BASE_URL = 'http://localhost:3000';

async function runTest() {
  console.log('===============================================================');
  console.log('TEST 1: Exact search from user request:');
  console.log('Restaurant | Uttar Pradesh | Greater Noida | Phone or Email | No Website | Limit 100');
  console.log('===============================================================');

  const res1 = await fetch(`${BASE_URL}/api/leads/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'Phone or Email',
      websiteFilter: 'No Website',
      limit: 100,
    }),
  });

  const data1 = await res1.json();
  console.log('Search 1 dispatch status:', data1.status, 'jobId:', data1.jobId);
  const jobId1 = data1.jobId;

  // Poll until complete
  let final1;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 600));
    const check = await (await fetch(`${BASE_URL}/api/leads/search/${jobId1}/progress`)).json();
    if (check.status === 'COMPLETED' || check.status === 'FAILED') {
      const res = await (await fetch(`${BASE_URL}/api/leads/search/${jobId1}/results`)).json();
      final1 = res;
      break;
    }
  }

  console.log('\n--- SEARCH 1 RESULTS ---');
  console.log('Search Status:', final1?.searchStatus);
  console.log('Status Reason:', final1?.statusReason);
  console.log('Delivered Leads count:', final1?.leads?.length);
  console.log('\nProvider Stats:', JSON.stringify(final1?.providerStats, null, 2));
  console.log('\nPipeline Breakdown:', JSON.stringify(final1?.pipelineBreakdown, null, 2));
  console.log('\nRejection Reasons:', JSON.stringify(final1?.rejectionReasons, null, 2));
  console.log('\nRejected Candidates Count:', final1?.rejectedCandidates?.length);
  console.log('Candidate Breakdown:');
  final1?.rejectedCandidates?.forEach((c, idx) => {
    console.log(`  [${idx + 1}] ${c.name} | Phone: ${c.phone || 'None'} | Email: ${c.email || 'None'} | Web: ${c.websiteUrl || 'None'} | Reason: ${c.rejectionReason} (${c.rejectionDetails || ''})`);
  });

  console.log('\n===============================================================');
  console.log('TEST 2: Control test: All Contacts + Any Website');
  console.log('Restaurant | Uttar Pradesh | Greater Noida | All Contacts | Any Website | Limit 100');
  console.log('===============================================================');

  const res2 = await fetch(`${BASE_URL}/api/leads/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 100,
    }),
  });

  const data2 = await res2.json();
  const jobId2 = data2.jobId;

  let final2;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 600));
    const check = await (await fetch(`${BASE_URL}/api/leads/search/${jobId2}/progress`)).json();
    if (check.status === 'COMPLETED' || check.status === 'FAILED') {
      const res = await (await fetch(`${BASE_URL}/api/leads/search/${jobId2}/results`)).json();
      final2 = res;
      break;
    }
  }

  console.log('\n--- SEARCH 2 (CONTROL TEST) RESULTS ---');
  console.log('Search Status:', final2?.searchStatus);
  console.log('Delivered Leads count:', final2?.leads?.length);
  console.log('Leads:');
  final2?.leads?.forEach((l, idx) => {
    console.log(`  [${idx + 1}] ${l.name} | Phone: ${l.phone || 'None'} | Email: ${l.email || 'None'} | Web: ${l.website || 'None'} | Score: ${l.auditScore}`);
  });
}

runTest().catch(console.error);
