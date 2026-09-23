import { NextRequest, NextResponse } from 'next/server';
import { acquireIgLock, releaseIgLock, getIgLockState } from '@/lib/ig-lock';

export const dynamic = 'force-dynamic';

/**
 * Cross-surface Instagram activity lock control (2026-09-22).
 *
 * The browser engagement/discovery scheduled tasks call this to signal when they
 * are actively driving @thepawcities, so the Graph-API posting crons defer and
 * the two surfaces never automate the account concurrently (August-2026
 * suspension risk). See src/lib/ig-lock.ts for the full rationale.
 *
 * POST { secret, action: 'acquire' | 'release', owner? }  (secret = CRON_SECRET)
 * GET  → current lock state (no secret required; read-only, non-sensitive)
 */

export async function POST(request: NextRequest) {
  let body: { secret?: string; action?: string; owner?: string };
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'bad_json' }, { status: 400 }); }

  if (body.secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (body.action !== 'acquire' && body.action !== 'release') {
    return NextResponse.json({ error: "action must be 'acquire' or 'release'" }, { status: 400 });
  }

  try {
    if (body.action === 'acquire') await acquireIgLock(body.owner);
    else await releaseIgLock();
    const state = await getIgLockState();
    return NextResponse.json({ success: true, action: body.action, state });
  } catch (err) {
    console.error('[IG-LOCK] error:', err);
    return NextResponse.json({ error: 'lock_op_failed' }, { status: 500 });
  }
}

export async function GET() {
  const state = await getIgLockState();
  return NextResponse.json(state);
}
