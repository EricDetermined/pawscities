/**
 * Insert the Woofstock: Badass Street Fest 2026 event into the Supabase database
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing environment variables.');
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

async function insertEvent() {
  try {
    console.log('Inserting Woofstock event...');

    const { data: event, error } = await supabase
      .from('events')
      .insert({
        city_id: '97dfceca-041f-4ba1-bb9c-3ae1f9e18933',
        slug: 'woofstock-badass-street-fest-2026-05-17',
        name: 'Woofstock: Badass Street Fest 2026',
        description: '15th anniversary dog-friendly block party, Woofstock-style. Community event with local vendors and dogs. At vendor capacity.',
        venue_name: 'President Street',
        venue_address: 'President Street (between 3rd & Nevins), Gowanus, Brooklyn, New York',
        start_date: '2026-05-17',
        end_date: '2026-05-17',
        start_time: '12:00:00',
        end_time: '17:00:00',
        timezone: 'America/New_York',
        is_featured: false,
        is_free: true,
        source: 'admin',
        status: 'APPROVED',
        source_handle: '@badassanimalrescue',
        mentioned_handles: ['@canalbarbklyn', '@titosvodka', '@evasdogcamp', '@heartofchelseavet', '@leadyourk9', '@dogwalkersprerolls'],
        tags: ['dog-friendly', 'block-party', 'community-event', 'free', 'brooklyn'],
      })
      .select('id, slug, name, created_at')
      .single();

    if (error) {
      console.error('Error inserting event:', error);
      process.exit(1);
    }

    console.log('✓ Event inserted successfully!');
    console.log(JSON.stringify(event, null, 2));
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

insertEvent();
