// ---- In-page checks of the accessibility options (MZ-A11Y-01) ------------------------------------------------------------------------
// Run by selfTest() in the window it is in: the review runs it at 390x844, 844x390 and 1280x720. Nothing here is sized for one window: every
// number comes from the window, the layout and the screens themselves. The checks change OPT and the layout; selfTest puts both back.
const A11Y_BUTTONS = ['up', 'down', 'left', 'right', 'a', 'b', 'menu', 'map'];
function a11yFreshGame() {
  G = newGameState('ΝΙΚΟΣ', 'm', 'komma');
  G.rng = makeRng(99);
  G.party.push(makeMon('fakelakis', 5), makeMon('psaltak', 6));
  for (let i = 0; i < 12; i++) G.archive.push(makeMon(i % 2 === 0 ? 'koulourak' : 'fakelakis', 3 + i));
  for (const id of ITEM_IDS.slice(0, 4)) G.bag[id] = 3;
  for (const id of DEX_ORDER.slice(0, 10)) G.dex.seen[id] = true;
  G.money = 1234;
  Fade.alpha = 0; Fade.frames = 0;
}
function a11yBattle(mode) {
  const battle = createBattle(G.party, [makeMon('fakelakis', 3)], G.rng, { kind: 'wild', trainerId: undefined, foeItems: [], foeName: '', bag: G.bag, archive: G.archive, sunday: false, recruitable: false, recruitOnly: null });
  const layer = new BattleLayer(battle, null, 'grass');
  for (const side of [0, 1]) {
    const view = layer.views[side];
    const mon = activeMon(battle, side);
    view.sp = mon.sp; view.name = speciesName(mon.sp); view.max = maxHp(mon); view.shown = mon.hp; view.target = mon.hp; view.lastShown = view.max; view.hpText = mon.hp + '/' + view.max;
    view.lvText = T('ui.lv') + mon.lv; view.visible = true;
  }
  layer.menuResolve = function () {};
  if (mode === 'root') { layer.rootPrompt = wrapText(T('battle.prompt', { name: speciesName(activeMon(battle, 0).sp) }), TICKER.textW); layer.mode = 'root'; }
  else if (mode === 'moves') { layer.moveCursor = 0; layer.refreshMoveInfo(); layer.mode = 'moves'; }
  else if (mode === 'text') { layer.box.setText(T('b.run.trainer')); layer.box.typed = layer.box.total; layer.mode = 'text'; }
  return layer;
}
// Every screen of the game, as a function that makes one in a state where it has something to say. [name, make, bounds]: bounds is 'all' to check all its text.
function a11yScreens() {
  return [
    ['dialog', function () { const layer = new DialogLayer(T('intro.4', { name: 'ΝΙΚΟΣ' })); layer.box.typed = layer.box.total; return layer; }],
    ['choice', function () { return new ChoiceLayer([T('ui.yes'), T('ui.no')], { title: T('ui.money', { n: 5 }) }); }],
    ['overworld', function () { const layer = new OverworldLayer(); const play = Sound.play; Sound.play = function () {}; try { layer.onEnter(); } finally { Sound.play = play; } layer.popup = 60; return layer; }], // the place name shows for a second after a map is entered
    ['ticket', function () { return new TicketLayer(); }],
    ['monitor', function () { return new MonitorLayer(); }],
    ['badge', function () { return new BadgeLayer(); }],
    ['chapter', function () { return new ChapterLayer(); }],
    ['credits', function () { const layer = new CreditsLayer(); layer.lines = T('credits.text').split('\n'); layer.frame = 400; return layer; }],
    ['notice', function () { const layer = new NoticeLayer(); layer.greek = wrapText(lookupString('notice.line1', 'el'), 200); layer.english = wrapText(lookupString('notice.line2', 'en'), 200); layer.frame = 40; return layer; }],
    ['title', function () { return new TitleLayer(); }],
    ['gender', function () { return new GenderLayer(); }],
    ['name', function () { return new NameLayer('ΝΙΚΟΣ'); }],
    ['starter', function () { return new StarterLayer(); }],
    ['map', function () { return new MapLayer(); }],
    ['party', function () { return new PartyLayer({ mode: 'view' }); }],
    ['archive', function () { return new ArchiveLayer({ mode: 'view' }); }],
    ['summary', function () { return new SummaryLayer(0); }],
    ['bag', function () { const layer = new BagLayer({ battle: false }); layer.update(); return layer; }],
    ['dossier', function () { return new DossierLayer(); }],
    ['options', function () { return new OptionsLayer(); }],
    ['accessibility', function () { return new AccessibilityLayer(); }],
    ['shop', function () { const layer = new ShopLayer(); layer.update(); return layer; }],
    ['evolve', function () { const layer = new EvolveLayer(G.party[0], SPECIES[G.party[0].sp].evo.to); layer.frame = 40; return layer; }],
    ['battle: command tabs', function () { return a11yBattle('root'); }],
    ['battle: moves', function () { return a11yBattle('moves'); }],
    ['battle: ticker text', function () { return a11yBattle('text'); }],
  ];
}
function a11yShow(layer) {
  layers.length = 0;
  layers.push(layer);
  Fade.alpha = 0; Fade.frames = 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height); // a screen that does not cover the picture is drawn on black, not on the last frame
  renderFrame();
}
// The box of every text a screen draws, in logical pixels (the picture is 240 x 160), from the real glyph boxes of the browser.
function a11yTextBoxes(layer) {
  const found = [];
  ctx.fillText = function (text, x, y) {
    if (String(text).trim() !== '') {
      const metrics = ctx.measureText(text);
      const matrix = ctx.getTransform();
      const corners = [
        [x - metrics.actualBoundingBoxLeft, y - metrics.actualBoundingBoxAscent], [x + metrics.actualBoundingBoxRight, y - metrics.actualBoundingBoxAscent],
        [x - metrics.actualBoundingBoxLeft, y + metrics.actualBoundingBoxDescent], [x + metrics.actualBoundingBoxRight, y + metrics.actualBoundingBoxDescent],
      ];
      const box = { text: String(text), left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity };
      for (const corner of corners) {
        const px = (matrix.a * corner[0] + matrix.c * corner[1] + matrix.e) / viewScale;
        const py = (matrix.b * corner[0] + matrix.d * corner[1] + matrix.f) / viewScale;
        box.left = Math.min(box.left, px); box.right = Math.max(box.right, px); box.top = Math.min(box.top, py); box.bottom = Math.max(box.bottom, py);
      }
      found.push(box);
    }
    return CanvasRenderingContext2D.prototype.fillText.apply(ctx, arguments);
  };
  try { a11yShow(layer); } finally { delete ctx.fillText; }
  return found;
}
function a11ySignature(region) { // a number that changes when any pixel of the region (logical pixels: x, y, w, h; none = the whole picture) changes
  const r = region || [0, 0, SCREEN_W, SCREEN_H];
  const data = ctx.getImageData(Math.floor(r[0] * viewScale), Math.floor(r[1] * viewScale), Math.max(1, Math.floor(r[2] * viewScale)), Math.max(1, Math.floor(r[3] * viewScale))).data;
  let hash = 0;
  for (let i = 0; i < data.length; i++) hash = (Math.imul(hash, 31) + data[i]) | 0;
  return hash;
}
function a11yRect(element) { const box = element.getBoundingClientRect(); return { left: box.left, right: box.right, top: box.top, bottom: box.bottom }; }
function a11yInside(rect) { return rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= window.innerWidth + 0.5 && rect.bottom <= window.innerHeight + 0.5; }
function a11yOverlap(a, b) { return a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5; }
// Presses a button for frames frames on a screen (alone on the stack) and counts the cursor steps (the 'move' blips).
function a11yHold(layer, button, frames) {
  layers.length = 0;
  layers.push(layer);
  Input.clear();
  let steps = 0;
  const original = Sound.sfx;
  Sound.sfx = function (name) { if (name === 'move') steps++; };
  try {
    Input.keys[button] = true;
    for (let i = 0; i < frames; i++) stepGame();
    Input.keys[button] = false;
    stepGame();
  } finally { Sound.sfx = original; Input.clear(); }
  return steps;
}
async function accessibilityChecks(check) {
  const where = ' (' + window.innerWidth + 'x' + window.innerHeight + ')';
  const keepOptions = Object.assign({}, OPT);
  const keepTouch = touchForced;
  const screens = a11yScreens();
  try {
    OPT = Object.assign({}, defaultOptions(), { lang: 'el', reduceMotion: false });
    a11yFreshGame();
    resetTextCache();

    // 1. Large text: every screen says what is read; the bar is off when the option is off.
    for (const screen of screens) {
      const layer = screen[1]();
      layers.length = 0; layers.push(layer);
      OPT.largeText = 0; resizeScreen(); Caption.sync(true);
      const hiddenWhenOff = Caption.element.style.display === 'none' && Caption.element.textContent === '';
      OPT.largeText = 2; resizeScreen(); Caption.sync(true);
      const said = layer.caption ? captionString(layer.caption()) : null; // a screen with a question answers { context, text }: the bar shows both
      const shown = Caption.element.textContent;
      check('large text: ' + screen[0] + ' says what is read in the bar, and the bar is empty and hidden when the option is off' + where,
        hiddenWhenOff && typeof said === 'string' && said.length > 0 && shown === said && Caption.element.style.display === 'block', 'said "' + said + '" shown "' + shown + '" hidden when off ' + hiddenWhenOff);
    }
    // The bar follows the screen when the text changes (a menu row), and the language.
    OPT.largeText = 1; resizeScreen();
    const choice = new ChoiceLayer(['AAA', 'BBB', 'CCC'], {});
    layers.length = 0; layers.push(choice);
    Caption.sync(true);
    const first = Caption.element.textContent;
    choice.cursor = 2; Caption.sync(true);
    check('large text: the bar follows the chosen row', first === 'AAA' && Caption.element.textContent === 'CCC', first + ' -> ' + Caption.element.textContent);
    OPT.lang = 'en'; resetTextCache();
    const optionsScreen = new OptionsLayer();
    layers.length = 0; layers.push(optionsScreen);
    Caption.sync(true);
    const english = Caption.element.textContent;
    const englishLang = Caption.element.lang;
    OPT.lang = 'el'; resetTextCache(); Caption.sync(true);
    check('large text: the bar follows the language', english === 'Language: English' && Caption.element.textContent === 'Γλώσσα: Ελληνικά', english + ' / ' + Caption.element.textContent);
    check('large text: the bar names its language (lang is en, then el)', englishLang === 'en' && Caption.element.lang === 'el', englishLang + ' / ' + Caption.element.lang);
    // A question is said once: the first time the bar shows it, then the screen reader hears only the chosen row (the question stays visible, hidden from the reader).
    const asking = new ChoiceLayer(['AAA', 'BBB'], { title: 'Question?' });
    layers.length = 0; layers.push(asking);
    Caption.contextLayer = null; Caption.text = null;
    Caption.sync(true);
    const questionSpoken = Caption.element.querySelector('[aria-hidden]') === null;
    asking.cursor = 1; Caption.sync(true);
    const questionHidden = Caption.element.querySelector('[aria-hidden="true"]');
    check('large text: a question is said once, then only the chosen row is read', questionSpoken && questionHidden !== null && questionHidden.textContent === 'Question? ' && Caption.element.textContent === 'Question? BBB',
      'spoken first ' + questionSpoken + ', hidden after ' + (questionHidden ? '"' + questionHidden.textContent + '"' : 'no') + ', shows "' + Caption.element.textContent + '"');
    // The satire notice has a Greek and an English line: the bar gives each its own language.
    const noticeLayer = new NoticeLayer();
    layers.length = 0; layers.push(noticeLayer);
    Caption.sync(true);
    const noticeSpans = Caption.element.querySelectorAll('span');
    check('large text: the notice bar has two spans, one Greek and one English', noticeSpans.length === 2 && noticeSpans[0].lang === 'el' && noticeSpans[1].lang === 'en', noticeSpans.length + ' spans');
    // The credits are read one line at a time, each line once, in order.
    const roll = new CreditsLayer(); roll.lines = T('credits.text').split('\n');
    const heard = [];
    for (let frame = 0; frame <= creditsEndFrame(roll.lines.length); frame++) {
      roll.frame = frame;
      const line = roll.caption();
      if (line !== null && heard[heard.length - 1] !== line) heard.push(line);
    }
    const spoken = roll.lines.filter(function (line) { return line; });
    check('large text: the credits caption one line at a time, each line once, in order (' + heard.length + ' lines)', heard.length === spoken.length && heard.every(function (line) { return roll.lines.indexOf(line) >= 0; }) && new Set(heard).size === heard.length
      && heard.every(function (line, index) { return index === 0 || roll.lines.indexOf(line) > roll.lines.indexOf(heard[index - 1]); }), heard.slice(0, 3).join(' | ') + ' of ' + spoken.length);
    // The battle bar begins with who is fighting: name and level of both sides, the HP of the player's side.
    for (const mode of ['root', 'moves']) {
      const fight = a11yBattle(mode);
      const line = captionString(fight.caption());
      const mine = fight.views[0];
      const foe = fight.views[1];
      const expected = mine.name + ' ' + mine.lvText + ' ' + mine.hpText + '. ' + foe.name + ' ' + foe.lvText + '. ';
      check('large text: the battle bar (' + mode + ') starts with both names and levels and the HP of the player side', line.indexOf(expected) === 0, line);
    }

    // 2. No text leaves the picture (every screen, every text), and no text leaves the screen (the bar and the buttons) at the largest scale.
    OPT.largeText = 2; resizeScreen();
    for (const screen of screens) {
      const layer = screen[1]();
      const boxes = a11yTextBoxes(layer);
      let wanted = boxes;
      if (screen[0] === 'credits') wanted = boxes.filter(function (box) { return box.top >= 0 && box.bottom <= SCREEN_H; }); // the roll slides in and out on purpose
      const outside = wanted.filter(function (box) { return box.left < -0.5 || box.right > SCREEN_W + 0.5 || box.top < -0.5 || box.bottom > SCREEN_H + 0.5; });
      check('no text leaves the ' + SCREEN_W + 'x' + SCREEN_H + ' picture: ' + screen[0] + ' (' + wanted.length + ' texts)' + where, wanted.length > 0 && outside.length === 0,
        outside.slice(0, 3).map(function (box) { return '"' + box.text + '" ' + Math.round(box.left) + ',' + Math.round(box.top) + ' to ' + Math.round(box.right) + ',' + Math.round(box.bottom); }).join(' | '));
    }
    // Room with the real fonts of this browser, in both languages: the title screen line and the top row of the Accessibility screen keep TEXT_EDGE_MARGIN from the edges, and the
    // screen's title keeps it from the hint beside it.
    for (const language of ['el', 'en']) {
      OPT.lang = language; resetTextCache();
      const sub = a11yTextBoxes(new TitleLayer()).filter(function (box) { return box.text === T('title.sub'); })[0];
      check('room: the title line keeps ' + TEXT_EDGE_MARGIN + ' px from the edges (' + language + ')' + where, !!sub && sub.left >= TEXT_EDGE_MARGIN - 0.5 && sub.right <= SCREEN_W - TEXT_EDGE_MARGIN + 0.5, sub ? Math.round(sub.left) + ' to ' + Math.round(sub.right) : 'not drawn');
      const rowBoxes = a11yTextBoxes(new AccessibilityLayer());
      const heading = rowBoxes.filter(function (box) { return box.text === T('acc.title'); })[0];
      const hint = rowBoxes.filter(function (box) { return box.text === T('opt.hint'); })[0];
      check('room: the Accessibility title and hint keep ' + TEXT_EDGE_MARGIN + ' px from the edges and from each other (' + language + ')' + where,
        !!heading && !!hint && heading.left >= TEXT_EDGE_MARGIN - 0.5 && hint.right <= SCREEN_W - TEXT_EDGE_MARGIN + 0.5 && hint.left - heading.right >= TEXT_EDGE_MARGIN,
        heading && hint ? 'title ' + Math.round(heading.left) + ' to ' + Math.round(heading.right) + ', hint ' + Math.round(hint.left) + ' to ' + Math.round(hint.right) : 'not drawn');
    }
    OPT.lang = 'el'; resetTextCache();
    // The longest pages of any dialog or ticker text, in both languages, fit the bar at the largest scale and at the smallest bar letters.
    const pages = [];
    for (const key of Object.keys(STRINGS)) {
      for (const language of ['el', 'en']) {
        const text = lookupString(key, language);
        if (text.length < 80) continue;
        const lines = wrapText(text, DIALOG_BOX.w - 20);
        for (let i = 0; i < lines.length; i += 3) pages.push(lines.slice(i, i + 3).join(' '));
      }
    }
    pages.sort(function (a, b) { return b.length - a.length; });
    const longest = pages.slice(0, 12);
    for (const touch of [false, true]) {
      for (const hand of [0, 1, 2]) {
        for (const level of [1, 2]) {
          touchForced = touch; OPT.touchHand = hand; OPT.largeText = level; resizeScreen();
          const name = 'touch ' + touch + ', hand ' + hand + ', large text ' + level + where;
          const canvasBox = a11yRect(canvas);
          const barBox = a11yRect(Caption.element);
          check('the picture and the large-text bar are inside the screen, the bar under the picture (' + name + ')', a11yInside(canvasBox) && a11yInside(barBox) && barBox.top >= canvasBox.bottom - 1 && !a11yOverlap(canvasBox, barBox),
            'picture ' + JSON.stringify(canvasBox) + ' bar ' + JSON.stringify(barBox));
          let clipped = 0;
          let worst = '';
          for (const page of longest) {
            Caption.element.textContent = page; Caption.fit();
            const size = parseFloat(Caption.element.style.fontSize);
            if (Caption.element.scrollHeight > Caption.element.clientHeight + 1 || size < CAPTION_MIN_FONT) { clipped++; worst = page.slice(0, 40) + ' at ' + size + ' px'; }
          }
          check('the longest dialog pages (' + longest.length + ', both languages) fit the large-text bar without clipping (' + name + ')', clipped === 0, clipped + ' clipped ' + worst);
          if (touch) {
            const boxes = A11Y_BUTTONS.map(function (button) { return [button, a11yRect(touchPad.querySelector('[data-btn="' + button + '"]'))]; });
            const lost = boxes.filter(function (pair) { return !a11yInside(pair[1]); }).map(function (pair) { return pair[0]; });
            const covering = boxes.filter(function (pair) { return a11yOverlap(pair[1], canvasBox) || a11yOverlap(pair[1], barBox); }).map(function (pair) { return pair[0]; });
            const crossing = [];
            for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (a11yOverlap(boxes[i][1], boxes[j][1])) crossing.push(boxes[i][0] + '/' + boxes[j][0]);
            let reach = true;
            if (hand !== 0) {
              const portrait = window.innerHeight > window.innerWidth;
              for (const pair of boxes) {
                const centre = (pair[1].left + pair[1].right) / 2;
                const near = portrait ? window.innerWidth / 3 : TOUCH_SIDE_WIDTH;
                if (hand === 1 && centre < (portrait ? near : window.innerWidth - near)) reach = false;
                if (hand === 2 && centre > (portrait ? window.innerWidth - near : near)) reach = false;
              }
            }
            check('the eight touch buttons are inside the screen, apart from each other, the picture and the bar, and within one thumb of the chosen side (' + name + ')', lost.length === 0 && covering.length === 0 && crossing.length === 0 && reach,
              'outside ' + lost.join(',') + ' over picture or bar ' + covering.join(',') + ' crossing ' + crossing.join(',') + ' reach ' + reach);
          }
        }
      }
    }
    // One finger at a time: every touch button is pressed and released by its own pointer, and presses nothing else.
    touchForced = true; OPT.touchHand = 0; OPT.largeText = 0; resizeScreen();
    const stray = [];
    for (const button of A11Y_BUTTONS) {
      const element = touchPad.querySelector('[data-btn="' + button + '"]');
      Input.clear();
      element.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      const down = A11Y_BUTTONS.filter(function (other) { return Input.touch[other]; });
      element.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
      const after = A11Y_BUTTONS.filter(function (other) { return Input.touch[other]; });
      if (down.length !== 1 || down[0] !== button || after.length !== 0) stray.push(button + ' -> ' + down.join('+') + ' / ' + after.join('+'));
    }
    check('every touch button works with one finger alone and releases cleanly' + where, stray.length === 0, stray.join(' | '));

    // 3. Flashes off: a still picture where the game shook or blinked, on every screen that does either.
    touchForced = null; OPT.largeText = 0; OPT.touchHand = 0; resizeScreen();
    const frames = function (from, to) { const list = []; for (let n = from; n <= to; n++) list.push(n); return list; };
    const distinct = function (list) { return new Set(list).size; };
    const hitSignatures = function (flashesOff) {
      OPT.flashesOff = flashesOff; OPT.reduceMotion = false;
      const layer = a11yBattle('idle');
      return frames(0, 15).map(function (t) {
        layer.fx = { kind: 'hit', side: 1, t: t, dur: 16, resolve: null };
        layer.applyFx();
        a11yShow(layer);
        return a11ySignature();
      });
    };
    const idleBattle = a11yBattle('idle'); a11yShow(idleBattle);
    const idleSignature = a11ySignature();
    const hitsBlinking = hitSignatures(false);
    const hitsSteady = hitSignatures(true);
    check('flashes off: a creature that is hit blinks and shakes by default' + where, distinct(hitsBlinking) >= 2, distinct(hitsBlinking) + ' different pictures in 16 frames');
    check('flashes off: a creature that is hit stays steady (one picture, not the resting one: the hit is still shown)' + where, distinct(hitsSteady) === 1 && hitsSteady[0] !== idleSignature, distinct(hitsSteady) + ' pictures');
    const evolveSignatures = function (flashesOff, from, to) {
      OPT.flashesOff = flashesOff;
      const layer = new EvolveLayer(G.party[0], SPECIES[G.party[0].sp].evo.to);
      return frames(from, to).map(function (n) { layer.frame = n; a11yShow(layer); return a11ySignature([88, 40, 64, 64]); });
    };
    check('flashes off: the evolution flashes white by default' + where, distinct(evolveSignatures(false, 32, 39)) >= 2);
    check('flashes off: the evolution glows steadily (one picture from frame 31 to 79)' + where, distinct(evolveSignatures(true, 31, 79)) === 1);
    const blinkSignatures = function (make, flashesOff, from, to, prepare, region) {
      OPT.flashesOff = flashesOff;
      const layer = make();
      return frames(from, to).map(function (n) { prepare(layer, n); a11yShow(layer); return a11ySignature(region); });
    };
    const blinkers = [
      ['the arrow of a dialog', function () { const layer = new DialogLayer(T('ui.yes')); layer.box.typed = layer.box.total; return layer; }, function (layer, n) { layer.blink = n; }, null],
      ['the cursor of the name screen', function () { return new NameLayer('ΝΙΚΟΣ'); }, function (layer, n) { layer.frame = n; }, [60, 22, 120, 20]],
      ['the press-A line of the notice', function () { const layer = new NoticeLayer(); layer.greek = ['x']; layer.english = ['y']; return layer; }, function (layer, n) { layer.frame = 21 + n; }, [0, 130, SCREEN_W, 20]],
    ];
    for (const blinker of blinkers) {
      check('flashes off: ' + blinker[0] + ' blinks by default' + where, distinct(blinkSignatures(blinker[1], false, 0, 80, blinker[2], blinker[3])) >= 2);
      check('flashes off: ' + blinker[0] + ' stays steady' + where, distinct(blinkSignatures(blinker[1], true, 0, 80, blinker[2], blinker[3])) === 1);
    }
    const monitorLight = function (flashesOff) { // does the heart line ever turn light green
      OPT.flashesOff = flashesOff;
      const layer = new MonitorLayer();
      let light = false;
      for (const n of frames(0, 40)) {
        layer.frame = n; a11yShow(layer);
        const box = MONITOR_BOX;
        const data = ctx.getImageData(Math.floor(box.x * viewScale), Math.floor(box.y * viewScale), Math.floor(box.w * viewScale), Math.floor(box.h * viewScale)).data;
        for (let i = 0; i < data.length; i += 4) if (data[i] > 160 && data[i + 1] > 240 && data[i + 2] > 190 && data[i + 2] < 230) { light = true; break; }
      }
      return light;
    };
    check('flashes off: the heart line changes colour by default and keeps one colour with the option' + where, monitorLight(false) === true && monitorLight(true) === false);
    OPT.flashesOff = false;

    // 4. Type marks: the picture changes where a type colour is shown, and the seven marks are seven different shapes drawn on the picture.
    const markScreens = [
      ['the starter screen', function () { return new StarterLayer(); }],
      ['the archive list', function () { return new ArchiveLayer({ mode: 'view' }); }],
      ['the summary', function () { return new SummaryLayer(0); }],
      ['the case file', function () { const layer = new DossierLayer(); return layer; }],
      ['the moves of a battle', function () { return a11yBattle('moves'); }],
    ];
    for (const screen of markScreens) {
      OPT.typeMarks = true; const withMarks = (function () { a11yShow(screen[1]()); return a11ySignature(); })();
      OPT.typeMarks = false; const without = (function () { a11yShow(screen[1]()); return a11ySignature(); })();
      check('type marks: ' + screen[0] + ' looks different with and without the marks' + where, withMarks !== without);
    }
    OPT.typeMarks = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0); // one logical pixel is one device pixel here, so the pixels can be read exactly
    const drawn = {};
    for (const typeId of TYPE_IDS) {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 40, 30);
      drawTypeTag(typeId, 10, 10);
      let picture = '';
      for (let row = 0; row < TYPE_MARK_SIZE; row++) {
        for (let column = 0; column < TYPE_MARK_SIZE; column++) {
          const pixel = ctx.getImageData(13 + column, 12 + row, 1, 1).data;
          picture += pixel[0] > 200 && pixel[1] > 200 && pixel[2] > 200 ? '#' : '.';
        }
      }
      drawn[typeId] = picture;
    }
    const expected = TYPE_IDS.map(function (typeId) { return TYPE_MARKS[typeId].join(''); });
    check('type marks: the seven tags show seven different shapes in white, the shapes of the table' + where, distinct(Object.values(drawn)) === 7 && TYPE_IDS.every(function (typeId, i) { return drawn[typeId] === expected[i]; }), JSON.stringify(drawn));
    OPT.typeMarks = true;
    const widthWith = drawTypeTag('biz', 10, 10);
    OPT.typeMarks = false;
    const widthWithout = drawTypeTag('biz', 10, 10);
    check('type marks: with the option on every tag is wider by the room of the mark (' + (TYPE_MARK_SIZE + 2) + ' px), with it off the tag is colour and text only' + where, widthWith - widthWithout === TYPE_MARK_SIZE + 2, widthWith + ' / ' + widthWithout);
    OPT.typeMarks = true;

    // 5. Hold to repeat: a held arrow moves the cursor by the level of the option, on every menu that moves one.
    const holdScreens = [
      ['a choice list', function () { return new ChoiceLayer(['a', 'b', 'c', 'd', 'e', 'f'], {}); }, 'down'],
      ['the team', function () { return new PartyLayer({ mode: 'view' }); }, 'down'],
      ['the bag', function () { return new BagLayer({ battle: false }); }, 'down'],
      ['the case files', function () { return new DossierLayer(); }, 'down'],
      ['the shop', function () { return new ShopLayer(); }, 'down'],
      ['the archive (down)', function () { return new ArchiveLayer({ mode: 'view' }); }, 'down'],
      ['the archive (pages)', function () { return new ArchiveLayer({ mode: 'view' }); }, 'right'],
      ['the summary (moves)', function () { return new SummaryLayer(0); }, 'down'],
      ['the summary (creatures)', function () { return new SummaryLayer(0); }, 'right'],
      ['the starter screen', function () { return new StarterLayer(); }, 'right'],
      ['the name screen', function () { return new NameLayer('ΝΙΚΟΣ'); }, 'right'],
      ['the accessibility screen', function () { return new AccessibilityLayer(); }, 'down'],
      ['the options screen', function () { return new OptionsLayer(); }, 'down'],
      ['the battle command tabs', function () { return a11yBattle('root'); }, 'right'],
      ['the battle moves', function () { const layer = a11yBattle('moves'); layer.battle.sides[0].party[layer.battle.sides[0].active].moves = G.party[0].moves.concat(G.party[0].moves).slice(0, 4); layer.refreshMoveInfo(); return layer; }, 'down'],
    ];
    for (const screen of holdScreens) {
      const counts = [0, 1, 2, 3].map(function (level) { OPT.holdRepeat = level; return a11yHold(screen[1](), screen[2], 120); });
      check('hold to repeat: ' + screen[0] + ' (' + screen[2] + ' held for 2 seconds): off steps once, normal steps more, the levels never get fewer' + where,
        counts[0] === 1 && counts[2] > counts[0] && counts[1] >= counts[0] && counts[1] <= counts[2] && counts[2] <= counts[3], 'steps by level ' + counts.join(','));
    }
    OPT.holdRepeat = HOLD_REPEAT_DEFAULT;

    // 6. The options are changed from the screens, saved, and an old saved set loads with the defaults.
    OPT = Object.assign({}, defaultOptions(), { lang: 'el', reduceMotion: false });
    const access = new AccessibilityLayer();
    layers.length = 0; layers.push(access);
    const press = async function (button) { Input.inject(button, 2); await pumpFrames(4); };
    await press('right'); // large text -> Large
    await press('down'); await press('right'); // type marks off
    await press('down'); await press('right'); // flashes off on
    await press('down'); await press('right'); // hold to repeat -> Fast
    await press('down'); await press('right'); // touch controls -> one hand right
    const changed = OPT.largeText === 1 && OPT.typeMarks === false && OPT.flashesOff === true && OPT.holdRepeat === 3 && OPT.touchHand === 1;
    check('accessibility screen: one press on each row changes its option' + where, changed, JSON.stringify(OPT));
    const stored = JSON.parse(Store.get(OPTIONS_KEY) || 'null');
    check('accessibility screen: the changes are saved in the options key' + where, !!stored && stored.largeText === 1 && stored.typeMarks === false && stored.flashesOff === true && stored.holdRepeat === 3 && stored.touchHand === 1, JSON.stringify(stored));
    loadOptions();
    check('the saved accessibility options load again' + where, OPT.largeText === 1 && OPT.typeMarks === false && OPT.flashesOff === true && OPT.holdRepeat === 3 && OPT.touchHand === 1, JSON.stringify(OPT));
    Store.set(OPTIONS_KEY, JSON.stringify({ lang: 'en', sound: false, textSpeed: 2, reduceMotion: true }));
    loadOptions();
    check('options saved before the accessibility options exist load with the old choices and the new ones at their defaults' + where,
      OPT.lang === 'en' && OPT.sound === false && OPT.textSpeed === 2 && OPT.reduceMotion === true && OPT.largeText === 0 && OPT.typeMarks === true && OPT.flashesOff === false && OPT.holdRepeat === HOLD_REPEAT_DEFAULT && OPT.touchHand === 0, JSON.stringify(OPT));
    OPT = Object.assign({}, defaultOptions(), { reduceMotion: false });
    const options = new OptionsLayer();
    layers.length = 0; layers.push(options);
    for (let i = 0; i < OPTIONS_ACCESS_ROW; i++) await press('down');
    await press('a');
    await pumpFrames(2);
    check('the Options screen opens the Accessibility screen from its own row' + where, layers[layers.length - 1] instanceof AccessibilityLayer, layers.map(function (layer) { return layer.constructor.name; }).join(','));
  } finally {
    delete ctx.fillText;
    OPT = keepOptions;
    touchForced = keepTouch;
    resizeScreen();
    Input.clear();
  }
}

