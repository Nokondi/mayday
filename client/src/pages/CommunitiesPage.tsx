import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { listCommunities, listMyCommunities } from "../api/communities.js";
import { SearchBar } from "../components/common/SearchBar.js";
import { Pagination } from "../components/common/Pagination.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { EntityCard } from "../components/common/EntityCard.js";
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
                  <EntityCard
                    key={c.id}
                    to={`/communities/${c.id}`}
                    name={c.name}
                    description={c.description}
                    avatarUrl={c.avatarUrl}
                    memberCount={c.memberCount}
                    location={c.location}
                    myRole={c.myRole}
                  />
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
                  <EntityCard
                    key={c.id}
                    to={`/communities/${c.id}`}
                    name={c.name}
                    description={c.description}
                    avatarUrl={c.avatarUrl}
                    memberCount={c.memberCount}
                    location={c.location}
                    myRole={c.myRole}
                  />
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

