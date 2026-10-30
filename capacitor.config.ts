import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.alwaseet.b2b',
  appName: 'الوسيط',
  webDir: 'public',
  backgroundColor: '#1E293B',
  server: {
    url: 'http://192.168.8.94:8889',
    cleartext: true,
    androidScheme: 'http',
  },
  android: {
    backgroundColor: '#1E293B',
    allowMixedContent: true,
  },
};

export default config;
