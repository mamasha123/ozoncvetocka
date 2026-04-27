import type { FC } from 'react';
import { actions, useStore } from '../state/store';
import { Knob, Fader } from './Knob';
import type { Track } from '../state/types';

function dbFmt(db: number) {
  if (db <= -59.99) return '-∞';
  return `${db.toFixed(1)} dB`;
}

const ChannelStrip: FC<{ track: Track }> = ({ track }) => {
  return (
    <div className="flex flex-col items-center gap-1 px-2 py-2 bg-gradient-to-b from-neutral-900 to-neutral-950 border-r border-neutral-800 min-w-[88px]">
      <div className="text-[10px] text-neutral-300 font-bold truncate w-full text-center">{track.name}</div>
      <div
        className="w-full h-1 rounded-full"
        style={{ backgroundColor: track.color, boxShadow: `0 0 6px ${track.color}aa` }}
      />
      <div className="grid grid-cols-2 gap-x-1 gap-y-1 mt-1">
        <Knob
          value={track.pan}
          min={-1}
          max={1}
          size={28}
          label="PAN"
          bidirectional
          format={(v) => (Math.abs(v) < 0.05 ? 'C' : v > 0 ? `R${Math.round(v * 100)}` : `L${Math.round(-v * 100)}`)}
          onChange={(v) => actions.setTrack(track.id, { pan: v })}
        />
        <Knob
          value={track.filterCutoff}
          min={80}
          max={20000}
          size={28}
          label="CUT"
          log
          format={(v) => `${v.toFixed(0)}Hz`}
          onChange={(v) => actions.setTrack(track.id, { filterCutoff: v })}
        />
        <Knob
          value={track.filterRes}
          min={0}
          max={15}
          size={28}
          label="RES"
          format={(v) => v.toFixed(1)}
          onChange={(v) => actions.setTrack(track.id, { filterRes: v })}
        />
        <Knob
          value={track.distortion}
          min={0}
          max={1}
          size={28}
          label="DIST"
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => actions.setTrack(track.id, { distortion: v })}
        />
        <Knob
          value={track.reverbSend}
          min={0}
          max={1}
          size={28}
          label="REV"
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => actions.setTrack(track.id, { reverbSend: v })}
        />
        <Knob
          value={track.delaySend}
          min={0}
          max={1}
          size={28}
          label="DLY"
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => actions.setTrack(track.id, { delaySend: v })}
        />
      </div>

      <div className="flex flex-col items-center mt-1">
        <Fader
          value={track.volumeDb}
          min={-60}
          max={6}
          height={140}
          format={dbFmt}
          onChange={(v) => actions.setTrack(track.id, { volumeDb: v })}
        />
        <div className="text-[10px] text-neutral-400 font-mono mt-1">{dbFmt(track.volumeDb)}</div>
      </div>

      <div className="flex gap-1 mt-1">
        <button
          onClick={() => actions.setTrack(track.id, { mute: !track.mute })}
          className={`px-1.5 py-0.5 text-[9px] font-bold border rounded ${
            track.mute
              ? 'bg-amber-500 text-black border-amber-400'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'
          }`}
        >
          M
        </button>
        <button
          onClick={() => actions.setTrack(track.id, { solo: !track.solo })}
          className={`px-1.5 py-0.5 text-[9px] font-bold border rounded ${
            track.solo
              ? 'bg-emerald-500 text-black border-emerald-400'
              : 'bg-neutral-800 text-neutral-400 border-neutral-700 hover:bg-neutral-700'
          }`}
        >
          S
        </button>
      </div>
    </div>
  );
};

function MasterStrip() {
  const project = useStore((s) => s.project);
  return (
    <div className="flex flex-col items-center gap-1 px-3 py-2 bg-gradient-to-b from-amber-950/40 to-neutral-950 border-r-2 border-amber-700 min-w-[110px]">
      <div className="text-xs text-amber-400 font-bold tracking-wider">MASTER</div>
      <div className="grid grid-cols-2 gap-1 mt-1">
        <Knob
          value={project.masterReverbWet}
          min={0}
          max={1}
          size={32}
          label="REVERB"
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => actions.setMasterReverbWet(v)}
        />
        <Knob
          value={project.masterDelayWet}
          min={0}
          max={1}
          size={32}
          label="DELAY"
          format={(v) => `${Math.round(v * 100)}%`}
          onChange={(v) => actions.setMasterDelayWet(v)}
        />
      </div>
      <Fader
        value={project.masterVolDb}
        min={-60}
        max={6}
        height={170}
        format={dbFmt}
        onChange={(v) => actions.setMasterVol(v)}
      />
      <div className="text-[10px] text-amber-300 font-mono">{dbFmt(project.masterVolDb)}</div>
    </div>
  );
}

export function Mixer() {
  const project = useStore((s) => s.project);
  return (
    <div className="flex-1 flex bg-neutral-900 overflow-x-auto">
      <MasterStrip />
      {project.tracks.map((t) => (
        <ChannelStrip key={t.id} track={t} />
      ))}
    </div>
  );
}
