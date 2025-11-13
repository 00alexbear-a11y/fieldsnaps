import { useState, useEffect, useCallback, useRef } from "react";
import { MobileDialog } from "@/components/ui/mobile-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, StopCircle, RotateCcw, Check, X, Loader2 } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";
import { VoiceCaptureState } from "@/hooks/useSpeechRecognition";

interface VoiceCaptureSheetProps {
  isOpen: boolean;
  thumbnailUrl: string;
  transcript: string;
  isRecording: boolean;
  captureState: VoiceCaptureState;
  error: string | null;
  onTranscriptChange: (text: string) => void;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onReRecord: () => void;
  onDone: () => void;
  onCancel: () => void;
}

export function VoiceCaptureSheet({
  isOpen,
  thumbnailUrl,
  transcript,
  isRecording,
  captureState,
  error,
  onTranscriptChange,
  onStartRecording,
  onStopRecording,
  onReRecord,
  onDone,
  onCancel,
}: VoiceCaptureSheetProps) {
  const [shouldAutoStart, setShouldAutoStart] = useState(false);
  const [isSafari, setIsSafari] = useState(false);
  
  // Track programmatic closes to prevent calling onCancel after successful completion
  const isProgrammaticClose = useRef(false);

  // Detect Safari browser for helpful messaging
  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isSafariBrowser = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('android');
    setIsSafari(isSafariBrowser);
  }, []);

  // Set auto-start flag and reset programmatic close flag when dialog opens
  useEffect(() => {
    if (isOpen) {
      setShouldAutoStart(true);
      isProgrammaticClose.current = false;
    } else {
      setShouldAutoStart(false);
    }
  }, [isOpen]);

  // Auto-start recording when sheet opens
  useEffect(() => {
    if (isOpen && shouldAutoStart && !isRecording) {
      const timer = setTimeout(() => {
        onStartRecording();
        setShouldAutoStart(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen, shouldAutoStart, isRecording, onStartRecording]);

  const handleReRecord = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    onReRecord();
    setShouldAutoStart(true);
  };

  const handleDone = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
    if (isRecording) {
      onStopRecording();
    }
    // Mark as programmatic close to prevent onOpenChange from calling handleCancel
    isProgrammaticClose.current = true;
    onDone();
  };

  const handleCancel = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    if (isRecording) {
      onStopRecording();
    }
    // Mark as programmatic close to prevent onOpenChange from calling handleCancel again
    isProgrammaticClose.current = true;
    onCancel();
  };

  const handleToggleRecording = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Medium });
    }
    if (isRecording) {
      onStopRecording();
    } else {
      onStartRecording();
    }
  };

  return (
    <MobileDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isProgrammaticClose.current) {
          // Only call handleCancel for user-initiated closes (backdrop/escape)
          // Don't call it for programmatic closes (after Done/Cancel/Close button)
          // Flag is reset when dialog opens (in useEffect)
          handleCancel();
        }
      }}
      title="Describe the task"
      showCloseButton
      closeLabel="Close voice capture"
      onCancel={handleCancel}
      footer={
        <div className="flex gap-3 w-full">
          {/* Record/Stop Button */}
          <Button
            onClick={handleToggleRecording}
            variant={isRecording ? "destructive" : "outline"}
            className="flex-1"
            data-testid={isRecording ? "button-stop-recording" : "button-start-recording"}
          >
            {isRecording ? (
              <>
                <StopCircle className="w-5 h-5 mr-2" />
                Stop
              </>
            ) : (
              <>
                <Mic className="w-5 h-5 mr-2" />
                Record
              </>
            )}
          </Button>

          {/* Re-record Button */}
          {transcript && !isRecording && (
            <Button
              onClick={handleReRecord}
              variant="outline"
              className="px-4"
              data-testid="button-rerecord"
            >
              <RotateCcw className="w-5 h-5" />
            </Button>
          )}

          {/* Done Button */}
          <Button
            onClick={handleDone}
            disabled={!transcript.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="button-done-voice"
          >
            <Check className="w-5 h-5 mr-2" />
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Photo Thumbnail */}
        <div>
          <img
            src={thumbnailUrl}
            alt="Captured photo"
            className="w-full h-48 object-cover rounded-2xl shadow-md"
            data-testid="img-voice-thumbnail"
          />
        </div>

        {/* Recording/Initializing Status */}
        {captureState === 'initializing' && (
          <div className="flex items-center justify-center gap-3" data-testid="status-initializing">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin motion-reduce:animate-none" />
            <span className="text-sm font-medium text-blue-600">
              {isSafari ? 'Initializing microphone...' : 'Getting ready...'}
            </span>
          </div>
        )}
        
        {captureState === 'listening' && isRecording && (
          <div className="flex items-center justify-center gap-3" data-testid="status-recording">
            <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse motion-reduce:animate-none" />
            <span className="text-sm font-medium text-red-600">Listening...</span>
          </div>
        )}
        
        {captureState === 'processing' && (
          <div className="flex items-center justify-center gap-3" data-testid="status-processing">
            <Loader2 className="w-4 h-4 text-green-600 animate-spin motion-reduce:animate-none" />
            <span className="text-sm font-medium text-green-600">Processing...</span>
          </div>
        )}
        
        {captureState === 'error' && (
          <div className="flex flex-col gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20" data-testid="status-error">
            <div className="flex items-center gap-3">
              <X className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm font-medium text-destructive">
                {error || "Microphone error occurred"}
              </span>
            </div>
            {isSafari && error?.toLowerCase().includes('no speech') && (
              <p className="text-xs text-destructive/80 pl-7">
                Safari requires 2-3 seconds to initialize the microphone. Please wait a moment after tapping Record before speaking.
              </p>
            )}
          </div>
        )}

        {/* Transcript Input with Blinking Cursor */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Task description
          </label>
          <div className="relative">
            <Textarea
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              placeholder="Speak or type the task details..."
              className="min-h-[120px] resize-none text-base"
              data-testid="input-transcript"
            />
            {/* Blinking cursor when initializing or listening with no text */}
            {(captureState === 'initializing' || (captureState === 'listening' && !transcript)) && (
              <div className="absolute top-3 left-3 w-0.5 h-5 bg-foreground animate-pulse motion-reduce:animate-none motion-reduce:opacity-100" />
            )}
          </div>
        </div>

        {/* Helper Text */}
        <p className="text-sm text-muted-foreground text-center">
          {captureState === 'initializing' 
            ? (isSafari ? "Please wait 2-3 seconds while Safari initializes the microphone..." : "Preparing microphone...")
            : captureState === 'listening' && isRecording
            ? "Speak clearly and tap Stop when finished"
            : captureState === 'processing'
            ? "Finalizing transcript..."
            : captureState === 'error'
            ? "You can type the task manually or tap Record to try again"
            : "Tap Record to add more details or Done to continue"
          }
        </p>
      </div>
    </MobileDialog>
  );
}
