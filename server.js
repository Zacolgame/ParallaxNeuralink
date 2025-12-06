const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Serve static files (mocking the Parallax Web UI)
app.use(express.static(path.join(__dirname, 'public')));

// Mock Data
let connectedNodes = 5; // Start with 5 nodes

// 1. Parallax Dashboard (The page the user sees)
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>Parallax Distributed Interface</title>
    <style>
        body { margin: 0; display: flex; height: 100vh; background: #111; color: #eee; font-family: sans-serif; }
        .sidebar { width: 250px; background: #000; border-right: 1px solid #333; padding: 20px; display: flex; flex-direction: column; }
        .main { flex: 1; padding: 20px; display: flex; flex-direction: column; }
        .logo { font-size: 1.2rem; font-weight: bold; color: #00ff9d; margin-bottom: 30px; }
        .menu-item { padding: 10px; margin-bottom: 5px; cursor: pointer; border-radius: 4px; }
        .menu-item:hover { background: #222; }
        .menu-item.active { background: #333; color: #fff; }
        .node-status { margin-top: auto; padding: 15px; background: #111; border: 1px solid #333; border-radius: 4px; }
        .node-count { font-size: 2rem; font-weight: bold; color: #00bcd4; }
        .label { font-size: 0.8rem; color: #888; margin-bottom: 5px; }
        .add-node-btn { margin-top: 10px; padding: 8px; background: #00ff9d; color: #000; border: none; cursor: pointer; font-weight: bold; width: 100%; }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="logo">PARALLAX NETWORK</div>
        <div class="menu-item active">Chat</div>
        <div class="menu-item">Topology</div>
        <div class="menu-item">Settings</div>
        
        <!-- The Info User Wants Me to Scrape -->
        <div class="node-status">
            <div class="label">分布式节点 (Distributed Nodes)</div>
            <div class="node-count" id="dist-node-count">${connectedNodes}</div>
            <div class="label">Network Status: Stable</div>
            <button class="add-node-btn" onclick="addNode()">+ 添加节点</button>
        </div>
    </div>
    <div class="main">
        <h1>Parallax Chat Console</h1>
        <p>Welcome to the distributed AI network.</p>
    </div>
    <script>
        function addNode() {
            const countEl = document.getElementById('dist-node-count');
            let count = parseInt(countEl.innerText);
            countEl.innerText = count + 1;
        }
    </script>
</body>
</html>
    `);
});

// 2. API: Models / Nodes Status
app.get('/v1/models', (req, res) => {
    res.json({
        object: 'list',
        data: [
            { id: 'parallax-v1-shard-1', object: 'model' },
            { id: 'parallax-v1-shard-2', object: 'model' }
        ],
        // Custom field for the extension to easily get node count via API too
        meta: {
            connected_nodes: connectedNodes
        }
    });
});

// 3. Chat Completions
app.post('/v1/chat/completions', (req, res) => {
    const { messages, stream } = req.body;
    const lastMessage = messages[messages.length - 1].content;

    if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const responseText = `[Distributed Network Response]\nNodes Active: ${connectedNodes}\nProcessing: "${lastMessage.substring(0, 15)}"...\n\n<think>\nAllocating tasks to ${connectedNodes} nodes...\nConsensus reached.\n</think>\n**Parallax Node Report:**\nTarget data verified. Distributed computing resources allocated efficiently.`;
        const chunks = responseText.split('');
        
        let i = 0;
        const interval = setInterval(() => {
            if (i >= chunks.length) {
                res.write('data: [DONE]\n\n');
                clearInterval(interval);
                res.end();
                return;
            }
            const chunk = {
                choices: [{ delta: { content: chunks[i] } }]
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            i++;
        }, 20); // Fast stream

    } else {
        // Non-stream fallback
        res.json({
            choices: [{ message: { content: `Nodes: ${connectedNodes}. Response: ${lastMessage}` } }]
        });
    }
});

app.listen(PORT, () => {
    console.log(`Parallax Node Mock running at http://localhost:${PORT}`);
});