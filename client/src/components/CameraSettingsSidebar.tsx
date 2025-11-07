import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Grid3x3, FileText, Save, Camera } from "lucide-react";

type QualityPreset = 'quick' | 'standard' | 'detailed';

interface CameraSettingsSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  
  // Quality settings
  selectedQuality: QualityPreset;
  onQualityChange: (quality: QualityPreset) => void;
  
  // Grid overlay
  showGrid: boolean;
  onShowGridChange: (show: boolean) => void;
  
  // PDF mode
  pdfMode: boolean;
  onPdfModeChange: (enabled: boolean) => void;
  
  // Auto-save
  autoSave: boolean;
  onAutoSaveChange: (enabled: boolean) => void;
}

const QUALITY_OPTIONS = [
  { value: 'quick' as const, label: 'Quick', description: '~200KB - Fast upload, 1280x960' },
  { value: 'standard' as const, label: 'Standard', description: '~500KB - Balanced, 1920x1440' },
  { value: 'detailed' as const, label: 'Detailed', description: '~1.5MB - High quality, 2560x1920' },
];

export function CameraSettingsSidebar({
  open,
  onOpenChange,
  selectedQuality,
  onQualityChange,
  showGrid,
  onShowGridChange,
  pdfMode,
  onPdfModeChange,
  autoSave,
  onAutoSaveChange,
}: CameraSettingsSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[320px] sm:w-[400px]">
        <SheetHeader>
          <SheetTitle>Camera Settings</SheetTitle>
          <SheetDescription>
            Configure photo quality, grid overlay, and capture preferences
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Photo Quality */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm font-medium">Photo Quality</Label>
            </div>
            <RadioGroup
              value={selectedQuality}
              onValueChange={(value) => onQualityChange(value as QualityPreset)}
            >
              {QUALITY_OPTIONS.map((option) => (
                <div key={option.value} className="flex items-start space-x-3 space-y-0">
                  <RadioGroupItem
                    value={option.value}
                    id={`quality-${option.value}`}
                    data-testid={`radio-quality-${option.value}`}
                  />
                  <div className="grid gap-1 leading-none">
                    <Label
                      htmlFor={`quality-${option.value}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {option.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {option.description}
                    </p>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Grid Overlay */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Grid3x3 className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="grid-overlay" className="text-sm font-medium cursor-pointer">
                  Grid Overlay
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show rule-of-thirds grid for composition
                </p>
              </div>
            </div>
            <Switch
              id="grid-overlay"
              checked={showGrid}
              onCheckedChange={onShowGridChange}
              data-testid="switch-grid-overlay"
            />
          </div>

          <Separator />

          {/* PDF Mode */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="pdf-mode" className="text-sm font-medium cursor-pointer">
                  PDF Mode
                </Label>
                <p className="text-xs text-muted-foreground">
                  Optimize photos for PDF export (16:9 landscape)
                </p>
              </div>
            </div>
            <Switch
              id="pdf-mode"
              checked={pdfMode}
              onCheckedChange={onPdfModeChange}
              data-testid="switch-pdf-mode"
            />
          </div>

          <Separator />

          {/* Auto-Save */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Save className="w-4 h-4 text-muted-foreground" />
              <div className="space-y-0.5">
                <Label htmlFor="auto-save" className="text-sm font-medium cursor-pointer">
                  Auto-Save
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically save photos without confirmation
                </p>
              </div>
            </div>
            <Switch
              id="auto-save"
              checked={autoSave}
              onCheckedChange={onAutoSaveChange}
              data-testid="switch-auto-save"
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
