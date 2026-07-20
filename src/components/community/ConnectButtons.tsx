'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ConnectButtonsProps {
  ownerId: string;
  isAuthenticated: boolean;
  initialFollowing: boolean;
  /** null | 'requested' | 'incoming' | 'accepted' */
  initialPackStatus: string | null;
}

/**
 * Follow (one-way, instant) + Pack (mutual, approval) buttons
 * shown on public dog / owner profiles.
 */
export function ConnectButtons({
  ownerId,
  isAuthenticated,
  initialFollowing,
  initialPackStatus,
}: ConnectButtonsProps) {
  const router = useRouter();
  const [following, setFollowing] = useState(initialFollowing);
  const [packStatus, setPackStatus] = useState<string | null>(initialPackStatus);
  const [busy, setBusy] = useState<string | null>(null);

  const requireAuth = () => {
    if (!isAuthenticated) {
      router.push('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return false;
    }
    return true;
  };

  const toggleFollow = async () => {
    if (!requireAuth() || busy) return;
    setBusy('follow');
    try {
      const res = await fetch('/api/community/follow', {
        method: following ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ownerId }),
      });
      if (res.ok) setFollowing(!following);
    } finally {
      setBusy(null);
    }
  };

  const handlePack = async () => {
    if (!requireAuth() || busy) return;
    if (packStatus === 'accepted' || packStatus === 'requested') {
      // Leave pack / cancel request
      setBusy('pack');
      try {
        const res = await fetch('/api/community/pack', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: ownerId }),
        });
        if (res.ok) setPackStatus(null);
      } finally {
        setBusy(null);
      }
      return;
    }
    // Send request (server auto-accepts if they already asked us)
    setBusy('pack');
    try {
      const res = await fetch('/api/community/pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: ownerId }),
      });
      if (res.ok) {
        const data = await res.json();
        setPackStatus(data.status);
      }
    } finally {
      setBusy(null);
    }
  };

  const packLabel =
    packStatus === 'accepted'
      ? '✓ In your pack'
      : packStatus === 'requested'
        ? 'Pack requested'
        : packStatus === 'incoming'
          ? 'Accept pack request'
          : '+ Join packs';

  return (
    <div className="flex gap-2">
      <button
        onClick={toggleFollow}
        disabled={busy === 'follow'}
        className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60 ${
          following
            ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            : 'bg-orange-500 text-white hover:bg-orange-600'
        }`}
      >
        {following ? '✓ Following' : '+ Follow'}
      </button>
      <button
        onClick={handlePack}
        disabled={busy === 'pack'}
        title="Pack members are mutual connections — both sides agree"
        className={`px-5 py-2.5 rounded-lg font-medium text-sm transition-colors disabled:opacity-60 ${
          packStatus === 'accepted'
            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
            : packStatus === 'requested'
              ? 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              : 'border border-gray-300 text-gray-700 hover:border-orange-400 hover:text-orange-600'
        }`}
      >
        {packLabel}
      </button>
    </div>
  );
}
