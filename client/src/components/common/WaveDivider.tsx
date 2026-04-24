export function WaveDivider({ className = "" }: { className?: string }) {
  return (
    <svg
      className={`absolute top-0 left-0 w-full h-20 sm:h-28 pointer-events-none ${className}`}
      viewBox="0 0 1440 100"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0,40 C180,60 360,20 540,40 C720,60 900,20 1080,40 C1260,60 1350,30 1440,40 L1440,0 L0,0 Z"
        className="fill-mayday-200/20"
      />
      <path
        d="M0,50 C240,80 480,20 720,50 C960,80 1200,20 1440,50 L1440,0 L0,0 Z"
        className="fill-mayday-300/30"
      />
      <path
        d="M0,60 C360,100 720,10 1080,60 C1260,85 1350,45 1440,60 L1440,0 L0,0 Z"
        className="fill-mayday-400/40"
      />
    </svg>
  );
}
