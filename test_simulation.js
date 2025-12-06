import { ParallaxService } from './src/services/ParallaxService.js';
import { SummarizeTask } from './src/tasks/SummarizeTask.js';
import { ChatTask } from './src/tasks/ChatTask.js';

// Mock browser globals for Node environment
global.fetch = fetch;
global.chrome = {
    storage: {
        local: {
            get: () => Promise.resolve({}),
            set: () => Promise.resolve()
        }
    }
};

async function runSimulation() {
    console.log("--- Starting Neural Link Simulation ---");
    
    const service = new ParallaxService("http://127.0.0.1:3001/v1");
    
    // 1. Test Connection
    console.log("\n[1] Testing Connection...");
    const isOnline = await service.ping();
    console.log(`Node Status: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
    
    if (!isOnline) {
        console.error("Aborting: Parallax Node not reachable.");
        return;
    }

    // 2. Simulate Chat
    console.log("\n[2] Simulating User Chat...");
    const chatInput = "Hello, status report?";
    console.log(`User: ${chatInput}`);
    
    const chatResult = await service.execute(ChatTask, chatInput);
    console.log(`AI Response: ${chatResult.result}`);
    console.log(`Score Earned: ${chatResult.score}`);

    // 3. Simulate Page Absorption
    console.log("\n[3] Simulating Page Absorption...");
    const mockPageContent = "Parallax is a distributed computing network that rewards users for contributing local processing power. By engaging with the neural link, users unlock new tiers of access.";
    console.log(`Page Content (${mockPageContent.length} chars): "${mockPageContent}"`);
    
    const summaryResult = await service.execute(SummarizeTask, mockPageContent);
    console.log(`AI Summary: ${summaryResult.result}`);
    console.log(`Score Earned: ${summaryResult.score}`);
    
    console.log("\n--- Simulation Complete ---");
}

runSimulation();
