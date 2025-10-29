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
import {
  ChatWebSocketService,
  type ConnectionStatus,
  type ServerMessage
} from '../../services/chatWebSocket';
import ChatWidgetToggle from './ChatWidgetToggle';
import './ChatWidget.css';

type ChatMessageRole = 'assistant' | 'user';

interface ChatMessage {
  id: string;
  role: ChatMessageRole;
  content: string;
}

const generateId = () => `${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;

const statusSubtitle: Record<ConnectionStatus, string> = {
  connected: 'Assistant is online and ready to help with the dashboard.',
  connecting: 'Connecting to the assistant…',
  reconnecting: 'Connection dropped. Attempting to reconnect…',
  disconnected: 'Assistant is offline. Trying to re-establish the connection.',
  error: 'Assistant connection error. Retrying shortly.'
};

const hintByStatus: Record<ConnectionStatus, string> = {
  connected: 'Ask a question about the dashboard or its data.',
  connecting: 'Hold on a moment while the assistant connects.',
  reconnecting: 'Messages are paused until the connection returns.',
  disconnected: 'Messages are paused until the assistant comes back online.',
  error: 'Messages are paused until the connection recovers.'
};

const formatServerMessage = (payload: ServerMessage): string => {
  if (typeof payload === 'string') {
    return payload;
  }

  if (payload && typeof payload === 'object') {
    const candidate = (payload as { message?: unknown }).message;
    if (typeof candidate === 'string') {
      return candidate;
    }

    try {
      return JSON.stringify(payload, null, 2);
    } catch (error) {
      console.warn('[chat-widget] Failed to serialise server payload:', error);
    }
  }

  if (payload == null) {
    return '';
  }

  return String(payload);
};

const ChatWidget = () => {
  const [hostElement, setHostElement] = useState<HTMLDivElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const serviceRef = useRef<ChatWebSocketService | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
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

  const handleServerMessage = useCallback((payload: ServerMessage) => {
    const content = formatServerMessage(payload);

    if (!content) {
      return;
    }

    const assistantMessage: ChatMessage = {
      id: `assistant-${generateId()}`,
      role: 'assistant',
      content
    };

    setMessages((previous) => [...previous, assistantMessage]);
  }, []);

  useEffect(() => {
    const service = new ChatWebSocketService();
    serviceRef.current = service;

    const unsubscribeMessage = service.onMessage(handleServerMessage);
    const unsubscribeStatus = service.onStatusChange((status) => {
      setConnectionStatus(status);
    });

    service.connect();

    return () => {
      unsubscribeMessage();
      unsubscribeStatus();
      service.disconnect();
      serviceRef.current = null;
    };
  }, [handleServerMessage]);

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

    const sent = serviceRef.current?.sendMessage(trimmedDraft) ?? false;

    setMessages((previous) => {
      const next = [...previous, userMessage];

      if (!sent) {
        next.push({
          id: `assistant-${generateId()}`,
          role: 'assistant',
          content: 'I could not reach the assistant just now. Please wait for the connection and try again.'
        });
      }

      return next;
    });
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

  const subtitle = statusSubtitle[connectionStatus];
  const hintText = hintByStatus[connectionStatus];

  return createPortal(
    <>
      {isOpen && (
        <section className="chat-widget" aria-label="Assistant chat">
          <header className="chat-widget__header">
            <div>
              <p className="chat-widget__title">Assistant</p>
              <p className="chat-widget__subtitle">{subtitle}</p>
            </div>
            <button type="button" className="chat-widget__close" onClick={close} aria-label="Close chat">
              ×
            </button>
          </header>
          <div className="chat-widget__body" ref={bodyRef} aria-live="polite">
            {connectionStatus !== 'connected' && messages.length === 0 && (
              <div className="chat-widget__loading" role="status" aria-live="polite">
                <span className="chat-widget__spinner" aria-hidden="true" />
                <p>Connecting to the assistant…</p>
              </div>
            )}
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
                disabled={connectionStatus !== 'connected'}
                aria-label="Message the assistant"
              />
              <div className="chat-widget__actions">
                <p className="chat-widget__hint">{hintText}</p>
                <button
                  type="submit"
                  className="chat-widget__send"
                  disabled={!trimmedDraft || connectionStatus !== 'connected'}
                >
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