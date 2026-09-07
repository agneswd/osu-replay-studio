import test from "node:test";
import assert from "node:assert/strict";
import { validateThumbnailText } from "../core/thumbnail.js";

test("thumbnail text accepts empty captions and a selected repeated phrase", () => {
  validateThumbnailText({ bottomText: "" });
  validateThumbnailText({ bottomText: "great play, great score", accentRange: { start: 12, end: 17 } });
  validateThumbnailText({});
});

test("thumbnail text rejects invalid selections and oversized captions", () => {
  for (const accentRange of [{ start: -1, end: 2 }, { start: 1, end: 1 }, { start: 0, end: 5 }, { start: 0.5, end: 2 }])
    assert.throws(() => validateThumbnailText({ bottomText: "text", accentRange }));
  assert.throws(() => validateThumbnailText({ bottomText: "x".repeat(161) }));
  assert.throws(() => validateThumbnailText({ bottomText: "two\nlines" }));
});
