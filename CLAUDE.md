# Floorball Tactic Board — projektový kontext

## Cíl projektu

Webová appka (funguje v prohlížeči, žádná instalace) pro kreslení a animaci florbalových
taktik. Inspirace existujícími nástroji (Floorball Tactic Board na Google Play, CourtDraw,
tactical-board.com), ale **nejde o kopii** — nekopírovat branding, přesný vzhled ani texty
těchto appek. Jde o funkčně obdobný, vlastní nástroj.

Cílová skupina: florbalový trenér/hráč kreslící taktiky, primárně pro interní použití.

## Klíčová funkce (must-have pro první verzi)

- Hřiště pro florbal jako podklad plátna
- Nástroje: čára, šipka, přerušovaná šipka, kruh/hráč s číslem, text, zóna/oblast, volné pero
- **Fáze (keyframes):** uživatel vytvoří "fázi 1" (výchozí rozestavění), přesune objekty,
  uloží jako "fázi 2" atd. Objekty mají napříč fázemi stejné `id`.
- **Přehrávání s interpolací:** mezi fází N a N+1 se plynule interpoluje pozice/rotace
  objektů se stejným ID (lineárně, případně jemný ease-in/out). Objekty bez páru v další
  fázi = fade in/out nebo okamžitý vznik/zánik.
- **Export do videa** (libovolný formát — nejsnazší cesta je `canvas.captureStream()` +
  `MediaRecorder` → webm nativně v prohlížeči, případně dořešit konverzi na mp4 později).

## Reference (pouze inspirace, ne kopírovat)

- https://play.google.com/store/apps/details?id=com.jenda.floorballboard — Android app,
  koncept fází a animací
- https://courtdraw.app/courtdraw-app?court=floorball — "Phase Animation" = přesně náš
  koncept keyframes; má i zakřivené šipky (nice-to-have, ne priorita)
- https://tactical-board.com/uk/floorball — odděluje "Create scheme" (statický obrázek)
  od "Create animation" (dynamická sekvence s exportem videa) — inspirace pro rozdělení UX

## Technologické rozhodnutí

- **Vanilla JS + Canvas API**, žádný frontend framework (React apod.) — pro tento typ
  appky framework přidává zbytečnou vrstvu
- **Bez build systému zpočátku** — čisté HTML/CSS/JS, spustitelné přímo v prohlížeči nebo
  servírované ze statického serveru (sedí to k firemnímu internímu portálu)

## Struktura složek (návrh, může se upřesnit)

```
floorball-board/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js              # inicializace, propojení modulů
│   ├── canvas-renderer.js   # vykreslování hřiště + objektů na canvas (neví nic o fázích)
│   ├── scene.js             # datový model: objekty, jejich vlastnosti
│   ├── phases.js            # správa fází/snímků, interpolace mezi nimi
│   ├── tools.js             # nástroje: šipka, čára, kruh, text, hráč...
│   ├── player.js             # logika přehrávání animace (časování, easing)
│   ├── export-video.js      # MediaRecorder / captureStream export
│   ├── storage.js           # ukládání/načítání taktik
│   └── ui.js                # ovládací panel, tlačítka, interakce mimo canvas
└── assets/
    └── court-floorball.svg  # podklad hřiště
```

## Datový model (klíčová část)

```
Scene
 ├─ court: "floorball"
 ├─ phases: [
 │    {
 │      id, duration (ms do dalšího snímku),
 │      objects: [
 │        { id, type: "player"|"arrow"|"line"|"text"|"zone",
 │          x, y, rotation, color, label, ... (vlastnosti podle typu) }
 │      ]
 │    },
 │    { ... další fáze }
 │  ]
```

Objekt má napříč fázemi stejné `id` → přehrávač páruje objekty mezi fázemi a interpoluje
jejich stav v čase.

## Vrstvy odpovědnosti

1. `scene.js` — čistý datový model, žádná znalost o canvasu. Snadno testovatelný,
   ukládatelný a exportovatelný jako JSON.
2. `canvas-renderer.js` — jen "vykresli mi tenhle stav objektů". Nezná fáze ani časování.
3. `phases.js` + `player.js` — časová osa: v čase T spočítej interpolovaný stav mezi fází
   N a N+1, předej rendereru.
4. `export-video.js` — spustí přehrávání přes `player.js` a zároveň nahrává canvas přes
   `captureStream` — žádná duplicitní kreslicí logika.

## Sestava (roster) — druhá stránka appky

Samostatná stránka se seznamem hráčů týmu, propojená s hlavní deskou:

- **Údaje o hráči:** jméno, číslo dresu, pozice (brankář / obránce / útočník)
- **Propojení s deskou:**
  1. Kliknutím na hráče v sestavě ho umístím na hřiště — místo generického kolečka se
     objeví marker se jménem/číslem daného hráče
  2. Sestava zároveň slouží jako rychlý výběr, kdo je "na place" v dané fázi (tzn. lze
     z ní přímo sestavovat aktuální rozestavění pro fázi, ne jen jednotlivě přidávat hráče)

**Dopad na datový model:** objekty typu `"player"` ve `scene.js` by měly referenci na
hráče ze sestavy (např. `playerId`), ne jen libovolný text/label — takže sestava je
samostatný seznam (`roster: [{ id, name, number, position }]`) na úrovni `Scene`, ke
kterému se objekty na hřišti odkazují.

## Otevřené otázky (k doladění při vývoji)

- **Ukládání:** lokálně v prohlížeči (localStorage/IndexedDB), nebo malý backend na
  interním portálu pro sdílení taktik mezi kolegy?
- **Formát exportu videa:** webm (přímá podpora `MediaRecorder`) vs. mp4 (kompatibilnější,
  potřeba extra krok/knihovna)

## Preferovaný styl spolupráce

- Komunikace v češtině
- Flagovat nejistotu a komplexitu otevřeně, žádné tiché selhání ("hodně přibližně", ale
  jasně označené předpoklady)
