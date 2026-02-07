import React from 'react';
import { useSession } from '@supabase/auth-helpers-next';
import { createClient } from '@supabase/supabase-js';

export async function ProfileInfo() {
  const supabase = createClient();

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