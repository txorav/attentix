import React from 'react';
import { Eye, ShieldCheck, Cloud, GitCompare, Download, Info, Upload } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { DomainProfileId, ExecutionMode, AssetMetadata } from '../core/types';
import { DOMAIN_PROFILES } from '../core/profiles';

interface HeaderProps {
  currentProfile: DomainProfileId;
  onSelectProfile: (id: DomainProfileId) => void;
  executionMode: ExecutionMode;
  onToggleExecutionMode: () => void;
  onOpenUploadModal: () => void;
  onOpenABModal: () => void;
  onOpenExportModal: () => void;
  onOpenSpecsModal: () => void;
  metadata?: AssetMetadata | null;
}

export const Header: React.FC<HeaderProps> = ({
  currentProfile,
  onSelectProfile,
  executionMode,
  onToggleExecutionMode,
  onOpenUploadModal,
  onOpenABModal,
  onOpenExportModal,
  onOpenSpecsModal,
  metadata,
}) => {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/80 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-13 items-center justify-between px-4 sm:px-6">
        {/* Brand & Active File Pill */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground text-background font-semibold text-xs shadow-sm">
              <Eye className="h-4 w-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-tight text-foreground font-sans">
                attentix
              </span>
              <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest px-1 py-0.5 rounded border border-border">
                STUDIO PRO
              </span>
            </div>
          </div>

          <Separator orientation="vertical" className="h-4 hidden sm:block" />

          {/* Active Creative Asset Pill */}
          {metadata && (
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-md bg-secondary/60 border border-border/80 text-xs">
              <span className="font-medium text-foreground truncate max-w-[180px]">
                {metadata.filename}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                {metadata.width}×{metadata.height}
              </span>
            </div>
          )}
        </div>

        {/* Studio Domain Selector Pill */}
        <nav className="hidden xl:flex items-center space-x-1">
          {(Object.keys(DOMAIN_PROFILES) as DomainProfileId[]).map((pid) => {
            const prof = DOMAIN_PROFILES[pid];
            const active = currentProfile === pid;
            return (
              <button
                key={pid}
                onClick={() => onSelectProfile(pid)}
                className={`inline-flex items-center justify-center whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${
                  active
                    ? 'bg-secondary text-secondary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
                title={prof.description}
              >
                {prof.name.split(' ')[0]}
              </button>
            );
          })}
        </nav>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Load / Config Asset Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenUploadModal}
            className="h-8 text-xs gap-1.5 px-3 border-primary/30 text-foreground hover:bg-secondary"
          >
            <Upload className="h-3.5 w-3.5" />
            <span>Load Asset & Metadata</span>
          </Button>

          {/* Privacy & Engine Status Pill */}
          <div
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary/40 border border-border text-xs font-mono"
            title="attentix operates 100% locally in-browser using empirical computer vision algorithms. Zero images leave your device."
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            <span className="text-foreground text-[11px]">Local CV Engine</span>
          </div>

          {/* A/B Compare */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenABModal}
            className="h-8 text-xs gap-1.5 hidden md:inline-flex"
          >
            <GitCompare className="h-3.5 w-3.5" />
            A/B Diff
          </Button>

          {/* Export Telemetry */}
          <Button
            variant="default"
            size="sm"
            onClick={onOpenExportModal}
            className="h-8 text-xs gap-1.5 font-medium"
          >
            <Download className="h-3.5 w-3.5" />
            Export Telemetry
          </Button>

          {/* Technical Specs & Documentation */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSpecsModal}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Scientific Specifications & Mathematical Formulations"
          >
            <Info className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
