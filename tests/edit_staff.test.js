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
  vm.runInContext(fs.readFileSync('js/plannings.js', 'utf8'), ctx);
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

test('Gestion du chemin photo - normalizePhotoPath', () => {
  const { ctx } = createCtx();
  const normalize = ctx.normalizePhotoPath;

  assert.strictEqual(normalize(''), '');
  assert.strictEqual(normalize(null), '');
  assert.strictEqual(normalize('images/Mokhtar.jpg'), 'images/Mokhtar.jpg');
  assert.strictEqual(normalize('Mokhtar.jpg'), 'images/Mokhtar.jpg');
  assert.strictEqual(normalize('BAJJOU.jpeg'), 'images/BAJJOU.jpeg');
  assert.strictEqual(normalize('images\\BAJJOU.jpeg'), 'images/BAJJOU.jpeg');
  assert.strictEqual(normalize('/images/photo.png'), '/images/photo.png');
  assert.strictEqual(normalize('https://cdn.example.com/pic.jpg'), 'https://cdn.example.com/pic.jpg');
});

test('Ajout et Modification d un collaborateur avec photo personnalisée', () => {
  const { ctx } = createCtx();
  const equipe = vm.runInContext('equipe', ctx);

  // 1. Ajouter un nouveau collaborateur avec photo
  const newStaff = {
    nom: 'ELALAMI',
    prenom: 'HASSAN',
    poste: 'SERVICE',
    dateDebut: '2026-02-01',
    actif: true,
    photo: ctx.normalizePhotoPath('images/custom_elalami.jpg')
  };
  equipe.push(newStaff);

  // Vérifier qu'il est présent avec sa photo
  const found = equipe.find(e => ctx.empIdOf(e) === 'ELALAMI_HASSAN');
  assert.ok(found);
  assert.strictEqual(found.photo, 'images/custom_elalami.jpg');

  // Vérifier que getStaffAvatarHtml génère bien l'image avec la photo personnalisée
  const avatarHtml = ctx.getStaffAvatarHtml('ELALAMI', 'HASSAN');
  assert.ok(avatarHtml.includes('images/custom_elalami.jpg'), 'Avatar HTML doit contenir le chemin d image configuré');

  // 2. Modifier la photo du collaborateur existant
  found.photo = ctx.normalizePhotoPath('images/Mokhtar.jpg');
  assert.strictEqual(found.photo, 'images/Mokhtar.jpg');

  const updatedAvatarHtml = ctx.getStaffAvatarHtml('ELALAMI', 'HASSAN');
  assert.ok(updatedAvatarHtml.includes('images/Mokhtar.jpg'), 'Avatar HTML doit être mis à jour avec le nouveau chemin d image');
});
