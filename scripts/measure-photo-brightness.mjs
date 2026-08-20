import sharp from 'sharp';
import fs from 'fs';
const src = fs.readFileSync('src/lib/dog-photos.ts','utf8');
const ids = [...src.matchAll(/\{ id: '([^']+)', breed: '([^']+)'/g)].map(m=>({id:m[1],breed:m[2]}));
console.log('photos:', ids.length);
const out = {};
let fail=0;
await Promise.all(ids.map(async ({id,breed}) => {
  const url = `https://images.unsplash.com/${id}?w=200&h=120&fit=crop&q=60`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!r.ok) { out[id]={err:r.status}; fail++; return; }
    const buf = Buffer.from(await r.arrayBuffer());
    // mean luminance over the whole frame, plus the lower half where card text sits
    const img = sharp(buf).removeAlpha();
    const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
    const px = info.width*info.height;
    let sum=0;
    for (let i=0;i<data.length;i+=info.channels){
      sum += 0.2126*data[i] + 0.7152*data[i+1] + 0.0722*data[i+2];
    }
    out[id] = { breed, lum: +(sum/px/255).toFixed(3) };
  } catch(e){ out[id]={err:String(e).slice(0,40)}; fail++; }
}));
fs.writeFileSync('/tmp/brightness.json', JSON.stringify(out,null,1));
const vals = Object.entries(out).filter(([,v])=>v.lum!=null);
vals.sort((a,b)=>a[1].lum-b[1].lum);
console.log('measured:', vals.length, '| failed:', fail);
console.log('\nDARKEST 12:');
vals.slice(0,12).forEach(([id,v])=>console.log('  ', v.lum.toFixed(3), v.breed, id));
console.log('\nBRIGHTEST 6:');
vals.slice(-6).forEach(([id,v])=>console.log('  ', v.lum.toFixed(3), v.breed, id));
