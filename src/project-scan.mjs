import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve } from "node:path";

const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
]);

const DEFAULT_INCLUDE_DIRS = [
  "src",
  "lib",
  "app",
  "server",
  "scripts",
  "bin",
  "tests",
  "test",
];

const DEFAULT_IGNORE_DIRS = new Set([
  ".git",
  ".idea",
  ".vscode",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "__pycache__",
  ".pytest_cache",
  ".venv",
  "venv",
  "tmp",
  "docs",
]);

function toPosix(value) {
  return value.replace(/\\/g, "/");
}

function rel(root, filePath) {
  return toPosix(relative(root, filePath));
}

function sortObject(object) {
  return Object.fromEntries(
    Object.entries(object).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function isSupported(filePath) {
  return SUPPORTED_EXTENSIONS.has(extname(filePath).toLowerCase());
}

export function isTestFile(path) {
  const lower = path.toLowerCase();
  const file = basename(lower);
  return (
    lower.startsWith("tests/") ||
    lower.startsWith("test/") ||
    lower.includes("/tests/") ||
    lower.includes("/__tests__/") ||
    lower.includes(".test.") ||
    lower.includes(".spec.") ||
    file.startsWith("test_") ||
    file.endsWith("_test.py")
  );
}

function categoryFor(path) {
  if (isTestFile(path)) return "test";
  if (path.startsWith("bin/")) return "cli";
  if (path.startsWith("scripts/")) return "script";
  if (/(^|\/)(index|main|app|server|cli)\.(js|mjs|cjs|ts|py)$/.test(path)) {
    return "entrypoint";
  }
  return "source";
}

function summaryFor(path, source) {
  const withoutShebang = source.replace(/^#!.*(?:\r?\n|$)/, "");
  const firstComment = withoutShebang.match(/^\s*(?:\/\*\*([\s\S]*?)\*\/|#\s*(.+)|\/\/\s*(.+))/);
  if (firstComment) {
    const raw = firstComment[1] ?? firstComment[2] ?? firstComment[3] ?? "";
    const cleaned = raw
      .split("\n")
      .map(line => line.replace(/^\s*\*\s?/, "").trim())
      .filter(Boolean)
      .slice(0, 2)
      .join(" ");
    if (cleaned) return cleaned.slice(0, 180);
  }

  const name = basename(path, extname(path));
  if (categoryFor(path) === "entrypoint") return `${name} entrypoint.`;
  if (categoryFor(path) === "cli") return `${name} CLI command module.`;
  return `${name} module.`;
}

function walk(root, dir, files) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    if (DEFAULT_IGNORE_DIRS.has(entry)) continue;
    const absolute = join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) {
      walk(root, absolute, files);
    } else if (stat.isFile() && isSupported(absolute)) {
      files.push(rel(root, absolute));
    }
  }
}

function collectFiles(root) {
  const files = [];
  for (const includeDir of DEFAULT_INCLUDE_DIRS) {
    const absolute = join(root, includeDir);
    if (existsSync(absolute)) walk(root, absolute, files);
  }

  for (const topLevel of readdirSync(root)) {
    const absolute = join(root, topLevel);
    if (!statSync(absolute).isFile()) continue;
    if (isSupported(absolute)) files.push(rel(root, absolute));
  }

  return [...new Set(files)].sort();
}

function extractImportSpecifiers(path, source) {
  const specs = [];

  if (/\.(mjs|cjs|js|jsx|ts|tsx)$/.test(path)) {
    const patterns = [
      /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?["']([^"']+)["']/g,
      /import\(\s*["']([^"']+)["']\s*\)/g,
      /require\(\s*["']([^"']+)["']\s*\)/g,
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) specs.push(match[1]);
    }
  }

  if (path.endsWith(".py")) {
    for (const match of source.matchAll(/^\s*(?:from\s+([.\w]+)\s+import|import\s+([.\w]+))/gm)) {
      specs.push(match[1] ?? match[2]);
    }
  }

  return [...new Set(specs)];
}

function resolveRelativeImport(fromPath, specifier, fileSet) {
  if (!specifier.startsWith(".")) return null;

  const base = toPosix(join(dirname(fromPath), specifier));
  const candidates = [
    base,
    `${base}.js`,
    `${base}.jsx`,
    `${base}.mjs`,
    `${base}.cjs`,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.py`,
    `${base}/index.js`,
    `${base}/index.mjs`,
    `${base}/index.ts`,
    `${base}/__init__.py`,
  ];

  return candidates.find(candidate => fileSet.has(candidate)) ?? null;
}

function sourceStem(path) {
  const file = basename(path).toLowerCase();
  return file
    .replace(/\.(test|spec)\.(js|jsx|mjs|cjs|ts|tsx|py)$/, "")
    .replace(/^test_/, "")
    .replace(/_test\.py$/, "")
    .replace(/\.(js|jsx|mjs|cjs|ts|tsx|py)$/, "");
}

function inferNearbyTests(sourcePath, testFiles, directImportTests) {
  const sourceName = sourceStem(sourcePath);
  const direct = directImportTests[sourcePath] ?? [];
  const nameMatches = testFiles.filter(testPath => {
    const testName = sourceStem(testPath);
    return testName === sourceName || testName.includes(sourceName);
  });
  return [...new Set([...direct, ...nameMatches])].sort();
}

function riskRank(importedByCount, nearbyTestsCount, category) {
  if (category === "entrypoint") return "critical";
  if (importedByCount >= 8) return "critical";
  if (importedByCount >= 4) return "high";
  if (importedByCount >= 1 || nearbyTestsCount === 0) return "medium";
  return "low";
}

export function scanProject(projectRoot = ".") {
  const root = resolve(projectRoot);
  const files = collectFiles(root);
  const fileSet = new Set(files);
  const sourceFiles = files.filter(path => !isTestFile(path));
  const testFiles = files.filter(isTestFile);
  const importsByFile = {};
  const importedBy = {};
  const directImportTests = {};

  for (const file of files) {
    importedBy[file] = [];
    directImportTests[file] = [];
  }

  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    const imports = extractImportSpecifiers(file, source)
      .map(spec => resolveRelativeImport(file, spec, fileSet))
      .filter(Boolean)
      .sort();
    importsByFile[file] = [...new Set(imports)];

    for (const imported of importsByFile[file]) {
      importedBy[imported].push(file);
      if (isTestFile(file)) directImportTests[imported].push(file);
    }
  }

  const nodes = {};
  for (const file of files) {
    const source = readFileSync(join(root, file), "utf8");
    const category = categoryFor(file);
    const imports = importsByFile[file] ?? [];
    const reverseImports = [...new Set(importedBy[file] ?? [])].sort();
    const nearbyTests = isTestFile(file)
      ? []
      : inferNearbyTests(file, testFiles, directImportTests);
    const lineCount = source.length === 0 ? 0 : source.split(/\r?\n/).length;

    nodes[file] = {
      path: file,
      category,
      summary: summaryFor(file, source),
      imports,
      importedBy: reverseImports,
      nearbyTests,
      lineCount,
      impactScore: reverseImports.length * 2 + imports.length + nearbyTests.length,
      riskRank: riskRank(reverseImports.length, nearbyTests.length, category),
    };
  }

  const bySource = {};
  const byTest = {};
  for (const source of sourceFiles) {
    bySource[source] = nodes[source].nearbyTests;
  }
  for (const test of testFiles) {
    byTest[test] = importsByFile[test]?.filter(imported => !isTestFile(imported)) ?? [];
  }

  const generatedAt = new Date().toISOString();
  return {
    generatedAt,
    repoName: basename(root),
    root,
    sourceFiles,
    testFiles,
    files,
    impactMap: {
      generatedAt,
      repoName: basename(root),
      files: sortObject(nodes),
    },
    testMap: {
      generatedAt,
      repoName: basename(root),
      bySource: sortObject(bySource),
      byTest: sortObject(byTest),
    },
  };
}
