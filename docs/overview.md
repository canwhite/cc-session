# Overview

## `@iamqc/cc-session` 是什么

一个 TypeScript 库，用于管理 Claude Code 对话会话。

---

## 最核心的功能

用户调用 `session.send(prompt)` 发送一条消息，SDK 底层会启动 Claude Code Agent 并返回一个流式消息迭代器。`Session` 遍历这个迭代器，每收到一条消息就做三件事：

1. **派生状态** — 如果是 assistant 消息，提取其中的 `TodoWrite` 工具调用来更新 todo 列表；如果有 `usage` 信息就更新 token 计费；记录可用工具列表
2. **构建视图** — 把 SDK 的原始消息转换成 `ChatMessage` 值对象，并合并相邻的 Read 工具调用
3. **广播变更** — 用 `SubscriptionRouter` 通知所有订阅者具体变了什么（哪条消息被添加、哪个工具结果更新了、todo 列表变了）

这个"遍历流 + 派生 + 广播"的过程完全由 `Session` 协调，`MessageIndex` 负责消息数组的增删和 diff 计算，`SubscriptionRouter` 负责事件发射，两者都可以独立测试。

---

## 自动续会的实现

当 `AutoContinueSession` 检测到当前消息数接近 `maxTurns` 上限时，它创建一个新 session，将 todos、tools、summary 迁移过去，然后在新 session 里继续发送用户的消息。这个迁移是纯数据拷贝，不依赖 SDK 能力。

---

## 一句话总结

这个库的本质是一个**基于订阅的流式状态机** — 把 SDK 的无结构流，变成有结构的、可观测的、会话级别的状态变更流。
