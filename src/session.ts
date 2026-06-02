import { PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import { nanoid } from "nanoid";
import { randomUUID } from "node:crypto";
import {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  TodoItem,
  UsageSummary,
  IClaudeAgentSDKClient,
  AttachmentPayload,
} from "./types";

import { buildUserMessageContent, ChatMessage } from "./chat-message";
import { ClaudeAgentSDKClient } from "./cas-client";
import { MessageIndex } from "./message-index";
import { SubscriptionRouter } from "./subscription-router";

import {
  type BroadcastMessage,
  type SessionSubscriberCallback,
  type MessageSnapshot,
} from "./types";

// Session class to manage a single Claude conversation
export class Session {
  public readonly _id: string;
  public readonly client: IClaudeAgentSDKClient;

  private _index: MessageIndex;
  private _router: SubscriptionRouter;

  private queryPromise: Promise<{ success: boolean; lastAssistantMessage?: any; usage?: any }> | null = null;
  private loadingPromise: Promise<void> | null = null;
  private cancellationToken: { cancelled: boolean } | null = null;

  public claudeSessionId: string | null = null;
  public error: string | undefined;
  public busy = false;
  public isExplicit = false;
  public lastModifiedTime = Date.now();
  public permissionMode: PermissionMode = "default";
  public summary: string | undefined;
  public currentMainLoopModel: string | undefined;
  public todos: TodoItem[] = [];
  public tools: string[] = [];
  protected _usageData: UsageSummary = {
    totalTokens: 0,
    totalCost: 0,
    contextWindow: 0,
  };
  public isLoading = false;
  private pendingTodosBroadcast = false;
  private pendingToolsBroadcast = false;

  constructor(client: IClaudeAgentSDKClient = new ClaudeAgentSDKClient()) {
    if (!client || typeof client !== "object") {
      throw new Error("Session requires a valid client instance");
    }

    const requiredMethods: (keyof IClaudeAgentSDKClient)[] = [
      "queryStream",
      "getSession",
    ];
    for (const method of requiredMethods) {
      if (typeof client[method] !== "function") {
        throw new Error(`Client must implement ${method} method`);
      }
    }

    this._id = nanoid();
    this.client = client;
    this._index = new MessageIndex();
    this._router = new SubscriptionRouter();
  }

  // Delegated to MessageIndex
  get messages(): ChatMessage[] {
    return this._index.messages;
  }

  get messageCount(): number {
    return this._index.messageCount;
  }

  // Check if session has any subscribers
  hasSubscribers(): boolean {
    return this._router.hasSubscribers();
  }

  // Cancel any ongoing operations
  cancel(): void {
    if (this.cancellationToken) {
      this.cancellationToken.cancelled = true;
      this.cancellationToken = null;
    }
    this.busy = false;
    this.queryPromise = null;
    this.error = "Operation cancelled by user";
    this.emitSessionInfo();
  }

  // Subscribe to session updates
  subscribe(callback: SessionSubscriberCallback): () => void {
    if (!callback || typeof callback !== "function") {
      throw new Error("Subscription callback must be a function");
    }

    // Send session info to new subscriber immediately
    try {
      callback(this as any, {
        type: "session_info",
        sessionId: this.claudeSessionId,
        messageCount: this.messageCount,
        isActive: this.queryPromise !== null,
      });
    } catch (error) {
      throw new Error(
        `Subscription callback failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    // Delegate to router
    return this._router.subscribe(callback);
  }

  noticeSubscribers(message: BroadcastMessage): void {
    this._router.noticeSubscribers(this, message);
  }

  setMessages(messages: SDKMessage[]): void {
    // Derive state (todos, tools, usage) from each message before indexing
    for (const message of messages) {
      this.processMessage(message);
    }
    const { diff, lastTimestamp } = this._index.setMessages(messages);

    // Extract summary from first user prompt if not already set
    if (!this.summary) {
      const rendered = this._index.messages;
      const summaryText = extractSummaryFromMessages(rendered);
      if (summaryText) {
        this.summary = summaryText;
      }
    }

    if (lastTimestamp !== null) {
      this.lastModifiedTime = lastTimestamp;
    } else {
      this.lastModifiedTime = Date.now();
    }

    // Broadcast messages_loaded with the full snapshot
    this.noticeSubscribers({
      type: "messages_loaded",
      sessionId: this.claudeSessionId,
      messages: this.messages.map(toSnapshot),
    });

    this.emitSessionInfo();
  }

  get usageData(): UsageSummary {
    return this._usageData;
  }

  set usageData(value: UsageSummary) {
    this._usageData = value;

    this.noticeSubscribers({
      type: "usage_updated",
      sessionId: this.claudeSessionId,
      usage: this.usageData,
    });
  }

  /**
   * Protected setter for use by AutoContinueSession.createSession()
   * to transfer usage data without triggering a broadcast.
   */
  public setUsageDataForTransfer(value: UsageSummary): void {
    this._usageData = value;
  }

  loadFromServer(sessionId?: string): Promise<void> | undefined {
    const targetSessionId = sessionId ?? this.claudeSessionId ?? undefined;
    if (!targetSessionId) {
      return undefined;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.claudeSessionId = targetSessionId;
    this.isLoading = true;
    this.error = undefined;

    this.loadingPromise = (async () => {
      try {
        const { messages } = await this.client.getSession(targetSessionId);
        if (messages.length === 0) {
          // Reset all state
          this._index = new MessageIndex();
          this.summary = undefined;
          this.lastModifiedTime = Date.now();
          this.updateTodosState([]);
          this.updateToolsState([]);
          this.usageData = {
            totalTokens: 0,
            totalCost: 0,
            contextWindow: 0,
          };
          this.busy = false;
          this.isExplicit = false;
          this.noticeSubscribers({
            type: "messages_loaded",
            sessionId: this.claudeSessionId,
            messages: [],
          });
          this.emitSessionInfo();
          return;
        }

        this.summary = undefined;
        this.updateTodosState([]);
        this.updateToolsState([]);
        this.usageData = {
          totalTokens: 0,
          totalCost: 0,
          contextWindow: 0,
        };
        this.setMessages(messages);
        this.busy = false;
        this.isExplicit = false;
      } catch (error) {
        console.error(
          `Failed to load session '${targetSessionId}':`,
          error
        );
        this.error = error instanceof Error ? error.message : String(error);
      } finally {
        this.isLoading = false;
        this.flushPendingStateUpdates();
        this.loadingPromise = null;
      }
    })();

    return this.loadingPromise;
  }

  resumeFrom(sessionId: string): Promise<void> | undefined {
    if (!sessionId) {
      return undefined;
    }
    return this.loadFromServer(sessionId);
  }

  // Process a single user message
  async send(
    prompt: string,
    attachments: AttachmentPayload[] | undefined
  ): Promise<{
    success: boolean;
    error?: string;
    messageCount?: number;
    lastAssistantMessage?: any;
    usage?: any;
  }> {
    if (this.queryPromise) {
      await this.queryPromise;
    }

    const userMessage: SDKUserMessage = {
      type: "user",
      uuid: randomUUID(),
      session_id: "",
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: buildUserMessageContent(prompt, attachments),
      },
    };

    async function* generateMessages() {
      yield userMessage;
    }

    const pendingIndex = this.messageCount + 1;
    console.log(
      `Processing message ${pendingIndex} in session ${this.claudeSessionId}...`
    );

    // Apply user message to index before streaming
    const { diff: userDiff } = this._index.applyIncomingMessage(userMessage);
    this.broadcastMessageDiff(userDiff);

    if (!this.summary) {
      this.summary = prompt;
    }

    this.isExplicit = false;
    this.lastModifiedTime = Date.now();
    this.busy = true;
    this.error = undefined;
    this.cancellationToken = { cancelled: false };

    this.queryPromise = (async () => {
      try {
        const baseOptions = this.claudeSessionId
          ? { resume: this.claudeSessionId }
          : {};

        const clientDefaults = this.client.getDefaultOptions();

        const queryOptions = {
          ...clientDefaults,
          ...baseOptions,
        };

        console.log("Starting query stream...");
        for await (const message of this.client.queryStream(
          generateMessages(),
          queryOptions
        )) {
          if (this.cancellationToken?.cancelled) {
            console.log("Query stream cancelled");
            break;
          }
          console.log("Processing stream message:", message.type);

          this.processIncomingMessage(message);

          if (message.type === "result") {
            console.log("Final result received");
          }
        }
        console.log("Query stream completed");

        const assistantMessages = this.messages.filter(
          (msg) => msg.type === "assistant"
        );
        const lastAssistantMessage =
          assistantMessages.length > 0
            ? assistantMessages[assistantMessages.length - 1]
            : null;

        return {
          success: true,
          lastAssistantMessage,
          usage: this.usageData,
        };
      } catch (error) {
        console.error(
          `Error in session ${this.claudeSessionId}:`,
          error
        );
        this.error = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        this.queryPromise = null;
        this.cancellationToken = null;
        this.busy = false;
        this.emitSessionInfo();
      }
    })();

    try {
      const queryResult = await this.queryPromise;
      this.lastModifiedTime = Date.now();
      return {
        success: true,
        messageCount: this.messageCount,
        lastAssistantMessage: queryResult?.lastAssistantMessage,
        usage: queryResult?.usage,
      };
    } catch (error) {
      const assistantMessages = this.messages.filter(
        (msg) => msg.type === "assistant"
      );
      const lastAssistantMessage =
        assistantMessages.length > 0
          ? assistantMessages[assistantMessages.length - 1]
          : null;

      return {
        success: false,
        error: this.error,
        lastAssistantMessage,
        usage: this.usageData,
      };
    }
  }

  processIncomingMessage(message: SDKMessage): void {
    console.log("Received message:", message);
    this.processMessage(message);

    const { diff, toolResultUpdates, lastTimestamp } =
      this._index.applyIncomingMessage(message);

    if (lastTimestamp !== null) {
      this.lastModifiedTime = lastTimestamp;
    } else {
      this.lastModifiedTime = Date.now();
    }

    this.claudeSessionId = message.session_id || this.claudeSessionId;

    if (message.type === "system") {
      if (message.subtype === "init") {
        this.busy = true;
      }
    } else if (message.type === "result") {
      this.busy = false;
    }

    // Broadcast all message changes
    this.broadcastMessageDiff(diff);

    // Broadcast tool result updates
    const nextMap = this._index.getMessageMap();
    for (const toolUpdate of toolResultUpdates) {
      const msg = nextMap.get(toolUpdate.message.id);
      if (!msg) continue;
      this.noticeSubscribers({
        type: "tool_result_updated",
        sessionId: this.claudeSessionId,
        messageId: msg.id,
        toolUseId: toolUpdate.toolUseId,
        result: toolUpdate.toolResult,
      });
    }

    this.emitSessionInfo();
  }

  /**
   * Broadcast a message diff to all subscribers.
   */
  private broadcastMessageDiff(diff: {
    added: ChatMessage[];
    updated: ChatMessage[];
    removed: string[];
  }): void {
    for (const id of diff.removed) {
      this.noticeSubscribers({
        type: "message_removed",
        sessionId: this.claudeSessionId,
        messageId: id,
      });
    }
    for (const added of diff.added) {
      this.noticeSubscribers({
        type: "message_added",
        sessionId: this.claudeSessionId,
        message: toSnapshot(added),
      });
    }
    for (const updated of diff.updated) {
      this.noticeSubscribers({
        type: "message_updated",
        sessionId: this.claudeSessionId,
        message: toSnapshot(updated),
      });
    }
  }

  private emitSessionInfo(): void {
    this.noticeSubscribers({
      type: "session_info",
      sessionId: this.claudeSessionId,
      messageCount: this.messageCount,
      isActive: this.queryPromise !== null,
    });
  }

  private handleResultMessage(message: SDKResultMessage): void {
    const usage = this.usageData;
    const modelName = this.currentMainLoopModel;
    const contextWindow =
      message.modelUsage?.[modelName || ""]?.contextWindow ??
      usage.contextWindow;

    this.usageData = {
      totalTokens: usage.totalTokens,
      totalCost: message.total_cost_usd,
      contextWindow,
    };
  }

  private processMessage(message: SDKMessage): void {
    if (message.type === "assistant") {
      this.handleAssistantMessage(message);
    } else if (message.type === "system" && message.subtype === "init") {
      if (message.model) {
        this.currentMainLoopModel = message.model;
      }
      if (Array.isArray(message.tools)) {
        this.updateToolsState(message.tools);
      }
      if (message.permissionMode) {
        this.permissionMode = message.permissionMode;
      }
    } else if (
      message.type === "result" &&
      message.total_cost_usd !== undefined
    ) {
      this.handleResultMessage(message);
    }
  }

  private handleAssistantMessage(message: SDKAssistantMessage): void {
    if (message.message && Array.isArray(message.message.content)) {
      for (const block of message.message.content) {
        if (
          block.type === "tool_use" &&
          block.name === "TodoWrite" &&
          block.input &&
          typeof block.input === "object" &&
          "todos" in block.input
        ) {
          const input = block.input as { todos?: TodoItem[] };
          if (input.todos) {
            this.updateTodosState(input.todos);
          }
        }
      }
    }

    if (message.message.usage) {
      this.updateUsage(message.message.usage);
    }
  }

  private updateTodosState(todos: TodoItem[]): void {
    const normalized = todos.map((todo) => ({ ...todo }));
    const changed = !areTodosEqual(this.todos, normalized);
    this.todos = normalized;
    if (!changed) {
      return;
    }

    if (this.isLoading) {
      this.pendingTodosBroadcast = true;
      return;
    }

    this.emitTodosUpdate();
  }

  private updateToolsState(tools: string[]): void {
    const normalized = [...tools];
    const changed = !areStringArraysEqual(this.tools, normalized);
    this.tools = normalized;
    if (!changed) {
      return;
    }

    if (this.isLoading) {
      this.pendingToolsBroadcast = true;
      return;
    }

    this.emitToolsUpdate();
  }

  private flushPendingStateUpdates(): void {
    if (this.pendingTodosBroadcast) {
      this.pendingTodosBroadcast = false;
      this.emitTodosUpdate();
    }

    if (this.pendingToolsBroadcast) {
      this.pendingToolsBroadcast = false;
      this.emitToolsUpdate();
    }
  }

  private emitTodosUpdate(): void {
    this.noticeSubscribers({
      type: "todos_updated",
      sessionId: this.claudeSessionId,
      todos: this.todos,
    });
  }

  private emitToolsUpdate(): void {
    this.noticeSubscribers({
      type: "tools_updated",
      sessionId: this.claudeSessionId,
      tools: this.tools,
    });
  }

  private updateUsage(usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  }): void {
    const totalTokens =
      usage.input_tokens +
      (usage.cache_creation_input_tokens ?? 0) +
      (usage.cache_read_input_tokens ?? 0) +
      usage.output_tokens;

    const previous = this.usageData;

    this.usageData = {
      totalTokens,
      totalCost: previous.totalCost,
      contextWindow: previous.contextWindow,
    };
  }
}

// ---------------------------------------------------------------------------
// Private helpers (previously at bottom of session.ts, now kept here)
// ---------------------------------------------------------------------------

function areTodosEqual(left: TodoItem[], right: TodoItem[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index];
    const b = right[index];
    if (!b || a.content !== b.content || a.status !== b.status) {
      return false;
    }
  }
  return true;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }
  return true;
}

function extractSummaryFromMessages(
  messages: ChatMessage[]
): string | undefined {
  for (const message of messages) {
    if (message.type !== "user") {
      continue;
    }
    for (const part of message.content) {
      const content = part.content;
      if (
        content.type === "text" &&
        typeof content.text === "string" &&
        content.text.trim().length > 0
      ) {
        return content.text.trim();
      }
    }
  }
  return undefined;
}

/** Convert a ChatMessage to a MessageSnapshot for broadcast payloads */
function toSnapshot(msg: ChatMessage): MessageSnapshot {
  return {
    id: msg.id,
    type: msg.type,
    timestamp: msg.timestamp,
    content: msg.content.map((part) => part.toJSON()),
  };
}
