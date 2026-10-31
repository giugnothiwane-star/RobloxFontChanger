import { create } from 'zustand';

export type ToastTone = 'info' | 'ok' | 'warn' | 'bad';
export interface Toast {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

interface ToastState {
  toasts: Toast[];
  push: (tone: ToastTone, title: string, body?: string) => void;
  dismiss: (id: number) => void;
}

let seq = 0;
const MAX = 4;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push: (tone, title, body) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, tone, title, body }].slice(-MAX) }));
    setTimeout(() => get().dismiss(id), tone === 'bad' ? 7000 : 4000);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (tone: ToastTone, title: string, body?: string) => useToasts.getState().push(tone, title, body);
