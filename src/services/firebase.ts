import {getApp, getApps, initializeApp} from 'firebase/app';
import {initializeAppCheck, ReCaptchaEnterpriseProvider} from 'firebase/app-check';

const firebaseConfig = {
  apiKey: 'AIzaSyBRMmJ8RLuKgESRkBBBw2jFppIKVnKaFRU',
  authDomain: 'spliittrr.firebaseapp.com',
  projectId: 'spliittrr',
  storageBucket: 'spliittrr.firebasestorage.app',
  messagingSenderId: '44032231772',
  appId: '1:44032231772:web:215039d6287a627bfed999',
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

if (import.meta.env.DEV) {
  Object.assign(globalThis, {FIREBASE_APPCHECK_DEBUG_TOKEN: true});
}

export const firebaseAppCheck = initializeAppCheck(firebaseApp, {
  provider: new ReCaptchaEnterpriseProvider('6LejI2YtAAAAAJTUvhmnA8e0KPUu2brIcB3pfxXw'),
  isTokenAutoRefreshEnabled: true,
});
