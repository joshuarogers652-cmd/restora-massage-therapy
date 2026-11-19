// Checks every JSON file in the project parses, and that the English and Spanish
// translation files have exactly the same keys.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const skip = new Set(["node_modules", "dist", ".git", "test-results", "playwright-report"]);
let failures = 0;
let count = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(json|webmanifest)$/.test(entry.name)) {
      count++;
      try {
        JSON.parse(fs.readFileSync(p, "utf8"));
      } catch (e) {
        failures++;
        console.error(`✗ ${path.relative(root, p)}: ${e.message}`);
      }
    }
  }
}
walk(root);

function keys(obj, prefix = "") {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k));
}
const en = JSON.parse(fs.readFileSync(path.join(root, "src/locales/en.json"), "utf8"));
const es = JSON.parse(fs.readFileSync(path.join(root, "src/locales/es.json"), "utf8"));
const a = new Set(keys(en));
const b = new Set(keys(es));
const missing = [...a].filter((k) => !b.has(k));
const extra = [...b].filter((k) => !a.has(k));
if (missing.length || extra.length) {
  failures++;
  console.error("✗ Translation keys differ.", { missingInSpanish: missing, onlyInSpanish: extra });
}
if (failures) process.exit(1);
console.log(`✓ ${count} JSON files are valid; English and Spanish translations have the same ${a.size} keys.`);
