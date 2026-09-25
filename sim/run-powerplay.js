/**
 * run-powerplay.js — spustí model přesilovky 5 na 3 v Node.
 *
 *   node sim/run-powerplay.js            porovná známá rozestavení + hledá nejlepší
 *   node sim/run-powerplay.js in.json    vyhodnotí a doladí rozestavení ze souboru
 *                                        ({ attackers:[{x,y}×5], defenders:[{x,y}×3] })
 *
 * Výstup: sim/out/powerplay-results.json + přehled do konzole.
 */
const fs = require('fs');
const path = require('path');
const M = require('./powerplay-model.js');

// Známá rozestavení útoku (útočíme doprava, branka na x = 36,5)
const KNOWN = {
  'Deštník 1-3-1': {
    attackers: [
      { x: 25, y: 10 },      // point
      { x: 30.5, y: 4.5 },   // levý půlmantinel
      { x: 30.5, y: 15.5 },  // pravý půlmantinel
      { x: 33.5, y: 10 },    // střed / bumper
      { x: 36, y: 13.5 },    // u tyče
    ],
  },
  'Box + point (2-1-2)': {
    attackers: [
      { x: 25.5, y: 10 },
      { x: 30, y: 5 }, { x: 30, y: 15 },
      { x: 35.5, y: 6.5 }, { x: 35.5, y: 13.5 },
    ],
  },
  'Playbook TKS (point, 2 krajní, 2 spodní)': {
    attackers: [
      { x: 21.5, y: 9.6 }, { x: 27, y: 3.6 }, { x: 27, y: 15.3 },
      { x: 30, y: 9.6 }, { x: 33.7, y: 15.7 },
    ],
  },
  'Dva u branky + tři nahoře (2-3)': {
    attackers: [
      { x: 27, y: 4 }, { x: 26, y: 10 }, { x: 27, y: 16 },
      { x: 35.5, y: 7 }, { x: 35.5, y: 13 },
    ],
  },
};

const TRIANGLE_START = [
  { x: 31.5, y: 10 },    // vrchol nahoře proti pointovi
  { x: 34.5, y: 7.2 },
  { x: 34.5, y: 12.8 },
];

function fmt(p) { return '(' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ')'; }

function describe(name, attackers, defenders) {
  const ev = M.evaluate(attackers, defenders);
  console.log('\n== ' + name + ' | skóre ' + ev.score.toFixed(3));
  console.log('  útok:   ' + attackers.map(fmt).join(' '));
  console.log('  obrana: ' + defenders.map(fmt).join(' '));
  ev.carriers.forEach(function (c) {
    const b = c.best;
    const what = b.type === 'shot' ? 'střela'
      : b.type === 'pass2' ? 'přihrávky ' + b.path.map(function (i) { return i + 1; }).join('→') + ' (' + Math.round(b.passP * 100) + ' %) a střela'
      : 'přihrávka na ' + (b.to + 1) + ' (' + Math.round(b.passP * 100) + ' %) a střela';
    console.log('   míček u ' + (c.index + 1) + ': ' + what + ' = ' + b.value.toFixed(3) + (b.notes.length ? '  [' + b.notes.join(', ') + ']' : ''));
  });
  return ev;
}

function main() {
  const results = { generatedAt: new Date().toISOString(), known: {}, best: null };
  const input = process.argv[2];

  if (input) {
    const data = JSON.parse(fs.readFileSync(input, 'utf8'));
    const att = data.attackers, def = data.defenders || TRIANGLE_START;
    describe('Zadané rozestavení, zadaná obrana', att, def);
    const bd = M.bestDefense(att, def, 1200);
    describe('Zadané rozestavení, nejlepší obrana', att, bd.defenders);
    const ba = M.bestAttack(att, bd.defenders, { outer: 600, inner: 150, seed: 3 });
    describe('Doladěný útok proti nejlepší obraně', ba.attackers, ba.defenders);
    results.input = { attackers: att, defenders: def, bestDefense: bd, tuned: ba };
  } else {
    let seedIdx = 1;
    Object.keys(KNOWN).forEach(function (name) {
      const att = KNOWN[name].attackers;
      const naive = M.evaluate(att, TRIANGLE_START);
      const bd = M.bestDefense(att, TRIANGLE_START, 1500, M.makeRng(seedIdx++));
      describe(name + ' proti nejlepší obraně', att, bd.defenders);
      results.known[name] = { attackers: att, naiveScore: naive.score, bestDefense: bd.defenders, score: bd.score };
    });

    // Hledání nejlepšího útoku: start z každého známého rozestavení
    let best = null;
    Object.keys(KNOWN).forEach(function (name, i) {
      const ba = M.bestAttack(KNOWN[name].attackers, TRIANGLE_START, { outer: 500, inner: 120, seed: 100 + i });
      console.log('\n-- start z "' + name + '": nejlepší nalezené skóre ' + ba.score.toFixed(3));
      if (!best || ba.score > best.score) best = Object.assign({ startedFrom: name }, ba);
    });
    describe('NEJLEPŠÍ NALEZENÝ ÚTOK (proti nejlepší obraně), start z "' + best.startedFrom + '"', best.attackers, best.defenders);
    results.best = best;
  }

  const outDir = path.join(__dirname, 'out');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
  fs.writeFileSync(path.join(outDir, 'powerplay-results.json'), JSON.stringify(results, null, 2));
  console.log('\nVýsledky: sim/out/powerplay-results.json');
}

main();
