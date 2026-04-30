import { Link, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  MessageSquare,
  Shield,
  LogOut,
  User,
  Plus,
  Mail,
} from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../context/AuthContext.js";
import { getMyInvites } from "../../api/organizations.js";
import { getMyCommunityInvites } from "../../api/communities.js";
import MayDayLogo from "../../assets/mayday-logo.svg?react";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const { data: orgInvites } = useQuery({
    queryKey: ["my-invites"],
    queryFn: getMyInvites,
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const { data: communityInvites } = useQuery({
    queryKey: ["my-community-invites"],
    queryFn: getMyCommunityInvites,
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const inviteCount =
    (orgInvites?.length ?? 0) + (communityInvites?.length ?? 0);

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            to="/"
            className="flex items-center gap-2 text-mayday-600 font-bold text-2xl"
          >
            <MayDayLogo
              className="w-16 h-16 text-mayday-600"
              aria-hidden="true"
            />
            MayDay
          </Link>

          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-6"
          >
            {user ? (
              <>
                <Link to="/posts" className="text-gray-600 hover:text-gray-900">
                  Browse
                </Link>
                <Link to="/map" className="text-gray-600 hover:text-gray-900">
                  Map
                </Link>
                <Link
                  to="/calendar"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Calendar
                </Link>
                <Link
                  to="/organizations"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Orgs
                </Link>
                <Link
                  to="/communities"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Communities
                </Link>
                <Link to="/about" className="text-gray-600 hover:text-gray-900">
                  About
                </Link>
                <Link
                  to="/support"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Support
                </Link>
                <Link
                  to="/posts/new"
                  className="flex items-center gap-1 bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  New Post
                </Link>
                <Link
                  to="/messages"
                  aria-label="Messages"
                  className="text-gray-600 hover:text-gray-900"
                >
                  <MessageSquare className="w-5 h-5" aria-hidden="true" />
                </Link>
                <Link
                  to="/invites"
                  aria-label={
                    inviteCount > 0
                      ? `Invites (${inviteCount} pending)`
                      : "Invites"
                  }
                  className="relative text-gray-600 hover:text-gray-900"
                >
                  <Mail className="w-5 h-5" aria-hidden="true" />
                  {inviteCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 bg-mayday-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium"
                    >
                      {inviteCount}
                    </span>
                  )}
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    to="/admin"
                    aria-label="Admin panel"
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Shield className="w-5 h-5" aria-hidden="true" />
                  </Link>
                )}
                <Link
                  to={`/profile/${user.id}`}
                  aria-label="Your profile"
                  className="text-gray-600 hover:text-gray-900"
                >
                  {user.avatarUrl ? (
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-5 h-5" aria-hidden="true" />
                  )}
                </Link>
                <button
                  onClick={handleLogout}
                  aria-label="Log out"
                  className="text-gray-600 hover:text-gray-900"
                >
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <Link to="/about" className="text-gray-600 hover:text-gray-900">
                  About
                </Link>
                <Link to="/login" className="text-gray-600 hover:text-gray-900">
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="bg-mayday-500 text-white px-4 py-2 rounded-lg hover:bg-mayday-600"
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>

          <button
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <X className="w-6 h-6" aria-hidden="true" />
            ) : (
              <Menu className="w-6 h-6" aria-hidden="true" />
            )}
          </button>
        </div>

        {menuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="md:hidden pb-4 space-y-2"
          >
            {user ? (
              <>
                <Link
                  to="/posts"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Browse
                </Link>
                <Link
                  to="/map"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Map
                </Link>
                <Link
                  to="/calendar"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Calendar
                </Link>
                <Link
                  to="/organizations"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Organizations
                </Link>
                <Link
                  to="/communities"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Communities
                </Link>
                <Link
                  to="/about"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  About
                </Link>
                <Link
                  to="/support"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                >
                  Support
                </Link>
                <Link
                  to="/posts/new"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  New Post
                </Link>
                <Link
                  to="/messages"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Messages
                </Link>
                <Link
                  to="/invites"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Invites{inviteCount > 0 ? ` (${inviteCount})` : ""}
                </Link>
                <Link
                  to={`/profile/${user.id}`}
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Profile
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    to="/admin"
                    aria-label="Admin panel"
                    className="block px-3 py-2 rounded hover:bg-gray-100"
                  >
                    Admin
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded hover:bg-gray-100"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/about"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  About
                </Link>
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  Sign up
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
