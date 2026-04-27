import * as Tone from 'tone';
import { createDrum, createInstrument, type Drum, type Instrument } from './instruments';
import { actions, store } from '../state/store';
import type { Project, Track } from '../state/types';

interface TrackNode {
  track: Track;
  drum?: Drum;
  inst?: Instrument;
  filter: Tone.Filter;
  dist: Tone.Distortion;
  panner: Tone.Panner;
  vol: Tone.Volume;
  reverbSend: Tone.Gain;
  delaySend: Tone.Gain;
}

export class AudioEngine {
  started = false;
  master: Tone.Volume;
  limiter: Tone.Limiter;
  reverb: Tone.Reverb;
  delay: Tone.FeedbackDelay;
  reverbReturn: Tone.Volume;
  delayReturn: Tone.Volume;
  trackNodes = new Map<string, TrackNode>();
  scheduleId: number | null = null;
  private positionTickerId: number | null = null;

  constructor() {
    this.limiter = new Tone.Limiter(-1).toDestination();
    this.master = new Tone.Volume(-6).connect(this.limiter);
    this.reverb = new Tone.Reverb({ decay: 3, wet: 1 });
    this.reverb.generate();
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.4, wet: 1 });
    this.reverbReturn = new Tone.Volume(0).connect(this.master);
    this.delayReturn = new Tone.Volume(0).connect(this.master);
    this.reverb.connect(this.reverbReturn);
    this.delay.connect(this.delayReturn);
  }

  async ensureStarted() {
    if (!this.started) {
      await Tone.start();
      this.started = true;
    }
  }

  syncTracks(project: Project) {
    const seenIds = new Set<string>();
    project.tracks.forEach((t) => {
      seenIds.add(t.id);
      let node = this.trackNodes.get(t.id);
      if (!node) {
        node = this.createTrackNode(t);
        this.trackNodes.set(t.id, node);
      } else {
        // detect kind change -> recreate
        const drumChanged = t.type === 'drum' && t.drumKind !== node.track.drumKind;
        const instChanged = t.type === 'instrument' && t.instrumentKind !== node.track.instrumentKind;
        const typeChanged = t.type !== node.track.type;
        if (drumChanged || instChanged || typeChanged) {
          this.destroyTrackNode(node);
          node = this.createTrackNode(t);
          this.trackNodes.set(t.id, node);
        }
      }
      this.applyTrackParams(node, t, project);
    });
    // remove old
    for (const id of Array.from(this.trackNodes.keys())) {
      if (!seenIds.has(id)) {
        this.destroyTrackNode(this.trackNodes.get(id)!);
        this.trackNodes.delete(id);
      }
    }
    this.master.volume.rampTo(project.masterVolDb, 0.05);
    this.reverbReturn.volume.rampTo(linearToDb(project.masterReverbWet), 0.05);
    this.delayReturn.volume.rampTo(linearToDb(project.masterDelayWet), 0.05);
    Tone.getTransport().bpm.rampTo(project.bpm, 0.05);
    Tone.getTransport().swing = project.swing;
    Tone.getTransport().swingSubdivision = '16n';
  }

  private createTrackNode(t: Track): TrackNode {
    const filter = new Tone.Filter(t.filterCutoff, 'lowpass');
    filter.Q.value = t.filterRes;
    const dist = new Tone.Distortion({ distortion: t.distortion, wet: t.distortion > 0 ? 1 : 0 });
    const panner = new Tone.Panner(t.pan);
    const vol = new Tone.Volume(t.volumeDb);
    const reverbSend = new Tone.Gain(t.reverbSend);
    const delaySend = new Tone.Gain(t.delaySend);

    let node: TrackNode = {
      track: t,
      filter,
      dist,
      panner,
      vol,
      reverbSend,
      delaySend,
    };

    if (t.type === 'drum' && t.drumKind) {
      node.drum = createDrum(t.drumKind);
      node.drum.output.connect(filter);
    } else if (t.type === 'instrument' && t.instrumentKind) {
      node.inst = createInstrument(t.instrumentKind);
      node.inst.output.connect(filter);
    }

    filter.connect(dist);
    dist.connect(panner);
    panner.connect(vol);
    vol.connect(this.master);
    // sends
    vol.connect(reverbSend);
    reverbSend.connect(this.reverb);
    vol.connect(delaySend);
    delaySend.connect(this.delay);
    return node;
  }

  private destroyTrackNode(node: TrackNode) {
    node.drum?.dispose();
    node.inst?.dispose();
    node.filter.dispose();
    node.dist.dispose();
    node.panner.dispose();
    node.vol.dispose();
    node.reverbSend.dispose();
    node.delaySend.dispose();
  }

  private applyTrackParams(node: TrackNode, t: Track, project: Project) {
    node.track = t;
    const anySolo = project.tracks.some((tr) => tr.solo);
    const audible = !t.mute && (!anySolo || t.solo);
    node.vol.volume.rampTo(audible ? t.volumeDb : -120, 0.03);
    node.panner.pan.rampTo(t.pan, 0.03);
    node.filter.frequency.rampTo(t.filterCutoff, 0.03);
    node.filter.Q.rampTo(t.filterRes, 0.03);
    node.dist.distortion = t.distortion;
    node.dist.wet.rampTo(t.distortion > 0 ? 1 : 0, 0.03);
    node.reverbSend.gain.rampTo(t.reverbSend, 0.03);
    node.delaySend.gain.rampTo(t.delaySend, 0.03);
  }

  // play a one-shot preview note for a track (UI auditions)
  preview(trackId: string, pitch: number = 60, vel = 0.9) {
    const node = this.trackNodes.get(trackId);
    if (!node) return;
    const time = Tone.now();
    if (node.drum) node.drum.trigger(time, vel);
    else if (node.inst) {
      const freq = Tone.Frequency(pitch, 'midi').toFrequency();
      node.inst.triggerAttackRelease(freq, '8n', time, vel);
    }
  }

  // Continuous note preview (key-down/key-up)
  noteOn(trackId: string, pitch: number, vel = 0.9) {
    const node = this.trackNodes.get(trackId);
    if (!node) return;
    const time = Tone.now();
    if (node.drum) node.drum.trigger(time, vel);
    else if (node.inst) {
      const freq = Tone.Frequency(pitch, 'midi').toFrequency();
      node.inst.triggerAttack(freq, time, vel);
    }
  }
  noteOff(trackId: string, pitch: number) {
    const node = this.trackNodes.get(trackId);
    if (!node) return;
    if (node.inst) {
      const freq = Tone.Frequency(pitch, 'midi').toFrequency();
      node.inst.triggerRelease(freq, Tone.now());
    }
  }

  // ---------- Playback scheduling ----------
  // A Tone.Loop runs every 16th step. The engine reads the active project at that time.
  startTransport() {
    const transport = Tone.getTransport();
    if (this.scheduleId !== null) transport.clear(this.scheduleId);

    // step length = 16th note
    let step = 0;
    this.scheduleId = transport.scheduleRepeat((time) => {
      const project = store.getState().project;
      const totalSteps =
        project.playMode === 'pattern'
          ? this.activePattern(project)?.length ?? 16
          : project.songLengthBars * 16;
      const localStep = step % totalSteps;
      this.tickStep(project, localStep, time);
      // schedule UI update at the audio time
      Tone.getDraw().schedule(() => {
        actions.setPosition(localStep);
      }, time);
      step++;
    }, '16n');
    transport.start();
    actions.setIsPlaying(true);
  }

  stopTransport() {
    const transport = Tone.getTransport();
    if (this.scheduleId !== null) {
      transport.clear(this.scheduleId);
      this.scheduleId = null;
    }
    transport.stop();
    transport.position = 0;
    actions.setIsPlaying(false);
    actions.setPosition(0);
  }

  pauseTransport() {
    const transport = Tone.getTransport();
    transport.pause();
    actions.setIsPlaying(false);
  }

  private activePattern(project: Project) {
    return project.patterns.find((p) => p.id === project.activePatternId);
  }

  private tickStep(project: Project, step: number, time: number) {
    if (project.playMode === 'pattern') {
      const pat = this.activePattern(project);
      if (!pat) return;
      this.firePatternStep(project, pat.id, step, time);
    } else {
      // song mode: find any block whose start..start+pattern.length contains step
      project.playlist.forEach((block) => {
        const pat = project.patterns.find((p) => p.id === block.patternId);
        if (!pat) return;
        const local = step - block.startStep;
        if (local >= 0 && local < pat.length) {
          this.firePatternStep(project, pat.id, local, time);
        }
      });
    }
  }

  private firePatternStep(project: Project, patternId: string, localStep: number, time: number) {
    const pat = project.patterns.find((p) => p.id === patternId);
    if (!pat) return;
    project.tracks.forEach((t) => {
      const node = this.trackNodes.get(t.id);
      if (!node) return;
      if (t.type === 'drum') {
        const arr = pat.drumSteps[t.id];
        if (arr && arr[localStep]) {
          node.drum?.trigger(time, 0.9);
        }
      } else {
        const notes = pat.notes[t.id] || [];
        notes.forEach((n) => {
          if (n.start === localStep) {
            const dur = stepsToSeconds(n.duration);
            const freq = Tone.Frequency(n.pitch, 'midi').toFrequency();
            node.inst?.triggerAttackRelease(freq, dur, time, n.velocity);
          }
        });
      }
    });
  }

  // ---------- Export to WAV (offline render) ----------
  async renderToWav(): Promise<Blob> {
    const project = store.getState().project;
    let totalSteps: number;
    if (project.playMode === 'pattern') {
      totalSteps = this.activePattern(project)?.length ?? 16;
    } else {
      // length covers from step 0 to last block end
      let max = 0;
      project.playlist.forEach((b) => {
        const pat = project.patterns.find((p) => p.id === b.patternId);
        if (pat) max = Math.max(max, b.startStep + pat.length);
      });
      totalSteps = Math.max(max, 16);
    }
    const stepSec = 60 / project.bpm / 4;
    const durationSec = totalSteps * stepSec + 2; // tail for reverb
    const wasPlaying = store.getState().ui.isPlaying;
    if (wasPlaying) this.stopTransport();

    const buffer = await Tone.Offline(async ({ transport }) => {
      const offlineEngine = new OfflineEngineRunner(project);
      offlineEngine.setup();
      transport.bpm.value = project.bpm;
      transport.swing = project.swing;
      transport.swingSubdivision = '16n';
      let step = 0;
      transport.scheduleRepeat((time) => {
        const local = step % totalSteps;
        offlineEngine.tickStep(local, time);
        step++;
      }, '16n');
      transport.start(0);
    }, durationSec, 2);

    return audioBufferToWav((buffer as any).get?.() ?? (buffer as unknown as AudioBuffer));
  }

  startPositionTicker() {
    if (this.positionTickerId !== null) return;
    const update = () => {
      this.positionTickerId = requestAnimationFrame(update);
    };
    this.positionTickerId = requestAnimationFrame(update);
  }
}

class OfflineEngineRunner {
  project: Project;
  trackNodes = new Map<string, TrackNode>();
  master!: Tone.Volume;
  reverb!: Tone.Reverb;
  delay!: Tone.FeedbackDelay;
  reverbReturn!: Tone.Volume;
  delayReturn!: Tone.Volume;
  constructor(project: Project) {
    this.project = project;
  }
  setup() {
    const limiter = new Tone.Limiter(-1).toDestination();
    this.master = new Tone.Volume(this.project.masterVolDb).connect(limiter);
    this.reverb = new Tone.Reverb({ decay: 3, wet: 1 });
    this.reverb.generate();
    this.delay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.4, wet: 1 });
    this.reverbReturn = new Tone.Volume(linearToDb(this.project.masterReverbWet)).connect(this.master);
    this.delayReturn = new Tone.Volume(linearToDb(this.project.masterDelayWet)).connect(this.master);
    this.reverb.connect(this.reverbReturn);
    this.delay.connect(this.delayReturn);

    this.project.tracks.forEach((t) => {
      const filter = new Tone.Filter(t.filterCutoff, 'lowpass');
      filter.Q.value = t.filterRes;
      const dist = new Tone.Distortion({ distortion: t.distortion, wet: t.distortion > 0 ? 1 : 0 });
      const panner = new Tone.Panner(t.pan);
      const anySolo = this.project.tracks.some((tr) => tr.solo);
      const audible = !t.mute && (!anySolo || t.solo);
      const vol = new Tone.Volume(audible ? t.volumeDb : -120);
      const reverbSend = new Tone.Gain(t.reverbSend);
      const delaySend = new Tone.Gain(t.delaySend);
      const node: TrackNode = { track: t, filter, dist, panner, vol, reverbSend, delaySend };
      if (t.type === 'drum' && t.drumKind) {
        node.drum = createDrum(t.drumKind);
        node.drum.output.connect(filter);
      } else if (t.type === 'instrument' && t.instrumentKind) {
        node.inst = createInstrument(t.instrumentKind);
        node.inst.output.connect(filter);
      }
      filter.connect(dist);
      dist.connect(panner);
      panner.connect(vol);
      vol.connect(this.master);
      vol.connect(reverbSend);
      reverbSend.connect(this.reverb);
      vol.connect(delaySend);
      delaySend.connect(this.delay);
      this.trackNodes.set(t.id, node);
    });
  }
  tickStep(step: number, time: number) {
    if (this.project.playMode === 'pattern') {
      const pat = this.project.patterns.find((p) => p.id === this.project.activePatternId);
      if (pat) this.firePattern(pat.id, step, time);
    } else {
      this.project.playlist.forEach((b) => {
        const pat = this.project.patterns.find((p) => p.id === b.patternId);
        if (!pat) return;
        const local = step - b.startStep;
        if (local >= 0 && local < pat.length) this.firePattern(pat.id, local, time);
      });
    }
  }
  firePattern(patternId: string, step: number, time: number) {
    const pat = this.project.patterns.find((p) => p.id === patternId);
    if (!pat) return;
    this.project.tracks.forEach((t) => {
      const node = this.trackNodes.get(t.id);
      if (!node) return;
      if (t.type === 'drum') {
        if (pat.drumSteps[t.id]?.[step]) node.drum?.trigger(time, 0.9);
      } else {
        (pat.notes[t.id] || []).forEach((n) => {
          if (n.start === step) {
            const dur = stepsToSeconds(n.duration);
            const freq = Tone.Frequency(n.pitch, 'midi').toFrequency();
            node.inst?.triggerAttackRelease(freq, dur, time, n.velocity);
          }
        });
      }
    });
  }
}

function stepsToSeconds(steps: number) {
  const bpm = Tone.getTransport().bpm.value || 120;
  return (60 / bpm / 4) * steps;
}

function linearToDb(v: number) {
  if (v <= 0.0001) return -60;
  return 20 * Math.log10(v);
}

// ---------- WAV encoder ----------
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numCh = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataLen = buffer.length * blockAlign;
  const bufferLen = 44 + dataLen;
  const ab = new ArrayBuffer(bufferLen);
  const view = new DataView(ab);
  let p = 0;
  function w(s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(p++, s.charCodeAt(i));
  }
  function u32(v: number) {
    view.setUint32(p, v, true);
    p += 4;
  }
  function u16(v: number) {
    view.setUint16(p, v, true);
    p += 2;
  }
  w('RIFF');
  u32(36 + dataLen);
  w('WAVE');
  w('fmt ');
  u32(16);
  u16(1);
  u16(numCh);
  u32(sampleRate);
  u32(byteRate);
  u16(blockAlign);
  u16(16);
  w('data');
  u32(dataLen);
  // interleaved
  const channels: Float32Array[] = [];
  for (let c = 0; c < numCh; c++) channels.push(buffer.getChannelData(c));
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(p, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      p += 2;
    }
  }
  return new Blob([ab], { type: 'audio/wav' });
}

let engineSingleton: AudioEngine | null = null;
export function getEngine(): AudioEngine {
  if (!engineSingleton) engineSingleton = new AudioEngine();
  return engineSingleton;
}
