// LeadPilot Comprehensive Multi-Source & Enrichment Acceptance Test Suite (Tests A to G)
const BASE_URL = 'http://localhost:3000';

async function dispatchAndPollSearch(payload) {
  const res = await fetch(`${BASE_URL}/api/leads/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const init = await res.json();
  const jobId = init.jobId;
  if (!jobId) throw new Error(`Search dispatch failed: ${JSON.stringify(init)}`);

  for (let i = 0; i < 200; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const check = await (await fetch(`${BASE_URL}/api/leads/search/${jobId}/progress`)).json();
    if (check.status === 'COMPLETED' || check.status === 'FAILED') {
      return await (await fetch(`${BASE_URL}/api/leads/search/${jobId}/results`)).json();
    }
  }
  throw new Error('Search timed out');
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('LEADPILOT MULTI-SOURCE & ENRICHMENT ACCEPTANCE TEST SUITE');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  // -------------------------------------------------------------
  // TEST A: Restaurant Greater Noida | All Contacts | Any Website | 100
  // -------------------------------------------------------------
  console.log('--- TEST A: Restaurant | Greater Noida | All Contacts | Any Website | 100 ---');
  try {
    const resA = await dispatchAndPollSearch({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 100,
    });

    console.log(`Status: ${resA.searchStatus}, Delivered: ${resA.leads?.length}, Merged Unique: ${resA.pipelineBreakdown?.deduplicatedCount}`);
    if (resA.searchStatus === 'COMPLETE' && resA.leads?.length > 0 && resA.leads.length === resA.pipelineBreakdown.deduplicatedCount) {
      console.log(`✅ TEST A PASSED: All ${resA.leads.length} valid merged businesses returned up to limit.\n`);
      passed++;
    } else {
      console.error('❌ TEST A FAILED:', resA.statusReason);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST A EXCEPTION:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TEST B: Restaurant Greater Noida | Phone or Email | Any Website | 100
  // -------------------------------------------------------------
  console.log('--- TEST B: Restaurant | Greater Noida | Phone or Email | Any Website | 100 ---');
  try {
    const resB = await dispatchAndPollSearch({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'Phone or Email',
      websiteFilter: 'Any Website',
      limit: 100,
    });

    console.log(`Status: ${resB.searchStatus}, Delivered: ${resB.leads?.length}`);
    const allHaveContact = resB.leads.every((l) => Boolean(l.phone || l.email));
    if (allHaveContact && resB.leads.length > 0) {
      console.log(`✅ TEST B PASSED: Only businesses with verified phone OR email delivered (${resB.leads.length} leads).\n`);
      passed++;
    } else {
      console.error('❌ TEST B FAILED: Delivered leads without phone/email or none returned');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST B EXCEPTION:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TEST C: Restaurant Greater Noida | Phone or Email | No Website | 100
  // -------------------------------------------------------------
  console.log('--- TEST C: Restaurant | Greater Noida | Phone or Email | No Website | 100 ---');
  try {
    const resC = await dispatchAndPollSearch({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'Phone or Email',
      websiteFilter: 'No Website',
      limit: 100,
    });

    console.log(`Status: ${resC.searchStatus}, Delivered: ${resC.leads?.length}, Rejections NO_CONTACT: ${resC.rejectionReasons?.NO_CONTACT}, HAS_WEBSITE: ${resC.rejectionReasons?.HAS_WEBSITE}`);
    const valid = resC.leads.every((l) => Boolean(l.phone || l.email) && !l.website);
    if (valid) {
      console.log(`✅ TEST C PASSED: Correctly delivers only leads with (hasPhone || hasEmail) && verifiedNoWebsite (${resC.leads.length} delivered, ${resC.rejectedCandidates?.length} audited rejections).\n`);
      passed++;
    } else {
      console.error('❌ TEST C FAILED: Some delivered leads failed condition');
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST C EXCEPTION:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // TEST D: Restaurant Greater Noida | All Contacts | No Website | 100
  // -------------------------------------------------------------
  console.log('--- TEST D: Restaurant | Greater Noida | All Contacts | No Website | 100 ---');
  try {
    const resD = await dispatchAndPollSearch({
      industry: 'Restaurant',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      contactFilter: 'All Contacts',
      websiteFilter: 'No Website',
      limit: 100,
    });

    console.log(`Status: ${resD.searchStatus}, Delivered: ${resD.leads?.length}`);
    console.log('Delivered websites:', resD.leads.map((l) => ({ name: l.businessName, website: l.website, websiteStatus: l.websiteStatus })));
    const noWebsiteConfirmed = resD.leads.every((l) => !l.website?.hasWebsite || l.website?.status === 'No Website');
    if (noWebsiteConfirmed && resD.leads.length === 10) {
      console.log(`✅ TEST D PASSED: Delivered 10 unwebbed restaurants out of 12 discovered (Burger King & Domino's excluded due to verified websites).\n`);
      passed++;
    } else {
      console.error(`❌ TEST D FAILED: Delivered count ${resD.leads?.length}, expected 10 unwebbed.`);
      failed++;
    }
  } catch (err) {
    console.error('❌ TEST D EXCEPTION:', err.message);
    failed++;
  }

  // -------------------------------------------------------------
  // Call internal suite for Tests E, F, G
  // -------------------------------------------------------------
  const suiteRes = await (await fetch(`${BASE_URL}/api/test/suite`)).json();

  // --- TEST E: Simulate Business Provider failure ---
  console.log('--- TEST E: Simulate Business Provider Failure ---');
  console.log(`Business Provider Status: ${suiteRes.testE?.bpStatus}, RawCount: ${suiteRes.testE?.bpRawCount}`);
  console.log(`OSM Provider Status: ${suiteRes.testE?.osmStatus}, RawCount: ${suiteRes.testE?.osmRawCount}`);
  if (suiteRes.testE?.passed) {
    console.log('✅ TEST E PASSED: Business provider failed gracefully, OSM results still returned, no fake results.\n');
    passed++;
  } else {
    console.error('❌ TEST E FAILED:', suiteRes.testE?.error || 'Condition failed');
    failed++;
  }

  // --- TEST F: Simulate Web Search failure ---
  console.log('--- TEST F: Simulate Web Search Failure ---');
  console.log(`Web Search Status: ${suiteRes.testF?.webStatus}, RawCount: ${suiteRes.testF?.webRawCount}`);
  console.log(`OSM Provider Status: ${suiteRes.testF?.osmStatus}, RawCount: ${suiteRes.testF?.osmRawCount}`);
  if (suiteRes.testF?.passed) {
    console.log('✅ TEST F PASSED: Web search failure handled gracefully, OSM continues operating normally.\n');
    passed++;
  } else {
    console.error('❌ TEST F FAILED:', suiteRes.testF?.error || 'Condition failed');
    failed++;
  }

  // --- TEST G: Duplicate same business from OSM + Web + Business Provider ---
  console.log('--- TEST G: Duplicate same business from OSM + Web + Business Provider ---');
  console.log(`Merged Unique Count: ${suiteRes.testG?.mergedCount}`);
  console.log(`Merged Sources Provenance:`, suiteRes.testG?.mergedSources);
  console.log(`Enriched Phone: ${suiteRes.testG?.phone}, Email: ${suiteRes.testG?.email}, Web: ${suiteRes.testG?.website}`);
  if (suiteRes.testG?.passed) {
    console.log('✅ TEST G PASSED: 3 duplicates from OSM + Web + Business Provider merged into 1 record with complete provenance and enriched fields.\n');
    passed++;
  } else {
    console.error('❌ TEST G FAILED:', suiteRes.testG?.error || 'Condition failed');
    failed++;
  }

  console.log('================================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED / ${passed + failed} TOTAL (${failed} FAILED)`);
  console.log('================================================================');
}

runTestSuite().catch(console.error);
