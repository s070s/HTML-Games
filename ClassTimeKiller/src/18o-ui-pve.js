// ==== S18 UI: SOLO AND PVE SCREENS (PRG-005, UI-001, DIF-004) ====
// The Solo screen (main menu entry) groups the PvE modes - Siege Waves, Endless Hold and the Test Chambers - with one difficulty
// choice, so the main menu stays short on a phone. The Guardian Plate dialog (pause menu row while the PvE section offers the
// plate) lets the player accept or refuse it. The PvE HUD itself is 17g. Contracts: docs/api/hud-play.md, docs/api/pve.md.

const SOLO_TEXT = 'Hold the core against enemy waves with bot teammates, or solve the Test Chambers alone. The difficulty sets lives, retries and enemy damage.';
// Built from the PvE rules (PVE_DIRECTOR) so the dialog never drifts from them. A refused plate is offered again in a later wave
// (14j clears the offer when a wave is cleared); a worn one never again.
function guardianText() {
  return PVE_DIRECTOR.guardianDeaths + ' deaths in this wave. Wear the Guardian Plate for the checkpoint retry: enemies deal '
    + Math.round(PVE_DIRECTOR.guardianTaken * 100) + '% of their damage to your team until the wave is cleared. '
    + 'It is offered again each wave until it has been worn once.';
}

const SoloMenu = {
  difficulty: '',             // the difficulty chosen on the Solo screen ('' = the remembered Quick Match one)
  chosenDifficulty() { return this.difficulty || PlayFlow.remembered().difficulty; },
};
// MP11: the best run kept per Test Chamber (Progress.chamberRecord, 15a), so the player sees which medals are still to win.
function soloChamberRecords(root) {
  const list = careerList(root);
  list.appendChild(makeElement('div', 'ui-group', 'Test Chambers: your best runs'));
  PVE_CHAMBERS.forEach((row, index) => {
    const record = Progress.chamberRecord(index + 1);
    const detail = record ? careerStars(record.stars, PVE_CHAMBER_RULES.medals.length) + ' ' + (record.medal || 'no medal') + ', ' + record.seconds + ' s' : 'not completed yet';
    const line = careerRow(row.zone, detail, []);
    line.tabIndex = 0;   // a row without buttons: the focus can still reach it, so a keyboard or gamepad scrolls the list
    list.appendChild(line);
  });
}

Ui.register('solo', {
  build(root) {
    injectStyle('career-style', CAREER_CSS);   // the record list's styles (the Solo screen opens from the main menu too)
    screenHeader(root, 'Solo');
    root.appendChild(makeElement('p', 'ui-sub', SOLO_TEXT));
    const difficulties = PlayFlow.difficulties();
    root.appendChild(Ui.row('Difficulty', Ui.cycle(difficulties.map((row) => row.id), difficulties.map((row) => row.name), SoloMenu.chosenDifficulty(), (value) => { SoloMenu.difficulty = value; })));
    const menu = makeElement('div', 'ui-menu');
    for (const entry of CAREER_MODE_ENTRIES) menu.appendChild(careerModeButton(entry, () => SoloMenu.chosenDifficulty()));
    const first = menu.querySelector('button:not([disabled])');
    if (first) first.dataset.autofocus = '1';
    root.appendChild(menu);
    soloChamberRecords(root);
  },
});

// ---- DIF-004 Guardian Plate: the player's choice, through the call the PvE section exposes (Pve.answerGuardian, 14j) ----
// A plate the player does not answer for is worn at the checkpoint retry.
function guardianChoiceOpen() {
  return !!Modes.hud.pve && Modes.hud.pve.active && Modes.hud.pve.guardianOffer && !Modes.hud.pve.guardianAccepted;
}
function answerGuardian(accept) {
  if (!guardianChoiceOpen() || !Pve.answerGuardian(accept)) return false;
  Ui.toast(accept ? 'Guardian Plate: worn for the retry' : 'Guardian Plate refused');
  return true;
}

Ui.register('guardian', {
  overlay: true,
  build(root) {
    root.classList.add('ui-dialog');
    const panel = makeElement('div', 'ui-panel');
    panel.appendChild(makeElement('h2', 'ui-title', 'Guardian Plate'));
    panel.appendChild(makeElement('p', 'ui-note', guardianText()));
    const foot = makeElement('div', 'ui-foot');
    const wear = Ui.button('Wear it', () => { answerGuardian(true); Ui.back(); }, 'primary');
    wear.dataset.autofocus = '1';
    foot.appendChild(wear);
    foot.appendChild(Ui.button('Refuse', () => { answerGuardian(false); Ui.back(); }));
    foot.appendChild(Ui.button('Decide later', () => Ui.back()));
    panel.appendChild(foot);
    root.appendChild(panel);
  },
});
const GUARDIAN_PAUSE_ENTRY = { label: 'Guardian Plate', screen: 'guardian', when: guardianChoiceOpen };
Bus.on('match.start', () => setPauseEntry(GUARDIAN_PAUSE_ENTRY, true));
