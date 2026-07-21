import React, { useState, useEffect, useMemo } from 'react';
import { usePreferences } from '../../providers/PreferencesProvider';

/**
 * LiveClock — an always-updating clock widget for the Dashboard header.
 *
 * Three faces driven by PreferencesProvider.clockFace:
 *  - 'digital' : HH:mm:ss with pulsing colon + date
 *  - 'analog'  : SVG analogue clock with rotating hands + smooth sweep
 *  - 'minimal' : HH:mm compact badge, no seconds, no date
 */

function now() { return new Date(); }

function pad2(n) { return String(n).padStart(2, '0'); }

/* ── Sub-components ──────────────────────────────────────────── */

function DigitalClock({ time, accentHex, reduceMotion }) {
  const hh = pad2(time.getHours());
  const mm = pad2(time.getMinutes());
  const ss = pad2(time.getSeconds());
  return (
    <div className="flex items-center gap-2 select-none" title={`${hh}:${mm}:${ss}`}>
      <span className="text-[28px] font-black tracking-tight text-slate-800 tabular-nums leading-none">
        {hh}
      </span>
      <span className={`text-[28px] font-black transition-opacity ${reduceMotion ? '' : 'animate-pulse'} tabular-nums leading-none`} style={{ color: accentHex, animationDuration: '1s' }}>
        :
      </span>
      <span className="text-[28px] font-black tracking-tight text-slate-800 tabular-nums leading-none">
        {mm}
      </span>
      <span className="text-[15px] font-bold tracking-tight tabular-nums leading-none self-start mt-1" style={{ color: accentHex }}>
        {ss}
      </span>
    </div>
  );
}

function AnalogClock({ time, accentHex, reduceMotion }) {
  const h = time.getHours() % 12;
  const m = time.getMinutes();
  const s = time.getSeconds();
  const ms = time.getMilliseconds();

  // Smooth sweep: milliseconds supplement seconds for continuous second-hand
  const secondAngle = (s + ms / 1000) * 6; // 360° / 60 = 6° per sec
  const minuteAngle = m * 6 + s * 0.1;     // 6° + 0.1° per second
  const hourAngle = h * 30 + m * 0.5;      // 30° + 0.5° per minute

  const cx = 42, cy = 42, r = 36;

  // Tick marks
  const ticks = [];
  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const x1 = cx + (r - 5) * Math.cos(angle);
    const y1 = cy + (r - 5) * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />);
  }

  const handStyle = (angle, length, color, width) => ({
    transform: `rotate(${angle}deg)`,
    transformOrigin: '42px 42px',
    transition: reduceMotion ? 'none' : angle === 0 ? 'none' : 'transform 0.05s linear',
  });

  return (
    <svg viewBox="0 0 84 84" className="w-12 h-12 drop-shadow-sm" title={`${pad2(time.getHours())}:${pad2(m)}:${pad2(s)}`}>
      {/* Face */}
      <circle cx={cx} cy={cy} r={r} fill="white" stroke="#e2e8f0" strokeWidth="2" />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r="2.5" fill="#1e293b" />
      {ticks}
      {/* Hour hand */}
      <line
        x1={cx} y1={cy}
        x2={cx} y2={cy - r * 0.48}
        stroke="#334155"
        strokeWidth="3"
        strokeLinecap="round"
        style={handStyle(hourAngle, r * 0.48)}
      />
      {/* Minute hand */}
      <line
        x1={cx} y1={cy}
        x2={cx} y2={cy - r * 0.72}
        stroke="#475569"
        strokeWidth="2"
        strokeLinecap="round"
        style={handStyle(minuteAngle, r * 0.72)}
      />
      {/* Second hand */}
      <line
        x1={cx - r * 0.18} y1={cy}
        x2={cx} y2={cy - r * 0.82}
        stroke={accentHex}
        strokeWidth="1.5"
        strokeLinecap="round"
        style={handStyle(secondAngle, r * 0.82)}
      />
    </svg>
  );
}

function MinimalClock({ time, accentHex }) {
  const hh = pad2(time.getHours());
  const mm = pad2(time.getMinutes());
  return (
    <span
      className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black tabular-nums"
      style={{ backgroundColor: `${accentHex}12`, color: accentHex, border: `1px solid ${accentHex}30` }}
      title={`${hh}:${mm}`}
    >
      <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="8" cy="8" r="6.5" />
        <line x1="8" y1="8" x2="8" y2="4.5" />
        <line x1="8" y1="8" x2="10.5" y2="8" />
      </svg>
      {hh}:{mm}
    </span>
  );
}

/* ── Main component ──────────────────────────────────────────── */

export default function LiveClock() {
  const { prefs, accentHex } = usePreferences();
  const [time, setTime] = useState(now());

  useEffect(() => {
    const id = setInterval(() => setTime(now()), 200); // 5 fps for smooth second hand
    return () => clearInterval(id);
  }, []);

  const face = prefs.clockFace || 'digital';
  const reduceMotion = prefs.reduceMotion || false;

  const FaceComponent = useMemo(() => {
    switch (face) {
      case 'analog': return AnalogClock;
      case 'minimal': return MinimalClock;
      default: return DigitalClock;
    }
  }, [face]);

  return (
    <div className="flex items-center shrink-0">
      <FaceComponent time={time} accentHex={accentHex} reduceMotion={reduceMotion} />
    </div>
  );
}
