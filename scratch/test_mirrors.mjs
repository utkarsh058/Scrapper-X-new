const endpoints = [
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.osm.ch/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const q = `[out:json][timeout:10];
(
  node["amenity"="restaurant"](28.44,77.28,28.66,77.46);
  way["amenity"="restaurant"](28.44,77.28,28.66,77.46);
);
out center 15;`;

async function testAll() {
  for (const ep of endpoints) {
    const s = Date.now();
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'LeadPilot-Engine/2.1 (contact: test@leadpilot.app)',
        },
        body: 'data=' + encodeURIComponent(q),
      });
      const text = await res.text();
      const dur = Date.now() - s;
      if (text.startsWith('{')) {
        const data = JSON.parse(text);
        console.log(`[PASS] ${ep} responded in ${dur}ms with ${data.elements?.length} elements!`);
      } else {
        console.log(`[NON-JSON] ${ep} returned HTTP ${res.status} (${dur}ms): ${text.slice(0, 100)}`);
      }
    } catch (e) {
      console.log(`[FAIL] ${ep} failed in ${Date.now() - s}ms: ${e.message}`);
    }
  }
}

testAll();
