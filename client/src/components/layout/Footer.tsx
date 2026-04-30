import { Link } from "react-router-dom";
import { Heart } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-700 text-md">
        <p className="mt-1">MayDay Mutual Aid Hub</p>
        <p className="flex items-center justify-center gap-1">
          Built with{" "}
          <Heart
            className="w-4 h-4 text-mayday-600 fill-mayday-600"
            aria-hidden="true"
          />
          <span className="sr-only">love</span> for community
        </p>
        <p className="mt-1">
          <Link
            to="https://www.patreon.com/c/MayDayCreative"
            className="text-mayday-700 hover:underline"
          >
            Follow us on Patreon
          </Link>
        </p>
      </div>
    </footer>
  );
}
