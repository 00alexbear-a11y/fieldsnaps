import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Mic, Check, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface ToDoInstructionScreenProps {
  onDismiss: () => void;
}

export function ToDoInstructionScreen({ onDismiss }: ToDoInstructionScreenProps) {
  const { user } = useAuth();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsVisible(true), 50);
  }, []);

  const handleGotIt = () => {
    if (user?.id) {
      localStorage.setItem(`todo_instruction_seen_${user.id}`, 'true');
    }
    setIsVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div 
      className={`fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center transition-opacity duration-300 ${
        isVisible ? 'opacity-100' : 'opacity-0'
      }`}
      data-testid="screen-todo-instruction"
    >
      <div className="max-w-md mx-auto px-8 text-center">
        {/* Close Button */}
        <button
          onClick={handleGotIt}
          className="absolute top-safe-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          data-testid="button-close-instruction"
        >
          <X className="w-5 h-5 text-white" />
        </button>

        {/* Title */}
        <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">
          Snap & Speak
        </h1>
        
        {/* Subtitle */}
        <p className="text-white/60 text-lg mb-12 leading-relaxed">
          Create to-dos faster with your camera and voice
        </p>

        {/* Flow Visualization */}
        <div className="flex items-center justify-center gap-6 mb-12">
          {/* Step 1: Camera */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <Camera className="w-10 h-10 text-white" />
            </div>
            <span className="text-white/80 text-sm font-medium">Snap</span>
          </div>

          {/* Arrow */}
          <div className="text-white/40 text-3xl font-light">→</div>

          {/* Step 2: Microphone */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <Mic className="w-10 h-10 text-white" />
            </div>
            <span className="text-white/80 text-sm font-medium">Speak</span>
          </div>

          {/* Arrow */}
          <div className="text-white/40 text-3xl font-light">→</div>

          {/* Step 3: Check */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-20 h-20 rounded-full bg-white/10 flex items-center justify-center">
              <Check className="w-10 h-10 text-white" />
            </div>
            <span className="text-white/80 text-sm font-medium">Done</span>
          </div>
        </div>

        {/* Instructions */}
        <div className="space-y-3 mb-12 text-left">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">1</span>
            </div>
            <p className="text-white/70 text-base leading-relaxed">
              Take photos of what needs to be done
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">2</span>
            </div>
            <p className="text-white/70 text-base leading-relaxed">
              Speak the task details for each photo
            </p>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-xs font-bold">3</span>
            </div>
            <p className="text-white/70 text-base leading-relaxed">
              Review, assign, and save all to-dos at once
            </p>
          </div>
        </div>

        {/* CTA Button */}
        <Button
          onClick={handleGotIt}
          className="w-full h-14 bg-white text-black hover:bg-white/90 text-lg font-semibold rounded-2xl"
          data-testid="button-got-it"
        >
          Got it
        </Button>
      </div>
    </div>
  );
}

export function useTodoInstructionScreen() {
  const { user } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    if (user?.id) {
      const seen = localStorage.getItem(`todo_instruction_seen_${user.id}`);
      setShouldShow(!seen);
    }
  }, [user]);

  return {
    shouldShow,
    dismiss: () => setShouldShow(false),
  };
}
