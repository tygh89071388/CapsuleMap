#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { judgeTask } from "../src/local-judge.mjs";
import { scanProject } from "../src/project-scan.mjs";
import { renderHandoffPrompt, renderSearchGraphRoadmap, writeHandoffPack } from "../src/writer.mjs";

function usage() {
  return `CapsuleMap

Usage:
  capsulemap init [projectRoot]
  capsulemap scan [projectRoot] [--json]
  capsulemap check <file> [projectRoot]
  capsulemap symbol <name-or-regex> [projectRoot]
  capsulemap symbols <file> [projectRoot]
  capsulemap prompt [projectRoot]
  capsulemap roadmap [projectRoot]
  capsulemap judge <task text>
`;
}

function print(value) {
  process.stdout.write(`${value}\n`);
}

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function summarize(scan) {
  return [
    `Project: ${scan.repoName}`,
    `Source files: ${scan.sourceFiles.length}`,
    `Test files: ${scan.testFiles.length}`,
    `Indexed files: ${scan.files.length}`,
  ].join("\n");
}

function checkFile(fileArg, rootArg = ".") {
  const root = resolve(rootArg);
  const relativeFile = fileArg.replace(/\\/g, "/").replace(/^\.\//, "");
  const impactPath = join(root, "docs", "ai", "IMPACT-MAP.json");
  const testPath = join(root, "docs", "ai", "TEST-MAP.json");

  let impactMap;
  let testMap;
  if (existsSync(impactPath) && existsSync(testPath)) {
    impactMap = loadJson(impactPath);
    testMap = loadJson(testPath);
  } else {
    const scan = scanProject(root);
    impactMap = scan.impactMap;
    testMap = scan.testMap;
  }

  const entry = impactMap.files[relativeFile];
  if (!entry) {
    throw new Error(`File is not indexed: ${relativeFile}`);
  }

  const tests = testMap.bySource[relativeFile] ?? entry.nearbyTests ?? [];
  return [
    `File: ${relativeFile}`,
    `Risk: ${entry.riskRank}`,
    `Imports: ${entry.imports.length ? entry.imports.join(", ") : "none"}`,
    `Imported by: ${entry.importedBy.length ? entry.importedBy.join(", ") : "none"}`,
    `Suggested tests: ${tests.length ? tests.join(", ") : "none found"}`,
  ].join("\n");
}

function loadOrScanMaps(root) {
  const impactPath = join(root, "docs", "ai", "IMPACT-MAP.json");
  const testPath = join(root, "docs", "ai", "TEST-MAP.json");
  const symbolPath = join(root, "docs", "ai", "SYMBOL-MAP.json");
  if (existsSync(impactPath) && existsSync(testPath) && existsSync(symbolPath)) {
    return {
      impactMap: loadJson(impactPath),
      testMap: loadJson(testPath),
      symbolMap: loadJson(symbolPath),
    };
  }
  const scan = scanProject(root);
  return {
    impactMap: scan.impactMap,
    testMap: scan.testMap,
    symbolMap: scan.symbolMap,
  };
}

function symbolSearch(patternArg, rootArg = ".") {
  const root = resolve(rootArg);
  const { impactMap, symbolMap } = loadOrScanMaps(root);
  const pattern = new RegExp(patternArg, "i");
  const rows = Object.values(symbolMap.symbols)
    .filter(symbol => pattern.test(symbol.name) || pattern.test(symbol.id) || pattern.test(symbol.signature))
    .sort((left, right) => left.path.localeCompare(right.path) || left.line - right.line || left.name.localeCompare(right.name));

  const lines = [`Symbol "${patternArg}": ${rows.length} match${rows.length === 1 ? "" : "es"}`];
  for (const symbol of rows.slice(0, 30)) {
    const file = impactMap.files[symbol.path];
    const tests = file?.nearbyTests?.length ? file.nearbyTests.join(", ") : "none";
    lines.push(`- ${symbol.name} | ${symbol.kind} | ${symbol.path}:${symbol.line} | risk=${file?.riskRank ?? "unknown"} | tests=${tests} | ${symbol.signature}`);
  }
  if (rows.length > 30) lines.push(`- ... ${rows.length - 30} more matches hidden`);
  return lines.join("\n");
}

function symbolsInFile(fileArg, rootArg = ".") {
  const root = resolve(rootArg);
  const relativeFile = fileArg.replace(/\\/g, "/").replace(/^\.\//, "");
  const { symbolMap } = loadOrScanMaps(root);
  const ids = symbolMap.byFile[relativeFile] ?? [];
  const lines = [`Symbols in ${relativeFile}: ${ids.length}`];
  for (const id of ids) {
    const symbol = symbolMap.symbols[id];
    if (!symbol) continue;
    lines.push(`- ${symbol.name} | ${symbol.kind} | line=${symbol.line} | exported=${symbol.exported} | ${symbol.signature}`);
  }
  return lines.join("\n");
}

async function main(argv) {
  const [command, ...args] = argv;

  if (!command || command === "help" || command === "--help" || command === "-h") {
    print(usage());
    return;
  }

  if (command === "init") {
    const root = args[0] || ".";
    const scan = scanProject(root);
    const result = writeHandoffPack(scan, root);
    print(`${summarize(scan)}\nDocs written:\n${result.files.map(file => `- ${file}`).join("\n")}`);
    return;
  }

  if (command === "scan") {
    const json = args.includes("--json");
    const root = args.find(arg => arg !== "--json") || ".";
    const scan = scanProject(root);
    print(json ? JSON.stringify(scan, null, 2) : summarize(scan));
    return;
  }

  if (command === "check") {
    if (!args[0]) throw new Error("Missing file path for check command.");
    print(checkFile(args[0], args[1] || "."));
    return;
  }

  if (command === "symbol") {
    if (!args[0]) throw new Error("Missing name or regex for symbol command.");
    print(symbolSearch(args[0], args[1] || "."));
    return;
  }

  if (command === "symbols") {
    if (!args[0]) throw new Error("Missing file path for symbols command.");
    print(symbolsInFile(args[0], args[1] || "."));
    return;
  }

  if (command === "prompt") {
    print(renderHandoffPrompt(args[0] || "."));
    return;
  }

  if (command === "roadmap") {
    print(renderSearchGraphRoadmap(scanProject(args[0] || ".")));
    return;
  }

  if (command === "judge") {
    const task = args.join(" ").trim();
    if (!task) throw new Error("Missing task text for judge command.");
    print(JSON.stringify(await judgeTask(task), null, 2));
    return;
  }

  throw new Error(`Unknown command: ${command}`);
}

main(process.argv.slice(2)).catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
