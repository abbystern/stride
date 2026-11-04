// Mutation of a temporary COPY only. Production code/test expectations never change.
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

await mkdir("generated-artifacts", { recursive: true });
const dir = await mkdtemp("generated-artifacts/dashboard-mutation-");
let status = 1;
try {
  const source = await readFile("src/lib/dashboard.ts", "utf8");
  const guard = 'if (workout.status !== "completed") continue;';
  if (source.split(guard).length !== 2) throw new Error("Expected exactly one completed-only guard; no mutation applied.");
  const mutated = source.replace(guard, 'if (workout.status !== "completed" && workout.status !== "planned") continue;');
  const modulePath = resolve(dir, "dashboard.ts");
  await writeFile(modulePath, mutated);
  const test = await readFile("tests/dashboard.test.ts", "utf8");
  if (!test.includes('from "../src/lib/dashboard.ts"')) throw new Error("Dashboard test import changed; no demonstration run.");
  await writeFile(resolve(dir, "dashboard.test.ts"), test.replaceAll('"../src/lib/dashboard.ts"', JSON.stringify(pathToFileURL(modulePath).href)));
  console.log("TEST-ONLY DEFECT: a temporary copy of the real dashboard function includes planned runs.");
  console.log("Production source and the assertion expecting 15 miles are unchanged.");
  const result = spawnSync(process.execPath, ["--experimental-strip-types", "--test", "--test-name-pattern=^required dashboard test:", resolve(dir, "dashboard.test.ts")], { stdio: "inherit" });
  if (result.error) throw result.error;
  status = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
process.exitCode = status;
