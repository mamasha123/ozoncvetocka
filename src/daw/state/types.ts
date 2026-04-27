export type DrumKind =
  | 'kick'
  | 'snare'
  | 'clap'
  | 'closedHat'
  | 'openHat'
  | 'tom'
  | 'crash'
  | 'perc';

export type InstrumentKind =
  | 'lead'
  | 'bass'
  | 'pad'
  | 'pluck'
  | 'keys'
  | 'fmBass';

export type TrackType = 'drum' | 'instrument';

export interface Track {
  id: string;
  name: string;
  type: TrackType;
  drumKind?: DrumKind;
  instrumentKind?: InstrumentKind;
  color: string;
  // mixer
  volumeDb: number; // -60..6
  pan: number; // -1..1
  mute: boolean;
  solo: boolean;
  reverbSend: number; // 0..1
  delaySend: number; // 0..1
  filterCutoff: number; // 20..20000 Hz
  filterRes: number; // 0..20
  distortion: number; // 0..1
}

export interface Note {
  id: string;
  pitch: number; // MIDI 0..127
  start: number; // in 16th-note steps
  duration: number; // in 16th-note steps (>=1)
  velocity: number; // 0..1
}

export interface Pattern {
  id: string;
  name: string;
  length: number; // total length in 16th steps (default 16)
  // drum step grids: trackId -> bool[length]
  drumSteps: Record<string, boolean[]>;
  // instrument notes per track
  notes: Record<string, Note[]>;
}

export interface PlaylistBlock {
  id: string;
  patternId: string;
  trackRow: number; // playlist row index (0..N)
  startStep: number; // start in 16th steps
  // length is derived from pattern length
}

export type PlayMode = 'pattern' | 'song';

export interface Project {
  bpm: number;
  swing: number; // 0..1
  masterVolDb: number; // -60..6
  masterReverbWet: number; // 0..1
  masterDelayWet: number; // 0..1
  tracks: Track[];
  patterns: Pattern[];
  playlist: PlaylistBlock[];
  activePatternId: string;
  selectedTrackId: string | null;
  playMode: PlayMode;
  songLengthBars: number;
}

export type View = 'channelRack' | 'pianoRoll' | 'mixer' | 'playlist';
