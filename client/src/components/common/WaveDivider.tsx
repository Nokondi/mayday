export function WaveDivider({ className = "" }: { className?: string }) {
  // viewBox is cropped to the curves' actual vertical extent (y ≈ 34–71) so
  // there's no empty band above or below the waves. y=72 is the bottom edge.
  return (
    <svg
      className={`absolute top-0 left-0 w-full h-8 sm:h-11 pointer-events-none ${className}`}
      viewBox="0 32 1440 40"
      preserveAspectRatio="none"
      aria-hidden="true"
      fill="none"
    >
      {/* Filled base: the middle wave is the upper edge, filled down to the bottom. */}
      <path
        d="M0,50 C240,80 480,20 720,50 C960,80 1200,20 1440,50 L1440,72 L0,72 Z"
        className="fill-mayday-50"
      />
      <path
        d="M0,40 C180,60 360,20 540,40 C720,60 900,20 1080,40 C1260,60 1350,30 1440,40"
        className="stroke-mayday-200/40"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0,50 C240,80 480,20 720,50 C960,80 1200,20 1440,50"
        className="stroke-mayday-300/50"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <path
        d="M0,60 C360,100 720,10 1080,60 C1260,85 1350,45 1440,60"
        className="stroke-mayday-400/60"
        strokeWidth={2}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
