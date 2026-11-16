import { LocalRvr1960Provider } from './LocalRvr1960Provider.js';
import { StrongRepository } from './StrongRepository.js';
import { BIBLE_SOURCE_LOCAL, createBibleChapter } from './bibleModel.js';

export const RVR1960_STRONG_VERSION_ID = 'rvr60-strong';
export const RVR1960_STRONG_VERSION_LABEL = 'RVR1960 + Strong';
export const RVR1960_STRONG_VERSION_NAME = 'Reina-Valera 1960 con números Strong';

export class LocalRvr1960StrongProvider {
    constructor({ baseProvider = new LocalRvr1960Provider(), strongRepository = new StrongRepository() } = {}) {
        this.versionId = RVR1960_STRONG_VERSION_ID;
        this.versionLabel = RVR1960_STRONG_VERSION_LABEL;
        this.versionName = RVR1960_STRONG_VERSION_NAME;
        this.source = BIBLE_SOURCE_LOCAL;
        this.baseProvider = baseProvider;
        this.strongRepository = strongRepository;
    }

    getCanonicalBookId(bookId) {
        return this.baseProvider.getCanonicalBookId(bookId);
    }

    loadBible() {
        return this.baseProvider.loadBible();
    }

    getBooks() {
        return this.baseProvider.getBooks();
    }

    async getChapter(bookId, chapterNumber) {
        const base = await this.baseProvider.getChapter(bookId, chapterNumber);
        const spans = await this.strongRepository.getChapterSpans(base.bookId, base.chapter, base.verses);
        const unaligned = await this.strongRepository.getChapterUnalignedIds(base.bookId, base.chapter);
        const headings = await this.strongRepository.getChapterHeadingIds(base.bookId, base.chapter);
        return createBibleChapter({
            ...base,
            versionId: this.versionId,
            versionLabel: this.versionLabel,
            versionName: this.versionName,
            verses: base.verses.map(verse => ({ ...verse, strongSpans: spans[verse.number] || [],
                strongUnalignedIds: unaligned[verse.number] || [], strongHeadingIds: headings[verse.number] || [] }))
        });
    }
}
