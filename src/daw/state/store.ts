import { useSyncExternalStore } from 'react';
import type {
  Project,
  Track,
  Pattern,
  Note,
  PlaylistBlock,
  View,
  DrumKind,
  InstrumentKind,
} from './types';

const TRACK_COLORS = [
  '#ff5252',
  '#ff9800',
  '#ffc107',
  '#8bc34a',
  '#26a69a',
  '#42a5f5',
  '#7e57c2',
  '#ec407a',
  '#26c6da',
  '#9ccc65',
  '#ffa726',
  '#ab47bc',
];

let _id = 0;
export const uid = (prefix = '') => `${prefix}${Date.now().toString(36)}-${(_id++).toString(36)}`;

const drumKinds: DrumKind[] = ['kick', 'snare', 'clap', 'closedHat', 'openHat', 'tom'];
const drumNames: Record<DrumKind, string> = {
  kick: 'Kick',
  snare: 'Snare',
  clap: 'Clap',
  closedHat: 'Hat',
  openHat: 'Open Hat',
  tom: 'Tom',
  crash: 'Crash',
  perc: 'Perc',
};

const instrumentNames: Record<InstrumentKind, string> = {
  lead: 'Lead',
  bass: 'Bass',
  pad: 'Pad',
  pluck: 'Pluck',
  keys: 'Keys',
  fmBass: 'FM Bass',
};

function defaultTrack(
  type: 'drum' | 'instrument',
  kind: DrumKind | InstrumentKind,
  index: number
): Track {
  const isDrum = type === 'drum';
  return {
    id: uid('t-'),
    name: isDrum ? drumNames[kind as DrumKind] : instrumentNames[kind as InstrumentKind],
    type,
    drumKind: isDrum ? (kind as DrumKind) : undefined,
    instrumentKind: !isDrum ? (kind as InstrumentKind) : undefined,
    color: TRACK_COLORS[index % TRACK_COLORS.length],
    volumeDb: -6,
    pan: 0,
    mute: false,
    solo: false,
    reverbSend: isDrum ? 0.05 : 0.2,
    delaySend: 0,
    filterCutoff: 20000,
    filterRes: 0,
    distortion: 0,
  };
}

function defaultProject(): Project {
  const tracks: Track[] = [];
  drumKinds.forEach((d, i) => tracks.push(defaultTrack('drum', d, i)));
  const instruments: InstrumentKind[] = ['bass', 'lead', 'pluck', 'pad'];
  instruments.forEach((kind, i) =>
    tracks.push(defaultTrack('instrument', kind, drumKinds.length + i))
  );

  const patternLength = 16;
  const buildPattern = (name: string, includeDefaults: boolean): Pattern => {
    const drumSteps: Record<string, boolean[]> = {};
    const notes: Record<string, Note[]> = {};
    tracks.forEach((t) => {
      if (t.type === 'drum') drumSteps[t.id] = new Array(patternLength).fill(false);
      else notes[t.id] = [];
    });
    if (includeDefaults) {
      // default: classic 4-on-the-floor demo
      const kick = tracks.find((t) => t.drumKind === 'kick');
      const snare = tracks.find((t) => t.drumKind === 'snare');
      const hat = tracks.find((t) => t.drumKind === 'closedHat');
      if (kick) [0, 4, 8, 12].forEach((i) => (drumSteps[kick.id][i] = true));
      if (snare) [4, 12].forEach((i) => (drumSteps[snare.id][i] = true));
      if (hat) [0, 2, 4, 6, 8, 10, 12, 14].forEach((i) => (drumSteps[hat.id][i] = true));
      const bass = tracks.find((t) => t.instrumentKind === 'bass');
      if (bass) {
        notes[bass.id] = [
          { id: uid('n-'), pitch: 36, start: 0, duration: 2, velocity: 0.9 },
          { id: uid('n-'), pitch: 36, start: 4, duration: 2, velocity: 0.9 },
          { id: uid('n-'), pitch: 41, start: 8, duration: 2, velocity: 0.9 },
          { id: uid('n-'), pitch: 39, start: 12, duration: 2, velocity: 0.9 },
        ];
      }
    }
    return { id: uid('p-'), name, length: patternLength, drumSteps, notes };
  };

  const p1 = buildPattern('Pattern 1', true);
  const p2 = buildPattern('Pattern 2', false);
  const p3 = buildPattern('Pattern 3', false);

  return {
    bpm: 128,
    swing: 0,
    masterVolDb: -6,
    masterReverbWet: 1,
    masterDelayWet: 1,
    tracks,
    patterns: [p1, p2, p3],
    playlist: [
      { id: uid('b-'), patternId: p1.id, trackRow: 0, startStep: 0 },
      { id: uid('b-'), patternId: p1.id, trackRow: 0, startStep: 16 },
    ],
    activePatternId: p1.id,
    selectedTrackId: null,
    playMode: 'pattern',
    songLengthBars: 16,
  };
}

interface UIState {
  view: View;
  isPlaying: boolean;
  position: number; // current step (within pattern or song)
  cpuLoad: number; // 0..1
}

interface State {
  project: Project;
  ui: UIState;
}

type Listener = () => void;

class Store {
  state: State;
  listeners = new Set<Listener>();
  constructor(initial: State) {
    this.state = initial;
  }
  getState = (): State => this.state;
  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
  set = (updater: (s: State) => State) => {
    this.state = updater(this.state);
    this.listeners.forEach((l) => l());
  };
  setUI = (updater: (u: UIState) => UIState) =>
    this.set((s) => ({ ...s, ui: updater(s.ui) }));
  setProject = (updater: (p: Project) => Project) =>
    this.set((s) => ({ ...s, project: updater(s.project) }));
}

export const store = new Store({
  project: defaultProject(),
  ui: { view: 'channelRack', isPlaying: false, position: 0, cpuLoad: 0 },
});

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState())
  );
}

// ---------- actions ----------

export const actions = {
  setBpm: (bpm: number) =>
    store.setProject((p) => ({ ...p, bpm: Math.max(40, Math.min(300, bpm)) })),
  setMasterVol: (db: number) => store.setProject((p) => ({ ...p, masterVolDb: db })),
  setMasterReverbWet: (v: number) => store.setProject((p) => ({ ...p, masterReverbWet: v })),
  setMasterDelayWet: (v: number) => store.setProject((p) => ({ ...p, masterDelayWet: v })),
  setSwing: (s: number) => store.setProject((p) => ({ ...p, swing: s })),

  setView: (v: View) => store.setUI((u) => ({ ...u, view: v })),

  selectTrack: (id: string | null) =>
    store.setProject((p) => ({ ...p, selectedTrackId: id })),

  setActivePattern: (id: string) =>
    store.setProject((p) => ({ ...p, activePatternId: id })),

  togglePlay: () => {
    /* placeholder; engine handles actual playback */
  },

  toggleStep: (trackId: string, stepIdx: number) => {
    store.setProject((p) => {
      const patIdx = p.patterns.findIndex((pp) => pp.id === p.activePatternId);
      if (patIdx < 0) return p;
      const pat = p.patterns[patIdx];
      const arr = (pat.drumSteps[trackId] || []).slice();
      arr[stepIdx] = !arr[stepIdx];
      const newPat = {
        ...pat,
        drumSteps: { ...pat.drumSteps, [trackId]: arr },
      };
      const patterns = p.patterns.slice();
      patterns[patIdx] = newPat;
      return { ...p, patterns };
    });
  },

  clearStepsForTrack: (trackId: string) => {
    store.setProject((p) => {
      const patIdx = p.patterns.findIndex((pp) => pp.id === p.activePatternId);
      if (patIdx < 0) return p;
      const pat = p.patterns[patIdx];
      if (!pat.drumSteps[trackId]) return p;
      const newPat = {
        ...pat,
        drumSteps: { ...pat.drumSteps, [trackId]: new Array(pat.length).fill(false) },
      };
      const patterns = p.patterns.slice();
      patterns[patIdx] = newPat;
      return { ...p, patterns };
    });
  },

  setNotesForTrack: (trackId: string, notes: Note[]) => {
    store.setProject((p) => {
      const patIdx = p.patterns.findIndex((pp) => pp.id === p.activePatternId);
      if (patIdx < 0) return p;
      const pat = p.patterns[patIdx];
      const newPat = { ...pat, notes: { ...pat.notes, [trackId]: notes } };
      const patterns = p.patterns.slice();
      patterns[patIdx] = newPat;
      return { ...p, patterns };
    });
  },

  addNote: (trackId: string, note: Note) => {
    store.setProject((p) => {
      const patIdx = p.patterns.findIndex((pp) => pp.id === p.activePatternId);
      if (patIdx < 0) return p;
      const pat = p.patterns[patIdx];
      const list = (pat.notes[trackId] || []).concat(note);
      const newPat = { ...pat, notes: { ...pat.notes, [trackId]: list } };
      const patterns = p.patterns.slice();
      patterns[patIdx] = newPat;
      return { ...p, patterns };
    });
  },

  removeNote: (trackId: string, noteId: string) => {
    store.setProject((p) => {
      const patIdx = p.patterns.findIndex((pp) => pp.id === p.activePatternId);
      if (patIdx < 0) return p;
      const pat = p.patterns[patIdx];
      const list = (pat.notes[trackId] || []).filter((n) => n.id !== noteId);
      const newPat = { ...pat, notes: { ...pat.notes, [trackId]: list } };
      const patterns = p.patterns.slice();
      patterns[patIdx] = newPat;
      return { ...p, patterns };
    });
  },

  updateNote: (trackId: string, noteId: string, patch: Partial<Note>) => {
    store.setProject((p) => {
      const patIdx = p.patterns.findIndex((pp) => pp.id === p.activePatternId);
      if (patIdx < 0) return p;
      const pat = p.patterns[patIdx];
      const list = (pat.notes[trackId] || []).map((n) =>
        n.id === noteId ? { ...n, ...patch } : n
      );
      const newPat = { ...pat, notes: { ...pat.notes, [trackId]: list } };
      const patterns = p.patterns.slice();
      patterns[patIdx] = newPat;
      return { ...p, patterns };
    });
  },

  setTrack: (id: string, patch: Partial<Track>) => {
    store.setProject((p) => ({
      ...p,
      tracks: p.tracks.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },

  addInstrumentTrack: (kind: InstrumentKind) => {
    store.setProject((p) => {
      const t = defaultTrack('instrument', kind, p.tracks.length);
      const tracks = [...p.tracks, t];
      const patterns = p.patterns.map((pat) => ({
        ...pat,
        notes: { ...pat.notes, [t.id]: [] },
      }));
      return { ...p, tracks, patterns };
    });
  },

  addDrumTrack: (kind: DrumKind) => {
    store.setProject((p) => {
      const t = defaultTrack('drum', kind, p.tracks.length);
      const tracks = [...p.tracks, t];
      const patterns = p.patterns.map((pat) => ({
        ...pat,
        drumSteps: { ...pat.drumSteps, [t.id]: new Array(pat.length).fill(false) },
      }));
      return { ...p, tracks, patterns };
    });
  },

  removeTrack: (id: string) => {
    store.setProject((p) => {
      const tracks = p.tracks.filter((t) => t.id !== id);
      const patterns = p.patterns.map((pat) => {
        const drumSteps = { ...pat.drumSteps };
        delete drumSteps[id];
        const notes = { ...pat.notes };
        delete notes[id];
        return { ...pat, drumSteps, notes };
      });
      const selectedTrackId = p.selectedTrackId === id ? null : p.selectedTrackId;
      return { ...p, tracks, patterns, selectedTrackId };
    });
  },

  addPattern: () => {
    store.setProject((p) => {
      const length = 16;
      const drumSteps: Record<string, boolean[]> = {};
      const notes: Record<string, Note[]> = {};
      p.tracks.forEach((t) => {
        if (t.type === 'drum') drumSteps[t.id] = new Array(length).fill(false);
        else notes[t.id] = [];
      });
      const pat: Pattern = {
        id: uid('p-'),
        name: `Pattern ${p.patterns.length + 1}`,
        length,
        drumSteps,
        notes,
      };
      return { ...p, patterns: [...p.patterns, pat], activePatternId: pat.id };
    });
  },

  setPatternLength: (id: string, length: number) => {
    store.setProject((p) => {
      const patterns = p.patterns.map((pat) => {
        if (pat.id !== id) return pat;
        const drumSteps: Record<string, boolean[]> = {};
        Object.entries(pat.drumSteps).forEach(([k, arr]) => {
          const next = new Array(length).fill(false);
          for (let i = 0; i < Math.min(arr.length, length); i++) next[i] = arr[i];
          drumSteps[k] = next;
        });
        return { ...pat, length, drumSteps };
      });
      return { ...p, patterns };
    });
  },

  setPlayMode: (m: 'pattern' | 'song') =>
    store.setProject((p) => ({ ...p, playMode: m })),

  setPlaylistBlocks: (blocks: PlaylistBlock[]) =>
    store.setProject((p) => ({ ...p, playlist: blocks })),

  addPlaylistBlock: (b: PlaylistBlock) =>
    store.setProject((p) => ({ ...p, playlist: [...p.playlist, b] })),

  removePlaylistBlock: (id: string) =>
    store.setProject((p) => ({ ...p, playlist: p.playlist.filter((b) => b.id !== id) })),

  loadProject: (project: Project) => store.set((s) => ({ ...s, project })),
  setIsPlaying: (on: boolean) => store.setUI((u) => ({ ...u, isPlaying: on })),
  setPosition: (pos: number) => store.setUI((u) => ({ ...u, position: pos })),
};
