import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readRepoFile, repoPath } from './helpers.js';

function loadLiveConfig() {
  return JSON.parse(readRepoFile('.impeccable/live/config.json'));
}

describe('.impeccable/live/config.json', () => {
  it('is valid, parseable JSON', () => {
    expect(() => loadLiveConfig()).not.toThrow();
  });

  it('targets the web app entry HTML file', () => {
    const config = loadLiveConfig();
    expect(Array.isArray(config.files)).toBe(true);
    expect(config.files).toEqual(['apps/web/index.html']);
  });

  it('only lists files that actually exist in the repository', () => {
    const config = loadLiveConfig();
    for (const relativeFile of config.files) {
      expect(existsSync(repoPath(relativeFile))).toBe(true);
    }
  });

  it('only lists .html targets', () => {
    const config = loadLiveConfig();
    for (const relativeFile of config.files) {
      expect(relativeFile.endsWith('.html')).toBe(true);
    }
  });

  it('inserts the live overlay snippet just before the closing body tag', () => {
    const config = loadLiveConfig();
    expect(config.insertBefore).toBe('</body>');
  });

  it('uses html comment syntax', () => {
    const config = loadLiveConfig();
    expect(config.commentSyntax).toBe('html');
  });

  it('marks CSP as checked with a boolean flag', () => {
    const config = loadLiveConfig();
    expect(config.cspChecked).toBe(true);
    expect(typeof config.cspChecked).toBe('boolean');
  });

  it('does not contain unexpected top-level keys', () => {
    const config = loadLiveConfig();
    expect(Object.keys(config).sort()).toEqual(
      ['commentSyntax', 'cspChecked', 'files', 'insertBefore'].sort(),
    );
  });
});