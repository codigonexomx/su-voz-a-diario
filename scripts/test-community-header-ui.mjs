import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.env.PORT || 8767);
const escape = value => value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);

// A presentation-only fixture: no Firebase, account state or user content.
const server = http.createServer((request, response) => {
    response.setHeader('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src data:; connect-src 'none'; frame-src 'none'");
    response.setHeader('Cache-Control', 'no-store');
    const url = new URL(request.url, `http://127.0.0.1:${port}`);
    if (url.pathname === '/') {
        const moderator = url.searchParams.get('moderator') === '1';
        const prayer = url.searchParams.get('prayer') === '1';
        const dark = url.searchParams.get('dark') === '1';
        const name = url.searchParams.get('long') === '1'
            ? 'Una identidad de prueba con un nombre muy largo'
            : 'Hermano(a)';
        response.setHeader('Content-Type', 'text/html; charset=utf-8');
        response.end(`<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>QA cabecera de Comunidad</title><link rel="stylesheet" href="/css/fonts-local.css"><link rel="stylesheet" href="/css/styles.css"></head>
<body class="${dark ? 'dark-mode' : 'light-mode'}"><main id="app-content" class="container"><div class="community-container">
<section class="community-hero community-hero-compact" aria-labelledby="communityTitle">
<div class="community-hero-copy"><h2 id="communityTitle">${prayer ? 'Comunidad de Oraci&#243;n' : 'Comunidad'}</h2>
<p>${prayer ? 'Unidos en fe intercediendo unos por otros.' : 'Compartimos lo que recibimos de la Palabra.'}</p></div>
<div class="community-hero-actions" aria-label="Acciones de Comunidad">
<button class="community-identity-chip" type="button" aria-label="Editar mi Distintivo"><span class="community-identity-chip-avatar" aria-hidden="true"></span><span class="community-identity-chip-label">${escape(name)}</span></button>
<button class="community-rules-btn" type="button">Normas</button>
<button class="community-rules-btn" type="button">Autores bloqueados</button>
${moderator ? '<button class="community-rules-btn" type="button">Moderaci&#243;n</button>' : ''}
</div></section></div><section aria-label="Resultado QA"><p id="qa-result">Comprobando...</p><output id="qa-details"></output></section></main><script src="/layout-check.js"></script></body></html>`);
        return;
    }
    if (url.pathname === '/layout-check.js') {
        response.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        fs.createReadStream(path.join(root, 'scripts/test-community-header-layout.js')).pipe(response);
        return;
    }
    if (!/^\/(?:css\/[^/]+\.css|assets\/fonts\/[^/]+\.(?:ttf|woff2))$/.test(url.pathname)) {
        response.writeHead(404).end();
        return;
    }
    const file = path.join(root, url.pathname.slice(1));
    if (!fs.existsSync(file)) {
        response.writeHead(404).end();
        return;
    }
    response.setHeader('Content-Type', file.endsWith('.css') ? 'text/css; charset=utf-8' : file.endsWith('.ttf') ? 'font/ttf' : 'font/woff2');
    fs.createReadStream(file).pipe(response);
});

server.listen(port, '127.0.0.1', () => console.log(`Presentation-only QA: http://127.0.0.1:${port}/?moderator=1`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(() => process.exit(0)));
