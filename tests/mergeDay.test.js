/**
 * Tests Unitaires • Fonction mergeDay (Fusion Présences, Pointages & Motifs)
 * Direction Hub • Grey Corner
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');

let ctx;

function createMockDatabase() {
  const makeRef = () => {
    const q = {
      orderByKey: () => q,
      startAt: () => q,
      endAt: () => q,
      once: async () => ({ val: () => ({}) }),
      on: () => {},
      off: () => {}
    };
    return q;
  };
  return { ref: makeRef };
}

before(() => {
  const mockDb = createMockDatabase();
  ctx = {
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
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
      auth: () => ({ currentUser: null })
    },
    database: mockDb,
    auth: { currentUser: null },
    localStorage: { getItem: () => null, setItem: () => {} }
  };
  ctx.window = ctx;
  vm.createContext(ctx);

  vm.runInContext(fs.readFileSync('js/config.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('js/plannings.js', 'utf8'), ctx);
  vm.runInContext(fs.readFileSync('js/data-service.js', 'utf8'), ctx);
});

describe('mergeDay() - Fusion et Normalisation Journalière', () => {

  it('fusionne correctement un pointage et une présence pour le même collaborateur', () => {
    const pres = {
      "BOURAHMA_ANAS": { hP: "09:00", hA: "09:05", statut: "PRESENT" }
    };
    const punch = {
      "BOURAHMA_ANAS": { hA: "09:03", distanceM: 42, accuracyM: 10 }
    };
    const motifs = {};

    const merged = ctx.mergeDay(pres, punch, motifs);
    const anas = merged["BOURAHMA_ANAS"];

    assert.ok(anas, 'Le collaborateur doit être présent dans le merge');
    assert.equal(anas.hP, "09:00");
    assert.equal(anas.hA, "09:03", 'L heure de pointage réelle (punch) doit primer sur le prévisionnel');
    assert.equal(anas.dist, 42);
    assert.equal(anas.acc, 10);
  });

  it('résout sans collision les homonymies partielles (Najia EL AZHARY vs Fouzia EZHAR)', () => {
    const pres = {
      "EL_AZHARY_NAJIA": { hP: "10:00", hA: "10:00" },
      "EZHAR_FOUZIA": { hP: "17:00", hA: "17:05" }
    };
    const punch = {
      "EZHAR_FOUZIA": { hA: "17:02" }
    };

    const merged = ctx.mergeDay(pres, punch, {});
    assert.equal(merged["EL_AZHARY_NAJIA"].hA, "10:00");
    assert.equal(merged["EZHAR_FOUZIA"].hA, "17:02");
    assert.notEqual(merged["EL_AZHARY_NAJIA"].hA, merged["EZHAR_FOUZIA"].hA);
  });

  it('valide un arrêt maladie signé par un administrateur (lastEditByAdmin: true)', () => {
    const pres = {
      "BOURAHMA_ANAS": { statut: "MALADIE", maladie: true, lastEditByAdmin: true }
    };
    const motifs = {
      "BOURAHMA_ANAS": { motif: "[MALADIE] Grippe saisonnière", lastEditByAdmin: true }
    };

    const merged = ctx.mergeDay(pres, {}, motifs);
    const rec = merged["BOURAHMA_ANAS"];
    assert.ok(rec);
    assert.equal(ctx.isExplicitMaladie(rec), true);
    assert.equal(rec.statut, "MALADIE");
  });

  it('bloque la forge de statut maladie non signée par admin (lastEditByAdmin: false)', () => {
    const motifs = {
      "BOURAHMA_ANAS": { motif: "[MALADIE] Fausse déclaration", lastEditByAdmin: false }
    };

    const merged = ctx.mergeDay({}, {}, motifs);
    const rec = merged["BOURAHMA_ANAS"];
    assert.equal(ctx.isExplicitMaladie(rec), false, 'Un tag [MALADIE] sans signature admin ne doit pas conférer le statut maladie');
  });

  it('conserve les métadonnées de géolocalisation et de précision', () => {
    const punch = {
      "MAJDOUB_JIHANE": { hA: "08:58", distanceM: 15, accuracyM: 5 }
    };
    const merged = ctx.mergeDay({}, punch, {});
    assert.equal(merged["MAJDOUB_JIHANE"].dist, 15);
    assert.equal(merged["MAJDOUB_JIHANE"].acc, 5);
  });

});
