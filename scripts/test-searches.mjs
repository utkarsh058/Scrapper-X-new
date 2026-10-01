// Test the 3 required searches from Section 28
const searches = [
  {
    name: "Search 1: Restaurants in Noida (Phone or Email, Any Website, 50)",
    payload: {
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Noida',
      industry: 'Restaurants',
      contactFilter: 'Phone or Email',
      websiteFilter: 'Any Website',
      limit: 50,
      sync: true
    }
  },
  {
    name: "Search 2: Hotels in Greater Noida (Phone or Email, Any Website, 50)",
    payload: {
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Greater Noida',
      industry: 'Hotels',
      contactFilter: 'Phone or Email',
      websiteFilter: 'Any Website',
      limit: 50,
      sync: true
    }
  },
  {
    name: "Search 3: Restaurants in Noida (All Contacts, Any Website, 50)",
    payload: {
      country: 'India',
      state: 'Uttar Pradesh',
      city: 'Noida',
      industry: 'Restaurants',
      contactFilter: 'All Contacts',
      websiteFilter: 'Any Website',
      limit: 50,
      sync: true
    }
  }
];

async function run() {
  for (const s of searches) {
    console.log(`\n============================================================`);
    console.log(`RUNNING: ${s.name}`);
    console.log(`============================================================`);
    const start = Date.now();
    try {
      const res = await fetch('http://localhost:3000/api/leads/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s.payload)
      });
      const data = await res.json();
      const duration = Date.now() - start;

      console.log(`HTTP Status:`, res.status);
      console.log(`JobId:`, data.jobId);
      console.log(`Status:`, data.status);
      console.log(`Search Status:`, data.searchStatus);
      console.log(`Total Delivered Leads:`, (data.leads || []).length);
      console.log(`Reported Latency (ms):`, data.latencyMs);
      console.log(`Fast Path Latency (ms):`, data.fastPathLatencyMs);
      console.log(`Total Roundtrip (ms):`, duration);
      console.log(`Providers:`, JSON.stringify(data.providers, null, 2));
      console.log(`Summary:`, JSON.stringify(data.summary, null, 2));

      if (data.leads && data.leads.length > 0) {
        console.log(`First 3 leads sample:`);
        data.leads.slice(0, 3).forEach((lead, idx) => {
          console.log(`  [${idx + 1}] "${lead.businessName}" | Phone: ${lead.phone || 'none'} | Email: ${lead.email || 'none'} | Website: ${lead.websiteUrl || 'none'} | Status: ${lead.websiteStatus} | Source: ${lead.source}`);
        });
      }

      if (data.jobId) {
        const debugRes = await fetch(`http://localhost:3000/api/leads/search/${data.jobId}/debug`);
        if (debugRes.ok) {
          const debugData = await debugRes.json();
          console.log(`Debug Rejection Reasons:`, JSON.stringify(debugData.rejectionReasons, null, 2));
          console.log(`Debug Pipeline Breakdown:`, JSON.stringify(debugData.pipelineBreakdown, null, 2));
          console.log(`Debug Rotation Stats:`, JSON.stringify(debugData.rotationStats, null, 2));
        }
      }
    } catch (err) {
      console.error(`Error executing ${s.name}:`, err);
    }
  }
}

run();
