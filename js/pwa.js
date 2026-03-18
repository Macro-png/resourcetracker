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

  // ── helpers ──
  // querySelector treats bare tag names like 'n' as namespace selectors in XML
  // mode — getElementsByTagName is reliable across all XML parsers.
  const firstText = (parent, tag) => {
    if (!parent) return '';
    const els = parent.getElementsByTagName(tag);
    return els.length ? els[0].textContent.trim() : '';
  };
  const firstInt = (parent, tag, fallback = 0) =>
    parseInt(firstText(parent, tag), 10) || fallback;

  // ── identity ──
  const displayProps = xml.getElementsByTagName('display-properties')[0] || null;
  const buildInput   = xml.getElementsByTagName('input')[0]             || null;

  const name  = firstText(displayProps, 'name') || firstText(buildInput, 'name') || 'Unknown';
  const level = firstInt(displayProps, 'level', 1);

  // ── ability scores ──
  const abilitiesEl = xml.getElementsByTagName('abilities')[0] || null;
  const con         = firstInt(abilitiesEl, 'constitution', 10);
  const conMod      = Math.floor((con - 10) / 2);

  // ── HP calculation ──
  // Aurora stores one <element type="Level" name="N" rndhp="..."> per class
  // entry. name="N" is the CHARACTER LEVEL at which that class starts.
  // The rndhp CSV holds up to 20 pre-rolled values; we consume only as many
  // as that class actually contributes to the character's current total level.
  //
  // Class levels contributed = (next class start level - this class start level)
  // For the last (or only) class: total level - this class start level + 1
  //
  // Example: Paladin(5)/Warlock(2), level 7
  //   Level element name="1" → Paladin starts at char-level 1, next class at 6
  //     → contributes 5 levels → take rolls[0..4]
  //   Level element name="6" → Warlock starts at char-level 6, no next class
  //     → contributes 7-6+1 = 2 levels → take rolls[0..1]

  const levelEls = Array.from(xml.getElementsByTagName('element'))
    .filter(el => el.getAttribute('type') === 'Level' && el.getAttribute('rndhp'));

  // Sort by the numeric "name" attribute (character level where class begins)
  levelEls.sort((a, b) =>
    parseInt(a.getAttribute('name'), 10) - parseInt(b.getAttribute('name'), 10)
  );

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

    for (let i = 0; i < Math.min(classLevels, rolls.length); i++) {
      maxHP += rolls[i];
    }

    // First roll is always the max die value for that class (level 1 = max roll)
    // e.g. 10 -> d10 (Paladin), 8 -> d8 (Warlock), 6 -> d6 (Sorcerer), 12 -> d12 (Barbarian)
    const dieSize = rolls[0];
    if ([6, 8, 10, 12].includes(dieSize)) {
      hitDice.push({
        id:      crypto.randomUUID(),
        dieType: `d${dieSize}`,
        total:   classLevels,
        spent:   0,
      });
    }
  });

  // Add CON modifier for every character level
  maxHP += conMod * level;
  if (maxHP < 1) maxHP = Math.max(1, 8 + conMod);

  // ── Detect caster levels from class display string ──
  // e.g. "Paladin (5) / Warlock (2)"
  const classLine   = firstText(displayProps, 'class') || '';
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

  // ── Spell slots ──
  const spellSlots = buildSpellSlotsFromCasterInfo(
    casterLevels.full,
    casterLevels.half,
    casterLevels.pact
  );

  // ── Currency ──
  const currencyEl = xml.getElementsByTagName('currency')[0] || null;
  const coins = {
    cp: firstInt(currencyEl, 'copper'),
    sp: firstInt(currencyEl, 'silver'),
    ep: firstInt(currencyEl, 'electrum'),
    gp: firstInt(currencyEl, 'gold'),
    pp: firstInt(currencyEl, 'platinum'),
  };

  // ── Assemble character object matching tracker's schema ──
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
    navigator.serviceWorker.register('pwa/service-worker.js').catch(() => {});
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

    // Reset so the same file can be re-imported if needed
    ev.target.value = '';

    try {
      let parsed;

      if (file.name.endsWith('.dnd5e')) {
        // ── Aurora Builder import ──
        const text = await file.text();
        const char = parseAuroraFile(text);

        // Merge into existing state so other characters are preserved
        const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        if (!Array.isArray(existing.characters)) existing.characters = [];

        // Replace if a character with the same name already exists, else append
        const idx = existing.characters.findIndex(c => c.name === char.name);
        if (idx !== -1) existing.characters[idx] = char;
        else existing.characters.push(char);

        parsed = existing;

      } else {
        // ── Standard tracker JSON import ──
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