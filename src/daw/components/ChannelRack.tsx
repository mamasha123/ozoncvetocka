import { actions, useStore } from '../state/store';
import { getEngine } from '../audio/engine';
import { Trash2, Plus } from 'lucide-react';
import { useState } from 'react';
import type { DrumKind, InstrumentKind } from '../state/types';

const DRUM_OPTIONS: DrumKind[] = ['kick', 'snare', 'clap', 'closedHat', 'openHat', 'tom', 'crash', 'perc'];
const INST_OPTIONS: InstrumentKind[] = ['lead', 'bass', 'pad', 'pluck', 'keys', 'fmBass'];

export function ChannelRack() {
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  const pat = project.patterns.find((p) => p.id === project.activePatternId);
  const [showAdd, setShowAdd] = useState(false);

  if (!pat) return null;

  const onPreview = async (trackId: string) => {
    const engine = getEngine();
    await engine.ensureStarted();
    engine.preview(trackId);
  };

  const handleStepClick = async (trackId: string, stepIdx: number) => {
    actions.toggleStep(trackId, stepIdx);
    const engine = getEngine();
    await engine.ensureStarted();
    // audition
    const pat2 = useStore.length;
    void pat2;
    const isOn = !pat.drumSteps[trackId]?.[stepIdx];
    if (isOn) engine.preview(trackId);
  };

  return (
    <div className="flex-1 overflow-auto p-4 bg-neutral-900">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-amber-400">Channel Rack — {pat.name}</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">Steps:</span>
          <select
            value={pat.length}
            onChange={(e) => actions.setPatternLength(pat.id, parseInt(e.target.value))}
            className="bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-1 text-xs"
          >
            {[16, 32, 64].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            onClick={() => setShowAdd((s) => !s)}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded text-neutral-300"
          >
            <Plus size={12} /> Add channel
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="mb-3 flex flex-wrap gap-2 p-3 bg-neutral-950 border border-neutral-800 rounded">
          <span className="text-xs text-neutral-400 mr-2 self-center">Drums:</span>
          {DRUM_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => {
                actions.addDrumTrack(d);
                setShowAdd(false);
              }}
              className="px-2 py-1 text-xs bg-neutral-800 hover:bg-amber-500 hover:text-black border border-neutral-700 rounded"
            >
              {d}
            </button>
          ))}
          <span className="text-xs text-neutral-400 mx-2 self-center">Instruments:</span>
          {INST_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => {
                actions.addInstrumentTrack(d);
                setShowAdd(false);
              }}
              className="px-2 py-1 text-xs bg-neutral-800 hover:bg-amber-500 hover:text-black border border-neutral-700 rounded"
            >
              {d}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1">
        {project.tracks.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-2 bg-neutral-950 border rounded ${
              project.selectedTrackId === t.id ? 'border-amber-500' : 'border-neutral-800'
            }`}
          >
            <div
              className="flex items-center gap-2 px-2 py-1.5 min-w-[170px] cursor-pointer hover:bg-neutral-900"
              onClick={() => actions.selectTrack(t.id)}
              onDoubleClick={() => onPreview(t.id)}
            >
              <div
                className="w-3 h-8 rounded-sm"
                style={{ backgroundColor: t.color, boxShadow: `0 0 8px ${t.color}66` }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm text-neutral-200 font-semibold truncate">{t.name}</div>
                <div className="text-[10px] text-neutral-500 uppercase">
                  {t.type === 'drum' ? t.drumKind : t.instrumentKind}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete ${t.name}?`)) actions.removeTrack(t.id);
                }}
                className="p-1 text-neutral-500 hover:text-red-400"
                title="Delete channel"
              >
                <Trash2 size={12} />
              </button>
            </div>

            {/* steps or piano-roll preview */}
            {t.type === 'drum' ? (
              <div className="flex gap-[2px] flex-1 overflow-x-auto py-1 pr-2">
                {(pat.drumSteps[t.id] || []).map((on, i) => {
                  const isPlaying = ui.isPlaying && ui.position === i;
                  const beatStart = i % 4 === 0;
                  const halfBar = i % 8 === 0;
                  return (
                    <button
                      key={i}
                      onClick={() => handleStepClick(t.id, i)}
                      className={`w-7 h-9 rounded-sm border transition-colors ${
                        on
                          ? 'border-amber-300'
                          : halfBar
                            ? 'border-neutral-600'
                            : beatStart
                              ? 'border-neutral-700'
                              : 'border-neutral-800'
                      } ${
                        on
                          ? ''
                          : halfBar
                            ? 'bg-neutral-800'
                            : beatStart
                              ? 'bg-neutral-850 bg-neutral-800/70'
                              : 'bg-neutral-900'
                      } ${isPlaying ? 'ring-2 ring-amber-300/80' : ''}`}
                      style={
                        on
                          ? {
                              backgroundColor: t.color,
                              boxShadow: `inset 0 -6px 8px rgba(0,0,0,0.45), 0 0 6px ${t.color}88`,
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            ) : (
              <div className="flex-1 py-1 pr-2">
                <InstrumentPreview trackId={t.id} length={pat.length} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function InstrumentPreview({ trackId, length }: { trackId: string; length: number }) {
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  const pat = project.patterns.find((p) => p.id === project.activePatternId);
  if (!pat) return null;
  const notes = pat.notes[trackId] || [];
  const t = project.tracks.find((tr) => tr.id === trackId);
  const minPitch = notes.length ? Math.min(...notes.map((n) => n.pitch)) : 48;
  const maxPitch = notes.length ? Math.max(...notes.map((n) => n.pitch)) : 72;
  const pitchRange = Math.max(8, maxPitch - minPitch + 4);
  const baseLow = Math.max(0, minPitch - 2);

  return (
    <div
      className="relative bg-neutral-900 border border-neutral-800 rounded h-9 cursor-pointer overflow-hidden"
      onClick={() => actions.setView('pianoRoll') /* jump to piano roll */}
      onDoubleClick={() => actions.setView('pianoRoll')}
      title="Click to open Piano Roll"
    >
      {/* beat grid */}
      {Array.from({ length }, (_, i) => (
        <div
          key={i}
          className={`absolute top-0 bottom-0 ${i % 4 === 0 ? 'border-l border-neutral-700' : ''}`}
          style={{ left: `${(i / length) * 100}%`, width: `${100 / length}%` }}
        />
      ))}
      {/* notes */}
      {notes.map((n) => {
        const left = (n.start / length) * 100;
        const width = (n.duration / length) * 100;
        const top = ((pitchRange - (n.pitch - baseLow)) / pitchRange) * 100;
        return (
          <div
            key={n.id}
            className="absolute h-1 rounded"
            style={{
              left: `${left}%`,
              width: `${Math.max(1, width)}%`,
              top: `${top}%`,
              backgroundColor: t?.color || '#fbbf24',
              boxShadow: `0 0 4px ${t?.color || '#fbbf24'}`,
            }}
          />
        );
      })}
      {ui.isPlaying && (
        <div
          className="absolute top-0 bottom-0 w-px bg-amber-300/80"
          style={{ left: `${(ui.position / length) * 100}%` }}
        />
      )}
    </div>
  );
}
