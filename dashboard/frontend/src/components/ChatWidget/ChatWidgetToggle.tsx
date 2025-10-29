import type { ReactNode } from 'react';

export interface ChatWidgetToggleProps {
  isOpen: boolean;
  onToggle: () => void;
  label?: ReactNode;
}

function ChatWidgetToggle({ isOpen, onToggle, label }: ChatWidgetToggleProps) {
  const baseClass = 'chat-widget__toggle';
  const toggleClass = isOpen ? `${baseClass} ${baseClass}--open` : baseClass;

  return (
    <button
      type="button"
      className={toggleClass}
      aria-pressed={isOpen}
      aria-label={isOpen ? 'Close assistant chat' : 'Open assistant chat'}
      onClick={onToggle}
    >
      {label ?? (isOpen ? '×' : <img src="/baf_logo_readme-cropped.svg" alt="💬" style={{ width: 40, height: 40 }} />)}
    </button>
  );
}

export default ChatWidgetToggle;