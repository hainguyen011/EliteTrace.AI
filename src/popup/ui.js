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
    siteStatusText: document.getElementById("siteStatusText"),
    tabIndicator: document.querySelector(".tab-indicator")
  },

  initTabs(callback) {
    this.elements.tabs.forEach(btn => {
      btn.addEventListener("click", (e) => {
        this.moveTabIndicator(e.target);
        callback(btn.dataset.tab);
      });
    });
    // Init indicator pos
    const activeToken = document.querySelector(".tab-btn.active");
    if (activeToken) this.moveTabIndicator(activeToken);
  },

  moveTabIndicator(element) {
    if (!this.elements.tabIndicator) return;
    this.elements.tabIndicator.style.width = `${element.offsetWidth}px`;
    this.elements.tabIndicator.style.left = `${element.offsetLeft}px`;
  },

  switchTab(tabId) {
    this.elements.tabs.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabId);
    });

    // Simple View Transition if supported
    if (document.startViewTransition) {
      document.startViewTransition(() => this._toggleViews(tabId));
    } else {
      this._toggleViews(tabId);
    }
  },

  _toggleViews(tabId) {
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
      this.elements.historyList.innerHTML = `
                <div class="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 4"><circle cx="12" cy="12" r="10"></circle><path d="M12 6v6l4 2"></path></svg>
                    <span>Chưa có lịch sử quét</span>
                </div>`;
      return;
    }

    this.elements.historyList.innerHTML = history.map((item, index) => `
        <div class="history-item" data-index="${index}" style="animation-delay: ${index * 0.05}s">
          <div class="history-status-line" style="background-color:${this.getStatusColor(item.score)}"></div>
          <div class="history-content">
              <div class="history-meta">
                <div class="history-title">${item.sourceTitle || "Quét văn bản"}</div>
                <div class="history-time">${new Date(item.timestamp).toLocaleString()}</div>
              </div>
              <div class="history-score-badge" style="background:${this.getStatusColor(item.score, 0.15)}; color:${this.getStatusColor(item.score)}">
                ${item.score}
              </div>
          </div>
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
            <span title="${metadata.url}">${metadata.title}</span>
          </div>
        `
      : "";

    const maxLength = 150;
    const isLongText = text.length > maxLength;
    const displayText = isLongText ? text.substring(0, maxLength) + "..." : text;

    const readMoreHtml = isLongText
      ? `<button class="read-more-btn">Xem thêm</button>`
      : "";

    this.elements.resultBox.innerHTML = `
        <div class="selection-card animate-in">
          <div class="selection-header">
          
            <span class="selection-label">Dữ liệu đầu vào</span>
          </div>
          <div class="selection-text">
            <span class="text-content">"${displayText}"</span>
            ${readMoreHtml}
          </div>
          ${sourceHtml}
        </div>
      `;
    this.elements.resultBox.classList.remove("empty");

    // Add click event for read more
    if (isLongText) {
      const btn = this.elements.resultBox.querySelector(".read-more-btn");
      const textSpan = this.elements.resultBox.querySelector(".text-content");
      if (btn && textSpan) {
        btn.onclick = () => {
          const isExpanded = btn.classList.contains("expanded");
          if (isExpanded) {
            textSpan.textContent = `"${displayText}"`;
            btn.textContent = "Xem thêm";
            btn.classList.remove("expanded");
          } else {
            textSpan.textContent = `"${text}"`;
            btn.textContent = "Thu gọn";
            btn.classList.add("expanded");
          }
        };
      }
    }
  },

  renderResult(payload, currentTab = "overview") {
    if (!payload || payload.error) return this.renderError(payload?.error);

    const score = payload.score ?? 0;
    this.updateGauge(score);
    this.elements.scoreDisplay.style.display = "flex";

    const label = payload.label ?? "Không xác định";
    const category = payload.category ?? "Chung";
    const explanation = window.marked ? window.marked.parse(payload.explanation ?? "") : payload.explanation;
    const confidence = payload.confidenceLevel ?? "N/A";
    const recommendation = payload.recommendation ?? "";
    const sources = payload.sources ?? [];

    const sourcesHtml = sources.length > 0
      ? `<div class="sources-grid">${sources.map(s => `
            <a href="${s.url}" target="_blank" class="source-chip">
              <img src="https://www.google.com/s2/favicons?domain=${new URL(s.url).hostname}&sz=32" onerror="this.style.display='none'" class="source-favicon"/>
              <span class="source-title">${s.title}</span>
            </a>`).join("")}</div>`
      : `<div class="empty-sources">Không tìm thấy nguồn đối chiếu trực tiếp</div>`;

    if (currentTab === "overview") {
      this.elements.resultBox.innerHTML = `
          <div class="result-grid animate-in">
              <div class="detail-card main-verdict" style="border-left-color: ${this.getStatusColor(score)}">
                <div class="card-label">Kết luận AI</div>
                <div class="verdict-value" style="color:${this.getStatusColor(score)}">${label}</div>
                <div class="verdict-category">${category}</div>
              </div>
              
              <div class="detail-card summary-card">
                 <div class="card-label">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                    Tóm tắt phân tích
                 </div>
                 <div class="summary-text">${explanation}</div>
              </div>
          </div>
        `;
    } else if (currentTab === "analysis") {
      this.elements.resultBox.innerHTML = `
          <div class="result-grid animate-in">
              <div class="detail-card">
                <div class="card-label">Nguồn tham chiếu LiveCite™</div>
                ${sourcesHtml}
              </div>
              
              <div class="detail-card">
                <div class="meta-row">
                    <div>
                        <div class="card-label">Độ tin cậy</div>
                        <div class="meta-value" style="color:${this.getStatusColor(score)}">${confidence}</div>
                    </div>
                </div>
              </div>

              <div class="detail-card">
                 <div class="card-label">Khuyến nghị hành động</div>
                 <div class="summary-text">${window.marked ? window.marked.parse(recommendation) : recommendation}</div>
              </div>
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
        <div class="loader-container">
          <div class="scanning-radar">
            <div class="radar-sweep"></div>
          </div>
          <span class="loader-text">${text}</span>
        </div>
      `;
  },

  renderError(error) {
    this.elements.scoreDisplay.style.display = "none";
    this.elements.resultBox.innerHTML = `
            <div class="error-state animate-in">
                <div class="error-icon">⚠️</div>
                <div class="error-text">${error}</div>
            </div>`;
  },

  updateGauge(score) {
    const circumference = 2 * Math.PI * 52; // r=52
    const offset = circumference - (score / 100) * circumference;

    // Reset for animation
    this.elements.gaugeFill.style.strokeDasharray = `${circumference} ${circumference}`;

    requestAnimationFrame(() => {
      this.elements.gaugeFill.style.strokeDashoffset = offset;
      this.elements.gaugeFill.style.stroke = this.getStatusColor(score);
      // Add glow 
      this.elements.gaugeFill.style.filter = `drop-shadow(0 0 8px ${this.getStatusColor(score)})`;
    });

    // Animated Counter
    this.animateValue(this.elements.scoreValue, 0, score, 1000);
    this.elements.scoreValue.style.color = this.getStatusColor(score);
  },

  animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const progress = Math.min((timestamp - startTimestamp) / duration, 1);
      obj.innerHTML = Math.floor(progress * (end - start) + start);
      if (progress < 1) {
        window.requestAnimationFrame(step);
      }
    };
    window.requestAnimationFrame(step);
  },

  getStatusColor(score, alpha = 1) {
    if (score >= 80) return `rgba(16, 185, 129, ${alpha})`; // Emerald
    if (score >= 50) return `rgba(245, 158, 11, ${alpha})`; // Amber
    return `rgba(244, 63, 94, ${alpha})`; // Rose
  },

  updateSiteBadge(reputation, reliabilityScore, reason) {
    this.elements.siteBadge.style.display = "flex";
    this.elements.siteStatusText.textContent = `${reputation} (${reliabilityScore}%)`;

    const color = this.getStatusColor(reliabilityScore);
    this.elements.siteBadge.style.borderColor = color;
    this.elements.siteBadge.style.boxShadow = `0 0 10px ${this.getStatusColor(reliabilityScore, 0.2)}`;

    const indicator = this.elements.siteBadge.querySelector(".pulse-indicator");
    if (indicator) indicator.style.background = color;

    this.elements.siteStatusText.title = reason;
  },

  reset() {
    this.elements.resultBox.innerHTML = `
            <div class="empty-placeholder">
                <div class="placeholder-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                </div>
                <span>Chọn văn bản trên trang web để bắt đầu phân tích</span>
            </div>
        `;
    this.elements.resultBox.className = "result empty";
    this.elements.scoreDisplay.style.display = "none";
  },

  updateThemeIcon(theme) {
    const btn = document.getElementById("themeToggle");
    if (!btn) return;
    const moon = btn.querySelector(".moon-icon");
    const sun = btn.querySelector(".sun-icon");
    if (theme === 'dark') {
      moon.style.display = 'none';
      sun.style.display = 'block';
      btn.style.color = '#fbbf24'; // Warning color (Amber) for Sun
    } else {
      moon.style.display = 'block';
      sun.style.display = 'none';
      btn.style.color = 'var(--text-secondary)';
    }
  }
};
