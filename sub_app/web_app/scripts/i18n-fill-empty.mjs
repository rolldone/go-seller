import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const rootDir = process.cwd();
const sourceDir = path.join(rootDir, "src/i18n/locales/id");
const targetDir = path.join(rootDir, "src/i18n/locales/en");

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEmptyValue(value) {
  return value === "" || value === null || value === undefined;
}

function mergeFallbackValues(sourceValue, targetValue) {
  if (Array.isArray(sourceValue)) {
    if (Array.isArray(targetValue) && targetValue.length > 0) {
      return targetValue;
    }

    return sourceValue;
  }

  if (isPlainObject(sourceValue)) {
    const sourceObject = sourceValue;
    const targetObject = isPlainObject(targetValue) ? targetValue : {};
    const merged = {};
    const keys = new Set([...Object.keys(sourceObject), ...Object.keys(targetObject)]);

    for (const key of keys) {
      const sourceChild = sourceObject[key];
      const targetChild = targetObject[key];

      if (sourceChild === undefined) {
        merged[key] = targetChild;
        continue;
      }

      if (targetChild === undefined) {
        merged[key] = sourceChild;
        continue;
      }

      merged[key] = mergeFallbackValues(sourceChild, targetChild);
    }

    return merged;
  }

  return isEmptyValue(targetValue) ? sourceValue : targetValue;
}

async function collectJsonFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...await collectJsonFiles(entryPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(entryPath);
    }
  }

  return files;
}

async function main() {
  const sourceFiles = await collectJsonFiles(sourceDir);

  for (const sourceFile of sourceFiles) {
    const relativePath = path.relative(sourceDir, sourceFile);
    const targetFile = path.join(targetDir, relativePath);

    const sourceContent = JSON.parse(await readFile(sourceFile, "utf8"));
    let targetContent = {};

    try {
      targetContent = JSON.parse(await readFile(targetFile, "utf8"));
    } catch (error) {
      if (!error || error.code !== "ENOENT") {
        throw error;
      }
    }

    const mergedContent = mergeFallbackValues(sourceContent, targetContent);
    const serialized = `${JSON.stringify(mergedContent, null, 2)}\n`;

    await writeFile(targetFile, serialized, "utf8");
    console.log(`Filled fallback values: ${path.relative(rootDir, targetFile)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
