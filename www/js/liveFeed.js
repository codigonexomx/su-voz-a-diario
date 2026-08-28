/**
 * LiveCommunityFeed - Feed en Tiempo Real con Firestore Listeners y Banner de Actualizaciones
 * Su Voz a Diario - Módulo 5
 */

class LiveCommunityFeed {
    constructor(containerElement) {
        this.container = containerElement || document.querySelector('.community-container');
        this.unsubscribe = null;
        this.newPostsCount = 0;
        this.bannerElement = null;
        this.isInitialLoad = true;
    }

    startLiveUpdates() {
        if (this.unsubscribe) {
            this.stopLiveUpdates();
        }

        const db = window.firebaseDb;
        const fns = window.firebaseFns;
        if (!db || !fns?.onSnapshot || !fns?.query || !fns?.collection) {
            console.warn('[LiveFeed] Firestore SDK no disponible para listeners en tiempo real.');
            return;
        }

        const cutoffDate = window.app?.getCommunityCutoff ? window.app.getCommunityCutoff() : new Date(Date.now() - 15 * 86400000);

        try {
            const postsRef = fns.query(
                fns.collection(db, 'communityPosts'),
                fns.where('lastActivityAt', '>=', cutoffDate),
                fns.orderBy('lastActivityAt', 'desc'),
                fns.limit(50)
            );

            this.isInitialLoad = true;
            this.newPostsCount = 0;

            this.unsubscribe = fns.onSnapshot(postsRef, (snapshot) => {
                snapshot.docChanges().forEach((change) => {
                    if (change.type === 'added' && !this.isInitialLoad) {
                        const postData = { id: change.doc.id, ...change.doc.data() };
                        // Solo contar si no es del usuario actual para no duplicar su propia publicación
                        if (postData.ownerUid !== window.app?.currentUser?.uid) {
                            this.handleNewPost(postData);
                        }
                    }
                });

                this.isInitialLoad = false;
            }, (error) => {
                console.error('[LiveFeed] Error en listener del live feed:', error);
            });
        } catch (error) {
            console.error('[LiveFeed] No se pudo iniciar la escucha en tiempo real:', error);
        }
    }

    handleNewPost(post) {
        this.newPostsCount++;
        this.showUpdateBanner();
        this.playNotificationSound();
    }

    showUpdateBanner() {
        if (!this.bannerElement) {
            this.bannerElement = document.createElement('div');
            this.bannerElement.className = 'live-update-banner';
            
            const hostContainer = this.container || document.querySelector('.community-container') || document.body;
            hostContainer.prepend(this.bannerElement);
        }

        const countText = this.newPostsCount > 1 
            ? `${this.newPostsCount} nuevas reflexiones compartidas`
            : `1 nueva reflexión compartida`;

        this.bannerElement.innerHTML = `
            <div class="banner-icon">✨</div>
            <div class="banner-text">${countText}</div>
            <button class="banner-action" type="button">Ver</button>
        `;

        const actionBtn = this.bannerElement.querySelector('.banner-action');
        if (actionBtn) {
            actionBtn.onclick = (e) => {
                e.stopPropagation();
                this.refreshFeed();
            };
        }

        this.bannerElement.classList.add('visible');

        // Auto-ocultar después de 5 segundos
        clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
            if (this.bannerElement) {
                this.bannerElement.classList.remove('visible');
            }
        }, 5000);
    }

    refreshFeed() {
        this.newPostsCount = 0;
        if (this.bannerElement) {
            this.bannerElement.classList.remove('visible');
            this.bannerElement.remove();
            this.bannerElement = null;
        }

        const scrollPos = this.captureScrollPosition();

        if (window.app?.renderCommunity) {
            window.app.renderCommunity({
                forceRefresh: true,
                showSkeleton: false,
                preserveAnchor: true
            }).then(() => {
                this.restoreScrollPosition(scrollPos);
            });
        }
    }

    playNotificationSound() {
        try {
            if ('vibrate' in navigator) {
                navigator.vibrate([30, 50, 30]);
            }
        } catch (e) {
            // Ignorar errores de audio
        }
    }

    captureScrollPosition() {
        const feedContainer = document.querySelector('.community-feed');
        if (!feedContainer) return { visiblePost: null, offset: 0 };

        const posts = feedContainer.querySelectorAll('.community-card[data-post-id]');
        let visiblePost = null;
        let offset = 0;

        posts.forEach(post => {
            const rect = post.getBoundingClientRect();
            if (rect.top <= 120 && rect.bottom >= 120) {
                visiblePost = post.dataset.postId;
                offset = rect.top;
            }
        });

        return { visiblePost, offset };
    }

    restoreScrollPosition(position) {
        if (!position || !position.visiblePost) return;

        requestAnimationFrame(() => {
            const post = document.querySelector(`.community-card[data-post-id="${CSS.escape(position.visiblePost)}"]`);
            if (post) {
                const rect = post.getBoundingClientRect();
                const scrollTop = (window.pageYOffset || window.scrollY) + rect.top - position.offset;
                window.scrollTo({ top: scrollTop, behavior: 'instant' });
            }
        });
    }

    stopLiveUpdates() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
        if (this.bannerElement) {
            this.bannerElement.remove();
            this.bannerElement = null;
        }
    }
}

if (typeof window !== 'undefined') {
    window.LiveCommunityFeed = LiveCommunityFeed;
}
