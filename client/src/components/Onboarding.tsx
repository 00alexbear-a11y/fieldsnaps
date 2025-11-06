import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Camera, Home, Share2, Cloud, X } from 'lucide-react';
import logoPath from '@assets/Fieldsnap logo v1.2_1760310501545.png';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: 'Take & annotate photos',
      description: 'Capture jobsite photos instantly. Add arrows, text, and measurements to document issues clearly.',
      icon: Camera,
      color: 'text-primary',
    },
    {
      title: 'Organize by project',
      description: 'Keep all your photos organized by project. Never waste time searching through camera rolls again.',
      icon: Home,
      color: 'text-primary',
    },
    {
      title: 'Share instantly',
      description: 'Generate shareable links for clients and teams. No more texting individual photos or managing email attachments.',
      icon: Share2,
      color: 'text-primary',
    },
    {
      title: 'Cloud backup',
      description: 'Your photos are automatically backed up to the cloud. Access them from any device, anytime.',
      icon: Cloud,
      color: 'text-primary',
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
          <div className={`w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center ${currentStep.color}`}>
            <Icon className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-semibold" data-testid={`text-onboarding-title-${step}`}>
            {currentStep.title}
          </h2>

          <p className="text-muted-foreground text-lg" data-testid={`text-onboarding-description-${step}`}>
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

        <Button
          variant="default"
          size="lg"
          onClick={handleNext}
          className="w-full"
          data-testid={isLastStep ? "button-get-started" : "button-next"}
        >
          {isLastStep ? 'Get Started' : 'Next'}
        </Button>

        {!isLastStep && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkip}
            className="w-full text-muted-foreground"
            data-testid="button-skip"
          >
            Skip tour
          </Button>
        )}
      </Card>
    </div>
  );
}
