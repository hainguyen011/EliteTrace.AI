export const UI = {
    elements: {
        resultBox: document.getElementById("result"),
        scanBtn: document.getElementById("scan"),
        visionScanBtn: document.getElementById("visionScan"),
        apiInput: document.getElementById("apikey"),
        saveBtn: document.getElementById("saveKey"),
        resetBtn: document.getElementById("reset"),
        tabs: document.querySelectorAll(".tab-btn"),
        scoreDisplay: document.getElementById("scoreDisplay"),
        gaugeFill: document.getElementById("gaugeFill"),
        scoreValue: document.getElementById("scoreValue"),
        historyView: document.getElementById("historyView"),
        historyList: document.getElementById("historyList"),
        clearHistoryBtn: document.getElementById("clearHistory"),
        siteBadge: document.getElementById("siteBadge"),
        siteStatusText: document.getElementById("siteStatusText")
    },

    initTabs(callback) {
        this.elements.tabs.forEach(btn => {
            btn.addEventListener("click", () => callback(btn.dataset.tab));
        });
    },

    switchTab(tabId) {
        this.elements.tabs.forEach(btn => {
            btn.classList.toggle("active", btn.dataset.tab === tabId);
        });

        if (tabId === "history") {
            this.elements.resultBox.style.display = "none";
            this.elements.scoreDisplay.style.display = "none";
            this.elements.historyView.style.display = "flex";
        } else {
            this.elements.historyView.style.display = "none";
            this.elements.resultBox.style.display = "flex";
        }
    },

    renderHistory(history, onClick) {
        if (!history || history.length === 0) {
            this.elements.historyList.innerHTML = `<div class="opacity-text" style="text-align:center; padding:2rem; font-size:0.8rem;">No history yet.</div>`;
            return;
        }

        this.elements.historyList.innerHTML = history.map((item, index) => `
        <div class="history-item" data-index="${index}">
          <div class="history-meta">
            <div class="history-title">${item.sourceTitle || "Text Scan"}</div>
            <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
          </div>
          <div class="history-score" style="color:${this.getStatusColor(item.score)}">${item.score}</div>
        </div>
      `).join("");

        this.elements.historyList.querySelectorAll(".history-item").forEach(item => {
            item.onclick = () => onClick(history[item.dataset.index]);
        });
    },

    renderSelection(text, metadata) {
        const sourceHtml = metadata
            ? `
          <div class="selection-source">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            <span title="${metadata.url}">${metadata.title}</span>
          </div>
        `
            : "";

        this.elements.resultBox.innerHTML = `
        <div class="selection-card">
          <div class="selection-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Captured Text
          </div>
          ${sourceHtml}
          <div class="selection-text">${text}</div>
        </div>
      `;
        this.elements.resultBox.classList.remove("empty");
    },

    renderResult(payload, currentTab = "overview") {
        if (!payload || payload.error) return this.renderError(payload?.error);

        const score = payload.score ?? 0;
        this.updateGauge(score);
        this.elements.scoreDisplay.style.display = "flex";

        const label = payload.label ?? "Unknown";
        const category = payload.category ?? "General";
        // Simple marked replacement since we don't have the library imported yet in this module context, 
        // but assuming marked is globally available or we handle it simply.
        // ideally we should inject marked or use a simple formatter.
        // For now, let's assume global 'marked' is available in the window context or handle simple text.
        const explanation = window.marked ? window.marked.parse(payload.explanation ?? "") : payload.explanation;
        const confidence = payload.confidenceLevel ?? "N/A";
        const recommendation = payload.recommendation ?? "";
        const sources = payload.sources ?? [];

        const sourcesHtml = sources.length > 0
            ? `<div class="sources-list">${sources.map(s => `
            <a href="${s.url}" target="_blank" class="source-link">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 22 3 22 10"></polyline><line x1="14" y1="10" x2="22" y2="2"></line></svg>
              <span class="source-title">${s.title}</span>
            </a>`).join("")}</div>`
            : `<div class="detail-value" style="font-style:italic; opacity:0.6; font-size:0.8rem;">No direct citations found</div>`;

        if (currentTab === "overview") {
            this.elements.resultBox.innerHTML = `
          <div class="detail-item">
            <div class="detail-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
              Status
            </div>
            <div class="detail-value" style="color:${this.getStatusColor(score)}; font-weight:700; font-size:1.1rem;">${label}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
              Classification
            </div>
            <div class="detail-value">${category}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
              Verdict Summary
            </div>
            <div class="detail-value opacity-text" style="font-size:0.95rem;">${explanation}</div>
          </div>
        `;
        } else if (currentTab === "analysis") {
            this.elements.resultBox.innerHTML = `
          <div class="detail-item">
            <div class="detail-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              LiveCite Sources
            </div>
            ${sourcesHtml}
          </div>
          <div class="detail-item">
            <div class="detail-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
              Confidence Level
            </div>
            <div class="detail-value" style="font-weight:600; color:${this.getStatusColor(score)};">${confidence}</div>
          </div>
          <div class="detail-item">
            <div class="detail-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Recommendation
            </div>
            <div class="detail-value opacity-text" style="font-size:0.95rem;">${window.marked ? window.marked.parse(recommendation) : recommendation}</div>
          </div>
        `;
        }
    },

    renderLoading(text) {
        this.elements.scoreDisplay.style.display = "none";
        this.elements.historyView.style.display = "none";
        this.elements.resultBox.style.display = "flex";
        this.elements.resultBox.classList.remove("empty");
        this.elements.resultBox.innerHTML = `
        <div style="display:flex; flex-direction:column; align-items:center; gap:1.25rem; padding: 2.5rem 0;">
          <div class="loading-dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
          <span style="font-size:0.85rem; color:var(--text-muted); font-weight:500;">${text}</span>
        </div>
      `;
    },

    renderError(error) {
        this.elements.scoreDisplay.style.display = "none";
        this.elements.resultBox.innerHTML = `<div style="color:var(--color-unreliable); text-align:center; padding: 1rem;">❌ ${error}</div>`;
    },

    updateGauge(score) {
        const circumference = 2 * Math.PI * 40;
        const offset = circumference - (score / 100) * circumference;
        this.elements.gaugeFill.style.strokeDasharray = circumference;
        setTimeout(() => {
            this.elements.gaugeFill.style.strokeDashoffset = offset;
            this.elements.gaugeFill.style.stroke = this.getStatusColor(score);
        }, 100);
        this.elements.scoreValue.textContent = score;
        this.elements.scoreValue.style.color = this.getStatusColor(score);
    },

    getStatusColor(score) {
        if (score >= 80) return "var(--color-reliable)";
        if (score >= 50) return "var(--color-uncertain)";
        return "var(--color-unreliable)";
    },

    updateSiteBadge(reputation, reliabilityScore, reason) {
        this.elements.siteBadge.style.display = "flex";
        this.elements.siteStatusText.textContent = `${reputation} Trust (${reliabilityScore}%)`;
        this.elements.siteBadge.style.color = this.getStatusColor(reliabilityScore);
        this.elements.siteBadge.style.borderColor = this.getStatusColor(reliabilityScore);
        this.elements.siteStatusText.title = reason;
    },

    reset() {
        this.elements.resultBox.textContent = "Select text on the page to analyze";
        this.elements.resultBox.className = "result empty";
        this.elements.scoreDisplay.style.display = "none";
    }
};
