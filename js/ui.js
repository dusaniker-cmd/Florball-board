/**
 * ui.js — ovládací panel mimo canvas: lišta nástrojů, výběr týmu,
 * seznam fází, délka fáze, přehrávání, soubor (uložit/načíst/JSON) a export.
 *
 * Nezná canvas ani model přímo; všechno jde přes `app` (main.js).
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});

  function init(app) {
    const doc = global.document;
    const el = {
      toolButtons: Array.from(doc.querySelectorAll('#toolbar [data-tool]')),
      teamButtons: Array.from(doc.querySelectorAll('#toolbar [data-team]')),
      viewButtons: Array.from(doc.querySelectorAll('#toolbar [data-view-toggle]')),
      phaseList: doc.getElementById('phase-list'),
      phaseAdd: doc.getElementById('btn-phase-add'),
      duration: doc.getElementById('phase-duration'),
      play: doc.getElementById('btn-play'),
      stop: doc.getElementById('btn-stop'),
      exportBtn: doc.getElementById('btn-export'),
      hint: doc.getElementById('hint'),

      sceneName: doc.getElementById('scene-name'),
      btnNew: doc.getElementById('btn-new'),
      btnSave: doc.getElementById('btn-save'),
      savedList: doc.getElementById('saved-list'),
      btnDeleteSaved: doc.getElementById('btn-delete-saved'),
      btnJsonDownload: doc.getElementById('btn-json-download'),
      btnJsonUpload: doc.getElementById('btn-json-upload'),
      jsonFile: doc.getElementById('json-file'),

      formationSelect: doc.getElementById('formation-select'),
      formationHome: doc.getElementById('btn-formation-home'),
      formationAway: doc.getElementById('btn-formation-away'),
      formationDesc: doc.getElementById('formation-desc'),

      navLinks: Array.from(doc.querySelectorAll('a[data-view]')),
      viewBoard: doc.getElementById('view-board'),
      viewRoster: doc.getElementById('view-roster'),
      phaseBar: doc.getElementById('phase-bar'),
    };

    let hintOverride = null;

    // Rozestavení jedním klikem
    FB.formations.groups().forEach(function (g) {
      const og = doc.createElement('optgroup');
      og.label = g.name;
      g.presets.forEach(function (p) {
        const opt = doc.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        og.appendChild(opt);
      });
      el.formationSelect.appendChild(og);
    });
    function showFormationDesc() {
      const p = FB.formations.getPreset(el.formationSelect.value);
      el.formationDesc.textContent = p ? p.description : '';
    }
    el.formationSelect.addEventListener('change', showFormationDesc);
    showFormationDesc();
    el.formationHome.addEventListener('click', function () {
      app.applyFormation(el.formationSelect.value, 'home');
    });
    el.formationAway.addEventListener('click', function () {
      app.applyFormation(el.formationSelect.value, 'away');
    });

    // Přepínání pohledů Deska / Sestava
    el.navLinks.forEach(function (link) {
      link.addEventListener('click', function (ev) {
        ev.preventDefault();
        app.setView(link.dataset.view);
      });
    });

    // Nástroje
    el.toolButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { app.setTool(btn.dataset.tool); });
    });

    // Tým (pro nově přidávané hráče a barvu čar)
    el.teamButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        app.state.team = btn.dataset.team;
        update();
      });
    });

    // Vlastnosti vybraného textu: velikost písma, šířka odstavce, úprava textu
    const FONT_MIN = 0.4, FONT_MAX = 4, FONT_STEP = 0.2;
    const WIDTH_MIN = 4, WIDTH_MAX = 42, WIDTH_STEP = 2, WIDTH_DEFAULT = 18;
    const props = {
      bar: doc.getElementById('props-bar'),
      fontMinus: doc.getElementById('prop-font-minus'),
      fontPlus: doc.getElementById('prop-font-plus'),
      fontValue: doc.getElementById('prop-font-value'),
      widthMinus: doc.getElementById('prop-width-minus'),
      widthPlus: doc.getElementById('prop-width-plus'),
      widthValue: doc.getElementById('prop-width-value'),
      textEdit: doc.getElementById('prop-text-edit'),
    };

    function selectedText() {
      const obj = app.selectedObject();
      return obj && obj.type === 'text' ? obj : null;
    }
    function round1(v) { return Math.round(v * 10) / 10; }
    function changeFont(delta) {
      const obj = selectedText();
      if (!obj) return;
      const size = Math.max(FONT_MIN, Math.min(FONT_MAX, round1((obj.fontSize || 1.2) + delta)));
      app.patchSelectedText({ fontSize: size }, true);
    }
    function changeWidth(delta) {
      const obj = selectedText();
      if (!obj) return;
      const w = Math.max(WIDTH_MIN, Math.min(WIDTH_MAX, (obj.maxWidth || WIDTH_DEFAULT) + delta));
      app.patchSelectedText({ maxWidth: w }, true);
    }
    props.fontMinus.addEventListener('click', function () { changeFont(-FONT_STEP); });
    props.fontPlus.addEventListener('click', function () { changeFont(FONT_STEP); });
    props.widthMinus.addEventListener('click', function () { changeWidth(-WIDTH_STEP); });
    props.widthPlus.addEventListener('click', function () { changeWidth(WIDTH_STEP); });
    props.textEdit.addEventListener('click', function () {
      const obj = selectedText();
      if (!obj) return;
      let value = null;
      try { value = global.prompt('Text:', obj.text || ''); } catch (e) { value = null; }
      if (value !== null && value.trim()) app.patchSelectedText({ text: value.trim() }, false);
    });
    global.addEventListener('keydown', function (ev) {
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (!selectedText()) return;
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); changeFont(FONT_STEP); }
      else if (ev.key === '-' || ev.key === '_') { ev.preventDefault(); changeFont(-FONT_STEP); }
    });

    /** Lišta vlastností: jen když je vybraný právě jeden text. Volá se při každém vykreslení. */
    function updateProps() {
      const obj = app.state.view === 'board' && !app.state.busy ? selectedText() : null;
      props.bar.hidden = !obj;
      if (!obj) return;
      props.fontValue.textContent = round1(obj.fontSize || 1.2).toFixed(1) + ' m';
      props.widthValue.textContent = (obj.maxWidth || WIDTH_DEFAULT) + ' m';
    }

    // Zobrazení (hole, směr) pro všechny hráče
    el.viewButtons.forEach(function (btn) {
      btn.addEventListener('click', function () { app.toggleView(btn.dataset.viewToggle); });
    });

    // Formát exportu videa (jen to, co prohlížeč umí nahrát)
    el.exportFormat = doc.getElementById('export-format');
    const formats = FB.exportVideo.isSupported() ? FB.exportVideo.supportedFormats() : [];
    formats.forEach(function (f) {
      const opt = doc.createElement('option');
      opt.value = f;
      opt.textContent = f === 'mp4' ? 'MP4' : 'WebM';
      el.exportFormat.appendChild(opt);
    });
    if (formats.indexOf(app.exportFormat) === -1 && formats.length) app.setExportFormat(formats[0]);
    el.exportFormat.value = app.exportFormat;
    el.exportFormat.hidden = formats.length < 2;
    el.exportFormat.addEventListener('change', function () {
      app.setExportFormat(el.exportFormat.value);
    });

    // Zrcadlení akce
    el.mirror = doc.getElementById('btn-mirror');
    el.mirror.addEventListener('click', function () { app.mirrorSides(); });

    // Fáze
    el.phaseAdd.addEventListener('click', function () { app.addPhase(); });
    el.duration.addEventListener('change', function () {
      const ms = parseInt(el.duration.value, 10);
      if (!isNaN(ms) && ms >= 100) app.setDuration(ms);
      else update();
    });

    // Přehrávání a export
    el.play.addEventListener('click', function () { app.player.toggle(); });
    el.stop.addEventListener('click', function () { app.player.stop(); });
    el.exportBtn.addEventListener('click', function () { app.exportVideo(); });

    // Soubor
    el.sceneName.addEventListener('change', function () {
      app.scene.name = el.sceneName.value.trim() || 'Bez názvu';
      app.changed();
    });
    el.btnNew.addEventListener('click', function () { app.newScene(); });
    el.btnSave.addEventListener('click', function () { app.saveTactic(); });
    el.savedList.addEventListener('change', function () {
      if (el.savedList.value) app.loadTactic(el.savedList.value);
    });
    el.btnDeleteSaved.addEventListener('click', function () {
      if (el.savedList.value) app.deleteTactic(el.savedList.value);
    });
    el.btnJsonDownload.addEventListener('click', function () { app.downloadJSON(); });
    el.btnJsonUpload.addEventListener('click', function () { el.jsonFile.click(); });
    el.jsonFile.addEventListener('change', function () {
      const file = el.jsonFile.files && el.jsonFile.files[0];
      if (file) app.importJSON(file);
      el.jsonFile.value = '';
    });

    global.addEventListener('keydown', function (ev) {
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (ev.key === ' ') {
        ev.preventDefault();
        if (!app.state.busy) app.player.toggle();
      }
    });

    function renderPhaseList(activeIndex, disabled) {
      el.phaseList.innerHTML = '';
      const phases = app.scene.phases;
      phases.forEach(function (phase, i) {
        const chip = doc.createElement('div');
        chip.className = 'phase-chip' + (i === activeIndex ? ' is-active' : '');
        chip.setAttribute('role', 'button');

        const name = doc.createElement('span');
        name.textContent = phase.name || ('Fáze ' + (i + 1));
        chip.appendChild(name);

        if (phases.length > 1 && !disabled) {
          const del = doc.createElement('button');
          del.className = 'phase-chip-del';
          del.title = 'Smazat fázi';
          del.textContent = '×';
          del.addEventListener('click', function (ev) {
            ev.stopPropagation();
            app.removePhase(i);
          });
          chip.appendChild(del);
        }

        if (!disabled) chip.addEventListener('click', function () { app.setPhase(i); });
        el.phaseList.appendChild(chip);
      });
    }

    function renderSavedList() {
      const items = FB.storage.listTactics();
      el.savedList.innerHTML = '';
      const placeholder = doc.createElement('option');
      placeholder.value = '';
      placeholder.textContent = items.length ? 'Načíst…' : 'Nic uloženého';
      el.savedList.appendChild(placeholder);
      if (items.length) {
        const ogSaved = doc.createElement('optgroup');
        ogSaved.label = 'Uložené';
        items.forEach(function (t) {
          const opt = doc.createElement('option');
          opt.value = t.id;
          opt.textContent = t.name;
          ogSaved.appendChild(opt);
        });
        el.savedList.appendChild(ogSaved);
      }
      FB.examples.GROUPS.forEach(function (group) {
        const ogEx = doc.createElement('optgroup');
        ogEx.label = 'Ukázky – ' + group.name;
        group.examples.forEach(function (ex) {
          const opt = doc.createElement('option');
          opt.value = 'ex:' + ex.id;
          opt.textContent = ex.name;
          ogEx.appendChild(opt);
        });
        el.savedList.appendChild(ogEx);
      });

      el.savedList.value = app.state.tacticId && items.some(function (t) { return t.id === app.state.tacticId; })
        ? app.state.tacticId
        : '';
    }

    /** Kompletní obnova UI podle stavu aplikace. */
    function update() {
      const state = app.state;
      const playing = app.isPlaying();
      const busy = !!state.busy;
      const locked = playing || busy;
      const phases = app.scene.phases;

      el.toolButtons.forEach(function (btn) {
        btn.classList.toggle('is-active', btn.dataset.tool === state.tool);
        btn.disabled = locked;
      });
      el.teamButtons.forEach(function (btn) {
        btn.classList.toggle('is-active', btn.dataset.team === state.team);
      });
      el.viewButtons.forEach(function (btn) {
        btn.classList.toggle('is-active', !!app.view[btn.dataset.viewToggle]);
      });

      renderPhaseList(state.phaseIndex, locked);

      const phase = app.currentPhase();
      el.duration.value = phase ? phase.duration : '';
      el.duration.disabled = locked || phases.length < 2 || state.phaseIndex === phases.length - 1;

      el.play.textContent = playing ? '❚❚' : '▶';
      el.play.disabled = busy || phases.length < 2;
      el.stop.disabled = busy || (!playing && app.player.time === 0);
      el.phaseAdd.disabled = locked;
      el.mirror.disabled = locked;
      el.exportFormat.disabled = locked;
      el.exportBtn.disabled = locked || phases.length < 2 || !FB.exportVideo.isSupported();

      if (doc.activeElement !== el.sceneName) el.sceneName.value = app.scene.name || '';
      el.sceneName.disabled = locked;
      el.btnNew.disabled = locked;
      el.btnSave.disabled = locked;
      el.savedList.disabled = locked;
      el.btnDeleteSaved.disabled = locked;
      el.formationSelect.disabled = locked;
      el.formationHome.disabled = locked;
      el.formationAway.disabled = locked;
      el.btnJsonDownload.disabled = locked;
      el.btnJsonUpload.disabled = locked;
      renderSavedList();

      // Pohledy
      const rosterView = state.view === 'roster';
      el.navLinks.forEach(function (link) {
        link.classList.toggle('is-active', link.dataset.view === state.view);
      });
      el.viewBoard.hidden = rosterView;
      el.phaseBar.hidden = rosterView;
      el.viewRoster.hidden = !rosterView;

      if (app.roster) app.roster.update();

      hintOverride = null;
      if (busy) el.hint.textContent = state.busy;
      else if (playing) el.hint.textContent = 'Přehrávání… (mezerník = pauza)';
      else if (state.pendingPlayerId) el.hint.textContent = 'Klikněte na hřiště, kam hráče postavit (Esc = zrušit)';
      else if (rosterView) el.hint.textContent = 'Změny se ukládají hned. Zpět na desku přes „Deska“.';
      else el.hint.textContent = 'Dvojklik na hráče = popisek · tažení za trojúhelník = otočení · Delete = smazat z fáze · Shift+Delete = ze všech fází · Esc = výběr';
    }

    /** Dočasný text v nápovědě (průběh exportu, "uloženo"); zmizí při dalším update(). */
    function setHint(text) {
      hintOverride = text;
      el.hint.textContent = text;
    }

    /** Krátká zpráva, která se po chvíli vrátí na běžnou nápovědu. */
    function flash(text, ms) {
      setHint(text);
      global.setTimeout(function () {
        if (hintOverride === text) update();
      }, ms || 2000);
    }

    /** Během přehrávání zvýrazní fázi, ze které se právě přechází. */
    function setPlayhead(phaseIndex) {
      Array.from(el.phaseList.children).forEach(function (chip, i) {
        chip.classList.toggle('is-active', i === phaseIndex);
      });
    }

    return { update: update, updateProps: updateProps, setHint: setHint, flash: flash, setPlayhead: setPlayhead };
  }

  FB.ui = { init: init };
})(window);
