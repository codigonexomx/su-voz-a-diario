/**
 * OfflineManager - Soporte Modo Offline y Sincronización Automática
 * Su Voz a Diario - Fase 3
 */
class OfflineManager {
    constructor() {
        this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
        this.pendingPostsKey = 'su-voz-pending-posts-offline';
        this.pendingPosts = this.loadPendingPosts();

        if (typeof window !== 'undefined') {
            window.addEventListener('online', () => {
                this.isOnline = true;
                this.hideOfflineBanner();
                this.syncPending();
            });
            window.addEventListener('offline', () => {
                this.isOnline = false;
                this.showOfflineBanner();
            });
        }
    }

    loadPendingPosts() {
        try {
            return JSON.parse(localStorage.getItem(this.pendingPostsKey) || '[]');
        } catch (e) {
            return [];
        }
    }

    savePendingPosts() {
        try {
            localStorage.setItem(this.pendingPostsKey, JSON.stringify(this.pendingPosts));
        } catch (e) {
            console.warn('[OfflineManager] Error guardando cola offline:', e);
        }
    }

    async createPostOffline(postData) {
        const item = {
            ...postData,
            createdAt: new Date().toISOString(),
            offlineId: `offline_${Date.now()}`
        };
        this.pendingPosts.push(item);
        this.savePendingPosts();

        if (window.app?.showToast) {
            window.app.showToast('Guardado sin conexión. Se publicará automáticamente al reconectarse.');
        }

        return { success: true, offline: true, id: item.offlineId };
    }

    async syncPending() {
        if (!this.isOnline || this.pendingPosts.length === 0) return;

        const db = window.firebaseDb;
        const fns = window.firebaseFns;
        if (!db || !fns?.addDoc || !fns?.collection) return;

        const toSync = [...this.pendingPosts];
        for (const post of toSync) {
            try {
                const { offlineId, ...safePost } = post;
                safePost.createdAt = fns.serverTimestamp();
                safePost.lastActivityAt = fns.serverTimestamp();

                await fns.addDoc(fns.collection(db, 'communityPosts'), safePost);
                this.pendingPosts = this.pendingPosts.filter(p => p.offlineId !== offlineId);
                this.savePendingPosts();
            } catch (error) {
                console.error('[OfflineManager] Error al sincronizar post pendiente:', error);
            }
        }

        if (toSync.length > 0 && window.app?.showToast) {
            window.app.showToast('Publicaciones offline sincronizadas con éxito.');
            if (window.app?.renderCommunity) {
                window.app.renderCommunity({ forceRefresh: true });
            }
        }
    }

    showOfflineBanner() {
        if (window.app?.showToast) {
            window.app.showToast('Modo sin conexión activo.', 'warning');
        }
    }

    hideOfflineBanner() {
        if (window.app?.showToast) {
            window.app.showToast('Conexión reestablecida.', 'success');
        }
    }
}

if (typeof window !== 'undefined') {
    window.OfflineManager = OfflineManager;
    document.addEventListener('DOMContentLoaded', () => {
        window.offlineManager = new OfflineManager();
    });
}
