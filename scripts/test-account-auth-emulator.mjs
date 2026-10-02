import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase/app';
import * as sdk from 'firebase/auth';
import { AccountRecoveryService } from '../js/services/AccountRecoveryService.js';

const host = process.env.FIREBASE_AUTH_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || '')) throw new Error('Local Auth emulator required; production is forbidden');
const projectId = 'demo-su-voz-stability';
const app = initializeApp({ projectId, apiKey: 'demo-api-key' }, 'recovery-test');
const second = initializeApp({ projectId, apiKey: 'demo-api-key' }, 'conflict-test');
const auth = sdk.getAuth(app), other = sdk.getAuth(second);
for (const target of [auth, other]) {
    sdk.connectAuthEmulator(target, `http://${host}`, { disableWarnings: true });
    await sdk.setPersistence(target, sdk.inMemoryPersistence);
}
try {
    const email = `recovery-${Date.now()}@example.test`, password = 'Only-a-local-fixture-123';
    const anonymous = await sdk.signInAnonymously(auth);
    const originalUid = anonymous.user.uid;
    const service = new AccountRecoveryService({ auth, sdk });
    const result = await service.link(email, password);
    assert.equal(result.user.uid, originalUid);
    assert.equal(result.user.isAnonymous, false);
    assert.equal(result.verificationSent, true);
    const oob = await fetch(`http://${host}/emulator/v1/projects/${projectId}/oobCodes`).then(r => r.json());
    const code = oob.oobCodes.find(item => item.email === email && item.requestType === 'VERIFY_EMAIL')?.oobCode;
    assert(code, 'Verification code generated only in the isolated emulator');
    await sdk.applyActionCode(auth, code);
    await service.refresh();
    assert.equal(auth.currentUser.emailVerified, true);
    const otherAnonymous = await sdk.signInAnonymously(other);
    const conflicting = new AccountRecoveryService({ auth: other, sdk });
    await assert.rejects(conflicting.link(email, password), e => ['auth/email-already-in-use', 'auth/credential-already-in-use'].includes(e.code));
    assert.equal(other.currentUser.uid, otherAnonymous.user.uid);
    await assert.rejects(conflicting.recover(email, 'wrong-password', true));
    assert.equal(other.currentUser.uid, otherAnonymous.user.uid);
    await conflicting.recover(email, password, true);
    assert.equal(other.currentUser.uid, originalUid);
    assert.equal(other.currentUser.emailVerified, true);
    await service.requestDeletion(password, false).then(() => assert.fail('Consent required'), () => {});
    await sdk.deleteUser(auth.currentUser);
    console.log('OK: actual Firebase Auth linking preserves UID, email verification, conflicts/failed login preserve session, second-device recovery');
} finally {
    await deleteApp(app); await deleteApp(second);
}
