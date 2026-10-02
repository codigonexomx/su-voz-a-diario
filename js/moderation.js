/* Reports and blocks are resolved by the backend, never by public anonymous UIDs. */
const reportReasons = ['Contenido inapropiado', 'Spam o promoción', 'Contenido ofensivo', 'Información engañosa', 'Acoso o bullying', 'Otro motivo'];

class ModerationSystem {
    constructor() {
        this.termsVersion = '2026-10-01';
        this.hidden = { post: {}, reply: {}, prayer: {} };
        this.blocked = [];
        this.isModerator = false;
    }

    async call(name, data) {
        if (!navigator.onLine) throw new Error('Necesitas conexión a internet para esta acción.');
        const app = window.app;
        await app.initAuth();
        const callable = await app.getCommunityIdentityCallable(name);
        return (await callable(data))?.data || {};
    }

    escapeHtml(value) {
        return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    openDialog(title, body) {
        this.activeDialog?.close();
        const previousFocus = document.activeElement;
        const overlay = document.createElement('div');
        overlay.className = 'report-overlay';
        overlay.dataset.moderationDialog = 'true';
        overlay.innerHTML = `<section class="report-dialog" role="dialog" aria-modal="true" aria-labelledby="moderation-dialog-title"><header class="report-header"><h3 id="moderation-dialog-title">${this.escapeHtml(title)}</h3><button type="button" class="close-report-btn" aria-label="Cerrar">×</button></header>${body}</section>`;
        document.body.appendChild(overlay);
        let closed = false;
        const close = () => {
            if (closed) return;
            closed = true;
            overlay.dispatchEvent(new Event('moderation-dialog-closed'));
            overlay.remove();
            this.activeDialog = null;
            previousFocus?.isConnected && previousFocus.focus();
        };
        this.activeDialog = { overlay, close };
        overlay.querySelector('.close-report-btn').addEventListener('click', close);
        overlay.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); close(); }
            if (event.key !== 'Tab') return;
            const controls = [...overlay.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, a[href]')];
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        });
        overlay.querySelector('.close-report-btn').focus();
        return { overlay, close };
    }

    async ensureTerms() {
        const uid = window.app?.currentUser?.uid;
        const key = `su-voz-community-terms-${uid}`;
        try { if (localStorage.getItem(key) === this.termsVersion) return true; } catch { /* Server also validates acceptance. */ }
        if (this.termsPromise) return this.termsPromise;
        this.termsPromise = new Promise(resolve => {
            const { overlay, close } = this.openDialog('Normas de Comunidad', '<p>Comparte con respeto y sin ataques, acoso, spam ni contenido ilegal. No publiques datos personales o sensibles de terceros sin su permiso.</p><p>Las publicaciones son visibles para otros usuarios y pueden ser revisadas o retiradas por moderación. Puedes denunciar contenido y bloquear autores.</p><p><a href="privacy.html" target="_blank" rel="noopener noreferrer">Política de privacidad</a></p><label class="report-reason-option"><input type="checkbox" data-accept-terms> He leído y acepto estas normas.</label><p data-moderation-error role="alert"></p><div class="report-actions"><button type="button" data-cancel>Cancelar</button><button type="button" data-confirm disabled>Continuar</button></div>');
            let completed = false;
            const finish = value => { if (!completed) { completed = true; close(); resolve(value); } };
            overlay.addEventListener('moderation-dialog-closed', () => finish(false));
            overlay.querySelector('[data-cancel]').addEventListener('click', () => finish(false));
            overlay.querySelector('.close-report-btn').addEventListener('click', () => finish(false));
            overlay.addEventListener('keydown', event => { if (event.key === 'Escape') finish(false); });
            const confirmButton = overlay.querySelector('[data-confirm]');
            overlay.querySelector('[data-accept-terms]').addEventListener('change', event => { confirmButton.disabled = !event.target.checked; });
            confirmButton.addEventListener('click', async () => {
                confirmButton.disabled = true;
                try {
                    await this.call('acceptCommunityTerms', { version: this.termsVersion, accepted: true });
                    try { localStorage.setItem(key, this.termsVersion); } catch { /* Acceptance also exists on the server. */ }
                    finish(true);
                } catch {
                    overlay.querySelector('[data-moderation-error]').textContent = 'No se pudo registrar la aceptación. Inténtalo de nuevo con conexión.';
                    confirmButton.disabled = false;
                }
            });
        });
        try { return await this.termsPromise; } finally { this.termsPromise = null; }
    }

    async refresh({ post = [], reply = [], prayer = [] } = {}) {
        const uid = window.app?.currentUser?.uid;
        const key = `su-voz-community-hidden-${uid}`;
        if (!navigator.onLine) {
            try { this.hidden = JSON.parse(localStorage.getItem(key)) || this.hidden; } catch { /* Keep current cache. */ }
            return;
        }
        const inputs = { post, reply, prayer };
        const nextHidden = { post: {}, reply: {}, prayer: {} };
        const pages = Math.max(1, ...Object.values(inputs).map(items => Math.ceil(items.length / 50)));
        for (let page = 0; page < pages; page++) {
            const data = Object.fromEntries(Object.entries(inputs).map(([type, items]) => [type, [...new Set(items.map(item => item.id))].slice(page * 50, (page + 1) * 50)]));
            const state = await this.call('getCommunitySafetyState', data);
            if (window.app?.currentUser?.uid !== uid) return;
            for (const type of Object.keys(nextHidden)) Object.assign(nextHidden[type], state.hidden?.[type] || {});
            this.blocked = state.blocked || [];
            this.isModerator = state.moderator === true;
        }
        this.hidden = nextHidden;
        try { localStorage.setItem(key, JSON.stringify(nextHidden)); } catch { /* Offline cache is optional. */ }
    }

    isVisible(item, type) {
        if (!item || item.moderationStatus === 'hidden' || this.hidden?.[type]?.[item.id] === true) return false;
        try {
            const legacy = JSON.parse(localStorage.getItem('su-voz-blocked-users') || '[]');
            return !Array.isArray(legacy) || !legacy.includes(item.ownerUid);
        } catch { return true; }
    }

    showReportDialog(target) {
        if (typeof target === 'string') target = { type: 'post', id: target };
        const { overlay, close } = this.openDialog('Denunciar contenido', `<div class="report-reasons">${reportReasons.map(reason => `<label class="report-reason-option"><input type="radio" name="reportReason" value="${this.escapeHtml(reason)}"><span>${this.escapeHtml(reason)}</span></label>`).join('')}</div><label>Comentarios adicionales<textarea class="report-comments-input" maxlength="500" rows="3"></textarea></label><p data-moderation-error role="alert"></p><div class="report-actions"><button type="button" data-cancel>Cancelar</button><button type="button" data-submit disabled>Enviar denuncia</button></div>`);
        overlay.querySelector('[data-cancel]').addEventListener('click', close);
        const submit = overlay.querySelector('[data-submit]');
        overlay.querySelectorAll('input[name="reportReason"]').forEach(radio => radio.addEventListener('change', () => { submit.disabled = false; }));
        submit.addEventListener('click', async () => {
            submit.disabled = true;
            try {
                const result = await this.call('reportCommunityContent', { ...target,
                    reason: overlay.querySelector('input[name="reportReason"]:checked').value,
                    comments: overlay.querySelector('textarea').value.trim(),
                });
                close();
                window.app.showToast(`Denuncia recibida. Referencia: ${result.reference}`, 7000);
            } catch {
                overlay.querySelector('[data-moderation-error]').textContent = 'No se pudo enviar. La denuncia no ha sido registrada; puedes reintentar.';
                submit.disabled = false;
            }
        });
    }

    async blockAuthor(target) {
        if (!confirm('¿Bloquear a este autor? Dejarás de ver sus publicaciones y respuestas. Puedes deshacerlo en Autores bloqueados.')) return;
        await this.call('blockCommunityAuthor', target);
        window.app.showToast('Autor bloqueado.');
        if (window.app.currentView === 'community-thread') window.app.navigate('community');
        else await window.app.renderCommunity({ showSkeleton: false });
    }

    async showBlockedAuthors() {
        await this.refresh();
        const { overlay } = this.openDialog('Autores bloqueados', `<div class="moderation-list">${this.blocked.length ? this.blocked.map((item, index) => `<div class="moderation-row"><span>Autor bloqueado ${index + 1}</span><button type="button" data-unblock="${this.escapeHtml(item.key)}">Desbloquear</button></div>`).join('') : '<p>No hay autores bloqueados.</p>'}</div><p data-moderation-error role="alert"></p>`);
        overlay.querySelectorAll('[data-unblock]').forEach(button => button.addEventListener('click', async () => {
            button.disabled = true;
            try {
                await this.call('unblockCommunityAuthor', { key: button.dataset.unblock });
                button.closest('.moderation-row').remove();
                window.app.showToast('Autor desbloqueado.');
                await window.app.renderCommunity({ showSkeleton: false });
            } catch {
                button.disabled = false;
                overlay.querySelector('[data-moderation-error]').textContent = 'No se pudo desbloquear. Inténtalo nuevamente.';
            }
        }));
    }

    async showModerationQueue(status = 'pending') {
        if (status === 'accounts') {
            const result = await this.call('listAccountDeletionRequests', {});
            const { overlay } = this.openDialog('Solicitudes de eliminación', `<div class="report-actions"><button type="button" data-back-reports>Denuncias</button></div><div class="moderation-list">${result.requests?.length ? result.requests.map(item => `<article class="moderation-report"><strong>${this.escapeHtml(item.email || 'Identidad sin correo verificado')}</strong><p>Referencia: ${this.escapeHtml(item.reference.slice(0, 12))}</p><p>Revisar y tramitar la eliminación con el procedimiento privado de operación.</p></article>`).join('') : '<p>No hay solicitudes pendientes.</p>'}</div>`);
            overlay.querySelector('[data-back-reports]').addEventListener('click', () => this.showModerationQueue().catch(error => window.app.showToast(error.message)));
            return;
        }
        const result = await this.call('listCommunityReports', { status });
        const { overlay } = this.openDialog('Moderación', `<div class="report-actions"><button type="button" data-queue="pending" ${status === 'pending' ? 'disabled' : ''}>Pendientes</button><button type="button" data-queue="resolved" ${status === 'resolved' ? 'disabled' : ''}>Revisadas</button></div><div class="moderation-list">${result.reports?.length ? result.reports.map(item => `<article class="moderation-report"><strong>${this.escapeHtml(item.reason)}</strong><p>${this.escapeHtml(item.contentText)}</p><p>${this.escapeHtml(item.comments)}</p><small>Referencia: ${this.escapeHtml(item.reference.slice(0, 12))}</small><div class="report-actions">${status === 'pending' ? `<button type="button" data-resolve="dismiss" data-reference="${item.reference}">Sin infracción</button><button type="button" data-resolve="hide" data-reference="${item.reference}">Retirar de Comunidad</button>` : item.decision === 'hide' ? `<button type="button" data-resolve="restore" data-reference="${item.reference}">Restaurar contenido</button>` : '<span>Revisada</span>'}</div></article>`).join('') : '<p>No hay denuncias en esta lista.</p>'}</div><p data-moderation-error role="alert"></p>`);
        const accountsButton = document.createElement('button');
        accountsButton.type = 'button';
        accountsButton.dataset.queue = 'accounts';
        accountsButton.textContent = 'Solicitudes de cuenta';
        overlay.querySelector('.report-actions').appendChild(accountsButton);
        overlay.querySelectorAll('[data-queue]').forEach(button => button.addEventListener('click', () => this.showModerationQueue(button.dataset.queue).catch(error => window.app.showToast(error.message))));
        overlay.querySelectorAll('[data-resolve]').forEach(button => button.addEventListener('click', async () => {
            if (!confirm('¿Confirmar esta decisión de moderación?')) return;
            const row = button.closest('.moderation-report');
            row.querySelectorAll('button').forEach(control => { control.disabled = true; });
            try {
                await this.call('resolveCommunityReport', { reference: button.dataset.reference, decision: button.dataset.resolve });
                row.remove();
                window.app.invalidateCommunityCache();
                window.app.resetCommunityPrayerState();
                window.app.resetCommunityPrayerTestimonyState();
                await window.app.renderCommunity({ forceRefresh: true, showSkeleton: false });
            } catch {
                row.querySelectorAll('button').forEach(control => { control.disabled = false; });
                overlay.querySelector('[data-moderation-error]').textContent = 'No se pudo guardar la decisión.';
            }
        }));
    }
}

if (typeof window !== 'undefined') window.ModerationSystem = ModerationSystem;
