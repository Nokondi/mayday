import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { FormattedMessage, useIntl } from "react-intl";
import { ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { getPosts } from "../api/posts.js";
import { listMyCommunities } from "../api/communities.js";
import { PostList } from "../components/posts/PostList.js";
import { PostFilters } from "../components/posts/PostFilters.js";
import {
  ActiveFilterChips,
  type FilterKey,
} from "../components/posts/ActiveFilterChips.js";
import { SearchBar } from "../components/common/SearchBar.js";
import { Pagination } from "../components/common/Pagination.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { useDebounce } from "../hooks/useDebounce.js";

export function PostsPage() {
  const intl = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL search params are the single source of truth for the post query.
  const type = searchParams.get("type") || "";
  const category = searchParams.get("category") || "";
  const urgency = searchParams.get("urgency") || "";
  const sort = searchParams.get("sort") || "recent";
  const community = searchParams.get("community") || "";
  const q = searchParams.get("q") || "";
  const page = Number(searchParams.get("page")) || 1;

  const [showControls, setShowControls] = useState(false);
  // The search box stays responsive locally and writes to the URL once debounced.
  const [searchInput, setSearchInput] = useState(q);
  const debouncedSearch = useDebounce(searchInput, 300);

  // Set or clear a single param, resetting pagination on any filter/search change.
  function updateParam(key: string, value: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        next.delete("page");
        return next;
      },
      { replace: true },
    );
  }

  // Push the debounced search term into the URL (guarded to avoid a render loop).
  useEffect(() => {
    if (debouncedSearch !== q) updateParam("q", debouncedSearch);
  }, [debouncedSearch]);

  const { data: myCommunities } = useQuery({
    queryKey: ["my-communities"],
    queryFn: listMyCommunities,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["posts", { type, category, urgency, sort, community, q, page }],
    queryFn: () =>
      getPosts({
        type: (type as any) || undefined,
        category: category || undefined,
        urgency: (urgency as any) || undefined,
        sort: sort as any,
        communityId: community && community !== "friends" ? community : undefined,
        friends: community === "friends" ? true : undefined,
        q: q || undefined,
        page,
        limit: 20,
        status: "OPEN",
      }),
  });

  function clearFilter(key: FilterKey) {
    if (key === "q") setSearchInput("");
    // Clearing sort returns to the default chronological order.
    updateParam(key, key === "sort" ? "" : "");
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          <FormattedMessage
            id="posts.browsePage.title"
            defaultMessage="Browse Posts"
          />
        </h1>
        <button
          type="button"
          onClick={() => setShowControls((v) => !v)}
          aria-expanded={showControls}
          className="flex items-center gap-1.5 text-sm font-medium text-mayday-800 hover:text-mayday-700"
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          <FormattedMessage
            id="posts.browsePage.toggleFilters"
            defaultMessage="Search & filters"
          />
          {showControls ? (
            <ChevronUp className="w-4 h-4" aria-hidden="true" />
          ) : (
            <ChevronDown className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {showControls && (
        <div className="space-y-4 mb-6">
          <SearchBar
            value={searchInput}
            onChange={setSearchInput}
            placeholder={intl.formatMessage({
              id: "posts.browsePage.searchPlaceholder",
              defaultMessage: "Search requests and offers...",
            })}
          />
          <PostFilters
            type={type}
            category={category}
            urgency={urgency}
            sort={sort}
            community={community}
            communities={myCommunities}
            onTypeChange={(v) => updateParam("type", v)}
            onCategoryChange={(v) => updateParam("category", v)}
            onUrgencyChange={(v) => updateParam("urgency", v)}
            onSortChange={(v) => updateParam("sort", v === "recent" ? "" : v)}
            onCommunityChange={(v) => updateParam("community", v)}
          />
        </div>
      )}

      <ActiveFilterChips
        type={type}
        category={category}
        urgency={urgency}
        sort={sort}
        community={community}
        q={q}
        communities={myCommunities}
        onClear={clearFilter}
      />

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : data ? (
        <>
          <p className="text-sm text-gray-900 mb-4">
            <FormattedMessage
              id="posts.browsePage.resultCount"
              defaultMessage="{count, plural, one {# post found} other {# posts found}}"
              values={{ count: data.total }}
            />
          </p>
          <PostList posts={data.data} />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={(p) => updateParam("page", String(p))}
          />
        </>
      ) : null}
    </div>
  );
}
