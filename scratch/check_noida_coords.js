const fetch = globalThis.fetch;

async function checkNoidaHotels() {
  const ep = 'https://lz4.overpass-api.de/api/interpreter';

  const q = `[out:json][timeout:25];
area["name"="Uttar Pradesh"]->.stateArea;
area["name"="Noida"](area.stateArea)->.searchArea;
(
  nwr["tourism"~"hotel|guest_house|hostel|motel|apartment|resort"](area.searchArea);
  nwr["building"="hotel"](area.searchArea);
  nwr["amenity"="hotel"](area.searchArea);
);
out center;`;

  const res = await fetch(ep, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadPilot/2.0', 'Accept': 'application/json' },
    body: 'data=' + encodeURIComponent(q)
  });
  const data = await res.json();
  console.log(`Total hotel elements in Noida Area: ${data.elements?.length}`);

  const noidaBbox = { south: 28.48, west: 77.30, north: 28.64, east: 77.44 };

  let inBounds = 0;
  let outBounds = 0;

  data.elements?.forEach(e => {
    const lat = e.lat ?? e.center?.lat;
    const lon = e.lon ?? e.center?.lon;
    const name = e.tags?.name || 'Unnamed';
    const tag = e.tags?.tourism || e.tags?.building || e.tags?.amenity;
    const inside = lat >= noidaBbox.south - 0.03 && lat <= noidaBbox.north + 0.03 &&
                   lon >= noidaBbox.west - 0.03 && lon <= noidaBbox.east + 0.03;
    if (inside) inBounds++; else outBounds++;
    console.log(`- ${e.type}/${e.id}: "${name}" [${tag}] lat=${lat}, lon=${lon} => ${inside ? 'IN_BOUNDS' : 'OUT_OF_BOUNDS'}`);
  });

  console.log(`\nIn bounds: ${inBounds}, Out of bounds: ${outBounds}`);
}

checkNoidaHotels();
