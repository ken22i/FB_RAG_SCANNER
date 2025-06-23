/*
===============================================================================
    Module Name: content.js
    Description: 負責彈出視窗的按鈕邏輯
    Author: Jerry, Ken, SJ
    Last Updated: 2025-06-23
    Version: 1.0.0
    Notes: 無
===============================================================================
*/
document.addEventListener('DOMContentLoaded', () => {
    const analyzeButton = document.getElementById('analyze');
    const viewResultsButton = document.getElementById('viewResults');
    const status = document.getElementById('status');

    // 顯示狀態信息
    function showStatus(message, type) {
        status.textContent = message;
        status.className = 'status ' + type;
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }

    // 關閉 popup 視窗
    function closePopup() {
        window.close();
    }

    // 分析貼文按鈕點擊事件
    if (analyzeButton) {
        analyzeButton.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'extract' }, (response) => {
                    if (response && response.status === 'success') {
                        showStatus('開始分析貼文...', 'success');
                        setTimeout(closePopup, 500); // 延遲 500ms 後關閉，讓用戶看到成功訊息
                    } else {
                        showStatus('分析失敗，請確保您在 Facebook 頁面上', 'error');
                    }
                });
            });
        });
    } else {
        console.error('找不到按鈕 #analyze');
    }

    // 檢視結果按鈕點擊事件
    if (viewResultsButton) {
        viewResultsButton.addEventListener('click', () => {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'view_results' }, (response) => {
                    if (response && response.status === 'success') {
                        showStatus('顯示分析結果', 'success');
                        setTimeout(closePopup, 500); // 延遲 500ms 後關閉，讓用戶看到成功訊息
                    } else {
                        showStatus('無法顯示結果，請先進行分析', 'error');
                    }
                });
            });
        });
    } else {
        console.error('找不到按鈕 #viewResults');
    }
});
