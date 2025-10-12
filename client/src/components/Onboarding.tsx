import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Image, Settings, ChevronRight, X } from 'lucide-react';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Welcome to FieldSnaps',
      description: 'Document your job sites with ease. Capture, compress, and organize photos - even offline.',
      icon: Camera,
      color: 'text-primary',
      showLogo: true,
    },
    {
      title: 'Smart Photo Quality',
      description: 'Choose from 3 compression levels: Quick (200KB), Standard (500KB), or Detailed (1MB).',
      icon: Image,
      color: 'text-green-500',
    },
    {
      title: 'Offline-First Design',
      description: 'Photos are saved locally first. Sync to cloud when you have connectivity. Works everywhere.',
      icon: Settings,
      color: 'text-amber-500',
    },
  ];

  const currentStep = steps[step];
  const Icon = currentStep.icon;
  const isLastStep = step === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setStep(step + 1);
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-6 space-y-6 relative">
        <button
          onClick={handleSkip}
          className="absolute top-4 right-4 p-2 hover-elevate active-elevate-2 rounded-md transition-smooth"
          data-testid="button-skip-onboarding"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>

        <div className="flex flex-col items-center text-center space-y-4 pt-4">
          {currentStep.showLogo ? (
            <img 
              src={logoPath} 
              alt="FieldSnaps" 
              className="h-16 w-auto object-contain"
              data-testid="img-fieldsnaps-logo"
            />
          ) : (
            <div className={`w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ${currentStep.color}`}>
              <Icon className="w-10 h-10" />
            </div>
          )}

          <h2 className="text-2xl font-semibold" data-testid={`text-onboarding-title-${step}`}>
            {currentStep.title}
          </h2>

          <p className="text-muted-foreground" data-testid={`text-onboarding-description-${step}`}>
            {currentStep.description}
          </p>
        </div>

        <div className="flex items-center justify-center space-x-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 rounded-full transition-all transition-smooth ${
                index === step 
                  ? 'w-8 bg-primary' 
                  : 'w-2 bg-muted'
              }`}
              data-testid={`indicator-step-${index}`}
            />
          ))}
        </div>

        <div className="flex space-x-3">
          {!isLastStep && (
            <Button
              variant="outline"
              size="default"
              onClick={handleSkip}
              className="flex-1"
              data-testid="button-skip"
            >
              Skip
            </Button>
          )}
          <Button
            variant="default"
            size="default"
            onClick={handleNext}
            className="flex-1"
            data-testid={isLastStep ? "button-get-started" : "button-next"}
          >
            {isLastStep ? 'Get Started' : 'Next'}
            {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
