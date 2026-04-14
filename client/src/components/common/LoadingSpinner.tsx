export function LoadingSpinner({ className = '' }: { className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex items-center justify-center ${className}`}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mayday-500" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
