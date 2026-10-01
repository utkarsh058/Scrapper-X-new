// Acceptance test runner for LeadPilot Lead Discovery Pipeline

async function runTest(testName, payload) {
  console.log(`\n==================================================`);
  console.log(`RUNNING ${testName}`);
  console.log(`Payload:`, JSON.stringify(payload));
  console.log(`==================================================`);

  const startTime = Date.now();
  try {
    const res = await fetch('http://localhost:3000/api/leads/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    const duration = Date.now() - startTime;

    console.log(`Response HTTP Status: ${res.status} (${duration}ms)`);
    console.log(`Success: ${data.success}`);
    console.log(`Search Status: ${data.searchStatus}`);
    console.log(`Status Reason: ${data.statusReason || 'None'}`);

    if (data.pipelineStats) {
      console.log(`\nPipeline Breakdown:`);
      console.log(`  - Raw OSM Objects: ${data.pipelineStats.rawOsmCount}`);
      console.log(`  - Valid Named Businesses: ${data.pipelineStats.namedCount}`);
      console.log(`  - Inside City Boundary: ${data.pipelineStats.inCityBoundsCount}`);
      console.log(`  - Unique Deduplicated: ${data.pipelineStats.deduplicatedCount}`);
      console.log(`  - After Contact Filter: ${data.pipelineStats.contactFilteredCount}`);
      console.log(`  - After Website Filter: ${data.pipelineStats.websiteFilteredCount}`);
      console.log(`  - Final Delivered Leads: ${data.pipelineStats.finalDeliveredCount}`);
      console.log(`  - Discarded Reasons:`, JSON.stringify(data.discardedBreakdown));
    }

    if (data.leads && data.leads.length > 0) {
      console.log(`\nSample First 3 Leads:`);
      data.leads.slice(0, 3).forEach((lead, i) => {
        console.log(`  ${i + 1}. [${lead.osmType}/${lead.osmId}] ${lead.businessName}`);
        console.log(`     Address: ${lead.address}`);
        console.log(`     Category: ${lead.category} | Phone: ${lead.phone || 'N/A'} | Website: ${lead.website?.url || 'N/A'}`);
      });
    }

    return { testName, data, duration };
  } catch (err) {
    console.error(`Error executing ${testName}:`, err);
    return { testName, error: err.message };
  }
}

async function main() {
  // Test A: Hotel, Uttar Pradesh, Noida, All Contacts, Any Website, 50 leads
  await runTest('TEST A: Hotel in Noida, UP', {
    industry: 'Hotel',
    state: 'Uttar Pradesh',
    city: 'Noida',
    contactFilter: 'All Contacts',
    websiteFilter: 'Any Website',
    limit: 50,
  });

  // Short pause to be gentle on Overpass
  await new Promise((r) => setTimeout(r, 2000));

  // Test B: Restaurant, Uttar Pradesh, Noida, All Contacts, Any Website, 100 leads
  await runTest('TEST B: Restaurant in Noida, UP', {
    industry: 'Restaurant',
    state: 'Uttar Pradesh',
    city: 'Noida',
    contactFilter: 'All Contacts',
    websiteFilter: 'Any Website',
    limit: 100,
  });

  await new Promise((r) => setTimeout(r, 2000));

  // Test C: Cafe, Delhi, Delhi, All Contacts, Any Website, 50 leads
  await runTest('TEST C: Cafe in Delhi', {
    industry: 'Cafe',
    state: 'Delhi',
    city: 'Delhi',
    contactFilter: 'All Contacts',
    websiteFilter: 'Any Website',
    limit: 50,
  });

  await new Promise((r) => setTimeout(r, 2000));

  // Test D: Restaurant, Maharashtra, Mumbai, All Contacts, Any Website, 50 leads
  await runTest('TEST D: Restaurant in Mumbai, Maharashtra', {
    industry: 'Restaurant',
    state: 'Maharashtra',
    city: 'Mumbai',
    contactFilter: 'All Contacts',
    websiteFilter: 'Any Website',
    limit: 50,
  });
}

main();
