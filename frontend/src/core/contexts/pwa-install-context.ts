import { createContext } from 'react';

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export interface PwaInstallContextValue {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstallAvailable: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<boolean>;
  clearInstallPrompt: () => void;
}

export const PwaInstallContext = createContext<PwaInstallContextValue | null>(null);
