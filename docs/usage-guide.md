# CC-Session 使用指南

## 概述

本文档详细介绍 CC-Session 库的正确使用方法，帮助开发者理解其事件驱动架构并提供实用的代码示例。

## 基础用法

### 1. 初始化和配置

```typescript
import { Session, createClientWithPreset } from "@iamqc/cc-session";

// 创建客户端（需要指定 Claude Code 路径）
const client = createClientWithPreset("development", {
  pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH || '/Users/zack/.bun/bin/claude'
});

// 创建会话
const session = new Session(client);
```

### 2. 理解 `send()` 方法

```typescript
// send() 只启动流式处理，不直接返回结果
const result = await session.send("Hello, Claude!");

// 返回值结构：
// {
//   success: boolean,     // 是否成功启动
//   error?: string,       // 错误信息（如果有）
//   messageCount?: number // 消息总数（不是内容！）
// }
```

### 3. 获取真实结果的三种方法

#### 方法 1：从会话状态获取（最简单）

```typescript
await session.send("分析当前项目并返回JSON");

// 等待请求完成
while (session.busy) {
  await new Promise(resolve => setTimeout(resolve, 100));
}

// 获取最后一条消息
const lastMessage = session.messages[session.messages.length - 1];
const claudeResponse = lastMessage.content;

console.log("Claude的回复:", claudeResponse);
```

#### 方法 2：通过订阅实时获取（推荐）

```typescript
// 订阅消息添加事件
const unsubscribe = session.subscribe((session, message) => {
  if (message.type === "message_added") {
    console.log("新消息:", message.message.content);
  }
  if (message.type === "usage_updated") {
    console.log("Token使用:", message.usage);
  }
});

// 发送消息
await session.send("解释这段代码");

// 完成后取消订阅
// unsubscribe();
```

#### 方法 3：等待特定结果（复杂任务）

```typescript
function waitForCompletion(session: Session): Promise<any> {
  return new Promise((resolve) => {
    const unsubscribe = session.subscribe((session, message) => {
      if (message.type === "result") {
        // AI 完成所有任务
        const finalResponse = extractFinalResponse(session.messages);
        unsubscribe(); // 取消订阅
        resolve(finalResponse);
      }
    });
  });
}

// 使用
await session.send("执行复杂的分析任务");
const result = await waitForCompletion(session);
console.log("最终结果:", result);
```

## 实用模式

### 模式 1：简单的问答

```typescript
async function askQuestion(session: Session, question: string): Promise<string> {
  // 发送问题
  await session.send(question);

  // 等待处理完成
  while (session.busy) {
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // 获取最后回复
  const lastMessage = session.messages[session.messages.length - 1];
  return lastMessage.content;
}

// 使用
const answer = await askQuestion(session, "什么是TypeScript？");
console.log("回答:", answer);
```

### 模式 2：JSON 数据提取

```typescript
async function extractJSON(session: Session, prompt: string): Promise<any> {
  return new Promise((resolve, reject) => {
    let lastContent = "";

    const unsubscribe = session.subscribe((session, message) => {
      if (message.type === "message_added") {
        lastContent = message.message.content;

        // 尝试提取 JSON
        const jsonMatch = lastContent.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            const jsonData = JSON.parse(jsonMatch[1]);
            unsubscribe();
            resolve(jsonData);
          } catch (e) {
            // JSON 解析失败，继续等待
          }
        }
      }

      if (message.type === "session_info" && !message.isActive) {
        // 会话结束，尝试解析最后一次内容
        unsubscribe();
        if (lastContent) {
          const jsonMatch = lastContent.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            try {
              resolve(JSON.parse(jsonMatch[1]));
            } catch (e) {
              reject(new Error("无法解析JSON"));
            }
          } else {
            reject(new Error("未找到JSON数据"));
          }
        } else {
          reject(new Error("无响应内容"));
        }
      }
    });

    session.send(prompt);
  });
}

// 使用
const data = await extractJSON(session, "分析项目并返回JSON格式的配置信息");
console.log("提取的数据:", data);
```

### 模式 3：实时聊天界面

```typescript
class ChatInterface {
  private session: Session;
  private messageHistory: Array<{ role: string; content: string }> = [];

  constructor(session: Session) {
    this.session = session;
    this.setupSubscriptions();
  }

  private setupSubscriptions() {
    this.session.subscribe((session, message) => {
      switch (message.type) {
        case "message_added":
          this.displayMessage(message.message);
          this.messageHistory.push({
            role: message.message.type,
            content: message.message.content
          });
          break;
        case "usage_updated":
          this.updateUsage(message.usage);
          break;
        case "session_info":
          this.updateStatus(message.isActive ? "思考中..." : "就绪");
          break;
      }
    });
  }

  async sendMessage(content: string) {
    this.displayUserMessage(content);
    await this.session.send(content);
  }

  private displayMessage(message: any) {
    console.log(`Claude: ${message.content}`);
  }

  private displayUserMessage(content: string) {
    console.log(`你: ${content}`);
  }

  private updateUsage(usage: any) {
    console.log(`Token使用: ${usage.totalTokens}`);
  }

  private updateStatus(status: string) {
    console.log(`状态: ${status}`);
  }
}

// 使用
const chat = new ChatInterface(session);
await chat.sendMessage("你好！");
```

### 模式 4：任务执行监控

```typescript
class TaskMonitor {
  private session: Session;
  private tasks: Array<{ id: string; status: string; progress: number }> = [];

  constructor(session: Session) {
    this.session = session;
    this.monitorTasks();
  }

  private monitorTasks() {
    this.session.subscribe((session, message) => {
      if (message.type === "todos_updated") {
        this.updateTodoList(message.todos);
      }

      if (message.type === "tool_result_updated") {
        this.updateToolProgress(message.toolUseId, message.result);
      }

      if (message.type === "usage_updated") {
        this.logUsage(message.usage);
      }
    });
  }

  private updateTodoList(todos: any[]) {
    console.log("待办事项更新:");
    todos.forEach(todo => {
      console.log(`- [${todo.status === 'completed' ? '✓' : ' '}] ${todo.content}`);
    });
  }

  private updateToolProgress(toolId: string, result: any) {
    console.log(`工具 ${toolId} 完成:`, result);
  }

  private logUsage(usage: any) {
    console.log(`资源使用: ${usage.totalTokens} tokens, $${usage.totalCost}`);
  }
}

// 使用
const monitor = new TaskMonitor(session);
await session.send("分析整个项目并生成报告");
```

## 错误处理

### 1. 基本错误处理

```typescript
async function safeSend(session: Session, prompt: string): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await session.send(prompt);

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // 等待完成并检查是否有错误
    while (session.busy) {
      if (session.error) {
        return { success: false, error: session.error };
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// 使用
const result = await safeSend(session, "执行任务");
if (!result.success) {
  console.error("任务失败:", result.error);
}
```

### 2. 超时处理

```typescript
async function sendWithTimeout(session: Session, prompt: string, timeoutMs: number): Promise<{ success: boolean; error?: string }> {
  const timeoutPromise = new Promise<{ success: boolean; error?: string }>((resolve) => {
    setTimeout(() => {
      resolve({ success: false, error: "请求超时" });
    }, timeoutMs);
  });

  const sendPromise = safeSend(session, prompt);

  return Promise.race([timeoutPromise, sendPromise]);
}

// 使用
const result = await sendWithTimeout(session, "复杂任务", 30000); // 30秒超时
```

## 最佳实践

### 1. 总是清理订阅

```typescript
// 正确的订阅管理
function subscribeToSession(session: Session) {
  const unsubscribe = session.subscribe((session, message) => {
    // 处理消息
  });

  // 返回清理函数
  return () => {
    unsubscribe();
  };
}

// 使用
const cleanup = subscribeToSession(session);
// ... 使用完毕
cleanup();
```

### 2. 使用 SessionManager 管理多个会话

```typescript
import { SessionManager, createClientWithPreset } from "@iamqc/cc-session";

const manager = new SessionManager(() => createClientWithPreset("production", {
  pathToClaudeCodeExecutable: '/Users/zack/.bun/bin/claude'
}));

// 创建不同用途的会话
const codingSession = manager.createSession();
const designSession = manager.createSession();
const analysisSession = manager.createSession();

// 使用不同会话
await codingSession.send("帮我修复这个bug");
await designSession.send("设计一个新的UI界面");
await analysisSession.send("分析用户行为数据");
```

### 3. 资源管理

```typescript
class ResourceManager {
  private manager: SessionManager;
  private sessions: Map<string, Session> = new Map();

  constructor() {
    this.manager = new SessionManager(() => createClientWithPreset("production", {
      pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH
    }));
  }

  getSession(id: string): Session {
    if (!this.sessions.has(id)) {
      const session = this.manager.createSession();
      this.sessions.set(id, session);
    }
    return this.sessions.get(id)!;
  }

  cleanup() {
    this.manager.cleanupEmptySessions();
  }
}
```

## 总结

理解 CC-Session 的关键是：

1. **事件驱动思维**：不要期望 `send()` 直接返回结果
2. **订阅机制**：通过订阅获取实时更新
3. **状态管理**：从会话状态获取最终结果
4. **异步处理**：适应流式和长时间运行的特性

掌握这些模式后，你可以充分利用 CC-Session 的强大功能构建复杂的 AI 应用。