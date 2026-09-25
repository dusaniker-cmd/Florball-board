/**
 * examples.js — registr vestavěných animovaných ukázek a jejich sestavení do scény.
 *
 * Samotná data ukázek jsou ve složce js/examples/ po skupinách (jeden soubor =
 * jedna skupina v nabídce Načíst), např. playbook.js, reserse-obrana.js.
 * Každý soubor volá FB.examples.register(group, [ukázky]).
 *
 * Formát ukázky:
 *   { id, name, source, phases: [ { name, duration, note,
 *       home: { 1: [x, y, rot?], …, G: [x, y] },   // G nepovinné, jinak výchozí branka
 *       away: { … },                                // nepovinné
 *       ball: [x, y] } ] }
 *
 * Objekty mají pevná id (h1…, hG, a1…, aG, ball, note), aby se mezi fázemi
 * párovaly a přehrávač je mohl interpolovat. Souřadnice v metrech, vlastní
 * branka vlevo, soupeř útočí doleva. Pozice jsou přiblížení (cca 1 m).
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});
  const S = FB.scene;

  const HOME_GOALIE = [4.2, 10];
  const AWAY_GOALIE = [35.8, 10];

  /** [{ name, examples: [...] }] v pořadí registrace */
  const GROUPS = [];

  function register(groupName, examples) {
    let g = GROUPS.find(function (x) { return x.name === groupName; });
    if (!g) { g = { name: groupName, examples: [] }; GROUPS.push(g); }
    examples.forEach(function (ex) {
      if (getExample(ex.id)) throw new Error('examples: duplicitní id "' + ex.id + '"');
      g.examples.push(ex);
    });
  }

  function all() {
    return GROUPS.reduce(function (acc, g) { return acc.concat(g.examples); }, []);
  }

  function getExample(id) {
    return all().find(function (e) { return e.id === id; }) || null;
  }

  /** Postaví scénu z popisu ukázky. */
  function build(id) {
    const ex = getExample(id);
    if (!ex) throw new Error('examples: neznámá ukázka "' + id + '"');

    const scene = S.createScene({ name: ex.name });
    scene.phases = ex.phases.map(function (ph, i) {
      const objects = [];

      function player(idPrefix, n, pos, team) {
        objects.push(S.createObject(S.OBJECT_TYPES.PLAYER, {
          id: idPrefix + n,
          x: pos[0], y: pos[1],
          rotation: typeof pos[2] === 'number' ? pos[2] : (team === S.TEAMS.AWAY ? 180 : 0),
          team: team,
          label: String(n),
          goalie: n === 'G',
        }));
      }

      const home = ph.home || {};
      Object.keys(home).forEach(function (n) {
        if (n !== 'G') player('h', n, home[n], S.TEAMS.HOME);
      });
      player('h', 'G', home.G || HOME_GOALIE, S.TEAMS.HOME);

      if (ph.away) {
        Object.keys(ph.away).forEach(function (n) {
          if (n !== 'G') player('a', n, ph.away[n], S.TEAMS.AWAY);
        });
        player('a', 'G', ph.away.G || AWAY_GOALIE, S.TEAMS.AWAY);
      }
      if (ph.ball) {
        objects.push(S.createObject(S.OBJECT_TYPES.BALL, { id: 'ball', x: ph.ball[0], y: ph.ball[1] }));
      }
      if (ph.note) {
        objects.push(S.createObject(S.OBJECT_TYPES.TEXT, {
          id: 'note', x: 20, y: -1.25, text: ph.note, fontSize: 0.7, maxWidth: 38, color: '#e6e9ef',
        }));
      }

      return S.createPhase({
        name: (i + 1) + '. ' + (ph.name || ''),
        duration: ph.duration || 1800,
        objects: objects,
      });
    });
    return scene;
  }

  FB.examples = {
    GROUPS: GROUPS,
    register: register,
    all: all,
    getExample: getExample,
    build: build,
  };
})(window);
