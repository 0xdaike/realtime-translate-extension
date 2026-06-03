import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const SRC_ROOT = join(REPO_ROOT, "src");
const CONTENT_ROOT = join(SRC_ROOT, "content");

const DANGEROUS_MANIFEST_PERMISSIONS = [
  "<all_urls>",
  "tabs",
  "cookies",
  "history",
  "webRequest",
  "debugger",
  "unlimitedStorage"
];

const UNSAFE_CONTENT_PATTERNS = [
  "innerHTML",
  "outerHTML",
  "insertAdjacentHTML",
  "document.write",
  "eval("
];

const CONTENT_FORBIDDEN_TOKENS = [
  "chrome.storage",
  "fetch(",
  "clientSecret",
  "getApiKeyForTrustedContext"
];

const MOJIBAKE_MARKERS = [
  "\u7e67",
  "\u7e3a",
  "\u8adb",
  "\u8b1c",
  "\u87a2",
  "\u87f7",
  "\u9139",
  "\uff80",
  "\uff9e",
  "\uff8a",
  "\uff9f"
];

describe("static safety checks", () => {
  it("does not request broad or sensitive manifest permissions", () => {
    const manifest = JSON.parse(readFileSync(join(REPO_ROOT, "public", "manifest.json"), "utf8"));
    const allPermissions = [
      ...(manifest.permissions ?? []),
      ...(manifest.host_permissions ?? [])
    ];

    for (const permission of DANGEROUS_MANIFEST_PERMISSIONS) {
      expect(allPermissions).not.toContain(permission);
    }
  });

  it("keeps content scripts display-only and avoids unsafe HTML injection", () => {
    const contentFiles = readSourceFiles(CONTENT_ROOT);

    for (const file of contentFiles) {
      const text = readFileSync(file, "utf8");

      for (const pattern of UNSAFE_CONTENT_PATTERNS) {
        expect(text, `${file} contains ${pattern}`).not.toContain(pattern);
      }

      for (const token of CONTENT_FORBIDDEN_TOKENS) {
        expect(text, `${file} contains ${token}`).not.toContain(token);
      }
    }
  });

  it("does not contain common mojibake markers in source UI code", () => {
    const sourceFiles = readSourceFiles(SRC_ROOT);

    for (const file of sourceFiles) {
      const text = readFileSync(file, "utf8");

      for (const marker of MOJIBAKE_MARKERS) {
        expect(text, `${file} contains mojibake marker ${marker}`).not.toContain(marker);
      }
    }
  });
});

function readSourceFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) {
      files.push(...readSourceFiles(path));
      continue;
    }

    if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      files.push(path);
    }
  }

  return files;
}
