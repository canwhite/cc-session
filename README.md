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

## Quick Start

### Installation

```bash
# Using Bun
bun add @iamqc/cc-session

# Or using npm
npm install @iamqc/cc-session
```

### Basic Usage

```typescript
import { Session, SessionManager, createClientWithPreset } from "@iamqc/cc-session";

// Create a client with development preset
const client = createClientWithPreset("development");

// Create a session
const session = new Session(client);

// Subscribe to session updates
session.subscribe((session, message) => {
  console.log("Session update:", message);
});

// Send a message
const result = await session.send("Hello, Claude!");
console.log("Response:", result);
```

### Session Management

```typescript
import { SessionManager } from "cc-session";

// Create a session manager
const manager = new SessionManager(() => createClientWithPreset("production"));

// Create multiple sessions
const session1 = manager.createSession();
const session2 = manager.createSession();

// List all sessions
const sessions = manager.listSessions();

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

- `send(message: string, options?: SendOptions): Promise<SendResult>` - Send a message to Claude
- `cancel(): void` - Cancel the current operation
- `subscribe(callback: SubscriptionCallback): () => void` - Subscribe to session updates
- `unsubscribe(): void` - Unsubscribe from updates

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
- `listSessions(): Session[]` - List all sessions
- `cleanupEmptySessions(): void` - Clean up empty sessions

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

// Send a message
await session.send("Create a simple TODO app");
```

### Multi-session Management

```typescript
import { SessionManager, createClientWithPreset } from "@iamqc/cc-session";

const manager = new SessionManager(() => createClientWithPreset("production"));

// Create sessions for different tasks
const codingSession = manager.createSession();
const designSession = manager.createSession();

// Use sessions independently
await codingSession.send("Help me debug this function");
await designSession.send("Design a user interface for this app");
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

The library includes comprehensive tests that cover:

- Session creation and management
- Message streaming and real-time updates
- Tool integration and result handling
- Error propagation and cancellation
- Client preset configurations

Run the test suite:

```bash
bun run test
```

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
