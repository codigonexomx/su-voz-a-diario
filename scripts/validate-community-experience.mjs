import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { communityExperienceMethods } from '../js/community/CommunityExperience.js';

const source = readFileSync('js/app.js', 'utf8');
function find(node, name) {
    if ((node.type === 'Property' && node.key?.name === name) || (node.type === 'FunctionDeclaration' && node.id?.name === name)) return node;
    for (const value of Object.values(node)) for (const child of Array.isArray(value) ? value : [value]) {
        if (child?.type) { const result = find(child, name); if (result) return result; }
    }
}
const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
function method(name, globals = {}) {
    const property = find(tree, name), node = property.value;
    const prefix = property.method ? `${node.async ? 'async ' : ''}function` : '';
    return vm.runInNewContext(`(${prefix}${source.slice(node.start, node.end)})`, globals);
}
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
const escape = value => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Fake DOM and Firebase: no real account, token or remote writes are involved.
class Element {
    constructor() { this.attrs = {}; this.handlers = {}; this.nodes = {}; this.dataset = {}; this.innerHTML = ''; }
    querySelector(selector) { return this.nodes[selector] || null; }
    querySelectorAll(selector) {
        if (selector !== '[data-notification-id]') return [];
        this.items = [...this.innerHTML.matchAll(/data-notification-id="([^"]+)"/g)].map(match => {
            const node = new Element(); node.dataset.notificationId = match[1]; return node;
        });
        return this.items;
    }
    addEventListener(type, callback) { this.handlers[type] = callback; }
    setAttribute(name, value) { this.attrs[name] = value; }
    removeAttribute(name) { delete this.attrs[name]; }
    focus() { this.focused = true; }
    contains(target) { return target === this; }
}
const slot = new Element();
for (const name of ['.bell-btn', '.notification-dropdown', '.notification-close', '.mark-all-read-btn', '.notification-list']) slot.nodes[name] = new Element();
const listeners = {}, subscriptions = [], changes = [], calls = [], toasts = [];
let commitError = false, commitDelay = null;
const app = { currentUser: { uid: 'owner' }, renderCommunityIcon: name => `<svg data-icon="${name}"></svg>`,
    showToast: text => toasts.push(text), openCommunityPrayerTarget: id => calls.push(['prayer', id]), navigate: (...args) => calls.push(args) };
const fns = {
    query: (...args) => args, collection: (_, name) => name, where: (...args) => args, orderBy: (...args) => args, limit: n => n,
    onSnapshot(query, next, error) { const subscription = { query, next, error, stopped: false }; subscriptions.push(subscription); return () => { subscription.stopped = true; }; },
    doc: (_, collection, id) => `${collection}/${id}`,
    writeBatch: () => ({ update: (ref, data) => changes.push([ref, data]), commit: async () => {
        if (commitDelay) await commitDelay.promise;
        if (commitError) throw new Error('offline');
    } }),
};
const browser = { App: app, firebaseDb: {}, firebaseFns: fns };
vm.runInNewContext(readFileSync('js/notifications.js', 'utf8'), { window: browser,
    document: { addEventListener: (event, fn) => { listeners[event] = fn; }, getElementById: () => slot }, console });
const center = new browser.NotificationCenter();
center.initialize();
assert.deepEqual(JSON.parse(JSON.stringify(subscriptions[0].query)), ['notifications', ['userId', '==', 'owner'], ['createdAt', 'desc'], 40]);
center.initialize(); assert.equal(subscriptions.length, 1);
const docs = rows => ({ docs: rows.map(data => ({ id: data.id, data: () => data })) });
subscriptions[0].next(docs([{ id: 'first', type: 'newPrayer', prayerId: 'prayer-1', title: '<img onerror=bad>', body: '<script>bad</script>', isRead: false }]));
center.openDropdown();
assert.equal(center.unreadCount, 1);
assert.match(slot.nodes['.notification-list'].innerHTML, /&lt;img/);
assert.doesNotMatch(slot.nodes['.notification-list'].innerHTML, /<script>|<img/);
assert.equal(slot.nodes['.bell-btn'].attrs['aria-expanded'], 'true');
assert(slot.nodes['.notification-close'].focused);
let prevented = false; listeners.keydown({ key: 'Escape', preventDefault: () => { prevented = true; } });
assert(prevented); assert(!center.isOpen); assert(slot.nodes['.bell-btn'].focused);
center.openDropdown(); listeners.click({ target: {} }); assert(!center.isOpen);
commitError = true;
assert.equal(await center.markAsRead('first'), false);
assert.equal(center.unreadCount, 1); assert.equal(center.notifications[0].isRead, false); assert(toasts.length);
commitError = false;
center.openDropdown(); await slot.nodes['.notification-list'].items[0].handlers.click();
assert.deepEqual(calls.at(-1), ['prayer', 'prayer-1']); assert.equal(center.unreadCount, 0);
assert.equal(changes.at(-1)[0], 'notifications/first');
assert.deepEqual(Object.keys(changes.at(-1)[1]), ['isRead']);
subscriptions[0].next(docs([{ id: 'reply', postId: 'post-1', type: 'newReply', isRead: false }]));
center.openDropdown(); await slot.nodes['.notification-list'].items[0].handlers.click();
assert.deepEqual(calls.at(-1), ['community', 'post-1']);
subscriptions[0].error(); assert(center.error);
center.initialize(); assert(subscriptions[0].stopped); assert.equal(subscriptions.length, 2);
subscriptions[1].next(docs([{ id: 'slow', isRead: false }]));
commitDelay = deferred(); const marking = center.markAsRead('slow');
app.currentUser = { uid: 'other' }; center.initialize();
assert(subscriptions[1].stopped); assert.equal(center.notifications.length, 0);
subscriptions[1].next(docs([{ id: 'stale', body: 'OTHER ACCOUNT DATA' }])); assert.equal(center.notifications.length, 0);
commitDelay.resolve(); assert.equal(await marking, false); commitDelay = null;
subscriptions[2].next(docs(Array.from({ length: 40 }, (_, i) => ({ id: `notice-${i}`, isRead: false }))));
assert.equal(center.unreadCount, 40); assert.match(center.renderBellHtml(), /40\+/);
assert.match(center.renderBellHtml(), /Marcar recientes como leídas/);
assert.equal(await center.markAllAsRead(), true); assert.equal(center.unreadCount, 0);
center.initialize(null); assert.equal(center.uid, null); assert.equal(center.notifications.length, 0);
console.log('OK: real inbox code, escaped content, UID isolation, retries, failed/late read writes, recent-only bulk read, Escape/focus and prayer/reflection navigation');

const personal = { ...communityExperienceMethods, currentUser: { uid: 'owner' }, prayerTabFilter: 'my-prayers' };
const requests = []; let nextPage = { posts: [{ id: 'one' }], hasMore: true, cursor: 'first-page' };
personal.getCommunityIdentityCallable = async name => async data => { requests.push([name, data]); return { data: nextPage }; };
assert.equal((await personal.loadPersonalPrayerRequests('my-prayers')).length, 1);
await personal.loadPersonalPrayerRequests('my-prayers'); assert.equal(requests.length, 1);
nextPage = { posts: [{ id: 'one' }, { id: 'two' }, { id: '../bad' }], hasMore: false, cursor: 'last-page' };
assert.equal((await personal.loadPersonalPrayerRequests('my-prayers', { append: true })).length, 2);
assert.equal(requests.at(-1)[1].cursor, 'first-page');
nextPage = { posts: [], hasMore: true, cursor: null };
await personal.loadPersonalPrayerRequests('following'); assert(!personal.getPersonalPrayerState('following').hasMore);
const pendingList = deferred(); personal.getCommunityIdentityCallable = async () => () => pendingList.promise;
const loading = personal.loadPersonalPrayerRequests('my-prayers', { forceRefresh: true }); await tick();
personal.currentUser = { uid: 'different' }; personal.communityPersonalPrayerStates = {};
pendingList.resolve({ data: { posts: [{ id: 'stale' }], hasMore: false } });
assert.equal((await loading).length, 0); assert.equal(personal.getPersonalPrayerState('my-prayers').posts.length, 0);
personal.getCommunityIdentityCallable = async () => async () => { throw new Error('not deployed'); };
await assert.rejects(personal.loadPersonalPrayerRequests('following'), /not deployed/);
assert(personal.getPersonalPrayerState('following').error);
for (const value of [null, 'invalid', NaN, { seconds: NaN }]) assert.equal(personal.formatCommunityPrayerTimestamp(value), '');
assert.equal(personal.formatCommunityPrayerTimestamp({ seconds: 0 }), personal.formatCommunityPrayerTimestamp({ _seconds: 0 }));
const routed = []; personal.setCommunityEntryPoint = value => routed.push(value); personal.navigateToPushHash = value => routed.push(value);
await personal.openCommunityPrayerTarget('a-b_1'); assert.equal(routed.at(-1), '#community?section=prayer&prayer=a-b_1');
await personal.openCommunityPrayerTarget('../escape'); assert.equal(routed.length, 2);
console.log('OK: owned/following pagination, duplicate removal, malformed cursor, offline error, late identity response, timestamps and validated links');

const toggle = method('togglePrayerCommitment', { navigator: { onLine: true }, console: { error() {} } });
let toggleDelay = deferred(); const localUpdates = [], busyUpdates = [];
const toggleApp = { currentUser: { uid: 'first' }, prayerCommitmentMap: {}, getCommunityPrayerState: () => ({ posts: [{ id: 'prayer', prayingCount: 2 }] }),
    updatePrayerRequestLocalState: (...args) => localUpdates.push(args), updatePrayerCardPendingUi: (...args) => busyUpdates.push(args),
    getCommunityIdentityCallable: async () => () => toggleDelay.promise, showToast: text => toasts.push(text) };
const firstToggle = toggle.call(toggleApp, 'prayer'); await tick();
await toggle.call(toggleApp, 'prayer'); assert.equal(localUpdates.length, 1, 'Rapid double taps do not toggle twice');
toggleApp.currentUser = { uid: 'second' }; toggleApp.prayerCommitmentPendingIds = new Set(['prayer']);
toggleDelay.resolve({ data: { success: true, active: true, prayingCount: 10 } }); await firstToggle;
assert.equal(localUpdates.length, 1); assert(toggleApp.prayerCommitmentPendingIds.has('prayer'), 'Old UID cannot unlock a new identity operation');
toggleApp.prayerCommitmentPendingIds.clear(); toggleDelay = deferred();
const failingToggle = toggle.call(toggleApp, 'prayer'); await tick(); toggleDelay.reject(new Error('offline')); await failingToggle;
assert.deepEqual(localUpdates.at(-1), ['prayer', false, 2]); assert.deepEqual(busyUpdates.at(-1), ['prayer', false]);
const pushRoute = method('getPushHashFromEvent', { window: { location: { origin: 'https://suvoz.app' } }, URL, console });
const target = '#community?section=prayer&prayer=prayer';
assert.equal(pushRoute({ notification: { data: { prayerId: 'prayer' } } }), target);
assert.equal(pushRoute({ notification: { data: { url: `https://suvoz.app/${target}` } } }), target);
assert.equal(pushRoute({ notification: { data: { prayerId: '../unsafe' } } }), '#home');
assert.equal(pushRoute({ notification: { data: { postId: 'post' } } }), '#community/post');
console.log('OK: actual optimistic prayer action, duplicate taps, rollback, identity races and native prayer deep links');

for (const [name, key, mapKey] of [['loadCommunityPrayerOwnership', 'requests', 'prayerOwnershipMap'], ['loadCommunityPrayerCommitments', 'commitments', 'prayerCommitmentMap']]) {
    const pages = [], ownerApp = { currentUser: { uid: 'owner' }, getCommunityIdentityCallable: async () => async data => {
        pages.push(data.requestIds); return { data: { [key]: Object.fromEntries(data.requestIds.map(id => [id, true])) } };
    } };
    await method(name, { console }).call(ownerApp, Array.from({ length: 121 }, (_, i) => ({ id: `prayer-${i}` })));
    assert.deepEqual(pages.map(page => page.length), [50, 50, 21]);
    assert.equal(Object.keys(ownerApp[mapKey]).length, 121);
}
const prayerCalls = [], content = { innerHTML: '', querySelector: () => null };
const prayerView = { communitySection: 'prayer', currentView: 'community', currentUser: { uid: 'owner' }, $content: content,
    getCommunityTodayContext: () => ({}), getCommunityDiscoveryFilter: () => 'all', initAuth: async () => ({ uid: 'owner' }),
    loadCurrentCommunityIdentityProfile: async () => prayerCalls.push('profile'),
    getCommunityPrayerPostsCached: async () => { prayerCalls.push('prayers'); return []; },
    loadCommunityPrayerOwnership: async () => {}, loadCommunityPrayerCommitments: async () => {},
    moderation: { refresh: async () => { prayerView.currentView = 'home'; } },
};
assert.equal(await method('renderCommunity', { document: {}, console }).call(prayerView), false);
assert.deepEqual(prayerCalls, ['profile', 'prayers']);
assert.doesNotMatch(content.innerHTML, /community-feed/);
const staleCallbacks = [];
const badgeApp = { currentUser: { uid: 'owner' }, currentView: 'home', updateCommunityBadge: () => {}, $content: content };
const subscribe = method('subscribeToCommunityActivity', { db: {}, doc: (_, collection, uid) => `${collection}/${uid}`,
    getDoc: async () => ({ exists: () => true }), onSnapshot: (_, next) => { staleCallbacks.push(next); return () => {}; }, console });
await subscribe.call(badgeApp); badgeApp.currentUser = { uid: 'other' }; await subscribe.call(badgeApp);
staleCallbacks[0]({ exists: () => true, data: () => ({ unreadCommunityCount: 99 }) }); assert.equal(badgeApp.communityUnreadCount, undefined);
staleCallbacks[1]({ exists: () => true, data: () => ({ unreadCommunityCount: 2 }) }); assert.equal(badgeApp.communityUnreadCount, 2);
console.log('OK: 121-item privacy/status batches, independent prayer loading, cancelled render and stale badge subscription');
const replyQueries = [];
const replyLoader = method('getRepliesByPostId', { db: {}, collection: (_, name) => name, where: (...args) => args, orderBy: (...args) => args,
    query: (...args) => { replyQueries.push(args); return args; }, getDocs: async () => ({ docs: [{ id: 'reply', data: () => ({ postId: 'post' }) }] }), console });
assert.equal((await replyLoader('post')).length, 1);
assert.deepEqual(JSON.parse(JSON.stringify(replyQueries[0])), ['communityReplies', ['postId', '==', 'post'], ['createdAt', 'asc']]);
const failedReplies = method('getRepliesByPostId', { db: {}, collection: () => '', where: () => '', orderBy: () => '', query: () => '',
    getDocs: async () => { throw new Error('offline'); }, console: { error() {} } });
await assert.rejects(failedReplies('post'), /offline/);
assert.doesNotMatch(source, /class="community-container community-thread-container"/);
console.log('OK: thread queries only its replies; failed loads propagate instead of pretending there are zero replies; thread theme is unified');

const backendSource = readFileSync('functions/index.js', 'utf8');
const backendTree = parse(backendSource, { ecmaVersion: 'latest', sourceType: 'script' });
const sendNode = find(backendTree, 'sendNotification');
const payloads = [], removed = [];
const send = vm.runInNewContext(`(${backendSource.slice(sendNode.start, sendNode.end)})`, {
    MAX_MULTICAST_TOKENS: 500, INVALID_TOKEN_CODES: new Set(['invalid']),
    chunk: (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size)),
    blockedAccounts: async () => new Set(['frozen']), deleteInvalidTokens: async (_, rows) => removed.push(...rows),
    getMessaging: () => ({ sendEachForMulticast: async payload => {
        payloads.push(payload); const responses = payload.tokens.map(token => ({ success: token !== 'bad', error: token === 'bad' ? { code: 'invalid' } : undefined }));
        return { responses, successCount: responses.filter(item => item.success).length, failureCount: responses.filter(item => !item.success).length };
    } }),
});
const recipient = (token, platform, uid = 'owner') => ({ token, documents: [{ get: field => ({ platform, uid })[field] }] });
const result = await send({}, [recipient('web', 'web'), recipient('bad', 'web'), recipient('native', 'android'), recipient('unknown', null), recipient('blocked', 'web', 'frozen')], {
    title: 'Generic title', body: 'Generic body', url: `https://suvoz.app/${target}`, tag: 'community-prayer', type: 'community-badge', prayerId: 'prayer', badgeCount: '3',
});
assert.equal(payloads.length, 2); assert.equal(result.successCount, 3); assert.equal(result.failureCount, 1);
assert.equal(payloads[0].notification, undefined, 'Web must be data-only: SW owns presentation');
assert.equal(payloads[0].data.url, `https://suvoz.app/${target}`);
assert.deepEqual([...payloads[1].tokens], ['native', 'unknown']); assert.equal(payloads[1].notification.title, 'Generic title');
assert.equal(payloads[1].android.notification.channelId, 'default'); assert.equal(removed.length, 1);
assert(!payloads.flatMap(item => item.tokens).includes('blocked'));
console.log('OK: actual FCM sender with mocked transport, data-only web vs native payload, deletion freeze, counts and invalid-token mapping; zero real pushes');

const swSource = readFileSync('sw.js', 'utf8'), swTree = parse(swSource, { ecmaVersion: 'latest' });
const badgeHandler = find(swTree, 'handleCommunityBadgeMessage'), displayed = [], badges = [];
const handleBadge = vm.runInNewContext(`(${swSource.slice(badgeHandler.start, badgeHandler.end)})`, {
    updateCommunityAppBadge: async count => badges.push(count), self: { registration: { showNotification: async (...args) => displayed.push(args) } },
});
await handleBadge(payloads[0].data); assert.equal(displayed.length, 1); assert.equal(displayed[0][1].data.url, `https://suvoz.app/${target}`);
assert.equal(displayed[0][1].data.prayerId, 'prayer'); assert.equal(displayed[0][1].renotify, false);
await handleBadge({ badgeCount: '0' }); assert.equal(displayed.length, 1); assert.equal(badges.length, 2);
console.log('OK: actual worker shows one generic prayer alert with exact destination; clearing the badge shows no alert');

for (const asset of ['css/community.css', 'js/community/CommunityExperience.js', 'js/notifications.js']) {
    assert.equal(readFileSync(asset, 'utf8'), readFileSync(`www/${asset}`, 'utf8'), `${asset} Android copy`);
    assert(readFileSync('sw.js', 'utf8').includes(asset));
}
assert.match(source, /loadPersonalPrayerRequests\(this.prayerTabFilter/);
assert.match(source, /const communityRendered = await this.renderCommunity/);
assert.match(source, /communitySection !== 'prayer'\) await this.withTimeout/);
assert.match(readFileSync('functions/accountDeletionInventory.js', 'utf8'), /"prayerId"/);
assert.match(readFileSync('index.html', 'utf8'), /writeBatch: firestoreModule.writeBatch/);
console.log('OK: personal lists, prayer-first loading, offline assets and web/Android parity');
