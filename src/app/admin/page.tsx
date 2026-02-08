import Link from 'next/link';

// Mock data - will be replaced with real database queries
const stats = {
  totalCities: 4,
  activeCities: 1,
  totalEstablishments: 24,
  pendingReview: 3,
  totalUsers: 0,
  researchTasks: 0,
};

const recentActivity = [
  { id: 1, action: 'City activated', target: 'Geneva', time: '2 hours ago', icon: '🏙️' },
  { id: 2, action: 'Establishment added', target: 'Café du Soleil', time: '3 hours ago', icon: '📍' },
  { id: 3, action: 'Research completed', target: 'Geneva Parks', time: '1 day ago', icon: '🤖' },
];

const quickActions = [
  { title: 'Add City', href: '/admin/cities/new', icon: '🏙️', color: 'bg-blue-500' },
  { title: 'Add Establishment', href: '/admin/establishments/new', icon: '📍', color: 'bg-green-500' },
  { title: 'Run Research', href: '/admin/research/new', icon: '🤖', color: 'bg-purple-500' },
  { title: 'View Analytics', href: '/admin/analytics', icon: '📈', color: 'bg-orange-500' },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">
          Welcome to the PawsCities admin dashboard
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Cities"
          value={stats.totalCities}
          subtitle={`${stats.activeCities} active`}
          icon="🏙️"
          color="bg-blue-500"
        />
        <StatCard
          title="Establishments"
          value={stats.totalEstablishments}
          subtitle={`${stats.pendingReview} pending review`}
          icon="📍"
          color="bg-green-500"
        />
        <StatCard
          title="Users"
          value={stats.totalUsers}
          subtitle="0 new this week"
          icon="👥"
          color="bg-purple-500"
        />
        <StatCard
          title="Research Tasks"
          value={stats.researchTasks}
          subtitle="0 in progress"
          icon="🤖"
          color="bg-orange-500"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className="flex flex-col items-center p-4 bg-white rounded-xl border hover:shadow-md transition-shadow"
            >
              <div
                className={`w-12 h-12 ${action.color} rounded-full flex items-center justify-center text-2xl mb-2`}
              >
                {action.icon}
              </div>
              <span className="font-medium text-gray-900">{action.title}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cities Overview */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Cities Overview
            </h2>
            <Link
              href="/admin/cities"
              className="text-sm text-primary-600 hover:text-primary-700"
            >
              View all →
            </Link>
          </div>

          <div className="space-y-4">
            <CityRow
              name="Geneva"
              country="Switzerland"
              establishments={24}
              status="active"
              flag="🇨🇭"
            />
            <CityRow
              name="Paris"
              country="France"
              establishments={0}
              status="pending"
              flag="🇫🇷"
            />
            <CityRow
              name="London"
              country="United Kingdom"
              establishments={0}
              status="pending"
              flag="🇬🇧"
            />
            <CityRow
              name="Los Angeles"
              country="United States"
              establishments={0}
              status="pending"
              flag="🇺🇸"
            />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>

          <div className="space-y-4">
            {recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-lg">
                  {activity.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">
                    {activity.action}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {activity.target}
                  </p>
                  <p className="text-xs text-gray-400">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>

          {recentActivity.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">
              No recent activity
            </p>
          )}
        </div>
      </div>

      {/* Database Status */}
      <div className="bg-white rounded-xl border p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Database Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <DatabaseTable name="Cities" count={4} icon="🏙️" />
          <DatabaseTable name="Establishments" count={24} icon="📍" />
          <DatabaseTable name="Categories" count={9} icon="🏷️" />
          <DatabaseTable name="Reviews" count={0} icon="⭐" />
        </div>
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Currently using mock data. Connect to Supabase
            to enable full database functionality.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string;
  value: number;
  subtitle: string;
  icon: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <div
          className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center text-white text-xl`}
        >
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

function CityRow({
  name,
  country,
  establishments,
  status,
  flag,
}: {
  name: string;
  country: string;
  establishments: number;
  status: 'active' | 'pending' | 'inactive';
  flag: string;
}) {
  const statusColors = {
    active: 'bg-green-100 text-green-700',
    pending: 'bg-yellow-100 text-yellow-700',
    inactive: 'bg-gray-100 text-gray-700',
  };

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{flag}</span>
        <div>
          <p className="font-medium text-gray-900">{name}</p>
          <p className="text-sm text-gray-500">{country}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">
          {establishments} establishments
        </span>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}

function DatabaseTable({
  name,
  count,
  icon,
}: {
  name: string;
  count: number;
  icon: string;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
      <span className="text-xl">{icon}</span>
      <div>
        <p className="text-sm font-medium text-gray-900">{name}</p>
        <p className="text-lg font-bold text-gray-700">{count}</p>
      </div>
    </div>
  );
}
