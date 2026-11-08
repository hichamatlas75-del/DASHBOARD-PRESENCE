/**
 * Tests Unitaires • Fonction getYearTimeline & Roulements R/C
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

describe('getYearTimeline() & evaluateEmployeeDay()', () => {

  it('génère la structure complète de la timeline annuelle sans erreur réseau', async () => {
    // Configurer un collaborateur test avec date de début
    ctx.setEquipe([
      { nom: 'TEST', prenom: 'Collaborateur', poste: 'SERVICE', dateDebut: '2026-01-01' }
    ]);

    const timeline = await ctx.getYearTimeline(2026);
    assert.ok(timeline, 'La timeline doit être retournée');
    assert.ok(timeline.rcByEmpDay, 'rcByEmpDay doit être défini');
    assert.ok(timeline.soldeByEmpMonth, 'soldeByEmpMonth doit être défini');
    assert.ok(timeline.currentSoldeByEmp, 'currentSoldeByEmp doit être défini');
    assert.ok(timeline.startMap, 'startMap doit être défini');
    assert.equal(timeline.startMap['TEST_COLLABORATEUR'], '2026-01-01');
  });

  it('évalue correctement un collaborateur présent à l heure', () => {
    const emp = { nom: 'TEST', prenom: 'Collaborateur', poste: 'SERVICE' };
    const rec = { hP: '09:00', hA: '08:55' };
    const ev = ctx.evaluateEmployeeDay(emp, '2026-02-10', rec, '', '2026-01-01');

    assert.equal(ev.type, 'present');
    assert.equal(ev.isPresent, true);
    assert.equal(ev.diff, 0, 'Pas de retard si arrivée avant l heure');
  });

  it('évalue correctement un retard en minutes (type "retard")', () => {
    const emp = { nom: 'TEST', prenom: 'Collaborateur', poste: 'SERVICE' };
    const rec = { hP: '09:00', hA: '09:25' };
    const ev = ctx.evaluateEmployeeDay(emp, '2026-02-10', rec, '', '2026-01-01');

    assert.equal(ev.type, 'retard', 'Le type doit être retard');
    assert.equal(ev.isPresent, true, 'Le collaborateur est présent');
    assert.equal(ev.diff, 25, 'Le retard doit être exactement de 25 minutes');
  });

  it('distingue un arrêt maladie (M) d un jour de repos (R) ou congé (C)', () => {
    const emp = { nom: 'TEST', prenom: 'Collaborateur', poste: 'SERVICE' };
    const recMaladie = { statut: 'MALADIE', maladie: true, lastEditByAdmin: true };
    const evMaladie = ctx.evaluateEmployeeDay(emp, '2026-02-10', recMaladie, 'M', '2026-01-01');

    assert.equal(evMaladie.type, 'maladie');
    assert.equal(evMaladie.isPresent, false);

    const evRepos = ctx.evaluateEmployeeDay(emp, '2026-02-11', null, 'R', '2026-01-01');
    assert.equal(evRepos.type, 'repos');
    assert.equal(evRepos.rc, 'R');

    const evConge = ctx.evaluateEmployeeDay(emp, '2026-02-12', null, 'C', '2026-01-01');
    assert.equal(evConge.type, 'conge');
    assert.equal(evConge.rc, 'C');
  });

  it('ignore les jours antérieurs à la date de début du collaborateur (type "avant")', () => {
    const emp = { nom: 'NOUVEAU', prenom: 'Recrue', poste: 'CUISINE', dateDebut: '2026-06-01' };
    const evAvant = ctx.evaluateEmployeeDay(emp, '2026-05-15', null, '', '2026-06-01');

    assert.equal(evAvant.type, 'avant', 'Avant la date d embauche, le statut doit être "avant"');
    assert.equal(evAvant.isPresent, false);
  });

});
