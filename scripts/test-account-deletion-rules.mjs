import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, deleteObject } from 'firebase/storage';

const firestore = process.env.FIRESTORE_EMULATOR_HOST;
const storage = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
if ([firestore, storage].some(value => !/^127\.0\.0\.1:\d+$/.test(value || ''))) throw new Error('Local demo emulators required; production forbidden');
const address = value => ({ host: value.split(':')[0], port: Number(value.split(':')[1]) });
// Storage cross-service lookups use the emulator's configured project.
const projectId = 'demo-su-voz-stability';
const env = await initializeTestEnvironment({ projectId,
    firestore: { ...address(firestore), rules: readFileSync('firestore.rules', 'utf8') },
    storage: { ...address(storage), rules: readFileSync('storage.rules', 'utf8') },
});

try {
    await env.clearFirestore();
    await env.clearStorage();
    const existingSession = env.authenticatedContext('erasure-fixture');
    const other = env.authenticatedContext('other-fixture');
    const ownDb = existingSession.firestore(), otherDb = other.firestore();
    const ownStorage = existingSession.storage(`gs://${projectId}.firebasestorage.app`);
    const otherStorage = other.storage(`gs://${projectId}.firebasestorage.app`);
    const bytes = new Uint8Array([70, 73, 88, 84, 85, 82, 69]);
    const metadata = { contentType: 'audio/webm', customMetadata: { ownerUid: 'erasure-fixture' } };
    await assertSucceeds(setDoc(doc(ownDb, 'userProfiles/erasure-fixture'), { name: 'Fictitious' }));
    await assertSucceeds(uploadBytes(ref(ownStorage, 'community/audio/before.webm'), bytes, metadata));
    await env.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'accountDeletionGuards/erasure-fixture'), { status: 'frozen' }));
    await assertFails(setDoc(doc(ownDb, 'userProfiles/erasure-fixture'), { name: 'Old session must not write' }));
    await assertFails(getDoc(doc(ownDb, 'accountDeletionGuards/erasure-fixture')));
    await assertFails(setDoc(doc(ownDb, 'accountDeletionGuards/erasure-fixture'), {}));
    await assertFails(uploadBytes(ref(ownStorage, 'community/audio/after.webm'), bytes, metadata));
    await assertFails(deleteObject(ref(ownStorage, 'community/audio/before.webm')));
    await assertSucceeds(setDoc(doc(otherDb, 'userProfiles/other-fixture'), { name: 'Unaffected fixture' }));
    await assertSucceeds(uploadBytes(ref(otherStorage, 'community/audio/other.webm'), bytes,
        { contentType: 'audio/webm', customMetadata: { ownerUid: 'other-fixture' } }));
    assert.equal((await getDoc(doc(otherDb, 'userProfiles/other-fixture'))).get('name'), 'Unaffected fixture');
    console.log('OK: actual Firestore + Storage rules block an already authenticated frozen account, keep guards private and preserve another account; no production access.');
} finally { await env.cleanup(); }
