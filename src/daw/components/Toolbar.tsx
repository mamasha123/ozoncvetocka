import { useEffect, useState } from 'react';
import { actions, useStore } from '../state/store';
import { getEngine } from '../audio/engine';
import { Play, Square, Music2, Disc3, Sliders, ListMusic, Save, Upload, Download } from 'lucide-react';

export function Toolbar() {
  const ui = useStore((s) => s.ui);
  const project = useStore((s) => s.project);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const togglePlay = async () => {
    const engine = getEngine();
    await engine.ensureStarted();
    if (ui.isPlaying) engine.stopTransport();
    else engine.startTransport();
  };

  const onExport = async () => {
    setExporting(true);
    try {
      const engine = getEngine();
      await engine.ensureStarted();
      const blob = await engine.renderToWav();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const mode = project.playMode === 'song' ? 'song' : 'pattern';
      a.download = `daw-export-${mode}-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('Export failed: ' + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  const onSave = () => {
    const data = JSON.stringify(project, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daw-project-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onLoad = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = async () => {
      const f = input.files?.[0];
      if (!f) return;
      const text = await f.text();
      try {
        const project = JSON.parse(text);
        actions.loadProject(project);
      } catch (e) {
        alert('Invalid project file');
      }
    };
    input.click();
  };

  const NavBtn = ({ view, icon: Icon, label }: { view: any; icon: any; label: string }) => (
    <button
      onClick={() => actions.setView(view)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold tracking-wide uppercase border transition-colors ${
        ui.view === view
          ? 'bg-amber-500 text-black border-amber-400 shadow-[0_0_12px_rgba(255,180,80,0.5)]'
          : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:bg-neutral-700'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-b from-neutral-900 to-neutral-950 border-b border-neutral-800 shadow-md">
      <div className="flex items-center gap-1 mr-2">
        <div className="text-amber-400 font-black text-xl tracking-tighter italic">FRUITY DAW</div>
        <div className="text-[9px] text-neutral-500 uppercase ml-1 mt-2">browser edition</div>
      </div>

      <button
        onClick={togglePlay}
        className={`flex items-center justify-center w-10 h-10 rounded ${
          ui.isPlaying
            ? 'bg-red-500 hover:bg-red-400'
            : 'bg-emerald-500 hover:bg-emerald-400'
        } text-white shadow-md`}
        title={ui.isPlaying ? 'Stop (Space)' : 'Play (Space)'}
      >
        {ui.isPlaying ? <Square size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>

      {/* BPM */}
      <div className="flex flex-col items-center bg-black/60 rounded border border-neutral-700 px-3 py-1 min-w-[80px]">
        <div className="text-[9px] text-neutral-500 uppercase tracking-wider">BPM</div>
        <input
          type="number"
          min={40}
          max={300}
          value={project.bpm}
          onChange={(e) => actions.setBpm(parseFloat(e.target.value) || project.bpm)}
          className="w-16 bg-transparent text-amber-400 text-xl font-bold text-center font-mono outline-none"
        />
      </div>

      {/* Position */}
      <div className="flex flex-col items-center bg-black/60 rounded border border-neutral-700 px-3 py-1 min-w-[120px]">
        <div className="text-[9px] text-neutral-500 uppercase tracking-wider">Position</div>
        <div className="text-amber-400 font-mono text-lg tabular-nums">
          {String(Math.floor(ui.position / 16) + 1).padStart(2, '0')}
          <span className="text-neutral-600">:</span>
          {String(Math.floor((ui.position % 16) / 4) + 1).padStart(2, '0')}
          <span className="text-neutral-600">:</span>
          {String((ui.position % 4) + 1).padStart(2, '0')}
        </div>
      </div>

      {/* Mode toggle */}
      <div className="flex bg-neutral-800 rounded overflow-hidden border border-neutral-700">
        <button
          onClick={() => actions.setPlayMode('pattern')}
          className={`px-3 py-1.5 text-xs font-semibold ${
            project.playMode === 'pattern' ? 'bg-amber-500 text-black' : 'text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          PAT
        </button>
        <button
          onClick={() => actions.setPlayMode('song')}
          className={`px-3 py-1.5 text-xs font-semibold ${
            project.playMode === 'song' ? 'bg-amber-500 text-black' : 'text-neutral-300 hover:bg-neutral-700'
          }`}
        >
          SONG
        </button>
      </div>

      {/* Pattern picker */}
      <select
        value={project.activePatternId}
        onChange={(e) => actions.setActivePattern(e.target.value)}
        className="bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-1 text-xs"
      >
        {project.patterns.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => actions.addPattern()}
        className="px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300"
      >
        + Pattern
      </button>

      <div className="ml-auto flex items-center gap-2">
        <NavBtn view="channelRack" icon={Disc3} label="Channels" />
        <NavBtn view="pianoRoll" icon={Music2} label="Piano" />
        <NavBtn view="mixer" icon={Sliders} label="Mixer" />
        <NavBtn view="playlist" icon={ListMusic} label="Playlist" />

        <div className="w-px h-6 bg-neutral-700 mx-1" />

        <button
          onClick={onSave}
          title="Save project (.json)"
          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300"
        >
          <Save size={14} />
        </button>
        <button
          onClick={onLoad}
          title="Load project"
          className="px-2 py-1.5 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300"
        >
          <Upload size={14} />
        </button>
        <button
          onClick={onExport}
          disabled={exporting}
          title="Export to WAV"
          className={`flex items-center gap-1 px-2 py-1.5 rounded text-xs font-semibold border ${
            exporting
              ? 'bg-neutral-700 text-neutral-400 border-neutral-700 cursor-wait'
              : 'bg-amber-500 hover:bg-amber-400 text-black border-amber-400'
          }`}
        >
          <Download size={14} />
          {exporting ? 'Rendering…' : 'WAV'}
        </button>
      </div>
    </div>
  );
}
