export const StorageService = {
    get(keys) {
        return new Promise((resolve) => {
            chrome.storage.local.get(keys, (data) => resolve(data));
        });
    },

    set(data) {
        return new Promise((resolve) => {
            chrome.storage.local.set(data, () => resolve());
        });
    },

    async getApiKey() {
        const { apikey } = await this.get('apikey');
        return apikey;
    },

    async getHistory() {
        const { history = [] } = await this.get('history');
        return history;
    },

    async addToHistory(item, metadata) {
        const history = await this.getHistory();
        const newItem = {
            ...item,
            timestamp: Date.now(),
            sourceTitle: metadata?.title || "Vision Analysis",
            sourceUrl: metadata?.url || ""
        };
        const updatedHistory = [newItem, ...history].slice(0, 20);
        await this.set({ history: updatedHistory });
        return updatedHistory;
    },

    async clearHistory() {
        await this.set({ history: [] });
        return [];
    }
};
