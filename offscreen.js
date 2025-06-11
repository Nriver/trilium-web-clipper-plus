// Offscreen document for DOM operations in Manifest V3 service worker

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'CROP_IMAGE') {
        cropImage(message.newArea, message.dataUrl)
            .then(result => {
                chrome.runtime.sendMessage({
                    id: message.id,
                    result: result
                });
            })
            .catch(error => {
                chrome.runtime.sendMessage({
                    id: message.id,
                    error: error.message
                });
            });
        return true; // Keep message channel open for async response
    }
});

function cropImage(newArea, dataUrl) {
    return new Promise((resolve, reject) => {
        const img = new Image();

        img.onload = function () {
            const canvas = document.createElement('canvas');
            canvas.width = newArea.width;
            canvas.height = newArea.height;

            const ctx = canvas.getContext('2d');

            ctx.drawImage(img, newArea.x, newArea.y, newArea.width, newArea.height, 0, 0, newArea.width, newArea.height);

            resolve(canvas.toDataURL());
        };

        img.onerror = function () {
            reject(new Error('Failed to load image'));
        };

        img.src = dataUrl;
    });
}
