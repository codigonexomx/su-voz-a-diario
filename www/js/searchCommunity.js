/**
 * CommunitySearch - Búsqueda en la Comunidad
 * Su Voz a Diario - Fase 3
 */
class CommunitySearch {
    constructor() {
        this.searchInput = null;
        this.searchResults = [];
    }

    async searchPosts(query) {
        if (!query || query.trim().length < 3) return [];

        const cleanQuery = query.trim().toLowerCase();
        const db = window.firebaseDb;
        const fns = window.firebaseFns;

        if (db && fns?.getDocs && fns?.query) {
            try {
                const q = fns.query(
                    fns.collection(db, 'communityPosts'),
                    fns.where('plainText', '>=', cleanQuery),
                    fns.where('plainText', '<=', cleanQuery + '\uf8ff'),
                    fns.limit(20)
                );
                const snapshot = await fns.getDocs(q);
                this.searchResults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                return this.searchResults;
            } catch (e) {
                console.warn('[CommunitySearch] Error buscando en Firestore, ejecutando búsqueda en memoria:', e);
            }
        }

        // Búsqueda fallback en memoria sobre el feed cargado
        const state = window.app?.getCommunityFeedState?.() || {};
        const posts = state.posts || [];
        this.searchResults = posts.filter(post => {
            const text = (post.text || '').toLowerCase();
            const ref = (post.reference || '').toLowerCase();
            const name = (post.authorSnapshot?.displayName || post.name || '').toLowerCase();
            return text.includes(cleanQuery) || ref.includes(cleanQuery) || name.includes(cleanQuery);
        });

        return this.searchResults;
    }

    renderSearchInput(container) {
        if (!container) return;
        container.innerHTML = `
            <div class="community-search-bar">
                <input type="text" id="communitySearchInput" class="community-input" placeholder="🔍 Buscar por palabra clave, pasaje o hermano..." />
                <div class="community-search-results" style="display: none;"></div>
            </div>
        `;

        const input = container.querySelector('#communitySearchInput');
        const resultsEl = container.querySelector('.community-search-results');

        if (input) {
            let debounceTimer;
            input.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                const val = e.target.value;
                debounceTimer = setTimeout(async () => {
                    if (val.length >= 3) {
                        const results = await this.searchPosts(val);
                        this.displayResults(results, resultsEl);
                    } else {
                        resultsEl.style.display = 'none';
                    }
                }, 300);
            });
        }
    }

    displayResults(results, container) {
        if (!container) return;
        if (!results.length) {
            container.innerHTML = `<div class="search-no-results">Sin coincidencias para la búsqueda</div>`;
            container.style.display = 'block';
            return;
        }

        container.innerHTML = results.map(post => `
            <div class="search-result-item" data-post-id="${post.id}">
                <strong>${this.escapeHtml(this.getDisplayName(post))}</strong> · <small>${this.escapeHtml(post.reference || '')}</small>
                <div class="search-result-snippet">${this.escapeHtml((post.text || '').substring(0, 80))}...</div>
            </div>
        `).join('');

        container.style.display = 'block';

        container.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const postId = item.dataset.postId;
                if (window.app?.focusCommunityTarget) {
                    window.app.focusCommunityTarget(postId, null, true);
                }
                container.style.display = 'none';
            });
        });
    }

    getDisplayName(post) {
        if (
            post?.isAnonymous === true ||
            !post?.name ||
            post.name.trim().toLowerCase() === 'anónimo'
        ) {
            return 'Anónimo';
        }

        return post.authorSnapshot?.displayName || post.name || 'Anónimo';
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

if (typeof window !== 'undefined') {
    window.CommunitySearch = CommunitySearch;
}
