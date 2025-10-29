import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEventHandler,
  type FormEventHandler,
  type KeyboardEventHandler
} from 'react';
import { createPortal } from 'react-dom';

import { useChatWidget } from '../../hooks/useChatWidget';
import ChatWidgetToggle from './ChatWidgetToggle';
import './ChatWidget.css';

type ChatMessageRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
}

const seedMessages: ChatMessage[] = [
  {
    id: 'assistant-welcome-1',
    role: 'assistant',
    content: 'Hi! The assistant is getting ready. For now you can explore the dashboard and open this chat anytime.'
  },
  {
    id: 'assistant-welcome-2',
    role: 'assistant',
    content: 'When actions are connected, I’ll be able to answer questions and take actions for you.'
  }
];

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const ChatWidget = () => {
  const [hostElement, setHostElement] = useState<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => seedMessages);
  const [draft, setDraft] = useState('');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const { isOpen, toggle, close } = useChatWidget();

  useEffect(() => {
    const host = document.createElement('div');
    host.className = 'chat-widget__host';
    document.body.appendChild(host);
    setHostElement(host);

    return () => {
      host.remove();
      setHostElement(null);
    };
  }, []);

  useEffect(() => {
    if (isOpen && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [isOpen, messages]);

  const trimmedDraft = useMemo(() => draft.trim(), [draft]);

  const sendMessage = useCallback(() => {
    if (!trimmedDraft) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${generateId()}`,
      role: 'user',
      content: trimmedDraft
    };

    const assistantMessage: ChatMessage = {
      id: `assistant-${generateId()}`,
      role: 'assistant',
      content: trimmedDraft
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setDraft('');
  }, [trimmedDraft]);

  const handleSubmit = useCallback<FormEventHandler<HTMLFormElement>>(
    (event) => {
      event.preventDefault();
      sendMessage();
    },
    [sendMessage]
  );

  const handleDraftChange = useCallback<ChangeEventHandler<HTMLTextAreaElement>>((event) => {
    setDraft(event.target.value);
  }, []);

  const handleDraftKeyDown = useCallback<KeyboardEventHandler<HTMLTextAreaElement>>(
    (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  if (!hostElement) {
    return null;
  }

  return createPortal(
    <>
      {isOpen && (
        <section className="chat-widget" aria-label="Assistant chat">
          <header className="chat-widget__header">
            <div>
              <p className="chat-widget__title">Assistant</p>
              <p className="chat-widget__subtitle">I’m here to help with the dashboard.</p>
            </div>
            <button type="button" className="chat-widget__close" onClick={close} aria-label="Close chat">
              ×
            </button>
          </header>
          <div className="chat-widget__body" ref={bodyRef} aria-live="polite">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chat-widget__message chat-widget__message--${message.role}`}
              >
                {message.content}
              </div>
            ))}
          </div>
          <footer className="chat-widget__footer">
            <form className="chat-widget__form" onSubmit={handleSubmit}>
              <textarea
                className="chat-widget__input"
                placeholder="Type your message…"
                rows={2}
                value={draft}
                onChange={handleDraftChange}
                onKeyDown={handleDraftKeyDown}
                aria-label="Message the assistant"
              />
              <div className="chat-widget__actions">
                <p className="chat-widget__hint">The assistant echoes back whatever you send.</p>
                <button type="submit" className="chat-widget__send" disabled={!trimmedDraft}>
                  Send
                </button>
              </div>
            </form>
          </footer>
        </section>
      )}
      <ChatWidgetToggle isOpen={isOpen} onToggle={toggle} />
    </>,
    hostElement
  );
};

export default ChatWidget;