import { describe, expect, it } from 'vitest';
import { readRepoFile } from './helpers.js';

function loadProductMd() {
  return readRepoFile('PRODUCT.md');
}

describe('PRODUCT.md', () => {
  it('starts with the top-level Product heading', () => {
    const content = loadProductMd();
    expect(content.startsWith('# Product\n')).toBe(true);
  });

  it('has no YAML frontmatter block (plain markdown document)', () => {
    const content = loadProductMd();
    expect(content.trimStart().startsWith('---')).toBe(false);
  });

  it('declares its register as "product"', () => {
    const content = loadProductMd();
    const registerSection = content.match(/## Register\n\n(\w+)/);
    expect(registerSection).not.toBeNull();
    expect(registerSection[1]).toBe('product');
  });

  it('contains every required section, in order', () => {
    const content = loadProductMd();
    const headings = [...content.matchAll(/^## .+$/gm)].map((m) => m[0]);
    expect(headings).toEqual([
      '## Register',
      '## Users',
      '## Product Purpose',
      '## Brand Personality',
      '## Anti-references',
      '## Design Principles',
      '## Accessibility & Inclusion',
    ]);
  });

  it('gives every section non-empty body content', () => {
    const content = loadProductMd();
    const sections = content.split(/^## .+$/gm).slice(1);
    for (const section of sections) {
      expect(section.trim().length).toBeGreaterThan(0);
    }
  });

  it('lists at least three design principles as bullet points', () => {
    const content = loadProductMd();
    const principlesSection = content.match(/## Design Principles\n([\s\S]*?)(?=\n## |$)/)?.[1] ?? '';
    const bullets = principlesSection.match(/^- /gm) ?? [];
    expect(bullets.length).toBeGreaterThanOrEqual(3);
  });

  it('states a brand personality consistent with the "professional, secure" product register', () => {
    const content = loadProductMd();
    const personalitySection = content.match(/## Brand Personality\n([\s\S]*?)(?=\n## |$)/)?.[1] ?? '';
    expect(personalitySection.toLowerCase()).toContain('professional');
    expect(personalitySection.toLowerCase()).toContain('secure');
  });
});