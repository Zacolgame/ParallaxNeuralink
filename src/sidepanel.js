import { ParallaxService } from './services/ParallaxService.js';
import { GameCore } from './services/GameCore.js';
import { ChatTask } from './tasks/ChatTask.js';
import { SummarizeTask } from './tasks/SummarizeTask.js';

// Initialize Core Modules
const gameCore = new GameCore();
// User specified service running at port 3001
const parallaxService = new ParallaxService("http://127.0.0.1:3001/v1"); 

// UI Elements
const scoreEl = document.getElementById('score-value');
const multiplierEl = document.getElementById('score-multiplier');
const statusEl = document.getElementById('connection-status');
const pingBtn = document.getElementById('debug-ping-btn');
const resetBtn = document.getElementById('reset-btn');
const chatHistory = document.getElementById('chat-history');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const absorbBtn = document.getElementById('absorb-btn');
const achievementsList = document.getElementById('achievements-list');
const tabBtns = document.querySelectorAll('.tab-btn');
const viewContents = document.querySelectorAll('.view-content');

// Settings Elements
const manualSyncBtn = document.getElementById('manual-sync-btn');
const clearCacheBtn = document.getElementById('clear-cache-btn');
const syncStatusMsg = document.getElementById('sync-status-msg');
const cachedCountDisplay = document.getElementById('cached-count-display');

// 0. Helper Functions
function formatScore(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}

function updateCacheDisplay() {
    chrome.storage.local.get(['cachedNodeCount'], (result) => {
        if (result.cachedNodeCount) {
            cachedCountDisplay.textContent = result.cachedNodeCount;
            cachedCountDisplay.style.color = '#00ff9d';
        } else {
            cachedCountDisplay.textContent = '--';
            cachedCountDisplay.style.color = '#666';
        }
    });
}

// 0. Tab Logic
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // Remove active from all
        tabBtns.forEach(b => b.classList.remove('active'));
        viewContents.forEach(v => v.classList.remove('active'));
        
        // Add active to current
        btn.classList.add('active');
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        
        // If settings tab, update cache display
        if (tabId === 'settings-view') {
            updateCacheDisplay();
        }
    });
});

// Settings Events
manualSyncBtn.addEventListener('click', async () => {
    syncStatusMsg.textContent = "正在分析节点健康状态...";
    syncStatusMsg.style.color = "#aaa";

    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) throw new Error("无活动页面");

        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                let debugInfo = [];
                let onlineCount = 0;
                let totalDevices = 0;
                
                // Helper: Check if an element looks "Green" (Status indicator)
                const isGreen = (el) => {
                    const style = window.getComputedStyle(el);
                    const color = style.color;
                    const bg = style.backgroundColor;
                    const fill = style.fill;
                    return /rgb\(\s*0,\s*(128|255|[1-9]\d{2})\s*,/.test(color) || 
                           /rgb\(\s*0,\s*(128|255|[1-9]\d{2})\s*,/.test(bg) ||
                           /rgb\(\s*0,\s*(128|255|[1-9]\d{2})\s*,/.test(fill) ||
                           el.classList.contains('online') || 
                           el.classList.contains('success');
                };

                // Find Topology Section
                const headers = Array.from(document.querySelectorAll('h1, h2, h3, div, span'))
                    .filter(el => el.innerText && el.innerText.includes('Cluster topology'));

                if (headers.length > 0) {
                    let container = headers[0].parentElement; 
                    if (container.innerText.length < 100) container = container.parentElement;

                    if (container) {
                        const allElements = container.querySelectorAll('div, p, li, span');
                        
                        for (let el of allElements) {
                            const txt = el.innerText;
                            
                            // 1. Identify Device Name
                            if (/NVIDIA|GeForce|RTX|GTX|Apple M|Intel Core|AMD Ryzen|Qualcomm|Snapdragon/i.test(txt)) {
                                
                                // Ensure this is a leaf element (not a container of multiple devices)
                                const childMatches = Array.from(el.children).some(child => 
                                    /NVIDIA|GeForce|RTX|GTX|Apple M|Intel Core|AMD Ryzen/i.test(child.innerText)
                                );
                                
                                if (!childMatches) {
                                    // Found a device element. Now find its "Row" container.
                                    let row = el;
                                    for(let i=0; i<4; i++) {
                                        if(!row.parentElement || row === container) break;
                                        // If we hit a container with SVG, it's a strong candidate for the "Row"
                                        if(row.querySelector('svg')) {
                                            // Optional: check if parent has the text too to be safe
                                            if (row.parentElement.innerText.includes(txt)) {
                                                 row = row.parentElement;
                                            }
                                            break;
                                        }
                                        row = row.parentElement;
                                    }

                                    const cleanName = txt.split('\n')[0].substring(0, 20);
                                    let isOffline = false;
                                    let isOnline = false;
                                    let debugReason = "";

                                    // A. Check SVG Icons & Specific Classes (User Provided)
                                    // User specified: Online = "css-1nvoxpa", Offline = "css-1xdjgc6" (with rotation)
                                    if (row.querySelector('.css-1nvoxpa')) {
                                        isOnline = true;
                                        debugReason = "Class: css-1nvoxpa";
                                    } else if (row.querySelector('.css-1xdjgc6')) {
                                        isOffline = true;
                                        debugReason = "Class: css-1xdjgc6";
                                    }

                                    if (!isOnline && !isOffline) {
                                        const svgs = row.querySelectorAll('svg');
                                        for (let svg of svgs) {
                                            const style = window.getComputedStyle(svg);
                                            const transform = style.transform;
                                            const color = style.color;
                                            const fill = style.fill;
                                            const inlineStyle = svg.getAttribute('style') || "";
                                            const parentDiv = svg.parentElement;

                                            // Check for Rotation (Offline Indicator)
                                            // Also check parent div for rotation as seen in user snippet
                                            const parentStyle = parentDiv ? parentDiv.getAttribute('style') || "" : "";
                                            
                                            if ((transform && transform !== 'none') || inlineStyle.includes('rotate') || parentStyle.includes('rotate')) {
                                                isOffline = true;
                                                debugReason = `Icon/Parent Rotated`;
                                                break; 
                                            }
                                            
                                            // Check for Green Color (Online Indicator)
                                            if (!isOffline) {
                                                if (/rgb\(\s*0,\s*(128|255|[1-9]\d{2})\s*,/.test(color) || 
                                                    /rgb\(\s*0,\s*(128|255|[1-9]\d{2})\s*,/.test(fill)) {
                                                    isOnline = true;
                                                    debugReason = "Icon Green";
                                                }
                                            }
                                        }
                                    }

                                    // B. Check Text (Secondary)
                                    if (!isOffline && !isOnline) {
                                        const rowText = row.innerText;
                                        if (/Offline|Disconnected|Error|Unavailable/i.test(rowText)) {
                                            isOffline = true;
                                            debugReason = "Text Offline";
                                        } else if (/Online|Idle|Busy|Running|Active|Ready|Connected|Synced/i.test(rowText)) {
                                            isOnline = true;
                                            debugReason = "Text Online";
                                        }
                                    }

                                    // C. Final Decision
                                    if (isOffline) {
                                        totalDevices++;
                                        // debugInfo.push(`[Offline] ${cleanName}`);
                                    } else if (isOnline) {
                                        onlineCount++;
                                        totalDevices++;
                                    } else {
                                        // Ambiguous case (No explicit Green, but also NO Rotation/Offline text).
                                        // User feedback: "The offline one has rotation". 
                                        // Therefore: No rotation == Online.
                                        onlineCount++;
                                        totalDevices++;
                                        // debugInfo.push(`[Assumed Online] ${cleanName}`);
                                    }
                                }
                            }
                        }
                    }
                }

                if (onlineCount > 0) return { count: onlineCount, source: 'Visual_Status_Check' };
                
                if (totalDevices > 0) {
                     return { count: 0, source: 'All_Offline', debug: `Found ${totalDevices} devices, all offline/unknown. Samples: ${debugInfo.slice(0,3).join('; ')}` };
                }

                return { count: null, debug: `No devices found. Debug: ${debugInfo.length} logs` };
            }
        });

        const res = results[0]?.result;
        
        if (res && res.count !== null && !isNaN(res.count)) {
            // Fix Race Condition: Wait for storage save before checking connection
            chrome.storage.local.set({ cachedNodeCount: res.count }, () => {
                gameCore.updateNodeCount(res.count);
                updateCacheDisplay();
                checkConnection(res.count); // Pass explicit count
                
                syncStatusMsg.textContent = `✅ 同步成功! (源: ${res.source}) 在线节点: ${res.count}`;
                syncStatusMsg.style.color = "#00ff9d";
            });
        } else {
            console.warn("Sync Debug:", res?.debug);
            syncStatusMsg.innerHTML = `⚠️ 状态识别受阻。<br><span style='font-size:0.7em;color:#888'>${res?.debug || '无调试信息'}</span>`;
            syncStatusMsg.style.color = "#ff4444";
        }

    } catch (e) {
        console.error(e);
        syncStatusMsg.textContent = "❌ 扫描错误: " + e.message;
        syncStatusMsg.style.color = "#ff4444";
    }
});

clearCacheBtn.addEventListener('click', () => {
    chrome.storage.local.remove(['cachedNodeCount'], () => {
        updateCacheDisplay();
        checkConnection();
        syncStatusMsg.textContent = "缓存已清除。";
        syncStatusMsg.style.color = "#aaa";
    });
});

// 1. Bind Game State to UI
gameCore.subscribe((state) => {
    // Format Score
    scoreEl.textContent = formatScore(state.totalScore);
    scoreEl.title = `精确数值: ${state.totalScore}`; // Tooltip for raw number
    
    // Update Multiplier Display & Tooltip
    const currentMult = gameCore.getScoreMultiplier();
    multiplierEl.textContent = `x${currentMult.toFixed(1)}`;
    
    // Calculate details
    const unlockedCount = state.unlockedTechs.length;
    const nodeCount = state.stats.distributedNodes || 0;
    multiplierEl.title = `当前增效详情:\n----------------\n已解锁成就: ${unlockedCount} 个 (+${(unlockedCount*0.2).toFixed(1)}x)\n接入节点: ${nodeCount} 个 (+${(nodeCount*1.0).toFixed(1)}x)\n基础倍率: 1.0x\n----------------\n总倍率: x${currentMult.toFixed(1)}`;

    // Animation
    scoreEl.style.transform = "scale(1.1)";
    scoreEl.style.color = "#0f0";
    setTimeout(() => {
        scoreEl.style.transform = "scale(1)";
        scoreEl.style.color = "";
    }, 200);

    renderAchievements(state);
});

function renderAchievements(state) {
    achievementsList.innerHTML = '';
    const allAchievements = gameCore.getAchievements();
    
    allAchievements.forEach(tech => {
        const isUnlocked = state.unlockedTechs.includes(tech.id);
        const el = document.createElement('div');
        el.className = `achievement-item ${isUnlocked ? 'unlocked' : ''}`;
        el.innerHTML = `
            <div class="achievement-header">
                <span class="achievement-title">${tech.name}</span>
                <span class="achievement-status">${isUnlocked ? '已解锁' : '锁定'}</span>
            </div>
            <div class="achievement-desc">${tech.description}</div>
        `;
        achievementsList.appendChild(el);
    });
}

// 2. Connection Status
async function checkConnection(forceCount = null) {
    statusEl.className = "status-indicator";
    
    let distributedNodeCount = 0;
    
    // 0. Force Update (from Manual Sync)
    // Ensure forceCount is a valid number (ignore event objects from listeners)
    if (forceCount !== null && typeof forceCount === 'number') {
        distributedNodeCount = forceCount;
        // Skip re-verification if we have fresh authoritative data
        statusEl.textContent = `● 分布式网络在线 | 接入节点: ${distributedNodeCount}`;
        statusEl.classList.add("online");
        statusEl.classList.remove("offline");
        gameCore.updateNodeCount(distributedNodeCount);
        return;
    }

    let isParallaxPage = false;

    // 1. Load cached node count first
    try {
        const stored = await chrome.storage.local.get(['cachedNodeCount']);
        if (stored.cachedNodeCount !== undefined) {
             // Ensure it is a number, not an object
             if (typeof stored.cachedNodeCount === 'number') {
                distributedNodeCount = stored.cachedNodeCount;
             } else if (typeof stored.cachedNodeCount === 'object') {
                 // If it's an object, try to rescue it or default to 0
                 if (Array.isArray(stored.cachedNodeCount)) {
                     distributedNodeCount = stored.cachedNodeCount.length;
                 } else {
                     // If it's { count: 5 } or similar from previous bug
                     distributedNodeCount = 0; // Reset to safe default if corrupt
                 }
             }
        }
    } catch (e) {}

    // 2. API Check (Priority: High)
    // The user prefers API over scraping.
    let apiNodeCount = await parallaxService.getNetworkStatus();
    if (apiNodeCount !== null) {
        distributedNodeCount = apiNodeCount;
        // API is definitely online
        statusEl.textContent = `● 分布式网络在线 | 接入节点: ${distributedNodeCount}`;
        statusEl.classList.add("online");
        statusEl.classList.remove("offline");
        
        // Save and update
        chrome.storage.local.set({ cachedNodeCount: distributedNodeCount });
        gameCore.updateNodeCount(distributedNodeCount);
        return; // Exit early, no need to scrape if API works
    }

    // 3. Scrape Dashboard (Fallback)
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && tab.url && (tab.url.includes(':3001') || tab.title.includes('Parallax'))) {
            isParallaxPage = true;
            
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    // ... (Scraping logic remains as deep fallback) ...
                    // 1. Try ID
                    const idEl = document.getElementById('dist-node-count');
                    if (idEl) return parseInt(idEl.innerText);

                    // 2. Try Class
                    const classEl = document.querySelector('.node-count');
                    if (classEl) return parseInt(classEl.innerText);

                    // 3. Heuristic
                    const all = document.querySelectorAll('*');
                    for (let el of all) {
                        const text = el.innerText || "";
                        if (/Nodes?|节点/i.test(text) && !/RTX|GTX/.test(text)) {
                             const match = text.match(/(\d+)/);
                             if (match) return parseInt(match[1]);
                        }
                    }
                    return -1;
                }
            });
            
            const res = results[0]?.result;
            if (res && res !== -1 && !isNaN(res)) {
                distributedNodeCount = res;
                statusEl.textContent = `● 分布式网络在线 | 接入节点: ${distributedNodeCount}`;
                statusEl.classList.add("online");
                statusEl.classList.remove("offline");
                chrome.storage.local.set({ cachedNodeCount: distributedNodeCount });
                gameCore.updateNodeCount(distributedNodeCount);
                return;
            }
        }
    } catch (e) { console.warn("Dashboard scan failed", e); }

    // 4. Final Display Logic
    // If we have a cached count > 0, show it as "Online" (Optimistic)
    if (distributedNodeCount > 0) {
        statusEl.textContent = `● 分布式网络在线 | 接入节点: ${distributedNodeCount}`;
        statusEl.classList.add("online");
        statusEl.classList.remove("offline");
        gameCore.updateNodeCount(distributedNodeCount);
    } else {
        // Only fall back to API ping if we have absolutely NO count (new install, never connected)
        try {
             const isOnline = await parallaxService.ping();
             if (isOnline) {
                 statusEl.textContent = `● 核心在线 | 节点同步中...`;
                 statusEl.classList.add("online");
                 statusEl.classList.remove("offline");
             } else {
                 statusEl.textContent = "● 离线 (请连接 Parallax 节点)";
                 statusEl.classList.add("offline");
                 statusEl.classList.remove("online");
             }
        } catch(e) {
             statusEl.textContent = "● 离线";
        }
    }
}

// Listen for tab changes to re-check connection context
chrome.tabs.onActivated.addListener(checkConnection);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete') {
        checkConnection();
    }
});

// 3. UI Helpers
function parseMarkdown(text) {
    // 1. Handle <think> blocks (DeepSeek style)
    let html = text.replace(/<think>([\s\S]*?)<\/think>/gi, 
        '<details class="think-block"><summary>思维链 (Chain of Thought)</summary><div class="think-content">$1</div></details>');

    // 2. Basic Markdown Formatting
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // List items (simple)
    html = html.replace(/^\s*-\s+(.*)$/gm, '<li>$1</li>');
    // Wrap lists (rough approximation)
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>'); 
    // Newlines to <br> (except inside HTML tags roughly)
    html = html.replace(/\n/g, '<br>');

    return html;
}

function appendMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    
    if (role === 'ai') {
        // Render HTML for AI
        msgDiv.innerHTML = parseMarkdown(text);
    } else {
        // Keep user input safe as text
        msgDiv.textContent = text;
    }
    
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
    return msgDiv; // Return element for further manipulation
}

function appendScoreTag(messageDiv, baseScore, finalScore, multiplier) {
    if (!messageDiv) return;
    
    const tag = document.createElement('span');
    tag.className = 'score-tag';
    tag.textContent = `+${finalScore} ⚡`;
    
    // Create detailed tooltip text
    const detailText = `基础算力: ${baseScore}\n增效倍率: x${multiplier.toFixed(1)}\n----------------\n最终收益: ${finalScore}`;
    tag.setAttribute('data-tooltip', detailText);
    
    // Check if message has think block to avoid appending inside details
    // Just append to the end of messageDiv
    messageDiv.appendChild(tag);
}

async function handleTaskExecution(task, input, extraData = {}) {
    try {
        let streamMessageDiv = null;
        let fullContent = "";

        // Define Stream Handler
        const onChunk = (chunk) => {
            if (!streamMessageDiv) {
                // Create message container on first chunk
                streamMessageDiv = document.createElement('div');
                streamMessageDiv.className = `message ai streaming`; 
                chatHistory.appendChild(streamMessageDiv);
            }
            
            fullContent += chunk;
            streamMessageDiv.innerHTML = parseMarkdown(fullContent);
            chatHistory.scrollTop = chatHistory.scrollHeight;
        };

        const { result, score } = await parallaxService.execute(task, input, onChunk);
        
        // If streaming happened, remove the 'streaming' class
        if (streamMessageDiv) {
            streamMessageDiv.classList.remove('streaming');
        }

        // Update Game State (Core handles multiplier)
        // We need to retrieve the multiplier to show it in the tag.
        // recordTaskCompletion returns the *added* score (finalScore).
        // But we also want the multiplier for the tooltip.
        const currentMultiplier = gameCore.getScoreMultiplier();
        const actualScore = gameCore.recordTaskCompletion(task.type, score, extraData);
        
        // Append Score Tag to the AI message
        // Identify which message div to attach to:
        // 1. If streamed, use streamMessageDiv
        // 2. If not streamed, we will append a new message below (in caller), so handle it there or return info.
        
        // Let's handle tag appending HERE for streamed messages.
        if (streamMessageDiv) {
            appendScoreTag(streamMessageDiv, score, actualScore, currentMultiplier);
        }

        return { result, actualScore, baseScore: score, multiplier: currentMultiplier, streamed: !!streamMessageDiv };

    } catch (error) {
        console.error("Task Execution Failed:", error);
        appendMessage('system', `错误: ${error.message}`);
        return null;
    }
}

// 4. Event Listeners

// Ping
pingBtn.addEventListener('click', checkConnection);

// Reset
resetBtn.addEventListener('click', () => {
    if(confirm("确定要重置神经链接同步吗? (算力将被清零)")) {
        gameCore.reset();
        chatHistory.innerHTML = '<div class="message system">系统已重置。</div>';
    }
});

// Chat
sendBtn.addEventListener('click', async () => {
    const text = chatInput.value.trim();
    if (!text) return;

    appendMessage('user', text);
    chatInput.value = '';

    const response = await handleTaskExecution(ChatTask, text);
    
    // Only append if NOT streamed (otherwise it's already there)
    if (response && response.result && !response.streamed) {
        const msgDiv = appendMessage('ai', response.result);
        appendScoreTag(msgDiv, response.baseScore, response.actualScore, response.multiplier);
    }
});

chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
    }
});

// Absorb Page
absorbBtn.addEventListener('click', async () => {
    appendMessage('system', '正在初始化数据解析...');
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) {
            throw new Error("未找到活动标签页。");
        }

        const scriptResult = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                return {
                    text: document.body.innerText,
                    nodeCount: document.getElementsByTagName('*').length,
                    title: document.title,
                    isLocalNode: window.location.href.includes('127.0.0.1:3001')
                };
            }
        });

        const result = scriptResult[0].result;
        if (!result || !result.text) {
            throw new Error("页面内容为空。");
        }

        const { text, nodeCount, title, isLocalNode } = result;

        appendMessage('system', `目标锁定: ${title}`);
        if (isLocalNode) {
            appendMessage('system', `【本地节点】检测到活跃端口。DOM 节点负载: ${nodeCount}`);
        } else {
             appendMessage('system', `外部数据源。扫描完成: ${nodeCount} 个节点。`);
        }
        appendMessage('system', `数据流已捕获 (${text.length} chars). 开始神经解析...`);

        const response = await handleTaskExecution(SummarizeTask, text, { nodeCount: nodeCount });
        
        if (response && response.result && !response.streamed) {
            const msgDiv = appendMessage('ai', `智能总结:\n${response.result}`);
            appendScoreTag(msgDiv, response.baseScore, response.actualScore, response.multiplier);
        }

    } catch (error) {
        console.error("Absorption Failed:", error);
        appendMessage('system', `解析失败: ${error.message}`);
    }
});

// Init
checkConnection();
