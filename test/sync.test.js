import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { syncToGist } from "../src/sync.js";

const files = [
  { name: "token-stack-activity.svg", content: "<svg/>" },
  { name: "token-stack-agents.svg", content: "<svg/>" },
];

test("Gist creation returns stable README URLs and removes temporary files", () => {
  const uploaded = [];
  const ghRunner = (args) => {
    if (args[0] === "gist" && args[1] === "create") {
      const paths = args.filter((value) => value.endsWith(".svg"));
      uploaded.push(...paths);
      assert.ok(paths.every((file) => fs.existsSync(file)));
      return "https://gist.github.com/example/abc123";
    }
    if (args[0] === "api") return "octocat";
    throw new Error(`unexpected gh call: ${args.join(" ")}`);
  };
  const result = syncToGist(files, { isPublic: true, ghRunner });
  assert.equal(result.gistId, "abc123");
  assert.deepEqual(result.urls, [
    { name: "token-stack-activity.svg", raw: "https://gist.githubusercontent.com/octocat/abc123/raw/token-stack-activity.svg" },
    { name: "token-stack-agents.svg", raw: "https://gist.githubusercontent.com/octocat/abc123/raw/token-stack-agents.svg" },
  ]);
  assert.ok(uploaded.every((file) => !fs.existsSync(file)));
});

test("Gist update adds a missing file and cleans up after failures", () => {
  const temporary = [];
  const calls = [];
  const ghRunner = (args) => {
    calls.push(args);
    const file = args.at(-1);
    if (typeof file === "string" && file.endsWith(".svg")) temporary.push(file);
    if (args[0] === "gist" && args.includes("-f") && args.includes("token-stack-agents.svg")) throw new Error("file not found");
    if (args[0] === "api") return "octocat";
    return "";
  };
  const result = syncToGist(files, { gistId: "existing", ghRunner });
  assert.equal(result.gistId, "existing");
  assert.ok(calls.some((args) => args.includes("--add")));
  assert.ok(temporary.every((file) => !fs.existsSync(file)));

  let failedTemp;
  assert.throws(() => syncToGist(files.slice(0, 1), {
    ghRunner: (args) => {
      failedTemp = args.find((value) => typeof value === "string" && value.endsWith(".svg"));
      throw new Error("auth failed");
    },
  }), /auth failed/);
  assert.equal(fs.existsSync(failedTemp), false);
});
