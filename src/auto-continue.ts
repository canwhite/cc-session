import { SessionManager } from "./session-manager";
import { Session } from "./session";
import { IClaudeAgentSDKClient, AttachmentPayload } from "./types";
import { createClientWithPreset, DEFAULT_PRESETS } from "./cas-client";
import { transferSessionContext } from "./session-context-transfer";

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
    transferSessionContext(this, newSession);

    // Send the message in the new session
    const result = await newSession.send(prompt, attachments);

    return {
      ...result,
      continued: true,
      newSession
    };
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
    const session = super.createSession() as Session;

    // Convert the session to AutoContinueSession
    const autoContinueSession = new AutoContinueSession(session.client, this, {
      continue: this.continueEnabled,
      maxTurns: this.maxTurns,
    });

    // Explicit field transfer — contract is visible, no Object.assign magic
    autoContinueSession.claudeSessionId = session.claudeSessionId;
    autoContinueSession.summary = session.summary;
    autoContinueSession.todos = session.todos;
    autoContinueSession.tools = session.tools;
    autoContinueSession.setUsageDataForTransfer(session.usageData);
    autoContinueSession.isExplicit = session.isExplicit;
    autoContinueSession.permissionMode = session.permissionMode;

    // Replace the session in the list
    const index = this.sessions.indexOf(session);
    if (index !== -1) {
      this.sessions[index] = autoContinueSession;
    }

    return autoContinueSession;
  }
}

/**
 * Create a SessionManager with auto-continue support
 *
 * @param preset - Either an extended preset (with _continue suffix) or a base preset
 * @param options - Configuration options
 */
export function createAutoContinueManager(
  preset: keyof typeof EXTENDED_PRESETS | keyof typeof DEFAULT_PRESETS,
  options?: {
    maxTurns?: number;
    pathToClaudeCodeExecutable?: string;
    systemPrompt?: string;
    continue?: boolean; // Only used for base presets
  }
): AutoContinueSessionManager {
  // Check if it's an extended preset (has _continue suffix)
  const isExtendedPreset = typeof preset === 'string' && preset.endsWith('_continue');

  if (isExtendedPreset) {
    // Handle extended preset
    const extendedPreset = preset as keyof typeof EXTENDED_PRESETS;
    const presetConfig = EXTENDED_PRESETS[extendedPreset];
    const basePreset = extendedPreset.replace('_continue', '') as keyof typeof DEFAULT_PRESETS;

    // Prepare client options, with proper systemPrompt priority:
    // 1. User-provided systemPrompt (highest priority)
    // 2. Extended preset systemPrompt (if available)
    // 3. Default preset systemPrompt (handled by createClientWithPreset)
    const clientOptions: any = {
      pathToClaudeCodeExecutable: options?.pathToClaudeCodeExecutable
    };

    // Only add systemPrompt if explicitly provided by user or in extended preset
    if (options?.systemPrompt !== undefined) {
      clientOptions.systemPrompt = options.systemPrompt;
    } else if ('systemPrompt' in presetConfig && presetConfig.systemPrompt !== undefined) {
      clientOptions.systemPrompt = presetConfig.systemPrompt;
    }

    const client = createClientWithPreset(basePreset, clientOptions);

    // Create auto-continue manager
    return new AutoContinueSessionManager(client, {
      continue: presetConfig.continue ?? true, // Extended presets default to continue: true
      maxTurns: options?.maxTurns ?? presetConfig.maxTurns
    });
  } else {
    // Handle base preset
    const basePreset = preset as keyof typeof DEFAULT_PRESETS;

    const clientOptions: any = {
      pathToClaudeCodeExecutable: options?.pathToClaudeCodeExecutable
    };

    // Only add systemPrompt if explicitly provided
    if (options?.systemPrompt !== undefined) {
      clientOptions.systemPrompt = options.systemPrompt;
    }

    const client = createClientWithPreset(basePreset, clientOptions);

    return new AutoContinueSessionManager(client, {
      continue: options?.continue ?? false, // Base presets default to continue: false
      maxTurns: options?.maxTurns ?? DEFAULT_PRESETS[basePreset].maxTurns
    });
  }
}

