/**
 * scene.js — čistý datový model taktiky.
 *
 * Neví nic o canvasu, fázích v čase ani UI. Všechno je obyčejný JSON
 * (žádné třídy s metodami v datech), takže se dá přímo uložit / načíst.
 *
 * Souřadnice objektů jsou v "hřišťových" jednotkách = metry, počátek v levém
 * horním rohu hřiště, osa x doprava (0..40), osa y dolů (0..20). Renderer si je
 * sám přepočítá na pixely, takže model nezávisí na velikosti canvasu.
 *
 * Tvar dat:
 *   Scene {
 *     version, court, roster: [Player], phases: [Phase]
 *   }
 *   Phase   { id, name, duration (ms do další fáze), objects: [Object] }
 *   Object  { id, type, ...vlastnosti podle typu }  — stejné id napříč fázemi
 *   Player  { id, name, number, position }          — člen sestavy
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});

  const SCENE_VERSION = 1;

  /** Rozměry florbalového hřiště v metrech (IFF: 40 x 20 m). */
  const COURT = Object.freeze({ width: 40, height: 20 });

  const OBJECT_TYPES = Object.freeze({
    PLAYER: 'player',
    BALL: 'ball',
    ARROW: 'arrow',
    LINE: 'line',
    TEXT: 'text',
    ZONE: 'zone',
    PEN: 'pen',
  });

  const POSITIONS = Object.freeze({
    GOALIE: 'goalie',
    DEFENDER: 'defender',
    FORWARD: 'forward',
  });

  const TEAMS = Object.freeze({ HOME: 'home', AWAY: 'away' });

  const TEAM_COLORS = Object.freeze({
    home: '#d63a2f',
    away: '#2f6fd6',
  });

  const DEFAULT_PHASE_DURATION = 1500;

  // ---------------------------------------------------------------------------
  // Pomocné
  // ---------------------------------------------------------------------------

  let idCounter = 0;

  /** Krátké unikátní id; prefix rozliší objekty (o), fáze (p), hráče sestavy (r). */
  function uid(prefix) {
    idCounter += 1;
    return (prefix || 'o') + '_' + Date.now().toString(36) + '_' + idCounter.toString(36);
  }

  /** Hluboká kopie čistých dat (model je záměrně jen JSON, takže to stačí). */
  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assert(condition, message) {
    if (!condition) throw new Error('scene: ' + message);
  }

  // ---------------------------------------------------------------------------
  // Výchozí vlastnosti objektů podle typu
  // ---------------------------------------------------------------------------

  const OBJECT_DEFAULTS = {
    player: {
      x: 20, y: 10,
      rotation: 0,            // stupně, 0 = směr doprava (kladná osa x)
      team: TEAMS.HOME,
      color: TEAM_COLORS.home,
      label: '',              // ruční popisek; přebije ho číslo hráče ze sestavy
      playerId: null,         // odkaz do scene.roster
      goalie: false,          // brankář: bez hole
      radius: 0.8,
    },
    ball: {
      x: 20, y: 10,
      color: '#ffffff',
      radius: 0.35,
    },
    arrow: {
      points: [{ x: 15, y: 10 }, { x: 25, y: 10 }],
      color: '#111111',
      width: 0.15,
      dashed: false,
    },
    line: {
      points: [{ x: 15, y: 10 }, { x: 25, y: 10 }],
      color: '#111111',
      width: 0.15,
      dashed: false,
    },
    text: {
      x: 20, y: 10,
      text: 'Text',
      color: '#111111',
      fontSize: 1.2,          // v metrech, aby škáloval s hřištěm
    },
    zone: {
      x: 15, y: 7, w: 10, h: 6,
      shape: 'rect',          // 'rect' | 'ellipse'
      color: '#f5b400',
      opacity: 0.3,
    },
    pen: {
      points: [],
      color: '#111111',
      width: 0.12,
    },
  };

  // ---------------------------------------------------------------------------
  // Tovární funkce
  // ---------------------------------------------------------------------------

  function createScene(options) {
    const opts = options || {};
    return {
      version: SCENE_VERSION,
      name: opts.name || 'Nová taktika',
      court: opts.court || 'floorball',
      roster: [],
      phases: [createPhase({ name: 'Fáze 1' })],
    };
  }

  function createPhase(options) {
    const opts = options || {};
    return {
      id: uid('p'),
      name: opts.name || '',
      duration: typeof opts.duration === 'number' ? opts.duration : DEFAULT_PHASE_DURATION,
      objects: opts.objects ? deepClone(opts.objects) : [],
    };
  }

  /**
   * Nový objekt daného typu. `props` přepisují výchozí hodnoty.
   * Barva hráče se odvodí z týmu, pokud není explicitně zadaná.
   */
  function createObject(type, props) {
    assert(OBJECT_DEFAULTS[type], 'neznámý typ objektu "' + type + '"');
    const obj = Object.assign({ id: uid('o'), type: type }, deepClone(OBJECT_DEFAULTS[type]), props || {});
    if (type === OBJECT_TYPES.PLAYER && !(props && props.color) && TEAM_COLORS[obj.team]) {
      obj.color = TEAM_COLORS[obj.team];
    }
    return obj;
  }

  function createRosterPlayer(props) {
    const p = props || {};
    return {
      id: uid('r'),
      name: p.name || '',
      number: p.number != null ? p.number : null,
      position: p.position || POSITIONS.FORWARD,
    };
  }

  // ---------------------------------------------------------------------------
  // Fáze
  // ---------------------------------------------------------------------------

  function getPhase(scene, index) {
    return scene.phases[index] || null;
  }

  function getPhaseIndex(scene, phaseId) {
    return scene.phases.findIndex(function (p) { return p.id === phaseId; });
  }

  /**
   * Přidá novou fázi za fázi na `afterIndex` (výchozí = poslední).
   * Objekty se zkopírují ze zdrojové fáze SE STEJNÝMI id — to je základ
   * pro párování objektů napříč fázemi při interpolaci.
   */
  function addPhase(scene, afterIndex) {
    const srcIndex = typeof afterIndex === 'number' ? afterIndex : scene.phases.length - 1;
    const src = scene.phases[srcIndex];
    const phase = createPhase({
      name: 'Fáze ' + (scene.phases.length + 1),
      duration: src ? src.duration : DEFAULT_PHASE_DURATION,
      objects: src ? src.objects : [],
    });
    // Ohnutí dráhy (`bend`) popisuje přechod do NÁSLEDUJÍCÍ fáze. Nová fáze je
    // vložená za zdrojovou, takže si ohnutí bere s sebou (zachová dráhu do staré
    // následující fáze) a zdrojová fáze ho ztrácí (přechod na kopii je nulový).
    if (src) {
      src.objects.forEach(function (o) { delete o.bend; });
    }
    scene.phases.splice(srcIndex + 1, 0, phase);
    return phase;
  }

  // ---------------------------------------------------------------------------
  // Dráha pohybu mezi fázemi
  //
  // Objekt v jedné fázi může mít `bend: {x, y}`: bod, kterým prochází jeho dráha
  // do další fáze v polovině cesty. Dráha je kvadratická Bézierova křivka
  // A → B a `bend` je její bod pro t = 0,5. Bez `bend` je dráha přímá.
  // ---------------------------------------------------------------------------

  /** Pod touto vzdáleností (m) se pohyb považuje za žádný: bez šipky a bez ohnutí. */
  const MIN_MOVE = 0.4;

  function moveDistance(a, b) {
    return Math.hypot(b.x - a.x, b.y - a.y);
  }

  /** Řídicí bod křivky. Bez ohnutí střed úsečky A–B (křivka je přímka). */
  function routeControl(a, b) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    if (!a.bend) return { x: mx, y: my };
    return { x: 2 * a.bend.x - mx, y: 2 * a.bend.y - my };
  }

  /** Bod na dráze v čase t (0..1) z A do B. */
  function routePoint(a, b, t) {
    if (!a.bend || moveDistance(a, b) < MIN_MOVE) {
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    const c = routeControl(a, b);
    const u = 1 - t;
    return {
      x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
      y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
    };
  }

  /** Bod, který uživatel chytá pro ohnutí: střed dráhy (t = 0,5). */
  function routeMid(a, b) {
    return routePoint(a, b, 0.5);
  }

  /** Smaže fázi; poslední zbývající fázi smazat nelze. */
  function removePhase(scene, phaseId) {
    assert(scene.phases.length > 1, 'nelze smazat poslední fázi');
    const index = getPhaseIndex(scene, phaseId);
    if (index === -1) return false;
    scene.phases.splice(index, 1);
    return true;
  }

  function movePhase(scene, fromIndex, toIndex) {
    const moved = scene.phases.splice(fromIndex, 1);
    scene.phases.splice(toIndex, 0, moved[0]);
  }

  /** Celková délka animace v ms (poslední fáze se nepočítá, nemá kam přejít). */
  function totalDuration(scene) {
    return scene.phases.slice(0, -1).reduce(function (sum, p) { return sum + p.duration; }, 0);
  }

  // ---------------------------------------------------------------------------
  // Objekty
  // ---------------------------------------------------------------------------

  function findObject(phase, objectId) {
    return phase.objects.find(function (o) { return o.id === objectId; }) || null;
  }

  function addObject(scene, phaseIndex, obj) {
    const phase = getPhase(scene, phaseIndex);
    assert(phase, 'fáze ' + phaseIndex + ' neexistuje');
    phase.objects.push(obj);
    return obj;
  }

  /** Mělké sloučení `patch` do objektu v dané fázi. Vrací upravený objekt nebo null. */
  function updateObject(scene, phaseIndex, objectId, patch) {
    const phase = getPhase(scene, phaseIndex);
    if (!phase) return null;
    const obj = findObject(phase, objectId);
    if (!obj) return null;
    Object.assign(obj, patch);
    return obj;
  }

  /**
   * Odstraní objekt. Výchozí chování: jen z dané fáze (objekt v této fázi
   * "zanikne"). S `allPhases: true` zmizí odevšad.
   */
  function removeObject(scene, objectId, options) {
    const opts = options || {};
    const phases = opts.allPhases
      ? scene.phases
      : [getPhase(scene, opts.phaseIndex != null ? opts.phaseIndex : 0)].filter(Boolean);
    let removed = 0;
    phases.forEach(function (phase) {
      const before = phase.objects.length;
      phase.objects = phase.objects.filter(function (o) { return o.id !== objectId; });
      removed += before - phase.objects.length;
    });
    return removed;
  }

  /**
   * Zrcadlí objekt podle podélné osy hřiště (nahoře ↔ dole): mění se jen
   * poloha a natočení, text ani čísla se nepřevrací. Popisky ležící mimo
   * hřiště (nad ním / pod ním) zůstávají na místě.
   */
  function mirrorObjectSides(obj) {
    const H = COURT.height;
    // zaokrouhlení na mm, aby dvojí zrcadlení vrátilo přesně původní hodnoty
    const flip = function (y) { return Math.round((H - y) * 1000) / 1000; };
    if (obj.points) {
      obj.points.forEach(function (p) { p.y = flip(p.y); });
    } else if (obj.type === OBJECT_TYPES.ZONE) {
      obj.y = flip(obj.y + (obj.h || 0));
    } else if (obj.type === OBJECT_TYPES.TEXT) {
      if (obj.y >= 0 && obj.y <= H) obj.y = flip(obj.y);
    } else if (typeof obj.y === 'number') {
      obj.y = flip(obj.y);
    }
    if (obj.bend) obj.bend.y = flip(obj.bend.y);
    if (typeof obj.rotation === 'number') {
      // úhel θ se při zrcadlení podle vodorovné osy mění na −θ
      let r = -obj.rotation;
      if (r <= -180) r += 360;
      if (Object.is(r, -0)) r = 0;
      obj.rotation = r;
    }
    return obj;
  }

  /** Zrcadlí celou taktiku (všechny fáze) na druhou stranu hřiště. */
  function mirrorSceneSides(scene) {
    scene.phases.forEach(function (phase) {
      phase.objects.forEach(mirrorObjectSides);
    });
    return scene;
  }

  /** Všechna id objektů, která se vyskytují v libovolné fázi. */
  function allObjectIds(scene) {
    const ids = new Set();
    scene.phases.forEach(function (p) {
      p.objects.forEach(function (o) { ids.add(o.id); });
    });
    return Array.from(ids);
  }

  // ---------------------------------------------------------------------------
  // Sestava (roster)
  // ---------------------------------------------------------------------------

  function addRosterPlayer(scene, props) {
    const player = createRosterPlayer(props);
    scene.roster.push(player);
    return player;
  }

  function getRosterPlayer(scene, playerId) {
    return scene.roster.find(function (p) { return p.id === playerId; }) || null;
  }

  function updateRosterPlayer(scene, playerId, patch) {
    const player = getRosterPlayer(scene, playerId);
    if (!player) return null;
    Object.assign(player, patch);
    return player;
  }

  /**
   * Odebere hráče ze sestavy. Objekty na hřišti, které na něj odkazovaly,
   * se nemažou, jen ztratí vazbu (playerId = null) a zůstane jim label.
   */
  function removeRosterPlayer(scene, playerId) {
    const player = getRosterPlayer(scene, playerId);
    if (!player) return false;
    scene.roster = scene.roster.filter(function (p) { return p.id !== playerId; });
    scene.phases.forEach(function (phase) {
      phase.objects.forEach(function (o) {
        if (o.type === OBJECT_TYPES.PLAYER && o.playerId === playerId) {
          o.playerId = null;
          if (!o.label) o.label = player.number != null ? String(player.number) : player.name;
        }
      });
    });
    return true;
  }

  /**
   * Popisek hráče na hřišti: ruční label má přednost, jinak číslo dresu
   * ze sestavy, jinak jméno. Používá renderer i UI, aby se logika neduplikovala.
   */
  function resolvePlayerLabel(scene, obj) {
    if (obj.label) return obj.label;
    if (obj.playerId) {
      const player = getRosterPlayer(scene, obj.playerId);
      if (player) {
        if (player.number != null && player.number !== '') return String(player.number);
        if (player.name) return player.name;
      }
    }
    return '';
  }

  /**
   * Nejnižší volné číslo (1, 2, 3…) pro nového obecného hráče daného týmu
   * v dané fázi. Bere v úvahu ruční popisky i čísla hráčů ze sestavy.
   */
  function nextFreePlayerNumber(scene, phase, team) {
    const used = new Set();
    phase.objects.forEach(function (o) {
      if (o.type !== OBJECT_TYPES.PLAYER || o.team !== team) return;
      const n = parseInt(resolvePlayerLabel(scene, o), 10);
      if (!isNaN(n)) used.add(n);
    });
    let n = 1;
    while (used.has(n)) n += 1;
    return n;
  }

  /** Objekt hráče ze sestavy v dané fázi, nebo null. */
  function findPlayerObject(phase, playerId) {
    return phase.objects.find(function (o) {
      return o.type === OBJECT_TYPES.PLAYER && o.playerId === playerId;
    }) || null;
  }

  // ---------------------------------------------------------------------------
  // Serializace
  // ---------------------------------------------------------------------------

  function serialize(scene) {
    return JSON.stringify(scene);
  }

  /**
   * Načte scénu z JSON řetězce nebo už naparsovaného objektu a provede
   * základní validaci struktury. Při chybě vyhodí výjimku, nic tiše neopravuje.
   */
  function deserialize(input) {
    const data = typeof input === 'string' ? JSON.parse(input) : deepClone(input);
    assert(data && typeof data === 'object', 'neplatná data scény');
    assert(Array.isArray(data.phases) && data.phases.length > 0, 'scéna musí mít alespoň jednu fázi');
    assert(Array.isArray(data.roster), 'chybí sestava (roster)');
    if (typeof data.name !== 'string') data.name = 'Nová taktika';
    if (typeof data.court !== 'string') data.court = 'floorball';

    data.phases.forEach(function (phase, i) {
      assert(typeof phase.id === 'string', 'fáze ' + i + ': chybí id');
      assert(typeof phase.duration === 'number', 'fáze ' + i + ': chybí duration');
      assert(Array.isArray(phase.objects), 'fáze ' + i + ': chybí objects');
      phase.objects.forEach(function (o, j) {
        assert(typeof o.id === 'string', 'fáze ' + i + ', objekt ' + j + ': chybí id');
        assert(OBJECT_DEFAULTS[o.type], 'fáze ' + i + ', objekt ' + j + ': neznámý typ "' + o.type + '"');
      });
    });

    if (data.version !== SCENE_VERSION) {
      // Zatím jen jedna verze; sem později přijdou migrace.
      data.version = SCENE_VERSION;
    }
    return data;
  }

  // ---------------------------------------------------------------------------
  // Export do jmenného prostoru
  // ---------------------------------------------------------------------------

  FB.scene = {
    SCENE_VERSION: SCENE_VERSION,
    COURT: COURT,
    OBJECT_TYPES: OBJECT_TYPES,
    POSITIONS: POSITIONS,
    TEAMS: TEAMS,
    TEAM_COLORS: TEAM_COLORS,
    OBJECT_DEFAULTS: OBJECT_DEFAULTS,
    DEFAULT_PHASE_DURATION: DEFAULT_PHASE_DURATION,

    uid: uid,
    deepClone: deepClone,

    createScene: createScene,
    createPhase: createPhase,
    createObject: createObject,
    createRosterPlayer: createRosterPlayer,

    getPhase: getPhase,
    getPhaseIndex: getPhaseIndex,
    addPhase: addPhase,
    removePhase: removePhase,
    movePhase: movePhase,
    totalDuration: totalDuration,

    findObject: findObject,
    addObject: addObject,
    updateObject: updateObject,
    removeObject: removeObject,
    allObjectIds: allObjectIds,
    mirrorObjectSides: mirrorObjectSides,
    MIN_MOVE: MIN_MOVE,
    moveDistance: moveDistance,
    routeControl: routeControl,
    routePoint: routePoint,
    routeMid: routeMid,
    mirrorSceneSides: mirrorSceneSides,

    addRosterPlayer: addRosterPlayer,
    getRosterPlayer: getRosterPlayer,
    updateRosterPlayer: updateRosterPlayer,
    removeRosterPlayer: removeRosterPlayer,
    resolvePlayerLabel: resolvePlayerLabel,
    findPlayerObject: findPlayerObject,
    nextFreePlayerNumber: nextFreePlayerNumber,

    serialize: serialize,
    deserialize: deserialize,
  };
})(window);
