import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { ModelInfo, SlashCommandInfo, Session } from '../types';

interface VSCodeAPI {
  postMessage: (msg: Record<string, unknown>) => void;
  getState: () => Record<string, unknown> | undefined;
  setState: (state: Record<string, unknown>) => void;
}

let vsApi: VSCodeAPI | null = null;
try {
  vsApi = window.acquireVsCodeApi();
} catch {
  vsApi = {
    postMessage: () => {},
    getState: () => ({}),
    setState: () => {},
  };
}

export function useVSCodeAPI() {
  const store = useStore;
  const apiRef = useRef(vsApi);

  const postMessage = useCallback(
    (type: string, payload?: Record<string, unknown>) => {
      apiRef.current?.postMessage({ type, payload });
    },
    []
  );

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'state': {
          const payload = msg.payload as {
            currentSession: Session | null;
            sessions: Session[];
            currentSessionId: string | null;
            settings?: { zenApiKey?: string };
          };
          store.setState({
            sessions: payload.sessions || [],
            currentSessionId: payload.currentSessionId,
            messages: payload.currentSession?.messages || [],
            settings: {
              zenApiKey: payload.settings?.zenApiKey || '',
            },
          });
          break;
        }
        case 'update_message': {
          const { messageId, content, status, error } = msg.payload as {
            messageId: string;
            content?: string;
            status?: string;
            error?: string;
          };
          const updates: Record<string, unknown> = {};
          if (content !== undefined) updates.content = content;
          if (status) updates.status = status;
          if (error) updates.error = error;
          store.getState().updateMessage(messageId, updates);
          break;
        }
        case 'models_list': {
          const models = msg.payload?.models as ModelInfo[];
          if (models) store.getState().setModels(models);
          break;
        }
        case 'slash_commands': {
          const commands = msg.payload?.commands as SlashCommandInfo[];
          if (commands) store.getState().setSlashCommands(commands);
          break;
        }
        case 'system_message': {
          const content = msg.payload?.content as string;
          if (content) {
            store.getState().addMessage({
              id: Date.now().toString(36),
              role: 'system',
              content,
              status: 'complete',
              timestamp: Date.now(),
            });
          }
          break;
        }
        case 'open_model_selector':
        case 'open_system_prompt':
        case 'toggle_setting': {
          const key = msg.payload?.key as string | undefined;
          if (key === 'thinking') {
            store.setState({ thinking: !store.getState().thinking });
          } else if (key === 'compact') {
            store.setState({ compact: !store.getState().compact });
          }
          break;
        }
        case 'new_session': {
          store.getState().setMessages([]);
          break;
        }
        case 'cancelled': {
          store.getState().setProcessing(false);
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    postMessage('ready');

    return () => window.removeEventListener('message', handler);
  }, [postMessage, store]);

  return { postMessage };
}
