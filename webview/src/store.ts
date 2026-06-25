import { create } from 'zustand';
import { Message, Session, ModelInfo, SlashCommandInfo, AppSettings, AgentStatus, ToolCall, ExecutionBlock } from './types';

interface ChatStore {
  sessions: Session[];
  currentSessionId: string | null;
  messages: Message[];
  models: ModelInfo[];
  settings: AppSettings;
  slashCommands: SlashCommandInfo[];
  processing: boolean;
  agentStatus: AgentStatus;
  executionBlocks: ExecutionBlock[];

  setState: (state: Partial<ChatStore>) => void;
  setSessions: (sessions: Session[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  updateMessage: (id: string, updates: Partial<Message>) => void;
  setModels: (models: ModelInfo[]) => void;
  setProcessing: (processing: boolean) => void;
  setAgentStatus: (status: AgentStatus) => void;
  setSlashCommands: (commands: SlashCommandInfo[]) => void;

  addToolCall: (messageId: string, toolCall: ToolCall) => void;
  updateToolCall: (messageId: string, toolCallId: string, updates: Partial<ToolCall>) => void;
  setThinking: (messageId: string, thinking: string) => void;
  appendToResponse: (messageId: string, content: string) => void;

  buildExecutionBlocks: () => ExecutionBlock[];
}

export const useStore = create<ChatStore>((set, get) => ({
  sessions: [],
  currentSessionId: null,
  messages: [],
  models: [],
  settings: { zenApiKey: '', showThinking: true, compactMode: false, showTimestamps: false },
  slashCommands: [],
  processing: false,
  agentStatus: 'idle',
  executionBlocks: [],

  setState: (state) => set(state),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSessionId: (id) => set({ currentSessionId: id }),
  setMessages: (messages) => set({ messages }),
  addMessage: (message) =>
    set((state) => ({ messages: [...state.messages, message] })),
  updateMessage: (id, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    })),
  setModels: (models) => set({ models }),
  setProcessing: (processing) => set({ processing }),
  setAgentStatus: (status) => set({ agentStatus: status }),
  setSlashCommands: (commands) => set({ slashCommands: commands }),

  addToolCall: (messageId, toolCall) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, toolCalls: [...(m.toolCalls || []), toolCall] }
          : m
      ),
    })),

  updateToolCall: (messageId, toolCallId, updates) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              toolCalls: (m.toolCalls || []).map((tc) =>
                tc.id === toolCallId ? { ...tc, ...updates } : tc
              ),
            }
          : m
      ),
    })),

  setThinking: (messageId, thinking) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId ? { ...m, thinking } : m
      ),
    })),

  appendToResponse: (messageId, content) =>
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === messageId
          ? { ...m, content: m.content + content, status: 'streaming' }
          : m
      ),
    })),

  buildExecutionBlocks: () => {
    const { messages } = get();
    const blocks: ExecutionBlock[] = [];
    let i = 0;

    while (i < messages.length) {
      if (messages[i].role === 'user') {
        const userMsg = messages[i];
        const response = messages.find(
          (m, idx) => idx > i && m.role === 'assistant'
        );
        blocks.push({
          id: userMsg.id,
          userMessage: userMsg,
          thinking: response?.thinking,
          thinkingExpanded: false,
          toolCalls: response?.toolCalls || [],
          response: response || {
            id: '',
            role: 'assistant',
            content: '',
            status: 'streaming',
            timestamp: Date.now(),
          },
        });
        if (response) {
          i = messages.indexOf(response);
        } else {
          break;
        }
      }
      i++;
    }

    return blocks;
  },
}));
