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
  assert.match(text.description, /\/\/ = Beatmap info/);
  assert.match(text.description, /Link: https:\/\/osu.ppy.sh\/beatmaps\/123/);
  assert.ok(!text.description.includes("Player:"));
  assert.match(text.description, /⭐6.25 \| 180bpm \| AR: 10 \| CS: 4.00 \| OD: 9.00 \| HP: 6.00/);
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
  assert.ok(Object.values(inputs).every(value => value === ""));
  const text = generateYouTubeText(timeline, { ...inputs, pp: "0", status: "2xMiss", playerUrl: "https://osu.ppy.sh/users/42" }, "My credits");
  assert.match(text.title, /2xMiss 0pp/);
  assert.ok(!text.title.includes("NM"));
  assert.match(text.description, /Profile: https:\/\/osu.ppy.sh\/users\/42/);
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


test("reference description groups player links, map details, and account stats", () => {
  const timeline = replay();
  timeline.playerStats = { countryRank: 1, pp: 8648, hours: 120, playcount: 89206, monthlyPlaycounts: [] };
  timeline.playerRank = 15818;
  const inputs = { ...youtubeInputs(timeline), playerUrl: "https://osu.ppy.sh/users/23441928",
    twitchUrl: "https://www.twitch.tv/fumburrito", youtubeUrl: "https://www.youtube.com/@player",
    mapperUrl: "https://osu.ppy.sh/users/10827686", joined: "2021-01-01" };
  assert.equal(generateYouTubeText(timeline, inputs).description, `// = Player links
Profile: https://osu.ppy.sh/users/23441928
YouTube: https://www.youtube.com/@player
Twitch: https://www.twitch.tv/fumburrito

// = Beatmap info
Link: https://osu.ppy.sh/beatmaps/123
Mapper: https://osu.ppy.sh/users/10827686
⭐6.25 | 180bpm | AR: 10 | CS: 4.00 | OD: 9.00 | HP: 6.00

// = Player info
Total played: 120h
Playcount: 89,206
Rank: #15,818
Join: 2021-01-01
PP: 8,648`);
  assert.deepEqual(youtubeInputErrors(inputs), {});
  assert.deepEqual(youtubeInputErrors({ ...inputs, beatmapUrl: "https://osu.ppy.sh/beatmapsets/2252339#osu/5302833" }), {});
  assert.ok(youtubeInputErrors({ ...inputs, twitchUrl: "https://twitch.tv.evil.example/player" }).twitchUrl);
  assert.ok(youtubeInputErrors({ ...inputs, status: "0xMiss" }).status);
  assert.ok(youtubeInputErrors({ ...inputs, status: "1.5xSB" }).status);
});


test("reference title preserves the requested field order and formatting", () => {
  const timeline = replay();
  timeline.player = "Narendra Modi";
  timeline.mods = "NM";
  timeline.stars = 7.52;
  Object.assign(timeline.sceneInfo!, { artist: "Unlucky Morpheus", songTitle: "Faith", difficulty: "Mekadon's Extreme" });
  timeline.sceneInfo!.score.accuracy = 98.58;
  assert.equal(generateYouTubeText(timeline, { ...youtubeInputs(timeline), pp: "495" }).title,
    "Narendra Modi | 7.52⭐ | Unlucky Morpheus - Faith [Mekadon's Extreme] FC 495pp | 98.58%");
});
