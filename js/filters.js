/**
 * CommunityFilters - Filtros Avanzados para el Feed de Comunidad
 * Su Voz a Diario - Fase 3
 */
class CommunityFilters {
    constructor() {
        this.filters = {
            sortBy: 'recent', // 'recent' | 'popular' | 'mostReplied'
            dateRange: 'all',  // 'today' | 'week' | 'month' | 'all'
            hasAudio: false,
            hasReplies: false
        };
    }

    applyFiltersToPosts(posts = []) {
        let result = [...posts];

        if (this.filters.hasAudio) {
            result = result.filter(p => Boolean(p.audioURL));
        }

        if (this.filters.hasReplies) {
            result = result.filter(p => Boolean(p.replyCount && p.replyCount > 0));
        }

        if (this.filters.sortBy === 'popular') {
            result.sort((a, b) => ((b.reactionCount || 0) - (a.reactionCount || 0)));
        } else if (this.filters.sortBy === 'mostReplied') {
            result.sort((a, b) => ((b.replyCount || 0) - (a.replyCount || 0)));
        }

        return result;
    }

    setFilter(key, value) {
        if (key in this.filters) {
            this.filters[key] = value;
            if (window.app?.renderCommunity) {
                window.app.renderCommunity({ showSkeleton: false });
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.CommunityFilters = CommunityFilters;
}
