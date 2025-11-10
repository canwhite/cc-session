# CC-Session 架构文档

## 概述

`@iamqc/cc-session` 是一个用于管理 Claude Code 会话的 TypeScript 库，提供了会话管理、自动续会、消息处理等功能。该库基于 `@anthropic-ai/claude-agent-sdk` 构建，为开发者提供了简化的 API 来与 Claude Code Agent 交互。

## 核心架构

### 整体结构

```
┌─────────────────────────────────────────────────────────────┐
│                    CC-Session Library                        │
├─────────────────────────────────────────────────────────────┤
│  Entry Point: src/index.ts                                   │
├─────────────────────────────────────────────────────────────┤
│  Core Modules:                                               │
│  ├── types.ts              # 类型定义和接口                    │
│  ├── cas-client.ts         # Claude Agent SDK 客户端封装        │
│  ├── session.ts            # 会话管理核心类                    │
│  ├── session-manager.ts    # 会话管理器                        │
│  ├── auto-continue.ts      # 自动续会功能                      │
│  ├── chat-message.ts       # 消息处理和格式化                   │
│  └── message-parsing.ts    # 消息解析工具                      │
└─────────────────────────────────────────────────────────────┘
```

## 核心组件详解

### 1. 类型系统 (types.ts)

#### 核心接口
- **`IClaudeAgentSDKClient`**: Claude Agent SDK 客户端接口
  - `queryStream()`: 流式查询接口
  - `getSession()`: 获取会话信息
  - `getDefaultOptions()`: 获取默认配置（新增）

- **消息类型**:
  - `SDKMessage`: SDK 消息基类型
  - `SDKUserMessage`: 用户消息
  - `SDKAssistantMessage`: 助手消息
  - `SDKResultMessage`: 结果消息

- **内容块类型**:
  - `TextContentBlock`: 文本内容
  - `ImageContentBlock`: 图片内容
  - `DocumentContentBlock`: 文档内容
  - `ToolUseContentBlock`: 工具使用
  - `ToolResultContentBlock`: 工具结果

#### 广播系统
- **`BroadcastMessage`**: 会话状态变化广播
- **`SessionSubscriberCallback`**: 订阅回调函数

### 2. Claude Agent SDK 客户端 (cas-client.ts)

#### ClaudeAgentSDKClient 类
```typescript
class ClaudeAgentSDKClient implements IClaudeAgentSDKClient {
  private defaultOptions: SDKOptions;

  constructor(options) // 支持预设或自定义选项
  async *queryStream(prompt, options) // 流式查询
  async getSession(sessionId) // 获取会话
  getDefaultOptions(): SDKOptions // 获取默认配置
}
```

#### 预设配置
```typescript
const DEFAULT_PRESETS = {
  development: { maxTurns: 50, allowedTools: [...] },
  production: { maxTurns: 100, allowedTools: [...] },
  minimal: { maxTurns: 20, allowedTools: [...] },
  question: {
    maxTurns: 50,
    allowedTools: [...],
    systemPrompt: "..."  // 内置 systemPrompt
  }
}
```

#### 工厂函数
- `createClient(options)`: 创建自定义客户端
- `createClientWithPreset(preset, options)`: 使用预设创建客户端

### 3. 会话管理 (session.ts)

#### Session 类
```typescript
class Session {
  // 核心属性
  public messages: ChatMessage[] = [];
  public claudeSessionId: string | null = null;
  public todos: TodoItem[] = [];
  public tools: string[] = [];
  public usageData: UsageSummary;

  // 核心方法
  async send(prompt, attachments) // 发送消息
  async loadFromServer(sessionId) // 从服务器加载
  subscribe(callback) // 订阅状态变化
  cancel() // 取消当前操作
}
```

#### 消息处理流程
1. **消息构建**: 创建 `SDKUserMessage`
2. **消息预处理**: `appendRenderableMessage()`, `coalesceReadMessages()`
3. **流式处理**: 调用 `client.queryStream()`
4. **状态更新**: 处理返回的消息流
5. **广播通知**: 通知订阅者状态变化

### 4. 会话管理器 (session-manager.ts)

#### SessionManager 类
```typescript
class SessionManager {
  private sessionsList: Session[] = [];
  private createClient: () => IClaudeAgentSDKClient;

  // 核心方法
  createSession(options) // 创建新会话
  getSession(sessionId) // 获取现有会话
  get sessionsByLastModified // 按修改时间排序
}
```

### 5. 自动续会 (auto-continue.ts)

#### 扩展预设
```typescript
const EXTENDED_PRESETS = {
  development_continue: { maxTurns: 50, continue: true },
  production_continue: { maxTurns: 100, continue: true },
  minimal_continue: { maxTurns: 20, continue: true },
  question_continue: {
    maxTurns: 50,
    continue: true,
    systemPrompt: "..."  // 内置 systemPrompt
  }
}
```

#### AutoContinueSession 类
```typescript
class AutoContinueSession extends Session {
  async send(prompt, attachments) {
    // 检查是否接近 maxTurns 限制
    if (isApproachingLimit) {
      // 创建新会话
      const newSession = this.sessionManager.createSession();
      // 转移上下文
      await this.transferSessionContext(this, newSession);
      // 在新会话中发送消息
      return await newSession.send(prompt, attachments);
    }
    return await super.send(prompt, attachments);
  }
}
```

#### 统一创建函数
```typescript
function createAutoContinueManager(
  preset: string,  // 支持扩展预设或基础预设
  options?: {
    maxTurns?: number;
    pathToClaudeCodeExecutable?: string;
    systemPrompt?: string;  // 自定义 systemPrompt
    continue?: boolean;     // 仅用于基础预设
  }
): AutoContinueSessionManager
```

## 数据流分析

### 1. systemPrompt 传递链

```
用户配置
    ↓
createAutoContinueManager(options.systemPrompt)
    ↓
createClientWithPreset(preset, { systemPrompt })
    ↓
ClaudeAgentSDKClient constructor
    ↓
this.defaultOptions = { systemPrompt, ... }
    ↓
getDefaultOptions() 返回配置
    ↓
Session.send() 获取默认配置
    ↓
queryStream(messages, { systemPrompt, ... })
    ↓
@anthropic-ai/claude-agent-sdk query()
    ↓
Claude Code Agent (收到 systemPrompt)
```

#### systemPrompt 优先级
1. **用户提供的 systemPrompt** (最高优先级)
2. **扩展预设中的 systemPrompt** (中等优先级)
3. **默认 systemPrompt** (`AGENT_PROMPT`，最低优先级)

### 2. 消息处理流程

```
用户输入
    ↓
Session.send(prompt, attachments)
    ↓
构建 SDKUserMessage
    ↓
appendRenderableMessage() - 添加到本地消息列表
    ↓
coalesceReadMessages() - 合并连续的读消息
    ↓
获取客户端默认配置 (包含 systemPrompt)
    ↓
client.queryStream(messages, options)
    ↓
处理返回消息流:
  ├── processIncomingMessage() - 处理每条消息
  ├── updateUsageData() - 更新使用统计
  ├── broadcastUpdate() - 广播状态变化
  └── 检查是否为最终结果
    ↓
返回处理结果
```

### 3. 自动续会流程

```
Session.send() 调用
    ↓
检查当前消息数量 vs maxTurns
    ↓
if (currentMessages >= triggerThreshold) {
  创建新会话
    ↓
  转移上下文:
    ├── summary (会话摘要)
    ├── todos (待办事项)
    ├── tools (工具列表)
    └── usageData (使用统计)
    ↓
  在新会话中发送消息
    ↓
  返回 { continued: true, newSession, ... }
}
```

## API 设计原则

### 1. 渐进式复杂度
- **简单使用**: `createSession()` + `send()`
- **预设配置**: `createAutoContinueManager("development_continue")`
- **自定义配置**: `createAutoContinueManager("production", { systemPrompt: "..." })`

### 2. 向后兼容性
- 所有现有 API 保持不变
- 新功能通过可选参数添加
- 废弃功能通过 `@deprecated` 标记

### 3. 类型安全
- 完整的 TypeScript 类型定义
- 严格的接口约束
- 编译时错误检查

## 使用场景

### 1. 基础会话管理
```typescript
const manager = new SessionManager(client);
const session = manager.createSession();
const result = await session.send("Hello, Claude!");
```

### 2. 预设配置 + 自动续会 ✅
```typescript
const manager = createAutoContinueManager("development_continue", {
  maxTurns: 100,
  pathToClaudeCodeExecutable: "/path/to/claude"
});
const session = manager.createSession();
```

### 3. 自定义 systemPrompt ✅
```typescript
const manager = createAutoContinueManager("production", {
  continue: true,
  maxTurns: 200,
  systemPrompt: "You are a TypeScript expert..."
});
```

### 4. 扩展预设 + 自定义 systemPrompt
```typescript
const manager = createAutoContinueManager("question_continue", {
  systemPrompt: "You are a Python expert focused on machine learning...",
  maxTurns: 150
});
```

## 扩展性设计

### 1. 插件化预设
- 预设配置可独立扩展
- 支持自定义预设定义
- 预设继承机制

### 2. 广播系统
- 解耦的状态通知机制
- 支持多个订阅者
- 类型安全的消息传递

### 3. 中间件支持
- 消息处理中间件
- 可插拔的工具验证
- 自定义钩子函数

## 性能考虑

### 1. 内存管理
- 消息历史的懒加载
- 自动清理过期会话
- 流式处理减少内存占用

### 2. 并发控制
- 消息队列机制
- 操作取消支持
- 异步错误处理

### 3. 网络优化
- 批量消息处理
- 连接复用
- 断线重连机制

## 安全性

### 1. 输入验证
- 严格的类型检查
- 消息内容验证
- 工具参数验证

### 2. 权限控制
- 工具使用权限
- 文件访问限制
- 执行环境隔离

### 3. 错误处理
- 安全的错误信息
- 异常恢复机制
- 日志记录规范

这个架构设计确保了库的可扩展性、可维护性和安全性，同时为用户提供了简洁而强大的 API。