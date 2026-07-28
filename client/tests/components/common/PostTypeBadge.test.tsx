import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IntlProvider } from "react-intl";
import type { PostType } from "@mayday/shared";
import {
  PostTypeBadge,
  postTypeStyles,
} from "../../../src/components/common/PostTypeBadge.js";

function renderBadge(type: PostType) {
  return render(
    <IntlProvider locale="en" defaultLocale="en">
      <PostTypeBadge type={type} />
    </IntlProvider>,
  );
}

describe("PostTypeBadge", () => {
  it.each([
    ["REQUEST", "Request", "bg-orange-100", "text-orange-700"],
    ["OFFER", "Offer", "bg-green-100", "text-green-700"],
    ["EVENT", "Event", "bg-purple-100", "text-purple-700"],
  ] as const)(
    "renders a %s post as a colored %s chip",
    (type, label, bg, text) => {
      renderBadge(type);
      const chip = screen.getByText(label);
      expect(chip).toHaveClass("rounded-full", bg, text, "font-medium");
    },
  );

  it('prefixes the visible label with a screen-reader-only "Post type:"', () => {
    renderBadge("EVENT");
    expect(screen.getByText("Post type:")).toHaveClass("sr-only");
  });

  it("defines card border and calendar chip styles for every type", () => {
    for (const type of ["REQUEST", "OFFER", "EVENT"] as const) {
      expect(postTypeStyles[type].cardBorder).toMatch(/^border-l-/);
      expect(postTypeStyles[type].calendarChip).toContain("bg-");
    }
  });
});
