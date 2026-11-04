import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { DomainProfileId, AssetMetadata } from '../core/types';
import { DOMAIN_PROFILES } from '../core/profiles';
import { SAMPLE_IMAGES } from '../data/sampleImages';
import { Upload, FileImage, Sparkles, Layers, Sliders, Check, AlertCircle } from 'lucide-react';

interface UploadMetadataModalProps {
  open: boolean;
  onClose: () => void;
  onAssetLoaded: (
    img: HTMLImageElement,
    metadata: Partial<AssetMetadata>
  ) => void;
  currentProfile: DomainProfileId;
}

export const UploadMetadataModal: React.FC<UploadMetadataModalProps> = ({
  open,
  onClose,
  onAssetLoaded,
  currentProfile,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [creativeName, setCreativeName] = useState<string>('Production Landing Page Hero');
  const [medium, setMedium] = useState<DomainProfileId>(currentProfile);
  const [targetPlatform, setTargetPlatform] = useState<AssetMetadata['targetPlatform']>('desktop_web');
  const [viewingDistance, setViewingDistance] = useState<AssetMetadata['viewingDistance']>('desktop_60cm');
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileSelect = (file: File) => {
    setUploadError(null);

    // Accepted types: PNG, JPEG, WebP, SVG
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
    const isImageExt = /\.(png|jpe?g|webp|svg)$/i.test(file.name);

    if (!validTypes.includes(file.type) && !isImageExt) {
      setUploadError('Unsupported file type. Please upload a valid PNG, JPG, WebP, or SVG image.');
      return;
    }

    // 25MB limit
    if (file.size > 25 * 1024 * 1024) {
      setUploadError('File size exceeds the 25MB maximum limit. Please upload an optimized asset.');
      return;
    }

    setSelectedFile(file);
    const cleanName = file.name.replace(/\.[^/.]+$/, '');
    setCreativeName(cleanName);

    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.onerror = () => {
      setUploadError('Failed to read selected image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleQuickBenchmark = (sampleIndex = 0) => {
    const sample = SAMPLE_IMAGES[sampleIndex];
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      onAssetLoaded(img, {
        filename: sample.title,
        fileSizeFormatted: '480 KB (Vector SVG)',
        fileSizeBytes: 491520,
        fileType: 'image/svg+xml',
        mediumCategory: sample.category,
        targetPlatform: sample.category === 'ui_ux_web' ? 'desktop_web' : 'social_feed',
        viewingDistance: 'desktop_60cm',
      });
      onClose();
    };
    img.src = sample.url;
  };

  const handleProcess = () => {
    if (!previewUrl) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const sizeBytes = selectedFile?.size || 1024 * 750;
      const sizeFormatted = selectedFile
        ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB`
        : '1.20 MB';

      onAssetLoaded(img, {
        filename: creativeName,
        fileSizeFormatted: sizeFormatted,
        fileSizeBytes: sizeBytes,
        fileType: selectedFile?.type || 'image/png',
        mediumCategory: medium,
        targetPlatform,
        viewingDistance,
      });
      onClose();
    };
    img.src = previewUrl;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-foreground" />
            <DialogTitle className="text-base font-semibold">
              Load Asset & Metadata Configuration
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Configure visual context priors and physical display parameters for pixel-grade attention prediction.
          </DialogDescription>
        </DialogHeader>

        {/* 1. Dropzone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${
            isDragging
              ? 'border-foreground bg-secondary/80'
              : 'border-border bg-background/50 hover:bg-muted/40 hover:border-muted-foreground'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
            }}
          />

          {previewUrl ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-28 max-w-xs rounded overflow-hidden border border-border bg-neutral-950 flex items-center justify-center p-1">
                <img src={previewUrl} alt="Upload preview" className="max-h-full object-contain" />
              </div>
              <span className="text-xs font-medium text-foreground">
                {selectedFile?.name || 'Selected Asset'}
              </span>
              <span className="text-[11px] text-muted-foreground">Click or drop to replace</span>
            </div>
          ) : (
            <div className="flex flex-col items-center text-center space-y-2">
              <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
                <FileImage className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">
                  Click to select file or drag & drop image here
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Supports PNG, JPG, JPEG, WebP, SVG (Zero-upload local processing)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Upload Validation Error Alert */}
        {uploadError && (
          <div className="flex items-center gap-2 p-2.5 rounded bg-destructive/15 border border-destructive/30 text-destructive text-xs">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Quick Benchmark Button if user has no file ready */}
        <div className="flex items-center justify-between text-xs py-1 border-y border-border/60">
          <span className="text-muted-foreground text-[11px]">
            No image on hand? Load benchmark test asset:
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleQuickBenchmark(0)}
              className="text-[11px] font-medium px-2 py-1 rounded bg-secondary hover:bg-muted text-foreground transition-colors"
            >
              UI Landing
            </button>
            <button
              onClick={() => handleQuickBenchmark(1)}
              className="text-[11px] font-medium px-2 py-1 rounded bg-secondary hover:bg-muted text-foreground transition-colors"
            >
              Ad Poster
            </button>
            <button
              onClick={() => handleQuickBenchmark(2)}
              className="text-[11px] font-medium px-2 py-1 rounded bg-secondary hover:bg-muted text-foreground transition-colors"
            >
              Book Cover
            </button>
          </div>
        </div>

        {/* 2. Metadata Parameters Form */}
        <div className="space-y-4 pt-1">
          <div>
            <Label className="text-xs font-medium">Creative Asset Label / Title</Label>
            <Input
              value={creativeName}
              onChange={(e) => setCreativeName(e.target.value)}
              className="mt-1 text-xs h-8 bg-background"
              placeholder="e.g. Q4 Checkout Redesign Variant B"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Medium Category */}
            <div>
              <Label className="text-xs font-medium">Domain Calibration</Label>
              <select
                value={medium}
                onChange={(e) => setMedium(e.target.value as DomainProfileId)}
                className="mt-1 w-full text-xs h-8 rounded-md border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {(Object.keys(DOMAIN_PROFILES) as DomainProfileId[]).map((pid) => (
                  <option key={pid} value={pid}>
                    {DOMAIN_PROFILES[pid].name}
                  </option>
                ))}
              </select>
            </div>

            {/* Target Platform */}
            <div>
              <Label className="text-xs font-medium">Target Canvas</Label>
              <select
                value={targetPlatform}
                onChange={(e) => setTargetPlatform(e.target.value as AssetMetadata['targetPlatform'])}
                className="mt-1 w-full text-xs h-8 rounded-md border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="desktop_web">Desktop Web (1440px)</option>
                <option value="mobile_app">Mobile Screen (390px)</option>
                <option value="social_feed">Social Media Ad Feed</option>
                <option value="print_ooh">Print / Billboard OOH</option>
                <option value="packaging">Retail Shelf Packaging</option>
              </select>
            </div>

            {/* Viewing Distance */}
            <div>
              <Label className="text-xs font-medium">Visual Acuity / Distance</Label>
              <select
                value={viewingDistance}
                onChange={(e) => setViewingDistance(e.target.value as AssetMetadata['viewingDistance'])}
                className="mt-1 w-full text-xs h-8 rounded-md border border-input bg-background px-2.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="desktop_60cm">Desktop Monitor (60cm)</option>
                <option value="near_30cm">Near Handheld (30cm)</option>
                <option value="ambient_3m">Ambient Distance (3m+)</option>
              </select>
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleProcess}
            disabled={!previewUrl}
            className="text-xs font-medium"
          >
            Run Neuromorphic Analysis
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
