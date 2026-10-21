export function normalizeBibleVoiceText(value) {
    return String(value || '')
        .replace(/\[\[REF:[fc]:[^\]]+\]\]/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\s+([,.;:!?])/g, '$1')
        .trim();
}

function studyFreeText(fragment) {
    fragment.querySelectorAll('button, .verse-number, .bible-crossref-markers, .verse-note-icon').forEach(node => node.remove());
    return normalizeBibleVoiceText(fragment.textContent);
}

export function getBibleVoicePoint(range, verse) {
    const text = verse?.querySelector('.verse-text');
    const node = range?.startContainer;
    if (!text || !node || !text.contains(node)) return null;
    const element = node.nodeType === 1 ? node : node.parentElement;
    if (element?.closest('button, .bible-crossref-markers')) return null;
    let remaining;
    try {
        const tail = text.ownerDocument.createRange();
        tail.selectNodeContents(text);
        tail.setStart(node, range.startOffset);
        remaining = studyFreeText(tail.cloneContents());
    } catch {
        // A chapter/version render can invalidate the browser's previous range.
        return null;
    }
    const full = normalizeBibleVoiceText(verse.getAttribute('data-verse-text') || text.textContent);
    if (!remaining || !full.endsWith(remaining)) return null;
    let offset = full.length - remaining.length;
    // A caret in the middle of a word starts at that word, not a spoken fragment.
    while (offset > 0 && /\S/.test(full[offset]) && /\S/.test(full[offset - 1])) offset--;
    return { verseNumber: Number(verse.getAttribute('data-verse-number')), offset,
        readingKey: verse.closest('.reading-text-shell')?.getAttribute('data-reading-date') };
}

export function getBibleCaretPoint(event, verse) {
    if (!Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return null;
    const doc = verse?.ownerDocument;
    if (!doc) return null;
    try {
        let range;
        const caret = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
        if (caret) {
            range = doc.createRange();
            range.setStart(caret.offsetNode, caret.offset);
        } else {
            range = doc.caretRangeFromPoint?.(event.clientX, event.clientY);
        }
        return getBibleVoicePoint(range, verse);
    } catch {
        return null;
    }
}
