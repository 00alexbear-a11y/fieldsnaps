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
      // Auto-update DISABLED - prevents reload loops and freezing on launch
      autoUpdate: false,
      resetWhenUpdate: false,
      appReadyTimeout: 10000,
      responseDelay: 0,
      statsUrl: undefined,
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
