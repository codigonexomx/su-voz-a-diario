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
        if (window.app?.showToast) {
            window.app.showToast('Necesitas conexión a internet para publicar en Comunidad.');
        }

        return { success: false, offline: true, message: 'Necesitas conexión a internet para publicar en Comunidad.' };
    }

    async syncPending() {
        if (!this.isOnline || this.pendingPosts.length === 0) return;
        console.warn('[OfflineManager] La cola legacy de Comunidad queda deshabilitada; publicar requiere Functions y conexión.');
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
