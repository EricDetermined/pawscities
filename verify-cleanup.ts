const SUPABASE_URL = 'https://tnqctocershbclhbjnwg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRucWN0b2NlcnNoYmNsaGJqbndnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDE3NzczNSwiZXhwIjoyMDg1NzUzNzM1fQ.RVTNr46_M6ijjXm7510otr3yhh2xIRPd2HOii_II1ME';

function hasGarbledEncoding(name: string): boolean {
  const garbledPatterns = [/Ã©/,/Ã¨/,/Ã /,/Ã¢/,/Ã´/,/Ã®/,/Ã»/,/Ã¼/,/Ã§/,/Ã«/,/Ã¯/,/Ã¶/,/Ã¤/,/Ã±/,/Ã¡/,/Ã³/,/Ã­/,/Ã¹/,/Ã¦/,/Å/,/Ã‰/,/Â/];
  return garbledPatterns.some(p => p.test(name));
}

function normalizeForComparison(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

async function main() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/establishments?select=id,name,slug,city_id,status,google_place_id,photo_refs&order=name.asc`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  const all = await res.json();

  const citiesRes = await fetch(`${SUPABASE_URL}/rest/v1/cities?select=id,name,country`, {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
  });
  const cities = await citiesRes.json();
  const cityMap: Record<string, string> = {};
  cities.forEach((c: any) => { cityMap[c.id] = `${c.name}, ${c.country}`; });

  // Check for remaining garbled names
  const garbled = all.filter((e: any) => hasGarbledEncoding(e.name));
  
  // Check for remaining duplicates
  const byNormalized: Record<string, any[]> = {};
  all.forEach((e: any) => {
    const key = `${e.city_id}::${normalizeForComparison(e.name)}`;
    if (!byNormalized[key]) byNormalized[key] = [];
    byNormalized[key].push(e);
  });
  const duplicates = Object.entries(byNormalized).filter(([_, g]) => g.length > 1);

  // Check data quality
  const noPhotos = all.filter((e: any) => !e.photo_refs || e.photo_refs.length === 0);
  const noGoogle = all.filter((e: any) => !e.google_place_id);
  const active = all.filter((e: any) => e.status === 'ACTIVE');

  // Per-city breakdown
  const byCity: Record<string, number> = {};
  all.forEach((e: any) => {
    const city = cityMap[e.city_id] || 'Unknown';
    byCity[city] = (byCity[city] || 0) + 1;
  });

  console.log("=== POST-CLEANUP VERIFICATION ===\n");
  console.log(`Total establishments: ${all.length}`);
  console.log(`Active: ${active.length}`);
  console.log(`Garbled names remaining: ${garbled.length}`);
  console.log(`Duplicate groups remaining: ${duplicates.length}`);
  console.log(`Without photos: ${noPhotos.length}`);
  console.log(`Without Google Place ID: ${noGoogle.length}`);
  
  console.log("\nPer-city breakdown:");
  Object.entries(byCity).sort().forEach(([city, count]) => {
    console.log(`  ${city}: ${count}`);
  });

  if (garbled.length > 0) {
    console.log("\n⚠️ REMAINING GARBLED NAMES:");
    garbled.forEach((e: any) => console.log(`  "${e.name}" [${cityMap[e.city_id]}]`));
  }

  if (duplicates.length > 0) {
    console.log("\n⚠️ REMAINING DUPLICATES:");
    duplicates.forEach(([key, group]) => {
      console.log(`  Group: ${group.map((e: any) => `"${e.name}"`).join(' / ')}`);
    });
  }

  if (garbled.length === 0 && duplicates.length === 0) {
    console.log("\n✅ DATABASE IS CLEAN — no garbled names or duplicates found!");
  }
}

main().catch(console.error);
