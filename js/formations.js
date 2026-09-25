/**
 * formations.js — knihovna rozestavení (jedním klikem postavit pětku).
 *
 * Pozice vycházejí z playbooku dorostu TKS 2024/25 (František Záleský) a jsou
 * odečtené z obrázků, takže jde o přiblížení na cca 1 m. Značení systémů je
 * počítané OD VLASTNÍ BRANKY (safety = 1‑2‑2, hrot = 2‑2‑1), playbook sám
 * počítá od soupeřovy branky — proto je u každého rozestavení i popis rolí.
 *
 * Souřadnice: metry, vlastní branka VLEVO (x = 0), útočíme doprava.
 * Pro soupeře se rozestavení zrcadlí (x' = 40 − x) a hráči jsou modří.
 *
 * Čísla hráčů (n) odpovídají číslům v playbooku, aby se dalo odkazovat na
 * jeho popisy ("podhrot ze slabé strany (3)…").
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});
  const S = FB.scene;
  const COURT_W = S.COURT.width;

  const GOALIE = { n: 'G', x: 4.2, y: 10 };

  const PRESETS = [
    // ------------------------------------------------------------------ obrana
    {
      id: 'safety',
      group: 'Obrana proti rozehrávce',
      name: 'Safety (1‑2‑2)',
      description: 'Hroti (1, 2) na 60 % hřiště dělají kyvadlo, podhroti (3, 4) '
        + 'začínají na vlastní polovině a zavírají střed, safety (5) řídí hru.',
      players: [
        { n: 1, x: 24.5, y: 6, role: 'hrot' },
        { n: 2, x: 24.5, y: 14, role: 'hrot' },
        { n: 3, x: 17, y: 6, role: 'podhrot' },
        { n: 4, x: 17, y: 14, role: 'podhrot' },
        { n: 5, x: 10.5, y: 10, role: 'safety' },
      ],
    },
    {
      id: 'hrot',
      group: 'Obrana proti rozehrávce',
      name: 'Hrot (2‑2‑1)',
      description: 'Hrot (1) půlí hru, podhroti (2, 3) dostupují střed v kyvadle, '
        + 'beci (4, 5) čekají na přihrávku po mantinelu a hrají souboj.',
      players: [
        { n: 1, x: 24.5, y: 10, role: 'hrot' },
        { n: 2, x: 16.5, y: 6.5, role: 'podhrot' },
        { n: 3, x: 16.5, y: 13.5, role: 'podhrot' },
        { n: 4, x: 9.5, y: 6.5, role: 'bek' },
        { n: 5, x: 9.5, y: 13.5, role: 'bek' },
      ],
    },
    {
      id: 'centr',
      group: 'Obrana proti rozehrávce',
      name: 'Centr (2‑1‑2)',
      description: 'Dva hroti (1, 2), centr (3) na středu hřiště, dva beci (4, 5). '
        + 'Symetrická varianta; kapsy vznikají po stranách centra.',
      players: [
        { n: 1, x: 25.5, y: 6.5, role: 'hrot' },
        { n: 2, x: 25.5, y: 13.5, role: 'hrot' },
        { n: 3, x: 20, y: 10, role: 'centr' },
        { n: 4, x: 13.5, y: 6.5, role: 'bek' },
        { n: 5, x: 13.5, y: 13.5, role: 'bek' },
      ],
    },
    {
      id: 'w',
      group: 'Obrana proti rozehrávce',
      name: 'W (2‑1‑2 cik cak)',
      description: 'Tři hráči (1, 3, 4) blíž k jednomu mantinelu, dva (2, 5) k druhému; '
        + 'z výšky tvoří písmeno W. Nesymetrické, zahušťuje střed do hloubky.',
      players: [
        { n: 1, x: 29, y: 6.5, role: 'hrot' },
        { n: 2, x: 24, y: 13.5, role: 'hrot' },
        { n: 3, x: 19, y: 6.5, role: 'střed' },
        { n: 5, x: 14, y: 13.5, role: 'bek' },
        { n: 4, x: 9.5, y: 6.5, role: 'bek' },
      ],
    },
    {
      id: 'oslabeni',
      group: 'Obrana proti rozehrávce',
      name: 'Oslabení – lichoběžník',
      description: 'Dva dole (3, 4), dva nahoře (1, 2). Pravý horní (2) půlí hru a tlačí '
        + 'soupeře na jednu stranu, levý (1) drží osu a blokuje střelu.',
      players: [
        { n: 1, x: 13.5, y: 11, role: 'horní' },
        { n: 2, x: 15, y: 7, role: 'horní' },
        { n: 3, x: 8.8, y: 12, role: 'dolní' },
        { n: 4, x: 8.7, y: 8.5, role: 'dolní' },
      ],
      // soupeřova přesilovka pro kontext (x už v našich souřadnicích, ne zrcadlit)
      opponents: [
        { n: 1, x: 18, y: 9.7 },
        { n: 2, x: 13.5, y: 3.7 },
        { n: 3, x: 15, y: 15.8 },
        { n: 4, x: 7, y: 9.7 },
        { n: 5, x: 8.7, y: 16.3 },
      ],
      ball: { x: 17.3, y: 9.2 },
    },

    // ------------------------------------------------------------------- útok
    {
      id: 'utok_3_1',
      group: 'Postupný útok',
      name: 'Od tří + jeden hrot',
      description: 'Tři rozehrávající (3, 4, 5), jeden mezi bránícími hráči (2), '
        + 'hrot (1) na brankovišti soupeře. Univerzální, proti 2‑2‑1 a 2‑1‑2.',
      players: [
        { n: 1, x: 34, y: 10, role: 'hrot' },
        { n: 2, x: 22.5, y: 10, role: 'střed' },
        { n: 3, x: 13.5, y: 1.5, role: 'rozehrávka' },
        { n: 4, x: 9, y: 10, role: 'rozehrávka' },
        { n: 5, x: 13, y: 18.5, role: 'rozehrávka' },
      ],
      ball: { x: 9.9, y: 10.5 },
    },
    {
      id: 'utok_3_2',
      group: 'Postupný útok',
      name: 'Od tří + dva hroti',
      description: 'Tři rozehrávající (3, 4, 5), dva hroti (1, 2) na brankovišti soupeře. '
        + 'Když se potřebuji jednoduše dostat dopředu.',
      players: [
        { n: 1, x: 33.5, y: 7.8, role: 'hrot' },
        { n: 2, x: 33.5, y: 12.2, role: 'hrot' },
        { n: 3, x: 13.5, y: 1.5, role: 'rozehrávka' },
        { n: 4, x: 9, y: 10, role: 'rozehrávka' },
        { n: 5, x: 13, y: 18.5, role: 'rozehrávka' },
      ],
      ball: { x: 9.9, y: 10.5 },
    },
    {
      id: 'utok_2_1',
      group: 'Postupný útok',
      name: 'Od dvou + jeden hrot',
      description: 'Dva rozehrávající (4, 5), dva ve středním pásmu (2, 3) si vyměňují '
        + 'kapsu a střed, hrot (1) na brankovišti. Proti 1‑2‑2 a W.',
      players: [
        { n: 1, x: 34, y: 10, role: 'hrot' },
        { n: 2, x: 22, y: 1.5, role: 'kapsa' },
        { n: 3, x: 20, y: 10, role: 'střed' },
        { n: 4, x: 11, y: 1.5, role: 'rozehrávka' },
        { n: 5, x: 11, y: 18.5, role: 'rozehrávka' },
      ],
      ball: { x: 11.8, y: 2.1 },
    },
    {
      id: 'utok_2_2',
      group: 'Postupný útok',
      name: 'Od dvou + dva hroti',
      description: 'Dva rozehrávající (4, 5), jeden na středu (3), dva hroti (1, 2) '
        + 'na brankovišti soupeře. Proti W a 1‑2‑2.',
      players: [
        { n: 1, x: 33.5, y: 7.8, role: 'hrot' },
        { n: 2, x: 33.5, y: 12.2, role: 'hrot' },
        { n: 3, x: 20, y: 10, role: 'střed' },
        { n: 4, x: 11, y: 1.7, role: 'rozehrávka' },
        { n: 5, x: 11.8, y: 18.5, role: 'rozehrávka' },
      ],
      ball: { x: 11.8, y: 2.3 },
    },
    {
      id: 'utocne_131',
      group: 'Útočné pásmo',
      name: 'Útočné pásmo 1‑3‑1',
      description: 'Hráč na brankovišti (1), hráč na středu (3), krajní hráči (2, 4) '
        + 'a point (5). Délka, šířka i střed hřiště.',
      players: [
        { n: 1, x: 34.6, y: 10, role: 'brankoviště' },
        { n: 2, x: 29, y: 2.5, role: 'krajní' },
        { n: 3, x: 29, y: 10, role: 'střed' },
        { n: 4, x: 29, y: 16.5, role: 'krajní' },
        { n: 5, x: 22, y: 10, role: 'point' },
      ],
      ball: { x: 28.2, y: 3 },
    },
    {
      id: 'presilovka',
      group: 'Útočné pásmo',
      name: 'Přesilová hra',
      description: 'Point (1) řídí hru, krajní (2, 3) se tlačí ke středu na střelu z první, '
        + 'spodní hráči (4, 5) se prohazují podle míčku.',
      players: [
        { n: 1, x: 21.5, y: 9.6, role: 'point' },
        { n: 2, x: 27, y: 3.6, role: 'krajní' },
        { n: 3, x: 27, y: 15.3, role: 'krajní' },
        { n: 4, x: 30, y: 9.6, role: 'spodní' },
        { n: 5, x: 33.7, y: 15.7, role: 'spodní' },
      ],
      ball: { x: 20.7, y: 9.6 },
    },
  ];

  function getPreset(id) {
    return PRESETS.find(function (p) { return p.id === id; }) || null;
  }

  function groups() {
    const out = [];
    PRESETS.forEach(function (p) {
      let g = out.find(function (x) { return x.name === p.group; });
      if (!g) { g = { name: p.group, presets: [] }; out.push(g); }
      g.presets.push(p);
    });
    return out;
  }

  /**
   * Přiřadí hráče ze sestavy k pozicím rozestavení: brankář → brankář,
   * dva nejhlubší hráči → obránci, ostatní → útočníci; co chybí, doplní
   * kýmkoliv nepoužitým. Vrací mapu n → rosterPlayer (nebo null).
   */
  function assignRoster(roster, players) {
    const used = new Set();
    function take(position) {
      const p = roster.find(function (r) { return !used.has(r.id) && (!position || r.position === position); });
      if (p) used.add(p.id);
      return p || null;
    }
    const byDepth = players.slice().sort(function (a, b) { return a.x - b.x; });
    const wanted = {};
    byDepth.forEach(function (pl, i) {
      wanted[pl.n] = i < 2 ? S.POSITIONS.DEFENDER : S.POSITIONS.FORWARD;
    });
    const map = {};
    // nejdřív podle pozice…
    players.forEach(function (pl) { map[pl.n] = take(wanted[pl.n]); });
    // …pak doplnit zbylými
    players.forEach(function (pl) { if (!map[pl.n]) map[pl.n] = take(null); });
    map.G = take(S.POSITIONS.GOALIE);
    return map;
  }

  /**
   * Postaví rozestavení do dané fáze.
   *
   * @param {Object} scene
   * @param {number} phaseIndex
   * @param {string} presetId
   * @param {Object} [options]
   * @param {'home'|'away'} [options.team='home']  pro soupeře se zrcadlí
   * @param {boolean} [options.useRoster=true]     domácí hráči ze sestavy, je‑li
   * @param {boolean} [options.withGoalie=true]
   * @returns {string[]} id vytvořených objektů
   */
  function apply(scene, phaseIndex, presetId, options) {
    const preset = getPreset(presetId);
    if (!preset) throw new Error('formations: neznámé rozestavení "' + presetId + '"');
    const opts = options || {};
    const team = opts.team === S.TEAMS.AWAY ? S.TEAMS.AWAY : S.TEAMS.HOME;
    const mirror = team === S.TEAMS.AWAY;
    const phase = S.getPhase(scene, phaseIndex);
    if (!phase) throw new Error('formations: fáze ' + phaseIndex + ' neexistuje');

    const mx = function (x) { return mirror ? COURT_W - x : x; };
    const rot = mirror ? 180 : 0;

    // Odstranit stávající hráče tohoto týmu (a míček, pokud ho preset nese)
    const removeTeams = new Set([team]);
    if (preset.opponents && !mirror) removeTeams.add(S.TEAMS.AWAY);
    phase.objects = phase.objects.filter(function (o) {
      if (o.type === S.OBJECT_TYPES.PLAYER && removeTeams.has(o.team)) return false;
      if (o.type === S.OBJECT_TYPES.BALL && preset.ball) return false;
      return true;
    });

    const created = [];
    const useRoster = opts.useRoster !== false && !mirror && scene.roster.length > 0;
    const rosterMap = useRoster ? assignRoster(scene.roster, preset.players) : {};

    function addPlayer(spec, t, r) {
      const rp = useRoster && t === S.TEAMS.HOME ? rosterMap[spec.n] : null;
      const obj = S.createObject(S.OBJECT_TYPES.PLAYER, {
        x: mx(spec.x), y: spec.y, rotation: r, team: t,
        playerId: rp ? rp.id : null,
        label: rp ? '' : String(spec.n),
        goalie: spec.n === 'G' || (rp ? rp.position === S.POSITIONS.GOALIE : false),
      });
      S.addObject(scene, phaseIndex, obj);
      created.push(obj.id);
    }

    preset.players.forEach(function (pl) { addPlayer(pl, team, rot); });
    if (opts.withGoalie !== false) addPlayer(GOALIE, team, rot);

    if (preset.opponents && !mirror) {
      preset.opponents.forEach(function (pl) { addPlayer(pl, S.TEAMS.AWAY, 180); });
      addPlayer({ n: 'G', x: COURT_W - GOALIE.x, y: GOALIE.y }, S.TEAMS.AWAY, 180);
    }

    if (preset.ball) {
      const ball = S.createObject(S.OBJECT_TYPES.BALL, { x: mx(preset.ball.x), y: preset.ball.y });
      S.addObject(scene, phaseIndex, ball);
      created.push(ball.id);
    }

    return created;
  }

  FB.formations = {
    PRESETS: PRESETS,
    getPreset: getPreset,
    groups: groups,
    apply: apply,
  };
})(window);
