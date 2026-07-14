import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "token stack npm 검증-"));

function npm(args, cwd) {
  const npmCli = process.env.npm_execpath;
  const command = npmCli ? process.execPath : process.platform === "win32" ? "npm.cmd" : "npm";
  const commandArgs = npmCli ? [npmCli, ...args] : args;
  const result = spawnSync(command, commandArgs, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}

try {
  const packOutput = npm(["pack", "--ignore-scripts", "--json", "--pack-destination", temp], root);
  const parsed = JSON.parse(packOutput);
  const packed = Array.isArray(parsed) ? parsed[0] : Object.values(parsed)[0];
  assert.ok(packed?.filename, "npm pack did not return package metadata");
  const tarball = path.join(temp, packed.filename);
  assert.ok(fs.existsSync(tarball), "npm pack did not create a tarball");

  const consumer = path.join(temp, "consumer project 한글");
  fs.mkdirSync(consumer, { recursive: true });
  fs.writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "token-stack-smoke-consumer", private: true }));
  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund", tarball], consumer);

  const packageRoot = path.join(consumer, "node_modules", "@sukojin", "token-stack");
  assert.ok(fs.existsSync(path.join(packageRoot, "bin", "token-stack.js")), "published bin file is missing");
  assert.ok(fs.existsSync(path.join(packageRoot, "src", "render.js")), "published renderer is missing");
  assert.ok(fs.existsSync(path.join(packageRoot, "README.md")), "published README is missing");

  const shim = path.join(consumer, "node_modules", ".bin", process.platform === "win32" ? "token-stack.cmd" : "token-stack");
  assert.ok(fs.existsSync(shim), "npm did not create the token-stack executable shim");
  if (process.platform === "win32") assert.match(fs.readFileSync(shim, "utf8"), /token-stack\.js/, "Windows command shim points at the wrong bin");
  else assert.ok((fs.statSync(shim).mode & 0o111) !== 0, "token-stack shim is not executable");
  const help = process.platform === "win32"
    ? spawnSync(process.env.ComSpec || "cmd.exe", ["/d", "/s", "/c", `""${shim}" --help"`], { cwd: consumer, encoding: "utf8", windowsVerbatimArguments: true })
    : spawnSync(shim, ["--help"], { cwd: consumer, encoding: "utf8" });
  assert.equal(help.status, 0, help.stderr || help.stdout);
  assert.match(help.stdout, /Usage:/);
  assert.match(help.stdout, /--provider/);
  console.log(`packed, installed, and executed ${packed.filename} from a spaced Unicode path`);
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
