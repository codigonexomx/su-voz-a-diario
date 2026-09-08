/**
 * CommunityAnalytics - Tracking de eventos y métricas de analítica
 * Su Voz a Diario - Fase 2
 */
class CommunityAnalytics {
    trackEvent(eventName, params = {}) {
        try {
            window.SuVozAnalytics?.trackEvent?.(eventName, params);
        } catch (error) {
            console.warn('[Analytics] Error registrando evento:', eventName, error);
        }
    }

    trackPostCreated(postData = {}) {
        this.trackEvent('community_post', {
            post_type: postData.intent === 'dailyQuestionResponse' ? 'daily_question_response' : 'reflection',
            entry_point: postData.intent === 'dailyQuestionResponse' ? 'daily_question' : 'direct'
        });
    }

    trackReaction(reactionType) {
        this.trackEvent('community_reaction', {
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
