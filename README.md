# Floorball Tactic Board

Webová aplikace pro kreslení a animaci florbalových taktik. Čisté HTML, CSS a JavaScript bez build systému: stačí otevřít `index.html` v prohlížeči nebo složku servírovat jako statický web.

## Co umí

- Hřiště 40 × 20 m, nástroje: hráč, míček, šipka, přerušovaná šipka, čára, zóna, text, pero
- Fáze (keyframes) a plynulé přehrávání s interpolací pozic i natočení hráčů
- Export videa do MP4 (H.264, vhodné pro WhatsApp) nebo WebM přímo v prohlížeči
- Sestava hráčů, umístění hráče ze sestavy kliknutím, rozestavení jedním klikem (safety, hrot, W, útoky, přesilovka, oslabení)
- Zrcadlení celé akce na druhou stranu hřiště, přepínače holí a směru hráčů
- Ukládání do prohlížeče, export a import JSON
- `sim/presilovka.html`: geometrický model přesilovky 5 na 3 (hodnota rozestavení, nejlepší obrana a útok)

## Spuštění

Dvojklikem na `index.html`, nebo ze složky projektu:

```bash
py -3 -m http.server 8765 --bind 127.0.0.1
```

a otevřít http://localhost:8765/.

## Struktura

- `js/scene.js` datový model, `js/canvas-renderer.js` vykreslování, `js/phases.js` interpolace, `js/player.js` přehrávání
- `js/tools.js` nástroje, `js/ui.js` ovládání, `js/roster.js` sestava, `js/formations.js` rozestavení, `js/examples/` ukázky
- `js/export-video.js` a `js/mp4-muxer.js` export videa, `js/storage.js` ukládání
- `sim/` model přesilovky (`node sim/run-powerplay.js`, `node sim/build-page.js`)
- `docs/` a `tactics/` klubové materiály (nejsou součástí veřejného repozitáře)
