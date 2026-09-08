import test from "node:test";
import assert from "node:assert/strict";
import { generateYouTubeText, youtubeInputs, youtubeInputErrors, youtubeTextError } from "../core/youtube-metadata.js";
import type { Timeline } from "../core/types.js";

function replay(): Timeline {
  return {
    replay: "replay.osr", beatmap: "map.osu", player: "Player", title: "Artist - Song [Hard]", mods: "HDHR",
    speed: 1, preempt: 600, duration: 120, stars: 6.25, bpm: 180, od: 9, maxPP: 420,
    strains: [], health: [], snapshots: [], warnings: [],
    ppInfo: { engineVersion: "test", localFinalPP: 410.4, onlineFinalPP: 411.6 },
    sceneInfo: {
      title: "Song [Hard]", songTitle: "Song", difficulty: "Hard", artist: "Artist", mapper: "Mapper", beatmapId: 123,
      ar: 10, od: 9, cs: 4, hp: 6, arMs: 450, odMs: 25, maxCombo: 1000, playedAt: "2026-09-08",
      playStatus: { completed: true, verified: true, fullCombo: true, perfectCombo: true, sliderBreaks: 0 },
      score: { time: 120, score: 123456, combo: 1000, maxCombo: 1000, accuracy: 99.31, pp: 410.4, grade: "S", errors: [], ur: 80,
        hits: { "300": 500, "100": 2, "50": 0, "0": 0, sliderBreaks: 0 } },
    },
  };
}

test("YouTube text uses final PP, recorded score, separate map fields, and an offline beatmap link", () => {
  const timeline = replay();
  timeline.title = "Display title is not parsed";
  const text = generateYouTubeText(timeline);
  assert.equal(text.title, "Player | 6.25⭐ | Artist - Song [Hard] +HDHR FC 412pp | 99.31%");
  assert.match(text.description, /412pp \| 99.31% \| 1000x\/1000x \| 0 misses/);
  assert.match(text.description, /Beatmap: https:\/\/osu.ppy.sh\/beatmaps\/123/);
  assert.ok(!text.description.includes("Player:"));
  assert.match(text.description, /Played: 2026-09-08/);
  delete timeline.ppInfo!.onlineFinalPP;
  assert.equal(youtubeInputs(timeline).pp, "410");
  timeline.ppInfo!.onlineFinalPP = NaN;
  assert.equal(youtubeInputs(timeline).pp, "410");
});

test("unverified claims and unavailable data are omitted, with manual inputs supported", () => {
  const timeline = replay();
  timeline.mods = "NM";
  timeline.sceneInfo!.playStatus!.verified = false;
  delete timeline.ppInfo;
  delete timeline.sceneInfo!.beatmapId;
  const inputs = youtubeInputs(timeline);
  assert.deepEqual(inputs, { playerUrl: "", beatmapUrl: "", pp: "", status: "" });
  const text = generateYouTubeText(timeline, { ...inputs, pp: "0", status: "2xMiss", playerUrl: "https://osu.ppy.sh/users/42" }, "My credits");
  assert.match(text.title, /2xMiss 0pp/);
  assert.ok(!text.title.includes("NM"));
  assert.match(text.description, /Player: https:\/\/osu.ppy.sh\/users\/42/);
  assert.ok(text.description.endsWith("\n\nMy credits"));
  const bare = generateYouTubeText({ ...timeline, sceneInfo: undefined, stars: NaN, bpm: NaN });
  assert.equal(bare.title, "Player | Artist - Song [Hard]");
  assert.ok(!/undefined|NaN|\{/.test(bare.description));
});

test("verified completion, FC, misses, and slider breaks use the existing classification", () => {
  const timeline = replay();
  const play = timeline.sceneInfo!.playStatus!;
  play.completed = false;
  assert.equal(youtubeInputs(timeline).status, "FAIL");
  play.completed = true;
  play.fullCombo = false;
  play.sliderBreaks = 2;
  assert.equal(youtubeInputs(timeline).status, "2xSB");
  timeline.sceneInfo!.score.hits["0"] = 3;
  assert.equal(youtubeInputs(timeline).status, "3xMiss");
  play.verified = false;
  assert.equal(youtubeInputs(timeline).status, "");
});

test("copy validation counts Unicode characters and UTF-8 bytes without changing manual text", () => {
  assert.equal(youtubeTextError("title", "⭐".repeat(100)), undefined);
  assert.equal(youtubeTextError("title", "🎵".repeat(100)), undefined);
  assert.match(youtubeTextError("title", "🎵".repeat(101))!, /Remove 1 character/);
  assert.equal(youtubeTextError("description", "é".repeat(2500)), undefined);
  assert.match(youtubeTextError("description", "é".repeat(2501))!, /Remove 2 bytes/);
  assert.ok(youtubeTextError("title", "   "));
  assert.ok(youtubeTextError("description", "<credit>"));
  assert.equal(youtubeTextError("description", ""), undefined);
  const inputs = youtubeInputs(replay());
  assert.deepEqual(youtubeInputErrors({ ...inputs, playerUrl: "https://osu.ppy.sh/users/42" }), {});
  assert.ok(youtubeInputErrors({ ...inputs, playerUrl: "https://example.com/users/42" }).playerUrl);
  assert.ok(youtubeInputErrors({ ...inputs, pp: "-1" }).pp);
});
