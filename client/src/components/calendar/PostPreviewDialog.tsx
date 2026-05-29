import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import { useIntl } from "react-intl";
import { PostCard } from "../posts/PostCard.js";
import type { Occurrence } from "../../utils/recurrence.js";

interface PostPreviewDialogProps {
  /** The occurrence to preview, or null when the dialog is closed. */
  occurrence: Occurrence | null;
  onClose: () => void;
}

/**
 * Lightweight preview shown when an event chip is clicked in the calendar, so
 * browsing the calendar doesn't shunt the user off to the post detail page.
 * The embedded PostCard still links to the full post for those who want it.
 */
export function PostPreviewDialog({
  occurrence,
  onClose,
}: PostPreviewDialogProps) {
  const intl = useIntl();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (occurrence && !dialog.open) {
      dialog.showModal();
    } else if (!occurrence && dialog.open) {
      dialog.close();
    }
  }, [occurrence]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- backdrop dismiss; Escape is handled natively by <dialog>
    <dialog
      ref={dialogRef}
      aria-labelledby="post-preview-title"
      className="backdrop:bg-black/50 bg-transparent p-0 m-auto max-w-lg w-full"
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div className="bg-white rounded-lg shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between p-4 border-b border-mayday-200">
          <h2
            id="post-preview-title"
            className="text-lg font-bold text-gray-900"
          >
            {occurrence ? format(occurrence.start, "EEEE, MMMM d, yyyy") : ""}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={intl.formatMessage({
              id: "calendar.closeDialogAriaLabel",
              defaultMessage: "Close",
            })}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto p-4">
          {occurrence && <PostCard post={occurrence.post} />}
        </div>
      </div>
    </dialog>
  );
}
