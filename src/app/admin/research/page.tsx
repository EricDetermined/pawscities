'use client';

import React, { useState } from 'react';
import { CITIES, CATEGORIES } from '@/lib/cities-config';

interface ResearchTask {
  id: string;
  city: string;
  categories: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  placesFound: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export default function ResearchAgentPage() {
  const [selectedCity, setSelectedCity] = useState('paris');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['restaurants', 'cafes']);
  const [maxResults, setMaxResults] = useState(10);
  const [isRunning, setIsRunning] = useState(false);
  const [tasks, setTasks] = useState<ResearchTask[]>([]);
  const [currentOutput, setCurrentOutput] = useState<string[]>([]);

  const handleCategoryToggle = (slug: string) => {
    setSelectedCategories(prev =>
      prev.includes(slug)
        ? prev.filter(c => c !== slug)
        : [...prev, slug]
    );
  };

  const startResearch = async () => {
    setIsRunning(true);
    setCurrentOutput(['🔍 Starting research...']);

    const taskId = `task-${Date.now()}`;
    const newTask: ResearchTask = {
      id: taskId,
      city: selectedCity,
      categories: selectedCategories,
      status: 'running',
      placesFound: 0,
      startedAt: new Date().toISOString(),
    };

    setTasks(prev => [newTask, ...prev]);

    try {
      const response = await fetch('/api/admin/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city: selectedCity,
          categories: selectedCategories,
          maxResults,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setCurrentOutput(prev => [
          ...prev,
          `✅ Research completed!`,
          `📍 Found ${data.placesFound} places`,
          `💾 ${data.savedToQueue} sent to validation queue`,
        ]);

        setTasks(prev =>
          prev.map(t =>
            t.id === taskId
              ? {
                  ...t,
                  status: 'completed',
                  placesFound: data.placesFound,
                  completedAt: new Date().toISOString(),
                }
              : t
          )
        );
      } else {
        throw new Error(data.error || 'Research failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setCurrentOutput(prev => [...prev, `❌ Error: ${errorMessage}`]);

      setTasks(prev =>
        prev.map(t =>
          t.id === taskId
            ? {
                ...t,
                status: 'failed',
                error: errorMessage,
                completedAt: new Date().toISOString(),
              }
            : t
        )
      );
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🤖 Research Agent</h1>
          <p className="text-gray-600 mt-1">
            Discover dog-friendly places using AI-powered research
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration Panel */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <h2 className="text-lg font-semibold mb-4">Research Configuration</h2>

          {/* City Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target City
            </label>
            <select
              value={selectedCity}
              onChange={e => setSelectedCity(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={isRunning}
            >
              {Object.entries(CITIES).map(([slug, city]) => (
                <option key={slug} value={slug}>
                  {city.name} ({city.country})
                </option>
              ))}
            </select>
          </div>

          {/* Category Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Categories to Research
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.slug}
                  onClick={() => handleCategoryToggle(cat.slug)}
                  disabled={isRunning}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                    selectedCategories.includes(cat.slug)
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Max Results */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Results per Category
            </label>
            <input
              type="number"
              value={maxResults}
              onChange={e => setMaxResults(parseInt(e.target.value) || 10)}
              min={1}
              max={50}
              disabled={isRunning}
              className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Start Button */}
          <button
            onClick={startResearch}
            disabled={isRunning || selectedCategories.length === 0}
            className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
              isRunning || selectedCategories.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-primary-500 text-white hover:bg-primary-600'
            }`}
          >
            {isRunning ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Researching...
              </span>
            ) : (
              '🚀 Start Research'
            )}
          </button>

          {/* Note */}
          <p className="mt-4 text-xs text-gray-500">
            Note: Research requires ANTHROPIC_API_KEY in environment variables.
            Results will be added to the validation queue for review.
          </p>
        </div>

        {/* Output Console */}
        <div className="bg-gray-900 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            📟 Research Output
          </h2>
          <div className="font-mono text-sm text-green-400 space-y-1 min-h-[200px]">
            {currentOutput.length === 0 ? (
              <p className="text-gray-500">
                Configure research parameters and click Start Research...
              </p>
            ) : (
              currentOutput.map((line, i) => (
                <p key={i} className="animate-fade-in">
                  {line}
                </p>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">📋 Recent Research Tasks</h2>

        {tasks.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No research tasks yet. Start one above!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    City
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Categories
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Places Found
                  </th>
                  <th className="text-left py-3 px-4 font-medium text-gray-700">
                    Started
                  </th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(task => (
                  <tr key={task.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {CITIES[task.city]?.name || task.city}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {task.categories.map(cat => (
                          <span
                            key={cat}
                            className="px-2 py-0.5 bg-gray-100 rounded text-xs"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          task.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : task.status === 'running'
                            ? 'bg-blue-100 text-blue-700'
                            : task.status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {task.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">{task.placesFound}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {task.startedAt
                        ? new Date(task.startedAt).toLocaleTimeString()
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
