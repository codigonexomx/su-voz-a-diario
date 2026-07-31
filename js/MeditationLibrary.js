/**
 * Responsabilidad: Construye el índice en memoria de meditaciones y permite buscar, filtrar y ordenar.
 * Dependencias: Un adaptador de almacenamiento inyectado vía init(). Sin dependencias directas del DOM ni variables globales.
 * API pública: init, getAll, filter, sort, search, updateSessionInIndex
 * Restricciones: No debe persistir datos. No debe leer variables globales.
 */

export const MeditationLibrary = {
    _index: null,
    _storageAdapter: null,

    _biblicalOrderMap: {
        'gen': 1, 'exo': 2, 'lev': 3, 'num': 4, 'deut': 5, 'josh': 6, 'judg': 7, 'ruth': 8, '1sam': 9, '2sam': 10,
        '1kgs': 11, '2kgs': 12, '1chron': 13, '2chron': 14, 'ezra': 15, 'neh': 16, 'esth': 17, 'job': 18, 'ps': 19,
        'prov': 20, 'eccles': 21, 'song': 22, 'isa': 23, 'jer': 24, 'lam': 25, 'ezek': 26, 'dan': 27, 'hos': 28,
        'joel': 29, 'amos': 30, 'obad': 31, 'jonah': 32, 'mic': 33, 'nah': 34, 'hab': 35, 'zeph': 36, 'hag': 37,
        'zech': 38, 'mal': 39, 'matt': 40, 'mark': 41, 'luke': 42, 'john': 43, 'acts': 44, 'rom': 45, '1cor': 46,
        '2cor': 47, 'gal': 48, 'eph': 49, 'phil': 50, 'col': 51, '1thess': 52, '2thess': 53, '1tim': 54, '2tim': 55,
        'titus': 56, 'philem': 57, 'heb': 58, 'jas': 59, '1pet': 60, '2pet': 61, '1john': 62, '2john': 63, '3john': 64,
        'jude': 65, 'rev': 66
    },

    init: function(config) {
        this._storage = config.storage;
        this._bibleBooks = config.bibleBooks || [];
    },

    normalizeSearchText: function(text) {
        if (!text) return '';
        return String(text).toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // remover acentos
            .replace(/[^\w\s]/gi, ' ') // caracteres especiales a espacio
            .replace(/\s+/g, ' ') // múltiples a simple
            .trim();
    },

    generateSnippet: function(session) {
        if (!session.notes) return '';
        const combined = Object.values(session.notes)
            .filter(v => typeof v === 'string' && v.trim().length > 0)
            .join(' ');
        
        let plain = combined.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        if (plain.length > 150) {
            plain = plain.substring(0, 147) + '...';
        }
        return plain;
    },

    buildIndexIfNeeded: function() {
        if (this._index) return;
        if (!this._storage) {
            console.warn('[MeditationLibrary] Advertencia: Adaptador de almacenamiento no inicializado.');
            return;
        }
        
        console.log('[MeditationLibrary] Construyendo índice en memoria...');
        this._index = [];
        const metadata = this._storage.getAllMetadata();
        
        for (const meta of metadata) {
            const session = this._storage.get(meta.id);
            if (session) {
                this.updateSessionInIndex(session, true);
            }
        }
        console.log(`[MeditationLibrary] Índice construido: ${this._index.length} sesiones.`);
    },

    updateSessionInIndex: function(session, buildMode = false) {
        if (!this._index && !buildMode) return;
        if (!this._index) this._index = [];

        const existingIdx = this._index.findIndex(item => item.id === session.id);
        
        const titleNormalized = this.normalizeSearchText(session.title);
        let bookName = session.bookId;
        
        if (this._bibleBooks && this._bibleBooks.length > 0) {
            const book = this._bibleBooks.find(b => b.id === session.bookId);
            if (book) bookName = book.name || book.nombre || session.bookId;
        }
        const bookNormalized = this.normalizeSearchText(bookName);
        
        const contentCombined = Object.values(session.notes || {}).join(' ');
        const contentNormalized = this.normalizeSearchText(contentCombined);
        
        const searchText = `${titleNormalized} ${bookNormalized} ${contentNormalized}`;
        
        const indexEntry = {
            id: session.id,
            readingId: session.readingId,
            status: session.status,
            favorite: session.favorite === true,
            bibleVersion: session.bibleVersion,
            bookId: session.bookId,
            chapter: session.chapter,
            verseStart: session.verseStart,
            updatedAt: session.updatedAt,
            createdAt: session.createdAt,
            completedAt: session.completedAt,
            title: session.title,
            snippet: this.generateSnippet(session),
            metadata: session.metadata || null,
            searchText: searchText
        };

        if (existingIdx >= 0) {
            this._index[existingIdx] = indexEntry;
        } else {
            this._index.push(indexEntry);
        }
    },

    getAll: function() {
        this.buildIndexIfNeeded();
        return [...(this._index || [])];
    },
    
    filter: function(results, filters) {
        if (!filters) return results;
        let filtered = results;
        if (filters.collection === 'favorites') {
            filtered = filtered.filter(entry => entry.favorite === true && entry.status !== 'archived');
        } else if (filters.collection === 'archived') {
            filtered = filtered.filter(entry => entry.status === 'archived');
        } else if (filters.collection === 'books') {
            filtered = filtered.filter(entry => entry.status !== 'archived');
        } else if (filters.status === 'all') {
            filtered = filtered.filter(entry => entry.status !== 'archived');
        }
        if (filters.status && filters.status !== 'all') {
            filtered = filtered.filter(entry => entry.status === filters.status);
        }
        if (filters.version && filters.version !== 'all') {
            filtered = filtered.filter(entry => entry.bibleVersion === filters.version);
        }
        if (filters.bookId && filters.bookId !== 'all') {
            filtered = filtered.filter(entry => entry.bookId === filters.bookId);
        }
        if (filters.collection === 'books' && filters.selectedBookId) {
            filtered = filtered.filter(entry => entry.bookId === filters.selectedBookId);
        }
        return filtered;
    },
    
    sort: function(results, sortBy) {
        let sorted = [...results];
        sorted.sort((a, b) => {
            if (sortBy === 'updated-desc') return (b.updatedAt || 0) - (a.updatedAt || 0);
            if (sortBy === 'created-desc') return (b.createdAt || 0) - (a.createdAt || 0);
            if (sortBy === 'completed-desc') return (b.completedAt || 0) - (a.completedAt || 0);
            
            if (sortBy === 'biblical-asc') {
                const orderA = this._biblicalOrderMap[a.bookId] || 999;
                const orderB = this._biblicalOrderMap[b.bookId] || 999;
                if (orderA !== orderB) return orderA - orderB;
                
                const chA = parseInt(a.chapter) || 0;
                const chB = parseInt(b.chapter) || 0;
                if (chA !== chB) return chA - chB;
                
                const vA = parseInt(a.verseStart) || 0;
                const vB = parseInt(b.verseStart) || 0;
                return vA - vB;
            }
            
            return 0; // Default
        });
        return sorted;
    },

    search: function(query, filters, sortBy) {
        let results = this.getAll();
        
        // 1. Aplicar búsqueda por texto
        const normalizedQuery = this.normalizeSearchText(query);
        if (normalizedQuery) {
            const terms = normalizedQuery.split(' ');
            results = results.filter(entry => {
                return terms.every(term => entry.searchText.includes(term));
            });
        }
        
        // 2. Aplicar filtros
        results = this.filter(results, filters);
        
        // 3. Ordenar
        results = this.sort(results, sortBy);
        
        return results;
    }
};
