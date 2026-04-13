import { Link, useNavigate } from 'react-router-dom';
import { Heart, Menu, X, MessageSquare, Shield, LogOut, User, Plus, Mail } from 'lucide-react';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../context/AuthContext.js';
import { getMyInvites } from '../../api/organizations.js';

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: invites } = useQuery({
    queryKey: ['my-invites'],
    queryFn: getMyInvites,
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const inviteCount = invites?.length ?? 0;

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2 text-mayday-600 font-bold text-xl">
            <Heart className="w-6 h-6 fill-mayday-500" />
            MayDay
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                <Link to="/posts" className="text-gray-600 hover:text-gray-900">Browse</Link>
                <Link to="/map" className="text-gray-600 hover:text-gray-900">Map</Link>
                <Link to="/organizations" className="text-gray-600 hover:text-gray-900">Orgs</Link>
                <Link to="/posts/new" className="flex items-center gap-1 bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600">
                  <Plus className="w-4 h-4" />
                  New Post
                </Link>
                <Link to="/messages" className="text-gray-600 hover:text-gray-900">
                  <MessageSquare className="w-5 h-5" />
                </Link>
                <Link to="/invites" className="relative text-gray-600 hover:text-gray-900">
                  <Mail className="w-5 h-5" />
                  {inviteCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-mayday-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium">
                      {inviteCount}
                    </span>
                  )}
                </Link>
                {user.role === 'ADMIN' && (
                  <Link to="/admin" className="text-gray-600 hover:text-gray-900">
                    <Shield className="w-5 h-5" />
                  </Link>
                )}
                <Link to={`/profile/${user.id}`} className="text-gray-600 hover:text-gray-900">
                  <User className="w-5 h-5" />
                </Link>
                <button onClick={handleLogout} className="text-gray-600 hover:text-gray-900">
                  <LogOut className="w-5 h-5" />
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-600 hover:text-gray-900">Log in</Link>
                <Link to="/register" className="bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600">
                  Sign up
                </Link>
              </>
            )}
          </nav>

          <button className="md:hidden" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden pb-4 space-y-2">
            {user ? (
              <>
                <Link to="/posts" className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Browse</Link>
                <Link to="/map" className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Map</Link>
                <Link to="/organizations" className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Organizations</Link>
                <Link to="/posts/new" className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>New Post</Link>
                <Link to="/messages" className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Messages</Link>
                <Link to="/invites" className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>
                  Invites{inviteCount > 0 ? ` (${inviteCount})` : ''}
                </Link>
                <Link to={`/profile/${user.id}`} className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Profile</Link>
                <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="block w-full text-left px-3 py-2 rounded hover:bg-gray-100">Log out</button>
              </>
            ) : (
              <>
                <Link to="/login" className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Log in</Link>
                <Link to="/register" className="block px-3 py-2 rounded hover:bg-gray-100" onClick={() => setMenuOpen(false)}>Sign up</Link>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
