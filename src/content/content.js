document.addEventListener("mouseup", () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length > 5) {
        chrome.runtime.sendMessage({
            type: "SCAN_RESULT",
            payload: text,
            metadata: {
                url: window.location.href,
                title: document.title
            }
        });
    }
});
