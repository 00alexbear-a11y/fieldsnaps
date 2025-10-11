import { Camera as CameraIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Camera() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <div className="max-w-md text-center space-y-4">
        <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
          <CameraIcon className="w-10 h-10 text-primary" />
        </div>
        
        <h1 className="text-2xl font-semibold" data-testid="text-camera-title">
          Camera
        </h1>
        
        <p className="text-muted-foreground" data-testid="text-camera-description">
          Full-screen camera interface coming soon. Take photos, select quality presets, and capture instantly.
        </p>

        <div className="pt-4">
          <Button variant="default" size="lg" data-testid="button-enable-camera">
            Enable Camera
          </Button>
        </div>
      </div>
    </div>
  );
}
