import { readingIcon } from '../utils/readingIcons.js';

export const communityExperienceMethods = {
    renderCommunityIcon: function(name) { return readingIcon(name); },

    getPersonalPrayerState: function(mode = this.prayerTabFilter) {
        this.communityPersonalPrayerStates ||= {};
        return this.communityPersonalPrayerStates[mode] ||= { posts: [], cursor: null, hasMore: false, loaded: false, loading: false, error: null };
    },

    loadPersonalPrayerRequests: async function(mode, { append = false, forceRefresh = false } = {}) {
        const state = this.getPersonalPrayerState(mode), uid = this.currentUser?.uid;
        if (!uid || !['my-prayers', 'following'].includes(mode)) return [];
        if (state.loading || state.loaded && !append && !forceRefresh) return state.posts;
        if (append && !state.hasMore) return state.posts;
        state.loading = true; state.error = null;
        try {
            const callable = await this.getCommunityIdentityCallable('listMyPrayerRequests');
            const response = await callable({ mode: mode === 'following' ? 'following' : 'mine', cursor: append ? state.cursor : null });
            if (uid !== this.currentUser?.uid || this.communityPersonalPrayerStates?.[mode] !== state) return [];
            const page = response?.data;
            if (!Array.isArray(page?.posts)) throw new Error('PRAYER_LIST_UNAVAILABLE');
            const unique = new Map((append ? state.posts : []).map(item => [item.id, item]));
            page.posts.forEach(item => { if (/^[A-Za-z0-9_-]{1,128}$/.test(item.id || '')) unique.set(item.id, item); });
            state.posts = [...unique.values()];
            state.cursor = typeof page.cursor === 'string' ? page.cursor : null;
            state.hasMore = page.hasMore === true && !!state.cursor;
            state.loaded = true;
            return state.posts;
        } catch (error) {
            state.error = error;
            throw error;
        } finally { state.loading = false; }
    },

    openCommunityPrayerTarget: async function(id) {
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(id || '')) return;
        this.setCommunityEntryPoint('notification');
        await this.navigateToPushHash(`#community?section=prayer&prayer=${encodeURIComponent(id)}`);
    },

    loadCommunityPrayerTarget: async function(id) {
        if (!/^[A-Za-z0-9_-]{1,128}$/.test(id || '')) return null;
        const fns = window.firebaseFns;
        const snapshot = await fns.getDoc(fns.doc(window.firebaseDb, 'communityPrayerRequests', id));
        if (!snapshot.exists()) return null;
        return { ...snapshot.data(), id: snapshot.id };
    },

    formatCommunityPrayerTimestamp: function(value) {
        const seconds = value?.seconds ?? value?._seconds;
        const date = value?.toDate?.() || (typeof seconds === 'number' ? new Date(seconds * 1000)
            : value instanceof Date ? value : typeof value === 'number' || typeof value === 'string' ? new Date(value) : null);
        return date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('es-MX', { month: 'short', day: 'numeric' })
            + ' · ' + date.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }) : '';
    },

    renderCommunitySectionControls: function() {
        const isPrayer = this.communitySection === 'prayer';
        return `<div class="community-section-toolbar">
            <div class="community-section-segmented" role="group" aria-label="Secciones de Comunidad">
                <button type="button" class="community-section-btn ${!isPrayer ? 'is-active' : ''}" data-action="set-community-section" data-section="reflections" aria-pressed="${!isPrayer}">${readingIcon('community')}<span>Reflexiones</span></button>
                <button type="button" class="community-section-btn ${isPrayer ? 'is-active' : ''}" data-action="set-community-section" data-section="prayer" aria-pressed="${isPrayer}">${readingIcon('heart')}<span>Oración</span></button>
            </div>
            <button type="button" class="community-refresh-btn" data-action="refresh-community" title="Actualizar Comunidad" aria-label="Actualizar Comunidad">${readingIcon('refresh')}</button>
        </div>`;
    },
};
