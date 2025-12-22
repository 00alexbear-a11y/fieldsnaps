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
    CapacitorHttp: {
      // Enable native HTTP to bypass CORS issues in iOS WebView
      enabled: true
    },
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
      autoUpdate: true,
      directUpdate: false,
      resetWhenUpdate: false,
      appReadyTimeout: 15000,
      autoDeleteFailed: true,
      autoDeletePrevious: true,
      responseTimeout: 20,
      periodCheckDelay: 600,
      defaultChannel: 'production',
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
