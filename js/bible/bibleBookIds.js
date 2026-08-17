const BIBLE_BOOK_DEFINITIONS = Object.freeze([
    { id: 'gen', crossReferenceId: 'Gen', aliases: ['genesis', 'book-gen'] },
    { id: 'exo', crossReferenceId: 'Exod', aliases: ['exodus'] },
    { id: 'lev', crossReferenceId: 'Lev', aliases: ['leviticus'] },
    { id: 'num', crossReferenceId: 'Num', aliases: ['numbers'] },
    { id: 'deu', crossReferenceId: 'Deut', aliases: ['deuteronomy'] },
    { id: 'jos', crossReferenceId: 'Josh', aliases: ['joshua'] },
    { id: 'jdg', crossReferenceId: 'Judg', aliases: ['judges'] },
    { id: 'rut', crossReferenceId: 'Ruth', aliases: [] },
    { id: '1sa', crossReferenceId: '1Sam', aliases: ['1samuel'] },
    { id: '2sa', crossReferenceId: '2Sam', aliases: ['2samuel'] },
    { id: '1ki', crossReferenceId: '1Kgs', aliases: ['1kings'] },
    { id: '2ki', crossReferenceId: '2Kgs', aliases: ['2kings'] },
    { id: '1ch', crossReferenceId: '1Chr', aliases: ['1chronicles'] },
    { id: '2ch', crossReferenceId: '2Chr', aliases: ['2chronicles'] },
    { id: 'ezr', crossReferenceId: 'Ezra', aliases: [] },
    { id: 'neh', crossReferenceId: 'Neh', aliases: ['nehemiah'] },
    { id: 'est', crossReferenceId: 'Esth', aliases: ['esther'] },
    { id: 'job', crossReferenceId: 'Job', aliases: [] },
    { id: 'psa', crossReferenceId: 'Ps', aliases: ['psalm', 'psalms'] },
    { id: 'pro', crossReferenceId: 'Prov', aliases: ['proverbs'] },
    { id: 'ecc', crossReferenceId: 'Eccl', aliases: ['ecclesiastes'] },
    { id: 'sng', crossReferenceId: 'Song', aliases: ['songofsongs'] },
    { id: 'isa', crossReferenceId: 'Isa', aliases: ['isaiah'] },
    { id: 'jer', crossReferenceId: 'Jer', aliases: ['jeremiah'] },
    { id: 'lam', crossReferenceId: 'Lam', aliases: ['lamentations'] },
    { id: 'ezk', crossReferenceId: 'Ezek', aliases: ['ezekiel'] },
    { id: 'dan', crossReferenceId: 'Dan', aliases: ['daniel'] },
    { id: 'hos', crossReferenceId: 'Hos', aliases: ['hosea'] },
    { id: 'jol', crossReferenceId: 'Joel', aliases: [] },
    { id: 'amo', crossReferenceId: 'Amos', aliases: [] },
    { id: 'oba', crossReferenceId: 'Obad', aliases: ['obadiah'] },
    { id: 'jon', crossReferenceId: 'Jonah', aliases: [] },
    { id: 'mic', crossReferenceId: 'Mic', aliases: ['micah'] },
    { id: 'nam', crossReferenceId: 'Nah', aliases: ['nahum'] },
    { id: 'hab', crossReferenceId: 'Hab', aliases: ['habakkuk'] },
    { id: 'zep', crossReferenceId: 'Zeph', aliases: ['zephaniah'] },
    { id: 'hag', crossReferenceId: 'Hag', aliases: ['haggai'] },
    { id: 'zec', crossReferenceId: 'Zech', aliases: ['zechariah'] },
    { id: 'mal', crossReferenceId: 'Mal', aliases: ['malachi'] },
    { id: 'mat', crossReferenceId: 'Matt', aliases: ['matthew'] },
    { id: 'mrk', crossReferenceId: 'Mark', aliases: ['mark'] },
    { id: 'luk', crossReferenceId: 'Luke', aliases: ['luke'] },
    { id: 'jhn', crossReferenceId: 'John', aliases: ['john', 'juan', 'book-john'] },
    { id: 'act', crossReferenceId: 'Acts', aliases: ['acts'] },
    { id: 'rom', crossReferenceId: 'Rom', aliases: ['romans'] },
    { id: '1co', crossReferenceId: '1Cor', aliases: ['1corinthians'] },
    { id: '2co', crossReferenceId: '2Cor', aliases: ['2corinthians'] },
    { id: 'gal', crossReferenceId: 'Gal', aliases: ['galatians'] },
    { id: 'eph', crossReferenceId: 'Eph', aliases: ['ephesians'] },
    { id: 'php', crossReferenceId: 'Phil', aliases: ['philippians'] },
    { id: 'col', crossReferenceId: 'Col', aliases: ['colossians'] },
    { id: '1th', crossReferenceId: '1Thess', aliases: ['1thessalonians'] },
    { id: '2th', crossReferenceId: '2Thess', aliases: ['2thessalonians'] },
    { id: '1ti', crossReferenceId: '1Tim', aliases: ['1timothy'] },
    { id: '2ti', crossReferenceId: '2Tim', aliases: ['2timothy'] },
    { id: 'tit', crossReferenceId: 'Titus', aliases: [] },
    { id: 'phm', crossReferenceId: 'Phlm', aliases: ['philemon'] },
    { id: 'heb', crossReferenceId: 'Heb', aliases: ['hebrews'] },
    { id: 'jas', crossReferenceId: 'Jas', aliases: ['james'] },
    { id: '1pe', crossReferenceId: '1Pet', aliases: ['1peter'] },
    { id: '2pe', crossReferenceId: '2Pet', aliases: ['2peter'] },
    { id: '1jn', crossReferenceId: '1John', aliases: ['1john'] },
    { id: '2jn', crossReferenceId: '2John', aliases: ['2john'] },
    { id: '3jn', crossReferenceId: '3John', aliases: ['3john'] },
    { id: 'jud', crossReferenceId: 'Jude', aliases: [] },
    { id: 'rev', crossReferenceId: 'Rev', aliases: ['revelation', 'apocalipsis', 'book-rev'] }
].map(definition => Object.freeze(definition)));

const CANONICAL_BOOK_ALIASES = Object.freeze(
    Object.fromEntries(
        BIBLE_BOOK_DEFINITIONS.flatMap(({ id, crossReferenceId, aliases }) => [
            [id, id],
            [crossReferenceId.toLowerCase(), id],
            ...aliases.map(alias => [alias, id])
        ])
    )
);

const CROSS_REFERENCE_BOOK_IDS = Object.freeze(
    Object.fromEntries(
        BIBLE_BOOK_DEFINITIONS.map(({ id, crossReferenceId }) => [id, crossReferenceId])
    )
);

const CANONICAL_BOOK_IDS_BY_CROSS_REFERENCE_ID = Object.freeze(
    Object.fromEntries(
        BIBLE_BOOK_DEFINITIONS.map(({ id, crossReferenceId }) => [crossReferenceId.toLowerCase(), id])
    )
);

export { BIBLE_BOOK_DEFINITIONS };

export function normalizeBibleBookId(value) {
    const normalized = String(value || '').trim().toLowerCase();
    return CANONICAL_BOOK_ALIASES[normalized] || normalized;
}

export function getCrossReferenceBookId(value) {
    return CROSS_REFERENCE_BOOK_IDS[normalizeBibleBookId(value)] || '';
}

export function getCanonicalBibleBookIdFromCrossReference(value) {
    return CANONICAL_BOOK_IDS_BY_CROSS_REFERENCE_ID[
        String(value || '').trim().toLowerCase()
    ] || '';
}
