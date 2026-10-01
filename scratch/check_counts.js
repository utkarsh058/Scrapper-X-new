const fetch = globalThis.fetch;

async function checkCounts() {
  const ep = 'https://lz4.overpass-api.de/api/interpreter';

  const queries = [
    {
      name: 'Noida Hotels',
      ql: `[out:json][timeout:25];
area["name"="Uttar Pradesh"]->.stateArea;
area["name"="Noida"](area.stateArea)->.searchArea;
(
  nwr["tourism"~"hotel|guest_house|hostel|motel|resort"](area.searchArea);
  nwr["building"="hotel"](area.searchArea);
);
out count;`
    },
    {
      name: 'Noida Restaurants',
      ql: `[out:json][timeout:25];
area["name"="Uttar Pradesh"]->.stateArea;
area["name"="Noida"](area.stateArea)->.searchArea;
(
  nwr["amenity"~"restaurant|fast_food"](area.searchArea);
);
out count;`
    },
    {
      name: 'Delhi Cafes',
      ql: `[out:json][timeout:25];
area["name"="Delhi"]->.stateArea;
(
  nwr["amenity"="cafe"](area.stateArea);
);
out count;`
    },
    {
      name: 'Mumbai Restaurants',
      ql: `[out:json][timeout:25];
area["name"="Maharashtra"]->.stateArea;
area["name"="Mumbai"](area.stateArea)->.searchArea;
(
  nwr["amenity"="restaurant"](area.searchArea);
);
out count;`
    }
  ];

  for (const q of queries) {
    try {
      const res = await fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'LeadPilot/2.0', 'Accept': 'application/json' },
        body: 'data=' + encodeURIComponent(q.ql)
      });
      const data = await res.json();
      console.log(`${q.name} count element:`, JSON.stringify(data.elements));
    } catch(e) {
      console.error(q.name, 'error:', e.message);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
}

checkCounts();
