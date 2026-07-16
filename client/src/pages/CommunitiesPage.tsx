import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { FormattedMessage, useIntl } from "react-intl";
import { listCommunities, listMyCommunities } from "../api/communities.js";
import { SearchBar } from "../components/common/SearchBar.js";
import { Pagination } from "../components/common/Pagination.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { EntityCard } from "../components/common/EntityCard.js";
import { useDebounce } from "../hooks/useDebounce.js";

export function CommunitiesPage() {
  const intl = useIntl();
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
        <h1 className="text-2xl font-bold text-gray-900">
          <FormattedMessage
            id="communities.browsePage.title"
            defaultMessage="Communities"
          />
        </h1>
        <Link
          to="/communities/new"
          className="flex items-center gap-1 bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800"
        >
          <Plus className="w-4 h-4" />
          <FormattedMessage
            id="communities.browsePage.newButton"
            defaultMessage="New Community"
          />
        </Link>
      </div>

      <div className="mb-6">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder={intl.formatMessage({
            id: "communities.browsePage.searchPlaceholder",
            defaultMessage: "Search communities...",
          })}
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
                <FormattedMessage
                  id="communities.browsePage.yourCommunitiesHeading"
                  defaultMessage="Your Communities"
                />
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
                {isSearching ? (
                  <FormattedMessage
                    id="communities.browsePage.searchResultsHeading"
                    defaultMessage="Search Results"
                  />
                ) : (
                  <FormattedMessage
                    id="communities.browsePage.allCommunitiesHeading"
                    defaultMessage="All Communities"
                  />
                )}
              </h2>
              <p className="text-sm text-gray-600 mb-3">
                <FormattedMessage
                  id="communities.browsePage.resultCount"
                  defaultMessage="{count, plural, one {# community found} other {# communities found}}"
                  values={{
                    count: data.total - (myCommunities?.length || 0),
                  }}
                />
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
