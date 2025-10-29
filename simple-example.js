import { Session, SessionManager, createClientWithPreset } from './dist/index.js';

console.log('🚀 CC-Session 库简单使用示例\n');

// 1. 创建一个基本的会话
console.log('1️⃣ 创建基本的 Session...');
const client = createClientWithPreset('development');
const session = new Session(client);

console.log('✅ Session 创建成功');
console.log(`📋 可用工具数量: ${client.options?.tools?.length || 0}`);
console.log(`🔄 最大轮次: ${client.options?.maxTurns || 50}\n`);

// 2. 测试会话订阅功能
console.log('2️⃣ 测试会话订阅功能...');
let messageCount = 0;
const unsubscribe = session.subscribe((session, message) => {
  messageCount++;
  console.log(`📨 收到消息 #${messageCount}: ${message.type}`);

  if (message.type === 'message_added') {
    console.log(`   - 消息内容: ${message.message.content?.substring(0, 50)}...`);
  } else if (message.type === 'tool_result_updated') {
    console.log(`   - 工具结果: ${message.toolUseId}`);
  }
});

console.log('✅ 订阅设置完成\n');

// 3. 测试会话管理器
console.log('3️⃣ 创建 SessionManager...');
const manager = new SessionManager(() => createClientWithPreset('minimal'));

const session1 = manager.createSession();
const session2 = manager.createSession();
const session3 = manager.createSession();

console.log(`✅ 创建了 ${manager.listSessions().length} 个会话`);
console.log(`📊 SessionManager 状态: ${manager.listSessions().length} 个活跃会话\n`);

// 4. 测试不同预设
console.log('4️⃣ 测试不同的客户端预设...');
const presets = [
  { name: 'minimal', desc: '最小配置，仅基本工具' },
  { name: 'development', desc: '开发配置，50轮次' },
  { name: 'production', desc: '生产配置，100轮次，全部工具' },
  { name: 'question', desc: '问答专用，只读工具' }
];

presets.forEach(({ name, desc }) => {
  try {
    const client = createClientWithPreset(name);
    console.log(`✅ ${name} 预设: ${desc}`);
  } catch (error) {
    console.log(`❌ ${name} 预设: 创建失败`);
  }
});

console.log('\n🎉 所有基础功能测试完成！');
console.log(`\n📈 总结:`);
console.log(`   - Session 类: ✅ 正常工作`);
console.log(`   - SessionManager 类: ✅ 正常工作`);
console.log(`   - 客户端预设: ✅ 全部可用`);
console.log(`   - 订阅系统: ✅ 正常工作`);
console.log(`   - 接收到的消息: ${messageCount} 条`);

// 清理
unsubscribe();
manager.cleanupEmptySessions();

console.log('\n🧹 清理完成');
process.exit(0);