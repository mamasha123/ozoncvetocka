import React, { useEffect, useMemo, useRef, useState } from 'react';
import { actions, uid, useStore } from '../state/store';
import { getEngine } from '../audio/engine';
import type { Note } from '../state/types';
import { Trash2 } from 'lucide-react';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const KEY_TO_SEMITONE: Record<string, number> = {
  KeyZ: 0,
  KeyS: 1,
  KeyX: 2,
  KeyD: 3,
  KeyC: 4,
  KeyV: 5,
  KeyG: 6,
  KeyB: 7,
  KeyH: 8,
  KeyN: 9,
  KeyJ: 10,
  KeyM: 11,
  KeyQ: 12,
  Digit2: 13,
  KeyW: 14,
  Digit3: 15,
  KeyE: 16,
  KeyR: 17,
  Digit5: 18,
  KeyT: 19,
  Digit6: 20,
  KeyY: 21,
  Digit7: 22,
  KeyU: 23,
  KeyI: 24,
};

function midiToName(midi: number): string {
  const oct = Math.floor(midi / 12) - 1;
  return `${NOTE_NAMES[midi % 12]}${oct}`;
}

const KEY_HEIGHT = 16;
const STEP_WIDTH = 28;

export function PianoRoll() {
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  const pat = project.patterns.find((p) => p.id === project.activePatternId);
  const instTracks = project.tracks.filter((t) => t.type === 'instrument');
  const initialTrackId =
    project.selectedTrackId && instTracks.some((t) => t.id === project.selectedTrackId)
      ? project.selectedTrackId
      : instTracks[0]?.id ?? null;

  const [trackId, setTrackId] = useState<string | null>(initialTrackId);
  useEffect(() => {
    if (
      project.selectedTrackId &&
      project.tracks.find((t) => t.id === project.selectedTrackId)?.type === 'instrument'
    ) {
      setTrackId(project.selectedTrackId);
    } else if (!trackId && instTracks[0]) {
      setTrackId(instTracks[0].id);
    }
  }, [project.selectedTrackId, instTracks, project.tracks, trackId]);

  const lowPitch = 24; // C1
  const highPitch = 96; // C7
  const pitches = useMemo(() => {
    const arr: number[] = [];
    for (let p = highPitch; p >= lowPitch; p--) arr.push(p);
    return arr;
  }, []);

  const gridRef = useRef<HTMLDivElement>(null);
  const [octaveBase, setOctaveBase] = useState(48); // C3 by default for keyboard input
  const [draggingNoteId, setDraggingNoteId] = useState<string | null>(null);
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const [drawingNote, setDrawingNote] = useState<Note | null>(null);

  const track = project.tracks.find((t) => t.id === trackId);
  const notes = pat && trackId ? pat.notes[trackId] || [] : [];

  // scroll center to middle on mount
  useEffect(() => {
    if (gridRef.current) {
      const totalH = pitches.length * KEY_HEIGHT;
      gridRef.current.scrollTop = totalH / 2 - 200;
    }
  }, [pitches.length]);

  // Keyboard play (musical typing)
  useEffect(() => {
    if (!trackId) return;
    const downSet = new Set<number>();
    const onDown = async (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'SELECT')
        return;
      if (e.code === 'KeyZ' && e.ctrlKey) return;
      const semi = KEY_TO_SEMITONE[e.code];
      if (semi === undefined) return;
      const pitch = octaveBase + semi;
      if (downSet.has(pitch)) return;
      downSet.add(pitch);
      const engine = getEngine();
      await engine.ensureStarted();
      engine.noteOn(trackId, pitch, 0.9);
    };
    const onUp = (e: KeyboardEvent) => {
      const semi = KEY_TO_SEMITONE[e.code];
      if (semi === undefined) return;
      const pitch = octaveBase + semi;
      downSet.delete(pitch);
      getEngine().noteOff(trackId, pitch);
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, [trackId, octaveBase]);

  if (!pat || !track || !trackId) {
    return (
      <div className="flex-1 p-8 text-neutral-400">
        No instrument tracks. Add one from the Channel Rack.
      </div>
    );
  }

  const totalSteps = pat.length;

  const onGridMouseDown = async (e: React.MouseEvent) => {
    if (!gridRef.current || e.button !== 0) return;
    const target = e.target as HTMLElement;
    // ignore if click is on existing note (handled separately)
    if (target.dataset.note) return;
    const rect = gridRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left + gridRef.current.scrollLeft;
    const y = e.clientY - rect.top + gridRef.current.scrollTop;
    const step = Math.max(0, Math.min(totalSteps - 1, Math.floor(x / STEP_WIDTH)));
    const pitchIdx = Math.floor(y / KEY_HEIGHT);
    const pitch = pitches[pitchIdx];
    if (pitch === undefined) return;

    const note: Note = {
      id: uid('n-'),
      pitch,
      start: step,
      duration: 1,
      velocity: 0.9,
    };
    actions.addNote(trackId, note);
    setDrawingNote(note);
    const engine = getEngine();
    await engine.ensureStarted();
    engine.noteOn(trackId, pitch, 0.9);

    const onMove = (ev: MouseEvent) => {
      if (!gridRef.current) return;
      const rect2 = gridRef.current.getBoundingClientRect();
      const xx = ev.clientX - rect2.left + gridRef.current.scrollLeft;
      const endStep = Math.max(step + 1, Math.min(totalSteps, Math.ceil(xx / STEP_WIDTH)));
      actions.updateNote(trackId, note.id, { duration: endStep - step });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDrawingNote(null);
      engine.noteOff(trackId, pitch);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const onNoteMouseDown = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    if (e.button === 2 || e.altKey) {
      actions.removeNote(trackId, note.id);
      return;
    }
    if (!gridRef.current) return;
    const startX = e.clientX;
    const origStart = note.start;
    const origPitch = note.pitch;
    const origDuration = note.duration;
    // resize if near right edge
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const isResize = e.clientX > rect.right - 6;
    if (isResize) setResizingNoteId(note.id);
    else setDraggingNoteId(note.id);

    const startY = e.clientY;
    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (isResize) {
        const stepsDelta = Math.round(dx / STEP_WIDTH);
        actions.updateNote(trackId, note.id, {
          duration: Math.max(1, origDuration + stepsDelta),
        });
      } else {
        const stepsDelta = Math.round(dx / STEP_WIDTH);
        const pitchDelta = -Math.round(dy / KEY_HEIGHT);
        const newStart = Math.max(0, Math.min(totalSteps - 1, origStart + stepsDelta));
        const newPitch = Math.max(lowPitch, Math.min(highPitch, origPitch + pitchDelta));
        actions.updateNote(trackId, note.id, { start: newStart, pitch: newPitch });
      }
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDraggingNoteId(null);
      setResizingNoteId(null);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const widthPx = totalSteps * STEP_WIDTH;
  const totalH = pitches.length * KEY_HEIGHT;

  return (
    <div className="flex-1 flex flex-col bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-950 border-b border-neutral-800">
        <span className="text-xs text-neutral-400">Track:</span>
        <select
          value={trackId}
          onChange={(e) => {
            setTrackId(e.target.value);
            actions.selectTrack(e.target.value);
          }}
          className="bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-1 text-xs"
        >
          {instTracks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500 ml-3">
          Click empty space to draw notes • Drag to move • Right-click or Alt+click to delete • Drag right edge to resize
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-neutral-400">Keyboard octave:</span>
          <button
            onClick={() => setOctaveBase((o) => Math.max(0, o - 12))}
            className="px-2 py-0.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded"
          >
            -
          </button>
          <span className="text-xs text-amber-400 font-mono">{midiToName(octaveBase)}</span>
          <button
            onClick={() => setOctaveBase((o) => Math.min(108, o + 12))}
            className="px-2 py-0.5 text-xs bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded"
          >
            +
          </button>
          <button
            onClick={() => {
              if (confirm('Clear all notes in this track?')) actions.setNotesForTrack(trackId, []);
            }}
            className="px-2 py-1 text-xs bg-neutral-800 hover:bg-red-700 border border-neutral-700 rounded text-neutral-300 flex items-center gap-1"
          >
            <Trash2 size={12} /> Clear
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* keys */}
        <div className="w-14 bg-neutral-950 border-r border-neutral-800 overflow-hidden relative">
          <div
            style={{ height: totalH }}
            className="relative"
            ref={(el) => {
              if (el && gridRef.current) {
                el.scrollTop = gridRef.current.scrollTop;
              }
            }}
          >
            {pitches.map((p, i) => {
              const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
              const isC = p % 12 === 0;
              return (
                <div
                  key={p}
                  onMouseDown={async () => {
                    const eng = getEngine();
                    await eng.ensureStarted();
                    eng.noteOn(trackId, p);
                    const onUp = () => {
                      eng.noteOff(trackId, p);
                      window.removeEventListener('mouseup', onUp);
                    };
                    window.addEventListener('mouseup', onUp);
                  }}
                  className={`absolute left-0 right-0 flex items-center justify-end pr-1 cursor-pointer text-[9px] font-mono ${
                    isBlack
                      ? 'bg-neutral-900 text-neutral-500 border-b border-neutral-800'
                      : 'bg-neutral-100 text-neutral-700 border-b border-neutral-300'
                  }`}
                  style={{ top: i * KEY_HEIGHT, height: KEY_HEIGHT }}
                >
                  {isC ? midiToName(p) : ''}
                </div>
              );
            })}
          </div>
        </div>

        {/* grid */}
        <div
          ref={gridRef}
          className="flex-1 overflow-auto relative"
          onMouseDown={onGridMouseDown}
          onContextMenu={(e) => e.preventDefault()}
          style={{ cursor: drawingNote || draggingNoteId || resizingNoteId ? 'grabbing' : 'crosshair' }}
        >
          <div className="relative" style={{ width: widthPx, height: totalH }}>
            {/* row backgrounds */}
            {pitches.map((p, i) => {
              const isBlack = [1, 3, 6, 8, 10].includes(p % 12);
              return (
                <div
                  key={p}
                  className={`absolute left-0 right-0 ${
                    isBlack ? 'bg-neutral-900/70' : 'bg-neutral-800/40'
                  } border-b border-neutral-800`}
                  style={{ top: i * KEY_HEIGHT, height: KEY_HEIGHT, width: widthPx }}
                />
              );
            })}
            {/* vertical step lines */}
            {Array.from({ length: totalSteps + 1 }, (_, i) => (
              <div
                key={i}
                className={`absolute top-0 bottom-0 ${
                  i % 16 === 0
                    ? 'bg-neutral-700'
                    : i % 4 === 0
                      ? 'bg-neutral-700/60'
                      : 'bg-neutral-800'
                }`}
                style={{ left: i * STEP_WIDTH, width: i % 4 === 0 ? 1 : 1 }}
              />
            ))}
            {/* notes */}
            {notes.map((n) => {
              const pitchIdx = highPitch - n.pitch;
              return (
                <div
                  key={n.id}
                  data-note={n.id}
                  onMouseDown={(e) => onNoteMouseDown(e, n)}
                  className="absolute rounded-sm border border-amber-200/80 cursor-grab active:cursor-grabbing"
                  style={{
                    top: pitchIdx * KEY_HEIGHT + 1,
                    left: n.start * STEP_WIDTH,
                    width: n.duration * STEP_WIDTH - 1,
                    height: KEY_HEIGHT - 2,
                    backgroundColor: track.color,
                    boxShadow: `0 1px 4px ${track.color}55, inset 0 -3px 4px rgba(0,0,0,0.3)`,
                  }}
                  title={`${midiToName(n.pitch)} • step ${n.start} • len ${n.duration}`}
                >
                  <div className="absolute top-0 right-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-white/30" />
                </div>
              );
            })}
            {/* playhead */}
            {ui.isPlaying && (
              <div
                className="absolute top-0 bottom-0 w-px bg-amber-300/90 pointer-events-none"
                style={{ left: ui.position * STEP_WIDTH }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
