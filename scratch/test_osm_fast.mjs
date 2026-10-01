const endpoints = [
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

async function checkNominatim() {
  const start = Date.now();
  try {
    const res = await fetch('https://nominatim.openstreetmap.org/search?q=Restaurants+in+Noida&format=json&addressdetails=1&limit=20', {
      headers: { 'User-Agent': 'LeadPilot/2.0 (contact: info@leadpilot.com)' },
    });
    const data = await res.json();
    console.log('[NOMINATIM] Responded in', Date.now() - start, 'ms! Items:', data.length);
    if (data.length > 0) {
      console.log('Sample item:', data[0].display_name);
    }
  } catch (e) {
    console.log('[NOMINATIM FAIL]', e.message);
  }
}

async function testWithTimeout() {
  await checkNominatim();

  const q = `[out:json][timeout:5];(node["amenity"="restaurant"](28.44,77.28,28.66,77.46););out 10;`;
  for (const ep of endpoints) {
    const start = Date.now();
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadPilot/2.0' },
        body: 'data=' + encodeURIComponent(q),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      const text = await res.text();
      console.log(`[${ep}] Status: ${res.status}, time: ${Date.now() - start}ms, isJson: ${text.startsWith('{')}`);
    } catch (e) {
      clearTimeout(t);
      console.log(`[${ep}] Error: ${e.message} in ${Date.now() - start}ms`);
    }
  }
}

testWithTimeout();
