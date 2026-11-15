// ---- Save data ------------------------------------------------------------------------------
function defaultOptions() {
  return {
    lang: 'el', sound: true, textSpeed: 1, reduceMotion: false,
    largeText: 0, typeMarks: true, flashesOff: false, holdRepeat: HOLD_REPEAT_DEFAULT, touchHand: 0, // the accessibility options (MZ-A11Y-01)
  };
}
// A whole number from 0 to count - 1, else the fallback (an old save has none of the accessibility options: they load at their defaults).
function optionLevel(value, count, fallback) { return Number.isInteger(value) && value >= 0 && value < count ? value : fallback; }
function normalizeOptions(raw) {
  const base = defaultOptions();
  if (!raw || typeof raw !== 'object') return base;
  if (raw.lang === 'en' || raw.lang === 'el') base.lang = raw.lang;
  if (typeof raw.sound === 'boolean') base.sound = raw.sound;
  if (raw.textSpeed === 0 || raw.textSpeed === 1 || raw.textSpeed === 2) base.textSpeed = raw.textSpeed;
  if (typeof raw.reduceMotion === 'boolean') base.reduceMotion = raw.reduceMotion;
  base.largeText = optionLevel(raw.largeText, LARGE_TEXT_FACTORS.length, base.largeText);
  if (typeof raw.typeMarks === 'boolean') base.typeMarks = raw.typeMarks;
  if (typeof raw.flashesOff === 'boolean') base.flashesOff = raw.flashesOff;
  base.holdRepeat = optionLevel(raw.holdRepeat, HOLD_REPEAT_LEVELS.length, base.holdRepeat);
  base.touchHand = optionLevel(raw.touchHand, TOUCH_HANDS, base.touchHand);
  return base;
}

