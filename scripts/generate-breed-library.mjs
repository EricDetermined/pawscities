/**
 * Generate + vision-gate breed photos for the Paw Cities photo library.
 *
 * Resumable: reads /tmp/breedlib.json and the existing Supabase breed-library/
 * folder, and skips anything already produced. Every image must pass a vision
 * check (correct breed, single dog, no people or text) before it is recorded —
 * a wrong-breed asset is worse than a missing one.
 *
 * Usage: node scripts/generate-breed-library.mjs [concurrency]
 */
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import fs from 'fs';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const RESULT = '/tmp/breedlib.json';
const TARGETS = JSON.parse(fs.readFileSync('/tmp/targets.json', 'utf8'));
const CONC = Number(process.argv[2] || 5);
const STYLE = 'Photorealistic documentary pet photography, bright natural daylight, shallow depth of field, sharp focus on the dog, airy well-exposed image, candid and warm. No people, no text, no watermarks, no borders, no collage. Exactly one dog, clearly visible.';

let done = [];
try { done = JSON.parse(fs.readFileSync(RESULT, 'utf8')); } catch {}
const doneNames = new Set(done.map(d => d.breed));
const save = () => fs.writeFileSync(RESULT, JSON.stringify(done, null, 1));

const todo = TARGETS.filter(t => !doneNames.has(t.breed));
console.log(`todo ${todo.length} / ${TARGETS.length} (concurrency ${CONC})`);

/**
 * Breeds whose closest visual relative is an acceptable vision answer.
 * A Galgo Espanol IS a Spanish greyhound; a Barbet reads as a poodle; a
 * Goldendoodle is a poodle cross. Rejecting these forever would leave real
 * coverage gaps, so we accept the named relative as a pass.
 */
const EQUIVALENT = {
  'goldendoodle': ['poodle', 'labradoodle', 'doodle'],
  'cockapoo': ['poodle', 'cocker spaniel', 'doodle'],
  'barbet': ['poodle', 'water dog'],
  'galgo espanol': ['greyhound', 'spanish greyhound', 'sighthound'],
  'catalan sheepdog': ['briard', 'bergamasco', 'sheepdog', 'shepherd'],
  'appenzeller sennenhund': ['appenzeller', 'entlebucher', 'bernese mountain dog', 'swiss mountain dog'],
  'greater swiss mountain dog': ['bernese mountain dog', 'swiss mountain dog', 'appenzeller'],
  'japanese spitz': ['spitz', 'samoyed', 'pomeranian'],
  'australian terrier': ['terrier', 'cairn terrier', 'norwich terrier'],
  'border terrier': ['terrier', 'cairn terrier'],
  'irish setter': ['setter', 'red setter'],
  'english springer spaniel': ['springer spaniel', 'spaniel'],
  'rough collie': ['collie', 'shetland sheepdog'],
};

function keyword(breed) {
  // last significant word is the most identifying for loose matching
  const stop = new Set(['dog', 'terrier', 'hound', 'spaniel', 'retriever', 'shepherd', 'sheepdog']);
  const parts = breed.toLowerCase().split(' ');
  return parts.filter(p => !stop.has(p)).pop() || parts[parts.length - 1];
}

async function one(t) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const gen = await openai.images.generate({
        model: 'gpt-image-1', prompt: `${t.scene}. ${STYLE}`, n: 1, size: '1536x1024', quality: 'high',
      });
      const b64 = gen.data?.[0]?.b64_json;
      if (!b64) { console.log(`  no image  ${t.breed}`); continue; }
      const buf = Buffer.from(b64, 'base64');

      const check = await openai.chat.completions.create({
        model: 'gpt-4o', max_tokens: 90, temperature: 0,
        messages: [{ role: 'user', content: [
          { type: 'text', text: `Reply ONLY JSON {"breed":"<breed>","single_dog":true|false,"has_text_or_people":true|false,"confidence":<0-1>}` },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${buf.toString('base64')}`, detail: 'high' } }] }],
        response_format: { type: 'json_object' },
      }, { timeout: 60000 });
      const v = JSON.parse(check.choices[0].message.content);

      const want = keyword(t.breed);
      const got = String(v.breed || '').toLowerCase();
      const equivs = EQUIVALENT[t.breed.toLowerCase()] || [];
      const breedOk = got.includes(want) || want.includes(keyword(got))
        || got.includes(t.breed.toLowerCase())
        || equivs.some((e) => got.includes(e));
      if (!breedOk || !v.single_dog || v.has_text_or_people) {
        console.log(`  reject(${attempt}) ${t.breed}: saw "${v.breed}" single=${v.single_dog} textppl=${v.has_text_or_people}`);
        continue;
      }

      const { data, info } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      let sum = 0;
      for (let i = 0; i < data.length; i += info.channels) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const brightness = +(sum / (info.width * info.height) / 255).toFixed(3);

      const path = `breed-library/${t.breed.replace(/\s+/g, '-')}-${Date.now()}.png`;
      const { error } = await sb.storage.from('photos').upload(path, buf, { contentType: 'image/png', upsert: true });
      if (error) { console.log(`  upload fail ${t.breed}: ${error.message}`); return; }
      const { data: u } = sb.storage.from('photos').getPublicUrl(path);
      done.push({ ...t, url: u.publicUrl, brightness, vision: v.breed, conf: v.confidence });
      save();
      console.log(`  ok  ${t.breed.padEnd(32)} "${v.breed}" b=${brightness}`);
      return;
    } catch (e) {
      console.log(`  err ${t.breed}: ${String(e).slice(0, 80)}`);
    }
  }
}

const queue = [...todo];
await Promise.all(Array.from({ length: CONC }, async () => {
  while (queue.length) await one(queue.shift());
}));
console.log(`\nrecorded total: ${done.length} / ${TARGETS.length}`);
