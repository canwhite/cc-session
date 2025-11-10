import { SessionManager } from "./session-manager";
import { Session } from "./session";
import { IClaudeAgentSDKClient, AttachmentPayload } from "./types";
import { createClientWithPreset, DEFAULT_PRESETS } from "./cas-client";

/**
 * Extended preset configuration with continue support
 */
export const EXTENDED_PRESETS = {
  development_continue: {
    maxTurns: 50,
    allowedTools: ["Task", "Bash", "Glob", "Grep", "Read", "Edit", "Write"],
    continue: true
  },
  production_continue: {
    maxTurns: 100,
    allowedTools: [
      "Task", "Bash", "Glob", "Grep", "LS", "ExitPlanMode", "Read", "Edit", "MultiEdit", "Write", "NotebookEdit",
      "WebFetch", "TodoWrite", "WebSearch", "BashOutput", "KillBash",
    ],
    continue: true
  },
  minimal_continue: {
    maxTurns: 20,
    allowedTools: ["Read", "Write", "Edit"],
    continue: true
  },
  question_continue: {
    maxTurns: 50,
    allowedTools: ["Read", "Glob", "Grep", "LS"],
    systemPrompt: "You are a helpful assistant focused on answering questions and providing information. You can read files and search through codebases, but you cannot modify files or execute system commands.",
    continue: true
  }
} as const;

/**
 * Session with automatic continuation support
 */
export class AutoContinueSession extends Session {
  private continueEnabled: boolean;
  private maxTurns: number;
  private sessionManager: AutoContinueSessionManager;

  constructor(
    client: IClaudeAgentSDKClient,
    sessionManager: AutoContinueSessionManager,
    options: { continue?: boolean; maxTurns?: number } = {}
  ) {
    super(client);
    this.sessionManager = sessionManager;
    this.continueEnabled = options.continue ?? false;
    this.maxTurns = options.maxTurns ?? 100;
  }

  /**
   * Send a message with automatic session continuation support
   */
  async send(
    prompt: string,
    attachments?: AttachmentPayload[]
  ): Promise<{
    success: boolean;
    error?: string;
    messageCount?: number;
    lastAssistantMessage?: any;
    usage?: any;
    continued?: boolean;
    newSession?: Session;
  }> {
    if (!this.continueEnabled) {
      // If continue is disabled, use normal send
      return await super.send(prompt, attachments);
    }

    // Check if current session is approaching maxTurns
    const currentMessageCount = this.messages.length;
    // When there are at least 1 message left to reach the limit, trigger continuation
    const triggerThreshold = Math.max(1, this.maxTurns - 5); // Ensure threshold is at least 1
    const isApproachingLimit = currentMessageCount >= triggerThreshold;

    if (!isApproachingLimit) {
      // Use normal send if not approaching limit
      return await super.send(prompt, attachments);
    }

    console.log(`Session ${this.claudeSessionId} is approaching maxTurns limit (${currentMessageCount}/${this.maxTurns}). Creating new session...`);

    // Create new session
    const newSession = this.sessionManager.createSession();

    // Transfer context from old session to new session
    await this.transferSessionContext(this, newSession);

    // Send the message in the new session
    const result = await newSession.send(prompt, attachments);

    return {
      ...result,
      continued: true,
      newSession
    };
  }

  /**
   * Transfer context from old session to new session
   */
  private async transferSessionContext(oldSession: Session, newSession: Session): Promise<void> {
    // Transfer summary
    if (oldSession.summary) {
      newSession.summary = oldSession.summary;
    }

    // Transfer todos
    if (oldSession.todos.length > 0) {
      console.log(`Transferring ${oldSession.todos.length} todos to new session`);
      newSession.todos = [...oldSession.todos];
    }

    // Transfer tools
    if (oldSession.tools.length > 0) {
      console.log(`Transferring ${oldSession.tools.length} tools to new session`);
      newSession.tools = [...oldSession.tools];
    }

    // Transfer usage data
    const oldUsage = oldSession.usageData;
    console.log(`Previous session usage: ${oldUsage.totalTokens} tokens, $${oldUsage.totalCost.toFixed(6)} cost`);

    console.log(`Session context transferred from ${oldSession.claudeSessionId} to ${newSession.claudeSessionId}`);
  }
}

/**
 * Extended session manager that supports automatic session continuation
 */
export class AutoContinueSessionManager extends SessionManager {
  private continueEnabled: boolean;
  private maxTurns: number;

  constructor(
    clientOrFunc: IClaudeAgentSDKClient | (() => IClaudeAgentSDKClient),
    options: { continue?: boolean; maxTurns?: number } = {}
  ) {
    // Call the appropriate super constructor based on the type
    if (typeof clientOrFunc === 'function') {
      super(clientOrFunc);
    } else {
      super(clientOrFunc);
    }
    this.continueEnabled = options.continue ?? false;
    this.maxTurns = options.maxTurns ?? 100;
  }

  /**
   * Create a new session with auto-continue support
   */
  createSession(): AutoContinueSession {
    // Use the parent's createSession method to handle session management
    const session = super.createSession() as any;

    // Convert the session to AutoContinueSession
    const autoContinueSession = new AutoContinueSession(session.client, this, {
      continue: this.continueEnabled,
      maxTurns: this.maxTurns
    });

    // Copy all properties from the original session
    Object.assign(autoContinueSession, session);

    // Replace the session in the list
    const index = this.sessions.indexOf(session);
    if (index !== -1) {
      this.sessions[index] = autoContinueSession;
    }

    return autoContinueSession;
  }
}

/**
 * Create a SessionManager with auto-continue support using preset
 */
export function createAutoContinueManager(
  preset: keyof typeof EXTENDED_PRESETS,
  options?: { maxTurns?: number }
): AutoContinueSessionManager {
  const presetConfig = EXTENDED_PRESETS[preset];

  // Create client with the preset (extract base preset without _continue suffix)
  const basePreset = preset.replace('_continue', '') as keyof typeof DEFAULT_PRESETS;
  const client = createClientWithPreset(basePreset);

  // Create auto-continue manager
  return new AutoContinueSessionManager(client, {
    continue: presetConfig.continue ?? false,
    maxTurns: options?.maxTurns ?? presetConfig.maxTurns
  });
}

/**
 * Create a SessionManager with auto-continue support using custom options
 */
export function createAutoContinueManagerWithOptions(
  preset: keyof typeof DEFAULT_PRESETS,
  options: { continue: boolean; maxTurns?: number }
): AutoContinueSessionManager {
  const client = createClientWithPreset(preset);

  return new AutoContinueSessionManager(client, {
    continue: options.continue,
    maxTurns: options.maxTurns ?? DEFAULT_PRESETS[preset].maxTurns
  });
}