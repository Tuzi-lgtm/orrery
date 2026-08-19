import type { BodyId } from "./bodies";

type Voice = {
  osc: OscillatorNode;
  gain: GainNode;
};

const ROOTS: Record<BodyId | "space", number> = {
  space: 65.41,
  sun: 61.74,
  mercury: 73.42,
  venus: 65.41,
  earth: 69.3,
  mars: 61.74,
  jupiter: 49.0,
  saturn: 55.0,
  uranus: 58.27,
  neptune: 46.25,
};

const HARMONICS = [1, 2, 3, 4, 5, 6];
const HARM_GAIN = [0.42, 0.22, 0.14, 0.08, 0.05, 0.03];

class SolarAudio {
  ctx: AudioContext;
  master: GainNode;
  omGain: GainNode;
  formants: BiquadFilterNode[] = [];
  voices: Voice[] = [];
  breath: OscillatorNode;
  formantLfo: OscillatorNode;
  started = false;

  constructor() {
    const Ctx =
      window.AudioContext ||
      (window as Window & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext!;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 20;
    comp.ratio.value = 2.6;
    comp.attack.value = 0.04;
    comp.release.value = 0.4;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    this.omGain = this.ctx.createGain();
    this.omGain.gain.value = 0.28;

    const f1 = this.ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.value = 520;
    f1.Q.value = 7;
    const f2 = this.ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = 860;
    f2.Q.value = 8;
    const f3 = this.ctx.createBiquadFilter();
    f3.type = "bandpass";
    f3.frequency.value = 2400;
    f3.Q.value = 6;
    this.formants = [f1, f2, f3];
    const formantMix = this.ctx.createGain();
    formantMix.gain.value = 1;
    this.formants.forEach((f) => {
      this.omGain.connect(f);
      f.connect(formantMix);
    });
    formantMix.connect(this.master);

    const chest = this.ctx.createBiquadFilter();
    chest.type = "lowpass";
    chest.frequency.value = 180;
    chest.Q.value = 0.5;
    this.omGain.connect(chest);
    const chestGain = this.ctx.createGain();
    chestGain.gain.value = 0.7;
    chest.connect(chestGain);
    chestGain.connect(this.master);

    const delay = this.ctx.createDelay(1);
    delay.delayTime.value = 0.28;
    const fb = this.ctx.createGain();
    fb.gain.value = 0.22;
    const wet = this.ctx.createGain();
    wet.gain.value = 0.2;
    formantMix.connect(delay);
    delay.connect(fb);
    fb.connect(delay);
    delay.connect(wet);
    wet.connect(this.master);

    this.breath = this.ctx.createOscillator();
    this.breath.type = "sine";
    this.breath.frequency.value = 0.07;
    const breathGain = this.ctx.createGain();
    breathGain.gain.value = 0.06;
    this.breath.connect(breathGain);
    breathGain.connect(this.omGain.gain);

    this.formantLfo = this.ctx.createOscillator();
    this.formantLfo.type = "sine";
    this.formantLfo.frequency.value = 0.055;
    const lfo1 = this.ctx.createGain();
    lfo1.gain.value = 160;
    const lfo2 = this.ctx.createGain();
    lfo2.gain.value = 90;
    const lfo3 = this.ctx.createGain();
    lfo3.gain.value = 280;
    this.formantLfo.connect(lfo1);
    this.formantLfo.connect(lfo2);
    this.formantLfo.connect(lfo3);
    lfo1.connect(f1.frequency);
    lfo2.connect(f2.frequency);
    lfo3.connect(f3.frequency);
  }

  async enable() {
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (!this.started) this.startPad();
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0.68, now + 2.4);
  }

  async disable() {
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(0, now + 0.7);
    window.setTimeout(() => {
      void this.ctx.suspend();
    }, 750);
  }

  startPad() {
    if (this.started) return;
    this.started = true;
    const now = this.ctx.currentTime;
    const root = ROOTS.space;
    HARMONICS.forEach((h, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i === 0 ? "sine" : "sine";
      osc.frequency.value = root * h;
      const gain = this.ctx.createGain();
      gain.gain.value = HARM_GAIN[i] ?? 0.02;
      osc.connect(gain);
      gain.connect(this.omGain);
      osc.start(now);
      this.voices.push({ osc, gain });
    });

    const vibrato = this.ctx.createOscillator();
    vibrato.type = "sine";
    vibrato.frequency.value = 4.4;
    const vibGain = this.ctx.createGain();
    vibGain.gain.value = 0.32;
    vibrato.connect(vibGain);
    this.voices.forEach((v) => vibGain.connect(v.osc.frequency));
    vibrato.start(now);

    const noiseBuf = this.ctx.createBuffer(
      1,
      this.ctx.sampleRate * 2,
      this.ctx.sampleRate,
    );
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = this.ctx.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const hum = this.ctx.createBiquadFilter();
    hum.type = "bandpass";
    hum.frequency.value = 180;
    hum.Q.value = 4;
    const humGain = this.ctx.createGain();
    humGain.gain.value = 0.035;
    noise.connect(hum);
    hum.connect(humGain);
    humGain.connect(this.omGain);
    noise.start(now);

    this.breath.start(now);
    this.formantLfo.start(now);
  }

  setFocus(id: BodyId | null) {
    if (!this.started) return;
    const root = ROOTS[id ?? "space"];
    const now = this.ctx.currentTime;
    this.voices.forEach((voice, i) => {
      const freq = root * (HARMONICS[i] ?? 1);
      voice.osc.frequency.cancelScheduledValues(now);
      voice.osc.frequency.setValueAtTime(Math.max(1, voice.osc.frequency.value), now);
      voice.osc.frequency.exponentialRampToValueAtTime(freq, now + 2.4);
    });
  }

  setSpeed(speed: number) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const rate = 0.04 + Math.min(speed, 16) * 0.003;
    this.formantLfo.frequency.cancelScheduledValues(now);
    this.formantLfo.frequency.setValueAtTime(this.formantLfo.frequency.value, now);
    this.formantLfo.frequency.linearRampToValueAtTime(rate, now + 0.6);
    this.breath.frequency.cancelScheduledValues(now);
    this.breath.frequency.setValueAtTime(this.breath.frequency.value, now);
    this.breath.frequency.linearRampToValueAtTime(0.055 + rate * 0.4, now + 0.6);
  }

  whoosh() {
    if (!this.started || this.ctx.state !== "running") return;
    const now = this.ctx.currentTime;
    const dur = 1.4;
    const buffer = this.ctx.createBuffer(
      1,
      this.ctx.sampleRate * dur,
      this.ctx.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      const env = 1 - i / data.length;
      data[i] = (Math.random() * 2 - 1) * env * env;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 0.7;
    filter.frequency.setValueAtTime(480, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + dur);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now);
    src.stop(now + dur);
  }
}

let engine: SolarAudio | null = null;

function getEngine() {
  if (!engine) engine = new SolarAudio();
  return engine;
}

export async function setSoundEnabled(on: boolean) {
  if (!on && !engine) return;
  const audio = getEngine();
  if (on) await audio.enable();
  else await audio.disable();
}

export function setSoundFocus(id: BodyId | null) {
  engine?.setFocus(id);
}

export function setSoundSpeed(speed: number) {
  engine?.setSpeed(speed);
}

export function playFocusWhoosh() {
  engine?.whoosh();
}
