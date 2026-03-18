'use client';

import React, { useEffect, useState, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'BUSINESS' | 'ADMIN';
  is_suspended: boolean;
  avatar: string | null;
  created_at: string;
  updated_at: string;
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export default function UsersPage() {
  const [roleFilter, setRoleFilter] = useState<'all' | 'USER' | 'BUSINESS' | 'ADMIN'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const fetchUsers = useCallback(
    async (pageNum: number = 1) => {
      try {
        setLoading(true);
        const url = new URL('/api/admin/users', window.location.origin);
        url.searchParams.set('page', pageNum.toString());
        url.searchParams.set('limit', '20');

        if (searchQuery) url.searchParams.set('search', searchQuery);
        if (roleFilter !== 'all') url.searchParams.set('role', roleFilter);

        const response = await fetch(url.toString());
        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }
        const json = await response.json();
        setData(json);
        setError(null);
      } catch (err) {
        console.error('Error fetching users:', err);
        setError('Failed to load users');
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [searchQuery, roleFilter]
  );

  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout);

    const timeout = setTimeout(() => {
      setPage(1);
      fetchUsers(1);
    }, 300);

    setSearchTimeout(timeout);

    return () => clearTimeout(timeout);
  }, [searchQuery, roleFilter, fetchUsers]);

  useEffect(() => {
    if (page !== 1) {
      fetchUsers(page);
    }
  }, [page, fetchUsers]);

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      ADMIN: 'bg-red-100 text-red-700',
      BUSINESS: 'bg-blue-100 text-blue-700',
      USER: 'bg-green-100 text-green-700',
    };
    return styles[role] || 'bg-gray-100 text-gray-700';
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-600">
          Manage user accounts, roles, and permissions
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Search */}
          <div className="flex-1 min-w-[200px] relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">All Roles</option>
            <option value="USER">User</option>
            <option value="BUSINESS">Business</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Results Count */}
      {data && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>
            {data.users.length > 0
              ? `Showing ${data.users.length} of ${data.pagination.total} users`
              : 'No users found'}
          </p>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-xl border overflow-visible">
        {loading ? (
          <div className="divide-y">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="p-4 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-gray-100 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : data && data.users.length > 0 ? (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    getRoleBadge={getRoleBadge}
                    getInitials={getInitials}
                    formatDate={formatDate}
                    onUserDeleted={() => fetchUsers(page)}
                  />
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="px-6 py-4 border-t flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Page {data.pagination.page} of {data.pagination.pages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  Previous
                </button>
                <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-lg text-sm font-medium">
                  {page}
                </span>
                <button
                  onClick={() => setPage(Math.min(data.pagination.pages, page + 1))}
                  disabled={page >= data.pagination.pages}
                  className="px-3 py-1 border rounded-lg text-sm disabled:opacity-50 hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function UserRow({
  user,
  getRoleBadge,
  getInitials,
  formatDate,
  onUserDeleted,
}: {
  user: User;
  getRoleBadge: (role: string) => string;
  getInitials: (name: string | null) => string;
  formatDate: (date: string) => string;
  onUserDeleted: () => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [selectedRole, setSelectedRole] = useState(user.role);
  const [isSuspended, setIsSuspended] = useState(user.is_suspended);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleRoleChange = async (newRole: string) => {
    try {
      setIsChangingRole(true);
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to update role');
      }

      setSelectedRole(newRole as any);
      setMessage({ type: 'success', text: 'Role updated successfully' });
      setIsMenuOpen(false);
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update role';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setIsChangingRole(false);
    }
  };

  const handleSuspend = async () => {
    try {
      const newSuspendedStatus = !isSuspended;
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suspended: newSuspendedStatus }),
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to update status');
      }

      setIsSuspended(newSuspendedStatus);
      setMessage({
        type: 'success',
        text: newSuspendedStatus ? 'User suspended' : 'User unsuspended',
      });
      setIsMenuOpen(false);
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to update status';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const json = await response.json();
        throw new Error(json.error || 'Failed to delete user');
      }

      setMessage({ type: 'success', text: 'User deleted successfully' });
      setShowDeleteConfirm(false);
      setIsMenuOpen(false);
      // Refresh the user list
      setTimeout(() => onUserDeleted(), 500);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to delete user';
      setMessage({ type: 'error', text: errorMsg });
      setShowDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-sm text-white ${
              user.avatar ? 'bg-cover' : 'bg-primary-500'
            }`}
            style={user.avatar ? { backgroundImage: `url(${user.avatar})` } : {}}
          >
            {!user.avatar && getInitials(user.name)}
          </div>
          <div>
            <p className="font-medium text-gray-900">{user.name || 'No name'}</p>
            <p className="text-sm text-gray-500">ID: {user.id.slice(0, 8)}</p>
          </div>
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <p className="text-gray-900">{user.email}</p>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleBadge(selectedRole)}`}>
          {selectedRole}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            isSuspended
              ? 'bg-red-100 text-red-700'
              : 'bg-green-100 text-green-700'
          }`}
        >
          {isSuspended ? 'Suspended' : 'Active'}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <p className="text-gray-600 text-sm">{formatDate(user.created_at)}</p>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-right">
        <div className="relative inline-block">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
              />
            </svg>
          </button>

          {isMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => { setIsMenuOpen(false); setShowDeleteConfirm(false); }}
              />
              <div className="absolute right-0 bottom-full mb-2 w-48 bg-white rounded-lg shadow-lg border z-20">
                <div className="px-4 py-2 border-b">
                  <p className="text-xs text-gray-500 mb-2 font-medium">Change Role</p>
                  {(['USER', 'BUSINESS', 'ADMIN'] as const).map((role) => (
                    <button
                      key={role}
                      onClick={() => handleRoleChange(role)}
                      disabled={isChangingRole || role === selectedRole}
                      className="block w-full text-left px-2 py-1 text-sm rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSuspend}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-b"
                >
                  {isSuspended ? 'Unsuspend' : 'Suspend'}
                </button>
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                  >
                    Delete User
                  </button>
                ) : (
                  <div className="p-3 bg-red-50">
                    <p className="text-xs text-red-700 mb-2 font-medium">
                      Delete this user and all their data? This cannot be undone.
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="flex-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                      >
                        {isDeleting ? 'Deleting...' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(false)}
                        className="flex-1 px-2 py-1 bg-white text-gray-700 text-xs rounded border hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {message && (
          <div
            className={`absolute bottom-12 right-0 px-3 py-1 rounded text-xs whitespace-nowrap ${
              message.type === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}
      </td>
    </tr>
  );
}
