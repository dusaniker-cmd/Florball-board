/**
 * storage.js — ukládání a načítání taktik.
 *
 * První verze ukládá lokálně do localStorage prohlížeče (viz otevřená otázka
 * v CLAUDE.md — sdílení mezi kolegy by chtělo malý backend, API tohoto
 * modulu je na to připravené: funkce vracejí data, ne DOM).
 *
 * Dvě úrovně:
 *   - pojmenované taktiky (seznam, který uživatel vědomě ukládá)
 *   - autosave rozpracované práce (přežije reload stránky)
 * Plus export/import JSON souboru pro přenos mimo prohlížeč.
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});
  const S = FB.scene;

  const KEY_TACTICS = 'fb.tactics.v1';
  const KEY_AUTOSAVE = 'fb.autosave.v1';
  const KEY_PREFS = 'fb.prefs.v1';

  // ---------------------------------------------------------------------------
  // Nízká úroveň
  // ---------------------------------------------------------------------------

  function isAvailable() {
    try {
      const k = '__fb_test__';
      global.localStorage.setItem(k, '1');
      global.localStorage.removeItem(k);
      return true;
    } catch (e) {
      return false;
    }
  }

  function readJSON(key, fallback) {
    try {
      const raw = global.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('storage: čtení selhalo', key, e);
      return fallback;
    }
  }

  function writeJSON(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // typicky plné úložiště nebo zakázané cookies/storage
      console.warn('storage: zápis selhal', key, e);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Pojmenované taktiky
  // ---------------------------------------------------------------------------

  function readAll() {
    const data = readJSON(KEY_TACTICS, { tactics: [] });
    return Array.isArray(data.tactics) ? data.tactics : [];
  }

  /** Seznam uložených taktik bez samotných dat, nejnovější první. */
  function listTactics() {
    return readAll()
      .map(function (t) { return { id: t.id, name: t.name, updatedAt: t.updatedAt }; })
      .sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }

  /**
   * Uloží scénu. S `id` přepíše existující záznam, jinak založí nový.
   * Vrací { id, name, updatedAt } nebo null při selhání zápisu.
   */
  function saveTactic(scene, id) {
    const all = readAll();
    const entry = {
      id: id || S.uid('t'),
      name: scene.name || 'Bez názvu',
      updatedAt: Date.now(),
      scene: S.deepClone(scene),
    };
    const index = all.findIndex(function (t) { return t.id === entry.id; });
    if (index === -1) all.push(entry);
    else all[index] = entry;
    if (!writeJSON(KEY_TACTICS, { tactics: all })) return null;
    return { id: entry.id, name: entry.name, updatedAt: entry.updatedAt };
  }

  /** Načte a zvaliduje uloženou taktiku; null pokud neexistuje. Chybná data vyhodí výjimku. */
  function loadTactic(id) {
    const entry = readAll().find(function (t) { return t.id === id; });
    if (!entry) return null;
    return S.deserialize(entry.scene);
  }

  function deleteTactic(id) {
    const all = readAll();
    const rest = all.filter(function (t) { return t.id !== id; });
    if (rest.length === all.length) return false;
    return writeJSON(KEY_TACTICS, { tactics: rest });
  }

  // ---------------------------------------------------------------------------
  // Autosave rozpracované práce
  // ---------------------------------------------------------------------------

  function saveAutosave(scene, meta) {
    return writeJSON(KEY_AUTOSAVE, {
      savedAt: Date.now(),
      meta: meta || {},
      scene: scene,
    });
  }

  /** { scene, meta, savedAt } nebo null. Poškozený autosave se zahodí a vrátí null. */
  function loadAutosave() {
    const data = readJSON(KEY_AUTOSAVE, null);
    if (!data || !data.scene) return null;
    try {
      return { scene: S.deserialize(data.scene), meta: data.meta || {}, savedAt: data.savedAt };
    } catch (e) {
      console.warn('storage: autosave je poškozený, zahazuji', e);
      clearAutosave();
      return null;
    }
  }

  function clearAutosave() {
    try { global.localStorage.removeItem(KEY_AUTOSAVE); } catch (e) { /* nic */ }
  }

  // ---------------------------------------------------------------------------
  // Uživatelské předvolby (zobrazení apod.), nezávislé na taktice
  // ---------------------------------------------------------------------------

  function loadPrefs() {
    const data = readJSON(KEY_PREFS, null);
    return data && typeof data === 'object' ? data : {};
  }

  function savePrefs(prefs) {
    return writeJSON(KEY_PREFS, prefs || {});
  }

  // ---------------------------------------------------------------------------
  // Soubory (JSON export/import, stažení videa)
  // ---------------------------------------------------------------------------

  function toJSON(scene) {
    return JSON.stringify(scene, null, 2);
  }

  function fromJSON(text) {
    const data = typeof text === 'string' ? JSON.parse(text) : text;
    // Soubor z modelu přesilovky (attackers/defenders bez fází) → jedna fáze
    if (data && !data.phases && Array.isArray(data.attackers) && Array.isArray(data.defenders)) {
      return sceneFromSetup(data);
    }
    return S.deserialize(data);
  }

  /** Rozestavení z modelu přesilovky (útočíme doprava) převede na scénu s jednou fází. */
  function sceneFromSetup(setup) {
    const scene = S.createScene({ name: setup.name || 'Přesilovka 5 na 3' });
    const T = S.OBJECT_TYPES;
    setup.attackers.forEach(function (p, i) {
      S.addObject(scene, 0, S.createObject(T.PLAYER, {
        x: +p.x, y: +p.y, team: S.TEAMS.HOME, label: String(i + 1),
      }));
    });
    S.addObject(scene, 0, S.createObject(T.PLAYER, { x: 4.2, y: 10, team: S.TEAMS.HOME, label: 'G', goalie: true }));
    setup.defenders.forEach(function (p, i) {
      S.addObject(scene, 0, S.createObject(T.PLAYER, {
        x: +p.x, y: +p.y, team: S.TEAMS.AWAY, rotation: 180, label: 'ABC'[i] || String(i + 1),
      }));
    });
    S.addObject(scene, 0, S.createObject(T.PLAYER, { x: 35.8, y: 10, team: S.TEAMS.AWAY, rotation: 180, label: 'G', goalie: true }));
    const c = setup.attackers[typeof setup.carrier === 'number' ? setup.carrier : 0] || setup.attackers[0];
    if (c) S.addObject(scene, 0, S.createObject(T.BALL, { x: +c.x + 0.9, y: +c.y + 0.3 }));
    if (setup.note) {
      S.addObject(scene, 0, S.createObject(T.TEXT, { x: 20, y: -1.25, text: setup.note, fontSize: 0.7, maxWidth: 38, color: '#e6e9ef' }));
    }
    return scene;
  }

  function safeFilename(name, ext) {
    const base = String(name || 'taktika')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')   // odstranit diakritiku
      .replace(/[^a-zA-Z0-9-_ ]+/g, '')
      .trim().replace(/\s+/g, '-')
      .toLowerCase() || 'taktika';
    return base + '.' + ext;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = global.document.createElement('a');
    a.href = url;
    a.download = filename;
    global.document.body.appendChild(a);
    a.click();
    a.remove();
    // URL uvolnit až po kliknutí; některé prohlížeče ho čtou asynchronně
    global.setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  }

  function downloadText(text, filename, type) {
    downloadBlob(new Blob([text], { type: type || 'application/json' }), filename);
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result)); };
      reader.onerror = function () { reject(reader.error || new Error('Soubor se nepodařilo přečíst')); };
      reader.readAsText(file);
    });
  }

  FB.storage = {
    isAvailable: isAvailable,
    listTactics: listTactics,
    saveTactic: saveTactic,
    loadTactic: loadTactic,
    deleteTactic: deleteTactic,
    saveAutosave: saveAutosave,
    loadAutosave: loadAutosave,
    clearAutosave: clearAutosave,
    loadPrefs: loadPrefs,
    savePrefs: savePrefs,
    toJSON: toJSON,
    fromJSON: fromJSON,
    safeFilename: safeFilename,
    downloadBlob: downloadBlob,
    downloadText: downloadText,
    readFileAsText: readFileAsText,
  };
})(window);
