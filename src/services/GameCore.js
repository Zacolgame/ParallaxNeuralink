/**
 * Game Core Logic: Score Management, Persistence, Achievements
 */
export class GameCore {
    constructor() {
        this.state = {
            totalScore: 0,
            unlockedTechs: [],
            stats: {
                summaryCount: 0,
                chatCount: 0
            }
        };
        this.listeners = [];
        this._loadState();

        this.ACHIEVEMENTS = [
            // --- Score Milestones (算力阶梯) ---
            { id: 'SCORE_1', name: '神经网络初学者', description: '累计获得 100 算力', condition: (state) => state.totalScore >= 100 },
            { id: 'SCORE_2', name: '硅基矿工', description: '累计获得 1,000 算力', condition: (state) => state.totalScore >= 1000 },
            { id: 'SCORE_3', name: '量子架构师', description: '累计获得 10,000 算力', condition: (state) => state.totalScore >= 10000 },
            { id: 'SCORE_4', name: '奇点观测者', description: '累计获得 100,000 算力', condition: (state) => state.totalScore >= 100000 },
            { id: 'SCORE_5', name: '维度飞升', description: '累计获得 1,000,000 算力', condition: (state) => state.totalScore >= 1000000 },

            // --- Chat Milestones (交互深度) ---
            { id: 'CHAT_1', name: 'Hello World', description: '完成 10 次神经对话', condition: (state) => state.stats.chatCount >= 10 },
            { id: 'CHAT_2', name: '图灵测试员', description: '完成 50 次神经对话', condition: (state) => state.stats.chatCount >= 50 },
            { id: 'CHAT_3', name: '合成哲学', description: '完成 200 次神经对话', condition: (state) => state.stats.chatCount >= 200 },

            // --- Summary Milestones (数据解析) ---
            { id: 'SUM_1', name: '数据收割者', description: '完成 1 次页面解析', condition: (state) => state.stats.summaryCount >= 1 },
            { id: 'SUM_2', name: '信息掮客', description: '完成 20 次页面解析', condition: (state) => state.stats.summaryCount >= 20 },
            { id: 'SUM_3', name: '全知之眼', description: '完成 100 次页面解析', condition: (state) => state.stats.summaryCount >= 100 },

            // --- Special (特殊成就: 分布式节点) ---
            {
                id: 'NODE_LINK_1',
                name: '节点链接者',
                description: '接入 Parallax 网络 (检测到 >1 个节点)',
                condition: (state) => state.stats.distributedNodes >= 1
            },
             {
                id: 'NODE_LINK_10',
                name: '去中心化共识',
                description: '网络中活跃节点超过 10 个',
                condition: (state) => state.stats.distributedNodes >= 10
            }
        ];
    }

    updateNodeCount(count) {
        let validCount = 0;
        if (typeof count === 'number') {
            validCount = count;
        } else if (Array.isArray(count)) {
            validCount = count.length;
        }
        
        this.state.stats.distributedNodes = Math.max(this.state.stats.distributedNodes || 0, validCount);
        this._checkAchievements();
        this._saveState();
    }

    getScoreMultiplier() {
        const nodeCount = this.state.stats.distributedNodes || 0;
        // Base 1.0 + 0.2 for each unlocked achievement + 1.0 per node
        return 1.0 + (this.state.unlockedTechs.length * 0.2) + (nodeCount * 1.0);
    }

    subscribe(callback) {
        this.listeners.push(callback);
        callback(this.state); // Initial push
    }

    _notify() {
        this.listeners.forEach(cb => cb(this.state));
    }

    async _loadState() {
        try {
            const result = await chrome.storage.local.get(['gameState']);
            if (result.gameState) {
                this.state = { ...this.state, ...result.gameState };
                // Ensure stats structure exists
                if(!this.state.stats) this.state.stats = { summaryCount: 0, chatCount: 0, maxNodeCount: 0 };
            }
            this._notify();
        } catch (e) {
            console.error("Failed to load state", e);
        }
    }

    async _saveState() {
        try {
            await chrome.storage.local.set({ gameState: this.state });
            this._notify();
        } catch (e) {
            console.error("Failed to save state", e);
        }
    }

    recordTaskCompletion(taskType, baseScore, extraData = {}) {
        // Apply Multiplier
        const multiplier = this.getScoreMultiplier();
        const finalScore = Math.floor(baseScore * multiplier);

        this.state.totalScore += finalScore;

        if (taskType === 'SUMMARIZE') {
            this.state.stats.summaryCount = (this.state.stats.summaryCount || 0) + 1;
            // Update max node count if provided
            if (extraData.nodeCount) {
                this.state.stats.maxNodeCount = Math.max(
                    this.state.stats.maxNodeCount || 0, 
                    extraData.nodeCount
                );
            }
        } else if (taskType === 'CHAT') {
            this.state.stats.chatCount = (this.state.stats.chatCount || 0) + 1;
        }

        this._checkAchievements();
        this._saveState();
        
        return finalScore; // Return actual score added
    }

    // Deprecated but kept for compatibility if needed, forwards to recordTaskCompletion
    addScore(amount) {
        this.recordTaskCompletion('UNKNOWN', amount);
    }

    reset() {
        this.state = {
            totalScore: 0,
            unlockedTechs: [],
            stats: { summaryCount: 0, chatCount: 0 }
        };
        this._saveState();
    }

    _checkAchievements() {
        let newUnlock = false;
        this.ACHIEVEMENTS.forEach(tech => {
            if (!this.state.unlockedTechs.includes(tech.id)) {
                if (tech.condition(this.state)) {
                    this.state.unlockedTechs.push(tech.id);
                    console.log(`Achievement Unlocked: ${tech.name}`);
                    // We could trigger a specific notification event here if we had a way to
                    // distinctively notify the UI. For now, the state update handles it.
                    newUnlock = true;
                }
            }
        });
        // if newUnlock, maybe add a temporary flag to state for UI to pop a toast?
    }

    getAchievements() {
        return this.ACHIEVEMENTS;
    }
}