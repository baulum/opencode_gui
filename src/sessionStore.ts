import * as vscode from "vscode";
import { ChatSession, WorkspaceChatState } from "./types";

function createDefaultState(): WorkspaceChatState {
  return {
    sessions: [],
    activeSessionId: undefined,
    systemPrompt:
      "You are a senior software engineer helping with coding workflows inside VS Code. Be precise, practical, and concise.",
    memoryNotes: "",
    defaultModel: "opencode/gpt-5.5",
  };
}

function normalizeSession(session: Partial<ChatSession> & { title?: string }): ChatSession {
  return {
    id: session.id ?? `session_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    name: session.name ?? session.title ?? "New chat",
    model: session.model ?? "opencode/gpt-5.5",
    systemPrompt:
      session.systemPrompt ??
      "You are a senior software engineer helping with coding workflows inside VS Code. Be precise, practical, and concise.",
    createdAt: session.createdAt ?? Date.now(),
    updatedAt: session.updatedAt ?? Date.now(),
    opencodeSessionId: session.opencodeSessionId,
    messages: session.messages ?? [],
  };
}

export class WorkspaceSessionStore {
  private readonly keyPrefix = "opencodeGui.workspaceState:";

  constructor(private readonly context: vscode.ExtensionContext) {}

  private key(): string {
    const workspaceId =
      vscode.workspace.workspaceFolders?.[0]?.uri.toString() ?? "no-workspace";
    return `${this.keyPrefix}${workspaceId}`;
  }

  load(): WorkspaceChatState {
    const state = this.context.workspaceState.get<WorkspaceChatState>(
      this.key(),
      createDefaultState()
    );
    const migratedSessions = (state.sessions ?? []).map((session) => normalizeSession(session as Partial<ChatSession> & { title?: string }));
    return {
      ...createDefaultState(),
      ...state,
      sessions: migratedSessions,
    };
  }

  async save(state: WorkspaceChatState): Promise<void> {
    await this.context.workspaceState.update(this.key(), state);
  }

  async saveSessions(sessions: ChatSession[], activeSessionId?: string): Promise<void> {
    const state = this.load();
    await this.save({
      ...state,
      sessions,
      ...(activeSessionId ? { activeSessionId } : {}),
    });
  }

  async updateSession(session: ChatSession): Promise<void> {
    const state = this.load();
    const sessions = state.sessions.filter((item) => item.id !== session.id);
    sessions.unshift(session);
    await this.save({
      ...state,
      sessions,
      activeSessionId: session.id,
    });
  }

  async deleteSession(sessionId: string): Promise<void> {
    const state = this.load();
    const sessions = state.sessions.filter((item) => item.id !== sessionId);
    await this.save({
      ...state,
      sessions,
      ...(state.activeSessionId === sessionId && sessions[0]?.id ? { activeSessionId: sessions[0].id } : {}),
    });
  }

  async setActiveSession(sessionId?: string): Promise<void> {
    const state = this.load();
    await this.save(sessionId ? { ...state, activeSessionId: sessionId } : { ...state });
  }

  async updateSystemPrompt(systemPrompt: string): Promise<void> {
    const state = this.load();
    await this.save({
      ...state,
      systemPrompt,
    });
  }

  async updateMemoryNotes(memoryNotes: string): Promise<void> {
    const state = this.load();
    await this.save({
      ...state,
      memoryNotes,
    });
  }

  async updateDefaultModel(defaultModel: string): Promise<void> {
    const state = this.load();
    await this.save({
      ...state,
      defaultModel,
    });
  }
}
