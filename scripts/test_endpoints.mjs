async function test() {
  const tests = [
    { name: 'lite.duckduckgo.com', url: 'https://lite.duckduckgo.com/lite/', opts: { method: 'POST', body: 'q=restaurants+in+greater+noida', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) } },
    { name: 'duckduckgo html', url: 'https://html.duckduckgo.com/html/?q=restaurants', opts: { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(4000) } },
    { name: 'nominatim', url: 'https://nominatim.openstreetmap.org/search?q=restaurants+in+greater+noida&format=json', opts: { headers: { 'User-Agent': 'LeadPilot/1.0' }, signal: AbortSignal.timeout(4000) } },
    { name: 'wikidata', url: 'https://query.wikidata.org/sparql?query=SELECT%20*%20WHERE%20%7B%20%3Fs%20%3Fp%20%3Fo%20%7D%20LIMIT%201&format=json', opts: { headers: { 'User-Agent': 'LeadPilot/1.0' }, signal: AbortSignal.timeout(4000) } }
  ];

  for (const t of tests) {
    try {
      const res = await fetch(t.url, t.opts);
      console.log(t.name, 'STATUS:', res.status);
    } catch (e) {
      console.log(t.name, 'ERROR:', e.message);
    }
  }
}
test();
