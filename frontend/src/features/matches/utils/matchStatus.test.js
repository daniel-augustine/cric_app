import { afterEach, describe, expect, it, vi } from "vitest";
import { getMatchesForTab } from "./matchStatus";

describe("match status filters", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("hides upcoming matches whose date is before the browser time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-12T12:00:00Z"));

    const matches = [
      { id: "past", status: "upcoming", date: "2026-08-12T11:59:59Z" },
      { id: "future", status: "upcoming", date: "2026-08-12T12:00:01Z" },
      { id: "future-ms", status: "upcoming", date: "1786543200000" },
      { id: "missing-date", status: "upcoming" },
      { id: "live", status: "live", date: "2026-08-12T12:00:01Z" },
    ];

    expect(getMatchesForTab("upcoming", matches).map((match) => match.id)).toEqual([
      "future",
      "future-ms",
      "missing-date",
    ]);
  });
});
