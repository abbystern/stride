// Read-only screenshot of actual captured command output; never fabricated text.
import { spawnSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const commands = {
  "data-isolation-fail": ["bash", ["scripts/test-data-isolation.sh", "--demonstrate-leak"], false],
  "data-isolation-pass": ["bash", ["scripts/test-data-isolation.sh"], true],
  "dashboard-fail": ["node", ["scripts/demonstrate-dashboard.mjs"], false],
  "dashboard-pass": ["npm", ["run", "test:required-dashboard"], true],
};
const name = process.argv[2];
if (!Object.hasOwn(commands, name) || process.argv.length !== 3) {
  throw new Error(`Choose exactly one evidence name: ${Object.keys(commands).join(", ")}`);
}
const [command, args, expectPass] = commands[name];
const result = spawnSync(command, args, {
  encoding: "utf8", env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  timeout: 120_000,
});
if (result.error || result.signal) throw result.error ?? new Error(`Test terminated: ${result.signal}`);
const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(output);
console.log(`Actual test process exit code: ${result.status}`);
if ((result.status === 0) !== expectPass) throw new Error("Unexpected result; refusing to label this screenshot as evidence.");
if (!expectPass && !output.includes(name.startsWith("data") ? "User B CAN READ A workout" : "23")) {
  throw new Error("Expected meaningful demonstration failure was not observed.");
}
await mkdir("docs/test-evidence", { recursive: true });
const transcript = `$ ${command} ${args.join(" ")}\n\n${output}\nActual exit code: ${result.status}\n`;
await writeFile(`docs/test-evidence/${name}.txt`, transcript);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
    (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined),
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 850 }, deviceScaleFactor: 1 });
  await page.setContent('<!doctype html><html><head><meta charset="utf-8"><title>Captured test output</title><style>body{margin:0;padding:28px;background:#111820;color:#edf1f5}pre{font:17px/1.65 monospace;white-space:pre-wrap;overflow-wrap:anywhere;margin:0}</style></head><body><pre></pre></body></html>');
  await page.locator("pre").evaluate((element, text) => { element.textContent = text; }, transcript);
  await page.screenshot({ path: `docs/test-evidence/${name}.png`, fullPage: true });
} finally {
  await browser.close();
}
console.log(`Saved docs/test-evidence/${name}.png (actual output in a read-only viewer).`);
