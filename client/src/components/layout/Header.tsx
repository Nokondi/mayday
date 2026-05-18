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
import { FormattedMessage, useIntl } from "react-intl";
import { useAuth } from "../../context/AuthContext.js";
import { getMyInvites } from "../../api/organizations.js";
import { getMyCommunityInvites } from "../../api/communities.js";
import MayDayLogo from "../../assets/mayday-logo.svg?react";

export function Header() {
  const intl = useIntl();
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
            className="flex items-center gap-2 text-mayday-700 font-bold text-2xl"
          >
            <MayDayLogo
              className="w-16 h-16 text-mayday-700"
              aria-hidden="true"
            />
            MayDay
          </Link>

          <nav
            aria-label={intl.formatMessage({
              id: "layout.header.desktopNavAriaLabel",
              defaultMessage: "Main navigation",
            })}
            className="hidden md:flex items-center gap-6"
          >
            {user ? (
              <>
                <Link to="/posts" className="text-gray-600 hover:text-gray-900">
                  <FormattedMessage
                    id="layout.header.nav.browse"
                    defaultMessage="Browse"
                  />
                </Link>
                <Link to="/map" className="text-gray-600 hover:text-gray-900">
                  <FormattedMessage
                    id="layout.header.nav.map"
                    defaultMessage="Map"
                  />
                </Link>
                <Link
                  to="/calendar"
                  className="text-gray-600 hover:text-gray-900"
                >
                  <FormattedMessage
                    id="layout.header.nav.calendar"
                    defaultMessage="Calendar"
                  />
                </Link>
                <Link
                  to="/organizations"
                  className="text-gray-600 hover:text-gray-900"
                >
                  <FormattedMessage
                    id="layout.header.desktopNav.orgs"
                    defaultMessage="Orgs"
                  />
                </Link>
                <Link
                  to="/communities"
                  className="text-gray-600 hover:text-gray-900"
                >
                  <FormattedMessage
                    id="layout.header.nav.communities"
                    defaultMessage="Communities"
                  />
                </Link>
                <Link to="/about" className="text-gray-600 hover:text-gray-900">
                  <FormattedMessage
                    id="layout.header.nav.about"
                    defaultMessage="About"
                  />
                </Link>
                <Link
                  to="/support"
                  className="text-gray-600 hover:text-gray-900"
                >
                  <FormattedMessage
                    id="layout.header.nav.support"
                    defaultMessage="Support"
                  />
                </Link>
                <Link
                  to="/posts/new"
                  className="flex items-center gap-1 bg-mayday-700 text-white text-nowrap font-bold px-4 py-2 rounded-lg hover:bg-mayday-800"
                >
                  <Plus
                    strokeWidth={5}
                    className="w-4 h-4"
                    aria-hidden="true"
                  />
                  <FormattedMessage
                    id="layout.header.nav.newPost"
                    defaultMessage="New Post"
                  />
                </Link>
                <Link
                  to="/messages"
                  aria-label={intl.formatMessage({
                    id: "layout.header.nav.messages",
                    defaultMessage: "Messages",
                  })}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <MessageSquare className="w-5 h-5" aria-hidden="true" />
                </Link>
                <Link
                  to="/invites"
                  aria-label={intl.formatMessage(
                    {
                      id: "layout.header.desktopNav.invitesAriaLabel",
                      defaultMessage:
                        "{count, plural, =0 {Invites} other {Invites ({count} pending)}}",
                    },
                    { count: inviteCount },
                  )}
                  className="relative text-gray-600 hover:text-gray-900"
                >
                  <Mail className="w-5 h-5" aria-hidden="true" />
                  {inviteCount > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 -right-1 bg-mayday-700 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-medium"
                    >
                      {inviteCount}
                    </span>
                  )}
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    to="/admin"
                    aria-label={intl.formatMessage({
                      id: "layout.header.nav.adminPanelAria",
                      defaultMessage: "Admin panel",
                    })}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <Shield className="w-5 h-5" aria-hidden="true" />
                  </Link>
                )}
                <Link
                  to={`/profile/${user.id}`}
                  aria-label={intl.formatMessage({
                    id: "layout.header.desktopNav.profileAriaLabel",
                    defaultMessage: "Your profile",
                  })}
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
                  aria-label={intl.formatMessage({
                    id: "layout.header.nav.logout",
                    defaultMessage: "Log out",
                  })}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <LogOut className="w-5 h-5" aria-hidden="true" />
                </button>
              </>
            ) : (
              <>
                <Link to="/about" className="text-gray-600 hover:text-gray-900">
                  <FormattedMessage
                    id="layout.header.nav.about"
                    defaultMessage="About"
                  />
                </Link>
                <Link to="/login" className="text-gray-600 hover:text-gray-900">
                  <FormattedMessage
                    id="common.actions.login"
                    defaultMessage="Log in"
                  />
                </Link>
                <Link
                  to="/register"
                  className="bg-mayday-700 text-white font-bold px-4 py-2 rounded-lg hover:bg-mayday-800 text-nowrap"
                >
                  <FormattedMessage
                    id="layout.header.nav.signup"
                    defaultMessage="Sign up"
                  />
                </Link>
              </>
            )}
          </nav>

          <button
            className="md:hidden"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-expanded={menuOpen}
            aria-label={intl.formatMessage({
              id: "layout.header.toggleMenuAriaLabel",
              defaultMessage: "Toggle menu",
            })}
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
            aria-label={intl.formatMessage({
              id: "layout.header.mobileNavAriaLabel",
              defaultMessage: "Mobile navigation",
            })}
            className="md:hidden pb-4 space-y-2"
          >
            {user ? (
              <>
                <Link
                  to="/posts"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.browse"
                    defaultMessage="Browse"
                  />
                </Link>
                <Link
                  to="/map"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.map"
                    defaultMessage="Map"
                  />
                </Link>
                <Link
                  to="/calendar"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.calendar"
                    defaultMessage="Calendar"
                  />
                </Link>
                <Link
                  to="/organizations"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.mobileNav.organizations"
                    defaultMessage="Organizations"
                  />
                </Link>
                <Link
                  to="/communities"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.communities"
                    defaultMessage="Communities"
                  />
                </Link>
                <Link
                  to="/about"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.about"
                    defaultMessage="About"
                  />
                </Link>
                <Link
                  to="/support"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.support"
                    defaultMessage="Support"
                  />
                </Link>
                <Link
                  to="/posts/new"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.newPost"
                    defaultMessage="New Post"
                  />
                </Link>
                <Link
                  to="/messages"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.messages"
                    defaultMessage="Messages"
                  />
                </Link>
                <Link
                  to="/invites"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.mobileNav.invites"
                    defaultMessage="{count, plural, =0 {Invites} other {Invites ({count})}}"
                    values={{ count: inviteCount }}
                  />
                </Link>
                <Link
                  to={`/profile/${user.id}`}
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.mobileNav.profile"
                    defaultMessage="Profile"
                  />
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    to="/admin"
                    aria-label={intl.formatMessage({
                      id: "layout.header.nav.adminPanelAria",
                      defaultMessage: "Admin panel",
                    })}
                    className="block px-3 py-2 rounded hover:bg-gray-100"
                    onClick={() => setMenuOpen(false)}
                  >
                    <FormattedMessage
                      id="layout.header.mobileNav.admin"
                      defaultMessage="Admin"
                    />
                  </Link>
                )}
                <button
                  onClick={() => {
                    handleLogout();
                    setMenuOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 rounded hover:bg-gray-100"
                >
                  <FormattedMessage
                    id="layout.header.nav.logout"
                    defaultMessage="Log out"
                  />
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/about"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.about"
                    defaultMessage="About"
                  />
                </Link>
                <Link
                  to="/login"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="common.actions.login"
                    defaultMessage="Log in"
                  />
                </Link>
                <Link
                  to="/register"
                  className="block px-3 py-2 rounded hover:bg-gray-100"
                  onClick={() => setMenuOpen(false)}
                >
                  <FormattedMessage
                    id="layout.header.nav.signup"
                    defaultMessage="Sign up"
                  />
                </Link>
              </>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
