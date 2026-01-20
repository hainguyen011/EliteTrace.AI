import { CONFIG } from '../utils/config.js';

export const SearchService = {
    async searchInternet(query) {
        try {
            const res = await fetch(
                `https://www.googleapis.com/customsearch/v1?key=${CONFIG.GOOGLE_SEARCH_API_KEY}&cx=${CONFIG.GOOGLE_SEARCH_ENGINE}&q=${encodeURIComponent(query)}`
            );
            const data = await res.json();
            if (!data.items || data.items.length === 0) return [];

            return data.items.map(item => ({
                title: item.title,
                snippet: item.snippet,
                link: item.link
            }));
        } catch (err) {
            console.error("❌ SEARCH ERROR:", err);
            return [];
        }
    }
};
