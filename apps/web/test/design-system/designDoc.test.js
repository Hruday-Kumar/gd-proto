import { describe, expect, it } from 'vitest';
import { parseFrontmatter, readRepoFile } from './helpers.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const REM_SIZE = /^\d+(\.\d+)?rem$/;

function loadDesignMd() {
  const content = readRepoFile('DESIGN.md');
  return { content, ...parseFrontmatter(content) };
}

describe('DESIGN.md', () => {
  it('starts with a YAML frontmatter block', () => {
    const { raw } = loadDesignMd();
    expect(raw).not.toBeNull();
  });

  it('declares the design system name and description in the frontmatter', () => {
    const { raw } = loadDesignMd();
    expect(raw).toMatch(/^name:\s*gd-proto\s*$/m);
    expect(raw).toMatch(/^description:\s*.+\S.*$/m);
  });

  it('lists every color token as a valid 6-digit hex value in the frontmatter', () => {
    const { raw } = loadDesignMd();
    const colorsSection = raw.match(/^colors:\n([\s\S]*?)(?=^\S)/m)?.[1];
    expect(colorsSection).toBeTruthy();

    const tokenLines = colorsSection
      .split('\n')
      .filter((line) => line.trim().length > 0);
    expect(tokenLines.length).toBeGreaterThan(0);

    for (const line of tokenLines) {
      const match = line.match(/^\s{2}[\w-]+:\s*"(.+)"\s*$/);
      expect(match, `unexpected color line format: ${line}`).not.toBeNull();
      expect(match[1]).toMatch(HEX_COLOR);
    }
  });

  it('includes the primary, secondary, and tertiary brand colors from design.json', () => {
    const { raw } = loadDesignMd();
    expect(raw).toMatch(/primary:\s*"#2563eb"/);
    expect(raw).toMatch(/secondary:\s*"#64748b"/);
    expect(raw).toMatch(/tertiary:\s*"#b45309"/);
  });

  it('defines every typography step with an Inter font family and rem-based font size', () => {
    const { raw } = loadDesignMd();
    const typographySection = raw.match(/^typography:\n([\s\S]*?)(?=^rounded:)/m)?.[1];
    expect(typographySection).toBeTruthy();

    const fontSizes = [...typographySection.matchAll(/fontSize:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(fontSizes.length).toBeGreaterThan(0);
    for (const size of fontSizes) {
      expect(size).toMatch(REM_SIZE);
    }

    const fontFamilies = [...typographySection.matchAll(/fontFamily:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(fontFamilies.length).toBe(fontSizes.length);
    for (const family of fontFamilies) {
      expect(family).toContain('Inter');
    }
  });

  it('references only defined color and rounded tokens from component definitions', () => {
    const { raw } = loadDesignMd();
    const tokenRefs = [...raw.matchAll(/\{(colors|rounded)\.([\w.-]+)\}/g)];
    expect(tokenRefs.length).toBeGreaterThan(0);

    for (const [, category, token] of tokenRefs) {
      const sectionMatch = raw.match(
        category === 'colors' ? /^colors:\n([\s\S]*?)(?=^typography:)/m : /^rounded:\n([\s\S]*?)(?=^spacing:)/m,
      );
      expect(sectionMatch, `missing ${category} section`).not.toBeNull();
      const tokenPattern = new RegExp(`^\\s{2}${token}:`, 'm');
      expect(sectionMatch[1], `token ${category}.${token} not defined`).toMatch(tokenPattern);
    }
  });

  it('defines the three documented component tokens in the frontmatter', () => {
    const { raw } = loadDesignMd();
    expect(raw).toMatch(/^\s{2}button-primary:/m);
    expect(raw).toMatch(/^\s{2}card-container:/m);
    expect(raw).toMatch(/^\s{2}pill-status:/m);
  });

  it('contains the markdown body sections in order', () => {
    const { body } = loadDesignMd();
    const headings = [...body.matchAll(/^## \d\. .+$/gm)].map((m) => m[0]);
    expect(headings).toEqual([
      '## 1. Overview',
      '## 2. Colors',
      '## 3. Typography',
      '## 4. Elevation',
      '## 5. Components',
      "## 6. Do's and Don'ts",
    ]);
  });

  it('names the creative north star in the overview', () => {
    const { body } = loadDesignMd();
    expect(body).toContain('The Modern Atheneum');
  });

  it('documents all three named rules referenced by design.json', () => {
    const { body } = loadDesignMd();
    expect(body).toContain('The Crisp Anchor Rule');
    expect(body).toContain('The Structural Scale Rule');
    expect(body).toContain('The Ambient Depth Rule');
  });

  it('lists at least three dos and three donts', () => {
    const { body } = loadDesignMd();
    const doSection = body.match(/### Do:\n([\s\S]*?)(?=### Don't:)/)?.[1] ?? '';
    const dontSection = body.match(/### Don't:\n([\s\S]*)$/)?.[1] ?? '';

    const doItems = doSection.match(/^- /gm) ?? [];
    const dontItems = dontSection.match(/^- /gm) ?? [];

    expect(doItems.length).toBeGreaterThanOrEqual(3);
    expect(dontItems.length).toBeGreaterThanOrEqual(3);
  });
});