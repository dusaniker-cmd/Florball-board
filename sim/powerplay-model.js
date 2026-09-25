/**
 * powerplay-model.js — jednoduchý geometrický model přesilovky 5 na 3.
 *
 * Běží v prohlížeči i v Node (module.exports). Souřadnice jako v appce:
 * hřiště 40 × 20 m, útočíme na branku VPRAVO (branková čára x = 36,5,
 * branka y 9,2–10,8, velké brankoviště x 33,15–37,15, y 7,5–12,5,
 * brankářský prostor x 35,5–36,5, y 8,75–11,25).
 *
 * Co model umí říct (a nic víc):
 *   - hodnotu střely z místa (podle úhlu na branku, vzdálenosti, bloku
 *     obránce v dráze, tlaku obránce u střelce, posunu brankáře po přihrávce)
 *   - průchodnost přihrávky (hůl obránce v dráze, délka, čas doběhnutí
 *     obránce k příjemci vs. čas přihrávky)
 *   - z toho pro každého možného hráče s míčkem nejlepší okamžitou akci
 *     (střela, nebo přihrávka + střela z první) a průměr přes všechny
 *     držitele míčku = hodnota rozestavení.
 *
 * Všechny konstanty jsou odhady (rychlosti, dosah hole, kalibrace xG na
 * ~10 % celkovou střeleckou úspěšnost). Model NEZNÁ pohyb hráčů v čase,
 * clony, dorážky ani individuální kvalitu. Je to průhledná geometrie,
 * ne simulace zápasu.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PowerPlayModel = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const COURT = { width: 40, height: 20 };
  const GOAL = {
    lineX: 36.5, cy: 10, halfWidth: 0.8, depth: 0.65,
    crease: { x1: 33.15, x2: 37.15, y1: 7.5, y2: 12.5 },
    keeper: { x1: 35.5, x2: 36.5, y1: 8.75, y2: 11.25 },
  };

  const P = {
    playerSpeed: 6.0,      // m/s, obránce při doběhnutí
    reaction: 0.3,         // s
    passSpeed: 18,         // m/s
    receiveTime: 0.25,     // s zpracování / střela z první
    stickReach: 1.1,       // m, dosah hole obránce v přihrávkové dráze
    blockReach: 0.75,      // m, tělo + hůl v dráze střely
    pressureDist: 1.6,     // m, obránce "u střelce"
    xgAngle: 0.9,          // xG ≈ xgAngle × úhel na branku (rad) × otevřenost
    xgMax: 0.6,
    goalieSetShare: 0.35,  // podíl hodnoty, který zbývá proti usazenému brankáři
    oneTimer: 1.25,        // střela z první po přihrávce
    lateralShiftFull: Math.PI / 3, // posun brankáře o 60° = úplně mimo
    blockedFactor: 0.15,
    pressureFactor: 0.5,
    passOpen: 0.92,
    passClosed: 0.25,
    longPass: 12,          // m, delší přihrávka se penalizuje
    longPassFactor: 0.85,
    twoPassFactor: 0.85,   // druhá přihrávka: víc času, víc rizika
    minAttSep: 2.5,
    minDefSep: 1.5,
    shiftShare: 0.35,      // obránce se přiblíží o 35 % vzdálenosti k míčku…
    settleShift: 2.2,      // …nejvýš o 2,2 m, když je míček u hráče v klidu
  };

  // ------------------------------------------------------------------ geom

  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function distToSegment(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return { d: dist(p, a), t: 0 };
    let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    return { d: dist(p, { x: a.x + t * dx, y: a.y + t * dy }), t: t };
  }

  function inRect(p, r) { return p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2; }

  /** Úhel, pod kterým střelec vidí branku (rad). Za brankovou čárou = 0. */
  function goalAngle(p) {
    if (p.x >= GOAL.lineX - 0.05) return 0;
    const a1 = Math.atan2(GOAL.cy - GOAL.halfWidth - p.y, GOAL.lineX - p.x);
    const a2 = Math.atan2(GOAL.cy + GOAL.halfWidth - p.y, GOAL.lineX - p.x);
    return Math.abs(a2 - a1);
  }

  function goalCenter() { return { x: GOAL.lineX, y: GOAL.cy }; }

  /** Úhel polohy vůči středu branky (pro posun brankáře). */
  function bearingFromGoal(p) {
    return Math.atan2(p.y - GOAL.cy, GOAL.lineX - p.x);
  }

  // --------------------------------------------------------------- střela

  /**
   * Geometrická hodnota střely: úhel na branku × kalibrace. `setFactor`
   * 1 = brankář je usazený a kryje většinu branky (zbývá ~35 % hodnoty),
   * 0 = brankář je po krosu úplně mimo (plná geometrická hodnota).
   */
  function baseXG(p, setFactor) {
    const sf = typeof setFactor === 'number' ? setFactor : 1;
    const open = P.goalieSetShare + (1 - P.goalieSetShare) * (1 - sf);
    return Math.min(P.xgMax, P.xgAngle * goalAngle(p) * open);
  }

  function shotBlocked(shooter, defenders) {
    const gc = goalCenter();
    for (const d of defenders) {
      const s = distToSegment(d, shooter, gc);
      if (s.t > 0.05 && s.t < 0.95 && s.d <= P.blockReach) return d;
    }
    return null;
  }

  function nearestDefender(p, defenders) {
    let best = null, bd = Infinity;
    for (const d of defenders) { const dd = dist(p, d); if (dd < bd) { bd = dd; best = d; } }
    return { d: best, dist: bd };
  }

  /** Čas, za který nejbližší obránce dostoupí hráče na tlak. */
  function timeToPressure(p, defenders) {
    const n = nearestDefender(p, defenders);
    if (!n.d) return Infinity;
    return P.reaction + Math.max(0, n.dist - P.pressureDist) / P.playerSpeed;
  }

  /**
   * Hodnota střely hráče `shooter` v situaci, kdy míček přišel z `from`
   * (null = střílí sám z držení).
   */
  function shotValue(shooter, from, defenders, elapsed) {
    const notes = [];
    if (goalAngle(shooter) <= 0) return { xg: 0, notes: ['bez úhlu na branku'] };

    // usazenost brankáře: po krosu se musí přesouvat a otevírá branku
    let setFactor = 1;
    if (from) {
      const shift = Math.abs(bearingFromGoal(shooter) - bearingFromGoal(from));
      setFactor = Math.max(0, 1 - shift / P.lateralShiftFull);
      if (setFactor < 0.6) notes.push('brankář se musí přesunout');
    }
    let xg = baseXG(shooter, setFactor);

    const blocker = shotBlocked(shooter, defenders);
    if (blocker) { xg *= P.blockedFactor; notes.push('střela v bloku'); }

    if (from) {
      xg *= P.oneTimer;
      const passTime = (elapsed || 0) + dist(from, shooter) / P.passSpeed + P.receiveTime;
      // obránci, kteří střelce stihnou dostoupit během přihrávky (každý půlí)
      const arriving = defenders.filter(function (d) {
        return P.reaction + Math.max(0, dist(d, shooter) - P.pressureDist) / P.playerSpeed <= passTime;
      }).length;
      if (arriving > 0) { xg *= Math.pow(P.pressureFactor, arriving); notes.push(arriving > 1 ? 'obránci stihnou dostoupit' : 'obránce stihne dostoupit'); }
    } else {
      // střela z držení: každý obránce v dosahu tlaku hodnotu půlí
      const near = defenders.filter(function (d) { return dist(d, shooter) <= P.pressureDist; }).length;
      if (near > 0) { xg *= Math.pow(P.pressureFactor, near); notes.push(near > 1 ? 'obklíčen' : 'pod tlakem'); }
    }
    return { xg: Math.min(P.xgMax, xg), notes: notes };
  }

  // ------------------------------------------------------------- přihrávka

  function passValue(from, to, defenders) {
    let p = P.passOpen;
    const notes = [];
    for (const d of defenders) {
      const s = distToSegment(d, from, to);
      if (s.t > 0.02 && s.t < 0.98 && s.d <= P.stickReach) { p = P.passClosed; notes.push('hůl v dráze'); break; }
    }
    const len = dist(from, to);
    if (len > P.longPass) { p *= P.longPassFactor; notes.push('dlouhá přihrávka'); }
    return { p: p, notes: notes, len: len };
  }

  // ------------------------------------------------ posun obrany za míčkem

  /**
   * Obrana se stahuje k hráči s míčkem: každý obránce se posune ze své
   * základní pozice směrem k `target` o část vzdálenosti, nejvýš `maxShift`.
   * Tím se otevírá vzdálená strana, což je podstata přesilovky.
   */
  function shiftDefenders(base, target, maxShift) {
    return base.map(function (d) {
      const dd = dist(d, target);
      if (dd < 0.01) return { x: d.x, y: d.y };
      const s = Math.min(maxShift, P.shiftShare * dd);
      return { x: d.x + (target.x - d.x) / dd * s, y: d.y + (target.y - d.y) / dd * s };
    });
  }

  // ---------------------------------------------------------- vyhodnocení

  /**
   * @param {{x,y}[]} attackers  5 útočníků
   * @param {{x,y}[]} defenders  3 obránci
   * @returns {{ score, carriers: [{ index, best, options }] }}
   */
  function evaluate(attackers, defenders) {
    const carriers = attackers.map(function (c, ci) {
      const options = [];
      // obrana je stažená k hráči s míčkem
      const def = shiftDefenders(defenders, c, P.settleShift);
      const shoot = shotValue(c, null, def);
      options.push({ type: 'shot', from: ci, to: ci, path: [ci], value: shoot.xg, notes: shoot.notes, defenders: def });
      attackers.forEach(function (r, ri) {
        if (ri === ci) return;
        const pass = passValue(c, r, def);
        const shot = shotValue(r, c, def, 0);
        options.push({
          type: 'pass', from: ci, to: ri, path: [ci, ri],
          value: pass.p * shot.xg,
          passP: pass.p, shotXg: shot.xg,
          notes: pass.notes.concat(shot.notes),
          defenders: def,
        });
        // dvě přihrávky: c → r → r2, střela z první; obrana se za dobu první
        // přihrávky stihne posunout k r jen o kus (rychlost × čas)
        const t1 = pass.len / P.passSpeed + P.receiveTime;
        const def2 = shiftDefenders(def, r, Math.max(0, (t1 - P.reaction) * P.playerSpeed));
        attackers.forEach(function (r2, r2i) {
          if (r2i === ci || r2i === ri) return;
          const pass2 = passValue(r, r2, def2);
          const shot2 = shotValue(r2, r, def2, t1);
          const notes = pass.notes.concat(pass2.notes, shot2.notes);
          options.push({
            type: 'pass2', from: ci, to: r2i, via: ri, path: [ci, ri, r2i],
            value: pass.p * pass2.p * shot2.xg * P.twoPassFactor,
            passP: pass.p * pass2.p, shotXg: shot2.xg,
            notes: notes.filter(function (n, i) { return notes.indexOf(n) === i; }),
            defenders: def2,
          });
        });
      });
      options.sort(function (a, b) { return b.value - a.value; });
      return { index: ci, best: options[0], options: options };
    });
    const score = carriers.reduce(function (s, c) { return s + c.best.value; }, 0) / carriers.length;
    return { score: score, carriers: carriers };
  }

  // ------------------------------------------------------------- omezení

  const ATT_BOUNDS = { x1: 20.5, x2: 39.3, y1: 0.7, y2: 19.3 };
  const DEF_BOUNDS = { x1: 27, x2: 36.3, y1: 1.5, y2: 18.5 };

  function validAttacker(p, others, idx) {
    if (!inRect(p, ATT_BOUNDS)) return false;
    if (inRect(p, GOAL.keeper)) return false;
    for (let i = 0; i < others.length; i++) {
      if (i !== idx && dist(p, others[i]) < P.minAttSep) return false;
    }
    return true;
  }

  function validDefender(p, others, idx) {
    if (!inRect(p, DEF_BOUNDS)) return false;
    if (inRect(p, GOAL.keeper)) return false;
    for (let i = 0; i < others.length; i++) {
      if (i !== idx && dist(p, others[i]) < P.minDefSep) return false;
    }
    return true;
  }

  // ----------------------------------------------------------- optimalizace

  function clone(list) { return list.map(function (p) { return { x: p.x, y: p.y }; }); }

  function rnd(rng, a, b) { return a + (b - a) * rng(); }

  /** Jednoduchý deterministický generátor (mulberry32), aby šly výsledky opakovat. */
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Obrana: nejlepší odpověď na dané útočníky (minimalizuje skóre).
   * Horolezení z výchozího postavení, `iters` kroků.
   */
  function bestDefense(attackers, defendersStart, iters, rng) {
    rng = rng || makeRng(7);
    let cur = clone(defendersStart);
    let curScore = evaluate(attackers, cur).score;
    let step = 2.5;
    for (let i = 0; i < iters; i++) {
      const k = Math.floor(rng() * cur.length);
      const cand = clone(cur);
      cand[k] = { x: cur[k].x + rnd(rng, -step, step), y: cur[k].y + rnd(rng, -step, step) };
      if (!validDefender(cand[k], cand, k)) continue;
      const s = evaluate(attackers, cand).score;
      if (s < curScore) { cur = cand; curScore = s; }
      if (i % 60 === 59) step = Math.max(0.4, step * 0.85);
    }
    return { defenders: cur, score: curScore };
  }

  /**
   * Útok: hledá rozestavení s nejvyšším skóre PROTI nejlepší obraně
   * (min‑max). Vrací nejlepší nalezené útočníky, obranu a skóre.
   */
  function bestAttack(attackersStart, defendersStart, opts) {
    opts = opts || {};
    const rng = makeRng(opts.seed || 11);
    const outer = opts.outer || 400;
    const inner = opts.inner || 150;
    let cur = clone(attackersStart);
    let curDef = bestDefense(cur, defendersStart, inner * 2, rng);
    let curScore = curDef.score;
    let best = { attackers: clone(cur), defenders: clone(curDef.defenders), score: curScore };
    let step = 3;
    for (let i = 0; i < outer; i++) {
      const k = Math.floor(rng() * cur.length);
      const cand = clone(cur);
      cand[k] = { x: cur[k].x + rnd(rng, -step, step), y: cur[k].y + rnd(rng, -step, step) };
      if (!validAttacker(cand[k], cand, k)) continue;
      const def = bestDefense(cand, curDef.defenders, inner, rng);
      if (def.score > curScore) {
        cur = cand; curDef = def; curScore = def.score;
        if (curScore > best.score) best = { attackers: clone(cur), defenders: clone(curDef.defenders), score: curScore };
      }
      if (i % 50 === 49) step = Math.max(0.5, step * 0.9);
      if (opts.onProgress) opts.onProgress((i + 1) / outer, best);
    }
    return best;
  }

  return {
    COURT: COURT, GOAL: GOAL, P: P,
    ATT_BOUNDS: ATT_BOUNDS, DEF_BOUNDS: DEF_BOUNDS,
    dist: dist, goalAngle: goalAngle, baseXG: baseXG,
    shotValue: shotValue, passValue: passValue, evaluate: evaluate, shiftDefenders: shiftDefenders,
    validAttacker: validAttacker, validDefender: validDefender,
    bestDefense: bestDefense, bestAttack: bestAttack, makeRng: makeRng,
  };
});
