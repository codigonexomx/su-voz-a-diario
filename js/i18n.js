/**
 * I18nManager - Internacionalización y soporte multi-idioma (ES / EN)
 * Su Voz a Diario - Módulo 11
 */

const translations = {
    es: {
        community: 'Comunidad',
        share: 'Compartir',
        reply: 'Responder',
        react: 'Reaccionar',
        report: 'Reportar',
        delete: 'Eliminar',
        edit: 'Editar',
        cancel: 'Cancelar',
        submit: 'Enviar',
        loading: 'Cargando...',
        emptyState: 'Sé el primero en compartir lo que Dios te habló',
        loadMore: 'Cargar más ecos',
        anonymous: 'Anónimo',
        reactions: {
            useful: 'Me habló',
            thanks: 'Gracias'
        },
        achievements: {
            firstEcho: 'Primer Eco',
            activeParticipant: 'Participante Activo',
            influentialVoice: 'Voz Influyente',
            weekStreak: 'Racha de 7 días',
            monthStreak: 'Racha de 30 días',
            earlyBird: 'Madrugador',
            nightOwl: 'Noche de Reflexión'
        }
    },
    en: {
        community: 'Community',
        share: 'Share',
        reply: 'Reply',
        react: 'React',
        report: 'Report',
        delete: 'Delete',
        edit: 'Edit',
        cancel: 'Cancel',
        submit: 'Submit',
        loading: 'Loading...',
        emptyState: 'Be the first to share what God spoke to you',
        loadMore: 'Load more echoes',
        anonymous: 'Anonymous',
        reactions: {
            useful: 'Spoke to me',
            thanks: 'Thanks'
        },
        achievements: {
            firstEcho: 'First Echo',
            activeParticipant: 'Active Participant',
            influentialVoice: 'Influential Voice',
            weekStreak: '7-Day Streak',
            monthStreak: '30-Day Streak',
            earlyBird: 'Early Bird',
            nightOwl: 'Night Owl'
        }
    }
};

class I18nManager {
    constructor() {
        this.currentLang = this.detectLanguage();
    }

    detectLanguage() {
        try {
            const saved = localStorage.getItem('preferredLanguage');
            if (saved && translations[saved]) {
                return saved;
            }
            const systemLang = (navigator.language || 'es').split('-')[0];
            return translations[systemLang] ? systemLang : 'es';
        } catch (e) {
            return 'es';
        }
    }

    translate(key) {
        if (!key) return '';
        const keys = key.split('.');
        let value = translations[this.currentLang];

        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return key;
            }
        }

        return typeof value === 'string' ? value : key;
    }

    setLanguage(lang) {
        if (translations[lang]) {
            this.currentLang = lang;
            try {
                localStorage.setItem('preferredLanguage', lang);
            } catch (e) {}
            this.updateUI();
        }
    }

    updateUI(container = document) {
        container.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translated = this.translate(key);
            if (translated && translated !== key) {
                if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                    element.placeholder = translated;
                } else {
                    element.textContent = translated;
                }
            }
        });
    }
}

if (typeof window !== 'undefined') {
    window.translations = translations;
    window.I18nManager = I18nManager;
}
