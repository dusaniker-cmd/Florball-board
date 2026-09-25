/**
 * main.js — inicializace a propojení modulů.
 *
 * Vytvoří objekt `app`, přes který spolu moduly komunikují (renderer,
 * nástroje, přehrávač, UI, úložiště, export). Modely (scene.js, phases.js)
 * o `app` nevědí.
 */
(function (global) {
  'use strict';

  const FB = global.FB;
  const S = FB.scene;

  const AUTOSAVE_DELAY = 400;

  /** Ukázková scéna se dvěma fázemi pro první spuštění (bez autosave). */
  function buildDemoScene() {
    const scene = S.createScene({ name: 'Ukázka: náběh do volného prostoru' });

    const roster = [
      { name: 'Novák', number: 1, position: S.POSITIONS.GOALIE },
      { name: 'Svoboda', number: 5, position: S.POSITIONS.DEFENDER },
      { name: 'Dvořák', number: 7, position: S.POSITIONS.DEFENDER },
      { name: 'Černý', number: 9, position: S.POSITIONS.FORWARD },
      { name: 'Procházka', number: 11, position: S.POSITIONS.FORWARD },
      { name: 'Kučera', number: 14, position: S.POSITIONS.FORWARD },
    ].map(function (p) { return S.addRosterPlayer(scene, p); });

    const homeSpots = [
      { x: 4.2, y: 10 }, { x: 12, y: 6 }, { x: 12, y: 14 },
      { x: 18, y: 4 }, { x: 18, y: 16 }, { x: 19, y: 10 },
    ];
    const home = homeSpots.map(function (spot, i) {
      return S.addObject(scene, 0, S.createObject(S.OBJECT_TYPES.PLAYER, {
        x: spot.x, y: spot.y, rotation: 0, team: S.TEAMS.HOME, playerId: roster[i].id,
      }));
    });

    [
      { x: 35.8, y: 10, label: 'G' }, { x: 28, y: 7, label: 'D' }, { x: 28, y: 13, label: 'D' },
      { x: 23, y: 6, label: 'F' }, { x: 23, y: 14, label: 'F' },
    ].forEach(function (spot) {
      S.addObject(scene, 0, S.createObject(S.OBJECT_TYPES.PLAYER, {
        x: spot.x, y: spot.y, rotation: 180, team: S.TEAMS.AWAY, label: spot.label,
      }));
    });

    const ball = S.addObject(scene, 0, S.createObject(S.OBJECT_TYPES.BALL, { x: 20.2, y: 10 }));
    const pass = S.addObject(scene, 0, S.createObject(S.OBJECT_TYPES.ARROW, {
      points: [{ x: 20.5, y: 10 }, { x: 26, y: 4.5 }],
    }));
    S.addObject(scene, 0, S.createObject(S.OBJECT_TYPES.ARROW, {
      points: [{ x: 19, y: 16 }, { x: 24, y: 17 }, { x: 30, y: 13.5 }],
      color: S.TEAM_COLORS.home, dashed: true,
    }));
    S.addObject(scene, 0, S.createObject(S.OBJECT_TYPES.ZONE, {
      x: 26, y: 2, w: 8, h: 5, color: '#f5b400', opacity: 0.25,
    }));
    S.addObject(scene, 0, S.createObject(S.OBJECT_TYPES.TEXT, {
      x: 30, y: 1, text: 'Volný prostor', fontSize: 1,
    }));

    S.addPhase(scene, 0);
    S.updateObject(scene, 1, home[3].id, { x: 27, y: 4.5, rotation: 30 });
    S.updateObject(scene, 1, home[4].id, { x: 30, y: 13.5, rotation: -20 });
    S.updateObject(scene, 1, ball.id, { x: 26.3, y: 5 });
    S.removeObject(scene, pass.id, { phaseIndex: 1 });

    return scene;
  }

  function init() {
    const doc = global.document;
    const canvas = doc.getElementById('board-canvas');
    const boardEl = doc.getElementById('board');
    // Zobrazovací volby (směr, hole) — uložené v prohlížeči
    const prefs = FB.storage.loadPrefs();
    const view = Object.assign({ direction: false, sticks: true }, prefs.view || {});
    const renderer = new FB.CanvasRenderer(canvas, { view: view });

    // Rozpracovaná práce z minula, jinak ukázka
    let initialScene = null;
    let initialMeta = {};
    const autosave = FB.storage.loadAutosave();
    if (autosave) {
      initialScene = autosave.scene;
      initialMeta = autosave.meta || {};
    } else {
      initialScene = buildDemoScene();
    }

    let autosaveTimer = null;

    const app = {
      scene: initialScene,
      canvas: canvas,
      renderer: renderer,
      state: {
        phaseIndex: Math.min(initialMeta.phaseIndex || 0, initialScene.phases.length - 1),
        selectedIds: [],
        tool: 'select',
        team: S.TEAMS.HOME,
        tacticId: initialMeta.tacticId || null,
        busy: null,          // text probíhající operace (export) nebo null
        view: 'board',       // 'board' | 'roster'
        pendingPlayerId: null, // hráč ze sestavy čekající na umístění kliknutím
      },
      view: view,
      exportFormat: prefs.exportFormat === 'webm' ? 'webm' : 'mp4',
      setExportFormat: function (format) {
        app.exportFormat = format === 'webm' ? 'webm' : 'mp4';
        FB.storage.savePrefs(Object.assign(FB.storage.loadPrefs(), { exportFormat: app.exportFormat }));
      },
      player: null,
      tools: null,
      ui: null,
      roster: null,

      /** Přepne zobrazení pro všechny hráče: 'direction' | 'sticks'. */
      toggleView: function (key) {
        app.view[key] = !app.view[key];
        renderer.setView(app.view);
        FB.storage.savePrefs(Object.assign(FB.storage.loadPrefs(), { view: app.view }));
        if (app.ui) app.ui.update();
        if (app.isPlaying()) app.render(app.player.stateAt(app.player.time).objects);
        else app.render();
      },

      currentPhase: function () {
        return S.getPhase(app.scene, app.state.phaseIndex);
      },

      isPlaying: function () {
        return !!(app.player && app.player.playing);
      },

      /** Vykreslí zadané objekty, nebo aktuální fázi. */
      render: function (objects) {
        const phase = app.currentPhase();
        renderer.render(objects || (phase ? phase.objects : []), {
          labelFor: function (obj) { return S.resolvePlayerLabel(app.scene, obj); },
          selectedIds: app.isPlaying() ? [] : app.state.selectedIds,
        });
        if (app.ui) app.ui.updateProps();   // výběr se mění i bez changed()
      },

      /** Jediný vybraný objekt aktuální fáze, nebo null. */
      selectedObject: function () {
        const phase = app.currentPhase();
        if (!phase || app.state.selectedIds.length !== 1 || app.isPlaying()) return null;
        return S.findObject(phase, app.state.selectedIds[0]);
      },

      /**
       * Úprava vlastností vybraného textu. Velikost a šířka se propíšou do
       * všech fází (je to vzhled objektu), obsah textu jen do aktuální fáze.
       */
      patchSelectedText: function (patch, allPhases) {
        const obj = app.selectedObject();
        if (!obj || obj.type !== S.OBJECT_TYPES.TEXT) return;
        const targets = allPhases
          ? app.scene.phases.map(function (p) { return S.findObject(p, obj.id); }).filter(Boolean)
          : [obj];
        targets.forEach(function (o) { Object.assign(o, patch); });
        app.changed();
      },

      /** Po změně modelu: obnovit UI i canvas a naplánovat autosave. */
      changed: function () {
        if (app.ui) app.ui.update();
        app.render();
        app.scheduleAutosave();
      },

      scheduleAutosave: function () {
        if (autosaveTimer) global.clearTimeout(autosaveTimer);
        autosaveTimer = global.setTimeout(function () {
          autosaveTimer = null;
          FB.storage.saveAutosave(app.scene, {
            tacticId: app.state.tacticId,
            phaseIndex: app.state.phaseIndex,
          });
        }, AUTOSAVE_DELAY);
      },

      setTool: function (tool) {
        app.state.tool = tool;
        if (tool !== 'select') app.state.selectedIds = [];
        if (tool !== 'player') app.state.pendingPlayerId = null;
        if (app.tools) app.tools.updateCursor();
        if (app.ui) app.ui.update();
        app.render();
      },

      setView: function (view) {
        if (app.player) app.player.stop();
        app.state.view = view;
        if (app.ui) app.ui.update();
        app.render();
      },

      selectObject: function (id) {
        app.state.tool = 'select';
        app.state.pendingPlayerId = null;
        app.state.selectedIds = id ? [id] : [];
        if (app.tools) app.tools.updateCursor();
        if (app.ui) app.ui.update();
        app.render();
      },

      // --- sestava --------------------------------------------------------------

      addRosterPlayer: function (props) {
        const player = S.addRosterPlayer(app.scene, props);
        app.changed();
        return player;
      },

      updateRosterPlayer: function (id, patch) {
        S.updateRosterPlayer(app.scene, id, patch);
        app.changed();
      },

      removeRosterPlayer: function (id) {
        const player = S.getRosterPlayer(app.scene, id);
        if (!player) return;
        if (!global.confirm('Odebrat "' + (player.name || 'hráče') + '" ze sestavy? Na hřišti zůstane jen jako obecný hráč.')) return;
        S.removeRosterPlayer(app.scene, id);
        app.changed();
      },

      /** Klik na jméno v panelu: další klik na hřiště hráče umístí. */
      placeRosterPlayer: function (id) {
        app.state.pendingPlayerId = id;
        app.state.selectedIds = [];
        app.state.tool = 'player';
        if (app.tools) app.tools.updateCursor();
        if (app.ui) app.ui.update();
        app.render();
      },

      /** Zaškrtávátko v panelu: postavit na hřiště / odebrat z hřiště v aktuální fázi. */
      setOnCourt: function (id, on) {
        const phase = app.currentPhase();
        const player = S.getRosterPlayer(app.scene, id);
        if (!phase || !player) return;
        const existing = S.findPlayerObject(phase, id);
        if (on && !existing) {
          const spot = FB.roster.findFreeSpot(phase.objects, player.position);
          const obj = S.createObject(S.OBJECT_TYPES.PLAYER, {
            x: spot.x, y: spot.y, team: S.TEAMS.HOME, playerId: id,
            goalie: player.position === S.POSITIONS.GOALIE,
          });
          S.addObject(app.scene, app.state.phaseIndex, obj);
          app.state.selectedIds = [obj.id];
        } else if (!on && existing) {
          S.removeObject(app.scene, existing.id, { phaseIndex: app.state.phaseIndex });
          app.state.selectedIds = [];
        }
        app.changed();
      },

      // --- fáze ---------------------------------------------------------------

      setPhase: function (index) {
        if (app.player) app.player.stop();
        app.state.phaseIndex = Math.max(0, Math.min(app.scene.phases.length - 1, index));
        app.state.selectedIds = [];
        app.changed();
      },

      addPhase: function () {
        if (app.player) app.player.stop();
        S.addPhase(app.scene, app.state.phaseIndex);
        app.setPhase(app.state.phaseIndex + 1);
      },

      removePhase: function (index) {
        if (app.scene.phases.length <= 1) return;
        const phase = app.scene.phases[index];
        if (!phase) return;
        if (!global.confirm('Smazat "' + (phase.name || 'fázi ' + (index + 1)) + '"?')) return;
        if (app.player) app.player.stop();
        S.removePhase(app.scene, phase.id);
        app.setPhase(Math.min(app.state.phaseIndex, app.scene.phases.length - 1));
      },

      setDuration: function (ms) {
        const phase = app.currentPhase();
        if (phase) phase.duration = ms;
        app.changed();
      },

      // --- scéna / soubor -----------------------------------------------------

      /** Nahradí celou scénu (načtení, import, nová). */
      replaceScene: function (scene, meta) {
        const m = meta || {};
        if (app.player) app.player.stop();
        app.scene = scene;
        app.state.tacticId = m.tacticId || null;
        app.state.phaseIndex = Math.min(m.phaseIndex || 0, scene.phases.length - 1);
        app.state.selectedIds = [];
        app.setTool('select');
        app.changed();
      },

      newScene: function () {
        if (!global.confirm('Založit novou prázdnou taktiku? Rozpracovaná práce zůstane jen pokud je uložená.')) return;
        app.replaceScene(S.createScene());
      },

      saveTactic: function () {
        const res = FB.storage.saveTactic(app.scene, app.state.tacticId);
        if (!res) {
          global.alert('Uložení selhalo. Úložiště prohlížeče je plné nebo zakázané.');
          return;
        }
        app.state.tacticId = res.id;
        app.changed();
        app.ui.flash('Uloženo: ' + res.name);
      },

      /** Zrcadlí celou taktiku na druhou stranu hřiště (nahoře ↔ dole), všechny fáze. */
      mirrorSides: function () {
        if (app.player) app.player.stop();
        S.mirrorSceneSides(app.scene);
        app.changed();
        app.ui.flash('Zrcadleno na druhou stranu hřiště (dalším klikem zpět)');
      },

      /** Rozestavení z knihovny do aktuální fáze (naši = vlevo, soupeř zrcadlově). */
      applyFormation: function (presetId, team) {
        if (app.player) app.player.stop();
        const ids = FB.formations.apply(app.scene, app.state.phaseIndex, presetId, { team: team });
        app.state.selectedIds = [];
        app.setTool('select');
        app.changed();
        const preset = FB.formations.getPreset(presetId);
        app.ui.flash((team === 'away' ? 'Soupeř: ' : 'Naši: ') + preset.name + ' (' + ids.length + ' objektů)');
      },

      loadExample: function (id) {
        const scene = FB.examples.build(id);
        app.replaceScene(scene);
        app.ui.flash('Ukázka: ' + scene.name + ' – uložte si ji pod vlastním názvem', 4000);
      },

      loadTactic: function (id) {
        if (id.indexOf('ex:') === 0) {
          app.loadExample(id.slice(3));
          return;
        }
        let scene;
        try {
          scene = FB.storage.loadTactic(id);
        } catch (e) {
          global.alert('Uloženou taktiku se nepodařilo načíst: ' + e.message);
          app.ui.update();
          return;
        }
        if (!scene) { app.ui.update(); return; }
        app.replaceScene(scene, { tacticId: id });
      },

      deleteTactic: function (id) {
        const item = FB.storage.listTactics().find(function (t) { return t.id === id; });
        if (!item) return;
        if (!global.confirm('Smazat uloženou taktiku "' + item.name + '"?')) return;
        FB.storage.deleteTactic(id);
        if (app.state.tacticId === id) app.state.tacticId = null;
        app.changed();
      },

      downloadJSON: function () {
        FB.storage.downloadText(
          FB.storage.toJSON(app.scene),
          FB.storage.safeFilename(app.scene.name, 'json')
        );
      },

      importJSON: function (file) {
        FB.storage.readFileAsText(file)
          .then(function (text) {
            const scene = FB.storage.fromJSON(text);
            app.replaceScene(scene);
            app.ui.flash('Načteno: ' + scene.name);
          })
          .catch(function (e) {
            global.alert('Soubor se nepodařilo načíst: ' + e.message);
          });
      },

      // --- export -------------------------------------------------------------

      exportVideo: function () {
        if (app.state.busy) return;
        if (app.player) app.player.stop();
        app.state.busy = 'Export videa… 0 %';
        app.ui.update();

        FB.exportVideo.exportVideo(app.scene, {
          view: app.view,
          format: app.exportFormat,
          onProgress: function (p) {
            app.ui.setHint('Export videa… ' + Math.round(p * 100) + ' %');
          },
        })
          .then(function (res) {
            const ext = FB.exportVideo.extensionFor(res.mimeType);
            FB.storage.downloadBlob(res.blob, FB.storage.safeFilename(app.scene.name, ext));
            app.state.busy = null;
            app.ui.update();
            app.ui.flash('Video hotové (' + ext + ', ' + Math.round(res.blob.size / 1024) + ' kB)', 4000);
          })
          .catch(function (e) {
            app.state.busy = null;
            app.ui.update();
            global.alert('Export selhal: ' + e.message);
          });
      },
    };

    app.player = new FB.Player({
      getScene: function () { return app.scene; },
      onFrame: function (state) {
        app.render(state.objects);
        if (app.ui) app.ui.setPlayhead(state.phaseIndex);
      },
      onEnd: function () {
        app.state.phaseIndex = app.scene.phases.length - 1;
        app.changed();
      },
      onStateChange: function () {
        if (app.ui) app.ui.update();
        if (!app.isPlaying()) app.render();
      },
    });

    app.tools = new FB.Tools(app);
    app.roster = FB.roster.init(app);
    app.ui = FB.ui.init(app);

    function fit() {
      const rect = boardEl.getBoundingClientRect();
      renderer.resize(rect.width, rect.height);
      if (app.isPlaying()) app.render(app.player.stateAt(app.player.time).objects);
      else app.render();
    }

    if (global.ResizeObserver) {
      new ResizeObserver(fit).observe(boardEl);
    } else {
      global.addEventListener('resize', fit);
    }

    app.ui.update();
    fit();

    // Pro ladění z konzole prohlížeče
    FB.app = app;
  }

  global.document.addEventListener('DOMContentLoaded', init);
})(window);
