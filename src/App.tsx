import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Box,
  Braces,
  Camera,
  Cpu,
  Gauge,
  Layers,
  Maximize2,
  Move3D,
  Play,
  Radar,
  RotateCcw,
  RotateCw,
  Save,
  Square,
  Target,
  Wand2,
  Zap,
} from 'lucide-react';

type ArmPose = {
  base: number;
  shoulder: number;
  elbow: number;
  wristPitch: number;
  wristRoll: number;
  claw: number;
  lift: number;
  reach: number;
};

type CameraPose = {
  yaw: number;
  pitch: number;
  zoom: number;
};

type TargetPoint = {
  x: number;
  y: number;
  z: number;
};

type Keyframe = ArmPose & {
  id: number;
};

type SliderSpec = {
  key: keyof ArmPose;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
};

type ToggleKey = 'grid' | 'axes' | 'measurements' | 'ghost' | 'safety';

const initialPose: ArmPose = {
  base: -24,
  shoulder: 38,
  elbow: -42,
  wristPitch: 16,
  wristRoll: 0,
  claw: 62,
  lift: 14,
  reach: 100,
};

const initialCamera: CameraPose = {
  yaw: -35,
  pitch: 64,
  zoom: 1,
};

const presets: Record<string, ArmPose> = {
  Home: initialPose,
  Scan: { base: 42, shoulder: 24, elbow: -28, wristPitch: 8, wristRoll: -28, claw: 78, lift: 18, reach: 92 },
  Pick: { base: 11, shoulder: 57, elbow: -68, wristPitch: -20, wristRoll: 4, claw: 18, lift: 6, reach: 108 },
  Lift: { base: 11, shoulder: 28, elbow: -38, wristPitch: 8, wristRoll: 4, claw: 18, lift: 34, reach: 108 },
  Drop: { base: -58, shoulder: 34, elbow: -46, wristPitch: -6, wristRoll: 32, claw: 82, lift: 24, reach: 96 },
};

const sliders: SliderSpec[] = [
  { key: 'base', label: 'Base yaw', unit: '°', min: -180, max: 180, step: 1 },
  { key: 'shoulder', label: 'Shoulder', unit: '°', min: -30, max: 82, step: 1 },
  { key: 'elbow', label: 'Elbow', unit: '°', min: -110, max: 72, step: 1 },
  { key: 'wristPitch', label: 'Wrist pitch', unit: '°', min: -90, max: 90, step: 1 },
  { key: 'wristRoll', label: 'Wrist roll', unit: '°', min: -180, max: 180, step: 1 },
  { key: 'claw', label: 'Claw open', unit: '%', min: 0, max: 100, step: 1 },
  { key: 'lift', label: 'Z lift', unit: 'cm', min: 0, max: 52, step: 1 },
  { key: 'reach', label: 'Reach scale', unit: '%', min: 70, max: 126, step: 1 },
];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const toRad = (value: number) => (value * Math.PI) / 180;

function calcTelemetry(pose: ArmPose, target: TargetPoint) {
  const link1 = 168 * (pose.reach / 100);
  const link2 = 136 * (pose.reach / 100);
  const shoulder = toRad(pose.shoulder);
  const elbow = toRad(pose.shoulder + pose.elbow);
  const planar = Math.cos(shoulder) * link1 + Math.cos(elbow) * link2 + 36;
  const vertical = Math.sin(shoulder) * link1 + Math.sin(elbow) * link2 + pose.lift * 2.2 + 52;
  const yaw = toRad(pose.base);
  const x = Math.cos(yaw) * planar;
  const y = Math.sin(yaw) * planar;
  const z = vertical;
  const distance = Math.sqrt((x - target.x) ** 2 + (y - target.y) ** 2 + (z - target.z) ** 2);
  const load = clamp(22 + Math.abs(pose.shoulder) * 0.26 + Math.abs(pose.elbow) * 0.18 + (100 - pose.claw) * 0.22, 0, 100);
  const torque = clamp((Math.abs(pose.shoulder) + Math.abs(pose.elbow) + Math.abs(pose.wristPitch)) / 2.35, 0, 100);
  const precision = clamp(100 - distance / 3.2 - Math.abs(pose.wristRoll) / 6, 0, 100);

  return { x, y, z, distance, load, torque, precision, canGrab: distance < 86 && pose.claw < 36 };
}

function solveTarget(target: TargetPoint, current: ArmPose): ArmPose {
  const base = Math.round((Math.atan2(target.y, target.x) * 180) / Math.PI);
  const planar = clamp(Math.sqrt(target.x ** 2 + target.y ** 2), 110, 326);
  const height = clamp(target.z - 82, -70, 210);
  const shoulder = clamp(Math.round(18 + height / 5.2 + (260 - planar) / 8.5), -30, 82);
  const elbow = clamp(Math.round(-76 + (planar - 150) / 4.4 - height / 13), -110, 72);
  const wristPitch = clamp(Math.round(-shoulder - elbow / 2), -90, 90);

  return { ...current, base, shoulder, elbow, wristPitch };
}

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-2xl border border-slate-700/70 bg-slate-900/70 p-4 shadow-xl shadow-black/20">
      <div className="text-xs uppercase tracking-[0.25em] text-slate-500">{label}</div>
      <div className={`mt-2 text-2xl font-black ${tone}`}>{value}</div>
    </div>
  );
}

function RangeControl({ spec, value, onChange }: { spec: SliderSpec; value: number; onChange: (key: keyof ArmPose, value: number) => void }) {
  return (
    <label className="block rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-slate-200">{spec.label}</span>
        <span className="rounded-lg border border-cyan-400/25 bg-cyan-400/10 px-2 py-1 font-mono text-xs text-cyan-200">
          {value}{spec.unit}
        </span>
      </div>
      <input
        aria-label={spec.label}
        type="range"
        min={spec.min}
        max={spec.max}
        step={spec.step}
        value={value}
        onChange={(event) => onChange(spec.key, Number(event.target.value))}
        className="w-full accent-cyan-400"
      />
    </label>
  );
}

function MiniCube({ grabbed }: { grabbed: boolean }) {
  return (
    <div className={`cube ${grabbed ? 'cube-grabbed' : ''}`}>
      <span className="cube-face cube-front" />
      <span className="cube-face cube-back" />
      <span className="cube-face cube-right" />
      <span className="cube-face cube-left" />
      <span className="cube-face cube-top" />
      <span className="cube-face cube-bottom" />
    </div>
  );
}

function RobotArmScene({
  pose,
  camera,
  target,
  telemetry,
  toggles,
  grabbed,
}: {
  pose: ArmPose;
  camera: CameraPose;
  target: TargetPoint;
  telemetry: ReturnType<typeof calcTelemetry>;
  toggles: Record<ToggleKey, boolean>;
  grabbed: boolean;
}) {
  const lowerArmStyle = {
    width: `${168 * (pose.reach / 100)}px`,
    transform: `rotateZ(${-pose.shoulder}deg)`,
  };
  const upperArmStyle = {
    width: `${136 * (pose.reach / 100)}px`,
    transform: `rotateZ(${-pose.elbow}deg)`,
  };
  const wristStyle = {
    transform: `rotateZ(${-pose.wristPitch}deg) rotateX(${pose.wristRoll}deg)`,
  };
  const clawGap = 16 + pose.claw * 0.38;
  const cubeStyle = grabbed
    ? { transform: `translate3d(${telemetry.x * 0.28}px, ${-telemetry.z * 0.38 - 18}px, ${telemetry.y * 0.18}px) rotateX(-18deg) rotateY(${pose.base}deg)` }
    : { transform: `translate3d(${target.x * 0.28}px, ${-target.z * 0.38}px, ${target.y * 0.18}px) rotateX(-18deg) rotateY(38deg)` };

  return (
    <div className="relative min-h-[620px] overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_50%_15%,rgba(34,211,238,0.22),transparent_34%),linear-gradient(145deg,#07111f,#020617_58%,#031b2e)] p-5 shadow-2xl shadow-cyan-950/50">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-200">
            <Cpu size={18} />
            <span className="text-xs uppercase tracking-[0.35em]">CAD robot lab</span>
          </div>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-5xl">Mechanical Robot Arm</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            6-DOF симулятор манипулятора с 3D-ориентацией, захватом кубика, IK-наведением, телеметрией и CAD-слоями.
          </p>
        </div>
        <div className="hidden rounded-2xl border border-emerald-400/25 bg-emerald-400/10 px-4 py-3 text-right md:block">
          <div className="text-xs uppercase tracking-[0.3em] text-emerald-200">System</div>
          <div className="mt-1 font-mono text-xl font-black text-emerald-300">ONLINE</div>
        </div>
      </div>

      <div
        className="robot-viewport relative z-10 mx-auto mt-6 h-[500px] max-w-5xl"
        style={{ perspective: `${980 / camera.zoom}px` }}
      >
        <div
          className="robot-world absolute inset-0"
          style={{ transform: `rotateX(${camera.pitch}deg) rotateZ(${camera.yaw}deg) scale(${camera.zoom})` }}
        >
          {toggles.grid && <div className="cad-floor" />}
          {toggles.axes && (
            <div className="axes">
              <span className="axis axis-x">X</span>
              <span className="axis axis-y">Y</span>
              <span className="axis axis-z">Z</span>
            </div>
          )}
          {toggles.safety && <div className="safety-zone" />}
          {toggles.ghost && <div className="ghost-arc" />}

          <div className="target-marker" style={{ transform: `translate3d(${target.x * 0.28}px, ${-target.z * 0.38}px, ${target.y * 0.18}px)` }}>
            <Target size={18} />
          </div>
          <div className="cube-holder" style={cubeStyle}>
            <MiniCube grabbed={grabbed} />
          </div>

          <div className="robot-rig" style={{ transform: `translate3d(0, ${-pose.lift * 2.4}px, 0) rotateZ(${pose.base}deg)` }}>
            <div className="base-shadow" />
            <div className="robot-base">
              <div className="base-ring" />
              <div className="base-column" />
            </div>
            <div className="shoulder-joint joint" />
            <div className="arm-segment lower-arm" style={lowerArmStyle}>
              <span className="beam-highlight" />
              <span className="measurement-tag">L1</span>
              <div className="elbow-joint joint" />
              <div className="arm-segment upper-arm" style={upperArmStyle}>
                <span className="beam-highlight" />
                <span className="measurement-tag">L2</span>
                <div className="wrist-joint joint" />
                <div className="wrist" style={wristStyle}>
                  <div className="tool-head" />
                  <div className="claw claw-left" style={{ transform: `translateY(${-clawGap}px) rotateZ(${-14 - pose.claw / 6}deg)` }} />
                  <div className="claw claw-right" style={{ transform: `translateY(${clawGap}px) rotateZ(${14 + pose.claw / 6}deg)` }} />
                </div>
              </div>
            </div>
          </div>

          {toggles.measurements && (
            <div className="measurement-overlay">
              <span>EEF X {telemetry.x.toFixed(0)}</span>
              <span>Y {telemetry.y.toFixed(0)}</span>
              <span>Z {telemetry.z.toFixed(0)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [pose, setPose] = useState<ArmPose>(initialPose);
  const [camera, setCamera] = useState<CameraPose>(initialCamera);
  const [target, setTarget] = useState<TargetPoint>({ x: 208, y: 42, z: 82 });
  const [grabbed, setGrabbed] = useState(false);
  const [autoDemo, setAutoDemo] = useState(false);
  const [keyframes, setKeyframes] = useState<Keyframe[]>([]);
  const [toggles, setToggles] = useState<Record<ToggleKey, boolean>>({
    grid: true,
    axes: true,
    measurements: true,
    ghost: true,
    safety: true,
  });

  const telemetry = useMemo(() => calcTelemetry(pose, target), [pose, target]);

  useEffect(() => {
    if (!autoDemo) return;
    const sequence = Object.values(presets);
    let index = 0;
    const interval = window.setInterval(() => {
      setPose(sequence[index % sequence.length]);
      setGrabbed(index % sequence.length === 2 || index % sequence.length === 3);
      index += 1;
    }, 1300);
    return () => window.clearInterval(interval);
  }, [autoDemo]);

  useEffect(() => {
    if (!grabbed && telemetry.canGrab) setGrabbed(true);
    if (grabbed && pose.claw > 68) setGrabbed(false);
  }, [grabbed, pose.claw, telemetry.canGrab]);

  const updatePose = (key: keyof ArmPose, value: number) => {
    setPose((current) => ({ ...current, [key]: value }));
  };

  const updateTarget = (key: keyof TargetPoint, value: number) => {
    setTarget((current) => ({ ...current, [key]: value }));
  };

  const saveKeyframe = () => {
    setKeyframes((current) => [...current, { ...pose, id: Date.now() }].slice(-8));
  };

  const playKeyframes = () => {
    keyframes.forEach((frame, index) => {
      window.setTimeout(() => setPose(frame), index * 650);
    });
  };

  const exportConfig = () => {
    const payload = JSON.stringify({ pose, camera, target, keyframes }, null, 2);
    void navigator.clipboard?.writeText(payload);
  };

  const applyPreset = (name: string) => {
    setAutoDemo(false);
    setPose(presets[name]);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 md:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.65fr_0.9fr]">
          <RobotArmScene pose={pose} camera={camera} target={target} telemetry={telemetry} toggles={toggles} grabbed={grabbed} />

          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-5 shadow-2xl shadow-black/30 backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                  <Move3D size={16} /> Controls
                </p>
                <h2 className="mt-2 text-2xl font-black text-white">Joint parameters</h2>
              </div>
              <button
                onClick={() => setAutoDemo((value) => !value)}
                className={`rounded-2xl px-4 py-3 text-sm font-black transition ${autoDemo ? 'bg-rose-500 text-white' : 'bg-cyan-400 text-slate-950 hover:bg-cyan-300'}`}
              >
                {autoDemo ? <Square className="inline" size={16} /> : <Play className="inline" size={16} />} Auto
              </button>
            </div>

            <div className="mt-5 grid gap-3">
              {sliders.map((spec) => (
                <div key={spec.key}>
                  <RangeControl spec={spec} value={pose[spec.key]} onChange={updatePose} />
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr_0.9fr]">
          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-amber-300">
              <Target size={16} /> Inverse kinematics
            </p>
            <h2 className="mt-2 text-xl font-black text-white">Target cube</h2>
            <div className="mt-5 space-y-4">
              {(['x', 'y', 'z'] as const).map((axis) => (
                <label key={axis} className="block">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="uppercase text-slate-400">{axis} target</span>
                    <span className="font-mono text-amber-200">{target[axis]} mm</span>
                  </div>
                  <input
                    type="range"
                    min={axis === 'z' ? 40 : -280}
                    max={axis === 'z' ? 260 : 280}
                    value={target[axis]}
                    onChange={(event) => updateTarget(axis, Number(event.target.value))}
                    className="w-full accent-amber-300"
                  />
                </label>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setPose((current) => solveTarget(target, current))} className="rounded-2xl bg-amber-300 px-4 py-3 font-black text-slate-950 hover:bg-amber-200">
                <Wand2 className="inline" size={16} /> Aim IK
              </button>
              <button onClick={() => setGrabbed((value) => !value)} className="rounded-2xl border border-amber-300/30 bg-amber-300/10 px-4 py-3 font-bold text-amber-100 hover:bg-amber-300/20">
                {grabbed ? 'Release' : 'Grab'} cube
              </button>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-violet-300">
              <Camera size={16} /> CAD viewport
            </p>
            <h2 className="mt-2 text-xl font-black text-white">3D orientation</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label>
                <div className="mb-2 text-sm text-slate-400">Camera yaw</div>
                <input type="range" min="-180" max="180" value={camera.yaw} onChange={(event) => setCamera((current) => ({ ...current, yaw: Number(event.target.value) }))} className="w-full accent-violet-300" />
              </label>
              <label>
                <div className="mb-2 text-sm text-slate-400">Camera pitch</div>
                <input type="range" min="35" max="78" value={camera.pitch} onChange={(event) => setCamera((current) => ({ ...current, pitch: Number(event.target.value) }))} className="w-full accent-violet-300" />
              </label>
              <label>
                <div className="mb-2 text-sm text-slate-400">Zoom</div>
                <input type="range" min="0.72" max="1.28" step="0.01" value={camera.zoom} onChange={(event) => setCamera((current) => ({ ...current, zoom: Number(event.target.value) }))} className="w-full accent-violet-300" />
              </label>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
              {(Object.keys(toggles) as ToggleKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setToggles((current) => ({ ...current, [key]: !current[key] }))}
                  className={`rounded-2xl border px-3 py-3 text-sm font-bold capitalize transition ${toggles[key] ? 'border-violet-300/50 bg-violet-300/20 text-violet-100' : 'border-slate-700 bg-slate-950 text-slate-500'}`}
                >
                  {key}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-emerald-300">
              <Radar size={16} /> Telemetry
            </p>
            <h2 className="mt-2 text-xl font-black text-white">Live status</h2>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <StatCard label="Distance" value={`${telemetry.distance.toFixed(0)}mm`} tone={telemetry.canGrab ? 'text-emerald-300' : 'text-amber-300'} />
              <StatCard label="Grip" value={grabbed ? 'LOCK' : `${pose.claw}%`} tone={grabbed ? 'text-emerald-300' : 'text-cyan-300'} />
              <StatCard label="Torque" value={`${telemetry.torque.toFixed(0)}%`} tone="text-rose-300" />
              <StatCard label="Precision" value={`${telemetry.precision.toFixed(0)}%`} tone="text-violet-300" />
            </div>
          </section>
        </div>

        <section className="rounded-[2rem] border border-slate-800 bg-slate-900/80 p-5 shadow-xl shadow-black/20">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-cyan-300">
                <Layers size={16} /> Functions
              </p>
              <h2 className="mt-2 text-xl font-black text-white">Presets, path recording & export</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(presets).map((name) => (
                <button key={name} onClick={() => applyPreset(name)} className="rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 py-2 text-sm font-bold text-cyan-100 hover:bg-cyan-300/20">
                  {name}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-5">
            <button onClick={saveKeyframe} className="rounded-2xl bg-emerald-400 px-4 py-3 font-black text-slate-950 hover:bg-emerald-300">
              <Save className="inline" size={16} /> Save frame
            </button>
            <button disabled={keyframes.length === 0} onClick={playKeyframes} className="rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 font-bold text-emerald-100 disabled:opacity-40">
              <Play className="inline" size={16} /> Play path
            </button>
            <button onClick={() => setPose(initialPose)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-slate-200 hover:bg-slate-800">
              <RotateCcw className="inline" size={16} /> Reset arm
            </button>
            <button onClick={() => setCamera(initialCamera)} className="rounded-2xl border border-slate-700 bg-slate-950 px-4 py-3 font-bold text-slate-200 hover:bg-slate-800">
              <Maximize2 className="inline" size={16} /> Reset view
            </button>
            <button onClick={exportConfig} className="rounded-2xl border border-violet-300/30 bg-violet-300/10 px-4 py-3 font-bold text-violet-100 hover:bg-violet-300/20">
              <Braces className="inline" size={16} /> Copy JSON
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <Gauge className="mb-3 text-cyan-300" />
              <h3 className="font-black">Collision assistant</h3>
              <p className="mt-2 text-sm text-slate-400">Safety radius and distance warnings show when the cube is in grab range.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <Box className="mb-3 text-amber-300" />
              <h3 className="font-black">Smart gripper</h3>
              <p className="mt-2 text-sm text-slate-400">Closing the claw near the cube attaches it to the end effector automatically.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <RotateCw className="mb-3 text-violet-300" />
              <h3 className="font-black">CAD orbit camera</h3>
              <p className="mt-2 text-sm text-slate-400">Rotate yaw/pitch and zoom the scene like a compact CAD workstation.</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <Zap className="mb-3 text-emerald-300" />
              <h3 className="font-black">Automation</h3>
              <p className="mt-2 text-sm text-slate-400">Use presets, auto-demo and recorded keyframes for pick-and-place sequences.</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
