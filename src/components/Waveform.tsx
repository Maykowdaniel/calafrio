import React from "react";
// AQUI ESTÁ A CORREÇÃO: Avisamos ao TypeScript que podemos receber o isPlaying!
interface WaveformProps {
  isPlaying?: boolean;
}

const bars = [
  { height: 16, duration: 0.6 },
  { height: 28, duration: 0.8 },
  { height: 20, duration: 0.5 },
  { height: 32, duration: 0.9 },
  { height: 14, duration: 0.7 },
  { height: 26, duration: 0.6 },
  { height: 18, duration: 0.8 },
  { height: 30, duration: 0.5 },
  { height: 12, duration: 0.9 },
  { height: 24, duration: 0.7 },
  { height: 20, duration: 0.6 },
  { height: 28, duration: 0.8 },
  { height: 16, duration: 0.5 },
  { height: 22, duration: 0.7 },
  { height: 32, duration: 0.6 },
  { height: 14, duration: 0.9 },
  { height: 26, duration: 0.5 },
  { height: 18, duration: 0.8 },
];

const Waveform = ({ isPlaying = false }: WaveformProps) => {
  return (
    <div className="flex items-center gap-[2px] h-8">
      {bars.map((bar, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-secondary animate-waveform"
          style={{
            ["--wave-height" as string]: `${bar.height}px`,
            ["--wave-duration" as string]: `${bar.duration}s`,
            animationDelay: `${i * 0.05}s`,
            height: "12px",
          }}
        />
      ))}
    </div>
  );
};

export default Waveform;
