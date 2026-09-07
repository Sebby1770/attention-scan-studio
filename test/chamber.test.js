import assert from "node:assert/strict";
import test from "node:test";

import { blipPoint, blipRadius, hashAngle } from "../public/chamber.js";

test("hashAngle is deterministic and wraps a full circle", () => {
  const a = hashAngle("owner/repo#pr-1");
  const b = hashAngle("owner/repo#pr-1");
  const c = hashAngle("owner/repo#pr-2");
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a >= 0 && a < Math.PI * 2);
});

test("blipRadius pulls higher scores toward the origin", () => {
  const far = blipRadius(10, 160);
  const near = blipRadius(120, 160);
  assert.ok(near < far);
  assert.ok(near >= 22);
  assert.ok(far <= 160);
});

test("blipPoint maps an item onto the scope", () => {
  const point = blipPoint({ id: "x", score: 100, severity: "critical" }, 200, 200, 160);
  assert.ok(Number.isFinite(point.x));
  assert.ok(Number.isFinite(point.y));
  assert.equal(point.color, "#ff5a4a");
  assert.ok(point.size > 4);
});
