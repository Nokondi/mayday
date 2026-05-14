import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FormattedMessage, useIntl } from 'react-intl';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const intl = useIntl();
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label={intl.formatMessage({ defaultMessage: 'Pagination' })}
      className="flex items-center justify-center gap-2 mt-6"
    >
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label={intl.formatMessage({ defaultMessage: 'Previous page' })}
        className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <span className="text-sm text-gray-600" aria-live="polite" aria-atomic="true">
        <FormattedMessage
          defaultMessage="Page {page} of {totalPages}"
          values={{ page, totalPages }}
        />
      </span>
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label={intl.formatMessage({ defaultMessage: 'Next page' })}
        className="p-2 rounded-lg border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
      >
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
