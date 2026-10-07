import { expect, test } from "bun:test";
import { TILES } from "./logo";

/** Every rect as "x y width height fill", order-independent. */
function rects(markup: string): Set<string> {
  const found = new Set<string>();
  for (const [tag] of markup.matchAll(/<rect\b[^>]*>/g)) {
    const attribute = (name: string) =>
      tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? "";
    found.add(["x", "y", "width", "height", "fill"].map(attribute).join(" "));
  }
  return found;
}

// The favicon is served straight off disk, so it is a second copy of the
// mark that nothing else would catch drifting.
test("the favicon draws the same mark the app does", async () => {
  const icon = rects(await Bun.file("static/favicon.svg").text());
  expect(icon.size).toBeGreaterThan(0);
  const tiles = new Set(
    TILES.map(([x, y, width, height, color]) =>
      [x, y, width, height, color].join(" "),
    ),
  );
  expect(tiles).toEqual(icon);
});
