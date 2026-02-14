'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Log login event to backend for audit trail
 */
async function logLoginEvent(userId: string, provider: string, isFirstLogin: boolean = false) {
  try {
    const response = await fetch('/api/auth/login-event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        provider,
        isFirstLogin,
        timestamp: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      console.warn('Failed to log login event:', response.statusText);
    }
  } catch (error) {
    console.error('Error logging login event:', error);
    // Don't throw - logging errors shouldn't break auth
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasLoggedLoginEvent, setHasLoggedLoginEvent] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);

      // Log login event if user is authenticated
      if (session?.user && !hasLoggedLoginEvent) {
        const provider = session.user.user_metadata?.provider || 'email';
        await logLoginEvent(session.user.id, provider, false);
        setHasLoggedLoginEvent(true);
      }
    };

    getSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);

        // Log login event when user signs in
        if (event === 'SIGNED_IN' && session?.user && !hasLoggedLoginEvent) {
          const provider = session.user.user_metadata?.provider || 'email';
          await logLoginEvent(session.user.id, provider, true);
          setHasLoggedLoginEvent(true);
        }

        // Reset logged state when user signs out
        if (event === 'SIGNED_OUT') {
          setHasLoggedLoginEvent(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, hasLoggedLoginEvent]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data.user) {
        await logLoginEvent(data.user.id, 'email', false);
        setHasLoggedLoginEvent(true);
      }

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, [supabase.auth]);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    try {
      const { error, data } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      if (!error && data.user) {
        await logLoginEvent(data.user.id, 'email', true);
        setHasLoggedLoginEvent(true);
      }

      return { error };
    } catch (error) {
      return { error: error as Error };
    }
  }, [supabase.auth]);

  const signOut = useCallback(async () => {
    setHasLoggedLoginEvent(false);
    await supabase.auth.signOut();
  }, [supabase.auth]);

  const signInWithGoogle = useCallback(async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, [supabase.auth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isLoading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
