import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
      <p className="text-xl text-gray-600 mb-8">Page not found</p>
      <Link
        to="/"
        className="bg-mayday-700 text-white px-6 py-3 rounded-lg hover:bg-mayday-800"
      >
        Go home
      </Link>
    </div>
  );
}
