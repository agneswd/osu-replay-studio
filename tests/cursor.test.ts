import test from "node:test";
import assert from "node:assert/strict";
import { visibleCursorFrames } from "../core/cursor.js";

test("cursor startup skips off-screen markers and retains absolute replay timing", () => {
  const frames = [
    { timeDelta: 0, x: 256, y: -500, keys: 0 },
    { timeDelta: -1, x: 256, y: -500, keys: 0 },
    { timeDelta: -750, x: 144, y: 200, keys: 1 },
    { timeDelta: 24, x: 140, y: 190, keys: 1 },
  ];
  const cursor = visibleCursorFrames(frames);
  assert.deepEqual(cursor, [{ ...frames[2], timeDelta: -751 }, frames[3]]);
  assert.equal(frames.length, 4);
  assert.equal(frames[2].timeDelta, -750);
  assert.equal(visibleCursorFrames(cursor), cursor);
  assert.deepEqual(visibleCursorFrames([]), []);
});
