export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';
export type MessageStatus = 'sending' | 'streaming' | 'complete' | 'error';

export type AgentStatus = 'idle' | 'thinking' | 'calling_tool' | 'executing' | 'streaming' | 'complete' | 'error';

export type ToolStatus = 'running' | 'success' | 'error';

export interface FileAttachment {
  path: string;
  content: string;
  language?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  status: ToolStatus;
  input: string;
  output: string;
  executionTimeMs?: number;
  error?: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  files?: FileAttachment[];
  timestamp: number;
  model?: string;
  error?: string;
  toolCalls?: ToolCall[];
  thinking?: string;
}

export interface ExecutionBlock {
  id: string;
  userMessage: Message;
  thinking?: string;
  thinkingExpanded: boolean;
  toolCalls: ToolCall[];
  response: Message;
}

export interface Session {
  id: string;
  name: string;
  model: string;
  messages: Message[];
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: 'zen' | 'opencode' | 'custom';
  description?: string;
}

export interface SlashCommandInfo {
  command: string;
  description: string;
  category?: string;
}

export interface AppSettings {
  zenApiKey: string;
  showThinking: boolean;
  compactMode: boolean;
  showTimestamps: boolean;
}
