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
    strongHeadingIds = []
} = {}) {
    return Object.freeze({
        number: normalizePositiveInteger(number, 'número de versículo'),
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
    });
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
    verses
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
                ? `${normalizedBookName} ${normalizedChapter}:${verse?.number}`
                : ''
        )
    }));

    return Object.freeze({
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
    });
}
