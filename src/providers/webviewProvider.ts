import * as vscode from 'vscode';
import { SessionManager } from '../session/sessionManager';
import { OpenCodeCLIBridge } from '../bridge/opencodeCLI';
import { ZenAdapter } from '../api/zenAdapter';
import { executeSlashCommand, SlashCommandContext, getSlashCommands } from '../commands/slashCommands';
import { StreamChunk } from '../types';

function getWebviewContent(webview: vscode.Webview, context: vscode.ExtensionContext): string {
  const webviewPath = vscode.Uri.joinPath(context.extensionUri, 'webview', 'dist');
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(webviewPath, 'assets', 'index.js')
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(webviewPath, 'assets', 'index.css')
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'unsafe-eval'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
  <title>OpenCode</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script src="${scriptUri}"></script>
</body>
</html>`;
}

export class WebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'opencode-gui.chat';

  private webviewView: vscode.WebviewView | null = null;
  private sessionManager: SessionManager;
  private cliBridge: OpenCodeCLIBridge;
  private zenAdapter: ZenAdapter;
  private outputChannel: vscode.OutputChannel;
  private context: vscode.ExtensionContext;

  private processing = false;
  private cancelCurrent = false;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.outputChannel = vscode.window.createOutputChannel('OpenCode GUI');
    this.sessionManager = new SessionManager(context);
    this.cliBridge = new OpenCodeCLIBridge(this.outputChannel);
    this.zenAdapter = new ZenAdapter(this.outputChannel);

    if (!this.sessionManager.getCurrentSession()) {
      this.sessionManager.createSession();
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, 'webview', 'dist'),
      ],
    };

    webviewView.webview.html = getWebviewContent(
      webviewView.webview,
      this.context
    );

    webviewView.webview.onDidReceiveMessage((msg) =>
      this.handleWebviewMessage(msg)
    );

    this.sendState();
  }

  private getSlashCommandContext(): SlashCommandContext {
    return {
      sendToWebview: (type, payload) => this.postMessage(type, payload),
      newSession: (model) => {
        this.sessionManager.createSession(model);
        this.sendState();
      },
      renameSession: (id, name) => {
        this.sessionManager.renameSession(id, name);
        this.sendState();
      },
      deleteSession: (id) => {
        this.sessionManager.deleteSession(id);
        this.sendState();
      },
      getCurrentSessionId: () => this.sessionManager.getCurrentSessionId(),
      getAllSessionNames: () =>
        this.sessionManager.getAllSessions().map((s) => ({
          id: s.id,
          name: s.name,
        })),
      selectModel: () => this.postMessage('open_model_selector', {}),
      toggleThinking: () => this.postMessage('toggle_setting', { key: 'thinking' }),
      toggleCompact: () => this.postMessage('toggle_setting', { key: 'compact' }),
    };
  }

  private async handleWebviewMessage(msg: { type: string; payload?: Record<string, unknown> }) {
    switch (msg.type) {
      case 'ready':
        this.sendState();
        break;

      case 'send_message': {
        const input = msg.payload?.text as string;
        if (!input || this.processing) return;

        const session = this.sessionManager.getCurrentSession();
        if (!session) return;

        const ctx = this.getSlashCommandContext();
        if (executeSlashCommand(ctx, input)) return;

        await this.processMessage(input);
        break;
      }

      case 'cancel':
        this.cancelCurrent = true;
        this.cliBridge.cancel();
        this.zenAdapter.cancel();
        this.processing = false;
        this.postMessage('cancelled');
        break;

      case 'select_session': {
        const id = msg.payload?.sessionId as string;
        if (id) {
          this.sessionManager.setCurrentSession(id);
          this.sendState();
        }
        break;
      }

      case 'new_session': {
        const model = msg.payload?.model as string | undefined;
        this.sessionManager.createSession(model);
        this.sendState();
        break;
      }

      case 'delete_session': {
        const id = msg.payload?.sessionId as string;
        if (id) this.sessionManager.deleteSession(id);
        this.sendState();
        break;
      }

      case 'rename_session': {
        const id = msg.payload?.sessionId as string;
        const name = msg.payload?.name as string;
        if (id && name) this.sessionManager.renameSession(id, name);
        this.sendState();
        break;
      }

      case 'update_system_prompt': {
        const sid = this.sessionManager.getCurrentSessionId();
        if (sid) {
          this.sessionManager.setSystemPrompt(
            sid,
            (msg.payload?.prompt as string) || ''
          );
        }
        break;
      }

      case 'select_model': {
        const sid = this.sessionManager.getCurrentSessionId();
        const model = msg.payload?.modelId as string;
        if (sid && model) {
          this.sessionManager.setModel(sid, model);
          this.sendState();
        }
        break;
      }

      case 'update_zen_key': {
        const key = msg.payload?.apiKey as string;
        if (key) this.zenAdapter.setApiKey(key);
        break;
      }

      case 'fetch_models':
        this.fetchAndSendModels();
        break;

      case 'get_slash_commands': {
        this.postMessage('slash_commands', { commands: getSlashCommands() });
        break;
      }

      case 'open_file': {
        const path = msg.payload?.path as string;
        if (path) {
          const uri = vscode.Uri.file(path);
          vscode.window.showTextDocument(uri);
        }
        break;
      }
    }
  }

  private async processMessage(text: string) {
    this.processing = true;
    this.cancelCurrent = false;

    const session = this.sessionManager.getCurrentSession();
    if (!session) return;

    const userMsgId = Date.now().toString(36);
    this.sessionManager.addMessage(session.id, {
      id: userMsgId,
      role: 'user',
      content: text,
      status: 'complete',
      timestamp: Date.now(),
    });

    const assistantId = (Date.now() + 1).toString(36);
    this.sessionManager.addMessage(session.id, {
      id: assistantId,
      role: 'assistant',
      content: '',
      status: 'streaming',
      timestamp: Date.now(),
      model: session.model || undefined,
    });

    this.sendState();

    const files = (session.messages
      .filter((m) => m.role === 'user' && m.files && m.files.length > 0)
      .pop()?.files) || [];

    const useZen = !!session.model;

    const onChunk = (chunk: StreamChunk) => {
      if (this.cancelCurrent) return;
      if (chunk.type === 'text' && chunk.content) {
        const existing = this.sessionManager.getSession(session.id)
          ?.messages.find((m) => m.id === assistantId);
        if (existing) {
          this.sessionManager.updateMessage(session.id, assistantId, {
            content: existing.content + chunk.content,
            status: 'streaming',
          });
          this.postMessage('update_message', {
            sessionId: session.id,
            messageId: assistantId,
            content: existing.content + chunk.content,
            status: 'streaming',
          });
        }
      }
    };

    const onDone = () => {
      if (!this.cancelCurrent) {
        this.sessionManager.updateMessage(session.id, assistantId, {
          status: 'complete',
        });
        this.postMessage('update_message', {
          sessionId: session.id,
          messageId: assistantId,
          status: 'complete',
        });
      }
      this.processing = false;
    };

    const onError = (error: string) => {
      this.sessionManager.updateMessage(session.id, assistantId, {
        status: 'error',
        error,
      });
      this.postMessage('update_message', {
        sessionId: session.id,
        messageId: assistantId,
        status: 'error',
        error,
      });
      this.processing = false;
    };

    try {
      if (useZen) {
        await this.zenAdapter.sendMessage(
          text,
          session.model,
          session.systemPrompt,
          files,
          onChunk,
          onDone,
          onError
        );
      } else {
        await this.cliBridge.sendMessage(
          text,
          session.systemPrompt,
          files,
          onChunk,
          onDone,
          onError
        );
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  private async fetchAndSendModels() {
    const models = await this.zenAdapter.fetchModels();
    this.postMessage('models_list', { models });
  }

  private sendState() {
    const session = this.sessionManager.getCurrentSession();
    const allSessions = this.sessionManager.getAllSessions();
    const config = vscode.workspace.getConfiguration('opencode-gui');

    this.postMessage('state', {
      currentSession: session || null,
      sessions: allSessions,
      currentSessionId: this.sessionManager.getCurrentSessionId(),
      settings: {
        zenApiKey: config.get<string>('zenApiKey') || '',
      },
    });
  }

  public postMessage(type: string, payload?: Record<string, unknown>) {
    this.webviewView?.webview.postMessage({ type, payload });
  }

  dispose(): void {
    this.cliBridge.dispose();
    this.zenAdapter.dispose();
  }
}
