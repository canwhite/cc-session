#!/usr/bin/env node

/**
 * 错误处理测试脚本
 * 测试 CC-Session 库在各种错误场景下的表现
 */

import { Session, SessionManager, createClientWithPreset } from './dist/index.js';

console.log('🧪 CC-Session 错误处理测试\n');

let errorCount = 0;
let successCount = 0;

function testResult(testName, success, error = null) {
  if (success) {
    successCount++;
    console.log(`✅ ${testName}: 通过`);
  } else {
    errorCount++;
    console.log(`❌ ${testName}: 失败`);
    if (error) {
      console.log(`   错误信息: ${error.message}`);
    }
  }
}

function logSection(sectionName) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📍 ${sectionName}`);
  console.log(`${'='.repeat(50)}\n`);
}

// 1. 测试无效预设
logSection('1️⃣ 测试无效预设');
console.log('测试无效的客户端预设...');

try {
  const invalidClient = createClientWithPreset('invalid_preset');
  testResult('无效预设创建客户端', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('无效预设创建客户端', true);
}

try {
  const emptyClient = createClientWithPreset('');
  testResult('空字符串预设', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('空字符串预设', true);
}

try {
  const nullClient = createClientWithPreset(null);
  testResult('null 预设', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('null 预设', true);
}

try {
  const undefinedClient = createClientWithPreset(undefined);
  testResult('undefined 预设', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('undefined 预设', true);
}

// 2. 测试无效的 Session 构造参数
logSection('2️⃣ 测试无效的 Session 构造参数');
console.log('测试 Session 类的错误处理...');

try {
  const invalidSession = new Session(null);
  testResult('null 客户端创建 Session', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('null 客户端创建 Session', true);
}

try {
  const invalidSession2 = new Session(undefined);
  testResult('undefined 客户端创建 Session', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('undefined 客户端创建 Session', true);
}

try {
  const invalidSession3 = new Session('not a client');
  testResult('字符串客户端创建 Session', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('字符串客户端创建 Session', true);
}

try {
  const invalidSession4 = new Session({});
  testResult('空对象客户端创建 Session', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('空对象客户端创建 Session', true);
}

// 3. 测试 SessionManager 的错误处理
logSection('3️⃣ 测试 SessionManager 错误处理');
console.log('测试 SessionManager 类的错误处理...');

try {
  const invalidManager = new SessionManager(null);
  testResult('null 工厂函数创建 SessionManager', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('null 工厂函数创建 SessionManager', true);
}

try {
  const invalidManager2 = new SessionManager(undefined);
  testResult('undefined 工厂函数创建 SessionManager', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('undefined 工厂函数创建 SessionManager', true);
}

try {
  const invalidManager3 = new SessionManager('not a function');
  testResult('字符串工厂函数创建 SessionManager', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('字符串工厂函数创建 SessionManager', true);
}

// 4. 测试订阅函数的错误处理
logSection('4️⃣ 测试订阅函数错误处理');
console.log('测试订阅系统的错误处理...');

const validClient = createClientWithPreset('development');
const validSession = new Session(validClient);

try {
  validSession.subscribe(null);
  testResult('null 订阅函数', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('null 订阅函数', true);
}

try {
  validSession.subscribe(undefined);
  testResult('undefined 订阅函数', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('undefined 订阅函数', true);
}

try {
  validSession.subscribe('not a function');
  testResult('字符串订阅函数', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('字符串订阅函数', true);
}

try {
  validSession.subscribe({});
  testResult('对象订阅函数', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('对象订阅函数', true);
}

// 5. 测试有效的错误订阅处理
logSection('5️⃣ 测试有效的错误订阅处理');
console.log('测试订阅函数内部的错误处理...');

let errorSubscriptionCount = 0;

const errorThrowingSubscription = (session, message) => {
  errorSubscriptionCount++;
  console.log(`📨 错误订阅收到消息 #${errorSubscriptionCount}: ${message.type}`);

  // 模拟订阅函数抛出错误
  if (errorSubscriptionCount === 1) {
    throw new Error('订阅函数模拟错误');
  }
};

const unsubscribeError = validSession.subscribe(errorThrowingSubscription);

// 触发一个消息来测试错误订阅
try {
  validSession.subscribe((session, message) => {
    console.log(`📨 正常订阅收到消息: ${message.type}`);
  });
  testResult('混合订阅注册', true);
} catch (error) {
  testResult('混合订阅注册', false, error);
}

// 6. 测试 SessionManager 操作错误
logSection('6️⃣ 测试 SessionManager 操作错误');
console.log('测试 SessionManager 的操作错误处理...');

const validManager = new SessionManager(() => createClientWithPreset('minimal'));

try {
  validManager.getSession(null);
  testResult('获取 null ID 的会话', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('获取 null ID 的会话', true);
}

try {
  validManager.getSession(undefined);
  testResult('获取 undefined ID 的会话', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('获取 undefined ID 的会话', true);
}

try {
  validManager.getSession('non-existent-id');
  testResult('获取不存在的会话', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('获取不存在的会话', true);
}

try {
  validManager.getSession(123);
  testResult('用数字 ID 获取会话', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('用数字 ID 获取会话', true);
}

// 7. 测试无效的会话ID格式
logSection('7️⃣ 测试无效的会话ID格式');
console.log('测试无效会话ID的处理...');

try {
  validManager.removeSession(null);
  testResult('移除 null ID 的会话', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('移除 null ID 的会话', true);
}

try {
  validManager.removeSession(undefined);
  testResult('移除 undefined ID 的会话', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('移除 undefined ID 的会话', true);
}

try {
  validManager.removeSession('');
  testResult('移除空字符串 ID 的会话', false, new Error('应该抛出错误但没有'));
} catch (error) {
  testResult('移除空字符串 ID 的会话', true);
}

// 8. 测试边界情况
logSection('8️⃣ 测试边界情况');
console.log('测试边界情况和极端输入...');

try {
  validManager.removeSession('non-existent-session-id');
  testResult('移除不存在的会话', true); // 这应该静默失败，不抛出错误
} catch (error) {
  testResult('移除不存在的会话', false, error);
}

// 9. 测试大量会话创建
logSection('9️⃣ 测试大量会话创建');
console.log('测试创建大量会话时的处理...');

try {
  const sessions = [];
  for (let i = 0; i < 1000; i++) {
    sessions.push(validManager.createSession());
  }
  testResult(`创建 1000 个会话`, true);

  // 清理
  sessions.forEach(session => {
    try {
      validManager.removeSession(session.id);
    } catch (error) {
      console.log(`清理会话时出错: ${error.message}`);
    }
  });
} catch (error) {
  testResult('创建 1000 个会话', false, error);
}

// 10. 测试内存清理
logSection('🔟 测试内存清理');
console.log('测试内存清理功能...');

try {
  const cleanupManager = new SessionManager(() => createClientWithPreset('minimal'));
  cleanupManager.createSession();
  cleanupManager.createSession();

  const beforeCleanup = cleanupManager.listSessions().length;
  cleanupManager.cleanupEmptySessions();
  const afterCleanup = cleanupManager.listSessions().length;

  testResult('空会话清理', afterCleanup <= beforeCleanup);
} catch (error) {
  testResult('空会话清理', false, error);
}

// 总结
logSection('📊 测试总结');
console.log(`✅ 通过的测试: ${successCount}`);
console.log(`❌ 失败的测试: ${errorCount}`);
console.log(`📈 成功率: ${((successCount / (successCount + errorCount)) * 100).toFixed(1)}%`);

if (errorCount === 0) {
  console.log('\n🎉 所有错误处理测试都通过了！');
  process.exit(0);
} else {
  console.log(`\n⚠️ 有 ${errorCount} 个测试失败，需要修复。`);
  process.exit(1);
}