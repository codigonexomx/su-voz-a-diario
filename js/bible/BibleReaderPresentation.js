// Keep verse anchors intact; only existing headings create prose sections.
export function renderBibleReadingDocument(entries, bookId) {
    const verseLines = ['psa', 'pro', 'sng', 'lam'].includes(bookId);
    const blocks = [];
    let verses = [];
    const flush = () => {
        if (!verses.length) return;
        blocks.push(`<p class="bible-reading-paragraph">${verses.join(' ')}</p>`);
        verses = [];
    };
    for (const entry of entries) {
        if (entry.headingHtml) {
            flush();
            blocks.push(entry.headingHtml);
        }
        verses.push(entry.verseHtml);
    }
    flush();
    return `<div class="verse-container bible-reading-document${verseLines ? ' bible-reading-verse-lines' : ''}">${blocks.join('')}</div>`;
}

// A non-modal study panel leaves the passage and navigation available.
export function positionBibleStudyPanel(anchor, panel) {
    if (!anchor?.isConnected || !panel?.isConnected) return false;
    const viewport = window.visualViewport;
    const left = Number(viewport?.offsetLeft) || 0;
    const top = Number(viewport?.offsetTop) || 0;
    const width = Number(viewport?.width) || window.innerWidth;
    const height = Number(viewport?.height) || window.innerHeight;
    const reader = document.querySelector('.bible-reader-fixed-header')?.getBoundingClientRect();
    const nav = document.querySelector('.bottom-nav')?.getBoundingClientRect();
    const padding = 12;
    const bottom = Math.min(top + height - padding, nav?.top > top ? nav.top - padding : Infinity);
    const docked = reader && width >= 1100 && left + width - reader.right >= 320;
    const panelWidth = docked ? 296 : Math.min(480, width - padding * 2);
    const maxHeight = docked ? Math.max(120, bottom - Math.max(top + padding, reader.top))
        : Math.max(120, Math.min(height * 0.58, bottom - top - padding));
    panel.classList.add('bible-study-panel');
    panel.classList.toggle('is-docked', Boolean(docked));
    panel.classList.remove('is-above', 'is-below');
    panel.style.position = 'fixed';
    panel.style.width = `${panelWidth}px`;
    panel.style.maxHeight = `${maxHeight}px`;
    panel.style.setProperty('--bible-crossref-max-height', `${maxHeight}px`);
    panel.style.left = `${docked ? reader.right + 16 : left + (width - panelWidth) / 2}px`;
    panel.style.top = `${docked ? Math.max(top + padding, reader.top) : bottom - Math.min(panel.getBoundingClientRect().height, maxHeight)}px`;
    panel.style.visibility = 'visible';
    return true;
}
