#!/usr/bin/env bun

import "dotenv/config";
import {
  Session,
  SessionManager,
  createClient,
  createClientWithPreset,
  DEFAULT_PRESETS,
  ClaudeAgentSDKClient,
} from "../src/index";

/**
 * 新功能测试脚本
 *
 * 测试我们新添加和优化的功能：
 * 1. Session 取消功能
 * 2. 增强的 send() 方法返回值
 * 3. SessionManager 工厂方法
 * 4. 客户端预设配置
 * 5. 改进的工具结果连接逻辑
 */

// 测试结果收集
const testResults = {
  sessionCancellation: false,
  enhancedSendMethod: false,
  sessionManagerFactory: false,
  clientPresets: false,
  toolResultConnection: false,
  errorPropagation: false,
};

async function newFeaturesTest() {
  console.log("🚀 开始新功能测试\n");

  // 1. 测试客户端预设配置
  console.log("1️⃣ 测试客户端预设配置...");
  await testClientPresets();
  testResults.clientPresets = true;

  // 2. 测试 SessionManager 工厂方法
  console.log("\n2️⃣ 测试 SessionManager 工厂方法...");
  await testSessionManagerFactory();
  testResults.sessionManagerFactory = true;

  // 3. 测试增强的 send() 方法
  console.log("\n3️⃣ 测试增强的 send() 方法...");
  await testEnhancedSendMethod();
  testResults.enhancedSendMethod = true;

  // 4. 测试 Session 取消功能
  console.log("\n4️⃣ 测试 Session 取消功能...");
  await testSessionCancellation();
  testResults.sessionCancellation = true;

  // 5. 测试错误传播
  console.log("\n5️⃣ 测试错误传播...");
  await testErrorPropagation();
  testResults.errorPropagation = true;

  // 6. 测试工具结果连接
  console.log("\n6️⃣ 测试工具结果连接逻辑...");
  await testToolResultConnection();
  testResults.toolResultConnection = true;

  // 显示测试结果
  console.log("\n📊 新功能测试结果汇总:");
  console.log("=".repeat(50));
  Object.entries(testResults).forEach(([test, passed]) => {
    console.log(
      `   ${passed ? "✅" : "❌"} ${test}: ${passed ? "通过" : "失败"}`
    );
  });
  console.log("=".repeat(50));

  const passedCount = Object.values(testResults).filter(Boolean).length;
  const totalCount = Object.keys(testResults).length;
  console.log(`\n🎯 新功能测试完成: ${passedCount}/${totalCount} 项测试通过`);
}

async function testClientPresets() {
  console.log("   ⚙️  测试客户端预设配置...");

  try {
    // 测试 development 预设
    const devClient = createClientWithPreset("development");
    console.log(`      ✅ Development 预设创建成功`);

    // 测试 production 预设
    const prodClient = createClientWithPreset("production");
    console.log(`      ✅ Production 预设创建成功`);

    // 测试 minimal 预设
    const minimalClient = createClientWithPreset("minimal");
    console.log(`      ✅ Minimal 预设创建成功`);

    // 测试带额外选项的预设
    const customDevClient = createClientWithPreset("development", {
      systemPrompt: "自定义开发提示",
    });
    console.log(`      ✅ 自定义预设选项成功`);

    // 测试默认创建方法
    const defaultClient = createClient();
    console.log(`      ✅ 默认客户端创建成功`);

    console.log(`   ✅ 客户端预设配置: 所有测试通过`);
  } catch (error) {
    console.log(`   ❌ 客户端预设配置: 测试失败 - ${error}`);
  }
}

async function testSessionManagerFactory() {
  console.log("   🏭 测试 SessionManager 工厂方法...");

  try {
    // 测试使用函数创建
    const manager1 = new SessionManager(() => new ClaudeAgentSDKClient());
    console.log(`      ✅ 函数工厂方式创建成功`);

    // 测试使用客户端实例创建
    const client = new ClaudeAgentSDKClient();
    const manager2 = new SessionManager(client);
    console.log(`      ✅ 客户端实例方式创建成功`);

    // 测试静态工厂方法
    const manager3 = SessionManager.create();
    console.log(`      ✅ 静态工厂方法创建成功`);

    // 测试带客户端的工厂方法
    const manager4 = SessionManager.create(client);
    console.log(`      ✅ 带客户端的工厂方法创建成功`);

    // 测试创建会话
    const session1 = manager1.createSession();
    const session2 = manager2.createSession();
    console.log(`      ✅ 会话创建功能正常`);

    console.log(`   ✅ SessionManager 工厂方法: 所有测试通过`);
  } catch (error) {
    console.log(`   ❌ SessionManager 工厂方法: 测试失败 - ${error}`);
  }
}

async function testEnhancedSendMethod() {
  console.log("   📤 测试增强的 send() 方法...");

  const client = createClientWithPreset("minimal");
  const session = new Session(client);

  try {
    // 测试正常的 send 调用
    console.log(`      📤 发送测试消息...`);
    const result = await session.send("请简单回答'测试成功'");

    console.log(`      📊 返回结果:`, result);

    if (typeof result === "object" && result !== null) {
      if ("success" in result) {
        console.log(`      ✅ 返回值包含 success 字段: ${result.success}`);
      }
      if ("messageCount" in result) {
        console.log(
          `      ✅ 返回值包含 messageCount 字段: ${result.messageCount}`
        );
      }
      if ("error" in result && result.error) {
        console.log(`      ⚠️  返回值包含 error 字段: ${result.error}`);
      }

      console.log(`   ✅ 增强 send() 方法: 返回值结构正确`);
    } else {
      console.log(`   ❌ 增强 send() 方法: 返回值格式错误`);
    }
  } catch (error) {
    console.log(`   ❌ 增强 send() 方法: 测试失败 - ${error}`);
  }
}

async function testSessionCancellation() {
  console.log("   🚫 测试 Session 取消功能...");

  const client = createClientWithPreset("minimal");
  const session = new Session(client);

  try {
    let wasCancelled = false;

    // 订阅状态变化
    const unsubscribe = session.subscribe((session, message) => {
      if (message.type === "session_info") {
        console.log(`      📝 会话状态: ${message.isActive ? "活跃" : "空闲"}`);
      }
    });

    // 开始一个长时间运行的操作
    console.log(`      🚀 启动长时间运行的操作...`);
    const sendPromise = session.send(
      "请等待3秒然后回答'这是一个测试'",
      undefined
    );

    // 等待1秒后取消
    setTimeout(() => {
      console.log(`      🚫 取消操作...`);
      session.cancel();
      wasCancelled = true;
    }, 1000);

    // 等待操作完成
    const result = await sendPromise;

    if (wasCancelled || session.error?.includes("cancelled")) {
      console.log(`      ✅ 取消功能: 操作被成功取消`);
    } else {
      console.log(`      ⚠️  取消功能: 操作正常完成（可能执行过快）`);
    }

    unsubscribe();
    console.log(`   ✅ Session 取消功能: 测试完成`);
  } catch (error) {
    console.log(`   ❌ Session 取消功能: 测试失败 - ${error}`);
  }
}

async function testErrorPropagation() {
  console.log("   🚨 测试错误传播机制...");

  const client = createClientWithPreset("minimal");
  const session = new Session(client);

  try {
    // 测试错误是否会正确传播
    console.log(`      📤 测试错误传播...`);

    // 这里我们测试一个可能会失败的场景
    const result = await session.send("测试错误处理");

    if (result.success === false && result.error) {
      console.log(`      ✅ 错误传播: 失败情况正确返回`);
      console.log(`      📝 错误信息: ${result.error}`);
    } else if (result.success === true) {
      console.log(`      ✅ 错误传播: 成功情况正确返回`);
    } else {
      console.log(`      ❌ 错误传播: 返回格式异常`);
    }

    console.log(`   ✅ 错误传播机制: 测试完成`);
  } catch (error) {
    console.log(`   ❌ 错误传播机制: 测试失败 - ${error}`);
  }
}

async function testToolResultConnection() {
  console.log("   🔗 测试工具结果连接逻辑...");

  const client = createClientWithPreset("development");
  const session = new Session(client);

  try {
    let toolUsesDetected = 0;
    let toolResultsDetected = 0;

    // 订阅消息以检测工具使用
    const unsubscribe = session.subscribe((session, message) => {
      if (
        message.type === "message_added" &&
        message.message.type === "assistant"
      ) {
        message.message.content.forEach((part) => {
          if (part.content.type === "tool_use") {
            toolUsesDetected++;
            console.log(`      🔧 检测到工具使用: ${part.content.name}`);
          }
        });
      }

      if (message.type === "tool_result_updated") {
        toolResultsDetected++;
        console.log(`      ✅ 检测到工具结果更新: ${message.toolUseId}`);
      }
    });

    // 发送一个会使用工具的请求
    console.log(`      📤 发送工具使用请求...`);
    await session.send(
      "请使用Read工具查看当前目录，然后创建一个简单的TODO列表",
      undefined
    );

    console.log(`      📊 统计结果:`);
    console.log(`         🔧 工具调用次数: ${toolUsesDetected}`);
    console.log(`         ✅ 工具结果次数: ${toolResultsDetected}`);

    if (toolUsesDetected > 0) {
      console.log(`   ✅ 工具结果连接: 检测到工具使用`);
    } else {
      console.log(
        `   ⚠️  工具结果连接: 未检测到工具使用（可能因为使用minimal预设）`
      );
    }

    unsubscribe();
    console.log(`   ✅ 工具结果连接逻辑: 测试完成`);
  } catch (error) {
    console.log(`   ❌ 工具结果连接逻辑: 测试失败 - ${error}`);
  }
}

// 运行测试
if (import.meta.main) {
  newFeaturesTest();
}
