/**
 * 负责与 Parallax 本地节点通信的服务
 */
export class ParallaxService {
    constructor(apiUrl) {
        this.apiUrl = apiUrl || "http://localhost:11434/v1"; // 默认使用 Ollama/OpenAI 兼容接口
    }

    /**
     * 测试连接 (Ping)
     */
    async ping() {
        try {
            // 尝试访问 models 列表作为 ping
            const response = await fetch(`${this.apiUrl}/models`);
            if (response.ok) {
                return true;
            }
            return false;
        } catch (error) {
            console.warn("Parallax Node Ping Failed:", error);
            return false;
        }
    }

    /**
     * 获取网络状态 (节点数量)
     */
    async getNetworkStatus() {
        try {
            const response = await fetch(`${this.apiUrl}/models`);
            if (!response.ok) return null;

            const data = await response.json();
            
            // 1. Check for explicit meta field (Custom Parallax)
            if (data.meta && data.meta.connected_nodes) {
                const nodes = data.meta.connected_nodes;
                if (typeof nodes === 'number') return nodes;
                if (Array.isArray(nodes)) return nodes.length;
                if (typeof nodes === 'object') return Object.keys(nodes).length;
                return 1;
            }

            // 2. Check for 'nodes' field
            if (data.nodes && Array.isArray(data.nodes)) {
                return data.nodes.length;
            }

            // 3. Fallback: Count models as proxies for nodes?
            // Or just return 1 if we can connect but have no count
            return 1; 

        } catch (error) {
            return null;
        }
    }

    /**
     * 通用执行方法
     * @param {object} task - 具体的任务实例 (需实现 IAITask 接口)
     * @param {any} input - 用户输入 or 上下文
     * @param {function} onChunk - (可选) 流式输出回调
     */
    async execute(task, input, onChunk) {
        console.log(`Executing Task: ${task.type}`);
        
        // 1. 构建 Prompt
        const prompt = task.buildPrompt(input);

        // 2. 发送请求 (Call Local LLM) - Support Streaming
        const aiResponse = await this._callLocalLLM(prompt, onChunk);

        // 3. 计算分数
        const earnedScore = task.calculateScore(aiResponse, input);

        return {
            result: aiResponse,
            score: earnedScore
        };
    }

    async _callLocalLLM(prompt, onChunk) {
        try {
            const isStreaming = typeof onChunk === 'function';
            
            const response = await fetch(`${this.apiUrl}/chat/completions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    model: "llama3", 
                    messages: [
                        { role: "user", content: prompt }
                    ],
                    stream: isStreaming
                })
            });

            if (!response.ok) {
                throw new Error(`API 请求失败: ${response.statusText}`);
            }

            if (isStreaming) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder("utf-8");
                let fullText = "";

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    // Parse SSE format (data: {...})
                    const lines = chunk.split('\n').filter(line => line.trim() !== '');
                    
                    for (const line of lines) {
                        if (line.includes('[DONE]')) continue;
                        if (line.startsWith('data: ')) {
                            try {
                                const json = JSON.parse(line.substring(6));
                                const content = json.choices[0]?.delta?.content || "";
                                if (content) {
                                    fullText += content;
                                    onChunk(content); // Stream back to UI
                                }
                            } catch (e) {
                                console.warn("Stream parse error", e);
                            }
                        }
                    }
                }
                return fullText;
            } else {
                const data = await response.json();
                return data.choices[0]?.message?.content || "神经链接未返回任何数据。";
            }

        } catch (error) {
            console.error("LLM Call Error:", error);
            if (typeof onChunk === 'function') {
                onChunk("⚠️ **连接中断**: 无法连接到 Parallax 神经中枢 (Port 3001)。请检查本地服务是否启动。");
            }
            return "⚠️ **连接中断**: 无法连接到 Parallax 神经中枢 (Port 3001)。";
        }
    }
}
