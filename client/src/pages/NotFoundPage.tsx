import { Link } from "react-router-dom";
import { FormattedMessage } from "react-intl";

// HTTP status code — not translatable.
const NOT_FOUND_STATUS_CODE = "404";

export function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto px-4 py-20 text-center">
      <h1 className="text-6xl font-bold text-gray-300 mb-4">
        {NOT_FOUND_STATUS_CODE}
      </h1>
      <p className="text-xl text-gray-600 mb-8">
        <FormattedMessage
          id="notFound.heading"
          defaultMessage="Page not found"
        />
      </p>
      <Link
        to="/"
        className="bg-mayday-700 text-white px-6 py-3 rounded-lg hover:bg-mayday-800"
      >
        <FormattedMessage
          id="notFound.goHomeButton"
          defaultMessage="Go home"
        />
      </Link>
    </div>
  );
}
