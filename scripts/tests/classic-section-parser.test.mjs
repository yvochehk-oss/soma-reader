import assert from 'node:assert/strict';
import test from 'node:test';

import {
  assertClassicSectionIntegrity,
  parseClassicSections,
} from '../lib/classic-section-parser.mjs';

function prose(label, count = 80) {
  return Array.from({ length: count }, (_, index) => `${label}-${index + 1}`).join(' ');
}

test('Ulysses-style inline contents and standalone episode markers produce real episodes without payload loss', () => {
  const contents = Array.from({ length: 18 }, (_, index) => `[ ${index + 1} ]`).join(' ');
  const body = Array.from({ length: 18 }, (_, index) => {
    const part = index === 0 ? '— I —\n\n' : index === 3 ? '— II —\n\n' : index === 15 ? '— III —\n\n' : '';
    return `${part}[ ${index + 1} ]\n\n${prose(`episode-${index + 1}`)}`;
  }).join('\n\n');
  const source = `# Ulysses\n\nby An Author\n\n## Contents\n\n## — I —\n\n[ 1 ] [ 2 ] [ 3 ]\n\n## — II —\n\n[ 4 ] [ 5 ] [ 6 ] [ 7 ] [ 8 ] [ 9 ] [ 10 ] [ 11 ] [ 12 ] [ 13 ] [ 14 ] [ 15 ]\n\n## — III —\n\n[ 16 ] [ 17 ] [ 18 ]\n\n${body}`;
  const result = assertClassicSectionIntegrity(parseClassicSections(source, { expectedChapterCount: 18 }));

  assert.equal(result.chapters.length, 18);
  assert.deepEqual(result.chapters.map((chapter) => chapter.title), Array.from({ length: 18 }, (_, index) => `[ ${index + 1} ]`));
  assert.equal(result.chapters[0].frontMatterPrefixChars > 0, true);
  assert.equal(result.audit.coverage.ratio, 1);
  assert.equal(result.audit.expectedChapterDelta, 0);
  assert.equal(result.audit.anomalies.contentsOnly.length, 0);
  assert.match(result.chapters.at(-1).content, /episode-18-80/);
});

test('short plain-text headings repeated in collapsed contents are detected generically', () => {
  const source = `# A Woodland Book\n\n## Contents\n\nEconomy Where I Lived Reading Sounds\n\n## A Woodland Book\n\nEconomy\n\n${prose('economy')}\n\nWhere I Lived\n\n${prose('home')}\n\nReading\n\n${prose('reading')}\n\nSounds\n\n${prose('sounds')}`;
  const result = assertClassicSectionIntegrity(parseClassicSections(source));

  assert.deepEqual(result.chapters.map((chapter) => chapter.title), ['Economy', 'Where I Lived', 'Reading', 'Sounds']);
  assert.equal(result.audit.coverage.ok, true);
});

test('plain Roman-numbered chapter titles are boundaries while part and contents text remain preserved', () => {
  const source = `# An Island Book\n\n## CONTENTS\n\nPART ONE The Beginning\n\nI. THE FIRST DAY . . . 1 II. THE SECOND DAY . . . 9\n\n## AN ISLAND BOOK\n\nPART ONE--The Beginning\n\nI The First Day\n\n${prose('first')}\n\nII The Second Day\n\n${prose('second')}`;
  const result = assertClassicSectionIntegrity(parseClassicSections(source));

  assert.deepEqual(result.chapters.map((chapter) => chapter.title), ['I The First Day', 'II The Second Day']);
  assert.match(result.chapters[0].content, /## CONTENTS/);
  assert.match(result.chapters[0].content, /PART ONE--The Beginning/);
  assert.equal(result.audit.coverage.ratio, 1);
});

test('metadata can be emitted as a separate front-matter chapter without changing canonical payload', () => {
  const source = `# A Book\n\n## Dedication\n\nFor the reader.\n\n## CHAPTER I. Arrival\n\n${prose('arrival')}\n\n## CHAPTER II. Return\n\n${prose('return')}`;
  const result = assertClassicSectionIntegrity(parseClassicSections(source, { frontMatterMode: 'chapter' }));

  assert.equal(result.chapters[0].title, 'Front Matter');
  assert.match(result.chapters[0].content, /Dedication/);
  assert.deepEqual(result.chapters.slice(1).map((chapter) => chapter.title), ['CHAPTER I. Arrival', 'CHAPTER II. Return']);
  assert.equal(result.audit.coverage.sourceSha256, result.audit.coverage.chapterSha256);
});

test('a data-driven profile can declare an otherwise ambiguous plain heading', () => {
  const source = `A Book\n\nOpening Movement\n\n${prose('opening')}\n\nClosing Movement\n\n${prose('closing')}`;
  const result = assertClassicSectionIntegrity(parseClassicSections(source, {
    profile: { plainTextHeadings: ['Opening Movement', 'Closing Movement'] },
  }));

  assert.deepEqual(result.chapters.map((chapter) => chapter.title), ['Opening Movement', 'Closing Movement']);
  assert.equal(result.audit.coverage.ok, true);
});

test('anomaly audit reports implausibly short, contents-only and oversized chapters', () => {
  const source = `# Book\n\n## CHAPTER I\n\n1 2 3 4 5 6\n\n## CHAPTER II\n\n${prose('huge', 80)}`;
  const result = parseClassicSections(source, { minimumChapterWords: 1, bodyStartWords: 1, longChapterWords: 50 });

  assert.equal(result.audit.anomalies.short.some((item) => item.title === 'CHAPTER I'), true);
  assert.equal(result.audit.anomalies.contentsOnly.some((item) => item.title === 'CHAPTER I'), true);
  assert.equal(result.audit.anomalies.long.some((item) => item.title === 'CHAPTER II'), true);
  assert.equal(result.audit.coverage.ok, true);
});

test('pivotal Markdown dialogue is preserved inside a structural chapter, never promoted to a chapter', () => {
  const source = `# Book\n\n## CHAPTER I. Arrival\n\n${prose('arrival')}\n\n## “No!”\n\n${prose('aftermath')}\n\n## CHAPTER II. Return\n\n${prose('return')}`;
  const result = assertClassicSectionIntegrity(parseClassicSections(source));

  assert.deepEqual(result.chapters.map((chapter) => chapter.title), ['CHAPTER I. Arrival', 'CHAPTER II. Return']);
  assert.match(result.chapters[0].content, /## “No!”/);
  assert.equal(result.integrity.verified, true);
  assert.equal(result.integrity.sourceCanonicalSha256, result.integrity.reconstructedCanonicalSha256);
  assert.equal(result.integrity.sourceWordCount, result.integrity.reconstructedWordCount);
  assert.equal(result.integrity.coverageRatio, 1);
  assert.equal(result.integrity.suspiciousShortChapterCount, 0);
});

test('an exclusive data profile can constrain heading level and rename display titles without rewriting source', () => {
  const source = `# Dialogues\n\nBOOK I. Analysis prose\n\n${prose('analysis')}\n\n## BOOK I.\n\n${prose('book')}\n\n## “Yes.”\n\n${prose('continued')}`;
  const result = parseClassicSections(source, {
    profile: {
      exclusiveBoundaries: true,
      boundaryPatterns: [/^BOOK I\./],
      displayTitle: (candidate) => candidate.level === undefined ? 'Analysis — Book I' : candidate.title,
    },
  });

  assert.deepEqual(result.chapters.map((chapter) => chapter.title), ['Analysis — Book I', 'BOOK I.']);
  assert.match(result.chapters[1].content, /## “Yes.”/);
  assert.equal(result.audit.coverage.ok, true);
});

test('a SHA-specific profile can filter duplicate contents candidates by source position', () => {
  const source = `# Stories\n\n## CONTENTS\n\n## FIRST STORY\n\n## LAST STORY\n\n${prose('contents-tail')}\n\n## FIRST STORY\n\n${prose('first')}\n\n## LAST STORY\n\n${prose('last')}`;
  const result = parseClassicSections(source, {
    profile: {
      exclusiveBoundaries: true,
      boundaryLevels: [2],
      boundaryPatterns: [/^(?:FIRST|LAST) STORY$/],
      boundaryFilter(candidate, { source: manuscript }) {
        return candidate.start >= manuscript.lastIndexOf('\n## FIRST STORY\n');
      },
    },
  });

  assert.deepEqual(result.chapters.map((chapter) => chapter.title), ['FIRST STORY', 'LAST STORY']);
  assert.equal(result.integrity.verified, true);
  assert.equal(result.audit.coverage.ratio, 1);
});
