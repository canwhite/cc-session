import { nanoid } from "nanoid";
import type { BroadcastMessage, SessionSubscriberCallback } from "./types";

/**
 * Owns the subscriber registry and event emission for a Session.
 * Extracted to enable isolated testing of the broadcast seam.
 *
 * The subscriber callback always receives the owning Session as first arg.
 * Session calls router.noticeSubscribers(session, message).
 */
export class SubscriptionRouter {
  private subscribers: Map<string, SessionSubscriberCallback> = new Map();

  hasSubscribers(): boolean {
    return this.subscribers.size > 0;
  }

  subscribe(callback: SessionSubscriberCallback): () => void {
    if (!callback || typeof callback !== "function") {
      throw new Error("Subscription callback must be a function");
    }

    const id = nanoid();
    this.subscribers.set(id, callback);

    return () => {
      this.subscribers.delete(id);
    };
  }

  noticeSubscribers(session: unknown, message: BroadcastMessage): void {
    for (const callback of this.subscribers.values()) {
      callback(session as any, message);
    }
  }
}
