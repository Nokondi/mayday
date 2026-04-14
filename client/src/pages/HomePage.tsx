import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Heart, HandHeart, Search, MapPin } from "lucide-react";
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
      {/* Hero */}
      <section className="bg-gradient-to-br from-mayday-500 to-mayday-700 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            MayDay Mutual Aid Hub
          </h1>
          <p className="text-xl text-mayday-100 mb-8">
            Request help or offer resources in your community. Together, we're
            stronger.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/posts?type=REQUEST"
              className="bg-white text-mayday-600 px-6 py-3 rounded-lg font-semibold hover:bg-mayday-50"
            >
              I need help
            </Link>
            <Link
              to="/posts?type=OFFER"
              className="bg-mayday-800 text-white px-6 py-3 rounded-lg font-semibold hover:bg-mayday-900"
            >
              I can help
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 bg-mayday-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-6 h-6 text-mayday-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Post a Request</h3>
              <p className="text-gray-600">
                Need groceries, a ride, or someone to talk to? Share your need
                with the community.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <HandHeart className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Offer Resources</h3>
              <p className="text-gray-600">
                Have skills, time, or supplies to share? Let your neighbors know
                you're available.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Connect Locally</h3>
              <p className="text-gray-600">
                Find and connect with people near you through our map and
                matching system.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Posts */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Recent Posts</h2>
            <Link
              to="/posts"
              className="text-mayday-600 hover:text-mayday-700 font-medium flex items-center gap-1"
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
