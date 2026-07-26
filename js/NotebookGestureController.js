/**
 * NotebookGestureController
 * Maneja los estados y gestos del Cuadernillo Flotante (Modo Profundizar).
 */
const NotebookGestureController = (function() {
    
    // Configuración
    const STATES = {
        HIDDEN: 'hidden',
        COLLAPSED: 'collapsed',
        MIDDLE: 'middle',
        EXPANDED: 'expanded'
    };

    let currentState = STATES.HIDDEN;
    let panel = null;
    let header = null;
    
    // Variables de estado del arrastre
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    let baseTranslateY = 0;

    // Altura del header (aproximado, en px)
    const HEADER_HEIGHT = 60;
    
    // Calcula los puntos de anclaje (en px desde la posición original top)
    function getSnapPoints() {
        if (!panel) return { expanded: 0, middle: 0, collapsed: 0, hidden: 0 };
        const panelRect = panel.getBoundingClientRect();
        const totalHeight = panelRect.height;
        
        return {
            expanded: 0, // En la cima máxima configurada por CSS
            middle: totalHeight * 0.55, // Baja un poco menos de la mitad
            collapsed: totalHeight - HEADER_HEIGHT, // Solo asoma el header
            hidden: totalHeight + 100 // Fuera de la pantalla completamente
        };
    }

    function init(panelElement, headerElement) {
        panel = panelElement;
        header = headerElement;

        if (!panel || !header) return;

        // Limpiar listeners previos (si se reinicializa)
        header.removeEventListener('touchstart', onTouchStart);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);

        // Atar eventos estrictamente al header
        header.addEventListener('touchstart', onTouchStart, { passive: true });
        
        // Listener transiciones (limpiar bandera)
        panel.addEventListener('transitionend', () => {
            if (!isDragging) {
                panel.style.transition = '';
            }
        });
    }

    function onTouchStart(e) {
        if (currentState === STATES.HIDDEN) return;
        
        isDragging = true;
        startY = e.touches[0].clientY;
        
        // Eliminar transición para seguir el dedo instantáneamente
        panel.style.transition = 'none';
        
        const snaps = getSnapPoints();
        baseTranslateY = snaps[currentState] || 0;

        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
    }

    function onTouchMove(e) {
        if (!isDragging) return;
        // Solo prevenir default si estamos arrastrando para evitar el pull-to-refresh
        e.preventDefault(); 
        
        const deltaY = e.touches[0].clientY - startY;
        currentY = baseTranslateY + deltaY;

        // Limitar arrastre hacia arriba (no más allá de EXPANDED = 0)
        if (currentY < 0) {
            currentY = currentY * 0.2; // resistencia de goma (muy poca)
        }

        panel.style.transform = `translateY(${currentY}px)`;
    }

    function onTouchEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);

        // Restaurar transición CSS
        panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';

        const snaps = getSnapPoints();
        
        // Determinar el estado más cercano por pura distancia
        let closestState = currentState;
        let minDistance = Infinity;

        // No podemos saltar al estado HIDDEN por arrastre. (Hidden es solo por la X)
        const allowedStates = [STATES.EXPANDED, STATES.MIDDLE, STATES.COLLAPSED];

        allowedStates.forEach(state => {
            const dist = Math.abs(currentY - snaps[state]);
            if (dist < minDistance) {
                minDistance = dist;
                closestState = state;
            }
        });

        setState(closestState);
    }

    function setState(newState, instant = false) {
        if (!panel) return;
        currentState = newState;
        const snaps = getSnapPoints();
        
        if (instant) {
            panel.style.transition = 'none';
            panel.style.transform = `translateY(${snaps[newState]}px)`;
            // Forzar reflow para que el instant tenga efecto
            panel.offsetHeight; 
            panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        } else {
            panel.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
            panel.style.transform = `translateY(${snaps[newState]}px)`;
        }
    }
    
    function show(instant = false) {
        // En Fase 2, se solicitó que al entrar al modo profundizar, arranque en MIDDLE inmediatamente
        setState(STATES.MIDDLE, instant);
    }

    function hide(instant = false) {
        setState(STATES.HIDDEN, instant);
    }

    return {
        init,
        show,
        hide,
        setState,
        STATES
    };
})();

// Exportar globalmente
window.NotebookGestureController = NotebookGestureController;
