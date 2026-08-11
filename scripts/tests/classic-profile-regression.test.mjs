import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { parseClassicSections } from '../lib/classic-section-parser.mjs';
import { profileForClassic } from '../lib/classic-section-profiles.mjs';

const root = process.env.CLASSICS_ROOT || '/Users/yvoche/AI开发/000.非洲最终正文/0.2英文经典手机版';
const expected = new Map([
  ['Beowulf', 43],
  ['Crime and Punishment', 41],
  ['David Copperfield', 64],
  ['Don Quixote', 126],
  ['Dracula', 27],
  ["Grimms' Fairy Tales", 63],
  ["Gulliver's Travels", 39],
  ['Heart of Darkness', 3],
  ['Leviathan', 48],
  ['Les Misérables', 365],
  ['Little Women', 47],
  ['Metamorphosis', 3],
  ['Middlemarch', 88],
  ['Moby-Dick', 136],
  ['Northanger Abbey', 31],
  ["Tess of the d'Urbervilles", 59],
  ['The Awakening', 47],
  ['The Blue Fairy Book', 37],
  ['The Count of Monte Cristo', 117],
  ['The Great Gatsby', 9],
  ['The House of the Seven Gables', 21],
  ['The Iliad', 24],
  ['The Jungle Book', 7],
  ['The King in Yellow', 10],
  ['The Moonstone', 60],
  ['The Phantom of the Opera', 28],
  ['The Picture of Dorian Gray', 20],
  ['The Red Fairy Book', 37],
  ['The Republic', 20],
  ['The Turn of the Screw', 24],
  ['The War of the Worlds', 27],
  ['The Woman in White', 62],
  ['The Works of Edgar Allan Poe - Volume 1', 12],
  ['The Works of Edgar Allan Poe - Volume 2', 22],
  ['The Yellow Fairy Book', 48],
  ['Thus Spake Zarathustra', 81],
  ['Treasure Island', 34],
  ['Siddhartha', 12],
  ['Oliver Twist', 53],
]);

test('SHA-locked classic profiles retain their reviewed chapter structures', { skip: !existsSync(root) }, async () => {
  for (const [title, chapterCount] of expected) {
    const source = await readFile(`${root}/mobile_${title}/mobile_${title}_full_story.md`, 'utf8');
    const profile = profileForClassic(title, source);
    assert.ok(profile, `${title}: missing SHA-locked section profile`);
    assert.match(profile.sourceSha256, /^[a-f0-9]{64}$/, `${title}: invalid source SHA-256`);
    const result = parseClassicSections(source, { profile });
    assert.equal(result.chapters.length, chapterCount, title);
    assert.equal(result.integrity.verified, true, title);
    assert.equal(result.integrity.coverageRatio, 1, title);
    assert.equal(result.integrity.suspiciousShortChapterCount, 0, title);
    assert.equal(result.audit.anomalies.contentsOnly.length, 0, title);
    assert.equal(result.integrity.maxChapterWordCount <= 50_000, true, title);
  }
});
