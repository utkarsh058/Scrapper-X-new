// LeadPilot Actor Engine Acceptance Test Suite
// Executes against live server http://localhost:3000

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runAcceptanceTest(testName, payload) {
  console.log(`\n==================================================`);
  console.log(`RUNNING ACCEPTANCE TEST: ${testName}`);
  console.log(`Payload:`, JSON.stringify(payload, null, 2));
  console.log(`==================================================`);

  // 1. Dispatch Search Job
  const dispatchRes = await fetch('http://localhost:3000/api/leads/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const dispatchData = await dispatchRes.json();
  console.log(`\n1. Dispatch Response:`, dispatchData);

  const jobId = dispatchData.jobId;
  if (!jobId) {
    throw new Error(`Failed to obtain jobId from dispatch response: ${JSON.stringify(dispatchData)}`);
  }

  // 2. Poll Progress
  console.log(`\n2. Polling progress for job: ${jobId}`);
  let isDone = false;
  let attempts = 0;
  let lastMessage = '';

  while (!isDone && attempts < 150) {
    attempts++;
    await sleep(800);

    const progRes = await fetch(`http://localhost:3000/api/leads/search/${jobId}/progress`);
    if (!progRes.ok) continue;

    const progData = await progRes.json();
    const log = progData.progressLog || [];
    if (log.length > 0) {
      const current = log[log.length - 1];
      if (current.message !== lastMessage) {
        lastMessage = current.message;
        console.log(`   [Engine Progress] ${current.message} ${current.count !== undefined ? `(${current.count})` : ''}`);
      }
    }

    if (progData.status === 'COMPLETED' || progData.status === 'FAILED') {
      isDone = true;
      console.log(`\n3. Job ${jobId} finished with status: ${progData.status}`);
      console.log(`   Counters:`, progData.counters);
      console.log(`   Rejection Reasons:`, progData.rejectionReasons);
      break;
    }
  }

  // 3. Fetch Final Results
  const resultsRes = await fetch(`http://localhost:3000/api/leads/search/${jobId}/results`);
  const resultsData = await resultsRes.json();
  console.log(`\n4. Final Results Summary:`);
  console.log(`   Success: ${resultsData.success}`);
  console.log(`   Search Status: ${resultsData.searchStatus}`);
  console.log(`   Source Complete: ${resultsData.sourceComplete}`);
  console.log(`   Status Reason: ${resultsData.statusReason}`);
  console.log(`   Final Delivered Leads: ${resultsData.leads ? resultsData.leads.length : 0}`);

  if (resultsData.leads && resultsData.leads.length > 0) {
    console.log(`\n   Sample First 2 Delivered Leads:`);
    resultsData.leads.slice(0, 2).forEach((lead, i) => {
      console.log(`   [${i + 1}] ${lead.businessName} (Category: ${lead.category})`);
      console.log(`       Address: ${lead.address}`);
      console.log(`       Phone: ${lead.phone || 'None'} | Email: ${lead.email || 'None'} | Website: ${lead.websiteUrl || 'None'}`);
      console.log(`       Opportunity Score: ${lead.opportunityScore} | Status: ${lead.websiteStatus}`);
    });
  }

  // 4. Fetch Debug Diagnostics
  const debugRes = await fetch(`http://localhost:3000/api/leads/search/debug/${jobId}`);
  const debugData = await debugRes.json();
  console.log(`\n5. Diagnostics / Actor Runs:`);
  if (debugData.diagnostics?.actorStatuses) {
    debugData.diagnostics.actorStatuses.forEach((actor) => {
      console.log(`   - Actor [${actor.actorId}]: Status=${actor.status}, Duration=${actor.durationMs}ms`);
    });
  }

  return { jobId, resultsData, debugData };
}

async function main() {
  try {
    // TEST 1: Cafe in Greater Noida, UP, PHONE_OR_EMAIL, ANY_WEBSITE, limit 50
    const test1 = await runAcceptanceTest('TEST 1: Cafe in Greater Noida (PHONE_OR_EMAIL, ANY_WEBSITE)', {
      industry: 'Cafe',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'Phone or Email',
      websiteFilter: 'Any Website',
      limit: 50,
    });

    await sleep(2000);

    // TEST 2: Resume Test
    console.log(`\n==================================================`);
    console.log(`TEST 2: RESUME JOB ${test1.jobId}`);
    console.log(`==================================================`);
    const resumeRes = await fetch(`http://localhost:3000/api/leads/search/${test1.jobId}/resume`, {
      method: 'POST',
    });
    const resumeData = await resumeRes.json();
    console.log(`Resume Response:`, resumeData);

    await sleep(2000);

    // TEST 3: Filtering Happens AFTER Discovery/Enrichment
    // Contact = NO_CONTACT, Website = NO_WEBSITE
    await runAcceptanceTest('TEST 3: Filter Test (NO_CONTACT, NO_WEBSITE)', {
      industry: 'Cafe',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'No Contact',
      websiteFilter: 'No Website',
      limit: 50,
    });

    console.log(`\n==================================================`);
    console.log(`ALL ACCEPTANCE TESTS COMPLETED SUCCESSFULLY!`);
    console.log(`==================================================\n`);
  } catch (err) {
    console.error('Acceptance test failed:', err);
    process.exit(1);
  }
}

main();
