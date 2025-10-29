export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';

export type ServerMessage = unknown;

type MessageHandler = (payload: ServerMessage) => void;
type StatusHandler = (status: ConnectionStatus) => void;

type Teardown = () => void;

interface ChatWebSocketOptions {
  url?: string;
  reconnectDelayMs?: number;
}

/**
 * Lightweight WebSocket service tailored for the dashboard assistant widget.
 * Handles connection lifecycle, reconnection attempts, and basic message parsing.
 */
export class ChatWebSocketService {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly reconnectDelay: number;
  private shouldReconnect = true;
  private reconnectHandle: number | null = null;
  private readonly messageHandlers = new Set<MessageHandler>();
  private readonly statusHandlers = new Set<StatusHandler>();

  constructor(options: ChatWebSocketOptions = {}) {
    const defaultUrl = typeof process !== 'undefined' ? process.env.REACT_APP_CHAT_WS_URL : undefined;

    this.url = options.url ?? defaultUrl ?? 'ws://localhost:8765';
    this.reconnectDelay = options.reconnectDelayMs ?? 2000;
  }

  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.shouldReconnect = true;
    this.notifyStatus('connecting');

    try {
      this.ws = new WebSocket(this.url);
    } catch (error) {
      console.error('[chat-websocket] Failed to create WebSocket:', error);
      this.notifyStatus('error');
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.notifyStatus('connected');
    };

    this.ws.onmessage = (event: MessageEvent) => {
      const payload = this.parsePayload(event.data);
      this.messageHandlers.forEach((handler) => handler(payload));
    };

    this.ws.onerror = (event: Event) => {
      console.warn('[chat-websocket] WebSocket error observed:', event);
      this.notifyStatus('error');
    };

    this.ws.onclose = (event: CloseEvent) => {
      this.ws = null;
      const shouldAttemptReconnect = this.shouldReconnect && event.code !== 1000;

      if (shouldAttemptReconnect) {
        this.notifyStatus('disconnected');
        this.scheduleReconnect();
      } else {
        this.notifyStatus('disconnected');
      }
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectHandle !== null) {
      window.clearTimeout(this.reconnectHandle);
      this.reconnectHandle = null;
    }

    if (this.ws) {
      try {
        this.ws.close(1000, 'client disconnect');
      } catch (error) {
        console.warn('[chat-websocket] Error while closing WebSocket:', error);
      }
      this.ws = null;
    }
  }

  sendMessage(message: string): boolean {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      const payload = JSON.stringify({ action: 'user_message', message });
      this.ws.send(payload);
      return true;
    } catch (error) {
      console.error('[chat-websocket] Failed to send message:', error);
      return false;
    }
  }

  onMessage(handler: MessageHandler): Teardown {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onStatusChange(handler: StatusHandler): Teardown {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) {
      return;
    }

    if (this.reconnectHandle !== null) {
      return;
    }

    this.notifyStatus('reconnecting');
    this.reconnectHandle = window.setTimeout(() => {
      this.reconnectHandle = null;
      this.connect();
    }, this.reconnectDelay);
  }

  private notifyStatus(status: ConnectionStatus): void {
    this.statusHandlers.forEach((handler) => handler(status));
  }

  private parsePayload(data: any): ServerMessage {
    if (typeof data !== 'string') {
      return data;
    }

    const trimmed = data.trim();
    if (!trimmed) {
      return trimmed;
    }

    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch (error) {
        // Fallback to raw string if JSON parsing fails.
        console.warn('[chat-websocket] Failed to parse JSON payload:', error);
      }
    }

    return data;
  }
}
