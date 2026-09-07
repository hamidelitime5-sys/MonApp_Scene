import React, { useRef, useState, useCallback } from 'react';

interface RotaryKnobProps {
  label: string;
  value: number; // Current value
  min?: number;
  max?: number;
  step?: number;
  defaultValue?: number;
  onChange: (value: number) => void;
  formatValue?: (val: number) => string;
  size?: 'sm' | 'md' | 'lg';
  color?: 'amber' | 'cyan' | 'purple' | 'emerald' | 'orange';
  unit?: string;
  className?: string;
}

export const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  defaultValue,
  onChange,
  formatValue,
  size = 'md',
  color = 'amber',
  unit = '',
  className = '',
}) => {
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startValRef = useRef(0);
  const [isHovered, setIsHovered] = useState(false);

  // Knob angular span: 270 degrees total (-135° to +135°)
  const startAngle = -135;
  const endAngle = 135;
  const totalAngle = endAngle - startAngle;

  const normalized = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const currentAngle = startAngle + normalized * totalAngle;

  // Colors mapping
  const colorMap = {
    amber: {
      arc: '#f59e0b',
      glow: 'rgba(245, 158, 11, 0.6)',
      notch: '#fbbf24',
    },
    cyan: {
      arc: '#06b6d4',
      glow: 'rgba(6, 182, 212, 0.6)',
      notch: '#38bdf8',
    },
    purple: {
      arc: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.6)',
      notch: '#c084fc',
    },
    emerald: {
      arc: '#10b981',
      glow: 'rgba(16, 185, 129, 0.6)',
      notch: '#34d399',
    },
    orange: {
      arc: '#f97316',
      glow: 'rgba(249, 115, 22, 0.6)',
      notch: '#fb923c',
    },
  };

  const activeColor = colorMap[color] || colorMap.amber;

  // Dimensions based on size
  const dim = size === 'sm' ? 36 : size === 'lg' ? 56 : 44;
  const strokeWidth = size === 'sm' ? 3 : 4;
  const radius = dim / 2 - strokeWidth;
  const center = dim / 2;

  // Circumference for SVG dasharray
  const circumference = 2 * Math.PI * radius;
  const arcLength = (totalAngle / 360) * circumference;
  const activeLength = normalized * arcLength;

  // Mouse / Pointer handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    isDraggingRef.current = true;
    startYRef.current = e.clientY;
    startValRef.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaY = startYRef.current - e.clientY;
    const range = max - min;
    // 150px drag distance for full range
    const change = (deltaY / 150) * range;
    let nextVal = startValRef.current + change;
    nextVal = Math.max(min, Math.min(max, nextVal));
    if (step) {
      nextVal = Math.round(nextVal / step) * step;
    }
    onChange(Number(nextVal.toFixed(2)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDraggingRef.current) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      isDraggingRef.current = false;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const direction = e.deltaY < 0 ? 1 : -1;
    const change = (step || (max - min) / 100) * direction;
    const nextVal = Math.max(min, Math.min(max, value + change));
    onChange(Number(nextVal.toFixed(2)));
  };

  const handleDoubleClick = () => {
    if (defaultValue !== undefined) {
      onChange(defaultValue);
    }
  };

  const formattedDisplay = formatValue
    ? formatValue(value)
    : `${Math.round(value)}${unit}`;

  return (
    <div
      className={`flex flex-col items-center select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      title={`${label}: ${formattedDisplay} (Glissez ou molette, double-clic pour réinitialiser)`}
    >
      {/* Label */}
      <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1 truncate max-w-[56px] text-center">
        {label}
      </span>

      {/* Hardware Knob Dial */}
      <div
        className="relative cursor-ns-resize touch-none flex items-center justify-center group"
        style={{ width: dim, height: dim }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
      >
        {/* Background Radial Arc & Active LED Arc */}
        <svg
          width={dim}
          height={dim}
          viewBox={`0 0 ${dim} ${dim}`}
          className="absolute inset-0 -rotate-90 pointer-events-none"
        >
          {/* Base Inactive Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#27272a"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={-((360 - totalAngle) / 2 / 360) * circumference}
            strokeLinecap="round"
          />

          {/* Active LED Colored Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={activeColor.arc}
            strokeWidth={strokeWidth}
            strokeDasharray={`${activeLength} ${circumference}`}
            strokeDashoffset={-((360 - totalAngle) / 2 / 360) * circumference}
            strokeLinecap="round"
            style={{
              filter: isHovered ? `drop-shadow(0 0 4px ${activeColor.glow})` : undefined,
            }}
          />
        </svg>

        {/* Center Metal Knob Cap */}
        <div
          className="rounded-full flex items-center justify-center shadow-lg transition-transform"
          style={{
            width: dim - strokeWidth * 3.5,
            height: dim - strokeWidth * 3.5,
            background: 'radial-gradient(circle at 35% 35%, #3f3f46 0%, #27272a 60%, #18181b 100%)',
            border: '1px solid #52525b',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.25), 0 3px 5px rgba(0,0,0,0.7)',
            transform: `rotate(${currentAngle}deg)`,
          }}
        >
          {/* Hardware Grip Notch / Pointer Indicator */}
          <div
            className="w-1 rounded-full absolute top-1"
            style={{
              height: size === 'sm' ? 6 : 8,
              backgroundColor: activeColor.notch,
              boxShadow: `0 0 6px ${activeColor.glow}`,
            }}
          />
        </div>
      </div>

      {/* Numerical Value Readout */}
      <span className="text-[10px] font-mono font-bold mt-1 text-zinc-300 dark:text-zinc-400 bg-zinc-950/80 px-1 py-0.2 rounded border border-zinc-800">
        {formattedDisplay}
      </span>
    </div>
  );
};
