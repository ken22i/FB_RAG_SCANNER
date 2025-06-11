document.addEventListener('DOMContentLoaded', () => {
    const extractButton = document.getElementById('extract');
    if (extractButton) {
        extractButton.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'extract' }, (response) => {
                    console.log('擷取完成:', response);
                });
            });
        });
    } else {
        console.error('找不到按鈕 #extract');
    }
});
