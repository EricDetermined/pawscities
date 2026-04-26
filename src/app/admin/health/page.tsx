'use client';

import React, { useEffect, useState, useCallback } from 'react';

type CheckStatus = 'healthy' | 'warning' | 'critical';

interface CheckResult {
  name: string;
  status: CheckStatus;
  message: string;
  details?: Record<string, unknown>;
}

interface HealthReport {
  timestamp: string;
  overall: CheckStatus;
  checks: CheckResult[];
  summary: string;
}

const statusConfig: Record<CheckStatus, { emoji: string; color: string; bg: string; border: string; badge: string }> = {
  healthy: {
    emoji: '✅',
    color: 'text-green-700',
    bg: 'bg-green-50',
    border: 'border-green-200',
    badge: 'bg-green-100 text-green-800',
  },
  warning: {
    emoji: '⚠️',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
  },
  critical: {
    emoji: '🚨',
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-800',
  },
};

const serviceIcons: Record<string, string> = {
  'Instagram Token': '📸',
  'Google Places API': '🗺️',
  'Database': '🗄️',
  'Photo Freshness': '🖼️',
  'Instagram Posting': '📱',
  'Site Pages': '🌐',
  'Photo Proxy': '🔗',
  'Email Service': '📧',
};

export default function HealthDashboard() {
  const [report, setReport] = useState<HealthReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch('/api/admin/health');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HealthReport = await res.json();
      setReport(data);
      setError(null);
      setLastRefresh(new Date());
    } catch (err) {
      setError(`Failed to load health data: ${String(err)}`);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => fetchHealth(true), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Monitor</h1>
          <p className="text-gray-600">Checking all services...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg" />
                <div className="h-4 bg-gray-200 rounded w-28" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Monitor</h1>
          <p className="text-gray-600">Site-wide service monitoring</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">🚨</span>
            <h2 className="text-lg font-semibold text-red-800">Unable to Run Health Checks</h2>
          </div>
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => fetchHealth()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors text-sm font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const overallConfig = statusConfig[report.overall];
  const healthyCount = report.checks.filter(c => c.status === 'healthy').length;
  const warningCount = report.checks.filter(c => c.status === 'warning').length;
  const criticalCount = report.checks.filter(c => c.status === 'critical').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Health Monitor</h1>
          <p className="text-gray-600">Real-time status of all PawCities services</p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-gray-400">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchHealth(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <svg
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {refreshing ? 'Checking...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Overall Status Banner */}
      <div className={`${overallConfig.bg} ${overallConfig.border} border rounded-xl p-6`}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="text-4xl">{overallConfig.emoji}</div>
            <div>
              <h2 className={`text-xl font-bold ${overallConfig.color}`}>
                System {report.overall === 'healthy' ? 'Healthy' : report.overall === 'warning' ? 'Warning' : 'Critical'}
              </h2>
              <p className={`text-sm ${overallConfig.color} opacity-80`}>{report.summary}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <StatusPill label="Healthy" count={healthyCount} status="healthy" />
            {warningCount > 0 && <StatusPill label="Warning" count={warningCount} status="warning" />}
            {criticalCount > 0 && <StatusPill label="Critical" count={criticalCount} status="critical" />}
          </div>
        </div>
      </div>

      {/* Service Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {report.checks.map((check) => (
          <ServiceCard key={check.name} check={check} />
        ))}
      </div>

      {/* Details Panel — show for non-healthy services */}
      {report.checks.some(c => c.status !== 'healthy') && (
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Issues Requiring Attention</h2>
          <div className="space-y-3">
            {report.checks
              .filter(c => c.status !== 'healthy')
              .sort((a, b) => (a.status === 'critical' ? -1 : 1))
              .map((check) => {
                const cfg = statusConfig[check.status];
                return (
                  <div key={check.name} className={`${cfg.bg} ${cfg.border} border rounded-lg p-4`}>
                    <div className="flex items-start gap-3">
                      <span className="text-xl mt-0.5">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-900">{check.name}</span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${cfg.badge}`}>
                            {check.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700">{check.message}</p>
                        {check.details && Object.keys(check.details).length > 0 && (
                          <div className="mt-2 text-xs text-gray-500 space-x-3">
                            {Object.entries(check.details).map(([key, val]) => (
                              <span key={key}>
                                <span className="font-medium">{key}:</span>{' '}
                                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* All Services Detailed View */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">All Services</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 text-left text-sm font-medium text-gray-500">
              <th className="px-6 py-3">Service</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 hidden md:table-cell">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.checks.map((check) => {
              const cfg = statusConfig[check.status];
              return (
                <tr key={check.name} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{serviceIcons[check.name] || '🔧'}</span>
                      <span className="font-medium text-gray-900">{check.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full ${cfg.badge}`}>
                      {cfg.emoji} {check.status.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 hidden md:table-cell">
                    <p className="text-sm text-gray-600">{check.message}</p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs text-gray-400 py-4">
        Health checks run daily at 7:00 AM UTC with email alerts • Auto-refreshes every 5 minutes
      </div>
    </div>
  );
}

function StatusPill({ label, count, status }: { label: string; count: number; status: CheckStatus }) {
  const cfg = statusConfig[status];
  return (
    <div className={`${cfg.badge} px-3 py-1.5 rounded-full text-sm font-semibold flex items-center gap-1.5`}>
      <span className="text-base">{cfg.emoji}</span>
      <span>{count} {label}</span>
    </div>
  );
}

function ServiceCard({ check }: { check: CheckResult }) {
  const cfg = statusConfig[check.status];
  const icon = serviceIcons[check.name] || '🔧';

  return (
    <div className={`bg-white rounded-xl border p-5 hover:shadow-md transition-shadow ${check.status !== 'healthy' ? `ring-1 ${check.status === 'critical' ? 'ring-red-300' : 'ring-amber-300'}` : ''}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-10 h-10 ${cfg.bg} rounded-lg flex items-center justify-center text-xl`}>
            {icon}
          </div>
          <span className="font-semibold text-gray-900 text-sm">{check.name}</span>
        </div>
        <span className={`w-3 h-3 rounded-full ${check.status === 'healthy' ? 'bg-green-500' : check.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'}`} />
      </div>
      <div className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full mb-2 ${cfg.badge}`}>
        {cfg.emoji} {check.status.toUpperCase()}
      </div>
      <p className="text-xs text-gray-500 line-clamp-2">{check.message}</p>
    </div>
  );
}
