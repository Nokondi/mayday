import { Routes, Route } from "react-router-dom";
import { WebSocketProvider } from "./context/WebSocketContext.js";
import { Layout } from "./components/layout/Layout.js";
import { ProtectedRoute } from "./components/auth/ProtectedRoute.js";
import { HomePage } from "./pages/HomePage.js";
import { PostsPage } from "./pages/PostsPage.js";
import { PostDetailPage } from "./pages/PostDetailPage.js";
import { CreatePostPage } from "./pages/CreatePostPage.js";
import { MapPage } from "./pages/MapPage.js";
import { CalendarPage } from "./pages/CalendarPage.js";
import { MessagesPage } from "./pages/MessagesPage.js";
import { ProfilePage } from "./pages/ProfilePage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { RegisterPage } from "./pages/RegisterPage.js";
import { VerifyEmailPage } from "./pages/VerifyEmailPage.js";
import { ForgotPasswordPage } from "./pages/ForgotPasswordPage.js";
import { ResetPasswordPage } from "./pages/ResetPasswordPage.js";
import { AdminPage } from "./pages/AdminPage.js";
import { OrganizationsPage } from "./pages/OrganizationsPage.js";
import { CreateOrganizationPage } from "./pages/CreateOrganizationPage.js";
import { OrganizationDetailPage } from "./pages/OrganizationDetailPage.js";
import { OrganizationManagePage } from "./pages/OrganizationManagePage.js";
import { CommunitiesPage } from "./pages/CommunitiesPage.js";
import { CreateCommunityPage } from "./pages/CreateCommunityPage.js";
import { CommunityDetailPage } from "./pages/CommunityDetailPage.js";
import { CommunityManagePage } from "./pages/CommunityManagePage.js";
import { InvitesPage } from "./pages/InvitesPage.js";
import { AboutPage } from "./pages/AboutPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { SupportPage } from "./pages/SupportPage.js";
import { useAuth } from "./context/AuthContext.js";

export function App() {
  const { user } = useAuth();

  return (
    <WebSocketProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={user ? <HomePage /> : <AboutPage />} />
          <Route
            path="/posts"
            element={
              <ProtectedRoute>
                <PostsPage />
              </ProtectedRoute>
            }
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
            path="/map"
            element={
              <ProtectedRoute>
                <MapPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/calendar"
            element={
              <ProtectedRoute>
                <CalendarPage />
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/organizations"
            element={
              <ProtectedRoute>
                <OrganizationsPage />
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/communities"
            element={
              <ProtectedRoute>
                <CommunitiesPage />
              </ProtectedRoute>
            }
          />
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
          <Route
            path="/invites"
            element={
              <ProtectedRoute>
                <InvitesPage />
              </ProtectedRoute>
            }
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/support"
            element={
              <ProtectedRoute>
                <SupportPage />
              </ProtectedRoute>
            }
          />
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
    </WebSocketProvider>
  );
}
