const q = `[out:json][timeout:10];
(
  node["amenity"="restaurant"](28.44,77.28,28.66,77.46);
  way["amenity"="restaurant"](28.44,77.28,28.66,77.46);
);
out center 50;`;

const start = Date.now();
fetch('https://overpass-api.de/api/interpreter', {
  method: 'POST',
  body: 'data=' + encodeURIComponent(q),
})
  .then((r) => r.json())
  .then((d) => console.log('BBOX QUERY SUCCESS in', Date.now() - start, 'ms! Found elements:', d.elements?.length))
  .catch((e) => console.error('FAIL:', e));
