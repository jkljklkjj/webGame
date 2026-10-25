// 极简 WebAudio 音效：一个方波蜂鸣器，够"终端"了。
export class Beeps {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  resume() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  }

  beep(freq = 440, dur = 0.06, type = 'square', gain = 0.035) {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.ctx.destination);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }

  blip() { this.beep(720, 0.03); }
  hit() { this.beep(240, 0.06); }
  bounce() { this.beep(520, 0.035); }
  score() { this.beep(880, 0.07); setTimeout(() => this.beep(1180, 0.08), 70); }
  lose() { this.beep(200, 0.14, 'sawtooth'); setTimeout(() => this.beep(140, 0.18, 'sawtooth'), 120); }
  win() { this.beep(660, 0.08); setTimeout(() => this.beep(880, 0.08), 80); setTimeout(() => this.beep(1320, 0.12), 160); }
}
