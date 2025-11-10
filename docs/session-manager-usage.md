# SessionManager 使用指南

## 概述

`SessionManager` 是 Claude Agent SDK 的核心会话管理类，负责创建、管理和维护多个 Claude 对话会话。

## 核心功能

- 创建和管理多个会话实例
- 会话生命周期管理
- 会话状态跟踪和清理
- 与 Claude Agent SDK 客户端集成

## 基本使用方式

### 1. 创建 SessionManager

#### 方式一：使用默认客户端
```typescript
import { SessionManager } from "./src/index";

// 使用静态工厂方法创建
const manager = SessionManager.create();
```

#### 方式二：使用自定义客户端
```typescript
import { SessionManager, ClaudeAgentSDKClient } from "./src/index";

// 使用自定义客户端
const client = new ClaudeAgentSDKClient();
const manager = new SessionManager(client);
```

#### 方式三：使用客户端工厂函数
```typescript
import { SessionManager, ClaudeAgentSDKClient } from "./src/index";

// 使用工厂函数（延迟创建客户端）
const manager = new SessionManager(() => new ClaudeAgentSDKClient());
```

### 2. 创建会话

#### 基本会话创建
```typescript
// 创建新会话
const session = manager.createSession();
console.log("会话ID:", session.claudeSessionId);
```

#### 带选项的会话创建
```typescript
import { SessionCreationOptions } from "./src/index";

const options: SessionCreationOptions = {
  isExplicit: true  // 标记为显式创建的会话
};

const session = manager.createSession(options);
```

#### 获取或创建会话
```typescript
// 如果sessionId存在则获取，否则创建新会话
const session = manager.getOrCreateSession("existing-session-id");
```

### 3. 发送消息

```typescript
// 发送文本消息
const result = await session.send("Hello, Claude!");

if (result.success) {
  console.log("消息发送成功");
  console.log("消息数量:", result.messageCount);
  console.log("最后助手消息:", result.lastAssistantMessage);
  console.log("使用情况:", result.usage);
} else {
  console.error("发送失败:", result.error);
}
```

### 4. 发送带附件的消息

```typescript
import { AttachmentPayload } from "./src/index";

const attachments: AttachmentPayload[] = [
  {
    name: "document.pdf",
    mediaType: "application/pdf",
    data: "base64-encoded-data"
  }
];

const result = await session.send("请分析这个文档", attachments);
```

## 会话管理

### 1. 获取会话列表

```typescript
// 获取所有会话
const allSessions = manager.sessions;

// 按最后修改时间排序
const sortedSessions = manager.sessionsByLastModified;
```

### 2. 查找会话

```typescript
// 根据会话ID查找
const foundSession = manager.getSession("session-id");

// 查找并加载消息
const sessionWithMessages = manager.getSession("session-id", true);
```

### 3. 会话状态管理

```typescript
// 订阅会话更新
const unsubscribe = session.subscribe((session, message) => {
  console.log("会话更新:", message.type);

  switch (message.type) {
    case "message_added":
      console.log("新消息:", message.message);
      break;
    case "todos_updated":
      console.log("todos更新:", message.todos);
      break;
    case "usage_updated":
      console.log("使用情况更新:", message.usage);
      break;
  }
});

// 取消订阅
unsubscribe();
```

### 4. 会话操作

```typescript
// 取消当前操作
session.cancel();

// 从服务器加载会话
await session.loadFromServer("session-id");

// 恢复会话
await session.resumeFrom("session-id");
```

## 与预设系统集成

### 使用预设创建客户端

```typescript
import { createClientWithPreset, DEFAULT_PRESETS } from "./src/index";

// 使用预设创建客户端
const client = createClientWithPreset("development");
const manager = new SessionManager(client);
```

### 可用的预设

```typescript
// 开发模式 - 50轮次，基础工具集
const devClient = createClientWithPreset("development");

// 生产模式 - 100轮次，完整工具集
const prodClient = createClientWithPreset("production");

// 最小模式 - 20轮次，只读工具
const minimalClient = createClientWithPreset("minimal");

// 问答模式 - 50轮次，只读工具，专用系统提示
const questionClient = createClientWithPreset("question");
```

## 完整示例

```typescript
import { SessionManager, createClientWithPreset } from "./src/index";

async function example() {
  // 1. 创建会话管理器
  const client = createClientWithPreset("development");
  const manager = new SessionManager(client);

  // 2. 创建会话
  const session = manager.createSession();

  // 3. 订阅会话更新
  const unsubscribe = session.subscribe((session, message) => {
    console.log(`[${message.type}]`, message);
  });

  try {
    // 4. 发送消息
    const result = await session.send("请帮我分析这个代码库的结构");

    if (result.success) {
      console.log("✅ 对话成功");
      console.log("📊 使用情况:", result.usage);

      // 5. 继续对话
      const followUp = await session.send("能详细说明一下主要的模块吗？");
    }
  } catch (error) {
    console.error("❌ 对话失败:", error);
  } finally {
    // 6. 清理
    unsubscribe();
  }
}

example();
```

## 会话状态信息

每个会话包含以下状态信息：

```typescript
// 会话基本信息
session.claudeSessionId;    // Claude会话ID
session.messages;           // 消息列表
session.busy;              // 是否正在处理
session.error;             // 错误信息

// 会话元数据
session.summary;           // 会话摘要
session.todos;             // 待办事项列表
session.tools;             // 可用工具列表
session.usageData;         // 使用数据
session.permissionMode;    // 权限模式

// 时间信息
session.lastModifiedTime;  // 最后修改时间
session.isLoading;         // 是否正在加载
```

## 事件类型

会话支持以下广播事件类型：

- `session_info` - 会话信息更新
- `messages_loaded` - 消息加载完成
- `usage_updated` - 使用情况更新
- `todos_updated` - 待办事项更新
- `tools_updated` - 工具列表更新
- `message_added` - 新消息添加
- `message_updated` - 消息更新
- `message_removed` - 消息删除
- `tool_result_updated` - 工具结果更新

## 最佳实践

1. **及时清理订阅** - 使用完毕后调用取消订阅函数
2. **错误处理** - 始终检查send方法的返回结果
3. **会话复用** - 对于相关任务尽量复用同一会话
4. **资源管理** - 长时间不用的会话会被自动清理
5. **状态检查** - 在发送消息前检查session.busy状态

## 与自动续接功能的对比

| 功能 | 原有 SessionManager | 新增 AutoContinueSessionManager |
|------|-------------------|--------------------------------|
| 会话创建 | ✅ 支持 | ✅ 支持 |
| 消息发送 | ✅ 支持 | ✅ 支持 |
| 自动续接 | ❌ 不支持 | ✅ 支持 |
| 预设集成 | ✅ 支持 | ✅ 支持 |
| 上下文转移 | ❌ 不支持 | ✅ 支持 |

原有代码可以继续正常使用，新增的自动续接功能是可选的增强特性。