(function() {
    const PARAM = 'deepeningFocusDiagnostics';
    const STORAGE_KEY = 'suvoz.deepeningFocusDiagnostics';
    function getStorageFlag() {
        try {
            return window.localStorage?.getItem(STORAGE_KEY) === '1';
        } catch (error) {
            return false;
        }
    }

    const enabled = new URLSearchParams(window.location.search).has(PARAM)
        || getStorageFlag();

    if (!enabled || window.DeepeningFocusDiagnostics) return;

    const EVENTS = [
        'pointerdown',
        'pointerup',
        'touchstart',
        'touchend',
        'mousedown',
        'mouseup',
        'click',
        'focus',
        'blur',
        'focusin',
        'focusout',
        'selectionchange'
    ];
    const trace = [];
    const listeners = [];
    const now = () => Math.round(performance.now() * 100) / 100;
    const eventPhaseLabels = {
        0: 'none',
        1: 'capturing',
        2: 'at-target',
        3: 'bubbling'
    };
    const originalFocus = HTMLElement.prototype.focus;
    const originalBlur = HTMLElement.prototype.blur;
    const originalRemoveAllRanges = Selection.prototype.removeAllRanges;
    const innerHTMLDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    let observer = null;

    function describeElement(element) {
        if (!element) return 'none';
        if (element === document) return 'document';
        if (element === window) return 'window';
        if (element === document.body) return 'body';
        if (element === document.documentElement) return 'html';
        if (element.matches?.('[data-deepening-editor]')) {
            return `editor:${element.getAttribute('aria-label') || ''}`;
        }
        if (element.closest?.('[data-deepening-editor]')) {
            const editor = element.closest('[data-deepening-editor]');
            return `inside-editor:${editor.getAttribute('aria-label') || ''}`;
        }
        if (element.matches?.('.verse-item[data-verse-number]')) {
            return `verse:${element.getAttribute('data-verse-number')}`;
        }
        if (element.closest?.('.verse-item[data-verse-number]')) {
            const verse = element.closest('.verse-item[data-verse-number]');
            return `inside-verse:${verse.getAttribute('data-verse-number')}`;
        }
        if (element.matches?.('[data-deepening-reading-document]')) return 'ReadingDocument';
        if (element.matches?.('[data-deepening-meditation-document]')) return 'MeditationDocument';
        if (element.matches?.('.deepening-shell')) return 'DeepeningShell';

        const parts = [element.tagName?.toLowerCase() || String(element.nodeName || 'unknown')];
        if (element.id) parts.push(`#${element.id}`);
        if (typeof element.className === 'string' && element.className.trim()) {
            parts.push(`.${element.className.trim().split(/\s+/).slice(0, 3).join('.')}`);
        }
        return parts.join('');
    }

    function eventTarget(event) {
        const target = event.target;
        return target?.nodeType === Node.ELEMENT_NODE ? target : target?.parentElement;
    }

    function eventElement(value) {
        return value?.nodeType === Node.ELEMENT_NODE ? value : value?.parentElement;
    }

    function touchCount(touchList) {
        return typeof touchList?.length === 'number' ? touchList.length : null;
    }

    function selectionSummary() {
        const selection = window.getSelection?.();
        if (!selection) return null;
        const anchor = selection.anchorNode?.nodeType === Node.ELEMENT_NODE
            ? selection.anchorNode
            : selection.anchorNode?.parentElement;
        const focus = selection.focusNode?.nodeType === Node.ELEMENT_NODE
            ? selection.focusNode
            : selection.focusNode?.parentElement;
        return {
            rangeCount: selection.rangeCount,
            text: String(selection.toString() || '').slice(0, 80),
            anchor: describeElement(anchor),
            focus: describeElement(focus)
        };
    }

    function viewportSummary() {
        const vv = window.visualViewport;
        return {
            innerHeight: window.innerHeight,
            visualHeight: vv?.height || null,
            visualOffsetTop: vv?.offsetTop || null,
            visualPageTop: vv?.pageTop || null
        };
    }

    function getTrace() {
        return trace.slice();
    }

    function getReadableTrace() {
        return trace.map(entry => {
            const bits = [
                `${entry.t}ms`,
                entry.name,
                `target=${entry.target || '-'}`,
                `currentTarget=${entry.currentTarget || '-'}`,
                `active=${entry.activeElement || entry.active || '-'}`,
                `phase=${entry.eventPhaseLabel || entry.phase || '-'}`,
                `defaultPrevented=${entry.defaultPrevented}`,
                `cancelable=${entry.cancelable}`,
                entry.pointerType ? `pointerType=${entry.pointerType}` : null,
                entry.touchesLength !== null && entry.touchesLength !== undefined ? `touches=${entry.touchesLength}` : null,
                entry.changedTouchesLength !== null && entry.changedTouchesLength !== undefined ? `changedTouches=${entry.changedTouchesLength}` : null,
                entry.relatedTarget && entry.relatedTarget !== 'none' ? `relatedTarget=${entry.relatedTarget}` : null,
                entry.selection?.anchor ? `selectionAnchor=${entry.selection.anchor}` : null,
                entry.selection?.text ? `selection="${entry.selection.text}"` : null
            ].filter(Boolean);

            if (entry.stack) {
                bits.push(`stack=${entry.stack}`);
            }

            return bits.join(' | ');
        }).join('\n');
    }

    function syncTraceAttributes() {
        document.documentElement.setAttribute(
            'data-deepening-focus-trace',
            JSON.stringify(trace)
        );
        document.documentElement.setAttribute(
            'data-deepening-focus-trace-text',
            getReadableTrace()
        );
    }

    function log(name, detail = {}) {
        const entry = {
            t: now(),
            timestamp: now(),
            name,
            type: detail.type || name,
            active: describeElement(document.activeElement),
            activeElement: describeElement(document.activeElement),
            selection: selectionSummary(),
            viewport: viewportSummary(),
            ...detail
        };
        trace.push(entry);
        syncTraceAttributes();
        console.log('[DeepeningFocusDiagnostics]', entry);
        return entry;
    }

    function eventDetail(event, phase) {
        const isFocusEvent = event.type === 'focus'
            || event.type === 'blur'
            || event.type === 'focusin'
            || event.type === 'focusout';

        return {
            type: event.type,
            phase,
            eventPhase: event.eventPhase,
            eventPhaseLabel: eventPhaseLabels[event.eventPhase] || String(event.eventPhase),
            target: describeElement(eventTarget(event)),
            currentTarget: describeElement(eventElement(event.currentTarget) || event.currentTarget),
            relatedTarget: describeElement(eventElement(event.relatedTarget)),
            defaultPrevented: event.defaultPrevented,
            cancelable: event.cancelable,
            pointerType: event.pointerType || null,
            touchesLength: touchCount(event.touches),
            changedTouchesLength: touchCount(event.changedTouches),
            blurredElement: event.type === 'blur' || event.type === 'focusout'
                ? describeElement(eventTarget(event))
                : null,
            focusedElement: event.type === 'focus' || event.type === 'focusin'
                ? describeElement(eventTarget(event))
                : null,
            stack: isFocusEvent
                ? new Error().stack?.split('\n').slice(1, 7).join(' | ')
                : null
        };
    }

    function addListener(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        listeners.push(() => target.removeEventListener(type, handler, options));
    }

    function installEventListeners() {
        EVENTS.forEach(type => {
            addListener(document, type, event => {
                log(`${type}:capture`, eventDetail(event, 'capture'));
                requestAnimationFrame(() => {
                    log(`${type}:after-frame`, {
                        type: event.type,
                        phase: 'after-frame',
                        eventPhase: event.eventPhase,
                        eventPhaseLabel: eventPhaseLabels[event.eventPhase] || String(event.eventPhase),
                        target: describeElement(eventTarget(event)),
                        currentTarget: describeElement(eventElement(event.currentTarget) || event.currentTarget),
                        relatedTarget: describeElement(eventElement(event.relatedTarget)),
                        defaultPrevented: event.defaultPrevented,
                        cancelable: event.cancelable,
                        pointerType: event.pointerType || null,
                        touchesLength: touchCount(event.touches),
                        changedTouchesLength: touchCount(event.changedTouches)
                    });
                });
            }, true);

            addListener(document, type, event => {
                log(`${type}:bubble`, eventDetail(event, 'bubble'));
            }, false);
        });
    }

    function installCallHooks() {
        HTMLElement.prototype.focus = function(...args) {
            log('CALL HTMLElement.focus', {
                target: describeElement(this),
                args,
                stack: new Error().stack?.split('\n').slice(1, 5).join(' | ')
            });
            return originalFocus.apply(this, args);
        };

        HTMLElement.prototype.blur = function(...args) {
            log('CALL HTMLElement.blur', {
                target: describeElement(this),
                stack: new Error().stack?.split('\n').slice(1, 5).join(' | ')
            });
            return originalBlur.apply(this, args);
        };

        Selection.prototype.removeAllRanges = function(...args) {
            log('CALL Selection.removeAllRanges', {
                stack: new Error().stack?.split('\n').slice(1, 5).join(' | ')
            });
            return originalRemoveAllRanges.apply(this, args);
        };

        if (innerHTMLDescriptor?.set && innerHTMLDescriptor?.get) {
            Object.defineProperty(Element.prototype, 'innerHTML', {
                configurable: true,
                enumerable: innerHTMLDescriptor.enumerable,
                get: innerHTMLDescriptor.get,
                set(value) {
                    if (this.closest?.('#deepening-root') || this.id === 'deepening-root') {
                        log('SET innerHTML', {
                            target: describeElement(this),
                            valueLength: String(value || '').length,
                            stack: new Error().stack?.split('\n').slice(1, 5).join(' | ')
                        });
                    }
                    return innerHTMLDescriptor.set.call(this, value);
                }
            });
        }
    }

    function installMutationObserver() {
        observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                const target = mutation.target;
                if (!(target instanceof Element)) return;
                if (!target.closest?.('#deepening-root') && target.id !== 'deepening-root') return;
                log('MUTATION childList', {
                    target: describeElement(target),
                    added: mutation.addedNodes.length,
                    removed: mutation.removedNodes.length,
                    removedEditors: Array.from(mutation.removedNodes)
                        .filter(node => node instanceof Element)
                        .some(node => node.matches?.('[data-deepening-editor]') || node.querySelector?.('[data-deepening-editor]')),
                    removedVerses: Array.from(mutation.removedNodes)
                        .filter(node => node instanceof Element)
                        .some(node => node.matches?.('.verse-item') || node.querySelector?.('.verse-item'))
                });
            });
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    function uninstall() {
        listeners.splice(0).forEach(remove => remove());
        observer?.disconnect();
        observer = null;
        HTMLElement.prototype.focus = originalFocus;
        HTMLElement.prototype.blur = originalBlur;
        Selection.prototype.removeAllRanges = originalRemoveAllRanges;
        if (innerHTMLDescriptor) {
            Object.defineProperty(Element.prototype, 'innerHTML', innerHTMLDescriptor);
        }
        log('diagnostics:stopped');
    }

    installCallHooks();
    installEventListeners();
    installMutationObserver();
    log('diagnostics:started');

    window.getDeepeningFocusTrace = getTrace;
    window.getDeepeningFocusTraceText = getReadableTrace;

    window.DeepeningFocusDiagnostics = {
        trace,
        dump: getTrace,
        text: getReadableTrace,
        clear: () => {
            trace.length = 0;
            log('diagnostics:cleared');
        },
        stop: uninstall
    };
})();
