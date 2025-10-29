import { createRoot } from 'react-dom/client';

import ChatWidget from './ChatWidget';

let root: ReturnType<typeof createRoot> | null = null;

export function mountChatWidget() {
  if (typeof document === 'undefined') {
    return;
  }

  if (!root) {
    const container = document.createElement('div');
    container.setAttribute('id', 'chat-widget-root');
    document.body.appendChild(container);
    root = createRoot(container);
    root.render(<ChatWidget />);
  }
}

export function unmountChatWidget() {
  if (root) {
    root.unmount();
    root = null;
    const existingContainer = document.getElementById('chat-widget-root');
    if (existingContainer?.parentNode) {
      existingContainer.parentNode.removeChild(existingContainer);
    }
  }
}