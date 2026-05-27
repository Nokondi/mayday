import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { FormattedMessage } from "react-intl";
import { getPosts } from "../api/posts.js";
import { PostList } from "../components/posts/PostList.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";

export function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["posts", "recent"],
    queryFn: () => getPosts({ limit: 6, sort: "recent", status: "OPEN" }),
  });

  return (
    <div>
      {/* Recent Posts */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              <FormattedMessage
                id="home.recentPostsHeading"
                defaultMessage="Recent Posts"
              />
            </h2>
            <Link
              to="/posts"
              className="text-mayday-800 hover:text-mayday-700 font-medium flex items-center gap-1"
            >
              <Search className="w-4 h-4" />
              <FormattedMessage
                id="home.viewAllLink"
                defaultMessage="View all"
              />
            </Link>
          </div>
          {isLoading ? (
            <LoadingSpinner className="py-12" />
          ) : data ? (
            <PostList posts={data.data} />
          ) : null}
        </div>
      </section>
    </div>
  );
}
