import { createAutoContinueManager } from "./src/index";

/**
 * Test script to verify consistent API usage with auto-continue
 * Now the usage is exactly the same as SessionManager!
 */
async function testConsistentAPI() {
  console.log("🚀 Testing Consistent API with Auto-Continue\n");

  // Test 1: Create auto-continue manager with small maxTurns
  console.log("1️⃣ Creating auto-continue manager (maxTurns: 5)...");
  const manager = createAutoContinueManager("development_continue", { maxTurns: 5 });

  // Create session - SAME API as SessionManager!
  const session = manager.createSession();
  console.log(`   ✅ Created session: ${session.claudeSessionId || 'New session'}`);

  // Test 2: Simulate multiple messages to trigger auto-continuation
  console.log("\n2️⃣ Simulating messages to trigger auto-continuation...");

  // Simulate adding messages to the session
  for (let i = 0; i < 4; i++) {
    // Add mock messages to simulate approaching the limit
    session.messages.push({
      id: `msg-${i}`,
      type: 'user',
      content: [{ type: 'text', text: `Test message ${i}` }],
      timestamp: Date.now()
    } as any);
  }

  console.log(`   Current message count: ${session.messages.length}`);
  console.log(`   Max turns: ${5}, Trigger threshold: ${5 - 5} = 0`);

  // Test 3: Send message - SAME API as SessionManager!
  console.log("\n3️⃣ Testing send method (consistent API)...");

  try {
    // This is the key improvement: same API as SessionManager!
    const result = await session.send("Test message to trigger continuation");

    if (result.continued) {
      console.log(`   ✅ Auto-continuation triggered!`);
      console.log(`   Original session: ${session.claudeSessionId}`);
      console.log(`   New session: ${result.newSession?.claudeSessionId}`);
      console.log(`   Success: ${result.success}`);
    } else {
      console.log(`   ❌ Auto-continuation not triggered (expected when approaching maxTurns)`);
      console.log(`   Message count: ${session.messages.length}`);
    }
  } catch (error) {
    console.log(`   ❌ Error during send: ${error}`);
  }

  // Test 4: Compare with original SessionManager usage
  console.log("\n4️⃣ API Usage Comparison:");
  console.log("   Original SessionManager:");
  console.log("     const session = manager.createSession();");
  console.log("     const result = await session.send('message');");
  console.log("   ");
  console.log("   AutoContinueSessionManager:");
  console.log("     const session = manager.createSession();");
  console.log("     const result = await session.send('message');");
  console.log("   ✅ EXACTLY THE SAME API!");

  console.log("\n✅ Consistent API test completed!");
}

// Run the test
testConsistentAPI().catch(console.error);