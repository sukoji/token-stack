import assert from "node:assert/strict";
import test from "node:test";
import { skylineCases, verifySkylineMatrix } from "../scripts/verify-skyline.mjs";

test("skyline verification matrix stays deterministic, bounded, local, and compact-safe", () => {
  const results = verifySkylineMatrix();
  assert.equal(results.length, skylineCases.length * 4 * 2);
  assert.deepEqual(new Set(results.map((result) => result.id)), new Set(skylineCases.map((item) => item.id)));
  assert.ok(results.some((result) => result.landmarks === 0));
  assert.ok(results.some((result) => result.landmarks > 0));
});
