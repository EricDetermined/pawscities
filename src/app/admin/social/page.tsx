'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface ContentItem {
  city: string;
  headline: string;
  preview: string;
  caption: string;
}

interface RecentPost {
  id: string;
  caption: string;
  timestamp: string;
  permalink: string;
}

interface QueueData {
  contentBank: {
    totalFacts: number;
    byCityCount: Record<string, number>;
  };
  recentInstagramPosts: RecentPost[];
  recentError: string | null;
  upcomingPosts: ContentItem[];
}

interface PublishResult {
  status: string;
  postId?: string;
  containerId?: string;
  error?: string;
}

export default function SocialMediaPage() {
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState<string | null>(null);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'recent' | 'bank'>('upcoming');

  const fetchQueue = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/social/queue');
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status}`);
      }
      const data = await response.json();
      setQueueData(data);
      setError(null);
    } catch (err) {
      console.error('Error fetching social queue:', err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const handlePublish = async (headline: string) => {
    if (!confirm(`Publish post: "${headline}"?\n\nNote: You'll need to provide an image URL. This will post immediately to Instagram.`)) {
      return;
    }

    const imageUrl = prompt('Enter the image URL for this post (Google Places photo URL or any public image URL):');
    if (!imageUrl) return;

    setPublishing(headline);
    setPublishResult(null);

    try {
      const response = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headline, imageUrl }),
      });
      const result = await response.json();

      if (!response.ok) {
        setPublishResult({ status: 'error', error: result.error });
      } else {
        setPublishResult(result);
        // Refresh queue data
        fetchQueue();
      }
    } catch (err) {
      setPublishResult({ status: 'error', error: String(err) });
    } finally {
      setPublishing(null);
    }
  };

  const cronScheduleText = 'Monday, Wednesday, Friday at 2:00 PM UTC';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Social Media</h1>
          <p className="text-gray-600">
            Manage Instagram auto-posting and content queue
          </p>
        </div>
        <button
          onClick={fetchQueue}
          disabled={loading}
          className="px-4 py-2 bg-white border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Auto-Posting Status Card */}
      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Auto-Posting Schedule</h2>
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
            Active
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Schedule</p>
            <p className="font-medium text-gray-900">{cronScheduleText}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Platform</p>
            <p className="font-medium text-gray-900">Instagram (Meta Graph API)</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="text-sm text-gray-500 mb-1">Content Bank</p>
            <p className="font-medium text-gray-900">
              {queueData ? `${queueData.contentBank.totalFacts} facts across ${Object.keys(queueData.contentBank.byCityCount).length} cities` : '...'}
            </p>
          </div>
        </div>
      </div>

      {/* Publish Result Banner */}
      {publishResult && (
        <div className={`rounded-xl border p-4 ${publishResult.status === 'published' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center justify-between">
            <div>
              {publishResult.status === 'published' ? (
                <p className="text-green-800 font-medium">
                  Post published successfully! (ID: {publishResult.postId})
                </p>
              ) : (
                <p className="text-red-800 font-medium">
                  Publish failed: {publishResult.error}
                </p>
              )}
            </div>
            <button
              onClick={() => setPublishResult(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="border-b flex">
          <button
            onClick={() => setActiveTab('upcoming')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'upcoming'
                ? 'border-b-2 border-primary-500 text-primary-700 bg-primary-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Upcoming Posts ({queueData?.upcomingPosts.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('recent')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'recent'
                ? 'border-b-2 border-primary-500 text-primary-700 bg-primary-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Recent Instagram Posts ({queueData?.recentInstagramPosts.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`px-6 py-3 text-sm font-medium transition-colors ${
              activeTab === 'bank'
                ? 'border-b-2 border-primary-500 text-primary-700 bg-primary-50'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            Content Bank
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-100 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* Upcoming Posts Tab */}
              {activeTab === 'upcoming' && (
                <div className="space-y-4">
                  {queueData?.upcomingPosts.length === 0 ? (
                    <p className="text-gray-500 text-center py-8">All content has been posted! Add more facts to the content bank.</p>
                  ) : (
                    queueData?.upcomingPosts.map((post, index) => (
                      <div key={index} className="border rounded-lg p-4 hover:border-primary-300 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                                {post.city}
                              </span>
                              <span className="text-xs text-gray-400">#{index + 1} in queue</span>
                            </div>
                            <h3 className="font-medium text-gray-900 mb-1">{post.headline}</h3>
                            <p className="text-sm text-gray-600">{post.preview}</p>
                          </div>
                          <button
                            onClick={() => handlePublish(post.headline)}
                            disabled={publishing === post.headline}
                            className="ml-4 px-3 py-1.5 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center gap-1 shrink-0"
                          >
                            {publishing === post.headline ? (
                              <>
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                </svg>
                                Publishing...
                              </>
                            ) : (
                              'Publish Now'
                            )}
                          </button>
                        </div>
                        {/* Expandable caption preview */}
                        <details className="mt-3">
                          <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                            Preview full caption
                          </summary>
                          <pre className="mt-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap font-sans">
                            {post.caption}
                          </pre>
                        </details>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Recent Instagram Posts Tab */}
              {activeTab === 'recent' && (
                <div className="space-y-4">
                  {queueData?.recentError && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                      Instagram API warning: {queueData.recentError}
                    </div>
                  )}
                  {(!queueData?.recentInstagramPosts || queueData.recentInstagramPosts.length === 0) ? (
                    <p className="text-gray-500 text-center py-8">
                      No recent Instagram posts found. {queueData?.recentError ? 'Check your Meta API credentials.' : 'Start posting to see them here.'}
                    </p>
                  ) : (
                    queueData.recentInstagramPosts.map((post) => (
                      <div key={post.id} className="border rounded-lg p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">{post.caption}</p>
                            <p className="text-xs text-gray-400 mt-2">
                              {new Date(post.timestamp).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          {post.permalink && (
                            <a
                              href={post.permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-4 px-3 py-1.5 border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors shrink-0 flex items-center gap-1"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                              View
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Content Bank Tab */}
              {activeTab === 'bank' && (
                <div>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      {queueData?.contentBank.totalFacts} total facts ready for auto-posting, distributed across cities:
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {queueData?.contentBank.byCityCount &&
                      Object.entries(queueData.contentBank.byCityCount)
                        .sort(([, a], [, b]) => b - a)
                        .map(([city, count]) => (
                          <div key={city} className="bg-gray-50 rounded-lg p-4 text-center">
                            <p className="text-2xl font-bold text-gray-900">{count}</p>
                            <p className="text-sm text-gray-600">{city}</p>
                          </div>
                        ))}
                  </div>
                  <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-1">Adding New Content</h3>
                    <p className="text-sm text-blue-700">
                      To add new facts to the content bank, edit <code className="bg-blue-100 px-1 rounded">src/lib/social-content.ts</code> and
                      add entries to the <code className="bg-blue-100 px-1 rounded">CONTENT_BANK</code> array. Each fact needs a city, type
                      (did-you-know or tip), headline, body, and icon.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Environment Variables Checklist */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Required Environment Variables</h2>
        <div className="space-y-2 text-sm">
          {[
            { name: 'META_PAGE_ACCESS_TOKEN', desc: 'Meta Graph API page access token' },
            { name: 'INSTAGRAM_ACCOUNT_ID', desc: 'Instagram Business Account ID' },
            { name: 'META_API_VERSION', desc: 'Meta API version (e.g. v25.0)' },
            { name: 'CRON_SECRET', desc: 'Secret key for Vercel cron job authentication' },
            { name: 'SUPABASE_SERVICE_ROLE_KEY', desc: 'Supabase service role key for cron endpoint' },
          ].map((env) => (
            <div key={env.name} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50">
              <div className="w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center text-xs">
                ?
              </div>
              <div>
                <code className="text-gray-900 font-medium">{env.name}</code>
                <span className="text-gray-500 ml-2">- {env.desc}</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Set these in your Vercel project settings under Environment Variables.
        </p>
      </div>
    </div>
  );
}
