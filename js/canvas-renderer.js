/**
 * canvas-renderer.js — vykreslení hřiště a objektů na canvas.
 *
 * Renderer nezná fáze ani časování. Dostane pole objektů (ve tvaru ze scene.js)
 * a vykreslí je. Přehrávač mu později bude posílat už interpolované objekty,
 * takže tady není žádná logika o "co je mezi fází 1 a 2".
 *
 * Souřadnice: objekty jsou v metrech (hřiště 40 x 20, počátek vlevo nahoře).
 * Renderer si spočítá měřítko tak, aby se hřiště i s okrajem vešlo do canvasu,
 * a kreslí přes ctx transformaci přímo v metrech. Tloušťky čar, poloměry i
 * velikost písma jsou proto také v metrech a škálují s hřištěm.
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});

  /** Geometrie hřiště v metrech. Vychází z pravidel IFF, rozměry jsou přibližné. */
  const COURT_GEOMETRY = Object.freeze({
    width: 40,
    height: 20,
    cornerRadius: 2.85,
    goalLineX: 3.5,             // vzdálenost brankové čáry od kratšího mantinelu
    goalWidth: 1.6,
    goalDepth: 0.65,
    creaseX: 2.85,              // velké brankoviště: přední hrana od mantinelu
    creaseWidth: 5,             // 5 m napříč (osa y)
    creaseDepth: 4,             // 4 m do hloubky (osa x)
    keeperAreaWidth: 2.5,       // malé brankoviště (brankářský prostor)
    keeperAreaDepth: 1,
    faceoffInset: 1.5,          // body na vhazování 1,5 m od delšího mantinelu
    dotRadius: 0.2,
  });

  const COURT_STYLE = Object.freeze({
    background: '#1e2430',
    floor: '#e7edf3',
    board: '#2b3646',
    boardWidth: 0.25,
    line: '#2f5f9e',
    lineWidth: 0.08,
    goal: '#1b2a3a',
    goalWidth: 0.12,
  });

  /** Pořadí vrstev: nižší se kreslí dřív (zóny pod hráči, text nahoře). */
  const LAYER_ORDER = {
    zone: 0,
    pen: 1,
    line: 2,
    arrow: 3,
    ball: 4,
    player: 5,
    text: 6,
  };

  const SELECTION_COLOR = '#f5b400';

  /** Výchozí šířka odstavce textu v metrech, když objekt nemá vlastní maxWidth. */
  const DEFAULT_TEXT_WIDTH = 18;

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  /** Hrubý odhad, zda je barva (#rgb / #rrggbb) světlá; jiné formáty = tmavá. */
  function isLightColor(color) {
    const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color || '');
    if (!m) return false;
    let hex = m[1];
    if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) > 160;
  }

  // ---------------------------------------------------------------------------

  class CanvasRenderer {
    /**
     * @param {HTMLCanvasElement} canvas
     * @param {{ padding?: number, background?: string, pixelRatio?: number }} [options]
     *   padding — volný okraj kolem hřiště v metrech
     *   pixelRatio — pevný poměr pixelů (export videa); jinak devicePixelRatio
     */
    constructor(canvas, options) {
      const opts = options || {};
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.geometry = COURT_GEOMETRY;
      // Okraj 2,2 m dává místo na dvouřádkový popisek nad hřištěm
      this.padding = typeof opts.padding === 'number' ? opts.padding : 2.2;
      this.background = opts.background || COURT_STYLE.background;
      this.pixelRatio = typeof opts.pixelRatio === 'number' ? opts.pixelRatio : null;

      // Zobrazovací volby pro hráče (platí pro všechny najednou)
      this.view = Object.assign({ direction: false, sticks: true }, opts.view || {});

      this.dpr = 1;
      this.cssWidth = 0;
      this.cssHeight = 0;
      this.scale = 1;     // pixely (CSS) na metr
      this.offsetX = 0;   // posun hřiště v CSS pixelech, aby bylo vycentrované
      this.offsetY = 0;
    }

    /**
     * Nastaví velikost canvasu (v CSS pixelech) s ohledem na devicePixelRatio
     * a přepočítá měřítko tak, aby se hřiště i s okrajem vešlo celé.
     */
    resize(cssWidth, cssHeight) {
      const dpr = this.pixelRatio || global.devicePixelRatio || 1;
      this.dpr = dpr;
      this.cssWidth = Math.max(1, Math.floor(cssWidth));
      this.cssHeight = Math.max(1, Math.floor(cssHeight));

      this.canvas.width = Math.round(this.cssWidth * dpr);
      this.canvas.height = Math.round(this.cssHeight * dpr);
      this.canvas.style.width = this.cssWidth + 'px';
      this.canvas.style.height = this.cssHeight + 'px';

      const g = this.geometry;
      const totalW = g.width + 2 * this.padding;
      const totalH = g.height + 2 * this.padding;
      this.scale = Math.min(this.cssWidth / totalW, this.cssHeight / totalH);
      this.offsetX = (this.cssWidth - g.width * this.scale) / 2;
      this.offsetY = (this.cssHeight - g.height * this.scale) / 2;
    }

    /** Přepne zobrazovací volby: { direction: bool, sticks: bool }. */
    setView(patch) {
      Object.assign(this.view, patch || {});
    }

    /** Metry → CSS pixely canvasu (pro UI, hit‑testing, kurzor...). */
    toCanvas(x, y) {
      return {
        x: this.offsetX + x * this.scale,
        y: this.offsetY + y * this.scale,
      };
    }

    /** CSS pixely canvasu → metry. */
    toCourt(px, py) {
      return {
        x: (px - this.offsetX) / this.scale,
        y: (py - this.offsetY) / this.scale,
      };
    }

    /**
     * Vykreslí hřiště a objekty.
     *
     * @param {Array} objects   objekty ve tvaru ze scene.js
     * @param {Object} [opts]
     * @param {(obj) => string} [opts.labelFor]   popisek hráče (např. číslo ze sestavy)
     * @param {Iterable<string>} [opts.selectedIds]  id objektů se zvýrazněným výběrem
     */
    render(objects, opts) {
      const o = opts || {};
      const ctx = this.ctx;
      const selected = new Set(o.selectedIds || []);
      const labelFor = o.labelFor || function (obj) { return obj.label || ''; };

      // Pozadí v pixelovém prostoru
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.fillStyle = this.background;
      ctx.fillRect(0, 0, this.cssWidth, this.cssHeight);

      // Vše ostatní v metrech
      ctx.setTransform(
        this.dpr * this.scale, 0, 0, this.dpr * this.scale,
        this.dpr * this.offsetX, this.dpr * this.offsetY
      );
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      this.drawCourt();

      const sorted = (objects || []).slice().sort(function (a, b) {
        return (LAYER_ORDER[a.type] || 0) - (LAYER_ORDER[b.type] || 0);
      });
      for (const obj of sorted) {
        this.drawObject(obj, labelFor);
      }
      for (const obj of sorted) {
        if (selected.has(obj.id)) this.drawSelection(obj);
      }
    }

    // -------------------------------------------------------------------------
    // Hřiště
    // -------------------------------------------------------------------------

    drawCourt() {
      const ctx = this.ctx;
      const g = this.geometry;

      // Plocha s oblými rohy + mantinel
      ctx.beginPath();
      this._roundedRect(0, 0, g.width, g.height, g.cornerRadius);
      ctx.fillStyle = COURT_STYLE.floor;
      ctx.fill();
      ctx.lineWidth = COURT_STYLE.boardWidth;
      ctx.strokeStyle = COURT_STYLE.board;
      ctx.stroke();

      ctx.strokeStyle = COURT_STYLE.line;
      ctx.fillStyle = COURT_STYLE.line;
      ctx.lineWidth = COURT_STYLE.lineWidth;

      // Středová čára a středový bod
      ctx.beginPath();
      ctx.moveTo(g.width / 2, 0);
      ctx.lineTo(g.width / 2, g.height);
      ctx.stroke();
      this._dot(g.width / 2, g.height / 2, g.dotRadius);

      // Body na vhazování: na brankových čarách a na středové čáře
      const dotXs = [g.goalLineX, g.width / 2, g.width - g.goalLineX];
      const dotYs = [g.faceoffInset, g.height - g.faceoffInset];
      for (const x of dotXs) for (const y of dotYs) this._dot(x, y, g.dotRadius);

      // Obě poloviny hřiště jsou zrcadlové
      this._drawGoalArea(false);
      this._drawGoalArea(true);
    }

    /** Brankoviště, brankářský prostor, branková čára a branka na jedné straně. */
    _drawGoalArea(mirror) {
      const ctx = this.ctx;
      const g = this.geometry;
      const cy = g.height / 2;
      const mx = mirror ? function (x) { return g.width - x; } : function (x) { return x; };

      // Velké brankoviště
      this._strokeRectMirrored(
        mx(g.creaseX), cy - g.creaseWidth / 2,
        mx(g.creaseX + g.creaseDepth), cy + g.creaseWidth / 2
      );

      // Brankářský prostor (od brankové čáry směrem do hřiště)
      this._strokeRectMirrored(
        mx(g.goalLineX), cy - g.keeperAreaWidth / 2,
        mx(g.goalLineX + g.keeperAreaDepth), cy + g.keeperAreaWidth / 2
      );

      // Branková čára přes šířku brankoviště
      ctx.beginPath();
      ctx.moveTo(mx(g.goalLineX), cy - g.creaseWidth / 2);
      ctx.lineTo(mx(g.goalLineX), cy + g.creaseWidth / 2);
      ctx.stroke();

      // Branka (za brankovou čárou)
      ctx.save();
      ctx.strokeStyle = COURT_STYLE.goal;
      ctx.lineWidth = COURT_STYLE.goalWidth;
      const x1 = mx(g.goalLineX);
      const x2 = mx(g.goalLineX - g.goalDepth);
      const y1 = cy - g.goalWidth / 2;
      const y2 = cy + g.goalWidth / 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2, y2);
      ctx.lineTo(x1, y2);
      ctx.stroke();
      // Síťka: pár šikmých čar, jen náznak
      ctx.lineWidth = 0.03;
      ctx.beginPath();
      const step = 0.25;
      for (let y = y1 + step; y < y2; y += step) {
        ctx.moveTo(x1, y);
        ctx.lineTo(x2, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    _strokeRectMirrored(xa, ya, xb, yb) {
      const x = Math.min(xa, xb);
      const y = Math.min(ya, yb);
      this.ctx.strokeRect(x, y, Math.abs(xb - xa), Math.abs(yb - ya));
    }

    _dot(x, y, r) {
      const ctx = this.ctx;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    _roundedRect(x, y, w, h, r) {
      const ctx = this.ctx;
      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      ctx.arcTo(x + w, y, x + w, y + r, r);
      ctx.lineTo(x + w, y + h - r);
      ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
      ctx.lineTo(x + r, y + h);
      ctx.arcTo(x, y + h, x, y + h - r, r);
      ctx.lineTo(x, y + r);
      ctx.arcTo(x, y, x + r, y, r);
      ctx.closePath();
    }

    // -------------------------------------------------------------------------
    // Objekty
    // -------------------------------------------------------------------------

    drawObject(obj, labelFor) {
      const ctx = this.ctx;
      ctx.save();
      // Volitelná průhlednost — přehrávač ji použije pro fade in/out objektů
      if (typeof obj.opacity === 'number' && obj.type !== 'zone') {
        ctx.globalAlpha = Math.max(0, Math.min(1, obj.opacity));
      }
      switch (obj.type) {
        case 'player': this.drawPlayer(obj, labelFor(obj)); break;
        case 'ball': this.drawBall(obj); break;
        case 'arrow': this.drawArrow(obj); break;
        case 'line': this.drawLine(obj); break;
        case 'text': this.drawText(obj); break;
        case 'zone': this.drawZone(obj); break;
        case 'pen': this.drawPen(obj); break;
        default:
          console.warn('canvas-renderer: neznámý typ objektu', obj.type);
      }
      ctx.restore();
    }

    drawPlayer(obj, label) {
      const ctx = this.ctx;
      const r = obj.radius || 0.8;

      // Prvky závislé na natočení hráče (0° = doprava): trojúhelník směru a hůl
      ctx.save();
      ctx.translate(obj.x, obj.y);
      ctx.rotate(degToRad(obj.rotation || 0));
      if (this.view.direction) {
        ctx.beginPath();
        ctx.moveTo(r + 0.4, 0);
        ctx.lineTo(r - 0.15, 0.4);
        ctx.lineTo(r - 0.15, -0.4);
        ctx.closePath();
        ctx.fillStyle = obj.color;
        ctx.fill();
      }
      if (this.view.sticks && !obj.goalie) {
        // Hůl držená po pravé ruce: tyč od těla dopředu, na konci čepel
        const sx = 0.1, sy = r * 0.55;          // ruce u těla
        const ex = r + 1.0, ey = r * 0.75 + 0.25; // konec tyče
        ctx.lineCap = 'round';
        ctx.lineWidth = 0.09;
        ctx.strokeStyle = '#1f2937';
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(ex, ey);
        ctx.stroke();
        ctx.lineWidth = 0.18;
        ctx.strokeStyle = '#111827';
        ctx.beginPath();
        ctx.moveTo(ex, ey);
        ctx.lineTo(ex + 0.45, ey - 0.1);
        ctx.stroke();
      }
      ctx.restore();

      // Tělo
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2);
      ctx.fillStyle = obj.color;
      ctx.fill();
      ctx.lineWidth = 0.12;
      ctx.strokeStyle = '#ffffff';
      ctx.stroke();

      // Popisek (číslo / jméno) — nerotuje s hráčem
      if (label) {
        const shrink = Math.min(1, 2.2 / label.length);
        const fontSize = r * 1.05 * shrink;
        ctx.font = 'bold ' + fontSize + 'px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, obj.x, obj.y + fontSize * 0.05);
      }
    }

    drawBall(obj) {
      const ctx = this.ctx;
      const r = obj.radius || 0.35;
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, r, 0, Math.PI * 2);
      ctx.fillStyle = obj.color || '#ffffff';
      ctx.fill();
      ctx.lineWidth = 0.06;
      ctx.strokeStyle = '#222222';
      ctx.stroke();
      // Dírky florbalového míčku, jen náznak
      ctx.fillStyle = '#222222';
      const holes = [[0, 0], [r * 0.55, 0], [-r * 0.55, 0], [0, r * 0.55], [0, -r * 0.55]];
      for (const h of holes) {
        ctx.beginPath();
        ctx.arc(obj.x + h[0], obj.y + h[1], r * 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    drawLine(obj) {
      this._strokePolyline(obj.points, obj.color, obj.width, obj.dashed);
    }

    drawArrow(obj) {
      const pts = obj.points || [];
      if (pts.length < 2) return;
      const ctx = this.ctx;
      const width = obj.width || 0.15;
      const headLen = Math.max(width * 4, 0.6);
      const headWidth = headLen * 0.7;

      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const angle = Math.atan2(last.y - prev.y, last.x - prev.x);

      // Dřík se zkrátí, aby nevykukoval z hrotu
      const shaftEnd = {
        x: last.x - Math.cos(angle) * headLen * 0.8,
        y: last.y - Math.sin(angle) * headLen * 0.8,
      };
      const shaft = pts.slice(0, -1).concat([shaftEnd]);
      this._strokePolyline(shaft, obj.color, width, obj.dashed);

      // Hrot
      ctx.save();
      ctx.translate(last.x, last.y);
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-headLen, headWidth / 2);
      ctx.lineTo(-headLen, -headWidth / 2);
      ctx.closePath();
      ctx.fillStyle = obj.color;
      ctx.fill();
      ctx.restore();
    }

    drawPen(obj) {
      const pts = obj.points || [];
      const ctx = this.ctx;
      if (pts.length === 0) return;
      if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0].x, pts[0].y, (obj.width || 0.12) / 2, 0, Math.PI * 2);
        ctx.fillStyle = obj.color;
        ctx.fill();
        return;
      }
      // Vyhlazení přes kvadratické křivky do středů úseček
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      const end = pts[pts.length - 1];
      ctx.lineTo(end.x, end.y);
      ctx.lineWidth = obj.width || 0.12;
      ctx.strokeStyle = obj.color;
      ctx.setLineDash([]);
      ctx.stroke();
    }

    /**
     * Rozdělí text na řádky podle obj.maxWidth (metry; výchozí šířka hřiště
     * minus okraj) a explicitních zlomů. Nastaví ctx.font, takže se volá
     * až po ctx.save().
     */
    _textLines(obj) {
      const ctx = this.ctx;
      const fontSize = obj.fontSize || 1.2;
      ctx.font = '600 ' + fontSize + 'px system-ui, sans-serif';
      const maxWidth = obj.maxWidth || DEFAULT_TEXT_WIDTH;
      const lines = [];
      String(obj.text || '').split('\n').forEach(function (para) {
        const words = para.split(/\s+/).filter(Boolean);
        let line = '';
        words.forEach(function (w) {
          const test = line ? line + ' ' + w : w;
          if (line && ctx.measureText(test).width > maxWidth) {
            lines.push(line);
            line = w;
          } else {
            line = test;
          }
        });
        lines.push(line);
      });
      // Skutečná šířka bloku a střed posunutý tak, aby text nevyjel z plochy
      let width = 0;
      lines.forEach(function (l) { width = Math.max(width, ctx.measureText(l).width); });
      const minX = -this.padding + 0.3;
      const maxX = this.geometry.width + this.padding - 0.3;
      let cx = obj.x;
      if (width < maxX - minX) {
        cx = Math.max(minX + width / 2, Math.min(maxX - width / 2, obj.x));
      } else {
        cx = (minX + maxX) / 2;
      }
      // Totéž svisle
      const lineHeight = fontSize * 1.25;
      const height = lineHeight * lines.length;
      const minY = -this.padding + 0.2;
      const maxY = this.geometry.height + this.padding - 0.2;
      let cy = obj.y;
      if (height < maxY - minY) {
        cy = Math.max(minY + height / 2, Math.min(maxY - height / 2, obj.y));
      } else {
        cy = (minY + maxY) / 2;
      }
      return {
        lines: lines, fontSize: fontSize, lineHeight: lineHeight,
        width: width, height: height, cx: cx, cy: cy,
      };
    }

    drawText(obj) {
      const ctx = this.ctx;
      const t = this._textLines(obj);
      const drawX = t.cx;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      // Kontrastní obrys, aby byl text čitelný přes čáry hřiště i na tmavém okraji
      ctx.lineWidth = t.fontSize * 0.18;
      ctx.strokeStyle = isLightColor(obj.color) ? 'rgba(30,36,48,0.9)' : 'rgba(255,255,255,0.85)';
      ctx.lineJoin = 'round';
      ctx.fillStyle = obj.color;
      const n = t.lines.length;
      t.lines.forEach(function (line, i) {
        const y = t.cy + (i - (n - 1) / 2) * t.lineHeight;
        ctx.strokeText(line, drawX, y);
        ctx.fillText(line, drawX, y);
      });
    }

    drawZone(obj) {
      const ctx = this.ctx;
      const w = obj.w || 1;
      const h = obj.h || 1;
      ctx.beginPath();
      if (obj.shape === 'ellipse') {
        ctx.ellipse(obj.x + w / 2, obj.y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else {
        this._roundedRect(obj.x, obj.y, w, h, Math.min(0.5, w / 4, h / 4));
      }
      ctx.save();
      ctx.globalAlpha = typeof obj.opacity === 'number' ? obj.opacity : 0.3;
      ctx.fillStyle = obj.color;
      ctx.fill();
      ctx.restore();
      ctx.lineWidth = 0.08;
      ctx.strokeStyle = obj.color;
      ctx.setLineDash([]);
      ctx.stroke();
    }

    _strokePolyline(points, color, width, dashed) {
      const pts = points || [];
      if (pts.length < 2) return;
      const ctx = this.ctx;
      const w = width || 0.15;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.lineWidth = w;
      ctx.strokeStyle = color || '#111111';
      ctx.setLineDash(dashed ? [w * 3.5, w * 2.5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // -------------------------------------------------------------------------
    // Výběr a rozměry
    // -------------------------------------------------------------------------

    /**
     * Obalový obdélník objektu v metrech { x, y, w, h }.
     * Slouží pro zvýraznění výběru a později pro hit‑testing v nástrojích.
     */
    getBounds(obj) {
      switch (obj.type) {
        case 'player': {
          const r = (obj.radius || 0.8) + 0.4;
          return { x: obj.x - r, y: obj.y - r, w: 2 * r, h: 2 * r };
        }
        case 'ball': {
          const r = obj.radius || 0.35;
          return { x: obj.x - r, y: obj.y - r, w: 2 * r, h: 2 * r };
        }
        case 'zone':
          return { x: obj.x, y: obj.y, w: obj.w || 1, h: obj.h || 1 };
        case 'text': {
          const t = this._textLines(obj);
          return { x: t.cx - t.width / 2, y: t.cy - t.height / 2, w: t.width, h: t.height };
        }
        case 'arrow':
        case 'line':
        case 'pen': {
          const pts = obj.points || [];
          if (pts.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const p of pts) {
            if (p.x < minX) minX = p.x;
            if (p.y < minY) minY = p.y;
            if (p.x > maxX) maxX = p.x;
            if (p.y > maxY) maxY = p.y;
          }
          const pad = (obj.width || 0.15) * 2;
          return { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
        }
        default:
          return { x: obj.x || 0, y: obj.y || 0, w: 0, h: 0 };
      }
    }

    drawSelection(obj) {
      const ctx = this.ctx;
      const b = this.getBounds(obj);
      const pad = 0.2;
      ctx.save();
      ctx.lineWidth = 0.08;
      ctx.strokeStyle = SELECTION_COLOR;
      ctx.setLineDash([0.3, 0.2]);
      ctx.strokeRect(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad);

      // Úchyt natočení hráče: kroužek na špičce trojúhelníku (tools.js ho chytá)
      if (obj.type === 'player') {
        const r = (obj.radius || 0.8) + 0.4;
        const a = degToRad(obj.rotation || 0);
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.arc(obj.x + Math.cos(a) * r, obj.y + Math.sin(a) * r, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(245,180,0,0.35)';
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  FB.CanvasRenderer = CanvasRenderer;
  FB.COURT_GEOMETRY = COURT_GEOMETRY;
})(window);
