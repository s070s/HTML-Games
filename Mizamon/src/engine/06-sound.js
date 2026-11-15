// ---- Sound: WebAudio blips and a small chiptune player ---------------------------------------------------------
// Every sound is generated; there are no audio files.
const MUSIC_TRACKS = {
  title: { bpm: 96, lead: [67, 0, 71, 74, 79, 0, 74, 71, 69, 0, 72, 76, 81, 0, 76, 72, 67, 0, 71, 74, 79, 78, 76, 74, 72, 0, 71, 0, 69, 0, 0, 0],
    bass: [43, 0, 0, 0, 50, 0, 0, 0, 45, 0, 0, 0, 52, 0, 0, 0, 43, 0, 0, 0, 50, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0] },
  town: { bpm: 116, lead: [72, 0, 76, 79, 77, 76, 74, 0, 72, 0, 76, 79, 81, 79, 77, 0, 74, 0, 77, 81, 79, 77, 76, 0, 76, 74, 72, 74, 76, 0, 0, 0],
    bass: [48, 0, 55, 0, 53, 0, 55, 0, 48, 0, 55, 0, 57, 0, 53, 0, 50, 0, 57, 0, 55, 0, 52, 0, 48, 0, 55, 0, 55, 0, 48, 0] },
  indoor: { bpm: 100, lead: [64, 0, 67, 0, 71, 0, 67, 0, 62, 0, 66, 0, 69, 0, 66, 0, 64, 0, 67, 0, 72, 0, 71, 0, 69, 0, 67, 0, 64, 0, 0, 0],
    bass: [40, 0, 0, 47, 0, 0, 40, 0, 38, 0, 0, 45, 0, 0, 38, 0, 40, 0, 0, 47, 0, 0, 43, 0, 45, 0, 0, 40, 0, 0, 0, 0] },
  route: { bpm: 126, lead: [69, 0, 72, 76, 74, 72, 69, 0, 67, 0, 71, 74, 72, 71, 67, 0, 65, 0, 69, 72, 71, 69, 65, 0, 64, 67, 71, 76, 74, 72, 71, 0],
    bass: [45, 0, 52, 0, 45, 0, 52, 0, 43, 0, 50, 0, 43, 0, 50, 0, 41, 0, 48, 0, 41, 0, 48, 0, 40, 0, 47, 0, 40, 47, 40, 47] },
  battle: { bpm: 152, lead: [76, 76, 0, 79, 76, 0, 83, 0, 81, 0, 79, 0, 76, 74, 76, 0, 76, 76, 0, 79, 76, 0, 84, 0, 83, 0, 81, 79, 76, 0, 0, 0],
    bass: [40, 40, 52, 40, 40, 40, 52, 40, 38, 38, 50, 38, 38, 38, 50, 38, 40, 40, 52, 40, 40, 40, 52, 40, 43, 43, 55, 43, 47, 47, 59, 47] },
  boss: { bpm: 164, lead: [74, 0, 74, 77, 81, 0, 77, 74, 73, 0, 73, 76, 81, 0, 76, 73, 74, 0, 77, 81, 86, 0, 84, 81, 80, 81, 77, 76, 74, 0, 0, 0],
    bass: [38, 38, 50, 38, 38, 38, 50, 38, 33, 33, 45, 33, 33, 33, 45, 33, 38, 38, 50, 38, 41, 41, 53, 41, 40, 40, 52, 40, 45, 45, 57, 45] },
};
const SFX_PATTERNS = {
  confirm: [[880, 0.05, 'square', 0.1, 0], [1175, 0.06, 'square', 0.1, 0.05]],
  back: [[520, 0.06, 'square', 0.1, 0], [390, 0.07, 'square', 0.1, 0.05]],
  move: [[660, 0.03, 'square', 0.06, 0]],
  hit: [[200, 0.14, 'sawtooth', 0.14, 0, 80]],
  super: [[260, 0.1, 'sawtooth', 0.16, 0, 90], [520, 0.12, 'square', 0.1, 0.08, 120]],
  weak: [[150, 0.1, 'triangle', 0.1, 0, 110]],
  attack: [[420, 0.08, 'square', 0.08, 0, 700]],
  faint: [[440, 0.45, 'triangle', 0.16, 0, 70]],
  levelup: [[523, 0.1, 'square', 0.1, 0], [659, 0.1, 'square', 0.1, 0.1], [784, 0.1, 'square', 0.1, 0.2], [1047, 0.25, 'square', 0.1, 0.3]],
  throw: [[300, 0.2, 'triangle', 0.1, 0, 900]],
  shake: [[200, 0.08, 'square', 0.08, 0]],
  recruit: [[523, 0.12, 'square', 0.1, 0], [659, 0.12, 'square', 0.1, 0.13], [784, 0.12, 'square', 0.1, 0.26], [1047, 0.12, 'square', 0.1, 0.39], [784, 0.12, 'square', 0.1, 0.52], [1047, 0.3, 'square', 0.1, 0.65]],
  heal: [[784, 0.08, 'triangle', 0.12, 0], [988, 0.08, 'triangle', 0.12, 0.09], [1319, 0.18, 'triangle', 0.12, 0.18]],
  // The hospital monitor: three flat beeps, then two quick rising blips.
  hospital: [[1000, 0.05, 'sine', 0.12, 0], [1000, 0.05, 'sine', 0.12, 0.3], [1000, 0.05, 'sine', 0.12, 0.6], [1250, 0.06, 'triangle', 0.12, 0.9], [1670, 0.12, 'triangle', 0.12, 0.98]],
  alert: [[880, 0.08, 'square', 0.12, 0], [880, 0.08, 'square', 0.12, 0.12]],
  bump: [[110, 0.05, 'square', 0.07, 0]],
  error: [[180, 0.12, 'square', 0.1, 0]],
  buy: [[988, 0.05, 'square', 0.09, 0], [1319, 0.1, 'square', 0.09, 0.06]],
  door: [[330, 0.07, 'triangle', 0.1, 0], [247, 0.1, 'triangle', 0.1, 0.07]],
};
const Sound = {
  context: null, master: null, trackId: null, step: 0, nextTime: 0, timer: null, wanted: null,
  unlock: function () {
    if (!this.context) {
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        this.context = new AudioContextClass();
        this.master = this.context.createGain();
        this.master.connect(this.context.destination);
        this.applyMute();
      } catch (error) { this.context = null; return; }
    }
    if (this.context.state === 'suspended') this.context.resume();
    if (this.wanted && !this.timer) this.play(this.wanted);
  },
  applyMute: function () { if (this.master) this.master.gain.value = OPT.sound ? 0.5 : 0; },
  tone: function (frequency, start, duration, type, volume, slideTo) {
    if (!this.context || !OPT.sound) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo) oscillator.frequency.linearRampToValueAtTime(slideTo, start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.006);
    gain.gain.linearRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  },
  sfx: function (name) {
    if (!this.context || !OPT.sound) return;
    const pattern = SFX_PATTERNS[name];
    if (!pattern) return;
    const now = this.context.currentTime;
    for (const note of pattern) this.tone(note[0], now + note[4], note[1], note[2], note[3], note[5]);
  },
  play: function (id) {
    this.wanted = id;
    if (!this.context || this.trackId === id) return;
    this.trackId = id;
    this.step = 0;
    this.nextTime = this.context.currentTime + 0.05;
    if (!this.timer) this.timer = setInterval(this.schedule.bind(this), 60);
  },
  stop: function () { this.wanted = null; this.trackId = null; },
  schedule: function () {
    if (!this.context || !this.trackId) return;
    const track = MUSIC_TRACKS[this.trackId];
    const stepLength = 60 / track.bpm / 2;
    while (this.nextTime < this.context.currentTime + 0.25) {
      const index = this.step % track.lead.length;
      const lead = track.lead[index];
      const bass = track.bass[index];
      if (lead) this.tone(440 * Math.pow(2, (lead - 69) / 12), this.nextTime, stepLength * 0.9, 'square', 0.045);
      if (bass) this.tone(440 * Math.pow(2, (bass - 69) / 12), this.nextTime, stepLength * 1.6, 'triangle', 0.09);
      this.nextTime += stepLength;
      this.step++;
    }
  },
};

