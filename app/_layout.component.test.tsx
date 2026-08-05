jest.mock("../global.css", () => ({}));
jest.mock("@/contexts", () => ({}));
jest.mock("@/contexts/achievement-context", () => ({}));
jest.mock("@/services/supabase", () => ({ supabase: { auth: {} } }));

import { unstable_settings } from "./_layout";

describe("root route module", () => {
  it("exports the tabs anchor that Expo Router loads for cold-opened routes", () => {
    expect(unstable_settings.anchor).toBe("(tabs)");
  });
});
