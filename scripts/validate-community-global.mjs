import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const source = readFileSync('js/app.js', 'utf8');
assert.match(source, /window\.App = App;/);
function find(node, name) {
    if (node.type === 'Property' && node.key?.name === name) return node.value;
    for (const value of Object.values(node)) {
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child?.type) { const result = find(child, name); if (result) return result; }
        }
    }
}
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const initNode = find(tree, 'init');
const initSource = source.slice(initNode.start, initNode.end);
assert(initSource.indexOf('this.initializeCommunitySafety()') < initSource.indexOf('await this.handleRoute()'),
    'Safety must exist before the first direct Community route');
for (const module of ['moderation', 'richTextEditor', 'liveFeed', 'notifications',
    'searchCommunity', 'voiceReflections', 'offlineSupport', 'filters', 'userMetrics']) {
    assert.doesNotMatch(readFileSync(`js/${module}.js`, 'utf8'), /window\.app\b/, module);
}

const calls = [], toasts = [], stored = new Map();
let authCalls = 0, renders = 0, state = { hidden: { post: { hidden: true } }, blocked: [], moderator: false };
const app = {
    currentUser: { uid: 'fixture-user' }, currentView: 'community',
    initAuth: async () => { authCalls++; },
    getCommunityIdentityCallable: async name => async data => {
        calls.push({ name, data });
        return { data: name === 'getCommunitySafetyState' ? state : {} };
    },
    showToast: text => toasts.push(text),
    renderCommunity: async () => { renders++; },
    navigate: view => { app.currentView = view; },
};
const browser = { App: app };
const navigator = { onLine: true };
const context = vm.createContext({ window: browser, navigator, confirm: () => true,
    localStorage: { getItem: key => stored.get(key) ?? null, setItem: (key, value) => stored.set(key, value) },
});
vm.runInContext(readFileSync('js/moderation.js', 'utf8'), context);
assert.equal(browser.app, undefined, 'No lowercase alias can mask the integration bug');
const moderation = new browser.ModerationSystem();
const safetyNode = find(tree, 'initializeCommunitySafety');
const initSafety = vm.runInContext(`(${source.slice(safetyNode.start, safetyNode.end)})`, context);
const initializingApp = {};
initSafety.call(initializingApp);
const initialSafety = initializingApp.moderation;
assert(initialSafety instanceof browser.ModerationSystem);
initSafety.call(initializingApp);
assert.equal(initializingApp.moderation, initialSafety, 'Later premium initialization preserves the first safety state');
await moderation.refresh({ post: [{ id: 'hidden' }] });
assert.equal(authCalls, 1);
assert.equal(moderation.isVisible({ id: 'hidden' }, 'post'), false);
assert(stored.has('su-voz-community-hidden-fixture-user'));
stored.set('su-voz-community-terms-fixture-user', moderation.termsVersion);
assert.equal(await moderation.ensureTerms(), true, 'Terms cache uses the actual current UID');

let dialog;
moderation.openDialog = (title, body) => {
    dialog = { title, body };
    return { overlay: { querySelectorAll: () => [] } };
};
await moderation.showBlockedAuthors();
assert.equal(dialog.title, 'Autores bloqueados');
await moderation.blockAuthor({ type: 'post', id: 'fixture-post' });
assert.equal(calls.at(-1).name, 'blockCommunityAuthor');
assert.equal(renders, 1);
assert.equal(toasts.at(-1), 'Autor bloqueado.');
app.currentView = 'community-thread';
await moderation.blockAuthor({ type: 'reply', id: 'fixture-reply' });
assert.equal(app.currentView, 'community');

const before = calls.length;
navigator.onLine = false;
await assert.rejects(moderation.call('reportCommunityContent', {}), /conexión/);
assert.equal(calls.length, before, 'Offline actions never submit a callable');
navigator.onLine = true;
app.getCommunityIdentityCallable = async () => async () => {
    app.currentUser = { uid: 'next-user' };
    return { data: { hidden: { post: { stale: true } }, moderator: true } };
};
await moderation.refresh();
assert.equal(moderation.hidden.post.stale, undefined, 'Old identity response is discarded');
assert.equal(moderation.isModerator, false);
console.log('OK: actual App global, authenticated safety state, UID-scoped cache, blocks, offline and stale identity');
