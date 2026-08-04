import { describe, expect, it } from "vitest";

import { unstable_settings } from "./root-anchor";

describe("root stack anchor", () => {
  it("anchors cold-launched activity routes on top of (tabs)", () => {
    expect(unstable_settings.anchor).toBe("(tabs)");
  });
});