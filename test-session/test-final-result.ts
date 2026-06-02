// 测试修改后的 send 方法是否能返回最终结果
import { createClientWithPreset, Session } from "./dist/index.js";

async function testFinalResult() {
  console.log("=== 测试 send() 方法返回最终结果 ===\n");

  // 创建客户端
  const client = createClientWithPreset("development", {
    pathToClaudeCodeExecutable: '/Users/zack/.bun/bin/claude'
  });

  // 创建会话
  const session = new Session(client);

  // 订阅会话更新（用于调试）
  session.subscribe((session, message) => {
    console.log(`[订阅] ${message.type}:`,
      message.type === 'message_added' ? '收到新消息' :
      message.type === 'session_info' ? `会话状态: ${message.isActive ? '活跃' : '空闲'}` :
      message.type === 'usage_updated' ? `使用统计: ${JSON.stringify(message.usage)}` :
      message
    );
  });

  try {
    console.log("发送消息: '你好，请简单介绍一下自己'");
    const result = await session.send("你好，请简单介绍一下自己");

    console.log("\n=== 最终结果 ===");
    console.log("成功:", result.success);
    console.log("消息数量:", result.messageCount);

    if (result.lastAssistantMessage) {
      console.log("\n最后一条助手消息:");
      console.log("消息类型:", result.lastAssistantMessage.type);
      console.log("消息ID:", result.lastAssistantMessage.id);
      console.log("消息时间戳:", result.lastAssistantMessage.timestamp);
      console.log("消息内容:", JSON.stringify(result.lastAssistantMessage.content, null, 2));
    } else {
      console.log("\n未收到助手消息");
    }

    if (result.usage) {
      console.log("\n使用统计:");
      console.log("总Token数:", result.usage.totalTokens);
      console.log("总费用:", result.usage.totalCost);
      console.log("上下文窗口:", result.usage.contextWindow);
    }

    if (result.error) {
      console.log("\n错误:", result.error);
    }

  } catch (error) {
    console.error("测试失败:", error);
  }
}

testFinalResult().catch(console.error);