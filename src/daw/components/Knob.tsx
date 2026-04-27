import { useEffect, useRef, useState } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  size?: number;
  label?: string;
  format?: (v: number) => string;
  onChange: (v: number) => void;
  bidirectional?: boolean; // start at center
  log?: boolean;
}

export function Knob({
  value,
  min,
  max,
  step = 0.01,
  size = 36,
  label,
  format,
  onChange,
  bidirectional = false,
  log = false,
}: KnobProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startV = useRef(value);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dy = startY.current - e.clientY;
      const range = max - min;
      const next = Math.max(
        min,
        Math.min(max, startV.current + (dy / 150) * range * (e.shiftKey ? 0.2 : 1))
      );
      const snapped = step ? Math.round(next / step) * step : next;
      onChange(Math.max(min, Math.min(max, snapped)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, max, min, onChange, step]);

  const ratio = log
    ? Math.log(Math.max(value, 0.0001) / Math.max(min, 0.0001)) /
      Math.log(Math.max(max, 0.0001) / Math.max(min, 0.0001))
    : (value - min) / (max - min);

  // angle from -135 to 135
  const angle = bidirectional
    ? (ratio - 0.5) * 270
    : -135 + ratio * 270;

  return (
    <div className="flex flex-col items-center select-none">
      <div
        ref={ref}
        className="relative cursor-ns-resize"
        style={{ width: size, height: size }}
        onMouseDown={(e) => {
          startY.current = e.clientY;
          startV.current = value;
          setDragging(true);
        }}
        onDoubleClick={() => onChange(bidirectional ? (max + min) / 2 : min)}
        title={format ? format(value) : value.toFixed(2)}
      >
        <svg width={size} height={size} viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="#1a1a1a" stroke="#333" strokeWidth="2" />
          <circle cx="50" cy="50" r="38" fill="#0f0f0f" stroke="#444" strokeWidth="1" />
          {/* tick range */}
          <path
            d="M 22 78 A 40 40 0 1 1 78 78"
            fill="none"
            stroke="#2a2a2a"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* active arc */}
          <path
            d={describeArc(50, 50, 40, -135, angle)}
            fill="none"
            stroke="#ffb84d"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {/* indicator */}
          <line
            x1="50"
            y1="50"
            x2={50 + 28 * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={50 + 28 * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke="#ffd58a"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </div>
      {label && (
        <div className="text-[9px] text-gray-400 mt-0.5 uppercase tracking-wide">{label}</div>
      )}
    </div>
  );
}

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx: number, cy: number, r: number, start: number, end: number) {
  if (Math.abs(end - start) < 0.001) return '';
  const s = polar(cx, cy, r, end);
  const e = polar(cx, cy, r, start);
  const large = Math.abs(end - start) > 180 ? 1 : 0;
  return `M ${e.x} ${e.y} A ${r} ${r} 0 ${large} 1 ${s.x} ${s.y}`;
}

interface FaderProps {
  value: number;
  min: number;
  max: number;
  height?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}
export function Fader({ value, min, max, height = 110, onChange, format }: FaderProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const startY = useRef(0);
  const startV = useRef(value);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const dy = startY.current - e.clientY;
      const range = max - min;
      const next = startV.current + (dy / height) * range;
      onChange(Math.max(min, Math.min(max, next)));
    };
    const onUp = () => setDragging(false);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, max, min, onChange, height]);

  const ratio = (value - min) / (max - min);
  return (
    <div
      ref={ref}
      className="relative w-6 bg-neutral-900 rounded border border-neutral-700 cursor-ns-resize"
      style={{ height }}
      onMouseDown={(e) => {
        startY.current = e.clientY;
        startV.current = value;
        setDragging(true);
      }}
      onDoubleClick={() => onChange(0)}
      title={format ? format(value) : value.toFixed(1)}
    >
      <div
        className="absolute left-0 right-0 bg-amber-400/40 rounded-b"
        style={{ bottom: 0, height: `${ratio * 100}%` }}
      />
      <div
        className="absolute left-[-4px] right-[-4px] h-3 bg-neutral-300 border border-neutral-600 rounded-sm shadow-md"
        style={{ bottom: `calc(${ratio * 100}% - 6px)` }}
      />
    </div>
  );
}
