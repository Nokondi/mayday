import { Outlet } from 'react-router-dom';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { AnnouncementBanner } from '../common/AnnouncementBanner.js';

export function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:bg-white focus:px-4 focus:py-2 focus:text-mayday-600 focus:underline">
        Skip to main content
      </a>
      <AnnouncementBanner />
      <Header />
      <main id="main-content" className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
