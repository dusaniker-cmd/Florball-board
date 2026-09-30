/**
 * examples/reserse-napadani.js — obrana proti postupnému útoku (rozehrávce)
 * soupeře: napadání a střední blok. Podklady: docs/reserse-napadani-rozehravky.md
 * (IFF Team Tactics, Kysel a Carda na florbalovytrener.cz, Tilander, finská
 * federace, švédské klubové playbooky, Häkkänen 2024, Rzek 2021).
 *
 * Nejde o přepis obrázků, ale o nakreslení principů, na kterých se zdroje
 * shodují. Žádný zdroj neuvádí vzdálenosti v metrech, pozice jsou proto MOJE
 * odvození (přesnost cca 1 m) a jsou výchozí návrh k úpravě trenérem.
 *
 * Souřadnice: metry, naše branka vlevo (x = 0), soupeř útočí doleva.
 * Značení našich hráčů (od vlastní branky, jako v playbooku):
 *   safety (1-2-2):  1, 2 = hroti, 3, 4 = podhroti, 5 = safety
 *   hrot (2-2-1):    1 = hrot, 2, 3 = podhroti, 4, 5 = beci
 *   centr (2-1-2):   1, 2 = křídla (hroti), 3 = centr, 4, 5 = beci
 * Soupeř: 4, 5 = jeho beci (u jeho branky vpravo), 3 = centr nebo libero,
 *   1, 2 = křídla. „Goal zone“ u naší branky je No-Go Zone z playbooku.
 */
(function (global) {
  'use strict';

  const G = global.FB.examples;

  const SRC_IFF = 'IFF Team Tactics (napadání 1-2-2, 2-2-1, 2-1-2)';

  G.register('Rešerše: napadání a střední blok', [
    {
      id: 'napadani_od_dvou_safety',
      name: 'Napadání rozehrávky od dvou – safety (dva hroti)',
      source: SRC_IFF + '; Carda 2012 (2-2-1); Kysel 2012; Tilander 2012',
      phases: [
        {
          name: 'Brankář má míč',
          duration: 1600,
          note: 'Rozehrávka soupeře od dvou (dva beci a brankář). Hroti 1, 2 stojí na bocích beků, podhroti 3, 4 těsně za nimi, safety 5 řídí',
          home: { 1: [28, 7.6], 2: [28, 12.6], 3: [21.5, 6.5], 4: [21.5, 13.5], 5: [15, 10] },
          away: { 4: [31.6, 5.4], 5: [31.6, 14.6], 3: [22.6, 10], 2: [24.6, 2.2], 1: [24.6, 17.8] },
          ball: [35, 10.6],
        },
        {
          name: 'Přihrávka na horního beka',
          duration: 1800,
          note: 'Hrot 1 tlačí od středu a vede beka k mantinelu, hrot 2 stíní přihrávku na druhého beka, podhroti se posunou těsně za ně (propast mezi řadami je hlavní chyba)',
          home: { 1: [30.2, 7.4], 2: [30.8, 11.4], 3: [25.6, 6], 4: [24.5, 12], 5: [17.5, 10] },
          away: { 4: [31.6, 5.4], 5: [31.6, 14.6], 3: [22.6, 10], 2: [24.6, 2.2], 1: [24.6, 17.8] },
          ball: [30.9, 5.6],
        },
        {
          name: 'Po mantinelu – zdvojení',
          duration: 1800,
          note: 'Přihrávka po mantinelu: podhrot 3 hraje souboj, hrot 1 zdvojuje ze středu (ne shora), podhrot 4 zavírá střed, hrot 2 se vrací do středu',
          home: { 1: [27, 5.3], 2: [29.6, 10.2], 3: [25.2, 4.1], 4: [23.2, 12], 5: [17, 9.5] },
          away: { 4: [31, 5], 5: [31.6, 14.6], 3: [22.6, 10], 2: [25, 2.2], 1: [24.6, 17.8] },
          ball: [24.3, 2.9],
        },
        {
          name: 'Zisk a protiútok',
          duration: 1800,
          note: 'Zisk u mantinelu: hroti 1 a 2 startují za míčem do protiútoku, podhrot 4 a safety 5 se posouvají za nimi',
          home: { 1: [30, 7.2], 2: [31, 11], 3: [25.6, 4.4], 4: [24.2, 11.5], 5: [19.5, 9] },
          away: { 4: [30, 5], 5: [31, 14], 3: [22.4, 9.4], 2: [24.6, 1.8], 1: [24.2, 17.6] },
          ball: [26.3, 4.1],
        },
      ],
    },
    {
      id: 'napadani_od_tri_hrot',
      name: 'Napadání rozehrávky od tří – hrot a domeček',
      source: SRC_IFF + ' (nízký trojúhelník = jeden hrot); Kysel 2012 (1-2-2); finská federace (Jurvelin)',
      phases: [
        {
          name: 'Libero má míč',
          duration: 1600,
          note: 'Soupeř rozehrává od tří (libero a dva beci). Jeden hrot 1 se staví mezi ně, podhroti 2, 3 a beci 4, 5 drží stejné mezery za ním',
          home: { 1: [28.4, 10], 2: [23.6, 6.6], 3: [23.6, 13.4], 4: [18, 6.4], 5: [18, 13.6] },
          away: { 3: [33.6, 10], 4: [30.6, 5.6], 5: [30.6, 14.4], 1: [22.6, 4], 2: [22.6, 16] },
          ball: [32.9, 10.4],
        },
        {
          name: 'Přihrávka na horního beka',
          duration: 1800,
          note: 'Hrot 1 tlačí od středu a vede beka k mantinelu, podhrot 2 jde těsně za něj, podhrot 3 zavírá střed. Bek 4 (silná strana) výš, bek 5 jistí jako libero',
          home: { 1: [29, 7.6], 2: [26, 5.6], 3: [25, 11.4], 4: [20.4, 5.8], 5: [17, 11.6] },
          away: { 3: [33.6, 10], 4: [30.6, 5.6], 5: [30.6, 14.4], 1: [22.6, 4], 2: [22.6, 16] },
          ball: [29.9, 5.8],
        },
        {
          name: 'Přehození na dolního beka',
          duration: 1800,
          note: 'Přehození: celá pětka se posune. Hrot 1 na nového nositele, podhrot 3 ho podporuje, podhrot 2 přebírá střed, bek 5 vystoupí a bek 4 jistí (druhá řada se nesmí zdržet)',
          home: { 1: [29, 12.4], 2: [25, 8.6], 3: [26, 14.4], 4: [17, 8.4], 5: [20.4, 14.2] },
          away: { 3: [33.6, 10], 4: [30.6, 5.6], 5: [30.6, 14.4], 1: [22.6, 4], 2: [22.6, 16] },
          ball: [29.9, 14.2],
        },
        {
          name: 'Po mantinelu – zdvojení',
          duration: 1800,
          note: 'Přihrávka po mantinelu: bek 5 zavírá zespodu, podhrot 3 přichází ze středu (ne shora), hrot 1 a podhrot 2 drží střed, bek 4 hlídá křídlo 1',
          home: { 1: [27, 11.4], 2: [23.4, 10.6], 3: [25.6, 15.6], 4: [19.4, 7.2], 5: [21.7, 16.3] },
          away: { 3: [33.6, 10], 4: [30.6, 5.6], 5: [30.6, 14.4], 1: [22.6, 4], 2: [23.4, 17.6] },
          ball: [22.8, 17.9],
        },
      ],
    },
    {
      id: 'chyba_napada_jen_hrot',
      name: 'Chyba: napadá jen hrot, druhá řada stojí',
      source: 'Tilander 2012; Carda 2012; IFF Team Tactics („top striker needs support“); Kotilainen 2014 (Pääkallo)',
      phases: [
        {
          name: 'Hrot vyběhne sám',
          duration: 1600,
          note: 'Hrot 1 tlačí beka, ale podhroti 2, 3 zůstali o osm metrů níž. Mezi řadami vzniká propast',
          home: { 1: [29.5, 7.8], 2: [21, 7], 3: [21, 13], 4: [12.5, 6.5], 5: [12.5, 13.5] },
          away: { 4: [31.5, 5.4], 5: [31.5, 14.6], 3: [24, 10], 1: [22, 3.6], 2: [22, 16.4] },
          ball: [30.8, 5.6],
        },
        {
          name: 'Přihrávka do mezery',
          duration: 1800,
          note: 'Přihrávka středem do mezery: příjemce 3 se otáčí čelem k naší brance, hrot je za ním a podhroti jsou daleko',
          home: { 1: [28.6, 8.4], 2: [21.6, 7.4], 3: [21.6, 12.6], 4: [12.6, 6.6], 5: [12.6, 13.4] },
          away: { 4: [31.5, 5.4], 5: [31.5, 14.6], 3: [26, 10.2], 1: [21, 4.2], 2: [21, 15.8] },
          ball: [25.3, 10.4],
        },
        {
          name: 'Přečíslení před brankou',
          duration: 2000,
          note: 'Důsledek: soupeř má míč mezi podhroty a beky, před naší brankou 3 na 2. Oprava: podhroti a hrot jdou ve stejný okamžik, propast jen pár metrů',
          home: { 1: [26.6, 8.6], 2: [21, 6.6], 3: [21, 12.4], 4: [13, 6.4], 5: [13, 13.6] },
          away: { 3: [23.6, 10.2], 4: [31.5, 5.4], 5: [31.5, 14.6], 1: [16.6, 5.4], 2: [17, 15.4] },
          ball: [16, 5.8],
        },
      ],
    },
    {
      id: 'prohrany_press_navrat',
      name: 'Prohraný press: zpomalit a vrátit se do nízkého bloku',
      source: SRC_IFF + ' (back checker, nefaulovat); Swiss Way (Defensiv-Transition); Västerås IBK Spelbok',
      phases: [
        {
          name: 'Press je nasazený',
          duration: 1600,
          note: 'Safety v napadání: hroti 1, 2 na bocích beků, podhroti 3, 4 za nimi, safety 5 jistí',
          home: { 1: [29, 7.6], 2: [28.8, 12.6], 3: [22.4, 6.8], 4: [22.4, 13.2], 5: [15.6, 10] },
          away: { 4: [31.6, 5.6], 5: [31.6, 14.6], 3: [23.6, 10], 2: [24.6, 2.4], 1: [24.6, 17.6] },
          ball: [30.9, 5.8],
        },
        {
          name: 'Přihrávka projde středem',
          duration: 1800,
          note: 'Přihrávka projde středem mezi hroty. Press je prohraný: hroti jsou za míčem, soupeř má před sebou podhroty',
          home: { 1: [30.2, 7.6], 2: [29.6, 12.4], 3: [22.6, 7], 4: [22.6, 13], 5: [15.8, 10] },
          away: { 4: [31.6, 5.6], 5: [31.6, 14.6], 3: [25.4, 10], 2: [24.2, 3], 1: [24.4, 17] },
          ball: [24.7, 10.2],
        },
        {
          name: 'Zpomalit a vrátit se',
          duration: 2000,
          note: 'Nejbližší hráč (4) zpomaluje a řídí míč do neškodné zóny, hroti 1 a 2 běží zpět jako back checkeři. Nefaulovat (volný úder by soupeři pomohl)',
          home: { 1: [26, 7.4], 2: [26, 12.6], 3: [20.6, 6.4], 4: [22.9, 10.6], 5: [15, 11.6] },
          away: { 4: [30.6, 5.6], 5: [31, 14.4], 3: [24.8, 10], 2: [21, 4], 1: [21, 16.4] },
          ball: [24.1, 10.2],
        },
        {
          name: 'Nízký blok 2-1-2',
          duration: 2200,
          note: 'Návrat: nejdřív střed a goal zone (No-Go Zone u naší branky), teprve potom souboje. Každý si drží svého hráče',
          home: { 1: [16, 6], 2: [16, 14], 3: [8.4, 6.6], 4: [8.4, 13.4], 5: [11, 10] },
          away: { 3: [19.6, 10.4], 2: [19, 3.8], 1: [19, 16.4], 4: [27, 6], 5: [28, 14] },
          ball: [18.9, 10.6],
        },
      ],
    },
    {
      id: 'stredni_blok_212_prehozeni',
      name: 'Střední blok 2-1-2: přehození a míč po mantinelu',
      source: SRC_IFF + ' (2-1-2, míč po mantinelu); Lamu 2019 (slabá strana); finská federace (puolikorkea 2-1-2)',
      phases: [
        {
          name: 'Míč u horního beka',
          duration: 1600,
          note: 'Střední blok 2-1-2 (zhruba 55 % hřiště): křídlo 1 je u nositele, křídlo 2 stíní druhého beka, centr 3 drží soupeřova centra, beci jistí goal zone',
          home: { 1: [26.4, 6.6], 2: [28.2, 11.2], 3: [19.8, 9.6], 4: [15, 6], 5: [14.6, 12.8] },
          away: { 4: [29.6, 5.8], 5: [29.6, 14.2], 3: [22.6, 10.4], 1: [18.6, 3.4], 2: [18.6, 16.6] },
          ball: [28.9, 6],
        },
        {
          name: 'Přehození na dolního beka',
          duration: 1800,
          note: 'Přehození: nové křídlo na straně míče (2) tlačí, druhé (1) zavírá druhého beka, bek 5 na straně míče vystoupí, slabý bek 4 jistí goal zone',
          home: { 1: [28.2, 8.6], 2: [26.6, 13.6], 3: [20.4, 10.8], 4: [12.2, 8.4], 5: [17.6, 13.6] },
          away: { 4: [29.6, 5.8], 5: [29.6, 14.2], 3: [22.6, 10.4], 1: [18.6, 3.4], 2: [18.6, 16.6] },
          ball: [28.9, 14.4],
        },
        {
          name: 'Míč po mantinelu',
          duration: 2000,
          note: 'Míč po mantinelu: křídlo 2 jde s míčem, bek 5 vystoupí k nositeli, centr 3 zavírá střed, slabé křídlo 1 běží k bráně a bek 4 jistí goal zone',
          home: { 1: [20.6, 8.8], 2: [23.6, 15.6], 3: [19, 11], 4: [12, 9], 5: [17.6, 15.6] },
          away: { 4: [28.4, 7.6], 5: [28.6, 14.4], 3: [22.6, 10.4], 1: [18.6, 3.4], 2: [19.4, 17] },
          ball: [18.8, 17.3],
        },
      ],
    },
    {
      id: 'styrspel_past_mantinel',
      name: 'Řízení soupeře na jednu stranu: past u mantinelu',
      source: 'Västerås IBK Spelbok (styrspel, druhá „rychlost“); Kysel 2012 (W); IFF Team Tactics (1-2-2 steering); playbook TKS str. 14',
      phases: [
        {
          name: 'Míč u horního beka',
          duration: 1600,
          note: 'Řízení (styrspel) do střední zóny u mantinelu: míč je u horního beka. Chceme, aby hrál napříč a potom po dolním mantinelu',
          home: { 1: [27.6, 7], 2: [26.2, 13.2], 3: [21.2, 10], 4: [15.6, 6.2], 5: [15.6, 13.8] },
          away: { 4: [30.6, 5.6], 5: [30.6, 14.6], 3: [23.8, 10], 2: [20.6, 2.6], 1: [20.6, 17.4] },
          ball: [29.9, 5.8],
        },
        {
          name: 'Zakrýt horní mantinel',
          duration: 1800,
          note: 'Křídlo 1 zakryje horní mantinel, soupeř může jen napříč. Křídlo 2 a centr 3 posilují dolní stranu (přečíslení na straně, kam míč vedeme)',
          home: { 1: [29.4, 3.6], 2: [27.8, 12.2], 3: [22.2, 12.8], 4: [17.8, 7], 5: [16.8, 14.6] },
          away: { 4: [30.6, 5.6], 5: [30.6, 14.6], 3: [23.8, 10], 2: [20.6, 2.6], 1: [20.6, 17.4] },
          ball: [29.9, 5.6],
        },
        {
          name: 'Vynucený kros',
          duration: 1800,
          note: 'Kros je vynucený: křídlo 1 se staví mezi beky, křídlo 2 tlačí nositele k dolnímu mantinelu, centr 3 a bek 5 posilují dolní stranu, bek 4 je libero',
          home: { 1: [29.6, 9.8], 2: [28.4, 13.2], 3: [24, 14.8], 4: [17, 9.6], 5: [19.6, 15.8] },
          away: { 4: [30.6, 5.6], 5: [30.6, 14.6], 3: [23.8, 10], 2: [20.6, 2.6], 1: [20.6, 17.4] },
          ball: [29.9, 14.8],
        },
        {
          name: 'Past u dolního mantinelu',
          duration: 2000,
          note: 'Ideální zóna pro zisk míče: střední pásmo u mantinelu (playbook, str. 14). Zdvojení: centr 3 zepředu, bek 5 zespodu, křídla 1, 2 drží střed',
          home: { 1: [27.6, 9.8], 2: [26.4, 11.6], 3: [25.6, 15.8], 4: [16.8, 10], 5: [21.6, 16.2] },
          away: { 4: [30.6, 5.6], 5: [30, 14.2], 3: [23.4, 10.2], 2: [20.6, 2.6], 1: [23.4, 17.6] },
          ball: [22.8, 17.9],
        },
      ],
    },
  ]);
})(window);
