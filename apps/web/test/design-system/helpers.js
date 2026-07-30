// Shared helpers for reading repository-root design-system artifacts
// (.impeccable/*, DESIGN.md, PRODUCT.md) from tests that live inside the
// `apps/web` workspace's vitest project.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

// apps/web/test/design-system -> repo root is four levels up.
export const REPO_ROOT = path.resolve(here, '../../../..');

export function repoPath(relativePath) {
  return path.join(REPO_ROOT, relativePath);
}

export function readRepoFile(relativePath) {
  return readFileSync(repoPath(relativePath), 'utf8');
}

// Splits a leading `---\n...\n---` YAML frontmatter block from the rest of
// a markdown document's body. Only supports flat `key: value` pairs, which
// is sufficient for the critique report frontmatter used in this project.
export function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) {
    return { data: null, body: content, raw: null };
  }
  const raw = match[1];
  const body = content.slice(match[0].length);
  const data = {};
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if (/^".*"$/.test(value)) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  return { data, body, raw };
}