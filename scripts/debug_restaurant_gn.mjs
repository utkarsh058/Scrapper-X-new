
async function testDebug() {
  const payload1 = {
    industry: "Restaurant",
    state: "Uttar Pradesh",
    city: "Greater Noida",
    contactFilter: "Phone or Email",
    websiteFilter: "No Website",
    limit: 100
  };

  console.log("Dispatching Search 1: Phone or Email + No Website...");
  const res1 = await fetch('http://localhost:3000/api/leads/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload1)
  });
  const data1 = await res1.json();
  console.log("Job 1 ID:", data1.jobId);

  // Poll
  let result1;
  while (true) {
    await new Promise(r => setTimeout(r, 1000));
    const p = await fetch(`http://localhost:3000/api/leads/search/${data1.jobId}/progress`).then(r => r.json());
    if (p.status === 'COMPLETED' || p.status === 'FAILED') {
      result1 = await fetch(`http://localhost:3000/api/leads/search/${data1.jobId}/results`).then(r => r.json());
      break;
    }
  }

  const debug1 = await fetch(`http://localhost:3000/api/leads/search/debug/${data1.jobId}`).then(r => r.json());
  console.log("Job 1 Result Status:", result1.status, result1.searchStatus);
  console.log("Job 1 Leads Length:", result1.leads?.length);
  console.log("Job 1 Diagnostics:", JSON.stringify(debug1.diagnostics, null, 2));

  console.log("\n-------------------------------------------------------------");
  console.log("Dispatching Search 2: All Contacts + Any Website...");
  const payload2 = {
    industry: "Restaurant",
    state: "Uttar Pradesh",
    city: "Greater Noida",
    contactFilter: "All Contacts",
    websiteFilter: "Any Website",
    limit: 100
  };

  const res2 = await fetch('http://localhost:3000/api/leads/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload2)
  });
  const data2 = await res2.json();
  console.log("Job 2 ID:", data2.jobId);

  let result2;
  while (true) {
    await new Promise(r => setTimeout(r, 1000));
    const p = await fetch(`http://localhost:3000/api/leads/search/${data2.jobId}/progress`).then(r => r.json());
    if (p.status === 'COMPLETED' || p.status === 'FAILED') {
      result2 = await fetch(`http://localhost:3000/api/leads/search/${data2.jobId}/results`).then(r => r.json());
      break;
    }
  }

  const debug2 = await fetch(`http://localhost:3000/api/leads/search/debug/${data2.jobId}`).then(r => r.json());
  console.log("Job 2 Result Status:", result2.status, result2.searchStatus);
  console.log("Job 2 Leads Length:", result2.leads?.length);
  console.log("Job 2 Diagnostics:", JSON.stringify(debug2.diagnostics, null, 2));
  console.log("Job 2 Leads:", (result2.leads || []).map(l => ({
    name: l.businessName,
    phone: l.contact?.phone || l.phone,
    email: l.contact?.email || l.email,
    website: l.website?.url || l.websiteUrl,
    sources: l.sources
  })));
}

testDebug().catch(console.error);
