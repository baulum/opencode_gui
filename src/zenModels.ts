import * as vscode from "vscode";
import { ModelOption } from "./types";

interface ZenModelRecord {
  id: string;
  object?: string;
  created?: number;
  owned_by?: string;
}

interface ZenModelsResponse {
  object?: string;
  data: ZenModelRecord[];
}

function displayNameFromId(id: string): string {
  return id
    .replaceAll("-", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function endpointForModel(id: string): string {
  if (id.startsWith("gpt-")) {
    return "https://opencode.ai/zen/v1/responses";
  }
  if (id.startsWith("claude-")) {
    return "https://opencode.ai/zen/v1/messages";
  }
  if (id.startsWith("gemini-")) {
    return `https://opencode.ai/zen/v1/models/${id}`;
  }
  return "https://opencode.ai/zen/v1/chat/completions";
}

export class ZenModelService {
  private cache: { at: number; models: ModelOption[] } | null = null;

  constructor(private readonly context: vscode.ExtensionContext) {}

  async listModels(force = false): Promise<ModelOption[]> {
    if (!force && this.cache && Date.now() - this.cache.at < 5 * 60 * 1000) {
      return this.cache.models;
    }

    const apiKey = await this.context.secrets.get("opencodeGui.zenApiKey");
    const response = await fetch("https://opencode.ai/zen/v1/models", {
      headers: {
        Accept: "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
    });

    if (!response.ok) {
      throw new Error(`Zen model fetch failed: ${response.status} ${response.statusText}`);
    }

    const body = (await response.json()) as ZenModelsResponse;
    const models = (body.data ?? []).map((record) => ({
      id: `opencode/${record.id}`,
      name: record.id,
      provider: "zen" as const,
      endpoint: endpointForModel(record.id),
      displayName: displayNameFromId(record.id),
    }));

    this.cache = { at: Date.now(), models };
    return models;
  }

  async getModelById(id: string): Promise<ModelOption | undefined> {
    const models = await this.listModels();
    return models.find((model) => model.id === id);
  }

  async ensureDefaultModel(): Promise<string> {
    const models = await this.listModels();
    return models[0]?.id ?? "opencode/gpt-5.5";
  }
}
