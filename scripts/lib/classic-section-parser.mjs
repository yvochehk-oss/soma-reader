import { createHash } from 'node:crypto';

const DEFAULT_MIN_CHAPTER_WORDS = 6;
const DEFAULT_BODY_START_WORDS = 50;
const DEFAULT_LONG_CHAPTER_WORDS = 50_000;

const METADATA_HEADING = /^(?:contents?|table of contents|preface|foreword|introduction|dedication|acknowledg(?:e)?ments?|transcriber(?:'s|’s)? notes?|preparer(?:'s|’s)? notes?|ebook editor(?:'s|’s)? notes?|bibliography|glossary|illustrations?|abbreviations?(?: used in the notes)?|list of words and phrases not in general use|the raven edition|title page)$/i;
const NUMBER_WORD = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)';
const STRUCTURAL_HEADING = new RegExp(`^(?:chapter|book|part|stave|canto|act|scene|letter|section|volume)\\s+(?:the\\s+)?(?:\\d+|[ivxlcdm]+|${NUMBER_WORD})\\b`, 'i');
const BRACKET_NUMBER = /^\[\s*(\d{1,4})\s*\]$/;
const NUMBERED_TITLE = /^(?:[IVXLCDM]{1,12}[.)]?|\d{1,4}[.)])\s+\S.{1,119}$/i;
const TERMINAL_CONTAINER_HEADING = /^(?:appendix|endnotes?)\.?$/i;

function recordsFor(source) {
  const records = [];
  let start = 0;
  while (start < source.length) {
    const newline = source.indexOf('\n', start);
    const end = newline < 0 ? source.length : newline;
    records.push({ start, end, next: newline < 0 ? source.length : newline + 1, text: source.slice(start, end) });
    if (newline < 0) break;
    start = newline + 1;
  }
  if (!records.length) records.push({ start: 0, end: 0, next: 0, text: '' });
  return records;
}

function words(value) {
  return value.trim().split(/\s+/u).filter(Boolean);
}

function wordCount(value) {
  return words(value).length;
}

function payload(value) {
  return value.replace(/\s/gu, '');
}

function cleanHeading(value) {
  return value
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^[_*]+|[_*]+$/g, '')
    .replace(/^(chapter\s+[ivxlcdm]+\.)\]$/i, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function normalizedHeading(value) {
  return cleanHeading(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function looksTitleLike(value) {
  const tokens = words(value.replace(/^[_*]+|[_*]+$/g, ''));
  if (!tokens.length || tokens.length > 14 || value.length > 120) return false;
  if (/[.!?][”’"']?$/.test(value) && tokens.length > 5) return false;
  let titleTokens = 0;
  for (const token of tokens) {
    const bare = token.replace(/^[^A-Za-z]+|[^A-Za-z]+$/g, '');
    if (!bare) continue;
    if (/^[A-Z][A-Za-z’'-]*$/.test(bare) || /^[A-Z]{2,}$/.test(bare) || /^(?:a|an|and|as|at|by|for|from|in|of|on|or|the|to|with)$/i.test(bare)) titleTokens += 1;
  }
  return titleTokens / tokens.length >= 0.7;
}

function metadataKind(value) {
  const heading = cleanHeading(value).replace(/[.:]+$/, '').trim();
  if (/^(?:contents?(?:\s+(?:of\s+the\s+chapters|volume\s+[ivxlcdm]+))?|table of contents)$/i.test(heading)) return 'contents';
  if (/^(?:preface|prefaratory|foreword|(?:the\s+)?introduction(?:\s+and\s+analysis)?|introductory note.*)$/i.test(heading)) return 'preface';
  if (/^dedication$/i.test(heading)) return 'dedication';
  if (METADATA_HEADING.test(heading)) return 'metadata';
  return null;
}

function structuralKey(value) {
  const heading = cleanHeading(value);
  const bracket = BRACKET_NUMBER.exec(heading);
  if (bracket) return `episode:${Number(bracket[1])}`;
  const structural = /^(chapter|book|part|stave|canto|act|scene|letter|section|volume)\s+(?:the\s+)?([A-Za-z0-9-]+)/i.exec(heading);
  if (structural) return `${structural[1].toLowerCase()}:${structural[2].toLowerCase()}`;
  return `title:${normalizedHeading(heading)}`;
}

function candidateFor(record, sourceBefore, repeatedHeadings, profileHeadings, profilePatterns) {
  const raw = record.text.trim();
  if (!raw) return null;
  const markdown = /^(#{1,6})\s+(.+?)\s*$/.exec(raw);
  const heading = cleanHeading(raw);
  if (profileHeadings.has(normalizedHeading(heading)) || profilePatterns.some((pattern) => pattern.test(heading))) {
    return { ...record, title: heading, level: markdown?.[1]?.length, candidateKind: 'profile', explicit: true, key: structuralKey(heading) };
  }
  const kind = metadataKind(heading);
  if (kind) return { ...record, title: heading, candidateKind: 'metadata', metadataKind: kind, explicit: false, key: `metadata:${normalizedHeading(heading)}` };
  if (/^#{1,2}\s+/.test(raw) && TERMINAL_CONTAINER_HEADING.test(heading)) return { ...record, title: heading, candidateKind: 'terminal-container', explicit: true, key: `terminal:${normalizedHeading(heading)}` };

  if (markdown) {
    if (STRUCTURAL_HEADING.test(heading)) return { ...record, title: heading, level: markdown[1].length, candidateKind: 'markdown-structural', explicit: true, key: structuralKey(heading) };
    if (BRACKET_NUMBER.test(heading)) return { ...record, title: heading, level: markdown[1].length, candidateKind: 'bracket-number', explicit: true, key: structuralKey(heading) };
    if (markdown[1].length <= 2 && NUMBERED_TITLE.test(heading) && looksTitleLike(heading)) return { ...record, title: heading, level: markdown[1].length, candidateKind: 'markdown-numbered-title', explicit: true, key: structuralKey(heading) };
    const normalized = normalizedHeading(heading);
    if (markdown[1].length <= 2 && repeatedHeadings.has(normalized)) return { ...record, title: heading, level: markdown[1].length, candidateKind: 'repeated-heading', explicit: true, key: `title:${normalized}` };
    if (markdown[1].length <= 2 && safeContentsMatch(heading, sourceBefore)) return { ...record, title: heading, level: markdown[1].length, candidateKind: 'contents-match', explicit: false, key: `title:${normalized}` };
    // Mobile formatting may promote pivotal dialogue or description to ##.
    // Markdown level alone is never sufficient evidence of a chapter boundary.
    return null;
  }

  if (BRACKET_NUMBER.test(heading)) {
    return { ...record, title: heading, candidateKind: 'bracket-number', explicit: true, key: structuralKey(heading) };
  }

  if (STRUCTURAL_HEADING.test(heading) && heading.length <= 180) {
    return { ...record, title: heading, candidateKind: 'plain-structural', explicit: true, key: structuralKey(heading) };
  }

  if (NUMBERED_TITLE.test(heading) && looksTitleLike(heading)) {
    return { ...record, title: heading, candidateKind: 'plain-numbered-title', explicit: true, key: structuralKey(heading) };
  }

  // Some public-domain files flatten real chapter headings to ordinary lines.
  // A short title-like line is accepted only when the same phrase appeared
  // earlier in a Contents block. This supports books such as Walden without
  // turning arbitrary short prose sentences into chapter boundaries.
  const normalized = normalizedHeading(heading);
  if (safeContentsMatch(heading, sourceBefore)) {
    return { ...record, title: heading, candidateKind: 'contents-match', explicit: false, key: `title:${normalized}` };
  }
  return null;
}

function safeContentsMatch(value, phrases) {
  const heading = cleanHeading(value);
  const normalized = normalizedHeading(heading);
  if (!normalized || !phrases.has(normalized) || !looksTitleLike(heading)) return false;
  if (/^[“”‘’"']|[!?][”’"']?$/.test(heading)) return false;
  const tokens = normalized.split(' ').filter(Boolean);
  if (tokens.length > 1) return true;
  return /^[A-Z][A-Za-z’'-]{4,}$/.test(heading)
    && !/^(?:about|after|again|before|chapter|contents|could|every|first|never|other|shall|there|these|those|through|under|where|which|while|would)$/i.test(heading);
}

function contentsPhrases(source, records) {
  const phrases = new Set();
  let contentsStart = -1;
  let contentsRecordIndex = -1;
  const documentTitle = records
    .map((record) => /^(#{1})\s+(.+?)\s*$/.exec(record.text.trim()))
    .find(Boolean)?.[2];
  for (const record of records) {
    if (metadataKind(record.text) === 'contents') {
      contentsStart = record.next;
      contentsRecordIndex = records.indexOf(record);
      break;
    }
  }
  if (contentsStart < 0) return { start: -1, bodyHintStart: -1, phrases };

  const normalizedDocumentTitle = normalizedHeading(documentTitle ?? '');
  const repeatedTitleRecords = normalizedDocumentTitle
    ? records.slice(contentsRecordIndex + 1).filter((record) => (
      /^#{1,6}\s+/.test(record.text.trim())
      && normalizedHeading(record.text) === normalizedDocumentTitle
    ))
    : [];
  const repeatedBodyTitle = repeatedTitleRecords.filter((record) => !/^[“”‘’"']/.test(cleanHeading(record.text))).at(-1);
  const firstFollowingMarkdown = records.slice(contentsRecordIndex + 1).find((record) => (
    /^#{1,6}\s+/.test(record.text.trim()) && !metadataKind(record.text)
  ));
  const probeEnd = repeatedBodyTitle?.start
    ?? firstFollowingMarkdown?.start
    ?? Math.min(source.length, contentsStart + 24_000);

  // A bounded probe prevents matches against arbitrary phrases much later in
  // the narrative while covering even unusually long Gutenberg contents.
  const probe = source.slice(contentsStart, Math.min(probeEnd, contentsStart + 24_000));
  const probeRecords = recordsFor(probe);
  for (const record of probeRecords) {
    const line = cleanHeading(record.text);
    const normalized = normalizedHeading(line);
    if (normalized) phrases.add(normalized);
    // Contents are often collapsed onto one line. Store every 1-12 word
    // sliding phrase so later standalone headings can be matched exactly.
    const tokens = normalized.split(' ').filter(Boolean);
    for (let size = 1; size <= Math.min(12, tokens.length); size += 1) {
      for (let index = 0; index + size <= tokens.length; index += 1) phrases.add(tokens.slice(index, index + size).join(' '));
    }
  }
  return { start: contentsStart, bodyHintStart: repeatedBodyTitle?.start ?? contentsStart, phrases };
}

function contentsRanges(records) {
  const ranges = [];
  for (let index = 0; index < records.length; index += 1) {
    if (metadataKind(records[index].text) !== 'contents') continue;
    const endRecord = records.slice(index + 1).find((record) => {
      const kind = metadataKind(record.text);
      return /^#{1,6}\s+/.test(record.text.trim()) && kind && kind !== 'contents';
    });
    // Without a reliable closing heading (Ulysses is an example), retain the
    // candidates and let the substantive-payload detector select the body copy.
    if (endRecord) ranges.push({ start: records[index].next, end: endRecord.start });
  }
  return ranges;
}

function repeatedUppercaseHeadings(records) {
  const counts = new Map();
  for (const record of records) {
    const match = /^#{1,2}\s+(.+?)\s*$/.exec(record.text.trim());
    if (!match) continue;
    const heading = cleanHeading(match[1]);
    if (heading !== heading.toUpperCase() || metadataKind(heading) || STRUCTURAL_HEADING.test(heading) || NUMBERED_TITLE.test(heading)) continue;
    const normalized = normalizedHeading(heading);
    if (normalized) counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const repeated = new Set([...counts].filter(([, count]) => count >= 2).map(([heading]) => heading));
  // One repeated running title is not a chapter system. A repeated set of
  // several headings is strong evidence of a TOC copy followed by body copy.
  return repeated.size >= 3 ? repeated : new Set();
}

function contentWordsAfter(candidate, nextCandidate, source) {
  return wordCount(source.slice(candidate.next, nextCandidate?.start ?? source.length));
}

function removeEmptyBoundaries(candidates, source, minimumWords) {
  let current = [...candidates];
  let changed = true;
  while (changed && current.length > 1) {
    changed = false;
    const next = [];
    for (let index = 0; index < current.length; index += 1) {
      const candidate = current[index];
      const following = current[index + 1];
      if (following && contentWordsAfter(candidate, following, source) < minimumWords) {
        changed = true;
        continue;
      }
      next.push(candidate);
    }
    current = next;
  }
  return current;
}

function anomalyReport(chapters, longChapterWords) {
  const short = [];
  const long = [];
  const contentsOnly = [];
  for (const chapter of chapters) {
    const count = wordCount(chapter.content);
    if (count < 25) short.push({ number: chapter.number, title: chapter.title, wordCount: count });
    if (count > longChapterWords) long.push({ number: chapter.number, title: chapter.title, wordCount: count });
    const tokens = words(chapter.content.replace(/^#{1,6}\s+.*$/gm, ''));
    const indexTokens = tokens.filter((token) => /^(?:\[?\d+\]?|[IVXLCDM]+[.)]?)$/i.test(token)).length;
    if (tokens.length > 0 && indexTokens / tokens.length >= 0.6) contentsOnly.push({ number: chapter.number, title: chapter.title, wordCount: count });
  }
  return { short, long, contentsOnly, total: short.length + long.length + contentsOnly.length };
}

/**
 * Parse a public-domain mobile Markdown manuscript without rewriting it.
 *
 * Every returned chapter is an exact, ordered source slice. By default the
 * title/byline/contents prefix is prepended to the first readable chapter so
 * no payload is lost and conventional chapter counts remain stable. Set
 * `frontMatterMode: "chapter"` to expose that prefix as its own chapter.
 */
export function parseClassicSections(markdown, options = {}) {
  if (typeof markdown !== 'string') throw new TypeError('Classic Markdown source must be a string.');
  const source = markdown.replace(/\r\n?/g, '\n');
  const records = recordsFor(source);
  const { start: contentsStart, bodyHintStart, phrases } = contentsPhrases(source, records);
  const tableOfContentsRanges = contentsRanges(records);
  const repeatedHeadings = repeatedUppercaseHeadings(records);
  const profileHeadings = new Set((options.profile?.plainTextHeadings ?? []).map(normalizedHeading).filter(Boolean));
  const profilePatterns = (options.profile?.boundaryPatterns ?? []).filter((pattern) => pattern instanceof RegExp);
  const minimumWords = Number.isInteger(options.minimumChapterWords) ? Math.max(0, options.minimumChapterWords) : DEFAULT_MIN_CHAPTER_WORDS;
  const bodyStartWords = Number.isInteger(options.bodyStartWords) ? Math.max(minimumWords, options.bodyStartWords) : Math.max(minimumWords, DEFAULT_BODY_START_WORDS);
  const longChapterWords = Number.isInteger(options.longChapterWords) ? Math.max(1, options.longChapterWords) : DEFAULT_LONG_CHAPTER_WORDS;

  const allCandidates = records
    .map((record) => candidateFor(record, phrases, repeatedHeadings, profileHeadings, profilePatterns))
    .filter(Boolean)
    .filter((candidate) => candidate.candidateKind === 'metadata' || !tableOfContentsRanges.some((range) => candidate.start >= range.start && candidate.start < range.end));
  const firstTerminal = allCandidates.find((candidate) => candidate.candidateKind === 'terminal-container');
  let readableCandidates = allCandidates.filter((candidate) => candidate.candidateKind !== 'metadata' && (!firstTerminal || candidate.start <= firstTerminal.start));
  if (options.profile?.exclusiveBoundaries === true) {
    readableCandidates = readableCandidates.filter((candidate) => candidate.candidateKind === 'profile');
  }
  const boundaryLevels = Array.isArray(options.profile?.boundaryLevels)
    ? new Set(options.profile.boundaryLevels.filter((level) => Number.isInteger(level)))
    : null;
  if (boundaryLevels?.size) readableCandidates = readableCandidates.filter((candidate) => boundaryLevels.has(candidate.level));
  const startPattern = options.profile?.startPattern instanceof RegExp ? options.profile.startPattern : null;
  const endPattern = options.profile?.endPattern instanceof RegExp ? options.profile.endPattern : null;
  let selectedStart = 0;
  if (startPattern) {
    const startCandidate = readableCandidates.find((candidate) => startPattern.test(candidate.title));
    if (startCandidate) {
      selectedStart = startCandidate.start;
      readableCandidates = readableCandidates.filter((candidate) => candidate.start >= selectedStart);
    }
  }
  if (endPattern) {
    const endRecord = records.find((record) => record.start > selectedStart && endPattern.test(cleanHeading(record.text)));
    if (endRecord) readableCandidates = readableCandidates.filter((candidate) => candidate.start < endRecord.start);
  }
  const boundaryFilter = typeof options.profile?.boundaryFilter === 'function'
    ? options.profile.boundaryFilter
    : null;
  if (boundaryFilter) {
    readableCandidates = readableCandidates.filter((candidate, index, candidates) => (
      boundaryFilter(candidate, { index, candidates, source, records }) !== false
    ));
  }
  const hasExplicitStructure = readableCandidates.some((candidate) => !['contents-match', 'profile'].includes(candidate.candidateKind));
  if (hasExplicitStructure) readableCandidates = readableCandidates.filter((candidate) => candidate.candidateKind !== 'contents-match');

  const bodySearchStart = startPattern && selectedStart > 0 ? selectedStart : (bodyHintStart >= 0 ? bodyHintStart : 0);
  const bodySearchCandidates = readableCandidates.filter((candidate) => candidate.start >= bodySearchStart);
  let firstSubstantiveIndex = bodySearchCandidates.findIndex((candidate, index) => (
    contentWordsAfter(candidate, bodySearchCandidates[index + 1], source) >= bodyStartWords
  ));
  if (firstSubstantiveIndex < 0) firstSubstantiveIndex = 0;
  const firstSubstantive = bodySearchCandidates[firstSubstantiveIndex];

  // Anything before the first candidate with actual payload is title matter or
  // a table of contents. It remains preserved as front matter, not as a series
  // of fake 9-word chapters.
  let bodyCandidates = firstSubstantive
    ? bodySearchCandidates.filter((candidate) => candidate.start >= firstSubstantive.start)
    : [];
  bodyCandidates = removeEmptyBoundaries(bodyCandidates, source, minimumWords);

  if (!bodyCandidates.length) {
    bodyCandidates = [{ start: 0, end: 0, next: 0, title: options.fallbackTitle || 'Text', candidateKind: 'fallback', explicit: true, key: 'fallback' }];
  }

  const frontMatterEnd = bodyCandidates[0].start;
  const frontMatterContent = source.slice(0, frontMatterEnd);
  const frontMatter = {
    start: 0,
    end: frontMatterEnd,
    content: frontMatterContent,
    wordCount: wordCount(frontMatterContent),
    payloadChars: payload(frontMatterContent).length,
    headings: allCandidates
      .filter((candidate) => candidate.start < frontMatterEnd)
      .map((candidate) => ({ title: candidate.title, kind: candidate.metadataKind ?? candidate.candidateKind, start: candidate.start })),
    contentsDetected: contentsStart >= 0,
  };

  const chapters = bodyCandidates.map((candidate, index) => {
    const next = bodyCandidates[index + 1];
    let start = candidate.start;
    if (index === 0 && options.frontMatterMode !== 'chapter') start = 0;
    const end = next?.start ?? source.length;
    const content = source.slice(start, end);
    const sourceTitle = candidate.text?.trim().replace(/^#{1,6}\s+/, '').trim() || candidate.title || `Chapter ${index + 1}`;
    const displayTitle = typeof options.profile?.displayTitle === 'function'
      ? options.profile.displayTitle(candidate, index)
      : (candidate.title || `Chapter ${index + 1}`);
    return {
      number: index + 1,
      title: displayTitle,
      sourceTitle,
      ordinal: index + 1,
      content,
      status: 'published',
      isFree: true,
      sourceStart: start,
      sourceEnd: end,
      boundaryStart: candidate.start,
      boundaryKind: candidate.candidateKind,
      wordCount: wordCount(content),
      frontMatterPrefixChars: index === 0 && start === 0 ? frontMatterEnd : 0,
    };
  });

  if (options.frontMatterMode === 'chapter' && payload(frontMatterContent)) {
    chapters.unshift({
      number: 1,
      title: options.frontMatterTitle || 'Front Matter',
      sourceTitle: options.frontMatterTitle || 'Front Matter',
      ordinal: 1,
      content: frontMatterContent,
      status: 'published',
      isFree: true,
      sourceStart: 0,
      sourceEnd: frontMatterEnd,
      boundaryStart: 0,
      boundaryKind: 'front-matter',
      wordCount: wordCount(frontMatterContent),
      frontMatterPrefixChars: 0,
    });
    chapters.forEach((chapter, index) => { chapter.number = index + 1; chapter.ordinal = index + 1; });
  }

  const reconstructed = chapters.map((chapter) => chapter.content).join('');
  const sourcePayload = payload(source);
  const reconstructedPayload = payload(reconstructed);
  const coverage = {
    ok: sourcePayload === reconstructedPayload,
    sourcePayloadChars: sourcePayload.length,
    chapterPayloadChars: reconstructedPayload.length,
    ratio: sourcePayload.length ? reconstructedPayload.length / sourcePayload.length : 1,
    sourceSha256: createHash('sha256').update(sourcePayload).digest('hex'),
    chapterSha256: createHash('sha256').update(reconstructedPayload).digest('hex'),
  };
  const anomalies = anomalyReport(chapters, longChapterWords);
  const chapterWordCounts = chapters.map((chapter) => wordCount(chapter.content));
  const sourceWordCount = wordCount(source);
  const reconstructedWordCount = chapterWordCounts.reduce((sum, count) => sum + count, 0);
  const suspiciousShortChapterCount = chapters.filter((chapter) => {
    if (wordCount(chapter.content) >= 100) return false;
    const title = chapter.title.trim().toLowerCase().replace(/[.:]+$/, '');
    if (/^(?:contents?|table of contents|index|navigation)$/.test(title)) return true;
    const markerTitle = /^(?:chapter\s+)?(?:\d+|[ivxlcdm]+|[-–—\s]+(?:\d+|[ivxlcdm]+)[-–—\s]*)$/i.test(title);
    const compactContent = chapter.content.replace(/\s+/g, ' ').trim();
    const bracketedPageList = /^(?:\[\s*(?:\d+|[ivxlcdm]+)\s*\]\s*)+$/i.test(compactContent);
    const plainPageList = /^(?:(?:page\s*)?(?:\d+|[ivxlcdm]+)[,;|\s]*)+$/i.test(compactContent);
    return markerTitle && (bracketedPageList || plainPageList);
  }).length;
  const fingerprint = (value, edge) => {
    const slice = edge === 'start' ? value.slice(0, 512) : value.slice(-512);
    return createHash('sha256').update(slice).digest('hex');
  };
  const integrity = {
    verified: coverage.ok && sourceWordCount === reconstructedWordCount,
    sourceCanonicalSha256: coverage.sourceSha256,
    reconstructedCanonicalSha256: coverage.chapterSha256,
    sourceWordCount,
    reconstructedWordCount,
    coverageRatio: coverage.ratio,
    minChapterWordCount: Math.min(...chapterWordCounts),
    maxChapterWordCount: Math.max(...chapterWordCounts),
    suspiciousShortChapterCount,
    sourceStartFingerprint: fingerprint(sourcePayload, 'start'),
    sourceEndFingerprint: fingerprint(sourcePayload, 'end'),
    reconstructedStartFingerprint: fingerprint(reconstructedPayload, 'start'),
    reconstructedEndFingerprint: fingerprint(reconstructedPayload, 'end'),
  };

  return {
    chapters,
    frontMatter,
    audit: {
      coverage,
      anomalies,
      bodyChapterCount: bodyCandidates.length,
      emittedChapterCount: chapters.length,
      expectedChapterCount: options.expectedChapterCount ?? null,
      expectedChapterDelta: Number.isInteger(options.expectedChapterCount) ? bodyCandidates.length - options.expectedChapterCount : null,
      boundaryKinds: chapters.reduce((counts, chapter) => ({ ...counts, [chapter.boundaryKind]: (counts[chapter.boundaryKind] ?? 0) + 1 }), {},),
      candidateCount: allCandidates.length,
      bodyHintStart,
      readableCandidateCount: readableCandidates.length,
      bodySearchCandidateCount: bodySearchCandidates.length,
      firstSubstantiveIndex,
      candidatePreview: bodySearchCandidates.slice(0, 5).map((candidate) => ({ title: candidate.title, kind: candidate.candidateKind, level: candidate.level, start: candidate.start })),
      titleOverrides: chapters
        .filter((chapter) => chapter.sourceTitle !== chapter.title)
        .map((chapter) => ({ ordinal: chapter.ordinal, sourceTitle: chapter.sourceTitle, displayTitle: chapter.title })),
      integrity,
    },
    integrity,
  };
}

export function assertClassicSectionIntegrity(result) {
  if (!result?.audit?.coverage?.ok) throw new Error('Classic section parser lost or reordered source payload.');
  if (!Array.isArray(result.chapters) || !result.chapters.length) throw new Error('Classic section parser produced no readable chapters.');
  return result;
}
