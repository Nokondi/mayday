import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users, MapPin } from 'lucide-react';
import { listOrganizations } from '../api/organizations.js';
import { SearchBar } from '../components/common/SearchBar.js';
import { Pagination } from '../components/common/Pagination.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { useDebounce } from '../hooks/useDebounce.js';

export function OrganizationsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ['organizations', { q: debouncedSearch, page }],
    queryFn: () => listOrganizations({ q: debouncedSearch || undefined, page, limit: 20 }),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <Link
          to="/organizations/new"
          className="flex items-center gap-1 bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600"
        >
          <Plus className="w-4 h-4" />
          New Organization
        </Link>
      </div>

      <div className="mb-6">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search organizations..."
        />
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : data ? (
        <>
          <p className="text-sm text-gray-500 mb-4">{data.total} organization{data.total !== 1 ? 's' : ''} found</p>
          <div className="space-y-3">
            {data.data.map((org) => (
              <Link
                key={org.id}
                to={`/organizations/${org.id}`}
                className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{org.name}</h3>
                    {org.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{org.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {org.memberCount} member{org.memberCount !== 1 ? 's' : ''}
                      </span>
                      {org.location && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {org.location}
                        </span>
                      )}
                      {org.myRole && (
                        <span className="text-mayday-600 font-medium">You: {org.myRole.toLowerCase()}</span>
                      )}
                    </div>
                  </div>
                  {org.avatarUrl && (
                    <img src={org.avatarUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  )}
                </div>
              </Link>
            ))}
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  );
}
