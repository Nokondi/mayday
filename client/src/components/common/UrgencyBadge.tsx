const urgencyConfig: Record<string, { color: string; label: string }> = {
  LOW: { color: 'bg-gray-100 text-gray-700', label: 'Low' },
  MEDIUM: { color: 'bg-blue-100 text-blue-700', label: 'Medium' },
  HIGH: { color: 'bg-orange-100 text-orange-700', label: 'High' },
  CRITICAL: { color: 'bg-red-100 text-red-700', label: 'Critical' },
};

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const config = urgencyConfig[urgency] || urgencyConfig.MEDIUM;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      {config.label}
    </span>
  );
}
