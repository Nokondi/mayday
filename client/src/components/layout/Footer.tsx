import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { FormattedMessage } from "react-intl";

export function Footer() {
  return (
    <footer className="py-4 mt-auto">
      <div className="max-w-xs mx-auto p-4 rounded-xl border border-mayday-200 text-center text-gray-700 text-md bg-white">
        <p className="mt-1">
          <FormattedMessage
            id="layout.footer.brand"
            defaultMessage="MayDay Mutual Aid Hub"
          />
        </p>
        <p className="flex items-center justify-center gap-1">
          <FormattedMessage
            id="layout.footer.tagline"
            defaultMessage="Built with <heart></heart><love>love</love> for community"
            values={{
              heart: () => (
                <Heart
                  key="heart"
                  className="w-4 h-4 text-mayday-600 fill-mayday-600"
                  aria-hidden="true"
                />
              ),
              love: (chunks) => (
                <span key="love" className="sr-only">
                  {chunks}
                </span>
              ),
            }}
          />
        </p>
        <p>
          <Link
            to="https://www.patreon.com/c/MayDayCreative"
            className="text-mayday-700 hover:underline"
          >
            <FormattedMessage
              id="layout.footer.patreonLink"
              defaultMessage="Follow us on Patreon"
            />
          </Link>
        </p>
      </div>
    </footer>
  );
}
