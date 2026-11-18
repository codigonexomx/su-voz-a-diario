/**
 * Single-book commentary lookup for schemaVersion 1.0.
 * No network, filesystem, UI, publication or implicit title parsing.
 */
const ENTRY_KINDS = new Set(['commentary', 'context']);
const MAPPING_STATUSES = new Set(['confirmed', 'candidate', 'unmapped']);

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(label + ' must be an object');
  }
}

function string(value, label, nonempty = false) {
  if (typeof value !== 'string' || (nonempty && !value.trim())) {
    throw new TypeError(label + ' must be ' + (nonempty ? 'a nonempty string' : 'a string'));
  }
}

function integer(value, label, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) {
    throw new RangeError(label + ' must be a safe integer >= ' + minimum);
  }
}

function array(value, label) {
  if (!Array.isArray(value)) throw new TypeError(label + ' must be an array');
}

function pointOrdinal(point, info, label) {
  record(point, label);
  if (point.bookId !== info.bookId) {
    throw new RangeError(label + '.bookId must match package.book.id (' + info.bookId + ')');
  }
  integer(point.chapter, label + '.chapter', 1);
  if (point.chapter > info.counts.length) throw new RangeError(label + '.chapter exceeds the book');
  integer(point.verse, label + '.verse', 1);
  if (point.verse > info.counts[point.chapter - 1]) throw new RangeError(label + '.verse exceeds the chapter');
  return info.offsets[point.chapter - 1] + point.verse;
}

function interval(range, info, label) {
  record(range, label);
  const start = pointOrdinal(range.start, info, label + '.start');
  const end = pointOrdinal(range.end, info, label + '.end');
  if (start > end) throw new RangeError(label + '.start must not follow .end');
  return { start, end };
}

function prepare(pkg) {
  record(pkg, 'package');
  if (pkg.schemaVersion !== '1.0') throw new TypeError('package.schemaVersion must be "1.0"');
  record(pkg.work, 'package.work');
  string(pkg.work.id, 'package.work.id', true);
  record(pkg.book, 'package.book');
  string(pkg.book.id, 'package.book.id', true);
  integer(pkg.book.number, 'package.book.number', 1);
  if (pkg.book.number > 66) throw new RangeError('package.book.number must not exceed 66');
  array(pkg.book.chapterVerseCounts, 'package.book.chapterVerseCounts');
  if (!pkg.book.chapterVerseCounts.length) throw new RangeError('package.book.chapterVerseCounts must not be empty');
  const offsets = [];
  let total = 0;
  pkg.book.chapterVerseCounts.forEach((count, i) => {
    integer(count, 'package.book.chapterVerseCounts[' + i + ']', 1);
    offsets.push(total);
    total += count;
    if (!Number.isSafeInteger(total)) throw new RangeError('Total verse count exceeds the safe integer limit');
  });
  const info = { bookId: pkg.book.id, counts: pkg.book.chapterVerseCounts, offsets, entries: [] };
  array(pkg.entries, 'package.entries');
  array(pkg.notes, 'package.notes');
  const ids = new Map();
  pkg.entries.forEach((entry, index) => {
    const label = 'package.entries[' + index + ']';
    record(entry, label);
    string(entry.id, label + '.id', true);
    if (ids.has(entry.id)) throw new TypeError('Duplicate entry id: ' + entry.id);
    ids.set(entry.id, entry);
    if (!ENTRY_KINDS.has(entry.kind)) throw new TypeError(label + '.kind must be commentary or context');
    if (!MAPPING_STATUSES.has(entry.mappingStatus)) throw new TypeError(label + '.mappingStatus is invalid');
    string(entry.title, label + '.title');
    string(entry.text, label + '.text');
    integer(entry.order, label + '.order');
    if (entry.parentId !== undefined && entry.parentId !== null) string(entry.parentId, label + '.parentId', true);
    array(entry.ranges, label + '.ranges');
    if (entry.kind === 'commentary' && entry.mappingStatus === 'confirmed' && !entry.ranges.length) {
      throw new RangeError(label + ' is confirmed commentary without a passage range');
    }
    const ranges = entry.ranges.map((range, i) => interval(range, info, label + '.ranges[' + i + ']'));
    array(entry.sourceSpans, label + '.sourceSpans');
    entry.sourceSpans.forEach((span, i) => {
      const spanLabel = label + '.sourceSpans[' + i + ']';
      record(span, spanLabel);
      integer(span.pdfPage, spanLabel + '.pdfPage', 1);
      integer(span.start, spanLabel + '.start');
      integer(span.end, spanLabel + '.end');
      if (span.start > span.end) throw new RangeError(spanLabel + '.start must not follow .end');
    });
    info.entries.push({ entry, ranges, index });
  });
  for (const { entry } of info.entries) {
    if (entry.parentId != null && !ids.has(entry.parentId)) {
      throw new TypeError('Unknown parentId for entry ' + entry.id + ': ' + entry.parentId);
    }
  }
  // A parent graph must terminate; traversal is iterative for long hierarchies.
  const checkedParents = new Set();
  for (const { entry } of info.entries) {
    const ancestors = new Set();
    let cursor = entry;
    while (cursor && !checkedParents.has(cursor.id)) {
      if (ancestors.has(cursor.id)) throw new TypeError('Cyclic parentId at entry ' + cursor.id);
      ancestors.add(cursor.id);
      cursor = cursor.parentId == null ? null : ids.get(cursor.parentId);
    }
    for (const id of ancestors) checkedParents.add(id);
  }
  return info;
}

/** Validate structure and passage bounds. Returns the original package unchanged. */
export function validatePackage(pkg) {
  prepare(pkg);
  return pkg;
}

function matchingEntries(info, query) {
  return info.entries
    .filter(({ entry, ranges }) => entry.kind === 'commentary' && entry.mappingStatus === 'confirmed'
      && ranges.some(range => range.start <= query.end && query.start <= range.end))
    .sort((a, b) => a.entry.order - b.entry.order || a.index - b.index)
    .map(({ entry }) => entry);
}

/** Inclusive single-verse lookup; only confirmed commentary entries are returned. */
export function lookupVerse(pkg, point) {
  const info = prepare(pkg);
  const ordinal = pointOrdinal(point, info, 'query');
  return matchingEntries(info, { start: ordinal, end: ordinal });
}

/** Inclusive single-book range lookup; cross-chapter ranges are supported. */
export function lookupRange(pkg, range) {
  const info = prepare(pkg);
  return matchingEntries(info, interval(range, info, 'query'));
}
