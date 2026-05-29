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
      {/* Three stacked bands, darkest at the top to lightest at the bottom.
          Each path traces a wave and closes down to the bottom
          edge, painted in a lighter shade. SVG paints in document order, so
          the visible colour in each horizontal strip is the topmost shape
          that reaches it — which produces a clean stepped gradient with no
          fill-rule issues even where adjacent waves cross. */}
      <path
        d="M0,40 C180,60 360,20 540,40 C720,60 900,20 1080,40 C1260,60 1350,30 1440,40 L1440,72 L0,72 Z"
        className="fill-mayday-200"
      />
      <path
        d="M0,50 C240,80 480,20 720,50 C960,80 1200,20 1440,50 L1440,72 L0,72 Z"
        className="fill-mayday-100"
      />
      <path
        d="M0,60 C360,100 720,10 1080,60 C1260,85 1350,45 1440,60 L1440,72 L0,72 Z"
        className="fill-mayday-50"
      />
    </svg>
  );
}
