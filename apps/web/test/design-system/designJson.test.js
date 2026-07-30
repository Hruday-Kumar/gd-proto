import { describe, expect, it } from 'vitest';
import { readRepoFile } from './helpers.js';

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function loadDesignJson() {
  return JSON.parse(readRepoFile('.impeccable/design.json'));
}

describe('.impeccable/design.json', () => {
  it('is valid, parseable JSON', () => {
    expect(() => loadDesignJson()).not.toThrow();
  });

  it('declares the expected schema version and title', () => {
    const design = loadDesignJson();
    expect(design.schemaVersion).toBe(2);
    expect(design.title).toBe('Design System: gd-proto');
  });

  it('has a generatedAt timestamp that parses as a valid date', () => {
    const design = loadDesignJson();
    expect(typeof design.generatedAt).toBe('string');
    expect(Number.isNaN(Date.parse(design.generatedAt))).toBe(false);
  });

  describe('extensions.colorMeta', () => {
    it('defines the core palette roles with canonical hex values', () => {
      const { colorMeta } = loadDesignJson().extensions;
      const expected = {
        primary: '#2563eb',
        secondary: '#64748b',
        tertiary: '#b45309',
        background: '#f8fafc',
        'text-primary': '#0f172a',
      };
      for (const [token, canonical] of Object.entries(expected)) {
        expect(colorMeta).toHaveProperty(token);
        expect(colorMeta[token].canonical).toBe(canonical);
        expect(colorMeta[token].canonical).toMatch(HEX_COLOR);
        expect(typeof colorMeta[token].role).toBe('string');
        expect(typeof colorMeta[token].displayName).toBe('string');
        expect(colorMeta[token].displayName.length).toBeGreaterThan(0);
      }
    });

    it('only exposes valid 6-digit hex canonical colors', () => {
      const { colorMeta } = loadDesignJson().extensions;
      for (const meta of Object.values(colorMeta)) {
        expect(meta.canonical).toMatch(HEX_COLOR);
      }
    });
  });

  describe('extensions.typographyMeta', () => {
    it('documents the referenced typography steps with a displayName and purpose', () => {
      const { typographyMeta } = loadDesignJson().extensions;
      for (const key of ['headline-xl', 'body-md', 'label-md']) {
        expect(typographyMeta).toHaveProperty(key);
        expect(typeof typographyMeta[key].displayName).toBe('string');
        expect(typeof typographyMeta[key].purpose).toBe('string');
        expect(typographyMeta[key].purpose.length).toBeGreaterThan(0);
      }
    });
  });

  describe('extensions.shadows', () => {
    it('is a non-empty array of named shadow definitions', () => {
      const { shadows } = loadDesignJson().extensions;
      expect(Array.isArray(shadows)).toBe(true);
      expect(shadows.length).toBeGreaterThan(0);
      for (const shadow of shadows) {
        expect(typeof shadow.name).toBe('string');
        expect(typeof shadow.value).toBe('string');
        expect(typeof shadow.purpose).toBe('string');
      }
    });

    it('includes the shadow-sm token used by component CSS', () => {
      const { shadows } = loadDesignJson().extensions;
      const shadowSm = shadows.find((s) => s.name === 'shadow-sm');
      expect(shadowSm).toBeDefined();
      expect(shadowSm.value).toBe('0 1px 2px 0 rgba(0, 0, 0, 0.05)');
    });
  });

  describe('components', () => {
    it('lists the three documented reference components with required fields', () => {
      const { components } = loadDesignJson();
      expect(Array.isArray(components)).toBe(true);
      expect(components).toHaveLength(3);
      for (const component of components) {
        expect(typeof component.name).toBe('string');
        expect(typeof component.kind).toBe('string');
        expect(typeof component.refersTo).toBe('string');
        expect(typeof component.description).toBe('string');
        expect(typeof component.html).toBe('string');
        expect(typeof component.css).toBe('string');
      }
    });

    it('maps each component to the correct DESIGN.md component token', () => {
      const { components } = loadDesignJson();
      const byName = Object.fromEntries(components.map((c) => [c.name, c]));
      expect(byName['Primary Button'].refersTo).toBe('button-primary');
      expect(byName['Container Card'].refersTo).toBe('card-container');
      expect(byName['Status Pill'].refersTo).toBe('pill-status');
    });

    it('renders the Primary Button sample markup using the documented class name', () => {
      const { components } = loadDesignJson();
      const primaryButton = components.find((c) => c.name === 'Primary Button');
      expect(primaryButton.html).toContain('ds-btn-primary');
      expect(primaryButton.css).toContain('.ds-btn-primary');
    });

    it('has no duplicate component names or refersTo tokens', () => {
      const { components } = loadDesignJson();
      const names = components.map((c) => c.name);
      const refs = components.map((c) => c.refersTo);
      expect(new Set(names).size).toBe(names.length);
      expect(new Set(refs).size).toBe(refs.length);
    });
  });

  describe('narrative', () => {
    it('states the creative north star and a non-empty overview', () => {
      const { narrative } = loadDesignJson();
      expect(narrative.northStar).toBe('The Modern Atheneum');
      expect(typeof narrative.overview).toBe('string');
      expect(narrative.overview.length).toBeGreaterThan(0);
    });

    it('lists key characteristics as a non-empty array of strings', () => {
      const { narrative } = loadDesignJson();
      expect(Array.isArray(narrative.keyCharacteristics)).toBe(true);
      expect(narrative.keyCharacteristics.length).toBeGreaterThan(0);
      for (const item of narrative.keyCharacteristics) {
        expect(typeof item).toBe('string');
      }
    });

    it('defines named rules with a name, body, and valid section', () => {
      const { narrative } = loadDesignJson();
      const validSections = ['colors', 'typography', 'elevation'];
      expect(Array.isArray(narrative.rules)).toBe(true);
      expect(narrative.rules.length).toBeGreaterThan(0);
      for (const rule of narrative.rules) {
        expect(typeof rule.name).toBe('string');
        expect(typeof rule.body).toBe('string');
        expect(validSections).toContain(rule.section);
      }
    });

    it('includes the three named rules referenced in DESIGN.md', () => {
      const { narrative } = loadDesignJson();
      const ruleNames = narrative.rules.map((r) => r.name);
      expect(ruleNames).toEqual(
        expect.arrayContaining([
          'The Crisp Anchor Rule',
          'The Structural Scale Rule',
          'The Ambient Depth Rule',
        ]),
      );
    });

    it('provides non-empty dos and donts lists', () => {
      const { narrative } = loadDesignJson();
      expect(Array.isArray(narrative.dos)).toBe(true);
      expect(Array.isArray(narrative.donts)).toBe(true);
      expect(narrative.dos.length).toBeGreaterThan(0);
      expect(narrative.donts.length).toBeGreaterThan(0);
      for (const item of [...narrative.dos, ...narrative.donts]) {
        expect(typeof item).toBe('string');
        expect(item.length).toBeGreaterThan(0);
      }
    });
  });
});