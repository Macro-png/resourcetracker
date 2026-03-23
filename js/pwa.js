// ─── PWA ──────────────────────────────────────────────────────────────────────
// Service worker registration, install-to-home-screen prompt, and
// JSON export / import. Isolated so it can be tested or replaced without
// touching any game logic.
//
// Also handles Aurora Builder (.dnd5e) XML import, converting it to the
// tracker's internal format on the fly.

import { STORAGE_KEY }                  from './state.js';
import { buildSpellSlotsFromCasterInfo } from './spellslots.js';

// ─── Aurora parser ────────────────────────────────────────────────────────────

function parseAuroraFile(xmlText) {
  const parser = new DOMParser();
  const xml    = parser.parseFromString(xmlText, 'text/xml');

  const parseError = xml.querySelector('parsererror');
  if (parseError) throw new Error('Could not parse XML: ' + parseError.textContent.slice(0, 80));

  const firstText = (parent, tag) => {
    if (!parent) return '';
    const els = parent.getElementsByTagName(tag);
    return els.length ? els[0].textContent.trim() : '';
  };
  const firstInt = (parent, tag, fallback = 0) =>
    parseInt(firstText(parent, tag), 10) || fallback;

  const displayProps = xml.getElementsByTagName('display-properties')[0] || null;
  const buildInput   = xml.getElementsByTagName('input')[0]             || null;

  const name  = firstText(displayProps, 'name') || firstText(buildInput, 'name') || 'Unknown';
  const level = firstInt(displayProps, 'level', 1);

  const abilitiesEl = xml.getElementsByTagName('abilities')[0] || null;
  const baseCon     = firstInt(abilitiesEl, 'constitution', 10);

  let asiConBonus = 0;
  Array.from(xml.getElementsByTagName('element')).forEach(el => {
    if (el.getAttribute('type') !== 'Ability Score Improvement') return;
    const reg = (el.getAttribute('registered') || '').toUpperCase();
    if (!reg.includes('CONSTITUTION')) return;
    const m = reg.match(/INCREASE_(\d+)/);
    asiConBonus += m ? parseInt(m[1], 10) : (reg.includes('ASI_CONSTITUTION') ? 1 : 0);
  });

  const con     = baseCon + asiConBonus;
  const conMod  = Math.floor((con - 10) / 2);

  const levelEls = Array.from(xml.getElementsByTagName('element'))
    .filter(el => el.getAttribute('type') === 'Level' && el.getAttribute('rndhp'));

  levelEls.sort((a, b) =>
    parseInt(a.getAttribute('name'), 10) - parseInt(b.getAttribute('name'), 10)
  );

  const CLASS_HIT_DIE = {
    BARBARIAN: 12,
    FIGHTER: 10, PALADIN: 10, RANGER: 10,
    BARD: 8, CLERIC: 8, DRUID: 8, MONK: 8, ROGUE: 8, WARLOCK: 8, ARTIFICER: 8,
    SORCERER: 6, WIZARD: 6,
  };

  const getDieSize = el => {
    const children = Array.from(el.getElementsByTagName('element'));
    for (const child of children) {
      const type = child.getAttribute('type') || '';
      if (type !== 'Class' && type !== 'Multiclass') continue;
      const reg = (child.getAttribute('registered') || '').toUpperCase();
      for (const [cls, die] of Object.entries(CLASS_HIT_DIE)) {
        if (reg.includes(cls)) return die;
      }
    }
    return null;
  };

  let maxHP     = 0;
  const hitDice = [];

  levelEls.forEach((el, idx) => {
    const startLevel  = parseInt(el.getAttribute('name'), 10) || 1;
    const nextStart   = levelEls[idx + 1]
      ? parseInt(levelEls[idx + 1].getAttribute('name'), 10)
      : null;
    const classLevels = nextStart
      ? nextStart - startLevel
      : level - startLevel + 1;

    const rolls = el.getAttribute('rndhp')
      .split(',')
      .map(v => parseInt(v.trim(), 10))
      .filter(n => !isNaN(n));

    if (startLevel === 1) {
      const dieMax = getDieSize(el);
      if (dieMax) rolls[0] = dieMax;
    }

    for (let i = 0; i < Math.min(classLevels, rolls.length); i++) {
      maxHP += rolls[i];
    }

    const dieSize = getDieSize(el);
    if (dieSize) {
      hitDice.push({
        id:      crypto.randomUUID(),
        dieType: `d${dieSize}`,
        total:   classLevels,
        spent:   0,
      });
    }
  });

  maxHP += conMod * level;
  if (maxHP < 1) maxHP = Math.max(1, 8 + conMod);

  const classLine    = firstText(displayProps, 'class') || '';
  const casterLevels = { full: 0, half: 0, pact: 0 };

  const FULL_CASTERS = ['Wizard', 'Cleric', 'Druid', 'Sorcerer', 'Bard'];
  const HALF_CASTERS = ['Paladin', 'Ranger', 'Artificer'];
  const PACT_CASTERS = ['Warlock'];

  const CLASS_RE = /([A-Za-z\s]+?)\s*\((\d+)\)/g;
  let m;
  while ((m = CLASS_RE.exec(classLine)) !== null) {
    const cls = m[1].trim();
    const lvl = parseInt(m[2], 10);
    if      (FULL_CASTERS.some(c => cls.includes(c))) casterLevels.full += lvl;
    else if (HALF_CASTERS.some(c => cls.includes(c))) casterLevels.half += lvl;
    else if (PACT_CASTERS.some(c => cls.includes(c))) casterLevels.pact += lvl;
  }

  const spellSlots = buildSpellSlotsFromCasterInfo(
    casterLevels.full,
    casterLevels.half,
    casterLevels.pact
  );

  const currencyEl = xml.getElementsByTagName('currency')[0] || null;
  const coins = {
    cp: firstInt(currencyEl, 'copper'),
    sp: firstInt(currencyEl, 'silver'),
    ep: firstInt(currencyEl, 'electrum'),
    gp: firstInt(currencyEl, 'gold'),
    pp: firstInt(currencyEl, 'platinum'),
  };

  return {
    id:             crypto.randomUUID(),
    name,
    maxHP,
    currentHP:      maxHP,
    tempHP:         0,
    maxHPReduction: 0,
    deathSaves:     { success: 0, failure: 0 },
    spellSlots,
    casterLevels,
    resources:      [],
    statuses:       [],
    exhaustion:     0,
    hitDice,
    coins,
    items:          [],
    components:     [],
  };
}

// ─── PWA install prompt ───────────────────────────────────────────────────────

export function initPWA() {
  let deferred;
  const installBtn = document.getElementById('pwa-install-btn');

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    installBtn.hidden = false;
    installBtn.removeAttribute('aria-hidden');
  });

  installBtn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    installBtn.hidden = true;
    installBtn.setAttribute('aria-hidden', 'true');
  });

  if ('serviceWorker' in navigator) {
    // Register from root so the service worker scope covers '/'
    // If registered from 'pwa/service-worker.js', the default scope would be
    // 'pwa/' and it would never intercept the top-level navigation request,
    // causing Safari to show "not connected to the internet" when offline.
    navigator.serviceWorker.register('/service-worker.js').catch(console.error);
  }
}

// ─── Export / Import ─────────────────────────────────────────────────────────

export function initExportImport() {

  // ── Export ──
  document.getElementById('export-btn').addEventListener('click', () => {
    try {
      const blob = new Blob(
        [localStorage.getItem(STORAGE_KEY) || '{}'],
        { type: 'application/json' }
      );
      const a = Object.assign(document.createElement('a'), {
        href:     URL.createObjectURL(blob),
        download: 'dnd-tracker-export.json',
      });
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      alert('Export failed: ' + err.message);
    }
  });

  // ── Trigger file picker ──
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });

  // ── Handle chosen file ──
  document.getElementById('import-file').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    if (!file) return;

    ev.target.value = '';

    try {
      let parsed;

      if (file.name.endsWith('.dnd5e')) {
        const text = await file.text();
        const char = parseAuroraFile(text);

        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (!Array.isArray(existing.characters)) existing.characters = [];

        const idx = existing.characters.findIndex(c => c.name === char.name);
        if (idx !== -1) existing.characters[idx] = char;
        else existing.characters.push(char);

        parsed = existing;

      } else {
        parsed = JSON.parse(await file.text());
        if (!Array.isArray(parsed.characters)) throw new Error('Invalid format');
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
      location.reload();

    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  });
}