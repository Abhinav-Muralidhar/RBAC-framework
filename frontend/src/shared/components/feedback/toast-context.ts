import { createContext } from 'react';
import type { ToastContextValue } from './toast-store';

export const ToastContext = createContext<ToastContextValue | null>(null);
