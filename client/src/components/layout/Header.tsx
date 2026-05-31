import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  Menu,
  X,
  MessageSquare,
  Shield,
  LogOut,
  User,
  Plus,
  MapPinned,
  Calendar,
  Binoculars,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FormattedMessage, useIntl } from "react-intl";
import type { WSMessage } from "@mayday/shared";
import { useAuth } from "../../context/AuthContext.js";
import { useWebSocket } from "../../context/WebSocketContext.js";
import { getConversations } from "../../api/messages.js";
import MayDayLogo from "../../assets/mayday-logo.svg?react";
import { WaveDivider } from "../common/WaveDivider.js";

// Product brand name — kept out of i18n so it renders identically in all locales.
const BRAND_NAME = "MayDay";

export function Header() {
  const intl = useIntl();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const isActive = (path: string) => pathname === path;

  const queryClient = useQueryClient();
  const { addHandler, removeHandler } = useWebSocket();

  // Total unread messages, summed across conversations, to badge the Messages
  // icon. We reuse the ["conversations"] cache that MessagesPage reads/writes,
  // so opening a thread (which marks it read) clears the badge. A slow poll is
  // the fallback; the websocket handler below keeps it live on every page.
  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: getConversations,
    enabled: !!user,
    refetchInterval: 60_000,
  });
  const unreadCount =
    conversations?.reduce((sum, c) => sum + c.unreadCount, 0) ?? 0;

  // A new/updated message anywhere should refresh the unread count even when
  // MessagesPage isn't mounted. NEW_MESSAGE bumps it; MESSAGE_UPDATED covers
  // invite-card status flips that change read/relevance.
  const handleWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === "NEW_MESSAGE" || msg.type === "MESSAGE_UPDATED") {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      }
    },
    [queryClient],
  );
  useEffect(() => {
    if (!user) return;
    addHandler(handleWsMessage);
    return () => removeHandler(handleWsMessage);
  }, [user, handleWsMessage, addHandler, removeHandler]);

  const messagesLabel =
    unreadCount > 0
      ? intl.formatMessage(
          {
            id: "layout.header.nav.messagesUnreadAria",
            defaultMessage: "Messages ({count} unread)",
          },
          { count: unreadCount },
        )
      : intl.formatMessage({
          id: "layout.header.nav.messages",
          defaultMessage: "Messages",
        });
  // Cap the displayed count; the precise number lives in the aria-label.
  const unreadDisplay = unreadCount > 99 ? "99+" : String(unreadCount);
  const messagesBadge =
    unreadCount > 0 ? (
      <span
        aria-hidden="true"
        className="absolute -top-1 -right-1 bg-mayday-700 text-white text-[10px] rounded-full min-w-4 h-4 px-1 flex items-center justify-center font-medium"
      >
        {unreadDisplay}
      </span>
    ) : null;

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <header className="bg-white sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            to="/"
            aria-label={BRAND_NAME}
            className="flex items-center gap-2 text-mayday-700 font-bold text-2xl"
          >
            <MayDayLogo
              className="w-16 h-16 text-mayday-700"
              aria-hidden="true"
            />
            <span className="hidden md:inline">{BRAND_NAME}</span>
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
                  aria-label={messagesLabel}
                  className="relative text-gray-600 hover:text-gray-900"
                >
                  <MessageSquare className="w-5 h-5" aria-hidden="true" />
                  {messagesBadge}
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

          <div className="md:hidden flex items-center gap-4">
            {user && (
              <nav
                aria-label={intl.formatMessage({
                  id: "layout.header.mobileQuickNavAriaLabel",
                  defaultMessage: "Quick navigation",
                })}
                className="flex items-center gap-4"
              >
                <Link
                  to="/posts"
                  aria-label={intl.formatMessage({
                    id: "layout.header.nav.browse",
                    defaultMessage: "Browse",
                  })}
                  aria-current={isActive("/posts") ? "page" : undefined}
                  className={
                    isActive("/posts")
                      ? "text-mayday-700"
                      : "text-gray-600 hover:text-gray-900"
                  }
                >
                  <Binoculars
                    strokeWidth={1.5}
                    className="w-8 h-8"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  to="/map"
                  aria-label={intl.formatMessage({
                    id: "layout.header.nav.map",
                    defaultMessage: "Map",
                  })}
                  aria-current={isActive("/map") ? "page" : undefined}
                  className={
                    isActive("/map")
                      ? "text-mayday-700"
                      : "text-gray-600 hover:text-gray-900"
                  }
                >
                  <MapPinned
                    strokeWidth={1.5}
                    className="w-8 h-8"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  to="/calendar"
                  aria-label={intl.formatMessage({
                    id: "layout.header.nav.calendar",
                    defaultMessage: "Calendar",
                  })}
                  aria-current={isActive("/calendar") ? "page" : undefined}
                  className={
                    isActive("/calendar")
                      ? "text-mayday-700"
                      : "text-gray-600 hover:text-gray-900"
                  }
                >
                  <Calendar
                    strokeWidth={1.5}
                    className="w-8 h-8"
                    aria-hidden="true"
                  />
                </Link>
                <Link
                  to="/messages"
                  aria-label={messagesLabel}
                  aria-current={isActive("/messages") ? "page" : undefined}
                  className={`relative ${
                    isActive("/messages")
                      ? "text-mayday-700"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <MessageSquare
                    strokeWidth={1.5}
                    className="w-8 h-8"
                    aria-hidden="true"
                  />
                  {messagesBadge}
                </Link>
                <Link
                  to="/posts/new"
                  aria-label={intl.formatMessage({
                    id: "layout.header.nav.newPost",
                    defaultMessage: "New Post",
                  })}
                  aria-current={isActive("/posts/new") ? "page" : undefined}
                  className={
                    isActive("/posts/new")
                      ? "text-mayday-700"
                      : "text-gray-600 hover:text-gray-900"
                  }
                >
                  <Plus
                    strokeWidth={1.5}
                    className="w-8 h-8"
                    aria-hidden="true"
                  />
                </Link>
              </nav>
            )}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-label={intl.formatMessage({
                id: "layout.header.toggleMenuAriaLabel",
                defaultMessage: "Toggle menu",
              })}
              className="text-gray-600 hover:text-gray-900"
            >
              {menuOpen ? (
                <X strokeWidth={1.5} className="w-8 h-8" aria-hidden="true" />
              ) : (
                <Menu
                  strokeWidth={1.5}
                  className="w-8 h-8"
                  aria-hidden="true"
                />
              )}
            </button>
          </div>
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
      {/* Decorative wave in normal flow directly below the nav, so it
          reserves its own height and never overlaps page content. */}
      <div className="relative h-8 sm:h-11 overflow-hidden pointer-events-none">
        <WaveDivider />
      </div>
    </header>
  );
}
