const fetch = globalThis.fetch;

async function inspectNoidaHotels() {
  const ep = 'https://lz4.overpass-api.de/api/interpreter';

  // Test 1: Current area query
  const q1 = `[out:json][timeout:25];
area["name"="Uttar Pradesh"]->.stateArea;
area["name"="Noida"](area.stateArea)->.searchArea;
(
  nwr["tourism"="hotel"](area.searchArea);
  nwr["tourism"="guest_house"](area.searchArea);
);
out center;`;

  // Test 2: Direct Noida area
  const q2 = `[out:json][timeout:25];
area["name"="Noida"]->.searchArea;
(
  nwr["tourism"="hotel"](area.searchArea);
  nwr["tourism"="guest_house"](area.searchArea);
  nwr["tourism"="hostel"](area.searchArea);
  nwr["tourism"="motel"](area.searchArea);
  nwr["building"="hotel"](area.searchArea);
);
out center;`;

  // Test 3: What areas exist named Noida?
  const q3 = `[out:json][timeout:25];
area["name"="Noida"];
out;`;

  // Test 4: Bounding box of Noida
  // Let's see what the bbox of Noida has:
  const q4 = `[out:json][timeout:25];
(
  nwr["tourism"="hotel"](28.45,77.28,28.66,77.46);
  nwr["tourism"="guest_house"](28.45,77.28,28.66,77.46);
  nwr["tourism"="hostel"](28.45,77.28,28.66,77.46);
  nwr["tourism"="motel"](28.45,77.28,28.66,77.46);
  nwr["building"="hotel"](28.45,77.28,28.66,77.46);
);
out center;`;

  console.log('--- TEST 1: Area stateArea -> cityArea ---');
  try {
    const res1 = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadPilot/2.0', 'Accept': 'application/json' },
      body: 'data=' + encodeURIComponent(q1)
    });
    const d1 = await res1.json();
    console.log('Test 1 Count:', d1.elements?.length);
    d1.elements?.forEach(e => console.log('T1:', e.type, e.id, e.tags?.name, e.tags?.tourism, e.tags?.building));
  } catch(e) { console.error('T1 err', e.message); }

  console.log('\n--- TEST 2: Direct Noida Area with broader tags ---');
  try {
    const res2 = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadPilot/2.0', 'Accept': 'application/json' },
      body: 'data=' + encodeURIComponent(q2)
    });
    const d2 = await res2.json();
    console.log('Test 2 Count:', d2.elements?.length);
  } catch(e) { console.error('T2 err', e.message); }

  console.log('\n--- TEST 3: Areas named Noida ---');
  try {
    const res3 = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadPilot/2.0', 'Accept': 'application/json' },
      body: 'data=' + encodeURIComponent(q3)
    });
    const d3 = await res3.json();
    console.log('Test 3 Areas Count:', d3.elements?.length);
    d3.elements?.forEach(e => console.log('Area:', e.id, e.tags?.name, e.tags?.admin_level, e.tags?.boundary));
  } catch(e) { console.error('T3 err', e.message); }

  console.log('\n--- TEST 4: Bounding Box (28.45,77.28,28.66,77.46) ---');
  try {
    const res4 = await fetch(ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadPilot/2.0', 'Accept': 'application/json' },
      body: 'data=' + encodeURIComponent(q4)
    });
    const d4 = await res4.json();
    console.log('Test 4 Count:', d4.elements?.length);
    console.log('Sample elements from Test 4:');
    d4.elements?.slice(0, 10).forEach(e => console.log('T4:', e.type, e.id, e.tags?.name, e.tags?.tourism, e.tags?.building, e.lat ?? e.center?.lat, e.lon ?? e.center?.lon));
  } catch(e) { console.error('T4 err', e.message); }
}

inspectNoidaHotels();
