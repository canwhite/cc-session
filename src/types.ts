import type {
  SDKMessage,
  SDKUserMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  Options as SDKOptions,
} from "@anthropic-ai/claude-agent-sdk";

export type {
  SDKUserMessage,
  SDKMessage,
  SDKAssistantMessage,
  SDKResultMessage,
  SDKOptions,
};

export type ChatMessageType = SDKMessage["type"];

export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ImageContentSource {
  type: "base64";
  media_type: string;
  data: string;
}

export interface ImageContentBlock {
  type: "image";
  source: ImageContentSource;
}

export interface DocumentContentSource {
  type: "base64" | "text";
  media_type: string;
  data: string;
}

export interface DocumentContentBlock {
  type: "document";
  source: DocumentContentSource;
  title?: string;
}

export interface ToolUseContentBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ThinkingContentBlock {
  type: "thinking";
  thinking?: string;
}

export interface ToolResultContentBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | TextContentBlock[];
  is_error: boolean;
}

export type APIAssistantContentBlock =
  SDKAssistantMessage["message"]["content"];

export type UserContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | DocumentContentBlock
  | ToolResultContentBlock;

export type AssistantContentBlock =
  | TextContentBlock
  | ImageContentBlock
  | DocumentContentBlock
  | ToolUseContentBlock
  | ThinkingContentBlock
  | ToolResultContentBlock
  | APIAssistantContentBlock;

export type MessageContentBlock = UserContentBlock | AssistantContentBlock;

/** Attachment payload for user-supplied assets such as images or documents. */
export interface AttachmentPayload {
  id?: string;
  name: string;
  mediaType: string;
  data: string;
}

/** Aggregated usage metrics returned by the Claude Agent service. */
export interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  contextWindow: number;
}

/** Todo item emitted by Claude's TodoWrite tool. */
export interface TodoItem {
  content: string;
  status: string;
}

export interface IClaudeAgentSDKClient {
  queryStream(
    prompt: string | AsyncIterable<SDKUserMessage>,
    options?: Partial<SDKOptions>
  ): AsyncIterable<SDKMessage>;

  getSession(
    sessionId: string | undefined
  ): Promise<{ messages: SDKMessage[] }>;
}

// Broadcast message types
export type BroadcastMessageType =
  | "session_info"
  | "messages_loaded"
  | "usage_updated"
  | "message_added"
  | "message_updated"
  | "message_removed"
  | "todos_updated"
  | "tools_updated"
  | "tool_result_updated";

export interface BaseBroadcastMessage {
  type: BroadcastMessageType;
  sessionId: string | null;
}

export interface SessionInfoBroadcastMessage extends BaseBroadcastMessage {
  type: "session_info";
  messageCount: number;
  isActive: boolean;
}

export interface UsageUpdateBroadcastMessage extends BaseBroadcastMessage {
  type: "usage_updated";
  usage: UsageSummary;
}

export interface TodosUpdateBroadcastMessage extends BaseBroadcastMessage {
  type: "todos_updated";
  todos: TodoItem[];
}

export interface ToolsUpdateBroadcastMessage extends BaseBroadcastMessage {
  type: "tools_updated";
  tools: string[];
}

export interface MessageAddedBroadcastMessage extends BaseBroadcastMessage {
  type: "message_added";
  message: any;
}

export interface MessageUpdatedBroadcastMessage extends BaseBroadcastMessage {
  type: "message_updated";
  message: any;
}

export interface MessageRemovedBroadcastMessage extends BaseBroadcastMessage {
  type: "message_removed";
  messageId: string;
}

export interface MessagesLoadedBroadcastMessage extends BaseBroadcastMessage {
  type: "messages_loaded";
  messages: any[];
}

export interface ToolResultUpdatedBroadcastMessage
  extends BaseBroadcastMessage {
  type: "tool_result_updated";
  messageId: string;
  toolUseId: string;
  result: ToolResultContentBlock;
}

export type BroadcastMessage =
  | SessionInfoBroadcastMessage
  | MessagesLoadedBroadcastMessage
  | UsageUpdateBroadcastMessage
  | TodosUpdateBroadcastMessage
  | ToolsUpdateBroadcastMessage
  | MessageAddedBroadcastMessage
  | MessageUpdatedBroadcastMessage
  | MessageRemovedBroadcastMessage
  | ToolResultUpdatedBroadcastMessage;

export type SessionSubscriberCallback = (
  session: any,
  message: BroadcastMessage
) => void;
