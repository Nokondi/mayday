import { defineMessages, useIntl } from 'react-intl';

const urgencyLabels = defineMessages({
  LOW: { id: 'urgency.low', defaultMessage: 'Low' },
  MEDIUM: { id: 'urgency.medium', defaultMessage: 'Medium' },
  HIGH: { id: 'urgency.high', defaultMessage: 'High' },
  CRITICAL: { id: 'urgency.critical', defaultMessage: 'Critical' },
});

const urgencyColors: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-700',
  MEDIUM: 'bg-blue-100 text-blue-700',
  HIGH: 'bg-orange-100 text-orange-700',
  CRITICAL: 'bg-red-100 text-red-700',
};

export function UrgencyBadge({ urgency }: { urgency: string }) {
  const intl = useIntl();
  const label =
    urgencyLabels[urgency as keyof typeof urgencyLabels] ?? urgencyLabels.MEDIUM;
  const color = urgencyColors[urgency] || urgencyColors.MEDIUM;
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}
    >
      {intl.formatMessage(label)}
    </span>
  );
}
