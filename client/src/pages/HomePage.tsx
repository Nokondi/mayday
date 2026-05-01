import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, HandHeart, Search, MapPin } from "lucide-react";
import { getPosts } from "../api/posts.js";
import { PostList } from "../components/posts/PostList.js";
import { LoadingSpinner } from "../components/common/LoadingSpinner.js";
import { WaveDivider } from "../components/common/WaveDivider.js";

export function HomePage() {
  const { data, isLoading } = useQuery({
    queryKey: ["posts", "recent"],
    queryFn: () => getPosts({ limit: 6, sort: "recent", status: "OPEN" }),
  });

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-mayday-500 to-mayday-700 text-white py-20">
        <WaveDivider />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            MayDay Mutual Aid Hub
          </h1>
        </div>
      </section>
      {/* Recent Posts */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Posts</h2>
            <Link
              to="/posts"
              className="text-mayday-800 hover:text-mayday-700 font-medium flex items-center gap-1"
            >
              <Search className="w-4 h-4" />
              View all
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
