import { Session } from "./session";
import { IClaudeAgentSDKClient } from "./types";
import { ClaudeAgentSDKClient } from "./cas-client";


/** Optional parameters applied when creating a new session instance. */
export interface SessionCreationOptions {
  isExplicit?: boolean;
}


export class SessionManager {

  /** List of known sessions, including inactive ones. */
  private sessionsList: Session[] = [];
  private createClient: ()=> IClaudeAgentSDKClient;
  private defaultClient?: IClaudeAgentSDKClient;

  constructor(createClientFunc: ()=> IClaudeAgentSDKClient);
  constructor(client: IClaudeAgentSDKClient);
  constructor(clientOrFunc: IClaudeAgentSDKClient | (() => IClaudeAgentSDKClient)) {
    if (typeof clientOrFunc === 'function') {
      this.createClient = clientOrFunc;
    } else {
      this.defaultClient = clientOrFunc;
      this.createClient = () => clientOrFunc;
    }
  }
  
  get sessions(): Session[] {
    return this.sessionsList;
  }

  /** Sessions sorted by last modification time, useful for quick-select menus. */
  get sessionsByLastModified(): Session[] {
    return [...this.sessionsList].sort(
      (left, right) => right.lastModifiedTime - left.lastModifiedTime,
    );
  }

  /** Look up a session by its Claude session id; optionally trigger a refresh. */
  getSession(sessionId: string, shouldLoadMessages = false) :Session | undefined {
    const existing = this.sessionsList.find(
      (session) => session.claudeSessionId === sessionId,
    );
    if (existing && shouldLoadMessages) {
      void existing.loadFromServer();
    }
    return existing;
  }

  /**
   * Create a new session instance, insert it at the head of the list, and mark it active.
   * This is the central entry point for UIs that spin up ad-hoc conversations.
   */
  createSession(options: SessionCreationOptions = {}): Session {
    const client = this.createClient();
    const session = new Session(client);

    session.isExplicit = options.isExplicit !== false;

    this.sessionsList = [session, ...this.sessionsList];

    return session;
  }

  getOrCreateSession(sessionId?: string, options: SessionCreationOptions = {}): Session {
    let session = sessionId ? this.getSession(sessionId) : undefined;
    if (!session) {
      session = this.createSession(options);
    }
    return session;
  }


  /** Determine whether a session has persisted state worth keeping in memory. */
  private hasPersistentState(session: Session): boolean {
    return Boolean(session.claudeSessionId) || session.messages.length > 0;
  }

  private cleanupEmptySessions() {
    for (const session of this.sessions) {
      if (!session.hasSubscribers() && !this.hasPersistentState(session)) {
        // Keep session for a grace period (could be made configurable)
        setTimeout(() => {
          if (!session.hasSubscribers() && !this.hasPersistentState(session)) {
            this.sessionsList = this.sessionsList.filter(s => s !== session);
            console.log('Cleaned up empty session:', session.claudeSessionId);
          }
        }, 5 * 60000); // 5 minute grace period
      }
    }
  }

  // Note: Removed unsubscribe method as it was WebSocket-specific
  // Use individual session unsubscribe functions returned by session.subscribe()

  /** Factory method to create SessionManager with default client */
  static create(client?: IClaudeAgentSDKClient): SessionManager {
    if (client) {
      return new SessionManager(client);
    }
    return new SessionManager(() => new ClaudeAgentSDKClient());
  }
}
