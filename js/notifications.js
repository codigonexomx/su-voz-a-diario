/* UID-scoped in-app activity. Push permission is managed separately in Settings. */
(function () {
    const types = {
        newReply: { icon: 'community', title: 'Nueva respuesta' },
        newReaction: { icon: 'heart', title: 'Nueva reacción' },
        achievement: { icon: 'complete', title: 'Actividad de Comunidad' },
        streak: { icon: 'complete', title: 'Actividad de Comunidad' },
        newPrayer: { icon: 'heart', title: 'Nueva petición de oración' },
        prayerSupport: { icon: 'heart', title: 'Te acompañan en oración' },
        prayerAnswered: { icon: 'complete', title: 'Una petición tiene una actualización' }
    };
    const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);

    class NotificationCenter {
        constructor() {
            this.notifications = [];
            this.unreadCount = 0;
            this.isOpen = false;
            this.uid = null;
            this.generation = 0;
            this.error = false;
            this.loaded = false;
            this.pending = new Set();
            document.addEventListener('click', event => {
                if (this.isOpen && this.container && !this.container.contains(event.target)) this.closeDropdown(false);
            });
            document.addEventListener('keydown', event => {
                if (event.key === 'Escape' && this.isOpen) { event.preventDefault(); this.closeDropdown(); }
            });
        }

        disconnect() {
            this.generation++;
            this.unsubscribe?.();
            this.unsubscribe = null;
            this.uid = null;
            this.notifications = [];
            this.unreadCount = 0;
            this.isOpen = false;
            this.error = false;
            this.loaded = false;
            this.pending.clear();
            this.refreshContainer();
        }

        initialize(user = window.App?.currentUser) {
            const uid = user?.uid;
            if (uid && uid === this.uid && this.unsubscribe && !this.error) return;
            this.disconnect();
            const fns = window.firebaseFns, db = window.firebaseDb;
            if (!uid || !db || !fns?.onSnapshot || !fns?.query) return;
            this.uid = uid;
            const generation = this.generation;
            const current = () => generation === this.generation && window.App?.currentUser?.uid === uid;
            try {
                const q = fns.query(fns.collection(db, 'notifications'), fns.where('userId', '==', uid), fns.orderBy('createdAt', 'desc'), fns.limit(40));
                this.unsubscribe = fns.onSnapshot(q, snapshot => {
                    if (!current()) return;
                    this.notifications = snapshot.docs.map(item => ({ ...item.data(), id: item.id }));
                    this.unreadCount = this.notifications.filter(item => !item.isRead).length;
                    this.loaded = true;
                    this.error = false;
                    this.updateBadgeUI();
                    if (this.isOpen) this.renderList();
                }, () => {
                    if (!current()) return;
                    this.error = true;
                    this.loaded = true;
                    if (this.isOpen) this.renderList();
                });
            } catch {
                this.error = true;
                this.loaded = true;
            }
            this.refreshContainer();
        }

        icon(name) { return window.App?.renderCommunityIcon?.(name) || ''; }

        renderBellHtml() {
            return `<div class="notification-bell" id="notificationBell">
                <button type="button" class="bell-btn" aria-label="Actividad de Comunidad${this.unreadCount ? `: ${this.unreadCount} sin leer` : ''}" title="Actividad de Comunidad" aria-expanded="${this.isOpen}" aria-controls="community-notification-panel">
                    ${this.icon('bell')}<span class="notification-badge"${this.unreadCount ? '' : ' hidden'}>${this.unreadCount > 39 ? '40+' : this.unreadCount}</span>
                </button>
                <section class="notification-dropdown" id="community-notification-panel" role="dialog" aria-label="Actividad de Comunidad"${this.isOpen ? '' : ' hidden'}>
                    <header class="notification-header"><h3>Actividad</h3><button type="button" class="notification-close" aria-label="Cerrar actividad" title="Cerrar actividad">${this.icon('close')}</button></header>
                    <button type="button" class="mark-all-read-btn">${this.icon('complete')}Marcar recientes como leídas</button>
                    <div class="notification-list" aria-live="polite"></div>
                </section>
            </div>`;
        }

        refreshContainer() {
            const slot = document.getElementById('community-notification-slot');
            if (!slot) return;
            slot.innerHTML = this.renderBellHtml();
            this.bindEvents(slot);
        }

        bindEvents(container) {
            this.container = container;
            if (!container) return;
            const bell = container.querySelector('.bell-btn');
            bell?.addEventListener('click', event => {
                event.stopPropagation();
                if (this.isOpen) this.closeDropdown(); else this.openDropdown();
            });
            container.querySelector('.notification-close')?.addEventListener('click', () => this.closeDropdown());
            container.querySelector('.mark-all-read-btn')?.addEventListener('click', () => this.markAllAsRead());
            this.updateBadgeUI();
            if (this.isOpen) this.renderList();
        }

        openDropdown() {
            this.isOpen = true;
            this.container?.querySelector('.notification-dropdown')?.removeAttribute('hidden');
            this.container?.querySelector('.bell-btn')?.setAttribute('aria-expanded', 'true');
            this.renderList();
            this.container?.querySelector('.notification-close')?.focus();
        }

        closeDropdown(restoreFocus = true) {
            this.isOpen = false;
            this.container?.querySelector('.notification-dropdown')?.setAttribute('hidden', '');
            this.container?.querySelector('.bell-btn')?.setAttribute('aria-expanded', 'false');
            if (restoreFocus) this.container?.querySelector('.bell-btn')?.focus();
        }

        renderList() {
            const host = this.container?.querySelector('.notification-list');
            if (!host) return;
            const all = this.container.querySelector('.mark-all-read-btn');
            if (all) all.disabled = !this.notifications.some(item => !item.isRead) || this.pending.size > 0;
            if (this.error) host.innerHTML = '<p class="notification-state">No se pudo actualizar la actividad.</p><button type="button" class="notification-retry">Reintentar</button>';
            else if (!this.loaded) host.innerHTML = '<p class="notification-state" role="status">Cargando actividad…</p>';
            else if (!this.notifications.length) host.innerHTML = '<p class="notification-state">No tienes actividad reciente.</p>';
            else host.innerHTML = this.notifications.map(item => {
                const config = types[item.type] || { icon: 'bell', title: 'Actividad de Comunidad' };
                const date = item.createdAt?.toDate?.() || (item.createdAt?.seconds ? new Date(item.createdAt.seconds * 1000) : null);
                const stamp = date && Number.isFinite(date.getTime()) ? date.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '';
                return `<button type="button" class="notification-item ${item.isRead ? 'read' : 'unread'}" data-notification-id="${escape(item.id)}">
                    <span class="notification-item-icon" aria-hidden="true">${this.icon(config.icon)}</span>
                    <span class="notification-item-content"><strong>${escape(item.title || config.title)}</strong><span>${escape(item.body || '')}</span>${stamp ? `<time>${escape(stamp)}</time>` : ''}</span>
                    ${item.isRead ? '' : '<span class="notification-unread-dot" aria-label="Sin leer"></span>'}
                </button>`;
            }).join('');
            host.querySelector('.notification-retry')?.addEventListener('click', () => this.initialize());
            host.querySelectorAll('[data-notification-id]').forEach(button => button.addEventListener('click', async () => {
                const item = this.notifications.find(notice => notice.id === button.dataset.notificationId);
                const uid = this.uid;
                if (!item || uid !== window.App?.currentUser?.uid) return;
                await this.markAsRead(item.id);
                if (uid !== this.uid || uid !== window.App?.currentUser?.uid) return;
                this.closeDropdown(false);
                if (validId(item.prayerId)) await window.App?.openCommunityPrayerTarget?.(item.prayerId);
                else if (validId(item.postId)) await window.App?.navigate?.('community', item.postId);
            }));
        }

        updateBadgeUI() {
            const badge = this.container?.querySelector('.notification-badge');
            if (badge) { badge.hidden = !this.unreadCount; badge.textContent = this.unreadCount > 39 ? '40+' : String(this.unreadCount); }
            this.container?.querySelector('.bell-btn')?.setAttribute('aria-label', `Actividad de Comunidad${this.unreadCount ? `: ${this.unreadCount} sin leer` : ''}`);
        }

        async markAsRead(id) { return this.markRead([id]); }
        async markAllAsRead() { return this.markRead(this.notifications.filter(item => !item.isRead).map(item => item.id)); }

        async markRead(ids) {
            const fns = window.firebaseFns, uid = this.uid, generation = this.generation;
            const notices = this.notifications.filter(item => ids.includes(item.id) && !item.isRead && !this.pending.has(item.id));
            if (!notices.length) return true;
            if (!uid || uid !== window.App?.currentUser?.uid || !fns?.writeBatch) return false;
            notices.forEach(item => this.pending.add(item.id));
            try {
                const batch = fns.writeBatch(window.firebaseDb);
                notices.forEach(item => batch.update(fns.doc(window.firebaseDb, 'notifications', item.id), { isRead: true }));
                await batch.commit();
                if (generation !== this.generation || uid !== window.App?.currentUser?.uid) return false;
                notices.forEach(item => { item.isRead = true; });
                this.unreadCount = this.notifications.filter(item => !item.isRead).length;
                this.updateBadgeUI();
                return true;
            } catch {
                if (generation === this.generation) window.App?.showToast('No se pudo marcar la actividad como leída. Intenta nuevamente con conexión.');
                return false;
            } finally {
                if (generation === this.generation) {
                    notices.forEach(item => this.pending.delete(item.id));
                    if (this.isOpen) this.renderList();
                }
            }
        }
    }
    window.NotificationCenter = NotificationCenter;
})();
