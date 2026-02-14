/**
 * Supabase Auth Webhook Handler
 * Handles user.created, user.updated, user.deleted events
 * Synchronizes user data with database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { verifyWebhookSignature, extractRequestInfo } from '@/lib/security';
import { logDataProcessing } from '@/lib/gdpr';
import { prisma } from '@/lib/db';

interface SupabaseWebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: {
    id: string;
    email: string;
    user_metadata?: {
      name?: string;
      avatar_url?: string;
      provider?: string;
      providers?: string[];
    };
    raw_user_meta_data?: Record<string, any>;
    created_at: string;
    updated_at: string;
  };
  schema?: string;
  table?: string;
  old_record?: any;
}

interface WebhookEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted';
  created_at: string;
  data: SupabaseWebhookPayload;
}

function extractUserMetadata(record: SupabaseWebhookPayload['record']) {
  return {
    name: record.user_metadata?.name || record.raw_user_meta_data?.name,
    avatar: record.user_metadata?.avatar_url || record.raw_user_meta_data?.avatar_url,
    provider: record.user_metadata?.provider || 'email',
    providers: record.user_metadata?.providers || ['email'],
  };
}

async function handleUserCreated(payload: SupabaseWebhookPayload, request: NextRequest) {
  const { ip, userAgent, country } = extractRequestInfo(request);
  const metadata = extractUserMetadata(payload);
  try {
    const existingUser = await prisma.user.findUnique({ where: { supabaseId: payload.id } });
    if (existingUser) { console.log(`User ${payload.id} already exists`); return; }
    const user = await prisma.user.create({
      data: {
        supabaseId: payload.id, email: payload.email, name: metadata.name,
        avatar: metadata.avatar, language: 'en', role: 'USER', emailVerified: null,
      },
    });
    await logDataProcessing(user.id, 'login', { event: 'user_created', provider: metadata.provider, source: 'auth_webhook', metadata: { providers: metadata.providers, timestamp: payload.created_at } }, ip, userAgent);
    console.log(`User created: ${user.id} (${payload.email})`);
    return NextResponse.json({ success: true, userId: user.id }, { status: 201 });
  } catch (error) {
    console.error('Error handling user.created webhook:', error);
    await logDataProcessing(payload.id, 'login', { event: 'user_created_failed', error: error instanceof Error ? error.message : 'Unknown error', provider: metadata.provider }, ip, userAgent).catch(err => console.error('Failed to log error:', err));
    throw error;
  }
}

async function handleUserUpdated(payload: SupabaseWebhookPayload, request: NextRequest) {
  const { ip, userAgent } = extractRequestInfo(request);
  const metadata = extractUserMetadata(payload);
  try {
    const user = await prisma.user.findUnique({ where: { supabaseId: payload.id } });
    if (!user) { console.warn(`User ${payload.id} not found for update`); return NextResponse.json({ error: 'User not found' }, { status: 404 }); }
    const updateData: any = {};
    if (metadata.name && metadata.name !== user.name) updateData.name = metadata.name;
    if (metadata.avatar && metadata.avatar !== user.avatar) updateData.avatar = metadata.avatar;
    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({ where: { id: user.id }, data: updateData });
      await logDataProcessing(user.id, 'data_access', { event: 'user_updated', updatedFields: Object.keys(updateData) }, ip, userAgent);
      console.log(`User updated: ${user.id}`);
    }
    return NextResponse.json({ success: true, userId: user.id }, { status: 200 });
  } catch (error) {
    console.error('Error handling user.updated webhook:', error);
    await logDataProcessing(payload.id, 'login', { event: 'user_updated_failed', error: error instanceof Error ? error.message : 'Unknown error' }, ip, userAgent).catch(err => console.error('Failed to log error:', err));
    throw error;
  }
}

async function handleUserDeleted(payload: SupabaseWebhookPayload, request: NextRequest) {
  const { ip, userAgent } = extractRequestInfo(request);
  try {
    const user = await prisma.user.findUnique({ where: { supabaseId: payload.id } });
    if (!user) { console.warn(`User ${payload.id} not found for deletion`); return NextResponse.json({ error: 'User not found' }, { status: 404 }); }
    await logDataProcessing(user.id, 'deletion', { event: 'user_deleted_from_auth', email: payload.email, timestamp: payload.updated_at }, ip, userAgent);
    await prisma.user.update({ where: { id: user.id }, data: { email: `deleted-${user.id}@deleted.pawscities.local`, name: 'Deleted User', avatar: null, homeCity: null } });
    await prisma.review.updateMany({ where: { userId: user.id }, data: { title: '[Deleted]', content: 'This review was removed.', dogNames: null, reviewPhotos: [] } });
    console.log(`User deleted: ${user.id} (${payload.email})`);
    return NextResponse.json({ success: true, userId: user.id }, { status: 200 });
  } catch (error) {
    console.error('Error handling user.deleted webhook:', error);
    await logDataProcessing(payload.id, 'deletion', { event: 'user_deleted_failed', error: error instanceof Error ? error.message : 'Unknown error', email: payload.email }, ip, userAgent).catch(err => console.error('Failed to log error:', err));
    throw error;
  }
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-webhook-signature');
    const secret = process.env.SUPABASE_WEBHOOK_SECRET;
    if (!signature || !secret) { console.warn('Missing webhook signature or secret'); return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    const body = await request.text();
    if (!verifyWebhookSignature(body, signature, secret)) { console.warn('Invalid webhook signature'); return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }
    const event: WebhookEvent = JSON.parse(body);
    if (event.type === 'user.created') return await handleUserCreated(event.data, request);
    else if (event.type === 'user.updated') return await handleUserUpdated(event.data, request);
    else if (event.type === 'user.deleted') return await handleUserDeleted(event.data, request);
    else { console.warn(`Unknown webhook event type: ${event.type}`); return NextResponse.json({ error: 'Unknown event type' }, { status: 400 }); }
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed', message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({ allowed: ['POST'] }, { status: 200 });
}
