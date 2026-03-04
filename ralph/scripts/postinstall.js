#!/usr/bin/env node

import { existsSync, mkdirSync, symlinkSync, lstatSync, unlinkSync, readFileSync, writeFileSync } from "fs";
import { join, relative, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RALPH_DIR = join(__dirname, "..");
const PROJECT_DIR = process.env.INIT_CWD || process.cwd();
const SKILL_DIR = join(PROJECT_DIR, ".claude", "skills");
const SKILL_DEST = join(SKILL_DIR, "ralph");
const GITIGNORE = join(PROJECT_DIR, ".gitignore");

// Symlink skill
mkdirSync(SKILL_DIR, { recursive: true });

try {
  const stat = lstatSync(SKILL_DEST);
  if (stat.isSymbolicLink() && !existsSync(SKILL_DEST)) {
    unlinkSync(SKILL_DEST);
  } else {
    process.exit(0); // already exists, nothing to do
  }
} catch {}

symlinkSync(relative(SKILL_DIR, RALPH_DIR), SKILL_DEST);

// Add .ralph/ to .gitignore
let content = existsSync(GITIGNORE) ? readFileSync(GITIGNORE, "utf-8") : "";
if (!content.includes(".ralph/")) {
  writeFileSync(GITIGNORE, content.trimEnd() + "\n.ralph/\n");
}
