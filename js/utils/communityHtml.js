// Parse untrusted pasted markup in an inert fragment; rebuild only text and formatting.
// Never truncate serialized HTML: it can cut a tag and absorb the next feed card.
export function sanitizeCommunityHtml(value) {
    const template = document.createElement('template');
    template.innerHTML = String(value || '');
    const allowed = new Set(['b', 'strong', 'i', 'em', 'u', 'blockquote', 'p', 'br']);
    const blocked = new Set(['script', 'style', 'iframe', 'object', 'embed', 'svg', 'math', 'template', 'noscript']);
    const escape = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
    const render = node => {
        if (node.nodeType === 3) return escape(node.nodeValue).replace(/\r\n?|\n/g, '<br>');
        if (node.nodeType !== 1) return '';
        const tag = node.localName.toLowerCase();
        if (blocked.has(tag)) return '';
        const children = Array.from(node.childNodes, render).join('');
        if (tag === 'br') return '<br>';
        if (allowed.has(tag)) return `<${tag}>${children}</${tag}>`;
        // Preserve paragraph boundaries from clipboard divs without importing their styles.
        if (['div', 'li', 'section', 'article', 'h1', 'h2', 'h3', 'h4'].includes(tag)) return `<p>${children}</p>`;
        return children;
    };
    return Array.from(template.content.childNodes, render).join('').trim();
}

export function communityPlainText(value) {
    const template = document.createElement('template');
    template.innerHTML = sanitizeCommunityHtml(value);
    return (template.content.textContent || '').trim();
}
