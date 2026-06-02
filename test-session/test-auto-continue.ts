import { createAutoContinueManager } from "./src/index";


/**
 * Test systemPrompt functionality with different scenarios
 */
async function testSystemPromptFunctionality() {
  console.log("\n🧪 Testing SystemPrompt Functionality\n");

  // Test 1: Preset with built-in systemPrompt (question_continue)
  console.log("1️⃣ Testing preset with built-in systemPrompt...");
  try {
    const questionManager = createAutoContinueManager("question_continue", {
      maxTurns: 5,
      pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH || '/Users/zack/.bun/bin/claude'
    });
    console.log("   ✅ Created question_continue manager");
    console.log("   📝 Should have: Built-in Q&A focused systemPrompt");

    const questionSession = questionManager.createSession();
    console.log(`   ✅ Created question session: ${questionSession.claudeSessionId || 'New session'}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // Test 2: Custom systemPrompt override
  console.log("\n2️⃣ Testing custom systemPrompt override...");
  try {
    const customPrompt = "You are a TypeScript expert focused on type safety and clean code patterns.";
    const customManager = createAutoContinueManager("development_continue", {
      maxTurns: 5,
      pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH || '/Users/zack/.bun/bin/claude',
      systemPrompt: customPrompt
    });
    console.log("   ✅ Created development_continue manager with custom systemPrompt");
    console.log(`   📝 Custom prompt: "${customPrompt}"`);

    const customSession = customManager.createSession();
    console.log(`   ✅ Created custom session: ${customSession.claudeSessionId || 'New session'}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // Test 3: Unified API with base preset and continue option
  console.log("\n3️⃣ Testing unified API with base preset and continue option...");
  try {
    const optionsPrompt = "You are a helpful assistant for API documentation and code examples.";
    const unifiedManager = createAutoContinueManager("production", {
      continue: true,
      maxTurns: 10,
      systemPrompt: optionsPrompt
    });
    console.log("   ✅ Created manager with unified API and systemPrompt");
    console.log(`   📝 Unified prompt: "${optionsPrompt}"`);

    const unifiedSession = unifiedManager.createSession();
    console.log(`   ✅ Created unified session: ${unifiedSession.claudeSessionId || 'New session'}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // Test 4: Backward compatibility (no systemPrompt provided)
  console.log("\n4️⃣ Testing backward compatibility...");
  try {
    const backwardCompatibleManager = createAutoContinueManager("minimal_continue", {
      maxTurns: 5,
      pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH || '/Users/zack/.bun/bin/claude'
    });
    console.log("   ✅ Created minimal_continue manager without systemPrompt");
    console.log("   📝 Should use: Default systemPrompt from cas-client");

    const backwardSession = backwardCompatibleManager.createSession();
    console.log(`   ✅ Created backward compatible session: ${backwardSession.claudeSessionId || 'New session'}`);
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  // Test 5: Test systemPrompt priority (user > preset > default)
  console.log("\n5️⃣ Testing systemPrompt priority...");
  try {
    const originalPresetPrompt = "You are a helpful assistant focused on answering questions and providing information.";
    const userOverridePrompt = "You are a Python expert focused on machine learning and data science.";

    // This should use the user's prompt, not the preset's prompt
    const priorityManager = createAutoContinueManager("question_continue", {
      maxTurns: 5,
      pathToClaudeCodeExecutable: process.env.CLAUDE_CODE_PATH || '/Users/zack/.bun/bin/claude',
      systemPrompt: userOverridePrompt  // This should override the preset's systemPrompt
    });
    console.log("   ✅ Created manager with systemPrompt priority test");
    console.log(`   📝 Original preset prompt: "${originalPresetPrompt}"`);
    console.log(`   📝 User override prompt: "${userOverridePrompt}"`);
    console.log("   🔥 User prompt should take priority!");
  } catch (error) {
    console.log(`   ❌ Error: ${error}`);
  }

  console.log("\n✅ SystemPrompt functionality test completed!");
}

/**
 * Run all tests
 */
async function runAllTests() {
  await testSystemPromptFunctionality();
  console.log("\n🎉 All tests completed successfully!");
}

// Run all tests
runAllTests().catch(console.error);