/**
 * ToastManager - Sistema de Toasts y Feedback Visual Mejorado
 * Su Voz a Diario - Fase 2
 */
class ToastManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        if (typeof document === 'undefined') return;
        let el = document.querySelector('.toast-container-custom');
        if (!el) {
            el = document.createElement('div');
            el.className = 'toast-container-custom';
            document.body.appendChild(el);
        }
        this.container = el;
    }

    showToast(message, type = 'success') {
        if (!this.container) this.init();

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${this.getIcon(type)}</span>
            <span class="toast-message">${this.escapeHtml(message)}</span>
            <button type="button" class="toast-close" aria-label="Cerrar aviso">×</button>
        `;

        if (this.container) {
            this.container.appendChild(toast);
        } else {
            document.body.appendChild(toast);
        }

        const closeBtn = toast.querySelector('.toast-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                toast.classList.remove('visible');
                setTimeout(() => toast.remove(), 300);
            });
        }

        requestAnimationFrame(() => toast.classList.add('visible'));

        setTimeout(() => {
            if (toast.parentNode) {
                toast.classList.remove('visible');
                setTimeout(() => toast.remove(), 300);
            }
        }, 3500);
    }

    getIcon(type) {
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };
        return icons[type] || icons.info;
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

if (typeof window !== 'undefined') {
    window.ToastManager = ToastManager;
    document.addEventListener('DOMContentLoaded', () => {
        window.toastManager = new ToastManager();
    });
}
