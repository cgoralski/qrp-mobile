import { describe, it, expect } from "vitest";
import { buildRepeaterFilterKey, repeaterSnapshotKey } from "@/lib/cloud-data-cache";

describe("cloud-data-cache", () => {
  it("buildRepeaterFilterKey is stable for same inputs", () => {
    const a = buildRepeaterFilterKey({
      query: "vk",
      selectedCountry: "Australia",
      selectedMode: "FM",
      boardBand: "VHF",
    });
    const b = buildRepeaterFilterKey({
      query: "vk",
      selectedCountry: "Australia",
      selectedMode: "FM",
      boardBand: "VHF",
    });
    expect(a).toBe(b);
    expect(repeaterSnapshotKey(a)).toContain("vk|Australia|FM|VHF");
  });
});
