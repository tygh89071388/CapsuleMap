#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { judgeTask } from "../src/local-judge.mjs";
import { scanProject } from "../src/project-scan.mjs";
import { renderHandoffPrompt, writeHandoffPack } from "../src/writer.mjs";

function usage() {
  return `CapsuleMap

Usage:
  capsulemap init [projectRoot]
  capsulemap scan [projectRoot] [--json]
  capsulemap check <file> [projectRoot]
  capsulemap prompt [projectRoot]
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

  if (command === "prompt") {
    print(renderHandoffPrompt(args[0] || "."));
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
