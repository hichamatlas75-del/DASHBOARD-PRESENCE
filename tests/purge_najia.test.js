const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function createCtx() {
  const ctx = {
    console,
    Date,
    Math,
    JSON,
    Set,
    Map,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    firebase: {
      apps: [{ name: 'default' }],
      initializeApp: () => {},
      database: () => ({ ref: () => ({ once: async () => ({ val: () => ({}) }) }) }),
      auth: () => ({ currentUser: null })
    },
    database: { ref: () => ({ once: async () => ({ val: () => ({}) }) }) },
    auth: { currentUser: null },
    localStorage: { getItem: () => null, setItem: () => {} }
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('js/config.js', 'utf8'), ctx);
  return ctx;
}

// Test de non-régression : purge complète d'EL AZHARY NAJIA
test('Purge EL AZHARY NAJIA - config.js', () => {
  const ctx = createCtx();
  const equipe = vm.runInContext('equipe', ctx);
  const REMOVED_STAFF_IDS = vm.runInContext('REMOVED_STAFF_IDS', ctx);
  const haOnlyIds = vm.runInContext('haOnlyIds', ctx);
  const isRemovedStaff = ctx.isRemovedStaff;

  // 1. Vérifier qu'elle n'est plus dans l'équipe initiale
  const inEquipe = equipe.some(e =>
    (e.nom && e.nom.toUpperCase().includes('AZHARY')) ||
    (e.prenom && e.prenom.toUpperCase().includes('NAJIA'))
  );
  assert.strictEqual(inEquipe, false, 'EL AZHARY NAJIA ne doit pas être dans equipe');

  // 2. Vérifier qu'elle est bien dans REMOVED_STAFF_IDS
  assert.strictEqual(REMOVED_STAFF_IDS.has('EL_AZHARY_NAJIA'), true);
  assert.strictEqual(REMOVED_STAFF_IDS.has('NAJIA'), true);

  // 3. Vérifier isRemovedStaff pour différentes variantes
  assert.strictEqual(isRemovedStaff({ nom: 'EL AZHARY', prenom: 'NAJIA' }), true);
  assert.strictEqual(isRemovedStaff({ nom: 'AZHARY', prenom: 'NAJIA' }), true);
  assert.strictEqual(isRemovedStaff({ nom: 'El Azhary', prenom: 'Najia' }), true);

  // 4. Vérifier que Fouzia et Hakima restent bien actives
  assert.strictEqual(isRemovedStaff({ nom: 'EZHAR', prenom: 'FOUZIA' }), false);
  assert.strictEqual(isRemovedStaff({ nom: 'SBAI', prenom: 'HAKIMA' }), false);

  // 5. Vérifier qu'elle est exclue de haOnlyIds
  assert.strictEqual(haOnlyIds.has('EL_AZHARY_NAJIA'), false);
  assert.strictEqual(haOnlyIds.has('NAJIA'), false);
});
