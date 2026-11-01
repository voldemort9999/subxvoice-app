// Publishes an installer to the releases repo. This is the ONLY path that publishes:
// `pnpm dist:win` builds the same installer with `--publish never`, so the EXEs produced while
// testing can never become an update someone's machine downloads.
//
// The GitHub token is read from the credential helper git already uses to push, so there is no
// token in a file, in the repo, or in the shell history.

import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

const target = process.argv[2];
if (target !== "--win" && target !== "--mac") {
  console.error("usage: node scripts/release.mjs --win|--mac");
  process.exit(1);
}

function githubToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  // `git credential fill` prints key=value lines; the password is the token.
  const out = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
  });
  const token = out.match(/^password=(.*)$/m)?.[1];
  if (!token) {
    console.error("No GitHub token. Either set GH_TOKEN, or run a `git push` once so the");
    console.error("credential helper stores one.");
    process.exit(1);
  }
  return token;
}

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, GH_TOKEN: githubToken() },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

console.log(`\nPublishing SUBXVoice ${version} to the releases repo.`);
console.log("Every installed copy will download this. Ctrl+C now if that is not what you meant.\n");

run("node", ["scripts/build-icon.mjs"]);
run("npx", ["electron-vite", "build"]);
run("npx", ["electron-builder", target, "--publish", "always"]);

console.log(`\nDone. SUBXVoice ${version} is live.`);
console.log("https://github.com/voldemort9999/subxvoice-releases/releases/latest");
