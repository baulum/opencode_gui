import * as vscode from 'vscode';
import { Session, Message } from '../types';

export class SessionManager {
  private static STORAGE_KEY = 'opencode-gui.sessions';
  private static CURRENT_SESSION_KEY = 'opencode-gui.currentSessionId';
  private static CONTEXT_KEY = 'opencode-gui.context';

  private sessions: Map<string, Session> = new Map();
  private currentSessionId: string | null = null;
  private context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.load();
  }

  private load(): void {
    const stored = this.context.globalState.get<Record<string, Session>>(
      SessionManager.STORAGE_KEY,
      {}
    );
    this.sessions = new Map(Object.entries(stored));
    const currentId = this.context.globalState.get<string>(
      SessionManager.CURRENT_SESSION_KEY
    );
    this.currentSessionId = currentId ?? null;
  }

  private save(): void {
    const obj: Record<string, Session> = {};
    this.sessions.forEach((s, k) => { obj[k] = s; });
    this.context.globalState.update(SessionManager.STORAGE_KEY, obj);
    if (this.currentSessionId) {
      this.context.globalState.update(
        SessionManager.CURRENT_SESSION_KEY,
        this.currentSessionId
      );
    }
  }

  createSession(model: string = ''): Session {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const session: Session = {
      id,
      name: `Session ${this.sessions.size + 1}`,
      model,
      messages: [],
      systemPrompt: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sessions.set(id, session);
    this.currentSessionId = id;
    this.save();
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  getCurrentSession(): Session | undefined {
    if (!this.currentSessionId) return undefined;
    return this.sessions.get(this.currentSessionId);
  }

  setCurrentSession(id: string): void {
    if (this.sessions.has(id)) {
      this.currentSessionId = id;
      this.save();
    }
  }

  addMessage(sessionId: string, message: Message): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.messages.push(message);
    session.updatedAt = Date.now();
    this.save();
  }

  updateMessage(
    sessionId: string,
    messageId: string,
    updates: Partial<Message>
  ): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    const idx = session.messages.findIndex((m) => m.id === messageId);
    if (idx === -1) return;
    session.messages[idx] = { ...session.messages[idx], ...updates };
    session.updatedAt = Date.now();
    this.save();
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
    if (this.currentSessionId === id) {
      this.currentSessionId =
        this.sessions.keys().next().value ?? null;
    }
    this.save();
  }

  renameSession(id: string, name: string): void {
    const session = this.sessions.get(id);
    if (!session) return;
    session.name = name;
    session.updatedAt = Date.now();
    this.save();
  }

  setSystemPrompt(sessionId: string, prompt: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.systemPrompt = prompt;
    this.save();
  }

  setModel(sessionId: string, model: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.model = model;
    this.save();
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).sort(
      (a, b) => b.updatedAt - a.updatedAt
    );
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }
}
