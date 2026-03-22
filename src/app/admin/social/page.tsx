'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Opportunity {
  id: string;
  permalink: string;
  caption: string;
  category: string;
  suggested_reply: string;
  likes: number;
  comments: number;
  source_username: string | null;
  hashtag: string | null;
  status: string;
  posted_at: string;
}

interface Comment {
  id: string;
  username: string;
  text: string;
  post_id: string;
  replied: boolean;
  commented_at: string;
}

export default function SocialDashboard() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activeTab, setActiveTab] = useState<'opportunities' | 'comments'>('opportunities');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/admin/social?type=opportunities').then(r => r.json()),
      fetch('/api/admin/social?type=comments').then(r => r.json()),
    ])
      .then(([opps, comms]) => {
        setOpportunities(opps.opportunities || []);
        setComments(comms.comments || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const markEngaged = async (id: string) => {
    await fetch('/api/admin/social', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'opportunity', status: 'engaged' }),
    });
    setOpportunities(prev => prev.map(o => o.id === id ? { ...o, status: 'engaged' } : o));
  };

  const skipOpportunity = async (id: string) => {
    await fetch('/api/admin/social', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'opportunity', status: 'skipped' }),
    });
    setOpportunities(prev => prev.filter(o => o.id !== id));
  };

  const markReplied = async (id: string) => {
    await fetch('/api/admin/social', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'comment', replied: true }),
    });
    setComments(prev => prev.map(c => c.id === id ? { ...c, replied: true } : c));
  };

  if (loading) return <div className="flex items-center justify-center h-96"><div className="text-gray-500">Loading social dashboard...</div></div>;

  const pendingOpps = opportunities.filter(o => o.status === 'new');
  const unrepliedComments = comments.filter(c => !c.replied);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Media Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">{pendingOpps.length} pending opportunities, {unrepliedComments.length} unreplied comments</p>
        </div>
        <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-700">Back to Admin</Link>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setActiveTab('opportunities')} className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'opportunities' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
          Opportunities ({pendingOpps.length})
        </button>
        <button onClick={() => setActiveTab('comments')} className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-colors ${activeTab === 'comments' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'}`}>
          Comments ({unrepliedComments.length})
        </button>
      </div>

      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {pendingOpps.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">🎉</div>
              <p className="text-gray-500">No pending opportunities. The outreach agent runs daily at 11 AM UTC.</p>
            </div>
          ) : pendingOpps.map(opp => (
            <div key={opp.id} className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  opp.category === 'food' ? 'bg-orange-100 text-orange-700' :
                  opp.category === 'outdoors' ? 'bg-green-100 text-green-700' :
                  opp.category === 'travel' ? 'bg-blue-100 text-blue-700' :
                  opp.category === 'watchlist' ? 'bg-purple-100 text-purple-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{opp.category}</span>
                {opp.hashtag && <span className="text-xs text-gray-400">#{opp.hashtag}</span>}
                {opp.source_username && <span className="text-xs text-gray-400">@{opp.source_username}</span>}
                <span className="text-xs text-gray-400">{opp.likes} likes</span>
              </div>
              <p className="text-sm text-gray-700 mb-3 line-clamp-2">{opp.caption}</p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                <p className="text-xs font-medium text-orange-800 mb-1">Suggested Reply:</p>
                <p className="text-sm text-orange-700">{opp.suggested_reply}</p>
              </div>
              <div className="flex items-center gap-3">
                <a href={opp.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-orange-600 hover:underline">Open on Instagram</a>
                <button onClick={() => markEngaged(opp.id)} className="text-xs text-green-600 hover:underline">Mark Engaged</button>
                <button onClick={() => skipOpportunity(opp.id)} className="text-xs text-gray-400 hover:underline">Skip</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'comments' && (
        <div className="space-y-3">
          {unrepliedComments.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-gray-500">All caught up! No unreplied comments.</p>
            </div>
          ) : unrepliedComments.map(comment => (
            <div key={comment.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm"><strong className="text-gray-900">@{comment.username}</strong> <span className="text-gray-600">{comment.text}</span></p>
                <p className="text-xs text-gray-400 mt-1">{new Date(comment.commented_at).toLocaleString()}</p>
              </div>
              <button onClick={() => markReplied(comment.id)} className="text-xs text-green-600 border border-green-200 px-3 py-1.5 rounded-lg hover:bg-green-50 whitespace-nowrap">
                Mark Replied
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
