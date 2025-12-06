export const SummarizeTask = {
    type: 'SUMMARIZE',
    buildPrompt: (pageContent) => {
        return `请对以下数据节点内容进行深度解析，提取核心价值信息 (Max 3000 chars)：\n${pageContent.substring(0, 3000)}`;
    },
    calculateScore: (response, pageContent) => {
        // Score = Output Tokens (response length) + Input Tokens (processed length)
        // No "free" points for just having a long page. You only get points for what is processed.
        // Approximating 1 token ~= 0.5 chars for score balance
        const inputScore = Math.min(pageContent.length, 3000) * 0.2; // Lower weight for input
        const outputScore = response.length * 1.5; // Higher weight for AI generation
        return Math.floor(inputScore + outputScore);
    }
};
