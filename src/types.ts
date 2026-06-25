import * as vscode from "vscode";

export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  command?: string;
  isStreaming?: boolean;
  metadata?: Record<string, unknown>;
}

export interface AttachedFile {
  name: string;
  path: string;
  content: string;
}

export interface ChatSession {
  id: string;
  name: string;
  model: string;
  systemPrompt: string;
  createdAt: number;
  updatedAt: number;
  opencodeSessionId?: string;
  messages: ChatMessage[];
}

export interface WorkspaceChatState {
  sessions: ChatSession[];
  activeSessionId?: string;
  systemPrompt: string;
  memoryNotes: string;
  defaultModel: string;
}

export interface SendRequest {
  sessionId?: string;
  message: string;
  command?: string;
  systemPrompt: string;
  memoryNotes?: string;
  model: string;
  variant?: string;
  files: AttachedFile[];
  workspaceRoot?: string;
  activeFile?: AttachedFile | null;
  selectedText?: string;
  openFiles?: AttachedFile[];
}

export interface ModelOption {
  id: string;
  name: string;
  provider: "zen" | "opencode";
  endpoint: string;
  displayName: string;
}

export interface StreamEvent {
  type: string;
  timestamp?: number;
  sessionID?: string;
  part?: {
    type?: string;
    text?: string;
    messageID?: string;
    sessionID?: string;
    reason?: string;
    tokens?: {
      total?: number;
      input?: number;
      output?: number;
      reasoning?: number;
      cache?: {
        write?: number;
        read?: number;
      };
    };
  };
  [key: string]: unknown;
}

export interface WebviewToExtensionMessage {
  type:
    | "ready"
    | "send"
    | "stop"
    | "newChat"
    | "switchChat"
    | "updateSystemPrompt"
    | "requestFiles"
    | "requestWorkspaceContext"
    | "deleteChat"
    | "renameChat"
    | "focusInput"
    | "requestState"
    | "saveMemory"
    | "applyPatch"
    | "selectModel"
    | "requestModels"
    | "connectZen";
  payload?: unknown;
}

export interface ExtensionToWebviewMessage {
  type:
    | "state"
    | "append"
    | "sessionStarted"
    | "sessionFinished"
    | "error"
    | "selectedFiles"
    | "workspaceContext"
    | "stopped"
    | "focusInput"
    | "models";
  payload?: unknown;
}

export interface WorkspaceContextPayload {
  activeFile?: AttachedFile | null;
  selectedText?: string;
  openFiles?: AttachedFile[];
}

export interface RequestFileResult {
  files: AttachedFile[];
}

export interface RendererState {
  sessions: ChatSession[];
  activeSessionId?: string;
  systemPrompt: string;
  memoryNotes: string;
  defaultModel: string;
  busy: boolean;
  models: ModelOption[];
  workspaceRoot?: string;
  workspaceContext?: WorkspaceContextPayload;
}

export interface SlashCommandResult {
  command: string;
  prompt: string;
}

export interface ContextSnapshot {
  systemPrompt: string;
  memoryNotes: string;
  workspaceContext: WorkspaceContextPayload;
  files: AttachedFile[];
}

export interface BridgeProgress {
  text?: string;
  sessionID?: string;
  raw?: StreamEvent;
}

export interface BridgeResult {
  sessionID?: string;
  finalText: string;
}

export type DisposableLike = vscode.Disposable;
