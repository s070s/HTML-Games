// 27a-screens-calibration.js - a part of M-27 FLM.Screens (T04.09): DLG-Calibration, the calibration wizard, with the pure
// analysis of its tap steps. Split from 27-screens.js when that file passed 150 KB (RISK-60, OI-45). The part registers one
// factory with FLM.Core.part; Screens asks for it the first time the wizard or its analysis is needed and hands over the
// helpers of its own closure as the kit (Core, UI, bus, Settings, el, say, paragraph, actionButton, addAll, MS_PER_SECOND,
// noteSpeedFormat).
// Spec: docs/IMPLEMENTATION-PLAN.md Part 6.27.4.22 and 7.7.1. The tests stay in 91-test-screens.js.
(function () {
'use strict';
const FLM = window.FLM;

FLM.Core.part('Screens', 'calibration', function (host, kit) {
  const { Core, UI, bus, Settings, el, say, paragraph, actionButton, addAll, MS_PER_SECOND, noteSpeedFormat } = kit;
  // T03.09 delivers the "Watch and tap" step (input offset), the note speed preview and the summary. T04.09 adds the
  // "Listen and tap" step: clicks on Audio.Metronome, the median tap delay is the measured sound delay (an estimate).
  const CAL_TAP_COUNT = 12;            // flashes (or clicks) per step
  const CAL_IGNORED = 4;               // the first four are for getting into the rhythm
  const CAL_INTERVAL_MS = 667;         // 90 BPM
  const CAL_START_DELAY_MS = 1000;
  const CAL_MATCH_MS = 300;            // a tap counts for the nearest flash within this distance
  const CAL_MATCH_SHARE = 0.45;        // ... and never for more than this share of the beat (300 ms at 90 BPM)
  const CAL_END_MARGIN_MS = 100;       // the step ends this long after the last tap could still match
  const CAL_MIN_MATCHED = 6;
  const CAL_UNEVEN_MS = 40;            // an interquartile range above this shows S-CAL-02
  const CAL_FLASH_MS = 120;
  const CAL_BEATS_PER_BAR = 4;         // the first click of every bar is the accent
  const CAL_PREVIEW_NOTES = 8;
  const CAL_PREVIEW_LANES = 4;
  const CAL_SPEED_STEP_MS = 50;
  const CAL_TAP_CONTROL = /^(lane|dance)[0-3]$/;
  const CAL_LIMITS = Object.freeze({ inputOffsetMs: [-200, 200], audioLatencyMs: [0, 500] });
  const QUARTILE = Object.freeze({ low: 0.25, middle: 0.5, high: 0.75 });

  function quantile(sorted, fraction) {
    const position = (sorted.length - 1) * fraction;
    const below = Math.floor(position);
    const above = Math.ceil(position);
    return sorted[below] + (sorted[above] - sorted[below]) * (position - below);
  }

  /** Tap minus flash (ms) for the flashes after the first four that have a tap within the match window. */
  function matchedDeltas(taps, targets, matchMs) {
    const deltas = [];
    targets.forEach((target, index) => {
      if (index < CAL_IGNORED) return;
      const near = taps.map((tap) => tap - target).filter((delta) => Math.abs(delta) <= matchMs);
      if (near.length === 0) return;
      deltas.push(near.reduce((best, delta) => (Math.abs(delta) < Math.abs(best) ? delta : best)));
    });
    return deltas;
  }

  /**
   * One tap step (Part 7.7.1): taps and targets in ms on one clock; matchMs is the distance a tap may be from
   * its flash (default 300 ms).
   * @returns {{status:'ok'|'few'|'uneven', medianMs:(number|null), iqrMs:(number|null), matched:number}}
   */
  function analyzeTaps(taps, targets, matchMs) {
    const distanceMs = matchMs === undefined ? CAL_MATCH_MS : matchMs;
    const sorted = matchedDeltas(taps, targets, distanceMs).sort((a, b) => a - b);
    if (sorted.length === 0) return { status: 'few', medianMs: null, iqrMs: null, matched: 0 };
    const iqrMs = quantile(sorted, QUARTILE.high) - quantile(sorted, QUARTILE.low);
    let status = 'ok';
    if (sorted.length < CAL_MIN_MATCHED) status = 'few';
    else if (iqrMs > CAL_UNEVEN_MS) status = 'uneven';
    return { status, medianMs: quantile(sorted, QUARTILE.middle), iqrMs, matched: sorted.length };
  }

  const clampRound = (value, limits) => Math.min(limits[1], Math.max(limits[0], Math.round(value)));

  /**
   * The wizard result (Part 7.7.1). measured: {audioMs, visualMs} step medians, null when the step was skipped. The
   * flash step holds only input and display delay (V); the click step adds the sound delay (A), so the sound delay is
   * A - V and the Judge offset (input offset + sound delay) equals A.
   */
  function calibrationFromMedians(measured, current) {
    const next = Object.assign({}, current);
    if (measured.visualMs === null) return next;
    next.inputOffsetMs = clampRound(measured.visualMs, CAL_LIMITS.inputOffsetMs);
    if (measured.audioMs !== null) {
      next.audioLatencyMs = clampRound(measured.audioMs - measured.visualMs, CAL_LIMITS.audioLatencyMs);
    }
    return next;
  }

  const signed = (value) => (value > 0 ? '+' + value : String(value));

  // params: {intervalMs, startDelayMs, onRunStart(targetsMs)} are test hooks; the player never sets them.
  function openCalibration(params) {
    const token = Symbol('dlg-calibration');
    const intervalMs = params.intervalMs || CAL_INTERVAL_MS;
    const startDelayMs = params.startDelayMs === undefined ? CAL_START_DELAY_MS : params.startDelayMs;
    const matchMs = Math.min(CAL_MATCH_MS, intervalMs * CAL_MATCH_SHARE);
    const view = { page: 'listen', values: Settings.calibration(), measured: { audioMs: null, visualMs: null },
      host: null, finish: null, handles: [], run: null, result: null, pad: null, status: null, notes: [],
      previewFrame: null, runFrame: null, runTimer: null, summaryLine: null };

    function keepHandle(handle) {
      view.handles.push(handle);
      return handle;
    }

    const stepButton = (id, label, onPress, kind, disabledReason) => keepHandle(actionButton({ id: 'cal-' + id,
      label: say(label), kind: kind || 'secondary', onPress, disabledReason })).root;

    function stopRun() {
      const audio = FLM.Audio;
      if (view.run && view.run.kind === 'listen' && audio && audio.Metronome && typeof audio.Metronome.cancel === 'function') {
        audio.Metronome.cancel();               // Escape, Cancel or leaving the page: the booked clicks never sound
      }
      view.run = null;
      Core.raf.cancel(view.runFrame);
      Core.timers.clearTimeout(view.runTimer);
    }

    function disposePage() {
      stopRun();
      Core.raf.cancel(view.previewFrame);
      view.handles.forEach((handle) => handle.destroy());
      view.handles = [];
      view.host.textContent = '';
    }

    function goTo(page) {
      disposePage();
      view.page = page;
      PAGES[page]();
    }

    function showPage(title, body, nodes) {
      addAll(view.host, [el('h3', null, title), paragraph(body)].concat(nodes));
    }

    // ---- the tap run: flashes on a fixed beat, taps collected until the last tap could still match
    function addTap(tPerf) {
      if (view.run) view.run.taps.push(tPerf);
    }

    function onInputEvent(evt) {
      if (evt && evt.type === 'press' && CAL_TAP_CONTROL.test(evt.control)) addTap(evt.tPerf);
    }

    function onFrame() {
      const run = view.run;
      if (!run) return;
      const nowMs = Core.now();
      while (run.shown < run.targets.length && nowMs >= run.targets[run.shown]) run.shown += 1;
      const lastFlash = run.shown > 0 ? run.targets[run.shown - 1] : -Infinity;
      if (run.kind === 'listen') {
        if (run.shown > 0) view.status.textContent = say('cal.listen.counter', { count: run.shown });
      } else {
        view.pad.classList.toggle('on', nowMs - lastFlash < CAL_FLASH_MS);
        if (run.shown > 0) view.status.textContent = say('cal.watch.counter', { count: run.shown });
      }
      view.runFrame = Core.raf.request(onFrame, token);
    }

    function endRun() {
      const run = view.run;
      if (!run) return;
      view.result = analyzeTaps(run.taps, run.targets, matchMs);
      stopRun();
      if (run.kind === 'listen') renderListen(view.result.status);
      else renderWatch(view.result.status);
    }

    function startRun() {
      renderWatch('running');
      const first = Core.now() + startDelayMs;
      const targets = Array.from({ length: CAL_TAP_COUNT }, (item, index) => first + index * intervalMs);
      view.run = { kind: 'watch', targets, taps: [], shown: 0 };
      view.runFrame = Core.raf.request(onFrame, token);
      const wait = targets[targets.length - 1] + matchMs + CAL_END_MARGIN_MS - Core.now();
      view.runTimer = Core.timers.setTimeout(endRun, wait, token);
      if (typeof params.onRunStart === 'function') params.onRunStart(targets.slice());
    }

    function acceptWatch() {
      view.measured.visualMs = view.result.medianMs;
      view.values = calibrationFromMedians(view.measured, view.values);
      goTo('speed');
    }

    // ---- the listen run: clicks on Audio.Metronome at fixed times, taps collected like the watch run
    function clickAudioTime(targetMs) {
      const mapped = FLM.Input && typeof FLM.Input.perfToAudio === 'function' ? FLM.Input.perfToAudio(targetMs) : null;
      if (Number.isFinite(mapped)) return mapped;           // no anchor yet: the audio clock and the page clock are compared now
      return FLM.Audio.now() + (targetMs - Core.now()) / MS_PER_SECOND;
    }

    function acceptListen() {
      view.measured.audioMs = view.result.medianMs;
      goTo('watch');
    }

    // Start is the gesture that unlocks sound; the clicks are booked on the audio clock, the taps are compared in ms.
    async function startListen() {
      const audio = FLM.Audio;
      const unlocked = audio && typeof audio.unlock === 'function' ? await audio.unlock() : { ok: false };
      if (view.page !== 'listen' || view.run) return;
      if (!unlocked.ok || !audio.Metronome) {
        renderListen('blocked');
        return;
      }
      renderListen('running');
      const first = Core.now() + startDelayMs;
      const targets = Array.from({ length: CAL_TAP_COUNT }, (item, index) => first + index * intervalMs);
      view.run = { kind: 'listen', targets, taps: [], shown: 0 };
      targets.forEach((target, index) => audio.Metronome.click(clickAudioTime(target), index % CAL_BEATS_PER_BAR === 0));
      view.runFrame = Core.raf.request(onFrame, token);
      const wait = targets[targets.length - 1] + matchMs + CAL_END_MARGIN_MS - Core.now();
      view.runTimer = Core.timers.setTimeout(endRun, wait, token);
      if (typeof params.onRunStart === 'function') params.onRunStart(targets.slice());
    }

    // ---- pages
    function listenButtons(outcome) {
      const again = () => stepButton('listen-again', 'cal.again', startListen);
      const skip = () => stepButton('listen-skip', 'cal.skip', () => goTo('watch'));
      if (outcome === 'running') return [];
      if (outcome === 'ok') return [stepButton('listen-next', 'cal.next', acceptListen, 'primary'), again(), skip()];
      if (outcome === 'few' || outcome === 'blocked') return [again(), skip()];
      if (outcome === 'uneven') return [again(), stepButton('listen-anyway', 'cal.anyway', acceptListen), skip()];
      return [stepButton('listen-start', 'cal.start', startListen, 'primary'), skip()];
    }

    function listenMessage(outcome) {
      if (outcome === 'blocked') return say('E-AUD-002');
      if (outcome === 'few') return say('S-CAL-01');
      if (outcome === 'uneven') return say('S-CAL-02');
      if (outcome === 'ok') return say('cal.result', { tap: signed(Math.round(view.result.medianMs)) });
      return say('cal.listen.ready');
    }

    function renderListen(outcome) {
      disposePage();
      view.page = 'listen';
      view.pad = el('div', { id: 'cal-pad', class: 'cal-pad', role: 'button', tabindex: '0', owner: token,
        'aria-label': say('cal.listen.pad'), on: { pointerdown: (evt) => addTap(evt.timeStamp) } });
      view.status = paragraph(listenMessage(outcome), { id: 'cal-status', role: 'status' });
      showPage(say('cal.listen.title'), say('cal.listen.body'), [view.pad, view.status,
        el('div', { class: 'btn-row' }, listenButtons(outcome))]);
    }

    function watchButtons(outcome) {
      const again = () => stepButton('again', 'cal.again', startRun);
      const back = () => stepButton('back', 'cal.back', () => goTo('listen'));
      const skip = () => stepButton('skip', 'cal.skip', () => goTo('speed'));
      if (outcome === 'running') return [];
      if (outcome === 'ok') return [stepButton('next', 'cal.next', acceptWatch, 'primary'), again(), back()];
      if (outcome === 'few') return [again(), skip(), back()];
      if (outcome === 'uneven') return [again(), stepButton('anyway', 'cal.anyway', acceptWatch), back()];
      return [stepButton('start', 'cal.start', startRun, 'primary'), skip(), back()];
    }

    function watchMessage(outcome) {
      if (outcome === 'few') return say('S-CAL-01');
      if (outcome === 'uneven') return say('S-CAL-02');
      if (outcome === 'ok') return say('cal.result', { tap: signed(Math.round(view.result.medianMs)) });
      return say('cal.watch.ready');
    }

    function renderWatch(outcome) {
      disposePage();
      view.page = 'watch';
      view.pad = el('div', { id: 'cal-pad', class: 'cal-pad', role: 'button', tabindex: '0', owner: token,
        'aria-label': say('cal.watch.pad'), on: { pointerdown: (evt) => addTap(evt.timeStamp) } });
      view.status = paragraph(watchMessage(outcome), { id: 'cal-status', role: 'status' });
      showPage(say('cal.watch.title'), say('cal.watch.body'), [view.pad, view.status,
        el('div', { class: 'btn-row' }, watchButtons(outcome))]);
    }

    function buildPreview() {
      const lanes = Array.from({ length: CAL_PREVIEW_LANES }, () => el('div', { class: 'cal-lane' }));
      view.notes = Array.from({ length: CAL_PREVIEW_NOTES }, (item, index) => {
        const node = el('span', { class: 'cal-note', 'aria-hidden': 'true' });
        lanes[index % CAL_PREVIEW_LANES].appendChild(node);
        return { node, timeMs: index * intervalMs };
      });
      return el('div', { id: 'cal-preview', class: 'cal-preview', 'aria-hidden': 'true' }, lanes);
    }

    // A note crosses the line when its sound is heard: the sound delay shifts the display (Part 5.12), the note
    // speed sets how long it is visible before that.
    function onPreviewFrame() {
      const loopMs = CAL_PREVIEW_NOTES * intervalMs;
      const { audioLatencyMs, visualLeadMs } = view.values;
      view.notes.forEach((note) => {
        const remaining = (((note.timeMs + audioLatencyMs - Core.now()) % loopMs) + loopMs) % loopMs;
        const visible = remaining <= visualLeadMs;
        note.node.hidden = !visible;
        if (visible) note.node.style.top = (1 - remaining / visualLeadMs) * 100 + '%';
      });
      view.previewFrame = Core.raf.request(onPreviewFrame, token);
    }

    function renderSpeed() {
      const change = (value) => { view.values.visualLeadMs = value; };
      const speed = keepHandle(UI.Widgets.slider({ id: 'cal-speed', label: say('cal.noteSpeed'), min: 600, max: 3000,
        step: CAL_SPEED_STEP_MS, value: view.values.visualLeadMs, format: noteSpeedFormat, onInput: change,
        onChange: change }));
      showPage(say('cal.speed.title'), say('cal.speed.body'), [buildPreview(), speed.root,
        el('div', { class: 'btn-row' }, [stepButton('next', 'cal.next', () => goTo('summary'), 'primary'),
          stepButton('back', 'cal.back', () => goTo('watch'))])]);
      view.previewFrame = Core.raf.request(onPreviewFrame, token);
    }

    function refreshSummary() {
      view.summaryLine.textContent = say('cal.summary.line', { sound: view.values.audioLatencyMs,
        tap: signed(view.values.inputOffsetMs), speed: (1500 / view.values.visualLeadMs).toFixed(1) });
    }

    function offsetField(id, label, key) {
      const limits = CAL_LIMITS[key];
      return keepHandle(UI.Widgets.number({ id, label: say(label), min: limits[0], max: limits[1], step: 1,
        unit: 'ms', value: view.values[key], onChange: (value) => { view.values[key] = value; refreshSummary(); } }));
    }

    function resetOffsets() {
      view.values.inputOffsetMs = 0;
      view.values.audioLatencyMs = 0;
      goTo('summary');
    }

    function renderSummary() {
      view.summaryLine = paragraph('', { id: 'cal-summary', role: 'status' });
      showPage(say('cal.summary.title'), say('cal.summary.honest'), [view.summaryLine,
        offsetField('cal-input-offset', 'cal.tapTiming', 'inputOffsetMs').root,
        offsetField('cal-sound-delay', 'cal.soundDelay', 'audioLatencyMs').root,
        el('div', { class: 'btn-row' }, [stepButton('save', 'cal.save', save, 'primary'),
          stepButton('reset', 'cal.reset', resetOffsets), stepButton('back', 'cal.back', () => goTo('speed'))])]);
      refreshSummary();
    }

    function save() {
      const values = { 'calibration.inputOffsetMs': view.values.inputOffsetMs,
        'calibration.audioLatencyMs': view.values.audioLatencyMs,
        'calibration.visualLeadMs': view.values.visualLeadMs };
      Settings.setMany(values, 'wizard');
      view.finish('save');
    }

    const PAGES = { listen: renderListen, watch: renderWatch, speed: renderSpeed, summary: renderSummary };

    // Escape ends a running step only; with no step running the dialog's own Escape closes it.
    function onEscape(evt) {
      if (evt.key !== 'Escape' || !view.run) return;
      evt.preventDefault();
      evt.stopImmediatePropagation();
      renderWatch();
    }

    function bindInput() {
      if (FLM.Input && typeof FLM.Input.bind === 'function') FLM.Input.bind({ owner: token, context: 'instrument' });
      bus.on('input.event', onInputEvent, token);
      Core.dom.on(window, 'keydown', onEscape, { capture: true }, token);
    }

    function release() {
      stopRun();
      Core.raf.cancel(view.previewFrame);
      bus.removeOwner(token);
      Core.dom.offOwner(token);
      Core.timers.clearOwner(token);
      Core.raf.cancelOwner(token);
      if (FLM.Input && typeof FLM.Input.unbind === 'function') FLM.Input.unbind(token);
    }

    const shown = UI.dialog({ id: 'DLG-Calibration', title: say('cal.title'),
      buttons: [{ id: 'cancel', label: say('dlg.cancel'), kind: 'secondary', isCancel: true }],
      build(container, finish) {
        view.host = container;
        view.finish = finish;
        bindInput();
        renderListen();
      } });
    return shown.then((result) => {
      release();
      return result;
    });
  }

  return Object.freeze({ analyzeTaps, calibrationFromMedians, openCalibration });
});
})();
