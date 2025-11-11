import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.fieldsnaps.app',
  appName: 'FieldSnaps',
  webDir: 'dist/public',
  server: {
    androidScheme: 'https',
    iosScheme: 'https',
  },
  plugins: {
    App: {
      // Deep linking URL scheme for OAuth callbacks
      appUrlScheme: 'com.fieldsnaps.app'
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
    SplashScreen: {
      launchShowDuration: 0,
      backgroundColor: '#FFFFFF',
    },
    CapacitorUpdater: {
      // Auto-update DISABLED to prevent old dev bundles from overriding production builds
      // This was causing login loops by downloading old bundles with dev server URLs
      autoUpdate: false,
      resetWhenUpdate: false,
      appReadyTimeout: 10000,
      responseDelay: 0,
      statsUrl: 'https://api.capgo.app/stats',
      channelUrl: 'https://api.capgo.app',
    },
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    useLegacyBridge: true, // CRITICAL: Prevents 5-minute timeout issue with TransistorSoft Background Geolocation
  },
};

export default config;
