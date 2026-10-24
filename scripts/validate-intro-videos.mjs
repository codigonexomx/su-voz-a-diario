import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { INTRO_VIDEO_CONFIGS, INTRO_VIDEO_CONFIG_2PETER, getIntroVideoConfig, shouldShowIntroVideo } from '../js/core/constants.js';
import { getIntroVideoId, renderIntroVideoHtml } from '../js/utils/formatters.js';

const readings = JSON.parse(readFileSync('data/readings/2026-10.json', 'utf8'));
const introDates = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
for (const date of introDates) {
    assert(readings.find(reading => reading.date === date)?.reference.startsWith('2 Pedro '));
    assert.equal(shouldShowIntroVideo(date), true);
    assert.equal(getIntroVideoConfig(date), INTRO_VIDEO_CONFIG_2PETER);
}
for (const date of ['2026-10-23', '2026-10-28', '2026-10-31', '2027-10-24']) {
    assert.equal(shouldShowIntroVideo(date), false);
    assert.equal(getIntroVideoConfig(date), null);
}
for (const config of INTRO_VIDEO_CONFIGS) {
    assert.equal(getIntroVideoConfig(config.startDate), config);
    assert.equal(getIntroVideoConfig(config.endDate), config);
    assert.equal(getIntroVideoId(config).length, 11);
}
assert.equal(getIntroVideoId(INTRO_VIDEO_CONFIG_2PETER), 'c3FzB5MiJ38');
for (const url of ['javascript:alert(1)', 'https://evil.example/embed/c3FzB5MiJ38',
    'https://www.youtube.com/embed/invalid', 'https://evil@www.youtube.com/embed/c3FzB5MiJ38',
    'https://www.youtube.com/embed/c3FzB5MiJ38?autoplay=1']) {
    assert.equal(getIntroVideoId({ url }), '');
    assert.equal(renderIntroVideoHtml({ url }), '');
}

const created = [];
const document = { createElement(tag) {
    if (tag === 'iframe') {
        const player = { tag, focus(options) { this.focusOptions = options; } };
        created.push(player);
        return player;
    }
    return { textContent: '', get innerHTML() {
        return String(this.textContent).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    } };
} };
globalThis.document = document;
const markup = renderIntroVideoHtml(INTRO_VIDEO_CONFIG_2PETER);
assert(markup.includes('data-action="load-intro-video"'));
assert(markup.includes('data-intro-date="2026-10-24"'));
assert(markup.includes('Ver introducción'));
assert(markup.includes('Al reproducir, te conectas con YouTube.'));
assert(!/<iframe|<script|<link/.test(markup), 'No remote player before explicit activation');
assert(markup.includes('src="./assets/video-intros/c3FzB5MiJ38.jpg"'));
assert(!/src="https?:/.test(markup), 'Only a local poster can load before activation');
assert(existsSync('assets/video-intros/c3FzB5MiJ38.jpg'));
assert(readFileSync('sw.js', 'utf8').includes("'./assets/video-intros/c3FzB5MiJ38.jpg'"));
const escaped = renderIntroVideoHtml({ ...INTRO_VIDEO_CONFIG_2PETER, title: '<script>bad</script>', note: '<img src=x>' });
assert(!/<script|<img src=x/.test(escaped));
for (const config of INTRO_VIDEO_CONFIGS.filter(config => config !== INTRO_VIDEO_CONFIG_2PETER)) {
    const previous = renderIntroVideoHtml(config);
    assert(previous.includes('Abrir en YouTube'));
    assert(!previous.includes('data-action="load-intro-video"'));
    assert(!/<iframe|<img|<script/.test(previous));
}
delete globalThis.document;

const source = readFileSync('js/app.js', 'utf8');
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function find(node, name) {
    if (node.type === 'Property' && node.key.name === name) return node;
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child?.type) { const result = find(child, name); if (result) return result; }
    }
}
const context = vm.createContext({ document, navigator: { onLine: true }, getIntroVideoConfig, getIntroVideoId });
const node = find(tree, 'loadIntroVideo');
assert(node);
const load = vm.runInContext(`(${source.slice(node.value.start, node.value.end)})`, context);
const frame = { player: null, querySelector() { return this.player; }, replaceChildren(player) { this.player = player; } };
const card = { dataset: { introDate: '2026-10-24' }, querySelector: () => frame };
const button = { closest: () => card };
let stopped = 0;
const notices = [];
const app = { $content: { contains: value => value === card }, stopDailyReadingVoice: () => stopped++, showToast: message => notices.push(message) };
assert.equal(load.call(app, button), true);
assert.equal(created.length, 1);
assert.equal(stopped, 1);
const player = created[0];
assert.equal(player.src, 'https://www.youtube-nocookie.com/embed/c3FzB5MiJ38?autoplay=1&playsinline=1&rel=0');
assert.equal(player.title, INTRO_VIDEO_CONFIG_2PETER.title);
assert.equal(player.referrerPolicy, 'strict-origin-when-cross-origin', 'YouTube requires an origin referrer to avoid error 153');
assert(player.allowFullscreen);
assert(player.allow.includes('picture-in-picture'));
assert.equal(player.focusOptions.preventScroll, true);
assert.equal(load.call(app, button), false, 'Repeated activation must not restart playback');
frame.player = null;
context.navigator.onLine = false;
assert.equal(load.call(app, button), false);
assert.equal(created.length, 1);
assert.equal(notices.length, 1);
context.navigator.onLine = true;
card.dataset.introDate = '2026-10-28';
assert.equal(load.call(app, button), false);
card.dataset.introDate = '2026-09-01';
assert.equal(load.call(app, button), false, 'Historical links keep their previous behavior');
assert.equal(load.call(app, { closest: () => null }), false);
for (const name of ['renderHome', 'renderViewContent']) {
    const method = find(tree, name);
    const body = source.slice(method.start, method.end);
    assert(body.includes('renderIntroVideoHtml(introVideoConfig)'));
    assert(body.indexOf('${introVideoHtml}') < body.indexOf('this.renderDailyReadingEntry(reading)'));
    assert(body.indexOf('${introVideoHtml}') < body.indexOf('<div class="reading-card">'));
}
assert(source.includes('this.loadIntroVideo(introVideoBtn)'));
const css = readFileSync('css/styles.css', 'utf8');
assert.match(css, /\.intro-video-title\s*\{[^}]*color:\s*var\(--text-main\)/);
assert.match(css, /\.intro-video-frame-inline\s*\{[^}]*min-height:\s*200px/);
console.log('OK: 2 Peter introduction October 24-27 only; historical dates preserved; opt-in inline player, safe URLs, offline guard, no duplicate player and unchanged reading position');
