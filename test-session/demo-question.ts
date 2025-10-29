import { SessionManager, createClientWithPreset } from '../src';

async function demoQuestionMode() {
  console.log('=== Question Mode Demo ===');
  console.log('Question mode configuration:');
  console.log('- Max turns: 50');
  console.log('- Allowed tools: Read, Glob, Grep, LS');
  console.log('- System prompt: Focus on answering questions and providing information. Can read files and search codebases, but cannot modify files or execute system commands.');
  console.log('\n');

  // Create client in question mode
  const client = createClientWithPreset('question');

  // Create session manager
  const sessionManager = new SessionManager(client);

  // Create new session
  const session = sessionManager.createSession();

  // Subscribe to session messages for real-time updates
  const unsubscribe = session.subscribe((currentSession, broadcastMessage) => {
    switch (broadcastMessage.type) {
      case 'session_info':
        console.log(`Session info - Message count: ${broadcastMessage.messageCount}, Active: ${broadcastMessage.isActive}`);
        break;

      case 'message_added':
        console.log('\n=== New Message ===');
        const message = broadcastMessage.message;
        console.log(`Message ID: ${message.id}`);
        console.log(`Type: ${message.type}`);
        console.log(`Timestamp: ${new Date(message.timestamp).toISOString()}`);

        // Output message content
        if (message.content && message.content.length > 0) {
          console.log('Content:');
          message.content.forEach((part, index) => {
            const content = part.content || part; // Compatible with different formats
            console.log(`  [${index + 1}] ${content.type}: ${content.type === 'text' ? content.text : JSON.stringify(content)}`);

            // If there's tool result, display it too
            if (part.toolResult) {
              console.log(`     Tool result: ${part.toolResult.is_error ? 'Error' : 'Success'} - ${typeof part.toolResult.content === 'string' ? part.toolResult.content : JSON.stringify(part.toolResult.content)}`);
            }
          });
        }
        break;

      case 'tool_result_updated':
        console.log(`\n=== Tool Result Updated ===`);
        console.log(`Message ID: ${broadcastMessage.messageId}`);
        console.log(`Tool use ID: ${broadcastMessage.toolUseId}`);
        console.log(`Result: ${broadcastMessage.result.is_error ? 'Error' : 'Success'}`);
        break;

      case 'todos_updated':
        console.log(`\n=== Todos Updated ===`);
        console.log(`Todo count: ${broadcastMessage.todos.length}`);
        broadcastMessage.todos.forEach((todo, index) => {
          console.log(`  [${index + 1}] ${todo.status}: ${todo.content}`);
        });
        break;

      case 'usage_updated':
        console.log(`\n=== Usage Updated ===`);
        const usage = broadcastMessage.usage;
        console.log(`Total tokens: ${usage.totalTokens}`);
        console.log(`Total cost: $${usage.totalCost.toFixed(6)}`);
        console.log(`Context window: ${usage.contextWindow}`);
        break;
    }
  });

  // Simulate user question
  const question = 'Please analyze this project code structure and explain the main modules';
  console.log(`\nUser question: ${question}`);

  // Send message and handle response
  console.log('\nStarting to process request...\n');

  try {
    const result = await session.send(question, undefined);

    if (result.success) {
      console.log('\n=== Request completed successfully ===');
      console.log(`Final message count: ${result.messageCount}`);
    } else {
      console.log('\n=== Request failed ===');
      console.log(`Error message: ${result.error}`);
    }
  } catch (error) {
    console.error('\n=== Error occurred during processing ===');
    console.error(error instanceof Error ? error.message : String(error));
  } finally {
    // Unsubscribe
    unsubscribe();

    // Output final session state
    console.log('\n=== Final Session State ===');
    console.log(`Session ID: ${session.claudeSessionId || 'New session'}`);
    console.log(`Total messages: ${session.messages.length}`);
    console.log(`Has error: ${session.error ? 'Yes' : 'No'}`);
    if (session.error) {
      console.log(`Error message: ${session.error}`);
    }
    console.log(`Is busy: ${session.busy}`);
    console.log(`Is explicit session: ${session.isExplicit}`);
    console.log(`Last modified: ${new Date(session.lastModifiedTime).toISOString()}`);

    if (session.todos.length > 0) {
      console.log(`Todo count: ${session.todos.length}`);
      session.todos.forEach((todo, index) => {
        console.log(`  [${index + 1}] ${todo.status}: ${todo.content}`);
      });
    }

    if (session.tools.length > 0) {
      console.log(`Available tools count: ${session.tools.length}`);
      console.log(`Tool list: ${session.tools.join(', ')}`);
    }

    const usage = session.usageData;
    console.log(`Token usage: total=${usage.totalTokens}, cost=$${usage.totalCost.toFixed(6)}, context=${usage.contextWindow}`);
  }
}

// Run demo if this file is executed directly
if (require.main === module) {
  demoQuestionMode().catch(console.error);
}

export { demoQuestionMode };