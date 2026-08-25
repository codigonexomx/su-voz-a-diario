/**
 * AccessibilityManager - Accesibilidad (WCAG AA), ARIA, Focus Trap y Atajos de Teclado
 * Su Voz a Diario - Módulo 10
 */

class AccessibilityManager {
    constructor() {
        this.focusableSelector = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    }

    applyARIA(container = document) {
        container.querySelectorAll('.icon-btn, [data-action]').forEach(btn => {
            if (!btn.getAttribute('aria-label') && !btn.textContent.trim()) {
                const title = btn.getAttribute('title') || 'Acción';
                btn.setAttribute('aria-label', title);
            }
        });

        container.querySelectorAll('.toggle-btn, [aria-expanded]').forEach(btn => {
            if (!btn.hasAttribute('aria-expanded')) {
                btn.setAttribute('aria-expanded', 'false');
            }
        });

        container.querySelectorAll('.modal, .report-dialog, .verse-picker-dialog').forEach(modal => {
            if (!modal.hasAttribute('role')) {
                modal.setAttribute('role', 'dialog');
                modal.setAttribute('aria-modal', 'true');
            }
        });
    }

    handleKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter para publicar en el editor de la comunidad
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const publishBtn = document.querySelector('[data-action="publish-community-reflection"]');
                if (publishBtn && document.activeElement && (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) {
                    e.preventDefault();
                    publishBtn.click();
                }
            }

            // Tecla Esc para cerrar cualquier modal abierto
            if (e.key === 'Escape') {
                const openModals = document.querySelectorAll('.modal.open, .report-overlay, .verse-picker-overlay');
                if (openModals.length > 0) {
                    e.preventDefault();
                    openModals.forEach(m => m.remove());
                }
            }
        });
    }

    trapFocus(modalElement) {
        if (!modalElement) return;

        const focusables = Array.from(modalElement.querySelectorAll(this.focusableSelector));
        if (!focusables.length) return;

        const firstFocusable = focusables[0];
        const lastFocusable = focusables[focusables.length - 1];

        firstFocusable.focus();

        const keyHandler = (e) => {
            if (e.key !== 'Tab') return;

            if (e.shiftKey) {
                if (document.activeElement === firstFocusable) {
                    e.preventDefault();
                    lastFocusable.focus();
                }
            } else {
                if (document.activeElement === lastFocusable) {
                    e.preventDefault();
                    firstFocusable.focus();
                }
            }
        };

        modalElement.addEventListener('keydown', keyHandler);
    }

    hexToRgb(hex) {
        const clean = hex.replace('#', '');
        const bigint = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
        return {
            r: (bigint >> 16) & 255,
            g: (bigint >> 8) & 255,
            b: bigint & 255
        };
    }

    checkContrast(foregroundHex, backgroundHex) {
        try {
            const getLuminance = (rgb) => {
                const a = [rgb.r, rgb.g, rgb.b].map(v => {
                    v /= 255;
                    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
                });
                return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
            };

            const fgLum = getLuminance(this.hexToRgb(foregroundHex));
            const bgLum = getLuminance(this.hexToRgb(backgroundHex));

            const ratio = (Math.max(fgLum, bgLum) + 0.05) / (Math.min(fgLum, bgLum) + 0.05);
            return ratio >= 4.5; // Estándar WCAG AA para texto normal
        } catch (e) {
            return true;
        }
    }
}

if (typeof window !== 'undefined') {
    window.AccessibilityManager = AccessibilityManager;
}
