import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

const host = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const [emulatorHost, emulatorPort] = host.split(':');

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-su-voz-rules',
  firestore: {
    host: emulatorHost,
    port: Number(emulatorPort || 8080),
    rules: readFileSync('firestore.rules', 'utf8'),
  },
});

try {
  await testEnv.clearFirestore();

  const anonDb = testEnv.unauthenticatedContext().firestore();
  const userDb = testEnv.authenticatedContext('user-a').firestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'communityPosts/post-public'), {
      text: 'Hola',
      reference: 'Juan 3',
      date: '2026-08-29',
      name: 'Anónimo',
      isAnonymous: true,
      schemaVersion: 3,
    });
    await setDoc(doc(adminDb, 'communityReplies/reply-public'), {
      postId: 'post-public',
      text: 'Amén',
      date: '2026-08-29',
      name: 'Anónimo',
      isAnonymous: true,
      schemaVersion: 3,
    });
    await setDoc(doc(adminDb, 'communityPostPrivate/post-public'), {
      ownerUid: 'user-a',
      schemaVersion: 3,
    });
    await setDoc(doc(adminDb, 'communityReplyPrivate/reply-public'), {
      ownerUid: 'user-a',
      postId: 'post-public',
      schemaVersion: 3,
    });
    await setDoc(doc(adminDb, 'communityProfiles/user-a'), {
      displayName: 'Richard',
      normalizedName: 'richard',
      avatarId: 'dove',
      colorId: 'blue-01',
    });
    await setDoc(doc(adminDb, 'communityNames/richard'), {
      uid: 'user-a',
      displayName: 'Richard',
    });
  });

  await assertSucceeds(getDoc(doc(anonDb, 'communityPosts/post-public')));
  await assertFails(setDoc(doc(collection(userDb, 'communityPosts')), {
    text: 'Directo',
    reference: 'Juan 3',
    date: '2026-08-29',
    name: 'Anónimo',
    isAnonymous: true,
    schemaVersion: 3,
  }));
  await assertFails(updateDoc(doc(userDb, 'communityPosts/post-public'), { text: 'Cambio' }));
  await assertFails(deleteDoc(doc(userDb, 'communityPosts/post-public')));

  await assertSucceeds(getDoc(doc(anonDb, 'communityReplies/reply-public')));
  await assertFails(setDoc(doc(collection(userDb, 'communityReplies')), {
    postId: 'post-public',
    text: 'Directo',
    date: '2026-08-29',
    name: 'Anónimo',
    isAnonymous: true,
    schemaVersion: 3,
  }));

  await assertFails(getDoc(doc(userDb, 'communityPostPrivate/post-public')));
  await assertFails(setDoc(doc(userDb, 'communityPostPrivate/other'), { ownerUid: 'user-a' }));
  await assertFails(getDoc(doc(userDb, 'communityReplyPrivate/reply-public')));
  await assertFails(setDoc(doc(userDb, 'communityReplyPrivate/other'), { ownerUid: 'user-a' }));
  await assertFails(setDoc(doc(userDb, 'communityNames/pedro'), { uid: 'user-a' }));
  await assertFails(setDoc(doc(userDb, 'communityProfiles/user-a'), {
    displayName: 'Pedro',
    normalizedName: 'pedro',
    avatarId: 'lion',
    colorId: 'green-01',
  }));

  assert.equal(true, true);
  console.log('community rules tests passed');
} finally {
  await testEnv.cleanup();
}
