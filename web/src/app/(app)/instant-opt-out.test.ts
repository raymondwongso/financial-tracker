import { describe, expect, it } from "vitest";

// (app)/layout.tsx is a client component that renders nothing until client-side auth resolves, so
// Next's instant-navigation validation can't render these pages during prerender. Each page must opt
// out with `export const instant = false`, or dev logs "Could not validate ... dropped from rendering".
const pages = {
  "/dashboard": () => import("./dashboard/page"),
  "/accounts": () => import("./accounts/page"),
  "/accounts/[id]": () => import("./accounts/[id]/page"),
  "/investments": () => import("./investments/page"),
  "/investments/[id]": () => import("./investments/[id]/page"),
};

describe("(app) pages opt out of instant-navigation validation", () => {
  for (const [route, load] of Object.entries(pages)) {
    it(`${route} exports instant = false`, async () => {
      const mod = await load();
      expect(mod.instant).toBe(false);
    });
  }
});
