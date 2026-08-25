/**
 * UserMetrics - Sistema de Métricas del Usuario y Gamificación (Logros / Insignias)
 * Su Voz a Diario - Módulo 7
 */

const achievements = {
    firstEcho: {
        id: 'firstEcho',
        name: 'Primer Eco',
        description: 'Publica tu primera reflexión',
        icon: '🎯',
        condition: (metrics) => (metrics.postsCreated || 0) >= 1
    },
    activeParticipant: {
        id: 'activeParticipant',
        name: 'Participante Activo',
        description: 'Publica 10 reflexiones',
        icon: '📝',
        condition: (metrics) => (metrics.postsCreated || 0) >= 10
    },
    influentialVoice: {
        id: 'influentialVoice',
        name: 'Voz Influyente',
        description: 'Recibe 50 reacciones edificantes',
        icon: '💫',
        condition: (metrics) => (metrics.reactionsReceived || 0) >= 50
    },
    weekStreak: {
        id: 'weekStreak',
        name: 'Racha de 7 días',
        description: 'Mantén actividad en la comunidad por 7 días consecutivos',
        icon: '🔥',
        condition: (metrics) => (metrics.currentStreak || 0) >= 7
    },
    monthStreak: {
        id: 'monthStreak',
        name: 'Racha de 30 días',
        description: 'Mantén actividad en la comunidad por 30 días consecutivos',
        icon: '⚡',
        condition: (metrics) => (metrics.currentStreak || 0) >= 30
    },
    earlyBird: {
        id: 'earlyBird',
        name: 'Madrugador',
        description: 'Publica una reflexión antes de las 6 AM',
        icon: '🌅',
        condition: (metrics, context) => (context?.hour || new Date().getHours()) < 6
    },
    nightOwl: {
        id: 'nightOwl',
        name: 'Noche de Reflexión',
        description: 'Publica una reflexión después de las 10 PM',
        icon: '🌙',
        condition: (metrics, context) => (context?.hour || new Date().getHours()) >= 22
    }
};

class UserMetrics {
    constructor() {
        this.metrics = {
            postsCreated: 0,
            repliesMade: 0,
            reactionsGiven: 0,
            reactionsReceived: 0,
            daysActive: 0,
            currentStreak: 0,
            longestStreak: 0,
            achievements: []
        };
    }

    async loadUserMetrics(userId) {
        const uid = userId || window.app?.currentUser?.uid;
        if (!uid) return this.metrics;

        const db = window.firebaseDb;
        const fns = window.firebaseFns;

        if (db && fns?.getDoc && fns?.doc) {
            try {
                const snap = await fns.getDoc(fns.doc(db, 'userMetrics', uid));
                if (snap.exists()) {
                    this.metrics = { ...this.metrics, ...snap.data() };
                }
            } catch (e) {
                console.warn('[UserMetrics] Error leyendo métricas de Firestore:', e);
            }
        }

        return this.metrics;
    }

    renderAchievements(userMetrics = this.metrics) {
        const container = document.createElement('div');
        container.className = 'achievements-container';

        const unlocked = userMetrics.achievements || [];

        Object.values(achievements).forEach(achievement => {
            const isUnlocked = unlocked.includes(achievement.id);

            const badgeElement = document.createElement('div');
            badgeElement.className = `achievement-badge ${isUnlocked ? 'unlocked' : 'locked'}`;
            badgeElement.innerHTML = `
                <div class="badge-icon">${achievement.icon}</div>
                <div class="badge-info">
                    <div class="badge-name">${this.escapeHtml(achievement.name)}</div>
                    <div class="badge-description">${this.escapeHtml(achievement.description)}</div>
                </div>
                ${isUnlocked ? '<div class="badge-check">✓</div>' : '<div class="badge-lock">🔒</div>'}
            `;

            container.appendChild(badgeElement);
        });

        return container;
    }

    renderStreakHeader(userMetrics = this.metrics) {
        const streak = userMetrics.currentStreak || 0;
        return `
            <div class="user-streak-badge" title="Racha consecutiva de meditaciones compartidas">
                <span class="streak-icon">🔥</span>
                <span class="streak-count">${streak} días</span>
            </div>
        `;
    }

    escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }
}

if (typeof window !== 'undefined') {
    window.achievements = achievements;
    window.UserMetrics = UserMetrics;
}
