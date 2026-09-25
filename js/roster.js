/**
 * roster.js — sestava týmu.
 *
 * Dvě části UI nad jedním seznamem `scene.roster`:
 *   1. stránka Sestava: editace hráčů (jméno, číslo, pozice), přidání, smazání
 *   2. panel vedle desky: kdo je na hřišti v aktuální fázi (zaškrtávátko)
 *      a umístění hráče kliknutím (klik na jméno → klik na hřiště)
 *
 * Model neřeší; všechny změny jdou přes `app` (main.js).
 */
(function (global) {
  'use strict';

  const FB = global.FB || (global.FB = {});
  const S = FB.scene;

  const POSITION_LABELS = { goalie: 'Brankář', defender: 'Obránce', forward: 'Útočník' };
  const POSITION_SHORT = { goalie: 'B', defender: 'O', forward: 'Ú' };
  const POSITION_ORDER = { goalie: 0, defender: 1, forward: 2 };

  /** Výchozí místa při zaškrtnutí "na hřišti" — domácí polovina, zleva. */
  const GOALIE_SPOTS = [{ x: 4.2, y: 10 }];
  const FIELD_SPOTS = [
    { x: 10, y: 7 }, { x: 10, y: 13 }, { x: 15, y: 4 }, { x: 15, y: 16 }, { x: 16, y: 10 },
    { x: 8, y: 10 }, { x: 12, y: 3 }, { x: 12, y: 17 }, { x: 18, y: 7 }, { x: 18, y: 13 },
    { x: 6, y: 5 }, { x: 6, y: 15 },
  ];

  function sortedRoster(roster) {
    return roster.slice().sort(function (a, b) {
      const po = (POSITION_ORDER[a.position] || 0) - (POSITION_ORDER[b.position] || 0);
      if (po) return po;
      const na = a.number == null || a.number === '' ? 999 : Number(a.number);
      const nb = b.number == null || b.number === '' ? 999 : Number(b.number);
      if (na !== nb) return na - nb;
      return String(a.name).localeCompare(String(b.name), 'cs');
    });
  }

  /** Volné místo na hřišti pro nového hráče dané pozice. */
  function findFreeSpot(objects, position) {
    const candidates = (position === S.POSITIONS.GOALIE ? GOALIE_SPOTS : []).concat(FIELD_SPOTS);
    for (const c of candidates) {
      const taken = objects.some(function (o) {
        return o.type === S.OBJECT_TYPES.PLAYER && Math.hypot(o.x - c.x, o.y - c.y) < 1.8;
      });
      if (!taken) return { x: c.x, y: c.y };
    }
    return { x: 6 + Math.random() * 12, y: 3 + Math.random() * 14 };
  }

  function init(app) {
    const doc = global.document;
    const el = {
      panelList: doc.getElementById('roster-panel-list'),
      panelEmpty: doc.getElementById('roster-panel-empty'),
      tableBody: doc.getElementById('roster-table-body'),
      addForm: doc.getElementById('roster-add-form'),
      addNumber: doc.getElementById('roster-add-number'),
      addName: doc.getElementById('roster-add-name'),
      addPosition: doc.getElementById('roster-add-position'),
      count: doc.getElementById('roster-count'),
    };

    // --- přidání hráče ------------------------------------------------------

    el.addForm.addEventListener('submit', function (ev) {
      ev.preventDefault();
      const name = el.addName.value.trim();
      const numberRaw = el.addNumber.value.trim();
      if (!name && !numberRaw) return;
      app.addRosterPlayer({
        name: name,
        number: numberRaw === '' ? null : Number(numberRaw),
        position: el.addPosition.value,
      });
      el.addName.value = '';
      el.addNumber.value = '';
      el.addNumber.focus();
    });

    // --- stránka Sestava (tabulka) ------------------------------------------

    function positionSelect(value) {
      const sel = doc.createElement('select');
      Object.keys(POSITION_LABELS).forEach(function (key) {
        const opt = doc.createElement('option');
        opt.value = key;
        opt.textContent = POSITION_LABELS[key];
        sel.appendChild(opt);
      });
      sel.value = value;
      return sel;
    }

    function renderPage() {
      const roster = sortedRoster(app.scene.roster);
      el.tableBody.innerHTML = '';
      el.count.textContent = roster.length
        ? roster.length + ' hráčů'
        : 'Sestava je prázdná. Přidejte hráče níže.';

      roster.forEach(function (player) {
        const tr = doc.createElement('tr');

        const tdNum = doc.createElement('td');
        const num = doc.createElement('input');
        num.type = 'number';
        num.min = '0';
        num.max = '99';
        num.value = player.number == null ? '' : player.number;
        num.className = 'roster-num';
        num.addEventListener('change', function () {
          app.updateRosterPlayer(player.id, { number: num.value === '' ? null : Number(num.value) });
        });
        tdNum.appendChild(num);

        const tdName = doc.createElement('td');
        const name = doc.createElement('input');
        name.type = 'text';
        name.value = player.name;
        name.placeholder = 'Jméno';
        name.addEventListener('change', function () {
          app.updateRosterPlayer(player.id, { name: name.value.trim() });
        });
        tdName.appendChild(name);

        const tdPos = doc.createElement('td');
        const pos = positionSelect(player.position);
        pos.addEventListener('change', function () {
          app.updateRosterPlayer(player.id, { position: pos.value });
        });
        tdPos.appendChild(pos);

        const tdDel = doc.createElement('td');
        const del = doc.createElement('button');
        del.type = 'button';
        del.className = 'roster-del';
        del.title = 'Odebrat ze sestavy';
        del.textContent = '×';
        del.addEventListener('click', function () { app.removeRosterPlayer(player.id); });
        tdDel.appendChild(del);

        tr.appendChild(tdNum);
        tr.appendChild(tdName);
        tr.appendChild(tdPos);
        tr.appendChild(tdDel);
        el.tableBody.appendChild(tr);
      });
    }

    // --- panel vedle desky --------------------------------------------------

    function renderPanel() {
      const roster = sortedRoster(app.scene.roster);
      const phase = app.currentPhase();
      const locked = app.isPlaying() || !!app.state.busy;
      el.panelList.innerHTML = '';
      el.panelEmpty.hidden = roster.length > 0;

      roster.forEach(function (player) {
        const onCourt = phase ? S.findPlayerObject(phase, player.id) : null;
        const row = doc.createElement('div');
        row.className = 'roster-row'
          + (onCourt ? ' is-on-court' : '')
          + (onCourt && app.state.selectedIds.indexOf(onCourt.id) !== -1 ? ' is-selected' : '')
          + (app.state.pendingPlayerId === player.id ? ' is-pending' : '');

        const cb = doc.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !!onCourt;
        cb.disabled = locked;
        cb.title = onCourt ? 'Odebrat z hřiště v této fázi' : 'Postavit na hřiště v této fázi';
        cb.addEventListener('change', function () { app.setOnCourt(player.id, cb.checked); });

        const num = doc.createElement('span');
        num.className = 'roster-row-num';
        num.textContent = player.number == null ? '–' : player.number;

        const name = doc.createElement('span');
        name.className = 'roster-row-name';
        name.textContent = player.name || '(bez jména)';
        name.title = onCourt
          ? 'Vybrat hráče na hřišti'
          : 'Umístit: klikněte sem a pak na hřiště';

        const pos = doc.createElement('span');
        pos.className = 'roster-row-pos pos-' + player.position;
        pos.textContent = POSITION_SHORT[player.position] || '?';
        pos.title = POSITION_LABELS[player.position] || '';

        if (!locked) {
          name.addEventListener('click', function () {
            if (onCourt) app.selectObject(onCourt.id);
            else app.placeRosterPlayer(player.id);
          });
        }

        row.appendChild(cb);
        row.appendChild(num);
        row.appendChild(name);
        row.appendChild(pos);
        el.panelList.appendChild(row);
      });
    }

    function update() {
      renderPanel();
      renderPage();
    }

    return {
      update: update,
      findFreeSpot: findFreeSpot,
      POSITION_LABELS: POSITION_LABELS,
    };
  }

  FB.roster = { init: init, findFreeSpot: findFreeSpot, sortedRoster: sortedRoster };
})(window);
