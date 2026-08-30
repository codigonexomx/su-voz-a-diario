import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const rootApp = readFileSync('js/app.js', 'utf8');
const mirrorApp = readFileSync('www/js/app.js', 'utf8');
const rootSearch = readFileSync('js/searchCommunity.js', 'utf8');
const mirrorSearch = readFileSync('www/js/searchCommunity.js', 'utf8');

assert.equal(mirrorApp, rootApp, 'www/js/app.js debe estar sincronizado con js/app.js');
assert.equal(mirrorSearch, rootSearch, 'www/js/searchCommunity.js debe estar sincronizado con js/searchCommunity.js');

assert.match(rootApp, /isCommunityAnonymousIdentity: function\(item\)/, 'Debe existir un helper unico para identidad anonima');
assert.match(rootApp, /item\?\.isAnonymous === true/, 'Caso schemaVersion 3 anonimo debe depender de isAnonymous true');
assert.match(rootApp, /item\.name\.trim\(\)\.toLowerCase\(\) === 'anónimo'/, 'Legacy anonimo con name Anonimo debe seguir reconocido');

assert.doesNotMatch(
    rootApp,
    /const displayAuthorName = isAnonymous \? 'Alguien de la comunidad' : authorName;/,
    'Posts anonimos no deben renderizar Alguien de la comunidad'
);
assert.match(rootApp, /const displayAuthorName = authorName;/, 'Posts deben mostrar el nombre publico calculado');
assert.match(
    rootApp,
    /const authorName = isAnonymous\s+\? 'Anónimo'\s+: this\.getCommunityAuthorDisplayName\(post, userProfile\);/,
    'Post anonimo debe renderizar Anonimo y post identificado debe conservar su nombre'
);
assert.match(
    rootApp,
    /const replyAuthorName = isReplyAnon\s+\? 'Anónimo'\s+: this\.getCommunityAuthorDisplayName\(reply, replyProfile\);/,
    'Reply anonima debe renderizar Anonimo y reply identificada debe conservar su nombre'
);

const profileCatch = rootApp.slice(
    rootApp.indexOf('const snapshot = await fns.getDoc(fns.doc(dbRef, \'communityProfiles\', user.uid));'),
    rootApp.indexOf('getCommunityIdentityInitialState: function()')
);
assert.match(profileCatch, /if \(this\.isCommunityPermissionDeniedError\(error\)\)/, 'permission-denied debe tener manejo especifico');
assert.match(profileCatch, /console\.debug\(/, 'permission-denied puede registrarse solo como debug no invasivo');
assert.match(profileCatch, /console\.warn\('\[Community Identity\] No se pudo leer communityProfiles:', error\);/, 'Errores inesperados deben seguir reportandose');
assert.ok(
    profileCatch.indexOf('console.warn') > profileCatch.indexOf('isCommunityPermissionDeniedError'),
    'El warning debe quedar fuera de la rama permission-denied'
);
assert.match(
    rootApp,
    /return code\.includes\('permission-denied'\) \|\|\s+message\.includes\('permission-denied'\) \|\|\s+message\.includes\('missing or insufficient permissions'\);/,
    'Detector debe reconocer permission-denied y el mensaje real de Firebase'
);

assert.match(rootSearch, /getDisplayName\(post\)/, 'Busqueda debe usar helper de nombre visible');
assert.match(rootSearch, /post\?\.isAnonymous === true/, 'Busqueda debe priorizar anonimato explicito');
assert.match(rootSearch, /return 'Anónimo';/, 'Busqueda debe renderizar Anonimo para contenido anonimo');

const addPostSegment = rootApp.slice(
    rootApp.indexOf('async addCommunityPost(post)'),
    rootApp.indexOf('async deleteCommunityPost(postId)')
);
assert.match(
    addPostSegment,
    /this\.getCommunityIdentityCallable\('createCommunityPost'\)/,
    'Publicacion debe seguir dependiendo de la Function createCommunityPost'
);
assert.doesNotMatch(
    addPostSegment,
    /addDoc\([^)]*communityPosts/,
    'No debe existir bypass local que escriba communityPosts directamente'
);

const addReplySegment = rootApp.slice(
    rootApp.indexOf('async addCommunityReply(reply)'),
    rootApp.indexOf('async deleteCommunityReply(replyId)')
);
assert.match(
    addReplySegment,
    /this\.getCommunityIdentityCallable\('createCommunityReply'\)/,
    'Reply debe seguir dependiendo de la Function createCommunityReply'
);
assert.doesNotMatch(
    addReplySegment,
    /addDoc\([^)]*communityReplies/,
    'No debe existir bypass local que escriba communityReplies directamente'
);

console.log('Community hotfix 203 checks passed');
