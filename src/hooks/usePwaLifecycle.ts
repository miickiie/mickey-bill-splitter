import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const INSTALL_DISMISS_KEY = 'bill-splitter:pwa-install-dismissed';
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;
const UPDATE_ACTIVATION_TIMEOUT_MS = 15 * 1000;
const deferReloadToLifecycle = () => {};

type InstallOutcome = 'accepted' | 'dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: InstallOutcome;
    platform: string;
  }>;
}

interface NavigatorWithStandalone extends Navigator {
  standalone?: boolean;
}

interface WindowWithTelegram extends Window {
  Telegram?: {
    WebApp?: {
      initData?: string;
    };
  };
}

export type InstallOffer = 'native' | 'ios' | null;

export interface PwaLifecycle {
  installOffer: InstallOffer;
  requestInstall: () => Promise<void>;
  dismissInstall: () => void;
  updateAvailable: boolean;
  updateInProgress: boolean;
  updateError: boolean;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

const isStandalone = () => {
  const navigatorWithStandalone = navigator as NavigatorWithStandalone;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    navigatorWithStandalone.standalone === true
  );
};

const isIosDevice = () => {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
};

const isTelegramWebView = () => {
  return Boolean((window as WindowWithTelegram).Telegram?.WebApp?.initData);
};

const waitForControllerChange = () => {
  let cancel = () => {};

  const promise = new Promise<boolean>((resolve) => {
    let settled = false;
    let timeoutId: number | undefined;

    const finish = (controllerChanged: boolean) => {
      if (settled) return;
      settled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      resolve(controllerChanged);
    };

    const handleControllerChange = () => finish(true);

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    timeoutId = window.setTimeout(() => finish(false), UPDATE_ACTIVATION_TIMEOUT_MS);
    cancel = () => finish(false);
  });

  return { promise, cancel };
};

const wasInstallDismissed = () => {
  try {
    return sessionStorage.getItem(INSTALL_DISMISS_KEY) === 'true';
  } catch {
    return false;
  }
};

export function usePwaLifecycle(): PwaLifecycle {
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installDismissed, setInstallDismissed] = useState(wasInstallDismissed);
  const [installed, setInstalled] = useState(isStandalone);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [updateInProgress, setUpdateInProgress] = useState(false);
  const [updateError, setUpdateError] = useState(false);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onNeedReload: deferReloadToLifecycle,
    onRegisteredSW: (_serviceWorkerUrl, registration) => {
      registrationRef.current = registration;
    },
    onRegisterError: (error) => {
      console.error('Service worker registration failed:', error);
    },
  });

  useEffect(() => {
    const displayMode = window.matchMedia('(display-mode: standalone)');

    const handleInstalledState = () => {
      setInstalled(isStandalone());
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setInstalled(true);
    };

    displayMode.addEventListener('change', handleInstalledState);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      displayMode.removeEventListener('change', handleInstalledState);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      if (!installDismissed && !installed) {
        setDeferredPrompt(event as BeforeInstallPromptEvent);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [installDismissed, installed]);

  useEffect(() => {
    const checkForUpdate = () => {
      const registration = registrationRef.current;
      if (!registration || !navigator.onLine || document.visibilityState !== 'visible') return;

      void registration.update().catch((error) => {
        console.error('Service worker update check failed:', error);
      });
    };

    const intervalId = window.setInterval(checkForUpdate, UPDATE_INTERVAL_MS);
    document.addEventListener('visibilitychange', checkForUpdate);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', checkForUpdate);
    };
  }, []);

  const persistInstallDismissal = useCallback(() => {
    try {
      sessionStorage.setItem(INSTALL_DISMISS_KEY, 'true');
    } catch {
      // The in-memory state still dismisses the prompt if storage is unavailable.
    }
    setInstallDismissed(true);
    setDeferredPrompt(null);
  }, []);

  const requestInstall = useCallback(async () => {
    if (!deferredPrompt) return;

    const promptEvent = deferredPrompt;
    setDeferredPrompt(null);

    try {
      await promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') {
        setInstalled(true);
      } else {
        persistInstallDismissal();
      }
    } catch (error) {
      console.error('App install prompt failed:', error);
      persistInstallDismissal();
    }
  }, [deferredPrompt, persistInstallDismissal]);

  const applyUpdate = useCallback(async () => {
    if (!needRefresh || updateInProgress) return;

    setUpdateError(false);
    setUpdateInProgress(true);
    const controllerChange = waitForControllerChange();

    try {
      await updateServiceWorker();
      const activated = await controllerChange.promise;
      if (!activated) {
        throw new Error('Timed out waiting for the updated service worker to activate.');
      }
      window.location.reload();
    } catch (error) {
      console.error('Service worker update failed:', error);
      setUpdateError(true);
    } finally {
      controllerChange.cancel();
      setUpdateInProgress(false);
    }
  }, [needRefresh, updateInProgress, updateServiceWorker]);

  const installOffer: InstallOffer =
    installed || installDismissed
      ? null
      : deferredPrompt
        ? 'native'
        : isIosDevice() && !isTelegramWebView()
          ? 'ios'
          : null;

  return {
    installOffer,
    requestInstall,
    dismissInstall: persistInstallDismissal,
    updateAvailable: needRefresh && !updateDismissed,
    updateInProgress,
    updateError,
    applyUpdate,
    dismissUpdate: () => setUpdateDismissed(true),
  };
}
