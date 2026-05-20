import { Navigate, useLocation } from 'react-router-dom';
import { FormattedMessage } from 'react-intl';
import { useAuth } from '../../context/AuthContext.js';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center min-h-[50vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-mayday-500" />
        <span className="sr-only">
          <FormattedMessage
            id="common.loadingSpinner.srLabel"
            defaultMessage="Loading..."
          />
        </span>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
