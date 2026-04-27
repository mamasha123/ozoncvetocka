import { useState } from 'react';
import { actions, uid, useStore } from '../state/store';
import type { PlaylistBlock } from '../state/types';
import { Trash2 } from 'lucide-react';

const STEP_PX = 12;
const ROW_H = 40;
const ROWS = 6;

export function Playlist() {
  const project = useStore((s) => s.project);
  const ui = useStore((s) => s.ui);
  const [selectedPatternId, setSelectedPatternId] = useState(project.activePatternId);
  const songSteps = project.songLengthBars * 16;

  const onCellClick = (rowIdx: number, step: number) => {
    const pat = project.patterns.find((p) => p.id === selectedPatternId);
    if (!pat) return;
    // snap to bar (16 steps)
    const startStep = Math.floor(step / 16) * 16;
    // remove conflicting block in same row that overlaps
    const filtered = project.playlist.filter((b) => {
      if (b.trackRow !== rowIdx) return true;
      const bp = project.patterns.find((p) => p.id === b.patternId);
      const len = bp?.length ?? 16;
      const overlaps = !(b.startStep + len <= startStep || b.startStep >= startStep + pat.length);
      return !overlaps;
    });
    const block: PlaylistBlock = {
      id: uid('b-'),
      patternId: pat.id,
      trackRow: rowIdx,
      startStep,
    };
    actions.setPlaylistBlocks([...filtered, block]);
  };

  return (
    <div className="flex-1 flex flex-col bg-neutral-900 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-950 border-b border-neutral-800">
        <span className="text-xs text-neutral-400">Paint pattern:</span>
        <select
          value={selectedPatternId}
          onChange={(e) => setSelectedPatternId(e.target.value)}
          className="bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-1 text-xs"
        >
          {project.patterns.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-neutral-500">
          Click cells to place • Right-click block to delete • Switch to SONG mode in toolbar to play
        </span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-neutral-400">Length (bars):</span>
          <input
            type="number"
            min={1}
            max={128}
            value={project.songLengthBars}
            onChange={(e) =>
              actions.loadProject({
                ...project,
                songLengthBars: Math.max(1, Math.min(128, parseInt(e.target.value) || 1)),
              })
            }
            className="w-16 bg-neutral-800 text-neutral-200 border border-neutral-700 rounded px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="relative" style={{ width: songSteps * STEP_PX + 100 }}>
          {/* bar ruler */}
          <div className="sticky top-0 z-10 flex bg-neutral-950 border-b border-neutral-800 h-7">
            <div className="w-[100px] flex items-center justify-center text-[10px] text-neutral-500 uppercase border-r border-neutral-800">
              Bars
            </div>
            <div className="relative flex-1">
              {Array.from({ length: project.songLengthBars }, (_, i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-l border-neutral-800 text-[10px] text-neutral-500 px-1"
                  style={{ left: i * 16 * STEP_PX, width: 16 * STEP_PX }}
                >
                  {i + 1}
                </div>
              ))}
            </div>
          </div>

          {/* rows */}
          {Array.from({ length: ROWS }, (_, rowIdx) => (
            <div
              key={rowIdx}
              className="flex border-b border-neutral-800"
              style={{ height: ROW_H }}
            >
              <div className="w-[100px] flex items-center justify-center text-xs text-neutral-400 bg-neutral-950 border-r border-neutral-800">
                Track {rowIdx + 1}
              </div>
              <div
                className="relative flex-1 cursor-crosshair"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const step = Math.floor(x / STEP_PX);
                  onCellClick(rowIdx, step);
                }}
              >
                {/* bar grid */}
                {Array.from({ length: project.songLengthBars }, (_, i) => (
                  <div
                    key={i}
                    className={`absolute top-0 bottom-0 border-l ${
                      i % 4 === 0 ? 'border-neutral-700' : 'border-neutral-800'
                    }`}
                    style={{ left: i * 16 * STEP_PX, width: 16 * STEP_PX }}
                  />
                ))}
                {/* blocks */}
                {project.playlist
                  .filter((b) => b.trackRow === rowIdx)
                  .map((b) => {
                    const pat = project.patterns.find((p) => p.id === b.patternId);
                    if (!pat) return null;
                    return (
                      <div
                        key={b.id}
                        onClick={(e) => e.stopPropagation()}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          actions.removePlaylistBlock(b.id);
                        }}
                        className="absolute top-1 bottom-1 rounded border border-amber-300/60 bg-gradient-to-b from-amber-400 to-amber-600 text-black text-[10px] font-bold px-1 shadow flex items-center justify-between cursor-pointer"
                        style={{
                          left: b.startStep * STEP_PX,
                          width: pat.length * STEP_PX - 2,
                        }}
                        title={`${pat.name} • bar ${Math.floor(b.startStep / 16) + 1}`}
                      >
                        <span className="truncate">{pat.name}</span>
                        <button
                          onClick={(ev) => {
                            ev.stopPropagation();
                            actions.removePlaylistBlock(b.id);
                          }}
                          className="ml-1 opacity-60 hover:opacity-100"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* playhead overlay */}
          {ui.isPlaying && project.playMode === 'song' && (
            <div
              className="absolute top-7 bottom-0 w-px bg-amber-300/80 pointer-events-none"
              style={{ left: 100 + ui.position * STEP_PX }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
