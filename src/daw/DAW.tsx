import { useEffect, useState } from 'react';
import { useStore } from './state/store';
import { getEngine } from './audio/engine';
import { Toolbar } from './components/Toolbar';
import { ChannelRack } from './components/ChannelRack';
import { PianoRoll } from './components/PianoRoll';
import { Mixer } from './components/Mixer';
import { Playlist } from './components/Playlist';

export function DAW() {
  const ui = useStore((s) => s.ui);
  const project = useStore((s) => s.project);
  const [audioReady, setAudioReady] = useState(false);

  // keep engine synced with project state
  useEffect(() => {
    const engine = getEngine();
    engine.syncTracks(project);
  }, [project]);

  const startAudio = async () => {
    const engine = getEngine();
    await engine.ensureStarted();
    engine.syncTracks(project);
    setAudioReady(true);
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-950 text-neutral-100 font-sans select-none">
      <Toolbar />
      {!audioReady && <AudioGate onStart={startAudio} />}
      <div className="flex-1 overflow-hidden">
        {ui.view === 'channelRack' && <ChannelRack />}
        {ui.view === 'pianoRoll' && <PianoRoll />}
        {ui.view === 'mixer' && <Mixer />}
        {ui.view === 'playlist' && <Playlist />}
      </div>
      <StatusBar />
    </div>
  );
}

function AudioGate({ onStart }: { onStart: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
      onClick={onStart}
    >
      <div className="bg-gradient-to-b from-neutral-800 to-neutral-950 border-2 border-amber-500 rounded-2xl p-10 max-w-md text-center shadow-[0_0_60px_rgba(251,191,36,0.3)]">
        <div className="text-amber-400 text-4xl font-black italic tracking-tighter mb-2">FRUITY DAW</div>
        <div className="text-neutral-400 text-sm mb-6">Browser DAW · Powered by Web Audio</div>
        <button
          className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-3 rounded-lg shadow-lg text-lg"
          onClick={onStart}
        >
          ▶ Start Audio
        </button>
        <div className="text-xs text-neutral-500 mt-4">
          Click anywhere to enable audio (browser autoplay policy)
        </div>
        <div className="text-[11px] text-neutral-600 mt-4 leading-relaxed">
          Space — Play/Stop · Z X C V… — Play notes · Channel Rack steps for drums · Piano Roll for melodies · Mixer for FX · Playlist for arrangement · WAV export
        </div>
      </div>
    </div>
  );
}

function StatusBar() {
  const ui = useStore((s) => s.ui);
  const project = useStore((s) => s.project);
  const pat = project.patterns.find((p) => p.id === project.activePatternId);
  return (
    <div className="flex items-center gap-4 px-3 py-1 bg-neutral-950 border-t border-neutral-800 text-[10px] text-neutral-400">
      <span>
        Tracks: <span className="text-neutral-200">{project.tracks.length}</span>
      </span>
      <span>
        Patterns: <span className="text-neutral-200">{project.patterns.length}</span>
      </span>
      <span>
        Mode: <span className="text-amber-400 uppercase">{project.playMode}</span>
      </span>
      <span>
        Active: <span className="text-neutral-200">{pat?.name ?? '—'}</span>
      </span>
      <span>
        Step: <span className="text-amber-400 font-mono">{ui.position + 1}</span>
      </span>
      <span className="ml-auto">{ui.isPlaying ? '● PLAYING' : '○ STOPPED'}</span>
    </div>
  );
}
