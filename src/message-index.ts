import type { SDKMessage } from "./types";
import {
  ChatMessage,
  appendRenderableMessage,
  coalesceReadMessages,
  extractTimestamp,
} from "./chat-message";

export interface MessageDiff {
  added: ChatMessage[];
  updated: ChatMessage[];
  removed: string[];
}

interface ToolResultUpdate {
  message: ChatMessage;
  toolUseId: string;
  toolResult: import("./types").ToolResultContentBlock;
}

export interface ApplyIncomingResult {
  diff: MessageDiff;
  toolResultUpdates: ToolResultUpdate[];
  lastTimestamp: number | null;
}

/**
 * Owns the message array, message-count tracking, and message-diff computation.
 * Extracted from Session to enable isolated testing of the message-indexing seam.
 */
export class MessageIndex {
  messages: ChatMessage[] = [];
  messageCount = 0;

  /**
   * Replace the entire message set (used by loadFromServer).
   * The processCallback is called for each message to allow the owner (Session)
   * to sync derived state (todos, tools, usage) — extracted to keep this module pure.
   * Returns the diff between old and new state and the last message timestamp.
   */
  setMessages(
    messages: SDKMessage[],
    processCallback?: (message: SDKMessage) => void
  ): { diff: MessageDiff; lastTimestamp: number | null } {
    const rendered: ChatMessage[] = [];
    for (const message of messages) {
      if (processCallback) {
        processCallback(message);
      }
      appendRenderableMessage(rendered, message);
    }
    const nextMessages = coalesceReadMessages(rendered);

    const previousMessages = this.messages;
    const diff = diffMessages(previousMessages, nextMessages, []);

    const lastTimestamp = extractLastMessageTimestamp(messages);

    this.messages = nextMessages;
    this.messageCount = nextMessages.length;

    return { diff, lastTimestamp };
  }

  /**
   * Apply a single incoming SDK message to the index.
   * Returns the diff to be broadcast by the caller (Session/SubscriptionRouter).
   */
  applyIncomingMessage(message: SDKMessage): ApplyIncomingResult {
    const previousMessages = this.messages;
    const workingMessages = [...previousMessages];
    const appendResult = appendRenderableMessage(workingMessages, message);
    const coalescedMessages = coalesceReadMessages(workingMessages);

    const nextMessages = coalescedMessages;
    const diff = diffMessages(previousMessages, nextMessages, appendResult.updatedMessages);

    const rawTimestamp = (message as { timestamp?: unknown }).timestamp;
    const lastTimestamp = extractTimestamp(rawTimestamp);

    this.messages = nextMessages;
    this.messageCount = nextMessages.length;

    return { diff, toolResultUpdates: appendResult.toolResultUpdates, lastTimestamp };
  }

  getMessageMap(): Map<string, ChatMessage> {
    return buildMessageMap(this.messages);
  }
}

function diffMessages(
  previous: ChatMessage[],
  next: ChatMessage[],
  explicitlyUpdated: ChatMessage[] = []
): MessageDiff {
  const previousMap = buildMessageMap(previous);
  const nextMap = buildMessageMap(next);

  const added: ChatMessage[] = [];
  const removed: string[] = [];
  const updatedMap = new Map<string, ChatMessage>();
  const explicitIds = new Set(explicitlyUpdated.map((message) => message.id));

  for (const [id, message] of nextMap) {
    if (!previousMap.has(id)) {
      added.push(message);
    }
  }

  for (const [id] of previousMap) {
    if (!nextMap.has(id)) {
      removed.push(id);
    }
  }

  for (const [id, message] of nextMap) {
    if (explicitIds.has(id)) {
      updatedMap.set(id, message);
      continue;
    }
    const previousMessage = previousMap.get(id);
    if (previousMessage && previousMessage !== message) {
      updatedMap.set(id, message);
    }
  }

  return {
    added,
    updated: Array.from(updatedMap.values()),
    removed,
  };
}

function buildMessageMap(messages: ChatMessage[]): Map<string, ChatMessage> {
  const map = new Map<string, ChatMessage>();
  for (const message of messages) {
    if (!map.has(message.id)) {
      map.set(message.id, message);
    }
  }
  return map;
}

function extractLastMessageTimestamp(messages: SDKMessage[]): number | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = messages[index];
    if (!candidate) {
      continue;
    }
    const timestamp = (candidate as { timestamp?: unknown }).timestamp;
    const extracted = extractTimestamp(timestamp);
    if (extracted !== null) {
      return extracted;
    }
  }
  return null;
}
