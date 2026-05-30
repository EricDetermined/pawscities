import React from 'react';
import { createClient } from '@supabase/supabase-js';

export async function ProfileInfo() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <div>Please log in </div>;
  }

  return (
    <div>
      <h1>Welcome, {user.email}</h1>
      <p>Your account is setup!</p>
    </div>
  );
}