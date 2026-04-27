import * as Tone from 'tone';
import type { DrumKind, InstrumentKind } from '../state/types';

// ---------- DRUMS (synthesized, no external samples needed) ----------

export interface Drum {
  trigger: (time: number, velocity?: number) => void;
  output: Tone.ToneAudioNode;
  dispose: () => void;
}

function makeKick(): Drum {
  const out = new Tone.Gain(1);
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.04,
    octaves: 6,
    oscillator: { type: 'sine' },
    envelope: { attack: 0.001, decay: 0.4, sustain: 0.01, release: 1.2, attackCurve: 'exponential' },
  }).connect(out);
  // body click
  const click = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.02, sustain: 0 },
    volume: -18,
  }).connect(out);
  return {
    output: out,
    trigger: (time, vel = 1) => {
      synth.triggerAttackRelease('C1', '8n', time, vel);
      click.triggerAttackRelease('16n', time, vel);
    },
    dispose: () => {
      synth.dispose();
      click.dispose();
      out.dispose();
    },
  };
}

function makeSnare(): Drum {
  const out = new Tone.Gain(1);
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 0.18, sustain: 0 },
    volume: -6,
  });
  const filter = new Tone.Filter(1800, 'highpass');
  noise.connect(filter);
  filter.connect(out);
  const tone = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.13, sustain: 0, release: 0.1 },
    volume: -10,
  }).connect(out);
  return {
    output: out,
    trigger: (time, vel = 1) => {
      noise.triggerAttackRelease('8n', time, vel);
      tone.triggerAttackRelease('G2', '16n', time, vel * 0.6);
    },
    dispose: () => {
      noise.dispose();
      filter.dispose();
      tone.dispose();
      out.dispose();
    },
  };
}

function makeClap(): Drum {
  const out = new Tone.Gain(1);
  const noise = new Tone.NoiseSynth({
    noise: { type: 'pink' },
    envelope: { attack: 0.001, decay: 0.15, sustain: 0 },
    volume: -6,
  });
  const filter = new Tone.Filter(1200, 'bandpass', -12);
  filter.Q.value = 2;
  noise.connect(filter);
  filter.connect(out);
  return {
    output: out,
    trigger: (time, vel = 1) => {
      // multiple short bursts to fake the clap stutter
      noise.triggerAttackRelease('32n', time, vel * 0.7);
      noise.triggerAttackRelease('32n', time + 0.012, vel * 0.7);
      noise.triggerAttackRelease('32n', time + 0.024, vel * 0.7);
      noise.triggerAttackRelease('16n', time + 0.04, vel);
    },
    dispose: () => {
      noise.dispose();
      filter.dispose();
      out.dispose();
    },
  };
}

function makeHat(open: boolean): Drum {
  const out = new Tone.Gain(1);
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: open
      ? { attack: 0.001, decay: 0.3, sustain: 0.02, release: 0.2 }
      : { attack: 0.001, decay: 0.05, sustain: 0, release: 0.02 },
    volume: -10,
  });
  const hp = new Tone.Filter(8000, 'highpass');
  noise.connect(hp);
  hp.connect(out);
  return {
    output: out,
    trigger: (time, vel = 1) => {
      noise.triggerAttackRelease(open ? '8n' : '32n', time, vel);
    },
    dispose: () => {
      noise.dispose();
      hp.dispose();
      out.dispose();
    },
  };
}

function makeTom(): Drum {
  const out = new Tone.Gain(1);
  const synth = new Tone.MembraneSynth({
    pitchDecay: 0.05,
    octaves: 3,
    envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.5 },
  }).connect(out);
  return {
    output: out,
    trigger: (time, vel = 1) => synth.triggerAttackRelease('A2', '8n', time, vel),
    dispose: () => {
      synth.dispose();
      out.dispose();
    },
  };
}

function makeCrash(): Drum {
  const out = new Tone.Gain(1);
  const noise = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: { attack: 0.001, decay: 1.5, sustain: 0.02, release: 1.5 },
    volume: -10,
  });
  const hp = new Tone.Filter(6000, 'highpass');
  noise.connect(hp);
  hp.connect(out);
  return {
    output: out,
    trigger: (time, vel = 1) => noise.triggerAttackRelease('2n', time, vel),
    dispose: () => {
      noise.dispose();
      hp.dispose();
      out.dispose();
    },
  };
}

function makePerc(): Drum {
  const out = new Tone.Gain(1);
  const synth = new Tone.MetalSynth({
    envelope: { attack: 0.001, decay: 0.1, release: 0.05 },
    harmonicity: 5.1,
    modulationIndex: 32,
    resonance: 2000,
    octaves: 1.5,
  }).connect(out);
  synth.volume.value = -16;
  return {
    output: out,
    trigger: (time, vel = 1) => synth.triggerAttackRelease('32n', time, vel),
    dispose: () => {
      synth.dispose();
      out.dispose();
    },
  };
}

export function createDrum(kind: DrumKind): Drum {
  switch (kind) {
    case 'kick':
      return makeKick();
    case 'snare':
      return makeSnare();
    case 'clap':
      return makeClap();
    case 'closedHat':
      return makeHat(false);
    case 'openHat':
      return makeHat(true);
    case 'tom':
      return makeTom();
    case 'crash':
      return makeCrash();
    case 'perc':
      return makePerc();
  }
}

// ---------- INSTRUMENTS ----------

export interface Instrument {
  triggerAttackRelease: (note: string | number, dur: string | number, time: number, vel?: number) => void;
  triggerAttack: (note: string | number, time: number, vel?: number) => void;
  triggerRelease: (note: string | number, time: number) => void;
  output: Tone.ToneAudioNode;
  dispose: () => void;
}

function wrapPolySynth(poly: Tone.PolySynth): Instrument {
  const out = new Tone.Gain(1);
  poly.connect(out);
  return {
    output: out,
    triggerAttackRelease: (n, d, t, v) => poly.triggerAttackRelease(n as any, d as any, t, v),
    triggerAttack: (n, t, v) => poly.triggerAttack(n as any, t, v),
    triggerRelease: (n, t) => poly.triggerRelease(n as any, t),
    dispose: () => {
      poly.dispose();
      out.dispose();
    },
  };
}

export function createInstrument(kind: InstrumentKind): Instrument {
  switch (kind) {
    case 'lead': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.6, release: 0.6 },
      });
      synth.volume.value = -10;
      return wrapPolySynth(synth);
    }
    case 'bass': {
      const synth = new Tone.PolySynth(Tone.MonoSynth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.005, decay: 0.2, sustain: 0.7, release: 0.3 },
        filter: { Q: 4, type: 'lowpass', rolloff: -24 },
        filterEnvelope: {
          attack: 0.01,
          decay: 0.3,
          sustain: 0.4,
          release: 0.4,
          baseFrequency: 100,
          octaves: 3.5,
        },
      });
      synth.volume.value = -8;
      return wrapPolySynth(synth);
    }
    case 'pluck': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.001, decay: 0.25, sustain: 0.0, release: 0.4 },
      });
      synth.volume.value = -10;
      return wrapPolySynth(synth);
    }
    case 'pad': {
      const synth = new Tone.PolySynth(Tone.AMSynth, {
        harmonicity: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.6, decay: 0.4, sustain: 0.8, release: 1.5 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.4, decay: 0.2, sustain: 0.5, release: 1.0 },
      });
      synth.volume.value = -14;
      return wrapPolySynth(synth);
    }
    case 'keys': {
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0.3, release: 0.8 },
      });
      synth.volume.value = -10;
      return wrapPolySynth(synth);
    }
    case 'fmBass': {
      const synth = new Tone.PolySynth(Tone.FMSynth, {
        harmonicity: 1,
        modulationIndex: 8,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.3, sustain: 0.6, release: 0.4 },
        modulation: { type: 'square' },
        modulationEnvelope: { attack: 0.005, decay: 0.5, sustain: 0.2, release: 0.5 },
      });
      synth.volume.value = -10;
      return wrapPolySynth(synth);
    }
  }
}
