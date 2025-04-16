// background.js - New background service worker for enhanced detection
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'saveApplication') {
        chrome.storage.local.get('applications', function (data) {
            const applications = data.applications || [];
            applications.push(message.data);

            chrome.storage.local.set({ 'applications': applications }, function () {
                console.log('Application saved from background:', message.data);
                sendResponse({ success: true });
            });
        });
        return true; // Required for async sendResponse
    }
});