import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { listOrganizations } from "../api/organizations.js";
import { SearchBar } from "../components/common/SearchBar.js";
import { Pagination } from "../components/common/Pagination.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { EntityCard } from "../components/common/EntityCard.js";
import { useDebounce } from "../hooks/useDebounce.js";

export function OrganizationsPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounce(search, 300);

  const { data, isLoading } = useQuery({
    queryKey: ["organizations", { q: debouncedSearch, page }],
    queryFn: () =>
      listOrganizations({ q: debouncedSearch || undefined, page, limit: 20 }),
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Organizations</h1>
        <Link
          to="/organizations/new"
          className="flex items-center gap-1 bg-mayday-700 text-white px-4 py-2 rounded-lg hover:bg-mayday-800"
        >
          <Plus className="w-4 h-4" />
          New Organization
        </Link>
      </div>

      <div className="mb-6">
        <SearchBar
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search organizations..."
        />
      </div>

      {isLoading ? (
        <LoadingSpinner className="py-12" />
      ) : data ? (
        <>
          <p className="text-sm text-gray-500 mb-4">
            {data.total} organization{data.total !== 1 ? "s" : ""} found
          </p>
          <div className="space-y-3">
            {data.data.map((org) => (
              <EntityCard
                key={org.id}
                to={`/organizations/${org.id}`}
                name={org.name}
                description={org.description}
                avatarUrl={org.avatarUrl}
                memberCount={org.memberCount}
                location={org.location}
                myRole={org.myRole}
              />
            ))}
          </div>
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            onPageChange={setPage}
          />
        </>
      ) : null}
    </div>
  );
}
