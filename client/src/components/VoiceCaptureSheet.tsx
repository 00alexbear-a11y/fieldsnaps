import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Mic, StopCircle, RotateCcw, Check, X } from "lucide-react";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Capacitor } from "@capacitor/core";

interface VoiceCaptureSheetProps {
  isOpen: boolean;
  thumbnailUrl: string;
  transcript: string;
  isRecording: boolean;
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
  onTranscriptChange,
  onStartRecording,
  onStopRecording,
  onReRecord,
  onDone,
  onCancel,
}: VoiceCaptureSheetProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [shouldAutoStart, setShouldAutoStart] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setShouldAutoStart(true);
    } else {
      setIsVisible(false);
      setShouldAutoStart(false);
    }
  }, [isOpen]);

  // Auto-start recording when sheet opens
  useEffect(() => {
    if (isVisible && shouldAutoStart && !isRecording) {
      const timer = setTimeout(() => {
        onStartRecording();
        setShouldAutoStart(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, shouldAutoStart, isRecording, onStartRecording]);

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
    setIsVisible(false);
    setTimeout(onDone, 300);
  };

  const handleCancel = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
    if (isRecording) {
      onStopRecording();
    }
    setIsVisible(false);
    setTimeout(onCancel, 300);
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

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 z-[250] bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={handleCancel}
        data-testid="backdrop-voice-capture"
      />
      
      {/* Sheet */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-[260] bg-background rounded-t-3xl shadow-2xl transition-transform duration-300 ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        data-testid="sheet-voice-capture"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-12 h-1 bg-muted rounded-full" />
        </div>

        <div className="px-6 pb-safe-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold tracking-tight">
              Describe the task
            </h2>
            <button
              onClick={handleCancel}
              className="w-8 h-8 rounded-full hover-elevate flex items-center justify-center"
              data-testid="button-cancel-voice"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Photo Thumbnail */}
          <div className="mb-6">
            <img
              src={thumbnailUrl}
              alt="Captured photo"
              className="w-full h-48 object-cover rounded-2xl shadow-md"
              data-testid="img-voice-thumbnail"
            />
          </div>

          {/* Recording Status */}
          {isRecording && (
            <div className="flex items-center justify-center gap-3 mb-4" data-testid="status-recording">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-600">Recording...</span>
            </div>
          )}

          {/* Transcript Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              Task description
            </label>
            <Textarea
              value={transcript}
              onChange={(e) => onTranscriptChange(e.target.value)}
              placeholder="Speak or type the task details..."
              className="min-h-[120px] resize-none text-base"
              data-testid="input-transcript"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {/* Record/Stop Button */}
            <Button
              onClick={handleToggleRecording}
              variant={isRecording ? "destructive" : "outline"}
              className="flex-1 h-12"
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
                className="h-12 px-4"
                data-testid="button-rerecord"
              >
                <RotateCcw className="w-5 h-5" />
              </Button>
            )}

            {/* Done Button */}
            <Button
              onClick={handleDone}
              disabled={!transcript.trim()}
              className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-white"
              data-testid="button-done-voice"
            >
              <Check className="w-5 h-5 mr-2" />
              Done
            </Button>
          </div>

          {/* Helper Text */}
          <p className="text-sm text-muted-foreground text-center mt-4">
            {isRecording 
              ? "Speak clearly and tap Stop when finished"
              : "Tap Record to add more details or Done to continue"
            }
          </p>
        </div>
      </div>
    </>
  );
}
