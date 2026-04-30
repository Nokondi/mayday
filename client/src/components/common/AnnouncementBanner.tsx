import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";
import { getActiveAnnouncement } from "../../api/announcements.js";

const DISMISSED_STORAGE_KEY = "mayday:dismissed-announcement-id";

export function AnnouncementBanner() {
  const { data: announcement } = useQuery({
    queryKey: ["announcement", "active"],
    queryFn: getActiveAnnouncement,
    refetchInterval: 5 * 60_000,
    staleTime: 60_000,
  });

  const [dismissedId, setDismissedId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(DISMISSED_STORAGE_KEY);
  });

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === DISMISSED_STORAGE_KEY) setDismissedId(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!announcement) return null;
  if (dismissedId === announcement.id) return null;

  const handleDismiss = () => {
    window.localStorage.setItem(DISMISSED_STORAGE_KEY, announcement.id);
    setDismissedId(announcement.id);
  };

  return (
    <div role="status" className="bg-mayday-700 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-start gap-3">
        <Megaphone
          className="w-4 h-4 mt-0.5 flex-shrink-0"
          aria-hidden="true"
        />
        <p className="flex-1 text-sm whitespace-pre-wrap break-words">
          {announcement.message}
        </p>
        <button
          onClick={handleDismiss}
          aria-label="Dismiss announcement"
          className="flex-shrink-0 p-0.5 rounded hover:bg-white/20"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
