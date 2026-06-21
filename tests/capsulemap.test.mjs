import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { judgeTask } from "../src/local-judge.mjs";
import { scanProject } from "../src/project-scan.mjs";
import { renderSearchGraphRoadmap, writeHandoffPack } from "../src/writer.mjs";

function fixture() {
  const root = mkdtempSync(join(tmpdir(), "capsulemap-"));
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "tests"), { recursive: true });
  writeFileSync(join(root, "src", "util.js"), "export function add(a, b) { return a + b; }\n");
  writeFileSync(join(root, "src", "index.js"), "import { add } from './util.js';\nexport function main() { return add(1, 2); }\n");
  writeFileSync(join(root, "tests", "index.test.js"), "import { main } from '../src/index.js';\nif (main() !== 3) throw new Error('bad math');\n");
  return root;
}

test("scanProject builds source, import, and test relationships", () => {
  const root = fixture();
  const scan = scanProject(root);

  assert.equal(scan.sourceFiles.length, 2);
  assert.equal(scan.testFiles.length, 1);
  assert.deepEqual(scan.impactMap.files["src/index.js"].imports, ["src/util.js"]);
  assert.deepEqual(scan.impactMap.files["src/index.js"].nearbyTests, ["tests/index.test.js"]);
  assert.deepEqual(scan.testMap.byTest["tests/index.test.js"], ["src/index.js"]);
  assert.equal(scan.symbolMap.symbols["src/index.js#main"].name, "main");
  assert.equal(scan.symbolMap.symbols["src/index.js#main"].line, 2);
  assert.deepEqual(scan.symbolMap.byFile["src/index.js"], ["src/index.js#main"]);
});

test("scanProject ignores shebang when building summaries", () => {
  const root = fixture();
  mkdirSync(join(root, "bin"), { recursive: true });
  writeFileSync(join(root, "bin", "tool.mjs"), "#!/usr/bin/env node\nconsole.log('hi');\n");

  const scan = scanProject(root);

  assert.equal(scan.impactMap.files["bin/tool.mjs"].summary, "tool CLI command module.");
});

test("writeHandoffPack writes the agent docs including symbols", () => {
  const root = fixture();
  const scan = scanProject(root);
  const result = writeHandoffPack(scan, root);

  assert.equal(result.files.length, 8);
  const capsule = readFileSync(join(root, "docs", "ai", "PROJECT-CAPSULE.md"), "utf8");
  assert.match(capsule, /First Reads For Agents/);
  assert.match(capsule, /capsulemap symbol/);
  const symbolIndex = readFileSync(join(root, "docs", "ai", "SYMBOL-INDEX.md"), "utf8");
  assert.match(symbolIndex, /main/);
  const symbolMap = JSON.parse(readFileSync(join(root, "docs", "ai", "SYMBOL-MAP.json"), "utf8"));
  assert.equal(symbolMap.symbols["src/util.js#add"].kind, "function");
  const roadmap = readFileSync(join(root, "docs", "ai", "SEARCH-GRAPH-ROADMAP.md"), "utf8");
  assert.match(roadmap, /QMD-style local markdown search/);
  assert.match(roadmap, /Attention Gate/);
  const testMap = JSON.parse(readFileSync(join(root, "docs", "ai", "TEST-MAP.json"), "utf8"));
  assert.deepEqual(testMap.bySource["src/index.js"], ["tests/index.test.js"]);
});

test("renderSearchGraphRoadmap describes search graph and attention layers", () => {
  const root = fixture();
  const scan = scanProject(root);
  const roadmap = renderSearchGraphRoadmap(scan);

  assert.match(roadmap, /Local Search & Graph Roadmap/);
  assert.match(roadmap, /Relationship Graph Adapter/);
  assert.match(roadmap, /multilingual-e5-large-instruct/);
});

test("judgeTask uses deterministic local triage by default", async () => {
  const result = await judgeTask("continue the refactor and run tests", {});

  assert.equal(result.source, "heuristic");
  assert.equal(result.needsCapsule, true);
  assert.ok(result.requiredDocs.includes("docs/ai/IMPACT-MAP.json"));
  assert.ok(result.requiredDocs.includes("docs/ai/TEST-MAP.json"));
});

test("CLI init and check work on a fixture repo", () => {
  const root = fixture();
  const cli = join(process.cwd(), "bin", "capsulemap.mjs");
  const initOutput = execFileSync("node", [cli, "init", root], { encoding: "utf8" });
  assert.match(initOutput, /Docs written/);

  const checkOutput = execFileSync("node", [cli, "check", "src/index.js", root], { encoding: "utf8" });
  assert.match(checkOutput, /Risk:/);
  assert.match(checkOutput, /tests\/index.test.js/);

  const symbolOutput = execFileSync("node", [cli, "symbol", "main", root], { encoding: "utf8" });
  assert.match(symbolOutput, /src\/index.js:2/);
  assert.match(symbolOutput, /tests=index.test.js|tests\/index.test.js/);

  const symbolsOutput = execFileSync("node", [cli, "symbols", "src/util.js", root], { encoding: "utf8" });
  assert.match(symbolsOutput, /add/);
  assert.match(symbolsOutput, /line=1/);

  const roadmapOutput = execFileSync("node", [cli, "roadmap", root], { encoding: "utf8" });
  assert.match(roadmapOutput, /QMD-style local markdown search/);
});
