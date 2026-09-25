/**
 * examples/reserse-obrana.js — situace z rešerše docs/reserse-obrana.md
 * (hra za brankou, krytí slabé strany, start presu).
 *
 * Nejde o přepis konkrétního obrázku, ale o nakreslení principů, na kterých
 * se zdroje shodují (IFF Team Tactics, playbook Västerås IBK, brankářská
 * metodika Kubíčková & Kysel, finský model podle Lamu 2019). Pozice jsou
 * návrh k úpravě trenérem.
 *
 * Značení našich hráčů v obranném pásmu:
 *   4, 5 = beci (4 dolní tyčka, 5 horní tyčka), 3 = střed / hráč ve slotu,
 *   1, 2 = křídla (1 nahoře, 2 dole). Vlastní branka vlevo, branka je
 *   v x 2,85–3,5 m, y 9,2–10,8 m; „za brankou“ = x < 2,85.
 * Soupeř: 1 = hráč s míčkem, 2 = hráč ve slotu, 3 = horní křídlo,
 *   4 = dolní křídlo, 5 = point.
 */
(function (global) {
  'use strict';

  const G = global.FB.examples;

  // Základní rozestavení soupeře v útočném pásmu (útočí na naši branku vlevo)
  const AWAY_BASE = { 2: [7, 10], 3: [11, 3.5], 4: [11, 16.5], 5: [18, 10] };
  function away(ballCarrier, overrides) {
    return Object.assign({}, AWAY_BASE, { 1: ballCarrier }, overrides || {});
  }

  G.register('Rešerše: obrana (hra za brankou, kros, pres)', [
    {
      id: 'za_brankou_od_tycky',
      name: 'Za brankou – bek vystupuje od tyčky (nechodí kolem branky)',
      source: 'IFF Team Tactics; Västerås IBK Spelbok; Kubíčková & Kysel 2012',
      phases: [
        {
          name: 'Míček v rohu',
          duration: 1800,
          note: 'Soupeř 1 má míček v dolním rohu. Bek 4 vystupuje od tyčky mezi něj a branku, 5 na horní tyčce, 3 drží slot',
          home: { 4: [4.4, 14], 5: [4.5, 8.4], 3: [7.6, 10.2], 1: [12, 5], 2: [12, 15], G: [4.1, 10.4] },
          away: away([3.4, 16.6]),
          ball: [3.1, 17.2],
        },
        {
          name: 'Za branku',
          duration: 1800,
          note: 'Soupeř jde za branku. Bek 4 zůstává na bližší tyčce, brankář nohama zavírá přihrávku před branku, křídla klesají',
          home: { 4: [4.3, 12], 5: [4.5, 8.4], 3: [7.2, 10.2], 1: [10, 6], 2: [10, 14], G: [3.9, 10.6] },
          away: away([1.7, 12.2]),
          ball: [1.4, 12.2],
        },
        {
          name: 'Přeběh',
          duration: 1800,
          note: 'Soupeř přebíhá za brankou nahoru. Bek 5 vystupuje od horní tyčky, 4 zůstává na vzdálenější tyčce proti zadní přihrávce, brankář mění tyčku',
          home: { 4: [4.3, 11.5], 5: [3.9, 7.7], 3: [6.9, 10.4], 1: [9.5, 6], 2: [10, 13.5], G: [3.9, 9.4] },
          away: away([1.7, 8]),
          ball: [1.4, 7.8],
        },
        {
          name: 'Vytlačení',
          duration: 2000,
          note: 'Bek 5 tlačí soupeře do strany a nahoru, ne kolem branky. Křídlo 1 zavírá cestu po mantinelu, slot zůstává obsazený',
          home: { 4: [4.4, 11.3], 5: [5.4, 5.2], 3: [7, 10.4], 1: [8.8, 4.2], 2: [10, 13.5], G: [4.1, 9.6] },
          away: away([4.4, 3.6]),
          ball: [4.7, 3.2],
        },
      ],
    },
    {
      id: 'za_brankou_zdvojeni_zisk',
      name: 'Za brankou – zdvojení křídlem (zisk míčku)',
      source: 'IFF Team Tactics (Dice‑5: zdvojení za brankou, střed kryje slot)',
      phases: [
        {
          name: 'Za brankou',
          duration: 1600,
          note: 'Soupeř 1 má míček za brankou dole. Bek 4 na bližší tyčce, 5 na vzdálenější, 3 ve slotu',
          home: { 4: [4.3, 12.2], 5: [4.5, 8.4], 3: [7.2, 10.2], 1: [10, 6], 2: [10, 14], G: [3.9, 10.6] },
          away: away([1.7, 12.5]),
          ball: [1.4, 12.6],
        },
        {
          name: 'Zdvojení',
          duration: 1800,
          note: 'Křídlo 2 přichází zvenku a zdvojuje. Bek 4 drží tyčku, 3 zůstává ve slotu s hráčem 2, křídlo 1 klesá',
          home: { 4: [4.1, 12.3], 5: [4.5, 8.6], 3: [7, 10.2], 1: [9, 7], 2: [2.6, 15.3], G: [3.9, 10.6] },
          away: away([1.6, 13.4]),
          ball: [1.4, 13.6],
        },
        {
          name: 'Zisk a výjezd',
          duration: 2000,
          note: 'Zdvojení míček získalo. Křídlo 2 vyjíždí po mantinelu, křídlo 1 startuje do protiútoku',
          home: { 4: [5, 12], 5: [5.5, 8.5], 3: [8.5, 10], 1: [17, 5], 2: [6.5, 17], G: [4.1, 10.2] },
          away: away([2.5, 14.5], { 4: [12, 15] }),
          ball: [7.2, 17.4],
        },
      ],
    },
    {
      id: 'za_brankou_zdvojeni_nevyjde',
      name: 'Za brankou – zdvojení nevyjde (přesilovka ve slotu)',
      source: 'IFF Team Tactics: „zdvojení musí skončit ziskem, jinak má soupeř ve slotu přesilovku“',
      phases: [
        {
          name: 'Za brankou',
          duration: 1600,
          note: 'Stejná situace: soupeř 1 za brankou dole, křídlo 2 se rozhoduje pro zdvojení',
          home: { 4: [4.3, 12.2], 5: [4.5, 8.4], 3: [7.2, 10.2], 1: [10, 6], 2: [10, 14], G: [3.9, 10.6] },
          away: away([1.7, 12.5]),
          ball: [1.4, 12.6],
        },
        {
          name: 'Zdvojení',
          duration: 1800,
          note: 'Křídlo 2 zdvojuje, ale soupeřovo dolní křídlo 4 mezitím nabíhá do uvolněného prostoru u slotu',
          home: { 4: [4.1, 12.3], 5: [4.5, 8.6], 3: [7, 10.2], 1: [9, 7], 2: [2.6, 15.3], G: [3.9, 10.6] },
          away: away([1.6, 13.4], { 4: [8.5, 14] }),
          ball: [1.4, 13.6],
        },
        {
          name: 'Přihrávka do slotu',
          duration: 2000,
          note: 'Soupeř přihraje na 4 před branku: ve slotu jsou 2 a 4 proti našemu 3, křídlo 2 je mimo hru. Proto zdvojovat jen s jistotou zisku',
          home: { 4: [4.4, 12.5], 5: [4.8, 9], 3: [7, 11.5], 1: [8.5, 8], 2: [3.5, 16], G: [4.0, 10.8] },
          away: away([2.2, 14], { 4: [8, 13.2], 2: [6.8, 9.5] }),
          ball: [7.7, 13.6],
        },
      ],
    },
    {
      id: 'predavani_beku_prebeh',
      name: 'Předávání beků při přeběhu před brankou (2 na 2)',
      source: 'Cvičení 2 na 2 (Suková 2021, ZČU); Kubíčková & Kysel 2012',
      phases: [
        {
          name: 'Výchozí',
          duration: 1600,
          note: 'Soupeř 1 s míčkem za brankou dole, 2 bez míčku v horní části slotu. Bek 4 na bližší tyčce, bek 5 kryje 2',
          home: { 4: [4.2, 12.6], 5: [5.3, 8.4], 3: [9, 10.5], 1: [12, 5], 2: [12, 15], G: [3.9, 10.6] },
          away: away([1.7, 13], { 2: [6.6, 8] }),
          ball: [1.4, 13.1],
        },
        {
          name: 'Přeběh',
          duration: 2000,
          note: 'Soupeř 1 přebíhá za brankou nahoru, 2 přebíhá před brankou dolů. Beci si předávají: 5 vystupuje od horní tyčky na 1, 4 přebírá 2',
          home: { 4: [5.3, 12], 5: [3.9, 8.1], 3: [8.5, 10.5], 1: [11, 5.5], 2: [11.5, 14.5], G: [3.9, 9.4] },
          away: away([1.7, 8.6], { 2: [6.6, 12] }),
          ball: [1.4, 8.4],
        },
        {
          name: 'Dohrání',
          duration: 1800,
          note: 'Bek 5 tlačí 1 do horního rohu, bek 4 drží 2 na těsno v ose branka–hráč, 3 zavírá střed, brankář na horní tyčce',
          home: { 4: [5.4, 11.8], 5: [5, 5.6], 3: [8, 10], 1: [9.5, 4.5], 2: [11.5, 14.5], G: [4.1, 9.5] },
          away: away([4, 4.2], { 2: [6.8, 12.2] }),
          ball: [4.3, 3.8],
        },
      ],
    },
    {
      id: 'kros_slaba_strana',
      name: 'Kros na slabou stranu a jeho krytí',
      source: 'Lamu 2019 (zodpovědnost za slabou stranu); KIHU 2018 (23 % gólů z první po krosu)',
      phases: [
        {
          name: 'Silná strana',
          duration: 1800,
          note: 'Míček u pointa 5 na horní straně. Křídlo 1 tlačí, bek 5 kryje 1 u branky, bek 4 má zodpovědnost za 2 na slabé straně, křídlo 2 stojí v přihrávkové dráze na 4',
          home: { 1: [13.5, 5.2], 2: [11.5, 12.5], 3: [7.8, 10.5], 4: [6.6, 13.8], 5: [5.6, 8.2], G: [4.1, 9.6] },
          away: { 5: [15, 4], 3: [9, 3], 1: [6, 9.4], 4: [10.5, 16.5], 2: [7, 14] },
          ball: [14.6, 3.6],
        },
        {
          name: 'Kros',
          duration: 1800,
          note: 'Kros na 4 na slabou stranu. Křídlo 2 přistupuje z dráhy rovnou k němu, bek 4 zůstává s 2 a zavírá přihrávku do slotu, 3 drží slot',
          home: { 1: [12, 8], 2: [9.6, 15.2], 3: [7.5, 11], 4: [6.8, 13.6], 5: [5.6, 8.8], G: [4.1, 10.4] },
          away: { 5: [15, 5], 3: [9, 3.5], 1: [6, 9.6], 4: [10.5, 16.5], 2: [7, 14] },
          ball: [10, 16.8],
        },
        {
          name: 'Blok',
          duration: 1600,
          note: 'Soupeř 4 střílí, křídlo 2 blokuje v dráze střely. Slot má stále dva naše hráče (3, 4) proti dvěma (1, 2)',
          home: { 1: [11, 9], 2: [9.3, 16.1], 3: [7.4, 11], 4: [6.8, 13.4], 5: [5.6, 9], G: [4.1, 10.6] },
          away: { 5: [15, 5], 3: [9, 3.5], 1: [6, 9.6], 4: [10.8, 16.4], 2: [7, 14] },
          ball: [9.6, 16.3],
        },
      ],
    },
    {
      id: 'pres_behem_rozehravky',
      name: 'Safety – start presu během rozehrávky (finský vzor)',
      source: 'Rzek 2021 (FIN presuje při rozehrávce 45 %, ČR po střele 36 %); playbook TKS: press v rohu',
      phases: [
        {
          name: 'Rozehrávka',
          duration: 1600,
          note: 'Soupeř rozehrává od dvou, míček u 5 dole. Naši v safety, hrot 2 vystupuje, hrot 1 zavírá střed',
          home: { 1: [24.4, 8.9], 2: [27.6, 15.2], 3: [18.9, 9.7], 4: [16.8, 15.6], 5: [11.2, 11.1] },
          away: { 5: [29.7, 18.4], 4: [28.4, 1.4], 2: [20.8, 9.7], 3: [17, 18.4], 1: [8.4, 9.7] },
          ball: [28.8, 18],
        },
        {
          name: 'Jdou všichni',
          duration: 1800,
          note: 'Soupeř se otáčí do mantinelu: hroti 1 a 2 presují, podhrot 4 zavírá mantinel vysoko, podhrot 3 zavírá střed vysoko, safety 5 poslední',
          home: { 1: [28, 12.5], 2: [29.3, 17], 3: [20.5, 10], 4: [22.5, 17.5], 5: [14, 12] },
          away: { 5: [30.5, 18.8], 4: [28.4, 1.4], 2: [21, 9.7], 3: [17.5, 18.4], 1: [8.4, 9.7] },
          ball: [30.2, 19.2],
        },
        {
          name: 'Zisk u mantinelu',
          duration: 2000,
          note: 'Vynucená přihrávka po mantinelu, podhrot 4 ji sbírá. Hrot 1 okamžitě startuje do branky',
          home: { 1: [31, 8.5], 2: [28.5, 16.5], 3: [21.5, 11], 4: [23, 17.6], 5: [15, 11.5] },
          away: { 5: [30.5, 18.8], 4: [28.4, 1.4], 2: [21, 9.7], 3: [18.5, 18.2], 1: [8.4, 9.7] },
          ball: [23.6, 17.9],
        },
      ],
    },
  ]);
})(window);
