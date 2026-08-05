import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router";
import { WebSocketProvider } from "./context/WebSocketContext.js";
import { Layout } from "./components/layout/Layout.js";
import { RescueListener } from "./components/e2ee/RescueListener.js";
import { PushBootstrap } from "./components/common/PushBootstrap.js";
import { ProtectedRoute } from "./components/auth/ProtectedRoute.js";
import { LoadingSpinner } from "./components/common/LoadingSpinner.js";
import { useAuth } from "./context/AuthContext.js";

// First-paint routes stay in the initial bundle so the landing/auth flow
// renders without a second chunk fetch. Everything else is lazy-loaded so the
// boot bundle stays small — most importantly the map page, which pulls in the
// heavy Leaflet stack. Each lazy() becomes its own chunk fetched on navigation.
import { PostsPage } from "./pages/PostsPage.js";
import { AboutPage } from "./pages/AboutPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";

// React.lazy needs a default export; our pages use named exports, so each
// loader maps the named export onto `default`.
const PostDetailPage = lazy(() =>
  import("./pages/PostDetailPage.js").then((m) => ({ default: m.PostDetailPage })),
);
const CreatePostPage = lazy(() =>
  import("./pages/CreatePostPage.js").then((m) => ({ default: m.CreatePostPage })),
);
const EditPostPage = lazy(() =>
  import("./pages/EditPostPage.js").then((m) => ({ default: m.EditPostPage })),
);
const MapPage = lazy(() =>
  import("./pages/MapPage.js").then((m) => ({ default: m.MapPage })),
);
const CalendarPage = lazy(() =>
  import("./pages/CalendarPage.js").then((m) => ({ default: m.CalendarPage })),
);
const MessagesPage = lazy(() =>
  import("./pages/MessagesPage.js").then((m) => ({ default: m.MessagesPage })),
);
const ProfilePage = lazy(() =>
  import("./pages/ProfilePage.js").then((m) => ({ default: m.ProfilePage })),
);
const VerifyEmailPage = lazy(() =>
  import("./pages/VerifyEmailPage.js").then((m) => ({ default: m.VerifyEmailPage })),
);
const ForgotPasswordPage = lazy(() =>
  import("./pages/ForgotPasswordPage.js").then((m) => ({ default: m.ForgotPasswordPage })),
);
const ResetPasswordPage = lazy(() =>
  import("./pages/ResetPasswordPage.js").then((m) => ({ default: m.ResetPasswordPage })),
);
const AdminPage = lazy(() =>
  import("./pages/AdminPage.js").then((m) => ({ default: m.AdminPage })),
);
const OrganizationsPage = lazy(() =>
  import("./pages/OrganizationsPage.js").then((m) => ({ default: m.OrganizationsPage })),
);
const CreateOrganizationPage = lazy(() =>
  import("./pages/CreateOrganizationPage.js").then((m) => ({ default: m.CreateOrganizationPage })),
);
const OrganizationDetailPage = lazy(() =>
  import("./pages/OrganizationDetailPage.js").then((m) => ({ default: m.OrganizationDetailPage })),
);
const OrganizationManagePage = lazy(() =>
  import("./pages/OrganizationManagePage.js").then((m) => ({ default: m.OrganizationManagePage })),
);
const CommunitiesPage = lazy(() =>
  import("./pages/CommunitiesPage.js").then((m) => ({ default: m.CommunitiesPage })),
);
const CreateCommunityPage = lazy(() =>
  import("./pages/CreateCommunityPage.js").then((m) => ({ default: m.CreateCommunityPage })),
);
const CommunityDetailPage = lazy(() =>
  import("./pages/CommunityDetailPage.js").then((m) => ({ default: m.CommunityDetailPage })),
);
const CommunityManagePage = lazy(() =>
  import("./pages/CommunityManagePage.js").then((m) => ({ default: m.CommunityManagePage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage.js").then((m) => ({ default: m.NotFoundPage })),
);
const SupportPage = lazy(() =>
  import("./pages/SupportPage.js").then((m) => ({ default: m.SupportPage })),
);

export function App() {
  const { user } = useAuth();

  return (
    <WebSocketProvider>
      <RescueListener />
      <PushBootstrap />
      <Suspense fallback={<LoadingSpinner className="min-h-[50vh]" />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={user ? <PostsPage /> : <AboutPage />} />
          {/* Browsing is public. Logged-in users browse at the home route
              (/posts redirects there, covering old deep links); logged-out
              visitors land on About and browse public posts at /posts.
              Clicking through to a post detail sends them to /login via the
              ProtectedRoute on /posts/:id. */}
          <Route
            path="/posts"
            element={user ? <Navigate to="/" replace /> : <PostsPage />}
          />
          <Route
            path="/posts/:id"
            element={
              <ProtectedRoute>
                <PostDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts/new"
            element={
              <ProtectedRoute>
                <CreatePostPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/posts/:id/edit"
            element={
              <ProtectedRoute>
                <EditPostPage />
              </ProtectedRoute>
            }
          />
          {/* Map and calendar browse the same public post set for logged-out
              visitors; clicking through to a post still hits the protected
              /posts/:id route and redirects to /login. */}
          <Route path="/map" element={<MapPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route
            path="/messages"
            element={
              <ProtectedRoute>
                <MessagesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/:id"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          {/* The org/community directories are public; the detail and manage
              pages below stay login-gated, so clicking a card sends a
              logged-out visitor to /login. */}
          <Route path="/organizations" element={<OrganizationsPage />} />
          <Route
            path="/organizations/new"
            element={
              <ProtectedRoute>
                <CreateOrganizationPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizations/:id"
            element={
              <ProtectedRoute>
                <OrganizationDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/organizations/:id/manage"
            element={
              <ProtectedRoute>
                <OrganizationManagePage />
              </ProtectedRoute>
            }
          />
          <Route path="/communities" element={<CommunitiesPage />} />
          <Route
            path="/communities/new"
            element={
              <ProtectedRoute>
                <CreateCommunityPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/communities/:id"
            element={
              <ProtectedRoute>
                <CommunityDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/communities/:id/manage"
            element={
              <ProtectedRoute>
                <CommunityManagePage />
              </ProtectedRoute>
            }
          />
          {/* Invites are now surfaced as messages; keep the path as a redirect
              for old notification/email deep links. */}
          <Route
            path="/invites"
            element={<Navigate to="/messages" replace />}
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          {/* Public: the FAQ content is useful pre-signup; the page itself
              hides the bug report form from logged-out visitors. */}
          <Route path="/support" element={<SupportPage />} />
          {user?.role === "ADMIN" && (
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      </Suspense>
    </WebSocketProvider>
  );
}
