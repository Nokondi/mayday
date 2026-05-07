import { Link as LinkIcon } from "lucide-react";
import type { ProfileLink } from "@mayday/shared";

type LinksListProps = {
  links: ProfileLink[] | null | undefined;
  className?: string;
};

function displayName(link: ProfileLink): string {
  const label = link.label?.trim();
  if (label) return label;
  try {
    return new URL(link.url).hostname.replace(/^www\./, "");
  } catch {
    return link.url;
  }
}

/**
 * Render a list of profile links, or nothing when there are none. Caller should
 * also check for length when deciding whether to render a surrounding heading.
 */
export function LinksList({ links, className = "" }: LinksListProps) {
  if (!links || links.length === 0) return null;
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-1 ${className}`}>
      {links.map((link, i) => (
        <li key={i}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1 text-sm text-mayday-700 hover:text-mayday-800 hover:underline"
          >
            <LinkIcon className="w-3.5 h-3.5" aria-hidden="true" />
            {displayName(link)}
          </a>
        </li>
      ))}
    </ul>
  );
}
