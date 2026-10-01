import { multiSourceMergeActor } from '../src/actors/MultiSourceMergeActor.ts';

async function testDedupSimulation() {
  console.log('Testing MultiSourceMergeActor Duplicate Simulation...');

  const sampleBusinesses = [
    // 1. Google Places record
    {
      source: 'google_places',
      sourceId: 'places/ChIJN1t_tDeuEmsRUsoyG83frY4',
      name: 'Biryani Blues Alpha 1',
      address: 'Shop 12, Commercial Belt, Alpha 1, Greater Noida, UP, India',
      latitude: 28.4744,
      longitude: 77.5040,
      phone: '+91 9876543210',
      website: 'https://biryaniblues.com',
      types: ['restaurant', 'food'],
      sourceEvidence: {
        provider: 'google_places',
        extractedAt: new Date().toISOString(),
        url: 'https://maps.google.com/?cid=123',
      },
    },
    // 2. OpenStreetMap record for the same physical restaurant
    {
      source: 'openstreetmap',
      sourceId: 'node/987654321',
      name: 'Biryani Blues',
      address: 'Alpha 1 Commercial Belt, Greater Noida',
      latitude: 28.4746,
      longitude: 77.5042, // ~25 meters away
      phone: '098765 43210', // same phone with different formatting
      website: 'http://www.biryaniblues.com/locations',
      types: ['restaurant'],
      sourceEvidence: {
        provider: 'openstreetmap',
        extractedAt: new Date().toISOString(),
        url: 'https://www.openstreetmap.org/node/987654321',
      },
    },
    // 3. Distinct branch in Pari Chowk (>1.5 km away) - must NOT be merged!
    {
      source: 'google_places',
      sourceId: 'places/ChIJBranchPariChowk',
      name: 'Biryani Blues Pari Chowk',
      address: 'Pari Chowk Metro Station, Greater Noida',
      latitude: 28.4600,
      longitude: 77.5100,
      phone: '+91 9876543211',
      website: 'https://biryaniblues.com',
      types: ['restaurant'],
      sourceEvidence: {
        provider: 'google_places',
        extractedAt: new Date().toISOString(),
      },
    },
  ];

  const result = await multiSourceMergeActor.execute({
    jobId: 'test_job_dedup',
    input: sampleBusinesses,
  });

  if (!result.data) {
    console.error('MultiSourceMergeActor failed:', result.errors, result.warnings);
    process.exit(1);
  }

  const merged = result.data.merged;
  console.log(`Input Businesses: ${sampleBusinesses.length}`);
  console.log(`Merged Result Count: ${merged.length}`);
  console.log(`Deduplicated Count: ${result.data.deduplicatedCount}`);

  // Checks
  const alphaMerged = merged.find(b => b.name.includes('Alpha') || (b.googlePlaceId === 'places/ChIJN1t_tDeuEmsRUsoyG83frY4'));
  const pariChowkBranch = merged.find(b => b.sourceId === 'places/ChIJBranchPariChowk');

  console.log('\n--- Alpha 1 Merged Record ---');
  console.log('Name:', alphaMerged?.name);
  console.log('Sources:', alphaMerged?.sources);
  console.log('Google Place ID:', alphaMerged?.googlePlaceId);
  console.log('OSM ID:', alphaMerged?.osmId);
  console.log('Phone:', alphaMerged?.phone);
  console.log('Website:', alphaMerged?.website);

  console.log('\n--- Distinct Branch Preserved ---');
  console.log('Branch Name:', pariChowkBranch?.name);
  console.log('Branch Latitude/Longitude:', pariChowkBranch?.latitude, pariChowkBranch?.longitude);

  const testPassed = 
    merged.length === 2 &&
    alphaMerged?.sources?.includes('google_places') &&
    alphaMerged?.sources?.includes('openstreetmap') &&
    alphaMerged?.googlePlaceId === 'places/ChIJN1t_tDeuEmsRUsoyG83frY4' &&
    alphaMerged?.osmId === 'node/987654321' &&
    pariChowkBranch !== undefined;

  console.log(`\nTEST 6 RESULT: ${testPassed ? 'PASSED (Duplicate successfully merged with both source references preserved; distinct branch kept separate)' : 'FAILED'}`);
  if (!testPassed) process.exit(1);
}

testDedupSimulation().catch((err) => {
  console.error(err);
  process.exit(1);
});
