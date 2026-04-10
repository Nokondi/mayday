import { Link } from 'react-router-dom';
import { User, MapPin } from 'lucide-react';
import type { UserPublicProfile } from '@mayday/shared';

export function UserCard({ user }: { user: UserPublicProfile }) {
  return (
    <Link to={`/profile/${user.id}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50">
      <div className="w-10 h-10 bg-mayday-100 rounded-full flex items-center justify-center">
        <User className="w-5 h-5 text-mayday-600" />
      </div>
      <div>
        <p className="font-medium text-gray-900">{user.name}</p>
        {user.location && (
          <p className="text-sm text-gray-500 flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {user.location}
          </p>
        )}
      </div>
    </Link>
  );
}
