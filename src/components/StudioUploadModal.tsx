import React, { useState, useRef, useEffect } from 'react';
import { Upload, X, AlertCircle, Image as ImageIcon } from 'lucide-react';

interface StudioUploadModalProps {
  open: boolean;
  onClose: () => void;
  onLoadImage: (img: HTMLImageElement, filename: string) => void;
}

export const StudioUploadModal: React.FC<StudioUploadModalProps> = ({
  open,
  onClose,
  onLoadImage,
}) => {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Global Clipboard paste listener when modal is open
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            processFile(file);
            return;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [open]);

  if (!open) return null;

  const processFile = (file: File) => {
    setError(null);
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      setError(`Unsupported format (${file.type || 'unknown'}). Please upload PNG, JPG, WEBP, or AVIF.`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setError('File size exceeds 25 MB boundary limit.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        onLoadImage(img, file.name);
        onClose();
      };
      img.onerror = () => {
        setError('Failed to decode image data.');
      };
      img.src = dataUrl;
    };
    reader.onerror = () => {
      setError('Failed to read file from disk.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#11131C] border border-white/15 rounded-xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-[#00E599]" />
            <h2 className="text-sm font-semibold text-white">Upload Design or Creative Asset</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-[#00E599] bg-[#00E599]/10'
                : 'border-white/15 bg-[#08090E]/60 hover:border-white/30 hover:bg-[#08090E]'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png, image/jpeg, image/webp, image/avif, image/svg+xml"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processFile(e.target.files[0]);
                }
              }}
            />
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-zinc-400 mb-3">
              <ImageIcon className="w-6 h-6 text-[#00E599]" />
            </div>
            <p className="text-xs font-medium text-white mb-1">
              Drag & drop design asset, or <span className="text-[#00E599] underline">browse</span>
            </p>
            <p className="text-[11px] text-zinc-500">
              Supports PNG, JPG, WEBP, AVIF up to 25 MB • Paste (Ctrl+V) also supported
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
