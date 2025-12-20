console.log("🔥 CONTENT SCRIPT INJECTED", location.href);

let lastText = "";

// Lắng nghe khi user quét chuột
document.addEventListener("selectionchange", () => {
  clearTimeout(window.__selTimer);

  window.__selTimer = setTimeout(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (!text || text === lastText) return;

    lastText = text;

    console.log("🖱️ Selected text:", text);

    chrome.runtime.sendMessage({
      type: "SCAN_RESULT",
      payload: text
    });
  }, 300);
});
