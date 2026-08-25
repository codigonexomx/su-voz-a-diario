/**
 * ModerationSystem - Sistema de Moderación, Reportes y Auto-Moderación
 * Su Voz a Diario - Módulo 6
 */

const reportReasons = [
    'Contenido inapropiado',
    'Spam o promoción',
    'Contenido ofensivo',
    'Información engañosa',
    'Acoso o bullying',
    'Otro motivo'
];

class AutoModeration {
    constructor() {
        this.offensiveWords = [
            'insulto', 'garabato', 'ofensa', 'groseria', 'estupido',
            'idiota', 'imbecil', 'maldicion', 'basura', 'odio'
        ];
    }

    checkContent(text) {
        if (!text || typeof text !== 'string') return { isApproved: true };

        const lowerText = text.toLowerCase();
        const foundWords = this.offensiveWords.filter(word => 
            lowerText.includes(word)
        );

        if (foundWords.length > 0) {
            return {
                isApproved: false,
                reason: 'Tu publicación contiene palabras potencialmente ofensivas. Mantengamos un lenguaje edificante.'
            };
        }

        return { isApproved: true };
    }

    async checkSpam(userId) {
        if (!userId) return true;

        const db = window.firebaseDb;
        const fns = window.firebaseFns;
        if (!db || !fns?.getDocs || !fns?.query) return true;

        try {
            const oneHourAgo = new Date(Date.now() - 3600000);
            const q = fns.query(
                fns.collection(db, 'communityPosts'),
                fns.where('ownerUid', '==', userId),
                fns.where('createdAt', '>=', oneHourAgo)
            );
            const snapshot = await fns.getDocs(q);

            if (snapshot.size >= 5) {
                return false; // Excede límite de 5 publicaciones por hora
            }
        } catch (e) {
            console.warn('[Moderation] No se pudo verificar límite de spam:', e);
        }

        return true;
    }
}

class ModerationSystem {
    constructor() {
        this.autoModeration = new AutoModeration();
    }

    showReportDialog(postId, postContent = '') {
        const overlay = document.createElement('div');
        overlay.className = 'report-overlay modal open';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');

        overlay.innerHTML = `
            <div class="report-dialog">
                <div class="report-header">
                    <h3>🚩 Reportar contenido</h3>
                    <button type="button" class="close-report-btn" aria-label="Cerrar">✕</button>
                </div>
                <p>¿Por qué consideras que este contenido no respeta las normas de la comunidad?</p>
                
                <div class="report-reasons">
                    ${reportReasons.map((reason, idx) => `
                        <label class="report-reason-option">
                            <input type="radio" name="reportReason" value="${this.escapeHtml(reason)}" id="reason_${idx}" />
                            <span>${this.escapeHtml(reason)}</span>
                        </label>
                    `).join('')}
                </div>

                <div class="report-comments-group">
                    <textarea class="report-comments-input" placeholder="Comentarios adicionales (opcional)" maxlength="500"></textarea>
                </div>

                <div class="report-actions">
                    <button type="button" class="btn-secondary cancel-report-btn">Cancelar</button>
                    <button type="button" class="btn-primary submit-report-btn" disabled>Enviar reporte</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        const radios = overlay.querySelectorAll('input[name="reportReason"]');
        const submitBtn = overlay.querySelector('.submit-report-btn');
        const cancelBtn = overlay.querySelector('.cancel-report-btn');
        const closeBtn = overlay.querySelector('.close-report-btn');

        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                submitBtn.disabled = false;
            });
        });

        const closeDialog = () => overlay.remove();
        cancelBtn.addEventListener('click', closeDialog);
        closeBtn.addEventListener('click', closeDialog);

        submitBtn.addEventListener('click', async () => {
            const selectedReason = overlay.querySelector('input[name="reportReason"]:checked')?.value;
            const comments = overlay.querySelector('.report-comments-input')?.value || '';

            if (selectedReason) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Enviando...';
                await this.submitReport(postId, selectedReason, comments);
                closeDialog();
            }
        });
    }

    async submitReport(postId, reason, comments = '') {
        const currentUser = window.app?.currentUser;
        if (!currentUser?.uid) {
            if (window.app?.showToast) window.app.showToast('Inicia sesión para reportar');
            return;
        }

        const db = window.firebaseDb;
        const fns = window.firebaseFns;

        try {
            if (db && fns?.addDoc && fns?.collection) {
                await fns.addDoc(fns.collection(db, 'communityReports'), {
                    postId: postId,
                    reportedBy: currentUser.uid,
                    reason: reason,
                    comments: comments.trim().substring(0, 500),
                    status: 'pending',
                    createdAt: fns.serverTimestamp()
                });
            }

            if (window.app?.showToast) {
                window.app.showToast('Gracias por tu reporte. El contenido será revisado.');
            }
        } catch (error) {
            console.error('[Moderation] Error guardando reporte:', error);
            if (window.app?.showToast) {
                window.app.showToast('No se pudo enviar el reporte.');
            }
        }
    }

    blockUser(targetUid) {
        if (!targetUid) return;
        const blockedKey = 'su-voz-blocked-users';
        try {
            const current = JSON.parse(localStorage.getItem(blockedKey) || '[]');
            if (!current.includes(targetUid)) {
                current.push(targetUid);
                localStorage.setItem(blockedKey, JSON.stringify(current));
            }
            if (window.app?.showToast) {
                window.app.showToast('Usuario bloqueado localmente.');
            }
            if (window.app?.renderCommunity) {
                window.app.renderCommunity();
            }
        } catch (e) {
            console.error('[Moderation] Error al bloquear usuario:', e);
        }
    }

    getBlockedUsers() {
        try {
            return JSON.parse(localStorage.getItem('su-voz-blocked-users') || '[]');
        } catch (e) {
            return [];
        }
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
}

if (typeof window !== 'undefined') {
    window.AutoModeration = AutoModeration;
    window.ModerationSystem = ModerationSystem;
}
