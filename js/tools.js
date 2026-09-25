/**
 * tools.js — nástroje pro kreslení a úpravy objektů myší / dotykem.
 *
 * Pracuje přímo s objekty aktuální fáze (mutuje je), o vykreslení a
 * aktualizaci UI žádá přes `app`. Během přehrávání jsou nástroje vypnuté.
 *
 * Nástroje: select (výběr a přesun), player, ball, arrow, arrow-dashed,
 * line, zone, text, pen.
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});
  const S = FB.scene;
  const T = S.OBJECT_TYPES;

  /** Pořadí vrstev pro hit‑testing (shodné s rendererem, ale hledáme shora). */
  const LAYER_ORDER = { zone: 0, pen: 1, line: 2, arrow: 3, ball: 4, player: 5, text: 6 };

  const MIN_DRAG = 0.5;        // metry — kratší tah šipky/čáry se zahodí
  const PEN_STEP = 0.15;       // minimální vzdálenost mezi body pera
  const ROTATE_GRIP = 0.6;     // metry — dosah úchytu natočení u vybraného hráče

  const CURSORS = {
    select: 'default',
    player: 'copy',
    ball: 'copy',
    text: 'text',
  };

  function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  /**
   * window.prompt s ochranou: některá vestavěná okna (např. náhled v desktopové
   * appce) prompt nepodporují a vyhodí výjimku. Vrací null jako při zrušení.
   */
  function askText(message, defaultValue) {
    try {
      return global.prompt(message, defaultValue || '');
    } catch (e) {
      console.warn('tools: prompt() není dostupný', e);
      return null;
    }
  }

  /** Vzdálenost bodu p od úsečky a–b. */
  function distToSegment(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return dist(p, a);
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return dist(p, { x: a.x + t * dx, y: a.y + t * dy });
  }

  function distToPolyline(p, points) {
    if (!points || points.length === 0) return Infinity;
    if (points.length === 1) return dist(p, points[0]);
    let best = Infinity;
    for (let i = 0; i < points.length - 1; i++) {
      best = Math.min(best, distToSegment(p, points[i], points[i + 1]));
    }
    return best;
  }

  class Tools {
    /**
     * @param {Object} app  viz main.js — potřebuje canvas, renderer, scene,
     *   state, currentPhase(), isPlaying(), render(), changed(), setTool()
     */
    constructor(app) {
      this.app = app;
      this.drag = null;

      this._onPointerDown = this._onPointerDown.bind(this);
      this._onPointerMove = this._onPointerMove.bind(this);
      this._onPointerUp = this._onPointerUp.bind(this);
      this._onDoubleClick = this._onDoubleClick.bind(this);
      this._onKeyDown = this._onKeyDown.bind(this);

      const c = app.canvas;
      c.addEventListener('pointerdown', this._onPointerDown);
      c.addEventListener('pointermove', this._onPointerMove);
      c.addEventListener('pointerup', this._onPointerUp);
      c.addEventListener('pointercancel', this._onPointerUp);
      c.addEventListener('dblclick', this._onDoubleClick);
      global.addEventListener('keydown', this._onKeyDown);

      this.updateCursor();
    }

    updateCursor() {
      const tool = this.app.state.tool;
      this.app.canvas.style.cursor = CURSORS[tool] || 'crosshair';
    }

    // -------------------------------------------------------------------------
    // Pomocné
    // -------------------------------------------------------------------------

    _courtPoint(ev) {
      const rect = this.app.canvas.getBoundingClientRect();
      return this.app.renderer.toCourt(ev.clientX - rect.left, ev.clientY - rect.top);
    }

    /** Nejvyšší objekt pod bodem, nebo null. */
    hitTest(objects, p) {
      const sorted = objects.slice().sort(function (a, b) {
        return (LAYER_ORDER[b.type] || 0) - (LAYER_ORDER[a.type] || 0);
      });
      for (const obj of sorted) {
        if (this._hits(obj, p)) return obj;
      }
      return null;
    }

    _hits(obj, p) {
      switch (obj.type) {
        case T.PLAYER:
          return dist(p, obj) <= (obj.radius || 0.8) + 0.25;
        case T.BALL:
          return dist(p, obj) <= (obj.radius || 0.35) + 0.3;
        case T.ZONE:
          return p.x >= obj.x && p.x <= obj.x + obj.w && p.y >= obj.y && p.y <= obj.y + obj.h;
        case T.TEXT: {
          const b = this.app.renderer.getBounds(obj);
          return p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h;
        }
        case T.ARROW:
        case T.LINE:
        case T.PEN:
          return distToPolyline(p, obj.points) <= Math.max(obj.width || 0.15, 0.15) + 0.35;
        default:
          return false;
      }
    }

    /** Bod úchytu natočení: špička trojúhelníku na okraji hráče (shodně s rendererem). */
    static rotationHandle(obj) {
      const r = (obj.radius || 0.8) + 0.4;
      const a = ((obj.rotation || 0) * Math.PI) / 180;
      return { x: obj.x + Math.cos(a) * r, y: obj.y + Math.sin(a) * r };
    }

    static moveObject(obj, dx, dy) {
      if (obj.points) {
        obj.points.forEach(function (pt) { pt.x += dx; pt.y += dy; });
      } else {
        obj.x += dx;
        obj.y += dy;
      }
    }

    _addObject(obj) {
      S.addObject(this.app.scene, this.app.state.phaseIndex, obj);
      return obj;
    }

    _removeObject(id) {
      S.removeObject(this.app.scene, id, { phaseIndex: this.app.state.phaseIndex });
    }

    // -------------------------------------------------------------------------
    // Události
    // -------------------------------------------------------------------------

    _onPointerDown(ev) {
      if (this.app.isPlaying()) return;
      if (ev.button !== undefined && ev.button !== 0) return;
      ev.preventDefault();
      this.app.canvas.setPointerCapture(ev.pointerId);

      const app = this.app;
      const state = app.state;
      const p = this._courtPoint(ev);
      const phase = app.currentPhase();

      switch (state.tool) {
        case 'select': {
          // Úchyt natočení: u vybraného hráče lze chytit trojúhelník a otáčet
          const sel = state.selectedIds.length === 1 ? S.findObject(phase, state.selectedIds[0]) : null;
          if (sel && sel.type === T.PLAYER && dist(p, Tools.rotationHandle(sel)) <= ROTATE_GRIP) {
            this.drag = { kind: 'rotate', obj: sel };
            app.render();
            break;
          }
          const hit = this.hitTest(phase.objects, p);
          state.selectedIds = hit ? [hit.id] : [];
          this.drag = hit ? { kind: 'move', obj: hit, last: p, moved: false } : null;
          app.render();
          break;
        }
        case 'player': {
          // Hráč ze sestavy (klik v panelu Sestava) je vždy domácí
          const pendingId = state.pendingPlayerId || null;
          const team = pendingId ? S.TEAMS.HOME : state.team;
          const obj = this._addObject(S.createObject(T.PLAYER, {
            x: p.x, y: p.y, team: team,
            rotation: team === S.TEAMS.AWAY ? 180 : 0,
            playerId: pendingId,
            // Obecný hráč bez vazby na sestavu dostane další volné číslo (1, 2, 3…)
            label: pendingId ? '' : String(S.nextFreePlayerNumber(app.scene, phase, team)),
            goalie: !!(pendingId && (S.getRosterPlayer(app.scene, pendingId) || {}).position === S.POSITIONS.GOALIE),
          }));
          state.selectedIds = [obj.id];
          this.drag = { kind: 'move', obj: obj, last: p, moved: false };
          if (pendingId) {
            state.pendingPlayerId = null;
            app.setTool('select');   // po umístění ze sestavy zpět na výběr
          }
          app.changed();
          break;
        }
        case 'ball': {
          const obj = this._addObject(S.createObject(T.BALL, { x: p.x, y: p.y }));
          state.selectedIds = [obj.id];
          this.drag = { kind: 'move', obj: obj, last: p, moved: false };
          app.changed();
          break;
        }
        case 'arrow':
        case 'arrow-dashed':
        case 'line': {
          const type = state.tool === 'line' ? T.LINE : T.ARROW;
          const obj = this._addObject(S.createObject(type, {
            points: [{ x: p.x, y: p.y }, { x: p.x, y: p.y }],
            dashed: state.tool === 'arrow-dashed',
            color: state.team === S.TEAMS.AWAY ? S.TEAM_COLORS.away : '#111111',
          }));
          this.drag = { kind: 'endpoint', obj: obj, start: p, created: true };
          app.render();
          break;
        }
        case 'zone': {
          const obj = this._addObject(S.createObject(T.ZONE, { x: p.x, y: p.y, w: 0, h: 0 }));
          this.drag = { kind: 'rect', obj: obj, start: p, created: true };
          app.render();
          break;
        }
        case 'pen': {
          const obj = this._addObject(S.createObject(T.PEN, {
            points: [{ x: p.x, y: p.y }],
            color: state.team === S.TEAMS.AWAY ? S.TEAM_COLORS.away : S.TEAM_COLORS.home,
          }));
          this.drag = { kind: 'pen', obj: obj, last: p, created: true };
          app.render();
          break;
        }
        case 'text': {
          const text = askText('Text:', '');
          if (text && text.trim()) {
            const obj = this._addObject(S.createObject(T.TEXT, { x: p.x, y: p.y, text: text.trim() }));
            state.selectedIds = [obj.id];
            app.changed();
          }
          break;
        }
        default:
          break;
      }
    }

    _onPointerMove(ev) {
      const d = this.drag;
      if (!d) return;
      const p = this._courtPoint(ev);

      switch (d.kind) {
        case 'move':
          Tools.moveObject(d.obj, p.x - d.last.x, p.y - d.last.y);
          d.last = p;
          d.moved = true;
          break;
        case 'rotate': {
          let deg = (Math.atan2(p.y - d.obj.y, p.x - d.obj.x) * 180) / Math.PI;
          if (ev.shiftKey) deg = Math.round(deg / 15) * 15;   // Shift = krok 15°
          d.obj.rotation = Math.round(deg);
          break;
        }
        case 'endpoint':
          d.obj.points[d.obj.points.length - 1] = { x: p.x, y: p.y };
          break;
        case 'rect':
          d.obj.x = Math.min(d.start.x, p.x);
          d.obj.y = Math.min(d.start.y, p.y);
          d.obj.w = Math.abs(p.x - d.start.x);
          d.obj.h = Math.abs(p.y - d.start.y);
          break;
        case 'pen':
          if (dist(p, d.last) >= PEN_STEP) {
            d.obj.points.push({ x: p.x, y: p.y });
            d.last = p;
          }
          break;
        default:
          break;
      }
      this.app.render();
    }

    _onPointerUp(ev) {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      try { this.app.canvas.releasePointerCapture(ev.pointerId); } catch (e) { /* už uvolněno */ }

      const app = this.app;
      let discard = false;

      if (d.created) {
        const o = d.obj;
        if (d.kind === 'endpoint' && dist(o.points[0], o.points[o.points.length - 1]) < MIN_DRAG) discard = true;
        if (d.kind === 'rect' && (o.w < 0.3 || o.h < 0.3)) discard = true;
        if (d.kind === 'pen' && o.points.length < 2) discard = true;
      }

      if (discard) {
        this._removeObject(d.obj.id);
        app.render();
        return;
      }

      // Text se vykresluje přichycený dovnitř plochy; po přetažení srovnat
      // jeho kotvu se zobrazenou polohou, aby se příště "nezasekl" za okrajem
      if (d.kind === 'move' && d.obj.type === T.TEXT) {
        const layout = app.renderer._textLines(d.obj);
        d.obj.x = layout.cx;
        d.obj.y = layout.cy;
      }

      if (d.created) app.state.selectedIds = [d.obj.id];
      app.changed();
    }

    /** Dvojklik: úprava popisku hráče nebo textu. */
    _onDoubleClick(ev) {
      const app = this.app;
      if (app.isPlaying() || app.state.tool !== 'select') return;
      ev.preventDefault();
      const p = this._courtPoint(ev);
      const hit = this.hitTest(app.currentPhase().objects, p);
      if (!hit) return;

      if (hit.type === T.PLAYER) {
        const roster = hit.playerId ? S.getRosterPlayer(app.scene, hit.playerId) : null;
        const msg = roster
          ? 'Popisek hráče (' + roster.name + ', č. ' + roster.number + '). Prázdné = číslo ze sestavy:'
          : 'Popisek hráče (číslo nebo písmeno):';
        const value = askText(msg, hit.label || '');
        if (value === null) return;
        hit.label = value.trim().slice(0, 4);
        app.state.selectedIds = [hit.id];
        app.changed();
      } else if (hit.type === T.TEXT) {
        const value = askText('Text:', hit.text || '');
        if (value === null) return;
        if (value.trim()) hit.text = value.trim();
        app.state.selectedIds = [hit.id];
        app.changed();
      }
    }

    _onKeyDown(ev) {
      const tag = (ev.target && ev.target.tagName) || '';
      if (tag === 'INPUT' || tag === 'TEXTAREA' || ev.target.isContentEditable) return;
      const app = this.app;

      if (ev.key === 'Delete' || ev.key === 'Backspace') {
        if (app.isPlaying() || app.state.selectedIds.length === 0) return;
        ev.preventDefault();
        const ids = app.state.selectedIds.slice();
        const allPhases = ev.shiftKey;   // Shift+Delete = odstranit ze všech fází
        ids.forEach(function (id) {
          S.removeObject(app.scene, id, allPhases
            ? { allPhases: true }
            : { phaseIndex: app.state.phaseIndex });
        });
        app.state.selectedIds = [];
        app.changed();
      } else if (ev.key === 'Escape') {
        this.drag = null;
        app.state.selectedIds = [];
        app.setTool('select');
      }
    }
  }

  FB.Tools = Tools;
})(window);
