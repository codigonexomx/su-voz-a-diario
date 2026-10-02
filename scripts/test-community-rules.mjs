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
  getDocs,
  setDoc,
  serverTimestamp,
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
  const userBDb = testEnv.authenticatedContext('user-b').firestore();

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

    // Seed Prayer Request for Rules testing
    await setDoc(doc(adminDb, 'communityPrayerRequests/prayer-public'), {
      text: 'Petición pública de oración',
      name: 'Anónimo',
      isAnonymous: true,
      status: 'active',
      prayingCount: 0,
      createdAt: new Date(),
      schemaVersion: 1,
    });
    await setDoc(doc(adminDb, 'communityPrayerPrivate/prayer-public'), {
      ownerUid: 'user-a',
      schemaVersion: 1,
    });
  });

  // Existing Community Rules assertions
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

  // ==========================================
  // Oración Rules Assertions (CASOS R1 - R12)
  // ==========================================

  // CASO R1: Unauthenticated user can read public prayer request (ALLOW)
  await assertSucceeds(getDoc(doc(anonDb, 'communityPrayerRequests/prayer-public')));

  // CASO R2: Authenticated user can read public prayer request (ALLOW)
  await assertSucceeds(getDoc(doc(userDb, 'communityPrayerRequests/prayer-public')));

  // CASO R3: Unauthenticated user attempts direct create on communityPrayerRequests (DENY)
  await assertFails(setDoc(doc(collection(anonDb, 'communityPrayerRequests')), {
    text: 'Direct anon create',
    isAnonymous: true,
  }));

  // CASO R4: Authenticated user attempts direct create on communityPrayerRequests (DENY)
  await assertFails(setDoc(doc(collection(userDb, 'communityPrayerRequests')), {
    text: 'Direct user create',
    isAnonymous: true,
  }));

  // CASO R5: Authenticated user attempts direct update on communityPrayerRequests (DENY)
  await assertFails(updateDoc(doc(userDb, 'communityPrayerRequests/prayer-public'), {
    text: 'Modified text',
  }));

  // CASO R6: Authenticated user attempts direct delete on communityPrayerRequests (DENY)
  await assertFails(deleteDoc(doc(userDb, 'communityPrayerRequests/prayer-public')));

  // CASO R7: Unauthenticated user attempts read on communityPrayerPrivate (DENY)
  await assertFails(getDoc(doc(anonDb, 'communityPrayerPrivate/prayer-public')));

  // CASO R8: Authenticated owner attempts direct read on communityPrayerPrivate (DENY)
  await assertFails(getDoc(doc(userDb, 'communityPrayerPrivate/prayer-public')));

  // CASO R9: Other authenticated user attempts read on communityPrayerPrivate (DENY)
  await assertFails(getDoc(doc(userBDb, 'communityPrayerPrivate/prayer-public')));

  // CASO R10: Authenticated user attempts direct write on communityPrayerPrivate (DENY)
  await assertFails(setDoc(doc(userDb, 'communityPrayerPrivate/prayer-other'), {
    ownerUid: 'user-a',
  }));

  // CASO R11: User attempts to list entire collection communityPrayerPrivate (DENY)
  await assertFails(getDocs(collection(userDb, 'communityPrayerPrivate')));

  // CASO R12: Public query/list on communityPrayerRequests (ALLOW)
  await assertSucceeds(getDocs(collection(anonDb, 'communityPrayerRequests')));

  // CASO R13: Unauthenticated user attempts read on communityPrayerCommitments (DENY)
  await assertFails(getDoc(doc(anonDb, 'communityPrayerCommitments/prayer-public_user-a')));

  // CASO R14: Authenticated user attempts read on communityPrayerCommitments (DENY)
  await assertFails(getDoc(doc(userDb, 'communityPrayerCommitments/prayer-public_user-a')));

  // CASO R15: Authenticated user attempts write on communityPrayerCommitments (DENY)
  await assertFails(setDoc(doc(userDb, 'communityPrayerCommitments/prayer-public_user-a'), {
    requestId: 'prayer-public',
    ownerUid: 'user-a',
  }));

  // CASO R16: User attempts to list entire collection communityPrayerCommitments (DENY)
  await assertFails(getDocs(collection(userDb, 'communityPrayerCommitments')));

  const reaction = { postId: 'post-public', userId: 'user-a', reactions: { useful: true, thanks: false }, updatedAt: serverTimestamp() };
  await assertSucceeds(setDoc(doc(userDb, 'communityReactions/post-public_user-a'), reaction));
  await assertFails(setDoc(doc(userDb, 'communityReactions/duplicate'), reaction));
  await assertFails(setDoc(doc(userDb, 'communityReactions/nonexistent_user-a'), { ...reaction, postId: 'nonexistent' }));
  await assertFails(setDoc(doc(userDb, 'communityReactions/post-public_user-a'), { ...reaction, privileged: true }));
  await assertFails(updateDoc(doc(userBDb, 'communityReactions/post-public_user-a'), { reactions: { useful: false, thanks: true }, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(userDb, 'communityReactions/post-public_user-a'), { postId: 'different', updatedAt: serverTimestamp() }));
  await assertFails(setDoc(doc(userDb, 'communityReactions/post-public_user-a'), { ...reaction, updatedAt: new Date(0) }));
  await assertSucceeds(updateDoc(doc(userDb, 'communityReactions/post-public_user-a'), { reactions: { useful: false, thanks: true }, updatedAt: serverTimestamp() }));
  await assertSucceeds(deleteDoc(doc(userDb, 'communityReactions/post-public_user-a')));
  await assertFails(setDoc(doc(userDb, 'communityReports/forged'), { reportedBy: 'user-a', status: 'resolved' }));
  await assertFails(getDocs(collection(userDb, 'communityReports')));
  await assertFails(getDocs(collection(userDb, 'accountDeletionRequests')));
  await assertFails(setDoc(doc(userDb, 'accountDeletionRequests/forged'), { uid: 'user-a' }));
  await assertFails(getDoc(doc(userDb, 'communityBlocks/user-a/authors/user-b')));
  await assertFails(setDoc(doc(userDb, 'userMetrics/user-a'), { postsCreated: 9999 }));
  await assertFails(setDoc(doc(userDb, 'notifications/forged'), { userId: 'user-a', body: 'Forged' }));
  await testEnv.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'notifications/server-created'), { userId: 'user-a', body: 'Test', isRead: false }));
  await assertSucceeds(updateDoc(doc(userDb, 'notifications/server-created'), { isRead: true }));
  await assertFails(updateDoc(doc(userDb, 'notifications/server-created'), { body: 'Modified' }));
  await assertFails(updateDoc(doc(userBDb, 'notifications/server-created'), { isRead: false }));
  await testEnv.withSecurityRulesDisabled(async context => updateDoc(doc(context.firestore(), 'communityPosts/post-public'), { moderationStatus: 'hidden' }));
  await assertFails(setDoc(doc(userDb, 'communityReactions/post-public_user-a'), reaction));

  console.log('community rules tests passed (Oración R1-R16, unique reactions, schema, timestamps, moderation privacy)');
} finally {
  await testEnv.cleanup();
}
