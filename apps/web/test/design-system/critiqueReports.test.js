import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseFrontmatter, readRepoFile, repoPath } from './helpers.js';

const CRITIQUE_DIR = '.impeccable/critique';
const REQUIRED_SECTIONS = [
  '#### Design Health Score',
  '#### Anti-Patterns Verdict',
  '#### Overall Impression',
  "#### What's Working",
  '#### Priority Issues',
  '#### Persona Red Flags',
];

function listCritiqueFiles() {
  return readdirSync(repoPath(CRITIQUE_DIR))
    .filter((f) => f.endsWith('.md'))
    .sort();
}

function loadCritique(filename) {
  const content = readRepoFile(`${CRITIQUE_DIR}/${filename}`);
  return { filename, content, ...parseFrontmatter(content) };
}

function extractHeuristicScores(body) {
  return [...body.matchAll(/^\|\s*(\d+)\s*\|[^|]*\|\s*(\d+)\s*\|/gm)].map((m) => Number(m[2]));
}

function countPriorityTag(body, tag) {
  const prioritySection = body.match(/#### Priority Issues\n([\s\S]*?)(?=\n#### |$)/)?.[1] ?? '';
  return (prioritySection.match(new RegExp(`\\*\\*\\[${tag}\\]`, 'g')) ?? []).length;
}

describe('.impeccable/critique reports', () => {
  it('contains the two committed critique reports for this PR', () => {
    expect(listCritiqueFiles()).toEqual([
      '2026-07-30T16-45-34Z__src-pages-lobbypage-jsx.md',
      '2026-07-30T17-08-16Z__apps-web-src.md',
    ]);
  });

  describe.each(listCritiqueFiles())('%s', (filename) => {
    it('has frontmatter with all required metadata fields', () => {
      const { data } = loadCritique(filename);
      expect(data).not.toBeNull();
      for (const key of ['target', 'total_score', 'p0_count', 'p1_count', 'timestamp', 'slug']) {
        expect(data).toHaveProperty(key);
      }
    });

    it('encodes numeric counters as parseable, non-negative integers', () => {
      const { data } = loadCritique(filename);
      for (const key of ['total_score', 'p0_count', 'p1_count']) {
        const value = Number(data[key]);
        expect(Number.isInteger(value)).toBe(true);
        expect(value).toBeGreaterThanOrEqual(0);
      }
      expect(Number(data.total_score)).toBeLessThanOrEqual(40);
    });

    it('has a timestamp matching the filesystem-safe ISO format', () => {
      const { data } = loadCritique(filename);
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/);
    });

    it('has a slug and timestamp that match the filename convention', () => {
      const { data } = loadCritique(filename);
      expect(filename).toBe(`${data.timestamp}__${data.slug}.md`);
    });

    it('has a non-empty target', () => {
      const { data } = loadCritique(filename);
      expect(typeof data.target).toBe('string');
      expect(data.target.length).toBeGreaterThan(0);
    });

    it('includes every required report section', () => {
      const { body } = loadCritique(filename);
      for (const section of REQUIRED_SECTIONS) {
        expect(body).toContain(section);
      }
    });

    it('has exactly 10 scored heuristics between 0 and 4', () => {
      const { body } = loadCritique(filename);
      const scores = extractHeuristicScores(body);
      expect(scores).toHaveLength(10);
      for (const score of scores) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(4);
      }
    });

    it('sums the individual heuristic scores to the frontmatter total_score', () => {
      const { data, body } = loadCritique(filename);
      const scores = extractHeuristicScores(body);
      const sum = scores.reduce((a, b) => a + b, 0);
      expect(sum).toBe(Number(data.total_score));
    });

    it('reports a p0_count matching the number of [P0] issues listed', () => {
      const { data, body } = loadCritique(filename);
      expect(countPriorityTag(body, 'P0')).toBe(Number(data.p0_count));
    });

    it('reports a p1_count matching the number of [P1] issues listed', () => {
      const { data, body } = loadCritique(filename);
      expect(countPriorityTag(body, 'P1')).toBe(Number(data.p1_count));
    });
  });

  describe('src-pages-lobbypage-jsx report', () => {
    const filename = '2026-07-30T16-45-34Z__src-pages-lobbypage-jsx.md';

    it('targets the LobbyPage component with no P0 issues', () => {
      const { data } = loadCritique(filename);
      expect(data.target).toBe('src/pages/LobbyPage.jsx');
      expect(data.p0_count).toBe('0');
      expect(data.p1_count).toBe('1');
      expect(data.total_score).toBe('25');
    });

    it('flags the missing "Leave Room" escape hatch as the sole P1 issue', () => {
      const { body } = loadCritique(filename);
      expect(body).toContain('Missing "Leave" Escape Hatch');
      expect(body).toContain('Leave Room');
    });
  });

  describe('apps-web-src report', () => {
    const filename = '2026-07-30T17-08-16Z__apps-web-src.md';

    it('targets the full apps/web/src flow with one P0 and two P1 issues', () => {
      const { data } = loadCritique(filename);
      expect(data.target).toContain('apps/web/src');
      expect(data.p0_count).toBe('1');
      expect(data.p1_count).toBe('2');
      expect(data.total_score).toBe('24');
    });

    it('flags the sidebar navigation live-session hazard as the P0 issue', () => {
      const { body } = loadCritique(filename);
      expect(body).toContain('[P0] Sidebar navigation can silently kill a live session');
    });

    it('includes persona red flags for Jordan, Sam, and Alex', () => {
      const { body } = loadCritique(filename);
      expect(body).toContain('**Jordan (First-Timer)**');
      expect(body).toContain('**Sam (Accessibility-Dependent)**');
      expect(body).toContain('**Alex (Power User)**');
    });
  });
});