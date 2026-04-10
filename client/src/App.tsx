import { Routes, Route } from 'react-router-dom';
import { WebSocketProvider } from './context/WebSocketContext.js';
import { Layout } from './components/layout/Layout.js';
import { ProtectedRoute } from './components/auth/ProtectedRoute.js';
import { HomePage } from './pages/HomePage.js';
import { PostsPage } from './pages/PostsPage.js';
import { PostDetailPage } from './pages/PostDetailPage.js';
import { CreatePostPage } from './pages/CreatePostPage.js';
import { MapPage } from './pages/MapPage.js';
import { MessagesPage } from './pages/MessagesPage.js';
import { ProfilePage } from './pages/ProfilePage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';
import { AdminPage } from './pages/AdminPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';
import { useAuth } from './context/AuthContext.js';

export function App() {
  const { user } = useAuth();

  return (
    <WebSocketProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/posts" element={<PostsPage />} />
          <Route path="/posts/:id" element={<PostDetailPage />} />
          <Route path="/posts/new" element={
            <ProtectedRoute><CreatePostPage /></ProtectedRoute>
          } />
          <Route path="/map" element={<MapPage />} />
          <Route path="/messages" element={
            <ProtectedRoute><MessagesPage /></ProtectedRoute>
          } />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {user?.role === 'ADMIN' && (
            <Route path="/admin" element={
              <ProtectedRoute><AdminPage /></ProtectedRoute>
            } />
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </WebSocketProvider>
  );
}
