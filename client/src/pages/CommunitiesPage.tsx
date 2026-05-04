import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, MapPin } from "lucide-react";
import type { CommunityWithMembership } from "@mayday/shared";
import { listCommunities, listMyCommunities } from "../api/communities.js";
import { SearchBar } from "../components/common/SearchBar.js";
import { Pagination } from "../components/common/Pagination.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { useDebounce } from "../hooks/useDebounce.js";

export function CommunitiesPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data: myCommunities, isLoading: myLoading } = useQuery({
    queryKey: ["my-communities"],
    queryFn: () => listMyCommunities(),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["communities", { q: debouncedSearch, page }],
    queryFn: () =>
      listCommunities({ q: debouncedSearch || undefined, page, limit: 20 }),
  });

  const myIds = new Set(myCommunities?.map((c) => c.id));
  const otherCommunities = data?.data.filter((c) => !myIds.has(c.id));
  const isSearching = !!debouncedSearch;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Communities</h1>
        <Link
          to="/communities/new"
          className="flex items-center gap-1 bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800"
        >
          <Plus className="w-4 h-4" />
          New Community
        </Link>
      </div>

      <div className="mb-6">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search communities..."
        />
      </div>

      {isLoading || myLoading ? (
        <LoadingSpinner className="py-12" />
      ) : (
        <>
          {/* Your Communities */}
          {!isSearching && myCommunities && myCommunities.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">
                Your Communities
              </h2>
              <div className="space-y-3">
                {myCommunities.map((c) => (
                  <CommunityCard key={c.id} community={c} />
                ))}
              </div>
            </div>
          )}

          {/* All / Search Results */}
          {data && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                {isSearching ? "Search Results" : "All Communities"}
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                {data.total - (myCommunities?.length || 0)} communit
                {data.total - (myCommunities?.length || 0) !== 1
                  ? "ies"
                  : "y"}{" "}
                found
              </p>
              <div className="space-y-3">
                {(isSearching ? data.data : otherCommunities)?.map((c) => (
                  <CommunityCard key={c.id} community={c} />
                ))}
              </div>
              <Pagination
                page={data.page}
                totalPages={data.totalPages}
                onPageChange={setPage}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CommunityCard({
  community: c,
}: {
  community: CommunityWithMembership;
}) {
  return (
    <Link
      to={`/communities/${c.id}`}
      className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-3">
        {c.avatarUrl && (
          <img
            src={c.avatarUrl}
            alt=""
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
          />
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-900">{c.name}</h3>
          {c.description && (
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {c.description}
            </p>
          )}
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {c.memberCount} member{c.memberCount !== 1 ? "s" : ""}
            </span>
            {c.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {c.location}
              </span>
            )}
            {c.myRole && (
              <span className="text-mayday-600 font-medium">
                You: {c.myRole.toLowerCase()}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
