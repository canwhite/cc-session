# CC-Session

A powerful TypeScript library for session management and packaging utilities for Claude Code interactions. This library provides comprehensive tools for managing Claude AI conversations with advanced features like real-time streaming, tool integration, and state management.

## Features

- 🔄 **Real-time Session Management**: Create, manage, and monitor multiple conversation sessions
- 📡 **Streaming Support**: Real-time message streaming with Claude AI
- 🔧 **Tool Integration**: Seamless integration with Claude Code tools (Read, Write, Edit, Bash, etc.)
- 📊 **State Tracking**: Comprehensive usage tracking (tokens, cost, context window)
- 🎯 **Subscription System**: Event-driven architecture for real-time updates
- 🚀 **Bun Optimized**: Built with Bun for optimal performance
- 📦 **TypeScript Support**: Full type safety and IntelliSense support

## Architecture

The library is structured around three core modules extracted from the original monolithic `Session` class:

### Core Modules

| Module | File | Responsibility |
|--------|------|----------------|
| `Session` | `src/session.ts` | Coordinator — holds `MessageIndex` and `SubscriptionRouter`, orchestrates streaming, state derivation, cancellation |
| `MessageIndex` | `src/message-index.ts` | Owns the message array, diff computation, and `ChatMessage` lifecycle |
| `SubscriptionRouter` | `src/subscription-router.ts` | Owns subscriber registry and event emission |
| `ClaudeAgentSDKClient` | `src/cas-client.ts` | SDK adapter — wraps `@anthropic-ai/claude-agent-sdk` |
| `SessionManager` | `src/session-manager.ts` | Factory and lifecycle manager for `Session` instances |
| `AutoContinueSession` | `src/auto-continue.ts` | Session decorator that auto-creates a new session when approaching `maxTurns` |
| `transferSessionContext` | `src/session-context-transfer.ts` | Pure function for transferring session state between sessions on continuation |

### Data Flow

```
session.send(prompt)
    ├─► buildUserMessageContent()       [message-parsing.ts]
    └─► client.queryStream()
            ├─► MessageIndex.applyIncomingMessage()  — diff + broadcast
            ├─► SubscriptionRouter.noticeSubscribers()  — emit to all callbacks
            └─► Session.processMessage()  — derive todos/tools/usage
```

### Subscription System

The subscription model is **push-based**. Subscribe to a `Session` and receive all state transitions:

```typescript
const unsub = session.subscribe((session, message) => {
  switch (message.type) {
    case "message_added":   console.log("added:", message.message); break;
    case "todos_updated":   console.log("todos:", message.todos); break;
    case "usage_updated":   console.log("usage:", message.usage); break;
  }
});
// later: unsub() // unsubscribe
```

Available broadcast types: `session_info`, `messages_loaded`, `usage_updated`, `todos_updated`, `tools_updated`, `message_added`, `message_updated`, `message_removed`, `tool_result_updated`.

## Quick Start

### Prerequisites

Before using this library, you need to have Claude Code installed on your system:

```bash
# Install Claude Code globally
npm install -g @anthropic-ai/claude-code

# Or using Bun
bun install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

### Installation

```bash
# Using Bun
bun add @iamqc/cc-session

# Or using npm
npm install @iamqc/cc-session
```

### Configuration

This library requires the path to the Claude Code executable. You can configure it in several ways:

#### Method 1: Environment Variable (Recommended)

```bash
# Add to your .env file
echo "CLAUDE_CODE_PATH=$(which claude)" >> .env

# Or set in your shell
export CLAUDE_CODE_PATH="/path/to/claude"
```

#### Method 2: Explicit Path in Code

```typescript
const client = createClientWithPreset("development", {
  pathToClaudeCodeExecutable: '/Users/zack/.bun/bin/claude'  // or your path
});
```

#### Finding Your Claude Code Path

```bash
# Find where Claude Code is installed
which claude
# Example output: /Users/zack/.bun/bin/claude

# Or if installed via npm
npm list -g @anthropic-ai/claude-code
```

### Basic Usage

```typescript
import {
  Session,
  SessionManager,
  createClientWithPreset,
} from "@iamqc/cc-session";

// Create a client with development preset
const client = createClientWithPreset("development", {
  pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH || '/Users/zack/.bun/bin/claude'
});

// Create a session
const session = new Session(client);

// Send a message and get the final result directly
const result = await session.send("Hello, Claude!");
console.log("Success:", result.success);

if (result.success && result.lastAssistantMessage) {
  console.log("AI Response:", result.lastAssistantMessage.content);
  console.log("Usage:", result.usage);
}

// Optional: Subscribe to real-time updates for streaming experience
session.subscribe((session, message) => {
  console.log("Session update:", message);
});
```

### Session Management

```typescript
import { SessionManager } from "@iamqc/cc-session";

// Create a session manager
const manager = new SessionManager(() => createClientWithPreset("production"));

// Create multiple sessions
const session1 = manager.createSession();
const session2 = manager.createSession();

// List all sessions
const sessions = manager.sessions;

// Clean up empty sessions
manager.cleanupEmptySessions();
```

## API Reference

### Session Class

The main class for managing individual conversations.

#### Constructor

```typescript
const session = new Session(client: ClaudeAgentSDKClient);
```

#### Methods

- `send(message: string, attachments?: AttachmentPayload[]): Promise<SendResult>` - Send a message to Claude and get the final result
- `cancel(): void` - Cancel the current operation
- `subscribe(callback: SubscriptionCallback): () => void` - Subscribe to session updates; returns an unsubscribe function
- `loadFromServer(sessionId?: string): Promise<void>` - Reload session state from disk

#### SendResult

The `send()` method now returns the final AI response directly:

```typescript
{
  success: boolean;              // Whether the request succeeded
  error?: string;               // Error message if failed
  messageCount?: number;        // Total number of messages in session
  lastAssistantMessage?: any;   // The final AI response message
  usage?: {                    // Usage statistics
    totalTokens: number;
    totalCost: number;
    contextWindow: number;
  };
}
```

#### Events

- `message_added` - New message added to the session
- `tool_result_updated` - Tool result has been updated
- `session_info` - Session state information
- `todo_updated` - Todo list has been updated

### SessionManager Class

Manages multiple conversation sessions.

#### Constructor

```typescript
const manager = new SessionManager(clientFactory: ClientFactory);
```

#### Methods

- `createSession(): Session` - Create a new session
- `getSession(id: string): Session | null` - Get a session by ID
- `sessions: Session[]` - Get all sessions (property, not method)
- `sessionsByLastModified: Session[]` - Get sessions sorted by last modification time

### Client Presets

The library provides four pre-configured client presets:

#### Development Preset

```typescript
const client = createClientWithPreset("development");
// 50 turns, basic tools (Task, Bash, Glob, Grep, Read, Edit, Write)
```

#### Production Preset

```typescript
const client = createClientWithPreset("production");
// 100 turns, full toolset including WebFetch, WebSearch, TodoWrite
```

#### Minimal Preset

```typescript
const client = createClientWithPreset("minimal");
// 20 turns, essential tools only (Read, Write, Edit)
```

#### Question Preset (Read-Only)

```typescript
const client = createClientWithPreset("question");
// 50 turns, read-only tools (Read, Glob, Grep, LS)
// Perfect for Q&A and code analysis without file modifications
```

The **Question Preset** is specifically designed for scenarios where you want to:

- Ask questions about code without risk of modifications
- Analyze codebases safely
- Get information and explanations
- Search through files and directories
- Perform read-only operations

### Auto-Continue

For long-running conversations that may hit the `maxTurns` limit, use `createAutoContinueManager`:

```typescript
import { createAutoContinueManager } from "@iamqc/cc-session";

// When the session approaches maxTurns, it automatically:
// 1. Creates a new session
// 2. Transfers todos, tools, and summary
// 3. Continues the conversation in the new session
const manager = createAutoContinueManager("production_continue", {
  maxTurns: 100,
  systemPrompt: "You are a helpful assistant..."
});

const session = manager.createSession();
const result = await session.send("Start a long task...");
// If continued mid-stream, result.continued === true and result.newSession is the continuation session
```

Extended presets (with `_continue` suffix) enable auto-continue by default. Base presets accept a `continue: true` option.

## Development

### Prerequisites

- Bun runtime
- Node.js >= 16.0.0

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd cc-session

# Install dependencies
bun install

# Build the project
bun run build

# Run tests
bun run test
```

### Scripts

- `bun run build` - Build the TypeScript project
- `bun run dev` - Build in watch mode
- `bun run test` - Run the test suite
- `bun run clean` - Clean the dist directory

## Examples

### Real-time Chat Application

```typescript
import { Session, createClientWithPreset } from "@iamqc/cc-session";

const client = createClientWithPreset("development");
const session = new Session(client);

// Set up real-time subscriptions
session.subscribe((session, message) => {
  switch (message.type) {
    case "message_added":
      console.log(`New message: ${message.message.content}`);
      break;
    case "tool_result_updated":
      console.log(`Tool result: ${message.toolUseId}`);
      break;
  }
});

// Send a message and get the result directly
const result = await session.send("Create a simple TODO app");
if (result.success && result.lastAssistantMessage) {
  console.log("AI Response:", result.lastAssistantMessage.content);
}
```

### Multi-session Management

```typescript
import { SessionManager, createClientWithPreset } from "@iamqc/cc-session";

const manager = new SessionManager(() => createClientWithPreset("production"));

// Create sessions for different tasks
const codingSession = manager.createSession();
const designSession = manager.createSession();

// Use sessions independently and get results directly
const codingResult = await codingSession.send("Help me debug this function");
const designResult = await designSession.send("Design a user interface for this app");

if (codingResult.success) {
  console.log("Coding Help:", codingResult.lastAssistantMessage.content);
}

if (designResult.success) {
  console.log("Design Suggestion:", designResult.lastAssistantMessage.content);
}
```

### Read-Only Question Answering

```typescript
import { Session, createClientWithPreset } from "@iamqc/cc-session";

// Create a read-only session for Q&A
const client = createClientWithPreset("question");
const session = new Session(client);

// Safely ask questions without file modifications
await session.send("What does the main function in src/index.ts do?");
await session.send("Find all TypeScript files that use the Session class");
await session.send("Explain the architecture of this codebase");
```

## Testing

Tests are located in `test-session/`:

```bash
bun run test              # test-final-result.ts
bun run test-session/demo-session.ts    # demo
bun run test-session/demo-question.ts   # question preset demo
bun run test-session/test-auto-continue.ts  # auto-continue demo
```

Tests require a Claude Code binary. If not present, the SDK will throw a `ReferenceError` pointing to the missing executable path.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Support

For issues and questions, please use the GitHub issue tracker.
