import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { getPosts } from '../api/posts.js';
import { listMyCommunities } from '../api/communities.js';
import { PostList } from '../components/posts/PostList.js';
import { PostFilters } from '../components/posts/PostFilters.js';
import { SearchBar } from '../components/common/SearchBar.js';
import { Pagination } from '../components/common/Pagination.js';
import { LoadingSpinner } from '../components/common/LoadingSpinner.js';
import { useDebounce } from '../hooks/useDebounce.js';

export function PostsPage() {
  const [searchParams] = useSearchParams();
  const [type, setType] = useState(searchParams.get('type') || '');
  const [category, setCategory] = useState('');
  const [urgency, setUrgency] = useState('');
  const [sort, setSort] = useState('recent');
  const [community, setCommunity] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data: myCommunities } = useQuery({
    queryKey: ['my-communities'],
    queryFn: listMyCommunities,
  });

  const { data, isLoading } = useQuery({
    queryKey: ['posts', { type, category, urgency, sort, community, q: debouncedSearch, page }],
    queryFn: () => getPosts({
      type: type as any || undefined,
      category: category || undefined,
      urgency: urgency as any || undefined,
      sort: sort as any,
      communityId: community || undefined,
      q: debouncedSearch || undefined,
      page,
      limit: 20,
      status: 'OPEN',
    }),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Browse Posts</h1>

      <div className="space-y-4 mb-6">
        <SearchBar
          value={search}
          onChange={(v) => { setSearch(v); setPage(1); }}
          placeholder="Search requests and offers..."
        />
        <PostFilters
          type={type} category={category} urgency={urgency} sort={sort}
          community={community} communities={myCommunities}
          onTypeChange={(v) => { setType(v); setPage(1); }}
          onCategoryChange={(v) => { setCategory(v); setPage(1); }}
          onUrgencyChange={(v) => { setUrgency(v); setPage(1); }}
          onSortChange={(v) => { setSort(v); setPage(1); }}
          onCommunityChange={(v) => { setCommunity(v); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : data ? (
        <>
          <p className="text-sm text-gray-500 mb-4">{data.total} post{data.total !== 1 ? 's' : ''} found</p>
          <PostList posts={data.data} />
          <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />
        </>
      ) : null}
    </div>
  );
}
