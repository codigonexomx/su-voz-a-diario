/**
 * KeyboardViewportManager
 * Fuente unica de verdad para viewport visible, baseline y estado de teclado.
 */
(function() {
    const KEYBOARD_REDUCTION_RATIO = 0.18;
    const MIN_KEYBOARD_REDUCTION = 120;
    const CSS_VISIBLE_HEIGHT_VAR = '--visible-viewport-height';
    const CHANGE_EVENT = 'suvoz:keyboard-viewport-change';
    const TEXT_INPUT_TYPES = /^(text|search|url|email|tel|password|number|date|time|datetime-local|month|week)$/i;

    let initialized = false;
    let rafId = null;
    let stabilizationTimer = null;
    let baselines = {};
    const subscribers = new Set();
    const listenerRemovers = [];
    let state = createState();

    function isEditableElement(element) {
        if (!element || element.disabled || element.readOnly) return false;
        if (element.isContentEditable) return true;
        if (element instanceof HTMLTextAreaElement) return true;
        if (!(element instanceof HTMLInputElement)) return false;
        return TEXT_INPUT_TYPES.test(element.type || 'text');
    }

    function getViewportSize() {
        const visualViewport = window.visualViewport;
        const width = Number(visualViewport?.width || window.innerWidth || document.documentElement.clientWidth || 0);
        const height = Number(visualViewport?.height || window.innerHeight || document.documentElement.clientHeight || 0);
        return { width, height };
    }

    function getOrientationKey() {
        const { width, height } = getViewportSize();
        return width > height ? 'landscape' : 'portrait';
    }

    function getVisibleHeight() {
        return Number(
            window.visualViewport?.height
            || window.innerHeight
            || document.documentElement.clientHeight
            || 0
        );
    }

    function getVirtualKeyboardHeight() {
        return Number(navigator.virtualKeyboard?.boundingRect?.height || 0);
    }

    function getThreshold(baselineHeight, visibleHeight) {
        return Math.max(
            MIN_KEYBOARD_REDUCTION,
            (Number(baselineHeight) || Number(visibleHeight) || 0) * KEYBOARD_REDUCTION_RATIO
        );
    }

    function createState(overrides = {}) {
        const visibleHeight = Number(overrides.visibleHeight || 0);
        const baselineHeight = Number(overrides.baselineHeight || visibleHeight || 0);
        return {
            isKeyboardOpen: false,
            visibleHeight,
            baselineHeight,
            heightReduction: 0,
            threshold: getThreshold(baselineHeight, visibleHeight),
            hasKeyboardFocus: false,
            orientation: 'portrait',
            virtualKeyboardHeight: 0,
            ...overrides
        };
    }

    function resolveState({
        hasKeyboardFocus,
        visibleHeight,
        baselineHeight,
        orientation,
        virtualKeyboardHeight
    }) {
        const safeVisibleHeight = Math.max(0, Number(visibleHeight) || 0);
        const safeBaselineHeight = Math.max(safeVisibleHeight, Number(baselineHeight) || 0);
        const heightReduction = hasKeyboardFocus
            ? Math.max(0, safeBaselineHeight - safeVisibleHeight)
            : 0;
        const threshold = getThreshold(safeBaselineHeight, safeVisibleHeight);
        const isKeyboardOpen = Boolean(
            hasKeyboardFocus &&
            (Number(virtualKeyboardHeight) > 0 || heightReduction > threshold)
        );

        return createState({
            isKeyboardOpen,
            visibleHeight: safeVisibleHeight,
            baselineHeight: safeBaselineHeight,
            heightReduction,
            threshold,
            hasKeyboardFocus,
            orientation,
            virtualKeyboardHeight
        });
    }

    function publishVisibleHeight(visibleHeight) {
        if (visibleHeight > 0) {
            document.documentElement.style.setProperty(CSS_VISIBLE_HEIGHT_VAR, `${Math.round(visibleHeight)}px`);
        }
    }

    function notify() {
        publishVisibleHeight(state.visibleHeight);
        const detail = { ...state };
        subscribers.forEach(callback => callback(detail));
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail }));
    }

    function setState(nextState) {
        const changed = [
            'isKeyboardOpen',
            'visibleHeight',
            'baselineHeight',
            'orientation',
            'hasKeyboardFocus',
            'heightReduction',
            'virtualKeyboardHeight'
        ].some(key => state[key] !== nextState[key]);

        state = nextState;
        publishVisibleHeight(state.visibleHeight);
        if (changed) {
            notify();
        }
        return state;
    }

    function measure(options = {}) {
        const activeElement = document.activeElement;
        const hasKeyboardFocus = isEditableElement(activeElement);
        const visibleHeight = getVisibleHeight();
        const orientation = getOrientationKey();
        const virtualKeyboardHeight = getVirtualKeyboardHeight();
        const previousBaseline = baselines[orientation] || 0;

        if (!hasKeyboardFocus && visibleHeight > 0) {
            baselines[orientation] = options.forceBaseline
                ? visibleHeight
                : Math.max(previousBaseline, visibleHeight);
        }

        if (hasKeyboardFocus && !baselines[orientation] && visibleHeight > 0) {
            baselines[orientation] = Math.max(visibleHeight, window.innerHeight || 0);
        }

        const baselineHeight = baselines[orientation] || visibleHeight;
        return setState(resolveState({
            hasKeyboardFocus,
            visibleHeight,
            baselineHeight,
            orientation,
            virtualKeyboardHeight
        }));
    }

    function refresh(options = {}) {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
        }

        rafId = requestAnimationFrame(() => {
            rafId = null;
            measure(options);
        });
    }

    function refreshAfterStabilization(options = {}) {
        clearTimeout(stabilizationTimer);
        refresh(options);
        stabilizationTimer = setTimeout(() => {
            stabilizationTimer = null;
            refresh(options);
        }, 180);
    }

    function addListener(target, type, handler, options) {
        if (!target?.addEventListener) return;
        target.addEventListener(type, handler, options);
        listenerRemovers.push(() => target.removeEventListener(type, handler, options));
    }

    function bindListeners() {
        const update = () => refresh();
        const stabilize = () => refreshAfterStabilization({ forceBaseline: !isEditableElement(document.activeElement) });
        const updateAfterFocusOut = () => refreshAfterStabilization();
        const handleVisibilityChange = () => {
            if (!document.hidden) stabilize();
        };

        addListener(window.visualViewport, 'resize', update);
        addListener(window.visualViewport, 'scroll', update);
        addListener(window, 'resize', update);
        addListener(window, 'orientationchange', stabilize);
        addListener(window, 'pageshow', stabilize);
        addListener(document, 'visibilitychange', handleVisibilityChange);
        addListener(document, 'focusin', update);
        addListener(document, 'focusout', updateAfterFocusOut);
        addListener(navigator.virtualKeyboard, 'geometrychange', update);
    }

    function init() {
        if (initialized) return state;
        initialized = true;
        bindListeners();
        measure({ forceBaseline: true });
        return state;
    }

    function subscribe(callback) {
        init();
        if (typeof callback !== 'function') return () => {};
        subscribers.add(callback);
        callback({ ...state });
        return () => {
            subscribers.delete(callback);
        };
    }

    function getState() {
        init();
        return { ...state };
    }

    function destroy() {
        listenerRemovers.splice(0).forEach(remove => remove());
        subscribers.clear();
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        clearTimeout(stabilizationTimer);
        stabilizationTimer = null;
        initialized = false;
        baselines = {};
    }

    window.KeyboardViewportManager = {
        init,
        subscribe,
        getState,
        refresh,
        destroy,
        isEditableElement,
        CSS_VISIBLE_HEIGHT_VAR,
        CHANGE_EVENT,
        KEYBOARD_REDUCTION_RATIO,
        MIN_KEYBOARD_REDUCTION
    };
})();
