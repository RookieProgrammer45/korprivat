import type { CapacitorConfig } from '@capacitor/cli';

// The store binary opens the live site. Next.js stays on Vercel.
// Bundle id is permanent after the first App Store or Play upload.
const config: CapacitorConfig = {
  appId: 'com.drivelinkup.app',
  appName: 'DriveLinkUp',
  webDir: 'www',
  server: {
    url: 'https://www.drivelinkup.com',
    androidScheme: 'https',
    allowNavigation: ['www.drivelinkup.com', 'drivelinkup.com'],
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#ffffff',
    },
  },
};

export default config;
