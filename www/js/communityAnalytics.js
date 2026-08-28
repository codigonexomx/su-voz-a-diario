/**
 * CommunityAnalytics - Tracking de eventos y métricas de analítica
 * Su Voz a Diario - Fase 2
 */
class CommunityAnalytics {
    trackEvent(eventName, params = {}) {
        if (typeof firebase !== 'undefined' && firebase.analytics) {
            try {
                firebase.analytics().logEvent(eventName, params);
            } catch (e) {
                console.warn('[Analytics] Error registrando evento:', eventName, e);
            }
        } else {
            console.log(`[Analytics Log] Event: ${eventName}`, params);
        }
    }

    trackPostCreated(postData = {}) {
        this.trackEvent('post_created', {
            post_id: postData.id || '',
            has_audio: Boolean(postData.audioURL),
            character_count: (postData.text || '').length
        });
    }

    trackReaction(reactionType) {
        this.trackEvent('reaction_given', {
            reaction_type: reactionType
        });
    }

    trackAchievementUnlocked(achievementId) {
        this.trackEvent('achievement_unlocked', {
            achievement_id: achievementId
        });
    }
}

if (typeof window !== 'undefined') {
    window.CommunityAnalytics = CommunityAnalytics;
    window.communityAnalytics = new CommunityAnalytics();
}
