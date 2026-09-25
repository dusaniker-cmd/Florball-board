/**
 * examples/playbook.js — ukázky přepsané z playbooku dorostu TKS 2024/25.
 * Pozice odečtené z obrázků (cca 1 m), pohyb mezi fázemi je interpretace textu.
 */
(function (global) {
  'use strict';

  // Soupeř v safety zrcadlově (hroti u naší půlky, safety u jejich branky)
  const AWAY_SAFETY = { 1: [15.5, 6], 2: [15.5, 14], 3: [23, 6], 4: [23, 14], 5: [29.5, 10] };

  global.FB.examples.register('Playbook TKS 2024/25', [
    {
      id: 'kyvadlo',
      name: 'Safety – kyvadlo hrotů',
      source: 'Playbook: Princip „kyvadla“, Základní postavení safety',
      phases: [
        {
          name: 'Míček nahoře',
          duration: 1800,
          note: 'Míček u soupeřova 4 nahoře: hrot 1 vystupuje, hrot 2 zavírá střed',
          home: { 1: [27, 4], 2: [22, 12], 3: [18, 7], 4: [17, 13], 5: [9, 10.5] },
          away: { 4: [31, 1.7], 2: [19.6, 1.7], 3: [20, 10], 5: [31, 18.3], 1: [10, 10] },
          ball: [30, 2.6],
        },
        {
          name: 'Přenesení dolů',
          duration: 1800,
          note: 'Přenesení hry na 5 dolů: hroti se přehoupnou, podhroti se posunou podle míčku',
          home: { 1: [22, 8], 2: [27, 16], 3: [17, 7], 4: [18, 13], 5: [9, 9.5] },
          away: { 4: [31, 1.7], 2: [19.6, 1.7], 3: [20, 10], 5: [31, 18.3], 1: [10, 10] },
          ball: [30, 17.4],
        },
        {
          name: 'Zpět nahoru',
          duration: 1800,
          note: 'Míček zpět nahoru: kyvadlo se vrací, střed zůstává zavřený',
          home: { 1: [27, 4], 2: [22, 12], 3: [18, 7], 4: [17, 13], 5: [9, 10.5] },
          away: { 4: [31, 1.7], 2: [19.6, 1.7], 3: [20, 10], 5: [31, 18.3], 1: [10, 10] },
          ball: [30, 2.6],
        },
      ],
    },
    {
      id: 'obrana_od_dvou',
      name: 'Safety – obrana proti rozehrávce od dvou',
      source: 'Playbook: Obrana proti rozehrávce soupeře – od dvou',
      phases: [
        {
          name: 'Rozehrávka',
          duration: 1800,
          note: 'Soupeř rozehrává od dvou, míček u 5 dole. Nutíme ho hrát po mantinelu',
          home: { 1: [24.4, 8.9], 2: [27.6, 15.2], 3: [18.9, 9.7], 4: [16.8, 15.6], 5: [11.2, 11.1] },
          away: { 5: [29.7, 18.4], 4: [28.4, 1.4], 2: [20.8, 9.7], 3: [17, 18.4], 1: [8.4, 9.7] },
          ball: [28.8, 18],
        },
        {
          name: 'Po mantinelu',
          duration: 1800,
          note: 'Přihrávka po mantinelu na 3: podhrot 4 hraje souboj, podhrot 3 zavírá střed',
          home: { 1: [22, 9], 2: [23.5, 15], 3: [17, 11], 4: [18, 17], 5: [10, 12.5] },
          away: { 5: [29.7, 18.4], 4: [28.4, 1.4], 2: [20.8, 9.7], 3: [17, 18.4], 1: [8.4, 9.7] },
          ball: [17.8, 18],
        },
        {
          name: 'Průnik k brance',
          duration: 1800,
          note: 'Přihrávka projde na 1: safety 5 jde do souboje, podhrot 3 se zatahuje na beka, hrot 1 níž',
          home: { 1: [16.5, 6.5], 2: [21, 14], 3: [10.5, 7.5], 4: [15, 15], 5: [7.5, 13.5] },
          away: { 5: [29.7, 18.4], 4: [28.4, 1.4], 2: [20.8, 9.7], 3: [17, 18.4], 1: [6, 15.5] },
          ball: [6.8, 15.2],
        },
      ],
    },
    {
      id: 'utok_od_tri_vbihani',
      name: 'Postupný útok od tří – vbíhání a rotace',
      source: 'Playbook: Postupný útok – od tří + jeden hrot (základní rotace, vbíhání)',
      phases: [
        {
          name: 'Výchozí',
          duration: 1800,
          note: 'Od tří + hrot: krajní hráč 3 má míček u mantinelu, soupeř v safety',
          home: { 1: [34, 10], 2: [22.5, 10], 3: [13.5, 1.5], 4: [9, 10], 5: [13, 18.5] },
          away: AWAY_SAFETY,
          ball: [14.3, 2],
        },
        {
          name: 'Rozběh',
          duration: 2000,
          note: '3 se s míčkem rozbíhá od mantinelu mezi hroty soupeře, poslední (4) ho kříží nahoru, 2 odskakuje do kapsy na stranu, odkud se 3 rozeběhl',
          home: { 1: [34, 10], 2: [21, 3], 3: [16.5, 8.5], 4: [11.5, 4.5], 5: [13, 18.5] },
          away: AWAY_SAFETY,
          ball: [17.2, 8.8],
        },
        {
          name: 'Shození',
          duration: 1800,
          note: '3 shazuje míček pod sebe zpět k naší brance na 4 (druhá možnost je 2 v kapse) a pokračuje do pohybu dopředu',
          home: { 1: [34, 10], 2: [21, 3], 3: [20, 8], 4: [11.5, 4.8], 5: [13, 18.5] },
          away: AWAY_SAFETY,
          ball: [12.3, 5.1],
        },
      ],
    },
    {
      id: 'rotace_131',
      name: 'Útočné pásmo 1‑3‑1 – základní rotace',
      source: 'Playbook: Hra v útočném pásmu – základní schéma 1‑3‑1, Základní rotace',
      phases: [
        {
          name: '1‑3‑1',
          duration: 1800,
          note: 'Základní 1‑3‑1: krajní hráč 2 má míček',
          home: { 1: [34.6, 10], 2: [29, 2.5], 3: [29, 10], 4: [29, 16.5], 5: [22, 10] },
          ball: [29.8, 2.8],
        },
        {
          name: 'Shození do rohu',
          duration: 1800,
          note: '2 shazuje míček do rohu a jde k brance, 1 si z brankoviště sbíhá pro míček',
          home: { 1: [36.5, 3.5], 2: [33, 6.5], 3: [29, 10], 4: [29, 16.5], 5: [22, 10] },
          ball: [37.3, 2.5],
        },
        {
          name: 'Rozjetí',
          duration: 2000,
          note: '1 jde do pohybu po mantinelu, 2 na rohu malého, 3 za osu, 4 hledá kros, 5 na mantinel',
          home: { 1: [35, 5], 2: [33.5, 8.3], 3: [27.5, 12.5], 4: [31, 15.5], 5: [22.5, 5] },
          ball: [35.6, 5.4],
        },
      ],
    },
  ]);
})(window);
