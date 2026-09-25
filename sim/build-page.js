/**
 * build-page.js — vloží model do šablony stránky přesilovky.
 *   node sim/build-page.js [výstupní soubor] [--local]
 * --local přidá <meta charset>, protože lokální náhled nemá obal artefaktu.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const local = args.includes('--local');
const outArg = args.find(function (a) { return !a.startsWith('--'); });
const out = outArg || path.join(__dirname, 'out', 'powerplay.html');

const model = fs.readFileSync(path.join(__dirname, 'powerplay-model.js'), 'utf8');
const tpl = fs.readFileSync(path.join(__dirname, 'powerplay-page.template.html'), 'utf8');
if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });

const html = (local ? '<meta charset="utf-8">\n' : '') + tpl.replace('/*__MODEL__*/', model);
fs.writeFileSync(out, html);
console.log('written', out, fs.statSync(out).size, 'bytes');
