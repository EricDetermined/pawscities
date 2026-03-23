import React, { useState } from 'react';

// Social Features Mockup for PawsCities
export default function SocialFeaturesMockup() {
  const [activeTab, setActiveTab] = useState('feed');

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="font-bold text-xl text-orange-600">PawsCities</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="p-2 hover:bg-gray-100 rounded-full">🔔</button>
            <button className="p-2 hover:bg-gray-100 rounded-full">✉️</button>
            <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white">
              M
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-12 gap-6">
        {/* Left Sidebar - Dog Profile */}
        <aside className="col-span-3">
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-4xl mb-3">
                🐕
              </div>
              <h2 className="font-bold text-lg">Max</h2>
              <p className="text-gray-500 text-sm">Golden Retriever • 3 years</p>
              <p className="text-gray-400 text-xs">Paris, France 🇫🇷</p>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 text-center">
              <div className="bg-orange-50 rounded-lg p-2">
                <div className="font-bold text-orange-600">28</div>
                <div className="text-xs text-gray-500">Places</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-2">
                <div className="font-bold text-orange-600">15</div>
                <div className="text-xs text-gray-500">Reviews</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-2">
                <div className="font-bold text-orange-600">47</div>
                <div className="text-xs text-gray-500">Photos</div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-1">
              <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs">🏆 City Explorer</span>
              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">📷 Pawtographer</span>
              <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs">💝 Helpful Pup</span>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold mb-3">Quick Actions</h3>
            <div className="space-y-2">
              <button className="w-full py-2 px-3 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors">
                📍 Check In
              </button>
              <button className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                ✏️ Write Review
              </button>
              <button className="w-full py-2 px-3 bg-white border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-colors">
                📖 Create Story
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="col-span-6">
          {/* Tabs */}
          <div className="bg-white rounded-xl shadow-sm mb-4">
            <div className="flex border-b">
              {['feed', 'stories', 'nearby'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-3 font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-orange-600 border-b-2 border-orange-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'feed' && '📰 '}
                  {tab === 'stories' && '📖 '}
                  {tab === 'nearby' && '📍 '}
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="space-y-4">
            {/* Review Card */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                  🐩
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Bella</span>
                    <span className="text-gray-400 text-sm">reviewed</span>
                    <span className="font-semibold text-orange-600">Café de Flore</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {'⭐'.repeat(5)}
                    <span className="text-sm text-gray-500 ml-2">Dog-friendly: ⭐⭐⭐⭐⭐</span>
                  </div>
                  <p className="mt-2 text-gray-700">
                    "Amazing experience! The staff brought water for Bella before we even sat down.
                    The terrace is perfect for people-watching with your pup. Highly recommend the
                    croissants!"
                  </p>
                  <div className="flex gap-2 mt-3">
                    <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">📷</div>
                    <div className="w-20 h-20 rounded-lg bg-gray-200 flex items-center justify-center">📷</div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                    <button className="flex items-center gap-1 hover:text-orange-600">
                      👍 42 Helpful
                    </button>
                    <button className="flex items-center gap-1 hover:text-orange-600">
                      💬 5 Replies
                    </button>
                    <button className="flex items-center gap-1 hover:text-orange-600">
                      🔖 Save
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Story Card */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
                <span className="text-6xl">🗼</span>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center text-white text-sm">
                    🦮
                  </div>
                  <span className="font-semibold">Charlie</span>
                  <span className="text-gray-400 text-sm">shared a story</span>
                </div>
                <h3 className="font-bold text-lg">A Perfect Day in Le Marais</h3>
                <p className="text-gray-600 text-sm mt-1">
                  4 stops • 6 hours • Le Marais, Paris
                </p>
                <div className="flex items-center gap-4 mt-3">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-gray-300 border-2 border-white"></div>
                    <div className="w-6 h-6 rounded-full bg-gray-400 border-2 border-white"></div>
                    <div className="w-6 h-6 rounded-full bg-gray-500 border-2 border-white"></div>
                  </div>
                  <span className="text-sm text-gray-500">124 likes • 18 comments</span>
                </div>
              </div>
            </div>

            {/* Check-in Card */}
            <div className="bg-white rounded-xl shadow-sm p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white">
                  🐕‍🦺
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">Luna</span>
                    <span className="text-gray-400 text-sm">checked in at</span>
                    <span className="font-semibold text-orange-600">Parc des Buttes-Chaumont</span>
                  </div>
                  <p className="text-gray-600 text-sm mt-1">
                    "Morning zoomies! 🏃‍♀️" • ⭐⭐⭐⭐⭐
                  </p>
                  <span className="text-xs text-gray-400">15 minutes ago</span>
                </div>
              </div>
            </div>

            {/* Badge Earned */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 rounded-xl shadow-sm p-4 border border-yellow-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-yellow-400 flex items-center justify-center text-2xl">
                  🏆
                </div>
                <div>
                  <div className="font-semibold">Max earned a new badge!</div>
                  <div className="text-orange-600 font-medium">City Explorer</div>
                  <p className="text-sm text-gray-500">Visited 10 places in Paris</p>
                </div>
              </div>
            </div>
          </div>
        </main>

        {/* Right Sidebar */}
        <aside className="col-span-3">
          {/* Trending Places */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <h3 className="font-semibold mb-3">🔥 Trending in Paris</h3>
            <div className="space-y-3">
              {[
                { name: 'Le Bristol Paris', type: 'Hotel', reviews: 12 },
                { name: 'Café de Flore', type: 'Cafe', reviews: 8 },
                { name: 'Parc Monceau', type: 'Park', reviews: 6 },
              ].map((place, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                    {place.type === 'Hotel' && '🏨'}
                    {place.type === 'Cafe' && '☕'}
                    {place.type === 'Park' && '🌳'}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{place.name}</div>
                    <div className="text-xs text-gray-500">{place.reviews} new reviews</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upcoming Events */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <h3 className="font-semibold mb-3">📅 Upcoming Events</h3>
            <div className="space-y-3">
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="font-medium text-sm">Yappy Hour @ Le Procope</div>
                <div className="text-xs text-gray-500">Sat, Feb 8 • 5:00 PM</div>
                <div className="text-xs text-purple-600 mt-1">23 dogs attending</div>
              </div>
              <div className="p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="font-medium text-sm">Morning Walk Meetup</div>
                <div className="text-xs text-gray-500">Sun, Feb 9 • 9:00 AM</div>
                <div className="text-xs text-green-600 mt-1">15 dogs attending</div>
              </div>
            </div>
          </div>

          {/* Suggested Packs */}
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h3 className="font-semibold mb-3">🐺 Join a Pack</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  🗼
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Le Marais Dog Owners</div>
                  <div className="text-xs text-gray-500">342 members</div>
                </div>
                <button className="px-3 py-1 bg-orange-500 text-white text-xs rounded-full">
                  Join
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  🌳
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm">Paris Park Pups</div>
                  <div className="text-xs text-gray-500">518 members</div>
                </div>
                <button className="px-3 py-1 bg-orange-500 text-white text-xs rounded-full">
                  Join
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
