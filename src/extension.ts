import * as vscode from 'vscode';
import { WebviewProvider } from './providers/webviewProvider';

let webviewProvider: WebviewProvider | undefined;

export function activate(context: vscode.ExtensionContext) {
  webviewProvider = new WebviewProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WebviewProvider.viewType,
      webviewProvider,
      { webviewOptions: { retainContextWhenHidden: true } }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('opencode-gui.start', () => {
      vscode.commands.executeCommand(
        'workbench.view.extension.opencode-gui-chat'
      );
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'opencode-gui.newSession',
      () => {
        webviewProvider?.postMessage('new_session');
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'opencode-gui.selectModel',
      () => {
        webviewProvider?.postMessage('open_model_selector');
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'opencode-gui.editSystemPrompt',
      () => {
        webviewProvider?.postMessage('open_system_prompt');
      }
    )
  );
}

export function deactivate() {
  webviewProvider?.dispose();
}
