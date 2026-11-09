const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

function createCtx() {
  const savedData = {};
  const mockDb = {
    ref: (path) => ({
      once: async () => ({ val: () => savedData[path] || null }),
      set: async (val) => { savedData[path] = val; },
      update: async (val) => { Object.assign(savedData[path] || (savedData[path] = {}), val); }
    })
  };

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
      database: () => mockDb,
      auth: () => ({ currentUser: { email: 'gerant@greycorner.ma' } })
    },
    database: mockDb,
    auth: { currentUser: { email: 'gerant@greycorner.ma' } },
    localStorage: { getItem: () => null, setItem: () => {} },
    userRole: 'gerant'
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('js/config.js', 'utf8'), ctx);
  return { ctx, savedData };
}

test('Modification d un collaborateur - mise à jour des champs', () => {
  const { ctx } = createCtx();
  const equipe = vm.runInContext('equipe', ctx);

  // Trouver un collaborateur
  const target = equipe.find(e => ctx.empIdOf(e) === 'MAJDOUB_JIHANE');
  assert.ok(target, 'MAJDOUB JIHANE doit exister');

  // Modification : changement de poste et date de début
  target.poste = 'BAR';
  target.dateDebut = '2026-01-01';

  assert.strictEqual(target.poste, 'BAR');
  assert.strictEqual(target.dateDebut, '2026-01-01');
  assert.strictEqual(ctx.empIdOf(target), 'MAJDOUB_JIHANE');
});

test('Modification d un collaborateur - changement de nom sans collision', () => {
  const { ctx } = createCtx();
  const equipe = vm.runInContext('equipe', ctx);

  const targetIndex = equipe.findIndex(e => ctx.empIdOf(e) === 'MAJDOUB_JIHANE');
  assert.ok(targetIndex >= 0);

  const newNom = 'MAJDOUBI';
  const newPrenom = 'JIHANE';
  const newId = ctx.makeEmpId(newNom, newPrenom);

  // Vérifier qu'il n'y a pas d'autre employé avec cet ID
  const collision = equipe.some((e, i) => i !== targetIndex && ctx.empIdOf(e) === newId);
  assert.strictEqual(collision, false);

  equipe[targetIndex] = {
    ...equipe[targetIndex],
    nom: newNom,
    prenom: newPrenom
  };

  assert.strictEqual(ctx.empIdOf(equipe[targetIndex]), 'MAJDOUBI_JIHANE');
});

test('Modification d un collaborateur - détection de collision sur nom existant', () => {
  const { ctx } = createCtx();
  const equipe = vm.runInContext('equipe', ctx);

  const targetIndex = equipe.findIndex(e => ctx.empIdOf(e) === 'MAJDOUB_JIHANE');
  assert.ok(targetIndex >= 0);

  // Tenter de renommer en un collaborateur existant (ex: HATTAF MOHAMED)
  const existingOther = equipe.find(e => ctx.empIdOf(e) === 'HATTAF_MOHAMED');
  assert.ok(existingOther);

  const duplicateId = ctx.empIdOf(existingOther);
  const collision = equipe.some((e, i) => i !== targetIndex && ctx.empIdOf(e) === duplicateId);
  assert.strictEqual(collision, true, 'La collision avec un collaborateur existant doit être détectée');
});
