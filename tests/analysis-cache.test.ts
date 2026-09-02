import { describe, expect, it } from "vitest";

import {
  ANALYSIS_CACHE_MAX_AGE_MS,
  buildAnalysisCacheKey,
  isAnalysisCacheFresh,
} from "../src/lib/analysisCache";

describe("analysis cache", () => {
  it("expires academic data after four hours", () => {
    const now = Date.parse("2026-08-29T12:00:00Z");
    expect(isAnalysisCacheFresh(new Date(now - ANALYSIS_CACHE_MAX_AGE_MS).toISOString(), now)).toBe(true);
    expect(isAnalysisCacheFresh(new Date(now - ANALYSIS_CACHE_MAX_AGE_MS - 1).toISOString(), now)).toBe(false);
    expect(isAnalysisCacheFresh("invalid", now)).toBe(false);
  });

  it("normalizes equivalent Moodle URLs into one cache key", () => {
    expect(buildAnalysisCacheKey("https://EXAMPLE.test/moodle/", 4, 50))
      .toBe("https://example.test/moodle::4::50");
  });
});
