import assert from 'node:assert/strict';
import { AccountRecoveryService, accountErrorMessage } from '../js/services/AccountRecoveryService.js';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const auth = { currentUser: { uid: 'original', isAnonymous: true } };
let changes = 0, resets = 0, requests = 0, verificationFails = false;
let detached = 0, restored = 0;
const sdk = {
    EmailAuthProvider: { credential: (email, password) => ({ email, password }) },
    linkWithCredential: async (user, credential) => {
        if (credential.email === 'existing@example.test') throw { code: 'auth/credential-already-in-use' };
        auth.currentUser = { ...user, isAnonymous: false, email: credential.email, emailVerified: false };
        return { user: auth.currentUser };
    },
    sendEmailVerification: async () => { if (verificationFails) throw Error('network'); },
    signInWithEmailAndPassword: async (_, email, password) => {
        if (password === 'wrong') throw { code: 'auth/invalid-credential' };
        auth.currentUser = { uid: 'recovered', email, isAnonymous: false, emailVerified: true };
        return { user: auth.currentUser };
    },
    reload: async user => { user.emailVerified = true; }, getIdToken: async () => {},
    sendPasswordResetEmail: async (_, email) => { resets++; if (email === 'missing@example.test') throw { code: 'auth/user-not-found' }; },
    reauthenticateWithCredential: async (_, credential) => { if (credential.password === 'wrong') throw { code: 'auth/invalid-credential' }; },
};
const service = new AccountRecoveryService({ auth, sdk, onChanged: () => { changes++; },
    beforeRecover: async () => { detached++; }, afterRecover: async () => { restored++; }, callable: async (name, data) => {
    assert.equal(name, 'requestAccountDeletion'); assert.equal(data.confirmed, true); requests++; return { received: true };
} });
await assert.rejects(service.link('new@example.test', 'short'), e => e.code === 'auth/weak-password');
await assert.rejects(service.link('existing@example.test', 'safe-test-password'), e => e.code === 'auth/credential-already-in-use');
assert.equal(auth.currentUser.uid, 'original'); assert.equal(changes, 0);
verificationFails = true;
const linked = await service.link('new@example.test', 'safe-test-password');
assert.equal(linked.user.uid, 'original'); assert.equal(linked.verificationSent, false);
assert.equal(auth.currentUser.isAnonymous, false);
verificationFails = false;
await service.sendVerification(); await service.refresh();
assert.equal(auth.currentUser.emailVerified, true);
await assert.rejects(service.recover('new@example.test', 'safe-test-password'), e => e.code === 'account/switch-confirmation-required');
await assert.rejects(service.recover('new@example.test', 'wrong', true), e => e.code === 'auth/invalid-credential');
assert.equal(auth.currentUser.uid, 'original');
assert.equal(detached, 1); assert.equal(restored, 1);
await service.recover('new@example.test', 'safe-test-password', true);
assert.equal(auth.currentUser.uid, 'recovered');
assert.equal(detached, 2); assert.equal(restored, 2);
await service.resetPassword('missing@example.test'); assert.equal(resets, 1);
await assert.rejects(service.requestDeletion('safe-test-password', false));
await assert.rejects(service.requestDeletion('wrong', true)); assert.equal(requests, 0);
assert.equal((await service.requestDeletion('safe-test-password', true)).received, true);
assert.equal(requests, 1);
let release;
sdk.reload = () => new Promise(resolve => { release = resolve; });
const refreshing = service.refresh();
await assert.rejects(service.refresh(), e => e.code === 'account/busy');
release(); await refreshing;
assert(!accountErrorMessage({ message: 'password=private', code: 'unknown' }).includes('private'));
const appSource = readFileSync(new URL('../js/app.js', import.meta.url), 'utf8');
const appTree = parse(appSource, { ecmaVersion: 'latest', sourceType: 'module' });
function findProperty(node, name) {
    if (node?.type === 'Property' && node.key?.name === name) return node;
    for (const value of Object.values(node || {})) {
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child && typeof child === 'object') { const match = findProperty(child, name); if (match) return match; }
        }
    }
}
const context = { navigator: { onLine: true }, console, localStorage: { getItem: () => null }, window: {} };
const method = name => { const node = findProperty(appTree, name); assert(node); return vm.runInNewContext(`(${appSource.slice(node.value.start, node.value.end)})`, context); };
const app = { currentUser: { uid: 'old' }, communityIdentityProfile: { uid: 'old' }, communityOwnedPosts: { stale: true },
    prayerCommitmentMap: { stale: true }, moderation: { isModerator: true }, invalidateCommunityCache() {},
    resetCommunityPrayerState() {}, resetCommunityPrayerTestimonyState() {} };
method('setCurrentAuthUser').call(app, { uid: 'new' });
assert.equal(app.currentUser.uid, 'new'); assert.equal(app.communityIdentityProfile, null);
assert.equal(Object.keys(app.communityOwnedPosts).length, 0); assert.equal(Object.keys(app.prayerCommitmentMap).length, 0);
assert.equal(app.moderation.isModerator, false);
let response, started;
const begin = new Promise(resolve => { started = resolve; });
app.currentUser = { uid: 'old' };
app.getCommunityIdentityCallable = async () => async () => { started(); return new Promise(resolve => { response = resolve; }); };
const loading = method('loadCommunityOwnershipForItems').call(app, [{ id: 'stale', isAnonymous: true, schemaVersion: 3 }]);
await begin;
method('setCurrentAuthUser').call(app, { uid: 'new' });
response({ data: { posts: { stale: true } } }); await loading;
assert.equal(Object.keys(app.communityOwnedPosts).length, 0, 'A stale ownership response must not cross accounts');
console.log('OK: same-UID linking, conflicts without merge, verification retry, explicit recovery, failed sign-in, generic password reset, deletion confirmation/reauthentication, operation lock and safe errors');
console.log('OK: identity switches clear ownership, prayer commitments and moderator state; stale async ownership is discarded');
