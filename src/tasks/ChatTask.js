export const ChatTask = {
    type: 'CHAT',
    buildPrompt: (input) => input,
    calculateScore: (response, input) => {
        // Pure Token-based economy.
        // Input: 0.5 pts per char
        // Output: 1 pts per char
        return Math.floor((response.length * 1) + (input.length * 0.5));
    }
};
