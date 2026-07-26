import { MeditationLibrary } from './MeditationLibrary.js';

/**
 * Responsabilidad: Construye el modelo visual de la línea de tiempo. Renderiza el HTML de la línea de tiempo.
 * Dependencias: MeditationLibrary.
 * API pública: buildTimelineModel, renderTimeline
 * Restricciones: No debe leer el DOM ni localStorage. (NOTA: renderTimeline() es temporal y será extraído en la Etapa 12D).
 */

export const MeditationTimeline = {
    getRelativeTime: function(timestamp) {
        const now = Date.now();
        const diffMs = now - timestamp;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'hace unas horas';
        if (diffDays === 1) return 'ayer';
        if (diffDays < 7) return `hace ${diffDays} días`;
        if (diffDays < 30) {
            const weeks = Math.floor(diffDays / 7);
            return `hace ${weeks} semana${weeks > 1 ? 's' : ''}`;
        }
        if (diffDays < 365) {
            const months = Math.floor(diffDays / 30);
            return `hace ${months} mes${months > 1 ? 'es' : ''}`;
        }
        const years = Math.floor(diffDays / 365);
        return `hace ${years} año${years > 1 ? 's' : ''}`;
    },

    categorizeDate: function(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        const lastWeekStart = new Date(thisWeekStart);
        lastWeekStart.setDate(lastWeekStart.getDate() - 7);
        
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const thisYearStart = new Date(now.getFullYear(), 0, 1);
        
        if (date >= today) return 'today';
        if (date >= yesterday) return 'yesterday';
        if (date >= thisWeekStart) return 'this-week';
        if (date >= lastWeekStart) return 'last-week';
        if (date >= thisMonthStart) return 'this-month';
        if (date >= thisYearStart) return 'previous-months';
        return 'previous-years';
    },
    
    getGroupLabel: function(categoryId, firstSessionInGroup) {
        switch(categoryId) {
            case 'today': return 'Hoy';
            case 'yesterday': return 'Ayer';
            case 'this-week': return 'Esta semana';
            case 'last-week': return 'La semana pasada';
            case 'this-month': return 'Este mes';
            case 'previous-months': {
                if (!firstSessionInGroup) return 'Meses anteriores';
                const d = new Date(firstSessionInGroup.updatedAt);
                return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            }
            case 'previous-years': {
                if (!firstSessionInGroup) return 'Años anteriores';
                const d = new Date(firstSessionInGroup.updatedAt);
                return d.getFullYear().toString();
            }
            default: return 'Anteriormente';
        }
    },

    buildTimelineModel: function() {
        const sessions = MeditationLibrary.getAll();
        
        const sortedSessions = MeditationLibrary.sort(sessions, 'updated-desc');
        
        const groupsMap = new Map();
        
        sortedSessions.forEach(session => {
            let cat = this.categorizeDate(session.updatedAt || session.createdAt);
            
            if (cat === 'previous-months') {
                const d = new Date(session.updatedAt || session.createdAt);
                cat = `month-${d.getFullYear()}-${d.getMonth()}`;
            } else if (cat === 'previous-years') {
                const d = new Date(session.updatedAt || session.createdAt);
                cat = `year-${d.getFullYear()}`;
            }
            
            if (!groupsMap.has(cat)) {
                groupsMap.set(cat, {
                    id: cat,
                    sessions: [],
                    stats: { total: 0, completed: 0, drafts: 0 }
                });
            }
            
            const group = groupsMap.get(cat);
            group.sessions.push(session);
            group.stats.total++;
            if (session.status === 'completed') group.stats.completed++;
            if (session.status === 'draft') group.stats.drafts++;
        });
        
        const groupsList = Array.from(groupsMap.values());
        groupsList.forEach(g => {
            g.label = this.getGroupLabel(g.id.startsWith('month') ? 'previous-months' : (g.id.startsWith('year') ? 'previous-years' : g.id), g.sessions[0]);
        });
        
        return groupsList;
    },

    renderTimeline: function(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const groups = this.buildTimelineModel();
        
        if (groups.length === 0) {
            container.innerHTML = `<div class="empty-state">No hay meditaciones registradas en tu línea de tiempo.</div>`;
            return;
        }
        
        let html = '<div class="timeline-container">';
        
        groups.forEach(group => {
            html += `
                <div class="timeline-group">
                    <div class="timeline-group-header">
                        <h3 class="timeline-group-title">${group.label}</h3>
                        <div class="timeline-group-stats">
                            <span>${group.stats.total} meditaciones</span>
                            ${group.stats.completed > 0 ? `<span class="stat-completed">• ${group.stats.completed} completadas</span>` : ''}
                            ${group.stats.drafts > 0 ? `<span class="stat-draft">• ${group.stats.drafts} en curso</span>` : ''}
                        </div>
                    </div>
                    <div class="timeline-events">
            `;
            
            group.sessions.forEach(session => {
                const relativeTime = this.getRelativeTime(session.updatedAt || session.createdAt);
                const isCompleted = session.status === 'completed';
                
                html += `
                    <div class="timeline-card-wrapper">
                        <div class="timeline-marker ${isCompleted ? 'marker-completed' : 'marker-draft'}"></div>
                        <div class="timeline-card" tabindex="0" role="button" data-action="open-library-session" data-reading-id="${session.readingId}">
                            <div class="timeline-card-header">
                                <h4 class="timeline-card-title">${session.title}</h4>
                                <span class="timeline-card-time">${relativeTime}</span>
                            </div>
                            <div class="timeline-card-meta">
                                <span class="timeline-card-version">${session.bibleVersion.toUpperCase()}</span>
                                <span class="timeline-card-status ${isCompleted ? 'status-completed' : 'status-draft'}">
                                    ${isCompleted ? '✅ Completada' : '✍️ En curso'}
                                </span>
                            </div>
                            ${session.snippet ? `<div class="timeline-card-snippet">${session.snippet}</div>` : ''}
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        html += '</div>';
        container.innerHTML = html;
    }
};
