import assert from "node:assert/strict";
import test from "node:test";

import {
  sortEventsNewestFirst,
  weeklyStatsForWrite,
} from "../scripts/refresh-github-live.mjs";

test("live refresh preserves authoritative local weekly stats", () => {
  const localStats = {
    source: "local-git-refresh",
    totalCommitContributions: 34,
    totalRepositoryContributions: 3,
  };
  const events = [{
    type: "PushEvent",
    created_at: "2026-08-04T10:00:00Z",
    repo: { name: "charlie2233/example" },
    payload: { distinct_size: 128 },
  }];

  assert.equal(
    weeklyStatsForWrite(events, new Date("2026-08-04T12:00:00Z"), localStats),
    localStats,
  );
});

test("public-event weekly stats retain explicit live provenance", () => {
  const stats = weeklyStatsForWrite(
    [],
    new Date("2026-08-04T12:00:00Z"),
    { source: "github-live-cache" },
  );

  assert.equal(stats.source, "github-live-cache");
});

test("synthetic and API events are sorted newest first", () => {
  const events = [
    { created_at: "2026-08-01T00:00:00Z" },
    { created_at: "2026-08-04T00:00:00Z" },
    { created_at: "2026-08-02T00:00:00Z" },
  ];

  assert.deepEqual(
    sortEventsNewestFirst(events).map((event) => event.created_at),
    [
      "2026-08-04T00:00:00Z",
      "2026-08-02T00:00:00Z",
      "2026-08-01T00:00:00Z",
    ],
  );
});
