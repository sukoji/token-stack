import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function gh(args, opts = {}) {
  const res = spawnSync("gh", args, { encoding: "utf8", ...opts });
  if (res.error) {
    throw new Error("GitHub CLI (`gh`) not found. Install it from https://cli.github.com and run `gh auth login`.");
  }
  if (res.status !== 0) {
    throw new Error(`gh ${args[0]} failed: ${(res.stderr || res.stdout || "").trim()}`);
  }
  return res.stdout.trim();
}

// Uploads the rendered SVGs to a gist and returns stable raw URLs that can be
// embedded in any README. Creates the gist on first run (secret by default —
// raw URLs still work for embedding; pass isPublic to list it publicly).
export function syncToGist(files, { gistId, isPublic = false, description = "token-stack cards", ghRunner = gh } = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "token-stack-"));
  const paths = files.map(({ name, content }) => {
    const p = path.join(tmp, name);
    fs.writeFileSync(p, content);
    return p;
  });

  try {
    let id = gistId;
    if (!id) {
      const url = ghRunner(["gist", "create", ...(isPublic ? ["--public"] : []), "-d", description, ...paths]);
      id = url.split("/").pop();
      if (!id) throw new Error("GitHub CLI did not return a Gist id.");
    } else {
      for (const p of paths) {
        try {
          ghRunner(["gist", "edit", id, "-f", path.basename(p), p]);
        } catch {
          ghRunner(["gist", "edit", id, "--add", p]); // file not in the gist yet
        }
      }
    }
    const login = ghRunner(["api", "user", "-q", ".login"]);
    return {
      gistId: id,
      urls: files.map(({ name }) => ({
        name,
        raw: `https://gist.githubusercontent.com/${login}/${id}/raw/${name}`,
      })),
    };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
