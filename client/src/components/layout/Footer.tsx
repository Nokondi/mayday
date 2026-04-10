import { Heart } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-white border-t border-gray-200 py-8 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-500 text-sm">
        <p className="flex items-center justify-center gap-1">
          Built with <Heart className="w-4 h-4 text-mayday-500 fill-mayday-500" /> for community
        </p>
        <p className="mt-1">MayDay Mutual Aid Hub</p>
      </div>
    </footer>
  );
}
