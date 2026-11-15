// ---- Sound: WebAudio blips and a small chiptune player ---------------------------------------------------------
// Every sound is generated; there are no audio files.
// The effects (DATA.sounds: notes of { at, freq, dur, wave, vol, slideTo }) and the tunes (DATA.music: bpm, channels, patterns and the
// order they play in, reference 13.10) are data; the tone shape, the player and the scheduler are code.
// The position of a step in a tune: which pattern it is in and where in that pattern. The patterns play one after the other
// (track.order) and, when the tune loops, it starts again from the first one.
function trackPosition(track, step) {
  let length = 0;
  for (const patternId of track.order) length += track.patterns[patternId].steps;
  if (!track.loop && step >= length) return null; // a tune that does not loop plays once
  let offset = step % length;
  for (const patternId of track.order) {
    const pattern = track.patterns[patternId];
    if (offset < pattern.steps) return { pattern: pattern, offset: offset };
    offset -= pattern.steps;
  }
  return null;
}
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
    const effect = DATA.sounds[name];
    if (!effect) return;
    const now = this.context.currentTime;
    for (const note of effect.notes) this.tone(note.freq, now + note.at, note.dur, note.wave, note.vol, note.slideTo);
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
    const track = DATA.music[this.trackId];
    const stepLength = 60 / track.bpm / track.stepsPerBeat;
    while (this.nextTime < this.context.currentTime + 0.25) {
      const position = trackPosition(track, this.step);
      if (!position) break;
      for (let channelIndex = 0; channelIndex < track.channels.length; channelIndex++) {
        const channel = track.channels[channelIndex];
        const note = position.pattern.notes[channelIndex][position.offset];
        if (note) this.tone(440 * Math.pow(2, (note - 69) / 12), this.nextTime, stepLength * channel.gate, channel.wave, channel.vol);
      }
      this.nextTime += stepLength;
      this.step++;
    }
  },
};

