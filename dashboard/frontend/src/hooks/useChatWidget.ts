import { useCallback, useState } from 'react';

export interface ChatWidgetControls {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export function useChatWidget(initiallyOpen = false): ChatWidgetControls {
  const [isOpen, setIsOpen] = useState(initiallyOpen);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((current: boolean) => !current), []);

  return { isOpen, open, close, toggle };
}