/**
 * phases.js — časová osa: interpolace stavu objektů mezi fázemi.
 *
 * Fáze N a N+1 se párují podle `id` objektů. Číselné vlastnosti se lineárně
 * interpolují (s volitelným easingem), body čar po jednotlivých vrcholech.
 * Objekt, který v další fázi chybí, se vytrácí (opacity → 0); objekt, který
 * se v další fázi objevuje, se naopak objevuje (opacity 0 → 1).
 *
 * Výstupem je vždy nové pole objektů ve stejném tvaru jako ve scene.js,
 * takže ho renderer vykreslí beze změny.
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});
  const deepClone = FB.scene.deepClone;

  /** Vlastnosti, které se interpolují číselně. Ostatní se přebírají skokově. */
  const NUMERIC_PROPS = ['x', 'y', 'radius', 'w', 'h', 'fontSize', 'width', 'opacity'];

  const EASINGS = {
    linear: function (t) { return t; },
    easeInOut: function (t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    },
  };

  function clamp01(t) {
    return Math.max(0, Math.min(1, t));
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /** Úhel ve stupních po nejkratší cestě (350° → 10° jde přes 0°, ne přes 180°). */
  function lerpAngle(a, b, t) {
    let diff = ((b - a) % 360 + 540) % 360 - 180;
    return a + diff * t;
  }

  function lerpPoints(pa, pb, t) {
    if (!pa || !pb) return deepClone(pb || pa || []);
    if (pa.length === pb.length) {
      return pa.map(function (p, i) {
        return { x: lerp(p.x, pb[i].x, t), y: lerp(p.y, pb[i].y, t) };
      });
    }
    // Různý počet bodů (např. jinak nakreslené pero) — přepnout v půlce, bez morfingu
    return deepClone(t < 0.5 ? pa : pb);
  }

  /** Interpolovaný stav jednoho objektu mezi dvěma jeho verzemi. */
  function interpolateObject(a, b, t) {
    const out = deepClone(t < 0.5 ? a : b);
    NUMERIC_PROPS.forEach(function (key) {
      if (typeof a[key] === 'number' && typeof b[key] === 'number') {
        out[key] = lerp(a[key], b[key], t);
      }
    });
    if (typeof a.rotation === 'number' && typeof b.rotation === 'number') {
      out.rotation = lerpAngle(a.rotation, b.rotation, t);
    }
    if (a.points || b.points) {
      out.points = lerpPoints(a.points, b.points, t);
    }
    return out;
  }

  /**
   * Interpoluje dvě pole objektů. `t` v rozsahu 0..1 (0 = přesně fáze A).
   * Pořadí: objekty z A v původním pořadí, pak nové objekty z B.
   */
  function interpolateObjects(objectsA, objectsB, t, options) {
    const opts = options || {};
    const easing = typeof opts.easing === 'function'
      ? opts.easing
      : (EASINGS[opts.easing] || EASINGS.easeInOut);
    const te = easing(clamp01(t));

    const byIdB = new Map();
    (objectsB || []).forEach(function (o) { byIdB.set(o.id, o); });
    const seen = new Set();
    const result = [];

    (objectsA || []).forEach(function (a) {
      const b = byIdB.get(a.id);
      seen.add(a.id);
      if (b) {
        result.push(interpolateObject(a, b, te));
      } else {
        const out = deepClone(a);
        out.opacity = (typeof a.opacity === 'number' ? a.opacity : 1) * (1 - te);
        result.push(out);
      }
    });

    (objectsB || []).forEach(function (b) {
      if (seen.has(b.id)) return;
      const out = deepClone(b);
      out.opacity = (typeof b.opacity === 'number' ? b.opacity : 1) * te;
      result.push(out);
    });

    return result;
  }

  /**
   * Stav scény v čase `timeMs` od začátku animace.
   * Vrací { objects, phaseIndex, t } — phaseIndex je fáze, ze které se
   * právě přechází, t je poměr 0..1 uvnitř tohoto přechodu.
   */
  function stateAtTime(scene, timeMs, options) {
    const phases = scene.phases;
    const last = phases.length - 1;
    let acc = 0;

    for (let i = 0; i < last; i++) {
      const dur = Math.max(1, phases[i].duration);
      if (timeMs < acc + dur) {
        const t = (timeMs - acc) / dur;
        return {
          objects: interpolateObjects(phases[i].objects, phases[i + 1].objects, t, options),
          phaseIndex: i,
          t: clamp01(t),
        };
      }
      acc += dur;
    }

    return {
      objects: deepClone(phases[last].objects),
      phaseIndex: last,
      t: 0,
    };
  }

  FB.phases = {
    EASINGS: EASINGS,
    NUMERIC_PROPS: NUMERIC_PROPS,
    lerp: lerp,
    lerpAngle: lerpAngle,
    interpolateObject: interpolateObject,
    interpolateObjects: interpolateObjects,
    stateAtTime: stateAtTime,
  };
})(window);
