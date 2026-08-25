/**
 * NotificationCenter - Centro de Notificaciones In-App
 * Su Voz a Diario - Módulo 8
 */

const notificationTypes = {
    newReply: {
        icon: '💬',
        title: 'Nueva respuesta',
        color: '#3182CE'
    },
    newReaction: {
        icon: '❤️',
        title: 'Nueva reacción',
        color: '#E53E3E'
    },
    achievement: {
        icon: '🏆',
        title: 'Logro desbloqueado',
        color: '#D69E2E'
    },
    streak: {
        icon: '🔥',
        title: 'Racha mantenida',
        color: '#DD6B20'
    }
};

class NotificationCenter {
    constructor() {
        this.notifications = [];
        this.unreadCount = 0;
        this.isOpen = false;
        this.container = null;
    }

    initialize() {
        this.listenNotifications();
    }

    listenNotifications() {
        if (!window.app?.currentUser?.uid) {
            console.warn('[NotificationCenter] Omitiendo listener: Usuario no autenticado aún');
            return;
        }

        const currentUser = window.app.currentUser;
        const db = window.firebaseDb;
        const fns = window.firebaseFns;

        if (!db || !fns?.onSnapshot || !fns?.query) return;

        try {
            const q = fns.query(
                fns.collection(db, 'notifications'),
                fns.where('userId', '==', currentUser.uid),
                fns.orderBy('createdAt', 'desc'),
                fns.limit(20)
            );

            fns.onSnapshot(q, (snapshot) => {
                this.notifications = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                this.unreadCount = this.notifications.filter(n => !n.isRead).length;
                this.updateBadgeUI();
                if (this.isOpen) {
                    this.renderList();
                }
            }, (err) => {
                console.warn('[NotificationCenter] Error en listener de notificaciones:', err);
            });
        } catch (e) {
            console.error('[NotificationCenter] No se pudieron escuchar notificaciones:', e);
        }
    }

    renderBellHtml() {
        return `
            <div class="notification-bell" id="notificationBell">
                <button type="button" class="bell-btn" aria-label="Ver notificaciones" title="Notificaciones">
                    🔔
                    <span class="notification-badge" ${this.unreadCount > 0 ? '' : 'style="display: none;"'}>${this.unreadCount > 99 ? '99+' : this.unreadCount}</span>
                </button>
                <div class="notification-dropdown" style="display: none;" aria-live="polite">
                    <div class="notification-header">
                        <h4>Notificaciones</h4>
                        <button type="button" class="mark-all-read-btn">Marcar todas leídas</button>
                    </div>
                    <div class="notification-list">
                        <!-- Notificaciones dinámicas -->
                    </div>
                </div>
            </div>
        `;
    }

    bindEvents(bellContainer) {
        this.container = bellContainer;
        if (!this.container) return;

        const bellBtn = this.container.querySelector('.bell-btn');
        const dropdown = this.container.querySelector('.notification-dropdown');
        const markAllBtn = this.container.querySelector('.mark-all-read-btn');

        if (bellBtn) {
            bellBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleDropdown();
            });
        }

        if (markAllBtn) {
            markAllBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.markAllAsRead();
            });
        }

        document.addEventListener('click', (e) => {
            if (this.isOpen && this.container && !this.container.contains(e.target)) {
                this.closeDropdown();
            }
        });
    }

    toggleDropdown() {
        if (this.isOpen) {
            this.closeDropdown();
        } else {
            this.openDropdown();
        }
    }

    openDropdown() {
        this.isOpen = true;
        const dropdown = this.container?.querySelector('.notification-dropdown');
        if (dropdown) {
            dropdown.style.display = 'block';
            this.renderList();
        }
    }

    closeDropdown() {
        this.isOpen = false;
        const dropdown = this.container?.querySelector('.notification-dropdown');
        if (dropdown) {
            dropdown.style.display = 'none';
        }
    }

    renderList() {
        const listEl = this.container?.querySelector('.notification-list');
        if (!listEl) return;

        if (!this.notifications.length) {
            listEl.innerHTML = `<div class="notification-empty">No tienes notificaciones recientes</div>`;
            return;
        }

        listEl.innerHTML = this.notifications.map(n => {
            const config = notificationTypes[n.type] || { icon: '🔔', title: 'Notificación', color: '#3182CE' };
            return `
                <div class="notification-item ${n.isRead ? 'read' : 'unread'}" data-id="${n.id}" data-post-id="${n.postId || ''}">
                    <div class="notification-item-icon" style="background-color: color-mix(in srgb, ${config.color} 15%, transparent); color: ${config.color};">
                        ${config.icon}
                    </div>
                    <div class="notification-item-content">
                        <div class="notification-item-title">${this.escapeHtml(n.title || config.title)}</div>
                        <div class="notification-item-body">${this.escapeHtml(n.body || '')}</div>
                    </div>
                </div>
            `;
        }).join('');

        listEl.querySelectorAll('.notification-item').forEach(item => {
            item.addEventListener('click', () => {
                const id = item.dataset.id;
                const postId = item.dataset.postId;
                this.markAsRead(id);

                if (postId && window.app?.focusCommunityTarget) {
                    window.app.focusCommunityTarget(postId, null, true);
                }
                this.closeDropdown();
            });
        });
    }

    updateBadgeUI() {
        const badge = this.container?.querySelector('.notification-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = this.unreadCount > 99 ? '99+' : String(this.unreadCount);
            } else {
                badge.style.display = 'none';
            }
        }
    }

    async markAsRead(notificationId) {
        const item = this.notifications.find(n => n.id === notificationId);
        if (item) item.isRead = true;
        this.unreadCount = this.notifications.filter(n => !n.isRead).length;
        this.updateBadgeUI();

        const db = window.firebaseDb;
        const fns = window.firebaseFns;
        if (db && fns?.updateDoc && fns?.doc) {
            try {
                await fns.updateDoc(fns.doc(db, 'notifications', notificationId), { isRead: true });
            } catch (e) {
                console.warn('[NotificationCenter] Error marcando notificación:', e);
            }
        }
    }

    async markAllAsRead() {
        this.notifications.forEach(n => n.isRead = true);
        this.unreadCount = 0;
        this.updateBadgeUI();
        this.renderList();

        const db = window.firebaseDb;
        const fns = window.firebaseFns;
        if (!db || !fns?.writeBatch || !fns?.doc) return;

        try {
            const batch = fns.writeBatch(db);
            this.notifications.filter(n => !n.isRead).forEach(n => {
                batch.update(fns.doc(db, 'notifications', n.id), { isRead: true });
            });
            await batch.commit();
        } catch (e) {
            console.warn('[NotificationCenter] Error en batch markAllAsRead:', e);
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

if (typeof window !== 'undefined') {
    window.NotificationCenter = NotificationCenter;
}
