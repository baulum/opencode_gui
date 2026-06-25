import * as vscode from 'vscode';
import { ModelInfo, StreamChunk, FileAttachment } from '../types';
import { ChunkCallback, DoneCallback, ErrorCallback } from '../bridge/opencodeCLI';

const ZEN_BASE_URL = 'https://opencode.ai/zen/v1';

export class ZenAdapter {
  private apiKey: string;
  private outputStream: vscode.OutputChannel;
  private abortController: AbortController | null = null;

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputStream = outputChannel;
    const config = vscode.workspace.getConfiguration('opencode-gui');
    this.apiKey = config.get<string>('zenApiKey') || '';
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    const config = vscode.workspace.getConfiguration('opencode-gui');
    config.update('zenApiKey', key, vscode.ConfigurationTarget.Global);
  }

  async fetchModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${ZEN_BASE_URL}/models`, {
        headers: this.getHeaders(),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.models || data.data || []).map((m: { id: string; name?: string; provider?: string }) => ({
        id: m.id,
        name: m.name || m.id,
        provider: (m.provider as ModelInfo['provider']) || 'zen',
      }));
    } catch (err) {
      this.outputStream.appendLine(
        `[zen] Failed to fetch models: ${err}`
      );
      return this.getFallbackModels();
    }
  }

  private getFallbackModels(): ModelInfo[] {
    return [
      { id: 'opencode/gpt-5.5', name: 'GPT 5.5', provider: 'zen' },
      { id: 'opencode/claude-4', name: 'Claude 4', provider: 'zen' },
      { id: 'opencode/claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'zen' },
      { id: 'opencode/gpt-5.1', name: 'GPT 5.1', provider: 'zen' },
    ];
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }
    return headers;
  }

  async sendMessage(
    message: string,
    model: string,
    systemPrompt: string,
    files: FileAttachment[],
    onChunk: ChunkCallback,
    onDone: DoneCallback,
    onError: ErrorCallback
  ): Promise<void> {
    this.abortController = new AbortController();

    const messages: Array<{ role: string; content: string }> = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    if (files.length > 0) {
      const fileContext = files
        .map((f) => `File: ${f.path}\n\`\`\`\n${f.content}\n\`\`\``)
        .join('\n\n');
      messages.push({ role: 'user', content: `${fileContext}\n\n${message}` });
    } else {
      messages.push({ role: 'user', content: message });
    }

    try {
      const res = await fetch(`${ZEN_BASE_URL}/responses`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          model,
          messages,
          stream: true,
        }),
        signal: this.abortController.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        onError(`Zen API error ${res.status}: ${errText}`);
        onDone();
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        onError('No response body');
        onDone();
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta =
              parsed.delta?.content ||
              parsed.choices?.[0]?.delta?.content ||
              parsed.content ||
              '';
            if (delta) {
              onChunk({ type: 'text', content: delta });
            }
          } catch {
            // skip unparseable lines
          }
        }
      }

      if (buffer.trim()) {
        try {
          const parsed = JSON.parse(buffer.trim().replace(/^data: /, ''));
          const delta = parsed.delta?.content || parsed.content || '';
          if (delta) onChunk({ type: 'text', content: delta });
        } catch {
          // skip
        }
      }

      onDone();
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        onDone();
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      onError(`Zen API error: ${msg}`);
      onDone();
    }
  }

  cancel(): void {
    this.abortController?.abort();
    this.abortController = null;
  }

  dispose(): void {
    this.cancel();
  }
}
