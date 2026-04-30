import { useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface AvatarUploaderProps {
  currentUrl: string | null | undefined;
  fallback: React.ReactNode;
  onUpload: (file: File) => Promise<void>;
  shape?: 'circle' | 'square';
  size?: number;
  disabled?: boolean;
}

export function AvatarUploader({
  currentUrl,
  fallback,
  onUpload,
  shape = 'circle',
  size = 80,
  disabled = false,
}: AvatarUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
      return;
    }
    if (file.size > MAX_SIZE) {
      toast.error('Image must be 5MB or smaller');
      return;
    }
    setUploading(true);
    try {
      await onUpload(file);
      toast.success('Avatar updated');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const radius = shape === 'circle' ? 'rounded-full' : 'rounded-lg';

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_TYPES.join(',')}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || uploading}
        aria-label={uploading ? 'Uploading avatar' : 'Upload avatar'}
        className={`${radius} bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 relative group cursor-pointer disabled:cursor-not-allowed`}
        style={{ width: size, height: size }}
      >
        {currentUrl ? (
          <img src={currentUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          fallback
        )}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
          {uploading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" aria-hidden="true" />
          ) : (
            <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
          )}
        </div>
      </button>
    </>
  );
}
