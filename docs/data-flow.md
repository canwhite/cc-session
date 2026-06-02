# Data Flow Analysis

## Path 1: Message Send (primary path)

```
session.send(prompt, attachments)
    │
    ├─► buildUserMessageContent()     [chat-message.ts]
    │       builds SDKUserMessage
    │
    ├─► appendRenderableMessage()      [chat-message.ts]
    │       adds to local working array
    │
    ├─► coalesceReadMessages()         [chat-message.ts]
    │       merges consecutive Read tools
    │
    ├─► applyMessageUpdates()
    │       ├─► diffMessages()         [session.ts:650]
    │       │       computes added/updated/removed diff
    │       ├─► buildMessageMap()      [session.ts:693]
    │       │       builds id→ChatMessage lookup map
    │       │
    │       └─► noticeSubscribers()    ──► Broadcast to all callbacks
    │
    └─► client.queryStream(generateMessages(), options)
            │
            ├─► for await message of queryStream()
            │       │
            │       ├─► processIncomingMessage(message)
            │       │       ├─► processMessage(message)        [session.ts:506]
            │       │       │       ├─► handleAssistantMessage()  extracts todos, usage
            │       │       │       └─► handleResultMessage()     extracts cost
            │       │       │
            │       │       ├─► appendRenderableMessage()    builds ChatMessage
            │       │       │
            │       │       ├─► coalesceReadMessages()
            │       │       │
            │       │       └─► applyMessageUpdates()         ──► broadcasts
            │       │
            │       └─► if (message.type === "result") break
            │
            └─► return { success, lastAssistantMessage, usage }
```

## Path 2: Session Load from Server

```
session.loadFromServer(sessionId)
    │
    └─► client.getSession(sessionId)        [cas-client.ts]
            │
            ├─► locateSessionFile()          finds .jsonl in ~/.claude/projects/
            ├─► readSessionMessages()        reads file
            └─► parseSessionMessagesFromJsonl()  [cas-client.ts:35]
                    └─► normalizeSessionLogEntry()

    └─► setMessages(messages)               [session.ts:132]
            │
            ├─► for each message:
            │       ├─► processMessage()     sync state (todos/tools/usage)
            │       └─► appendRenderableMessage()
            │
            ├─► coalesceReadMessages()
            └─► emitMessagesLoaded()          broadcast
```

## Path 3: Auto-Continue

```
AutoContinueSession.send(prompt, attachments)
    │
    ├─► if (continueEnabled && isApproachingLimit)
    │       │
    │       ├─► sessionManager.createSession()    creates fresh Session
    │       │
    │       ├─► transferSessionContext()
    │       │       ├─► summary
    │       │       ├─► todos
    │       │       ├─► tools
    │       │       └─► usageData
    │       │
    │       └─► newSession.send(prompt, attachments)   ──► Path 1
    │
    └─► else: super.send()                  ──► Path 1
```

## Subscription/Broadcast Flow

```
any state change
    │
    └─► noticeSubscribers(message: BroadcastMessage)
            │
            └─► for callback of subscribers.values()
                    callback(session, message)

Broadcast types:
  - session_info      (messageCount, isActive)
  - messages_loaded   (messages[])
  - usage_updated     (usage)
  - todos_updated     (todos[])
  - tools_updated     (tools[])
  - message_added      (message: any ← LEAK)
  - message_updated    (message: any ← LEAK)
  - message_removed    (messageId)
  - tool_result_updated (messageId, toolUseId, result)
```

## Key Observations

### 1. Broadcast `any` leak
`message_added` and `message_updated` broadcast `message: any`, forcing every subscriber to cast. The seam between `Session` and its subscribers is therefore not type-safe.

### 2. `processMessage()` is the only stateful transformation
It extracts todos, tools, and usage from raw SDK messages, but is buried inside `Session` and only called in two places (`setMessages` and `processIncomingMessage`). Replaying a historical message stream to re-derive state is not possible — the logic is tightly coupled to `Session`.

### 3. `queryStream` is the central choke point
Cancellation, result detection, and streaming termination all pass through the `for await` loop in `send()`. There is no abstraction between "iterate the stream" and "handle each message" — making this path hard to test in isolation.

### 4. File session loading bypasses `queryStream` entirely
Loaded sessions go through `getSession()` → `parseSessionMessagesFromJsonl()` → `setMessages()`, not the streaming loop. This means state derivation (`processMessage`) works differently for loaded sessions vs live ones.
