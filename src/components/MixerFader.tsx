import React, { useRef } from 'react';

interface MixerFaderProps {
  value: number; // e.g. 0 to 1.5 (0% to 150%)
  min?: number;
  max?: number;
  step?: number;
  onChange: (val: number) => void;
  orientation?: 'horizontal' | 'vertical';
  isSounding?: boolean;
  label?: string;
  className?: string;
}

export const MixerFader: React.FC<MixerFaderProps> = ({
  value,
  min = 0,
  max = 1.5,
  step = 0.05,
  onChange,
  orientation = 'horizontal',
  isSounding = false,
  label,
  className = '',
}) => {
  const normalized = Math.min(1, Math.max(0, (value - min) / (max - min)));
  const percentage = Math.round(value * 100);

  if (orientation === 'vertical') {
    return (
      <div className={`flex flex-col items-center select-none ${className}`}>
        {label && (
          <span className="text-[9px] font-black uppercase tracking-wider text-zinc-400 mb-1">
            {label}
          </span>
        )}

        {/* Fader Track & VU Meter Container */}
        <div className="flex items-center gap-1.5 h-32 py-1">
          {/* LED VU Meter Bar (Green -> Yellow -> Orange -> Red) */}
          <div className="w-1.5 h-full bg-zinc-950 rounded-full overflow-hidden flex flex-col justify-end p-0.5 border border-zinc-800">
            <div
              className={`w-full rounded-full transition-all duration-75 ${
                isSounding
                  ? normalized > 0.8
                    ? 'bg-gradient-to-t from-emerald-500 via-amber-500 to-red-500 shadow-sm shadow-red-500/50'
                    : normalized > 0.5
                    ? 'bg-gradient-to-t from-emerald-500 to-amber-500 shadow-sm shadow-amber-500/50'
                    : 'bg-emerald-500 shadow-sm shadow-emerald-500/50'
                  : 'bg-zinc-800'
              }`}
              style={{ height: `${normalized * 100}%` }}
            />
          </div>

          {/* Vertical Hardware Slider */}
          <div className="relative h-full flex items-center justify-center">
            {/* Background slot */}
            <div className="w-1.5 h-full rounded-full bg-zinc-950 border border-zinc-800 shadow-inner" />

            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={value}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              style={{
                writingMode: 'vertical-lr',
                direction: 'rtl',
              }}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />

            {/* Hardware Fader Cap */}
            <div
              className="absolute w-6 h-4 pointer-events-none rounded hardware-fader-cap"
              style={{
                bottom: `calc(${normalized * 100}% - 8px)`,
              }}
            />
          </div>
        </div>

        {/* Value Readout */}
        <span className="text-[10px] font-mono font-bold text-zinc-300 bg-zinc-950 px-1 py-0.5 rounded border border-zinc-800 mt-1">
          {percentage}%
        </span>
      </div>
    );
  }

  // Horizontal Fader (Compact horizontal channel strip)
  return (
    <div className={`flex items-center gap-2 select-none ${className}`}>
      {label && (
        <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider w-6">
          {label}
        </span>
      )}

      {/* Hardware Fader Track */}
      <div className="relative flex-1 h-6 flex items-center">
        {/* Recessed Hardware Slot */}
        <div className="w-full h-2 rounded-full hardware-fader-slot border border-zinc-800 relative overflow-hidden">
          {/* Internal LED Level Bar */}
          <div
            className={`h-full transition-all duration-75 ${
              normalized > 0.75
                ? 'bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500'
                : normalized > 0.4
                ? 'bg-gradient-to-r from-emerald-500 to-amber-400'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${normalized * 100}%` }}
          />
        </div>

        {/* Real HTML Range Slider for accessibility & touch */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />

        {/* Physical Fader Handle with yellow grip groove */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-5 rounded-xs hardware-fader-cap pointer-events-none transition-all duration-75"
          style={{
            left: `calc(${normalized * 100}% - 8px)`,
          }}
        />
      </div>

      {/* Percentage Readout */}
      <span className="text-[10px] font-mono font-bold text-zinc-300 dark:text-zinc-300 w-9 text-right bg-zinc-950/80 px-1 py-0.5 rounded border border-zinc-800">
        {percentage}%
      </span>
    </div>
  );
};
