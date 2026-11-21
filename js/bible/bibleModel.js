export const BIBLE_SOURCE_LOCAL = 'local';

function normalizeRequiredId(value, fieldName) {
    const normalized = String(value || '').trim().toLowerCase();

    if (!normalized) {
        throw new Error(`El capítulo bíblico no tiene ${fieldName}.`);
    }

    return normalized;
}

function normalizePositiveInteger(value, fieldName) {
    const normalized = Number(value);

    if (!Number.isInteger(normalized) || normalized < 1) {
        throw new Error(`El capítulo bíblico tiene ${fieldName} inválido.`);
    }

    return normalized;
}

export function createBibleVerse({ 
    number, 
    text, 
    reference = '', 
    subtitle = '', 
    footnotes = [], 
    crossReferences = [],
    sourceNotes = [],
    headingNotes = [],
    strongSpans = [],
    strongUnalignedIds = [],
    strongHeadingIds = [],
    verseNumbers = null,
    displayNumber = '',
    sourceBlockIndices = null,
    parts = null
} = {}) {
    const normalizedNumber = normalizePositiveInteger(number, 'número de versículo');
    const normalizedVerseNumbers = Array.isArray(verseNumbers) && verseNumbers.length
        ? Object.freeze(verseNumbers.map(value => normalizePositiveInteger(value, 'número de versículo')))
        : null;
    const normalizedDisplayNumber = String(displayNumber || '').trim();
    const verse = {
        number: normalizedNumber,
        text: String(text || ''),
        reference: String(reference || '').trim(),
        subtitle: String(subtitle || '').trim(),
        footnotes: Object.freeze(Array.isArray(footnotes) ? [...footnotes] : []),
        crossReferences: Object.freeze(Array.isArray(crossReferences) ? [...crossReferences] : []),
        sourceNotes: Object.freeze(Array.isArray(sourceNotes) ? [...sourceNotes] : []),
        headingNotes: Object.freeze(Array.isArray(headingNotes) ? [...headingNotes] : []),
        strongSpans: Object.freeze(Array.isArray(strongSpans) ? strongSpans.map(span => Object.freeze({
            ...span, ids: Object.freeze(Array.isArray(span.ids) ? [...span.ids] : [])
        })) : []),
        strongUnalignedIds: Object.freeze(Array.isArray(strongUnalignedIds) ? [...strongUnalignedIds] : []),
        strongHeadingIds: Object.freeze(Array.isArray(strongHeadingIds) ? [...strongHeadingIds] : [])
    };
    if (normalizedVerseNumbers) verse.verseNumbers = normalizedVerseNumbers;
    if (normalizedDisplayNumber) verse.displayNumber = normalizedDisplayNumber;
    if (Array.isArray(sourceBlockIndices)) verse.sourceBlockIndices = Object.freeze([...sourceBlockIndices]);
    if (Array.isArray(parts)) verse.parts = Object.freeze(parts.map(part => String(part ?? '')));
    return Object.freeze(verse);
}

export function createBibleChapter({
    versionId,
    versionLabel = '',
    versionName = '',
    source,
    bookId,
    sourceBookId = '',
    bookName = '',
    chapter,
    verses,
    blocks = null,
    notes = null,
    tables = null,
    parallelReferences = null,
    supplementalContent = null,
    copyright = null
} = {}) {
    const normalizedVersionId = normalizeRequiredId(versionId, 'versionId');
    const normalizedBookId = normalizeRequiredId(bookId, 'bookId');
    const normalizedChapter = normalizePositiveInteger(chapter, 'capítulo');
    const normalizedBookName = String(bookName || '').trim();

    if (!Array.isArray(verses)) {
        throw new Error('El capítulo bíblico no tiene una lista de versículos válida.');
    }

    const normalizedVerses = verses.map(verse => createBibleVerse({
        ...verse,
        reference: verse?.reference || (
            normalizedBookName
                ? `${normalizedBookName} ${normalizedChapter}:${verse?.displayNumber || verse?.number}`
                : ''
        )
    }));

    const result = {
        id: `${normalizedBookId}.${normalizedChapter}`,
        versionId: normalizedVersionId,
        versionLabel: String(versionLabel || versionId || '').trim(),
        versionName: String(versionName || versionLabel || versionId || '').trim(),
        source: String(source || '').trim() || BIBLE_SOURCE_LOCAL,
        bookId: normalizedBookId,
        sourceBookId: String(sourceBookId || '').trim(),
        bookName: normalizedBookName,
        chapter: normalizedChapter,
        chapterNumber: normalizedChapter,
        verses: Object.freeze(normalizedVerses)
    };
    if (Array.isArray(blocks)) result.blocks = Object.freeze([...blocks]);
    if (Array.isArray(notes)) result.notes = Object.freeze([...notes]);
    if (Array.isArray(tables)) result.tables = Object.freeze([...tables]);
    if (Array.isArray(parallelReferences)) result.parallelReferences = Object.freeze([...parallelReferences]);
    if (Array.isArray(supplementalContent)) result.supplementalContent = Object.freeze([...supplementalContent]);
    if (copyright != null) result.copyright = copyright;

    return Object.freeze(result);
}
