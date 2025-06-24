/*
===============================================================================
    Module Name: content.js
    Description: 負責分析貼文的主要邏輯
    Author: Jerry, Ken, SJ
    Last Updated: 2025-06-23
    Version: 1.0.0
    Notes: 無
===============================================================================
*/
// 添加全局變量來存儲分析結果和原始貼文內容
let lastAnalysisResult = null;
let lastPostContent = null;
// 添加全局變量來存儲可疑資料
let lastSuspiciousData = null;

// 從 storage 中載入保存的數據
async function loadSavedData() {
    try {
        const result = await chrome.storage.local.get(['lastAnalysisResult', 'lastPostContent', 'lastSuspiciousData']);
        if (result.lastAnalysisResult) {
            lastAnalysisResult = result.lastAnalysisResult;
            console.log('已從 storage 載入分析結果');
        }
        if (result.lastPostContent) {
            lastPostContent = result.lastPostContent;
            console.log('已從 storage 載入貼文內容');
        }
        if (result.lastSuspiciousData) {
            lastSuspiciousData = result.lastSuspiciousData;
            console.log('已從 storage 載入可疑資料');
        }
    } catch (error) {
        console.error('載入保存的數據失敗:', error);
    }
}

// 保存數據到 storage
async function saveData() {
    try {
        console.log('開始保存數據到 storage');
        console.log('lastAnalysisResult:', lastAnalysisResult);
        console.log('lastPostContent:', lastPostContent);
        console.log('lastSuspiciousData:', lastSuspiciousData);
        await chrome.storage.local.set({
            lastAnalysisResult: lastAnalysisResult,
            lastPostContent: lastPostContent,
            lastSuspiciousData: lastSuspiciousData
        });
        console.log('已保存數據到 storage');
    } catch (error) {
        console.error('保存數據失敗:', error);
    }
}

// 頁面載入時載入保存的數據
loadSavedData();

// 頁面載入時清理舊的高亮效果
function cleanupOldHighlights() {
    // 清理舊的高亮效果
    const oldHighlights = document.querySelectorAll('.fb-highlight-text');
    oldHighlights.forEach(highlight => {
        const container = highlight.parentElement;
        if (container && container.classList.contains('fb-highlight-container')) {
            // 恢復原始文本
            const originalText = highlight.textContent;
            container.replaceWith(originalText);
        }
    });

    // 清理舊的提示框
    const oldTooltips = document.querySelectorAll('.fb-analyzer-tooltip');
    oldTooltips.forEach(tooltip => {
        tooltip.remove();
    });

    // 移除舊的事件監聽器
    const oldListener = document._fbAnalyzerClickListener;
    if (oldListener) {
        document.removeEventListener('click', oldListener, true);
        document._fbAnalyzerClickListener = null;
    }
}

// 頁面載入時執行清理
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', cleanupOldHighlights);
} else {
    cleanupOldHighlights();
}

function isStillInSamePost() {
    // 檢核相片是否為同一篇貼文
    const keyword = '這張相片來自一則貼文';
    const indicator = Array.from(document.querySelectorAll('span[dir="auto"]'))
        .find(el => el.textContent.includes(keyword));

    return Boolean(indicator);
}

async function goBackMultipleTimes(count, delay = 300) {
    // 回到前一頁 count 次
    for (let i = 0; i < count; i++) {
        console.log(`🔙 返回第 ${i + 1} 次`);
        window.history.back();
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

async function autoDownloadFacebookImages(downloadPath) {
    // 點擊下一張圖片並下載
    const downloadImgList = [];
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

    let nextButtonClickCount = 1;
    let index = 0;
    while (true) {
        const url = window.location.href;
        const img = document.querySelector('img[data-visualcompletion="media-vc-image"]');
        if (!isStillInSamePost()) {
            console.log('⛔️ 已離開原始貼文圖片組，終止下載');
            break;
        }

        if (img && img.src) {
            const imageUrl = img.src;

            if (downloadImgList.includes(imageUrl)) {
                // 已下載過
                console.log("⚠️ 已下載過，終止迴圈：", imageUrl);
                break;
            }

            console.log("⬇️ 準備下載圖片：", imageUrl);
            index = index + 1
            const index_str = String(index).padStart(3, '0');
            const filename = downloadPath + '/' + index_str + '.jpg';

            chrome.runtime.sendMessage({
                action: "download_image",
                url: imageUrl,
                filename: filename
            });

            downloadImgList.push(imageUrl);
        } else {
            console.log("❌ 找不到圖片元素，跳過");
        }

        // 下一張
        const expectedPositions = ['0px -25px', '0px -50px', '0px -75px', '0px -133px'];
        const buttons = Array.from(document.querySelectorAll('[role="button"]'));
        const targetButton = buttons.find(btn => {
            const icon = btn.querySelector('i.x1b0d499.x1d69dk1');
            if (!icon) return false;
            const pos = window.getComputedStyle(icon).backgroundPosition;
            return expectedPositions.includes(pos);
        });

        if (targetButton) {
            targetButton.click();
            nextButtonClickCount++;
            console.log("➡️ 點擊下一張圖片按鈕");
        } else {
            console.log("❌ 找不到下一張圖片按鈕，終止");
            break;
        }

        await sleep(1500);
    }
    // 使用nextButtonClickCount次數來回到最初的頁面
    await goBackMultipleTimes(nextButtonClickCount);
}

function fixMissingPost(postTag, commentSet) {
    // 例外處理： 因特殊原因導致沒有擷取到貼文
    var post = '';
    var postSet = new Set();  // 用來記錄已經出現過的內容
    [].forEach.call(document.querySelectorAll(postTag), function (postEl) {
        var postLine = postEl.innerHTML;
        postLine = postLine.replace(/(<a([^>]+)?>)/ig, '');
        postLine = postLine.replace(/(<([^>]+)>)/ig, '{}');
        while (postLine.indexOf('{}{}') > -1) {
            postLine = postLine.replace(/\{\}\{\}/ig, '{}');
        }
        postLine = postLine.replace(/^\{\}/ig, '');
        postLine = postLine.replace(/\{\}$/ig, '');
        postLine = postLine.replace(/\{\}/i, ' ');
        postLine = postLine.replace(/\{\}/ig, ' '); // 其餘 {} 移除
        postLine = postLine.replace('管理員: ', '');
        postLine = postLine.replace('頭號粉絲: ', '');
        postLine = postLine.replace('作者: ', '');
        postLine = postLine.replace('最常發言的成員: ', '');
        postLine = postLine.replace('版主: ', '');
        postLine = postLine.replace('追蹤: ', '');
        postLine = postLine.replace(': &nbsp;:  · :', ':');
        postLine = postLine.replace('已驗證帳號:  : ', '');
        if (postLine.length == 0 || postLine == '{}') return;

        // 過濾貼文中重複
        if (!postSet.has(postLine)) {
            // 過濾留言
            if (!commentSet.has(postLine)) {
                // console.log(postLine);
                postSet.add(postLine);
            }
        }
    });
    // 將 Set 轉為陣列以進行比較與合併
    let postArray = Array.from(postSet);

    // ✅ 如果有兩筆以上，並且第二筆是第一筆的子字串，就移除第一筆
    if (postArray.length >= 2 && postArray[0].includes(postArray[1])) {
        postArray.shift();  // 移除第一個元素
    }

    // 將結果組合成純文字
    var post = postArray.join('\r\n');
    return post;
}

async function createRAGTask(postText) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'createRAGTask',
            postText: postText
        });
        return response.job_id;
    } catch (error) {
        console.error('Error creating RAG task:', error);
        throw error;
    }
}

async function getRAGResult(jobId) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'getRAGResult',
            jobId: jobId
        });
        return response;
    } catch (error) {
        console.error('Error getting RAG result:', error);
        throw error;
    }
}

async function checkRAGStatus(jobId) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'checkRAGStatus',
            jobId: jobId
        });
        return response;
    } catch (error) {
        console.error('Error checking RAG status:', error);
        throw error;
    }
}

// 調用URL分析API進行分析
async function analyzeWithSecondAPI(description) {
    try {
        const response = await chrome.runtime.sendMessage({
            action: 'analyzeWithSecondAPI',
            description: description
        });
        return response;
    } catch (error) {
        console.error('Error calling second API:', error);
        throw error;
    }
}

// 使用URL分析API分析文本
async function analyzeTextWithSecondAPI(text) {
    try {
        console.log('🚀 開始使用URL分析API分析文本');
        
        // 調用第二個API
        const result = await analyzeWithSecondAPI(text);
        console.log('📊 URL分析API分析結果:', result);
        
        // 這裡可以處理返回的數據，格式應該與mockdata.json相同
        // result 應該包含 line_id_details, url_details 等字段
        
        return result;
    } catch (error) {
        console.error('❌ URL分析API分析失敗:', error);
        throw error;
    }
}

async function waitForRAGCompletion(jobId, maxAttempts = 30, interval = 2000) {
    console.log(`🔄 開始等待 RAG 任務完成 (job_id: ${jobId})`);
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        console.log(`⏳ 第 ${attempt + 1}/${maxAttempts} 次檢查任務狀態`);
        const response = await checkRAGStatus(jobId);
        console.log(`📊 任務狀態:`, response);
        
        if (!response.success) {
            console.error('❌ RAG 任務檢查失敗:', response);
            throw new Error('Failed to check RAG status');
        }

        const status = response.data.status;
        if (status === 'completed') {
            console.log('✅ RAG 任務已完成');
            // 獲取結果
            console.log('📥 開始獲取 RAG 分析結果');
            const result = await getRAGResult(jobId);
            console.log('📊 RAG 分析結果:', result);
            return result;
        } else if (status === 'failed') {
            console.error('❌ RAG 任務失敗:', response.data.error);
            throw new Error('RAG task failed: ' + (response.data.error || 'Unknown error'));
        }
        
        console.log(`⏰ 等待 ${interval/1000} 秒後再次檢查...`);
        await new Promise(resolve => setTimeout(resolve, interval));
    }
    console.error('⏰ RAG 任務超時');
    throw new Error('RAG task timeout');
}

function createDisplayArea() {
    // 檢查是否已存在顯示區域
    let displayArea = document.getElementById('fb-analyzer-display');
    if (displayArea) {
        // 如果存在，先清空內容
        const contentArea = document.getElementById('fb-analyzer-content');
        if (contentArea) {
            contentArea.innerHTML = '';
        }
    } else {
        // 創建新的顯示區域
        displayArea = document.createElement('div');
        displayArea.id = 'fb-analyzer-display';
        displayArea.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            width: 400px;
            max-height: 80vh;
            background: white;
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 15px;
            z-index: 9999;
            overflow-y: auto;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;

        // 添加標題
        const title = document.createElement('h3');
        title.textContent = 'Facebook 貼文分析結果';
        title.style.cssText = `
            margin: 0 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
            color: #1877f2;
        `;
        displayArea.appendChild(title);

        // 添加關閉按鈕
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            border: none;
            background: none;
            font-size: 20px;
            cursor: pointer;
            color: #666;
        `;
        closeButton.onclick = () => displayArea.remove();
        displayArea.appendChild(closeButton);

        // 添加內容區域
        const contentArea = document.createElement('div');
        contentArea.id = 'fb-analyzer-content';
        displayArea.appendChild(contentArea);

        document.body.appendChild(displayArea);
    }
    return document.getElementById('fb-analyzer-content'); // 確保返回的是內容區域
}

function highlightEvidenceInOriginalPost(predictions) {
    // 清理舊的高亮效果
    const oldHighlights = document.querySelectorAll('.fb-highlight-text');
    oldHighlights.forEach(highlight => {
        const container = highlight.parentElement;
        if (container && container.classList.contains('fb-highlight-container')) {
            // 恢復原始文本
            const originalText = highlight.textContent;
            container.replaceWith(originalText);
        }
    });

    // 清理舊的提示框
    const oldTooltips = document.querySelectorAll('.fb-analyzer-tooltip');
    oldTooltips.forEach(tooltip => {
        tooltip.remove();
    });

    // 使用與 extractPostAndComments 相同的貼文選擇器
    const postElements = document.querySelectorAll('.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x78zum5.xdt5ytf.x1iyjqo2.x1n2onr6.xqbnct6.xga75y6 .html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl .x78zum5.xdt5ytf.xz62fqu.x16ldp7u .xu06os2.x1ok221b span div[dir=auto]');
    
    if (!postElements.length) {
        console.log('找不到原始貼文元素');
        return;
    }

    // === 新增：高亮前 snapshot 原始內容 ===
    const originalTexts = [];
    postElements.forEach(element => {
        originalTexts.push(element.textContent);
    });
    // ==============================

    // 移除舊的事件監聽器
    const oldListener = document._fbAnalyzerClickListener;
    if (oldListener) {
        document.removeEventListener('click', oldListener, true);
    }

    // 創建新的事件監聽器
    const clickListener = function(e) {
        // 如果點擊的是提示框本身，不做任何處理
        if (e.target.closest('.fb-analyzer-tooltip')) {
            return;
        }

        const highlightText = e.target.closest('.fb-highlight-text');
        if (highlightText) {
            console.log('高亮文本被點擊');
            e.preventDefault();
            e.stopPropagation();
            
            const tooltip = highlightText.parentElement.querySelector('.fb-analyzer-tooltip');
            if (tooltip) {
                // 檢查是否已經顯示
                const isVisible = tooltip.style.display === 'block';
                
                // 先隱藏所有提示框
                document.querySelectorAll('.fb-analyzer-tooltip').forEach(t => {
                    t.style.display = 'none';
                });

                // 如果之前是隱藏的，則顯示
                if (!isVisible) {
                    console.log('顯示提示框');
                    tooltip.style.display = 'block';
                    
                    // 確保提示框在視窗內
                    const rect = tooltip.getBoundingClientRect();
                    const viewportWidth = window.innerWidth;
                    const viewportHeight = window.innerHeight;
                    
                    if (rect.left < 0) {
                        tooltip.style.left = '0';
                    }
                    if (rect.top < 0) {
                        tooltip.style.top = '100%';
                        tooltip.style.marginTop = '10px';
                    }
                } else {
                    console.log('隱藏提示框');
                }
            }
        } else {
            // 點擊其他地方時隱藏所有提示框
            console.log('點擊其他地方，隱藏所有提示框');
            document.querySelectorAll('.fb-analyzer-tooltip').forEach(t => {
                t.style.display = 'none';
            });
        }
    };

    // 保存新的事件監聽器引用
    document._fbAnalyzerClickListener = clickListener;
    // 添加新的事件監聽器
    document.addEventListener('click', clickListener, true);

    // 遍歷所有預測結果
    predictions.forEach(prediction => {
        const evidences = prediction.evidences; // 獲取所有證據
        const refText = prediction.ref_text; // 獲取參考文本
        console.log('要高亮的證據:', evidences);
        
        // 將所有postElements的文本合併，保留換行符
        let combinedText = '';
        const elementTexts = [];
        originalTexts.forEach((text, idx) => {
            elementTexts.push({
                element: postElements[idx],
                text: text,
                startIndex: combinedText.length,
                endIndex: combinedText.length + text.length,
                originalHTML: postElements[idx].innerHTML
            });
            combinedText += text + '\n'; // 添加換行符
        });

        // 遍歷所有證據
        evidences.forEach(evidence => {
            // 標準化證據文本：將換行符和空格統一處理
            const normalizedEvidence = evidence
                .replace(/\r\n/g, '\n')  // 統一換行符
                .replace(/\n\s*/g, '\n') // 移除換行符後的空格
                .replace(/\s*\n/g, '\n') // 移除換行符前的空格
                .replace(/\s+/g, ' ')    // 將多個空格替換為單個空格
                .trim();                 // 移除首尾空格

            // 標準化合併文本：保持相同的處理方式
            const normalizedCombinedText = combinedText
                .replace(/\r\n/g, '\n')  // 統一換行符
                .replace(/\n\s*/g, '\n') // 移除換行符後的空格
                .replace(/\s*\n/g, '\n') // 移除換行符前的空格
                .replace(/\s+/g, ' ')    // 將多個空格替換為單個空格
                .trim();                 // 移除首尾空格

            console.log('標準化後的證據:', normalizedEvidence);
            console.log('標準化後的合併文本:', normalizedCombinedText);

            // 嘗試不同的匹配方式
            let evidenceStart = normalizedCombinedText.indexOf(normalizedEvidence);
            if (evidenceStart === -1) {
                // 如果直接匹配失敗，嘗試將證據中的換行符替換為空格
                const alternativeEvidence = normalizedEvidence.replace(/\n/g, ' ');
                evidenceStart = normalizedCombinedText.indexOf(alternativeEvidence);
                if (evidenceStart !== -1) {
                    console.log('使用替代匹配方式找到文本');
                }
            }

            if (evidenceStart !== -1) {
                console.log('找到匹配的文本:', normalizedEvidence);
                const evidenceEnd = evidenceStart + normalizedEvidence.length;

                // 找出證據跨越的元素
                const affectedElements = elementTexts.filter(item => 
                    (evidenceStart >= item.startIndex && evidenceStart < item.endIndex) || // 證據開始於此元素
                    (evidenceEnd > item.startIndex && evidenceEnd <= item.endIndex) || // 證據結束於此元素
                    (evidenceStart <= item.startIndex && evidenceEnd >= item.endIndex) // 證據完全覆蓋此元素
                );

                console.log('受影響的元素數量:', affectedElements.length);

                // === PATCH: 跨多 element 分段高亮 ===
                if (affectedElements.length === 1) {
                    // 單一 element，原本邏輯
                    const item = affectedElements[0];
                    const element = item.element;
                    const elementStart = item.startIndex;
                    const localStart = Math.max(0, evidenceStart - elementStart);
                    const localEnd = Math.min(element.textContent.length, evidenceEnd - elementStart);
                    const textToHighlight = element.textContent.substring(localStart, localEnd);
                    // 加強 log
                    console.log('--- 單一 element 高亮 debug ---');
                    console.log('element.textContent:', element.textContent);
                    console.log('localStart:', localStart, 'localEnd:', localEnd);
                    console.log('substring 取到的文本:', textToHighlight);
                    console.log('要高亮的文本:', normalizedEvidence);
                    const normalize = str => str.replace(/\s+/g, '').trim();
                    console.log('normalize(substring):', normalize(textToHighlight));
                    console.log('normalize(evidence):', normalize(normalizedEvidence));
                    // 比較 substring 算出來的內容和 normalizedEvidence
                    if (normalize(textToHighlight) === normalize(normalizedEvidence)) {
                        // 只有一致時才進行 substring 高亮
                        // 建立高亮 span
                        const container = document.createElement('span');
                        container.className = 'fb-highlight-container';
                        container.style.cssText = `
                            position: relative;
                            display: inline-block;
                        `;
                        const highlightSpan = document.createElement('span');
                        highlightSpan.textContent = textToHighlight;
                        highlightSpan.className = 'fb-highlight-text';
                        highlightSpan.style.cssText = `
                            background-color: rgba(255, 255, 0, 0.3);
                            border-bottom: 2px solid #ffd700;
                            display: inline;
                            cursor: pointer;
                            user-select: none;
                        `;
                        const tooltip = document.createElement('div');
                        tooltip.className = 'fb-analyzer-tooltip';
                        tooltip.style.cssText = `
                            position: absolute;
                            background: #333;
                            color: white;
                            padding: 8px 12px;
                            border-radius: 4px;
                            font-size: 12px;
                            z-index: 10000;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                            width: max-content;
                            max-width: 300px;
                            left: 0;
                            top: -40px;
                            display: none;
                            white-space: normal;
                            word-wrap: break-word;
                        `;
                        tooltip.textContent = `詐騙類型: ${refText}`;
                        container.appendChild(highlightSpan);
                        container.appendChild(tooltip);
                        // 替換 element 內容
                        const before = element.textContent.slice(0, localStart);
                        const after = element.textContent.slice(localEnd);
                        element.innerHTML = '';
                        element.appendChild(document.createTextNode(before));
                        element.appendChild(container);
                        element.appendChild(document.createTextNode(after));
                    } else {
                        // 不一致，直接用 normalizedEvidence 高亮（正則替換）
                        console.log('substring 取到的文本與匹配到的文本不一致，直接用 normalizedEvidence 高亮');
                        console.log('substring 取到的文本:', textToHighlight);
                        console.log('要高亮的文本:', normalizedEvidence);
                        const evidenceContainer = document.createElement('span');
                        evidenceContainer.className = 'fb-highlight-container';
                        evidenceContainer.style.cssText = `
                            position: relative;
                            display: inline-block;
                        `;
                        const evidenceHighlight = document.createElement('span');
                        evidenceHighlight.textContent = normalizedEvidence;
                        evidenceHighlight.className = 'fb-highlight-text';
                        evidenceHighlight.style.cssText = `
                            background-color: rgba(255, 255, 0, 0.3);
                            border-bottom: 2px solid #ffd700;
                            display: inline;
                            cursor: pointer;
                            user-select: none;
                        `;
                        const evidenceTooltip = document.createElement('div');
                        evidenceTooltip.className = 'fb-analyzer-tooltip';
                        evidenceTooltip.style.cssText = `
                            position: absolute;
                            background: #333;
                            color: white;
                            padding: 8px 12px;
                            border-radius: 4px;
                            font-size: 12px;
                            z-index: 10000;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                            width: max-content;
                            max-width: 300px;
                            left: 0;
                            top: -40px;
                            display: none;
                            white-space: normal;
                            word-wrap: break-word;
                        `;
                        evidenceTooltip.textContent = `詐騙類型: ${refText}`;
                        evidenceContainer.appendChild(evidenceHighlight);
                        evidenceContainer.appendChild(evidenceTooltip);
                        const evidenceEscaped = normalizedEvidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const evidenceRegex = new RegExp(evidenceEscaped, 'g');
                        // 修正：每次 fallback 都用 textContent 做正則替換
                        const replacedText = element.textContent.replace(evidenceRegex, evidenceContainer.outerHTML);
                        if (replacedText !== element.textContent) {
                            element.innerHTML = replacedText;
                            console.log('用 normalizedEvidence 成功高亮');
                        } else {
                            console.log('用 normalizedEvidence 也無法高亮');
                        }

                    }
                } else if (affectedElements.length > 1) {
                    // 跨多個 element 分段高亮
                    let allHighlight = '';
                    affectedElements.forEach((item, idx) => {
                        const element = item.element;
                        const elementStart = item.startIndex;
                        let localStart, localEnd;
                        if (idx === 0) {
                            localStart = evidenceStart - elementStart;
                            localEnd = element.textContent.length;
                        } else if (idx === affectedElements.length - 1) {
                            localStart = 0;
                            localEnd = evidenceEnd - elementStart;
                        } else {
                            localStart = 0;
                            localEnd = element.textContent.length;
                        }
                        if (localStart < 0) localStart = 0;
                        if (localEnd > element.textContent.length) localEnd = element.textContent.length;
                        const highlight = element.textContent.slice(localStart, localEnd);
                        allHighlight += highlight;
                    });
                    const normalize = str => str.replace(/\s+/g, '').trim();
                    if (normalize(allHighlight) === normalize(normalizedEvidence)) {
                        // 分段高亮
                        affectedElements.forEach((item, idx) => {
                            const element = item.element;
                            const elementStart = item.startIndex;
                            let localStart, localEnd;
                            if (idx === 0) {
                                localStart = evidenceStart - elementStart;
                                localEnd = element.textContent.length;
                            } else if (idx === affectedElements.length - 1) {
                                localStart = 0;
                                localEnd = evidenceEnd - elementStart;
                            } else {
                                localStart = 0;
                                localEnd = element.textContent.length;
                            }
                            if (localStart < 0) localStart = 0;
                            if (localEnd > element.textContent.length) localEnd = element.textContent.length;
                            const before = element.textContent.slice(0, localStart);
                            const highlight = element.textContent.slice(localStart, localEnd);
                            const after = element.textContent.slice(localEnd);
                            // 建立高亮 span
                            const highlightSpan = document.createElement('span');
                            highlightSpan.textContent = highlight;
                            highlightSpan.className = 'fb-highlight-text';
                            highlightSpan.style.cssText = `
                                background-color: rgba(255, 255, 0, 0.3);
                                border-bottom: 2px solid #ffd700;
                                display: inline;
                                cursor: pointer;
                                user-select: none;
                            `;
                            let container;
                            if (idx === 0) {
                                container = document.createElement('span');
                                container.className = 'fb-highlight-container';
                                container.style.cssText = `
                                    position: relative;
                                    display: inline-block;
                                `;
                                const tooltip = document.createElement('div');
                                tooltip.className = 'fb-analyzer-tooltip';
                                tooltip.style.cssText = `
                                    position: absolute;
                                    background: #333;
                                    color: white;
                                    padding: 8px 12px;
                                    border-radius: 4px;
                                    font-size: 12px;
                                    z-index: 10000;
                                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                                    width: max-content;
                                    max-width: 300px;
                                    left: 0;
                                    top: -40px;
                                    display: none;
                                    white-space: normal;
                                    word-wrap: break-word;
                                `;
                                tooltip.textContent = `詐騙類型: ${refText}`;
                                container.appendChild(highlightSpan);
                                container.appendChild(tooltip);
                            } else {
                                container = highlightSpan;
                            }
                            // 替換 element 內容
                            element.innerHTML = '';
                            element.appendChild(document.createTextNode(before));
                            element.appendChild(container);
                            element.appendChild(document.createTextNode(after));
                            // log
                            console.log('--- 跨多 element 高亮 debug ---');
                            console.log('element index:', idx);
                            console.log('element.textContent:', element.textContent);
                            console.log('localStart:', localStart, 'localEnd:', localEnd);
                            console.log('highlight:', highlight);
                            console.log('before:', before);
                            console.log('after:', after);
                        });
                    } else {
                        // fallback: 合併所有 affectedElements 的 textContent 做正則替換，然後分配回去
                        console.log('跨多 element 分段高亮合併後與要高亮的文本不一致，fallback 用正則替換');
                        console.log('分段高亮合併:', allHighlight);
                        console.log('要高亮的文本:', normalizedEvidence);

                        // 合併所有 affectedElements 的 textContent
                        const fullText = affectedElements.map(item => item.element.textContent).join('');
                        const evidenceContainer = document.createElement('span');
                        evidenceContainer.className = 'fb-highlight-container';
                        evidenceContainer.style.cssText = `
                            position: relative;
                            display: inline-block;
                        `;
                        const evidenceHighlight = document.createElement('span');
                        evidenceHighlight.textContent = normalizedEvidence;
                        evidenceHighlight.className = 'fb-highlight-text';
                        evidenceHighlight.style.cssText = `
                            background-color: rgba(255, 255, 0, 0.3);
                            border-bottom: 2px solid #ffd700;
                            display: inline;
                            cursor: pointer;
                            user-select: none;
                        `;
                        const evidenceTooltip = document.createElement('div');
                        evidenceTooltip.className = 'fb-analyzer-tooltip';
                        evidenceTooltip.style.cssText = `
                            position: absolute;
                            background: #333;
                            color: white;
                            padding: 8px 12px;
                            border-radius: 4px;
                            font-size: 12px;
                            z-index: 10000;
                            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                            width: max-content;
                            max-width: 300px;
                            left: 0;
                            top: -40px;
                            display: none;
                            white-space: normal;
                            word-wrap: break-word;
                        `;
                        evidenceTooltip.textContent = `詐騙類型: ${refText}`;
                        evidenceContainer.appendChild(evidenceHighlight);
                        evidenceContainer.appendChild(evidenceTooltip);

                        const evidenceEscaped = normalizedEvidence.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const evidenceRegex = new RegExp(evidenceEscaped, 'g');
                        const replaced = fullText.replace(evidenceRegex, evidenceContainer.outerHTML);

                        if (replaced !== fullText) {
                            // 只在第一個 element 放入 replaced，其餘清空
                            affectedElements[0].element.innerHTML = replaced;
                            for (let i = 1; i < affectedElements.length; i++) {
                                affectedElements[i].element.innerHTML = '';
                            }
                            console.log('用 normalizedEvidence 成功高亮（跨多 element fallback）');
                        } else {
                            // fallback 也失敗，保留原文
                            console.log('用 normalizedEvidence 也無法高亮（跨多 element fallback）');
                        }
                    }
                }
                // === PATCH END ===
            } else {
                console.log('未找到匹配的文本:', normalizedEvidence);
            }
        });
    });
}

async function updateDisplay(content, isRAGResult = false, showAdditionalContent = true) {
    const contentArea = document.getElementById('fb-analyzer-content');
    if (!contentArea) return;

    const section = document.createElement('div');
    section.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    const title = document.createElement('h4');
    title.textContent = isRAGResult ? '詐騙分析結果' : '貼文內容';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #1877f2;
        font-size: 18px;
        font-weight: bold;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;

    if (isRAGResult) {
        // 添加複製按鈕
        const copyButton = document.createElement('button');
        copyButton.textContent = '複製分析結果';
        copyButton.style.cssText = `
            background-color: #1877f2;
            color: white;
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            font-size: 14px;
            cursor: pointer;
            transition: background-color 0.2s;
        `;
        copyButton.onmouseover = () => {
            copyButton.style.backgroundColor = '#166fe5';
        };
        copyButton.onmouseout = () => {
            copyButton.style.backgroundColor = '#1877f2';
        };
        copyButton.onclick = async () => {
            const predictions = content.data.results[0].predictions;
            let formattedText = '詐騙分析結果\n\n';
            try {
                // 取得 API 回傳資料
                const data = await getSuspiciousData(lastPostContent);
                const riskLevel = calculateRiskLevel(predictions, data);
                formattedText += `風險等級：${getRiskLevelText(riskLevel)}\n`;
                formattedText += `風險描述：${getRiskDescription(riskLevel)}\n\n`;
                const hasSuspiciousLineId = data.line_id_details.some(item => item.result === 1);
                const hasFraudType = predictions.length > 0 && !isNoFraudDetected(predictions);
                const highestUrlLevel = getHighestUrlLevel(data.url_details);
                formattedText += '評分依據：\n';
                formattedText += `• 可疑LINE ID: ${hasSuspiciousLineId ? '有' : '無'}\n`;
                formattedText += `• 詐騙類型: ${hasFraudType ? '有' : '無'}\n`;
                formattedText += `• 最高URL風險等級: ${highestUrlLevel}\n\n`;
                // 2. 可疑項目
                const suspiciousLineIds = data.line_id_details.filter(item => item.result === 1);
                if (suspiciousLineIds.length > 0) {
                    formattedText += '📱 可疑LINE ID：\n';
                    suspiciousLineIds.forEach(item => {
                        formattedText += `• ${item.id}\n`;
                    });
                    formattedText += '\n';
                }
                const suspiciousUrls = data.url_details.filter(item => 
                    item.status === 1 && (item.level === 'HIGH' || item.level === 'MEDIUM')
                );
                if (suspiciousUrls.length > 0) {
                    formattedText += '🌐 可疑URL：\n';
                    suspiciousUrls.forEach(item => {
                        formattedText += `• ${item.url} (${item.level}, 詐騙機率: ${(item.scam_probability * 100).toFixed(2)}%)\n`;
                    });
                    formattedText += '\n';
                }
                if (suspiciousLineIds.length === 0 && suspiciousUrls.length === 0) {
                    formattedText += '未偵測到可疑的LINE ID或URL\n\n';
                }
                // 3. 詐騙類型
                formattedText += '⚠️ 詐騙類型分析\n';
                formattedText += '================\n';
                if (isNoFraudDetected(predictions)) {
                    formattedText += '未偵測到詐騙類型\n';
                } else {
                    predictions.forEach((prediction, index) => {
                        if (!prediction.ref_text) return;
                        formattedText += `詐騙類型：${prediction.ref_text}\n`;
                        formattedText += `可信度：${(prediction.confidence * 100).toFixed(1)}%\n\n`;
                        formattedText += '發現的證據：\n';
                        prediction.evidences.forEach((evidence, i) => {
                            formattedText += `${i + 1}. ${evidence}\n`;
                        });
                        formattedText += '\n';
                    });
                }
                await navigator.clipboard.writeText(formattedText);
                const originalText = copyButton.textContent;
                copyButton.textContent = '已複製！';
                copyButton.style.backgroundColor = '#28a745';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    copyButton.style.backgroundColor = '#1877f2';
                }, 2000);
            } catch (error) {
                console.error('複製分析結果失敗:', error);
                copyButton.textContent = '複製失敗';
                copyButton.style.backgroundColor = '#dc3545';
                setTimeout(() => {
                    copyButton.textContent = '複製分析結果';
                    copyButton.style.backgroundColor = '#1877f2';
                }, 2000);
            }
        };
        title.appendChild(copyButton);

        // Create Post Comment button
        // const postCommentButton = document.createElement('button');
        // postCommentButton.textContent = '自動留言分析結果';
        // postCommentButton.id = 'postCommentButton';
        // postCommentButton.style.cssText = `
        //     background-color: #1877f2;
        //     color: white;
        //     border: none;
        //     padding: 6px 12px;
        //     border-radius: 4px;
        //     font-size: 14px;
        //     cursor: pointer;
        //     transition: background-color 0.2s;
        //     margin-left: 8px; 
        // `;
        // postCommentButton.onmouseover = () => {
        //     postCommentButton.style.backgroundColor = '#166fe5';
        // };
        // postCommentButton.onmouseout = () => {
        //     postCommentButton.style.backgroundColor = '#1877f2';
        // };
        // postCommentButton.addEventListener('click', () => {
        //     if (lastAnalysisResult && lastAnalysisResult.predictions) {
        //         const commentText = generateCommentText(lastAnalysisResult.predictions);
        //         postAnalysisToFacebookComment(commentText);
        //         // Optional: Change button text to "Posting..." or disable it
        //         postCommentButton.textContent = '處理中...';
        //         postCommentButton.disabled = true;
        //         setTimeout(() => { // Reset button after a delay
        //             postCommentButton.textContent = '自動留言分析結果';
        //             postCommentButton.disabled = false;
        //         }, 3000); // Reset after 3 seconds
        //     } else {
        //         console.error('No analysis result available to post.');
        //         alert('沒有可用的分析結果來留言。請先執行分析。');
        //     }
        // });
        // title.appendChild(postCommentButton);
    }
    section.appendChild(title);

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
        white-space: pre-wrap;
        word-wrap: break-word;
        font-size: 14px;
        line-height: 1.6;
    `;
    
    if (isRAGResult) {
        // 解析分析結果
        const predictions = content.data.results[0].predictions;
        
        // 保存分析結果
        lastAnalysisResult = {
            content: content,
            predictions: predictions
        };
        
        // 保存到 storage
        await saveData();
        // TODO:高亮文本若再同一元素有複數次高亮會覆蓋上一次的高亮結果
        // 在原始貼文中高亮顯示證據
        // highlightEvidenceInOriginalPost(predictions);

        // 只有在需要顯示額外內容時才調用這些函數
        if (showAdditionalContent) {
            // 按照新順序顯示：1. 綜合風險評分 2. 可疑項目 3. 詐騙類型
            (async () => {
                await displayAllAnalysisResults(predictions, lastPostContent);
            })();
        }
        // 新增：如果無偵測到詐騙類型，顯示提示
        if (isNoFraudDetected(predictions)) {
            const noFraudDiv = document.createElement('div');
            noFraudDiv.style.cssText = `
                text-align: center;
                padding: 20px;
                color: #28a745;
                font-style: italic;
                background: white;
                border-radius: 6px;
                margin-top: 10px;
            `;
            noFraudDiv.textContent = '未偵測到詐騙類型';
            contentArea.appendChild(noFraudDiv);
        }
    } else {
        contentDiv.textContent = content;
        section.appendChild(contentDiv);
        // 保存原始貼文內容
        lastPostContent = content;
        
        // 保存到 storage
        await saveData();
    }
    
    // 將 section 添加到 contentArea（無論是否為 RAG 結果）
    contentArea.appendChild(section);
}

// 新增函數：顯示詐騙類型
function displayFraudTypes(predictions) {
    const contentArea = document.getElementById('fb-analyzer-content');
    if (!contentArea) return;

    // 新增：判斷 predictions 是否為有效陣列且有內容，或為無偵測到詐騙類型
    if (isNoFraudDetected(predictions)) {
        const fraudSection = document.createElement('div');
        fraudSection.style.cssText = `
            margin-bottom: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        const fraudTitle = document.createElement('h4');
        fraudTitle.textContent = '⚠️ 詐騙類型分析';
        fraudTitle.style.cssText = `
            margin: 0 0 15px 0;
            color: #dc3545;
            font-size: 18px;
            font-weight: bold;
            border-bottom: 2px solid #e9ecef;
            padding-bottom: 10px;
        `;
        fraudSection.appendChild(fraudTitle);

        const noFraudDiv = document.createElement('div');
        noFraudDiv.style.cssText = `
            text-align: center;
            padding: 20px;
            color: #28a745;
            font-style: italic;
            background: white;
            border-radius: 6px;
        `;
        noFraudDiv.textContent = '未偵測到詐騙類型';
        fraudSection.appendChild(noFraudDiv);

        contentArea.appendChild(fraudSection);
        return;
    }

    // 創建詐騙類型顯示區域
    const fraudSection = document.createElement('div');
    fraudSection.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    const fraudTitle = document.createElement('h4');
    fraudTitle.textContent = '⚠️ 詐騙類型分析';
    fraudTitle.style.cssText = `
        margin: 0 0 15px 0;
        color: #dc3545;
        font-size: 18px;
        font-weight: bold;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 10px;
    `;
    fraudSection.appendChild(fraudTitle);

    // 創建詐騙類型容器
    const fraudContainer = document.createElement('div');
    fraudContainer.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 15px;
    `;

    // 處理每個預測結果（只顯示 ref_text 存在的）
    predictions.forEach((prediction, index) => {
        if (!prediction.ref_text) return; // 跳過沒有 ref_text 的
        const predictionCard = document.createElement('div');
        predictionCard.style.cssText = `
            background: white;
            border-radius: 8px;
            padding: 15px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        `;

        // 詐騙類型標題
        const scamTypeContainer = document.createElement('div');
        scamTypeContainer.style.cssText = `
            display: flex;
            align-items: flex-start;
            gap: 10px;
            margin-bottom: 10px;
        `;

        const iconTextGroup = document.createElement('div');
        iconTextGroup.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            color: #dc3545;
        `;

        const warningIcon = document.createElement('span');
        warningIcon.textContent = '⚠';
        warningIcon.style.cssText = `
            font-size: 28px;
            line-height: 1;
        `;
        iconTextGroup.appendChild(warningIcon);
        scamTypeContainer.appendChild(iconTextGroup);

        const scamTypeText = document.createElement('div');
        scamTypeText.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #dc3545;
        `;
        scamTypeText.textContent = `詐騙類型：${prediction.ref_text}`;
        scamTypeContainer.appendChild(scamTypeText);

        predictionCard.appendChild(scamTypeContainer);

        // 可信度指示器
        const confidenceBar = document.createElement('div');
        confidenceBar.style.cssText = `
            margin: 10px 0;
            background: #e9ecef;
            border-radius: 4px;
            height: 8px;
            overflow: hidden;
        `;
        const confidenceFill = document.createElement('div');
        confidenceFill.style.cssText = `
            height: 100%;
            background: ${prediction.confidence > 0.8 ? '#28a745' : '#ffc107'};
            width: ${prediction.confidence * 100}%;
            transition: width 0.3s ease;
        `;
        confidenceBar.appendChild(confidenceFill);
        predictionCard.appendChild(confidenceBar);

        // 可信度文字
        const confidenceText = document.createElement('div');
        confidenceText.style.cssText = `
            font-size: 12px;
            color: #6c757d;
            margin-bottom: 10px;
        `;
        confidenceText.textContent = `信心度：${(prediction.confidence * 100).toFixed(1)}%`;
        predictionCard.appendChild(confidenceText);

        // 證據列表
        const evidenceTitle = document.createElement('div');
        evidenceTitle.style.cssText = `
            font-size: 14px;
            font-weight: bold;
            color: #495057;
            margin: 10px 0 5px 0;
        `;
        evidenceTitle.textContent = '發現的證據：';
        predictionCard.appendChild(evidenceTitle);

        const evidenceList = document.createElement('ul');
        evidenceList.style.cssText = `
            margin: 0;
            padding-left: 20px;
            color: #495057;
        `;
        prediction.evidences.forEach(evidence => {
            const evidenceItem = document.createElement('li');
            evidenceItem.textContent = evidence;
            evidenceList.appendChild(evidenceItem);
        });
        predictionCard.appendChild(evidenceList);

        fraudContainer.appendChild(predictionCard);
    });
    fraudSection.appendChild(fraudContainer);
    contentArea.appendChild(fraudSection);
}

// 顯示可疑LINE ID和可疑URL
function displaySuspiciousItems(data) {
    const contentArea = document.getElementById('fb-analyzer-content');
    if (!contentArea) return;

    // 創建可疑項目顯示區域
    const suspiciousSection = document.createElement('div');
    suspiciousSection.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    const suspiciousTitle = document.createElement('h4');
    // suspiciousTitle.textContent = '🔍';
    suspiciousTitle.style.cssText = `
        margin: 0 0 15px 0;
        color: #dc3545;
        font-size: 18px;
        font-weight: bold;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 10px;
    `;
    suspiciousSection.appendChild(suspiciousTitle);

    // 處理可疑LINE ID
    const suspiciousLineIds = data.line_id_details.filter(item => item.result === 1);
    if (suspiciousLineIds.length > 0) {
        const lineIdContainer = document.createElement('div');
        lineIdContainer.style.cssText = `
            margin-bottom: 15px;
        `;

        const lineIdTitle = document.createElement('div');
        lineIdTitle.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        lineIdTitle.innerHTML = '📱 可疑LINE ID';
        lineIdContainer.appendChild(lineIdTitle);

        const lineIdList = document.createElement('div');
        lineIdList.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        `;

        suspiciousLineIds.forEach(item => {
            const lineIdCard = document.createElement('div');
            lineIdCard.style.cssText = `
                background: #fff3cd;
                border: 1px solid #ffeaa7;
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 14px;
                font-weight: bold;
                color: #856404;
                display: flex;
                align-items: center;
                gap: 6px;
            `;
            lineIdCard.innerHTML = `⚠️ ${item.id}`;
            lineIdList.appendChild(lineIdCard);
        });

        lineIdContainer.appendChild(lineIdList);
        suspiciousSection.appendChild(lineIdContainer);
    }

    // 處理可疑URL（HIGH和MEDIUM等級）
    const suspiciousUrls = data.url_details.filter(item => 
        item.status === 1 && (item.level === 'HIGH' || item.level === 'MEDIUM')
    );
    
    if (suspiciousUrls.length > 0) {
        const urlContainer = document.createElement('div');
        urlContainer.style.cssText = `
            margin-bottom: 15px;
        `;

        const urlTitle = document.createElement('div');
        urlTitle.style.cssText = `
            font-size: 16px;
            font-weight: bold;
            color: #495057;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        urlTitle.innerHTML = '🌐 可疑URL';
        urlContainer.appendChild(urlTitle);

        const urlList = document.createElement('div');
        urlList.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 8px;
        `;

        suspiciousUrls.forEach(item => {
            const urlCard = document.createElement('div');
            urlCard.style.cssText = `
                background: white;
                border-radius: 6px;
                padding: 12px;
                box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                border-left: 4px solid ${item.level === 'HIGH' ? '#dc3545' : '#ffc107'};
            `;

            const urlHeader = document.createElement('div');
            urlHeader.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            `;

            const urlText = document.createElement('div');
            urlText.style.cssText = `
                font-size: 14px;
                font-weight: bold;
                color: #495057;
                word-break: break-all;
            `;
            urlText.textContent = item.url;

            const levelBadge = document.createElement('span');
            levelBadge.style.cssText = `
                background: ${item.level === 'HIGH' ? '#dc3545' : '#ffc107'};
                color: white;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
            `;
            levelBadge.textContent = item.level;

            urlHeader.appendChild(urlText);
            urlHeader.appendChild(levelBadge);
            urlCard.appendChild(urlHeader);

            const urlDetails = document.createElement('div');
            urlDetails.style.cssText = `
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 12px;
                color: #6c757d;
            `;

            const scamProbability = document.createElement('div');
            scamProbability.textContent = `詐騙機率: ${(item.scam_probability * 100).toFixed(2)}%`;

            const source = document.createElement('div');
            source.textContent = `來源: ${item.source}`;

            urlDetails.appendChild(scamProbability);
            urlDetails.appendChild(source);
            urlCard.appendChild(urlDetails);

            urlList.appendChild(urlCard);
        });

        urlContainer.appendChild(urlList);
        suspiciousSection.appendChild(urlContainer);
    }

    // 如果沒有可疑項目，顯示提示信息
    if (suspiciousLineIds.length === 0 && suspiciousUrls.length === 0) {
        const noSuspiciousDiv = document.createElement('div');
        noSuspiciousDiv.style.cssText = `
            text-align: center;
            padding: 20px;
            color: #6c757d;
            font-style: italic;
        `;
        noSuspiciousDiv.textContent = '未偵測到可疑的LINE ID或URL';
        suspiciousSection.appendChild(noSuspiciousDiv);
    }

    contentArea.appendChild(suspiciousSection);
}

async function extractPostAndComments(downloadPath) {
    // 取得留言
    var comment = '';
    var commentSet = new Set();  // 用來記錄已經出現過的內容
    var commentTag = '.html-div.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1gslohp .xwib8y2.xpdmqnj.x1g0dm76.x1y1aw1k span div[dir=auto]';
    [].forEach.call(document.querySelectorAll(commentTag), function (commentEl) {
        var commentLine = commentEl.parentNode.parentNode.parentNode.parentNode.innerHTML;
        commentLine = commentLine.replace(/(<a([^>]+)?>)/ig, '');
        commentLine = commentLine.replace(/(<([^>]+)>)/ig, '{}');
        while (commentLine.indexOf('{}{}') > -1) {
            commentLine = commentLine.replace(/\{\}\{\}/ig, '{}');
        }
        commentLine = commentLine.replace(/^\{\}/ig, '');
        commentLine = commentLine.replace(/\{\}$/ig, '');
        commentLine = commentLine.replace(/\{\}/i, ': ');
        commentLine = commentLine.replace(/\{\}/ig, ' '); // 其餘 {} 移除
        commentLine = commentLine.replace('管理員: ', '');
        commentLine = commentLine.replace('頭號粉絲: ', '');
        commentLine = commentLine.replace('作者: ', '');
        commentLine = commentLine.replace('最常發言的成員: ', '');
        commentLine = commentLine.replace('版主: ', '');
        commentLine = commentLine.replace('追蹤: ', '');
        commentLine = commentLine.replace(': &nbsp;:  · :', ':');
        commentLine = commentLine.replace('已驗證帳號:  : ', '');
        if (commentLine.length == 0 || commentLine == '{}') return;

        // 過濾重複
        if (!commentSet.has(commentLine)) {
            comment += commentLine + '\r\n';
            comment += '--------------------------------------------------------------------------------' + '\r\n';
            commentSet.add(commentLine);
        }
    });

    // 取得貼文
    var post = '';
    var postSet = new Set();  // 用來記錄已經出現過的內容
    var postTag = '.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x78zum5.xdt5ytf.x1iyjqo2.x1n2onr6.xqbnct6.xga75y6 .html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl .x78zum5.xdt5ytf.xz62fqu.x16ldp7u .xu06os2.x1ok221b span div[dir=auto]';
    [].forEach.call(document.querySelectorAll(postTag), function (postEl) {
        var postLine = postEl.parentNode.parentNode.parentNode.parentNode.innerHTML;
        postLine = postLine.replace(/(<a([^>]+)?>)/ig, '');
        postLine = postLine.replace(/(<([^>]+)>)/ig, '{}');
        while (postLine.indexOf('{}{}') > -1) {
            postLine = postLine.replace(/\{\}\{\}/ig, '{}');
        }
        postLine = postLine.replace(/^\{\}/ig, '');
        postLine = postLine.replace(/\{\}$/ig, '');
        postLine = postLine.replace(/\{\}/i, ' ');
        postLine = postLine.replace(/\{\}/ig, ' '); // 其餘 {} 移除
        postLine = postLine.replace('管理員: ', '');
        postLine = postLine.replace('頭號粉絲: ', '');
        postLine = postLine.replace('作者: ', '');
        postLine = postLine.replace('最常發言的成員: ', '');
        postLine = postLine.replace('版主: ', '');
        postLine = postLine.replace('追蹤: ', '');
        postLine = postLine.replace(': &nbsp;:  · :', ':');
        postLine = postLine.replace('已驗證帳號:  : ', '');
        if (postLine.length == 0 || postLine == '{}') return;

        // 過濾貼文中重複
        if (!postSet.has(postLine)) {
            // 過濾留言
            if (!commentSet.has(postLine)) {
                post += postLine + '\r\n';
                postSet.add(postLine);
            }
        }
    });

    // 若 postSet 為空，表示沒有擷取到貼文，執行例外處理
    if (postSet.size === 0) {
        var tag_1 = '.html-div.xdj266r.x11i5rnm.xat24cr.x1mh8g0r.xexx8yu.x4uap5.x18d9i69.xkhd6sd.x78zum5.xdt5ytf.x1iyjqo2.x1n2onr6.xqbnct6.xga75y6 .xdj266r.x11i5rnm.xat24cr.x1mh8g0r.x1l90r2v.x1pi30zi.x1swvt13.x1iorvi4 .x193iq5w';
        post = fixMissingPost(tag_1, commentSet);
        if (post.length === 0) {
            var tag_2 = '.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x78zum5.xdt5ytf.x1iyjqo2.x1n2onr6.xqbnct6.xga75y6 .html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl div[data-ad-rendering-role="story_message"] .xdj266r';
            post = fixMissingPost(tag_2, commentSet);
        }
    }

    // 組合貼文與留言
    let content = `【貼文】\r\n${post}\r\n【留言】\r\n${comment}`;
    
    // 創建顯示區域並顯示貼文內容
    createDisplayArea();
    await updateDisplay(content);

    // 創建RAG任務並獲取結果
    (async () => {
        try {
            console.log('🚀 開始創建 RAG 任務');
            // 顯示載入提示
            const contentArea = createDisplayArea();
            contentArea.innerHTML = '<div style="padding: 10px; background-color: #e7f3ff; color: #1877f2; border-radius: 4px; margin-bottom: 10px;">分析中，請稍候...</div>';

            // 創建RAG任務
            const jobId = await createRAGTask(post);
            console.log('📝 已創建 RAG 任務，job_id:', jobId);

            // 等待任務完成並獲取結果
            const result = await waitForRAGCompletion(jobId);
            console.log('✨ RAG 任務處理完成並獲取結果');

            // 清除載入提示，並顯示 RAG 分析結果
            contentArea.innerHTML = ''; // 清空載入提示
            await updateDisplay(lastPostContent, false); // 重新顯示原始貼文
            
            // 保存分析結果到全局變量
            lastAnalysisResult = {
                content: result,
                predictions: result.data.results[0].predictions
            };
            
            // 保存到 storage
            await saveData();
            
            displayAnalysisHeader(result); // 顯示詐騙分析結果標題和按鈕
            // TODO:高亮文本若再同一元素有複數次高亮會覆蓋上一次的高亮結果
            // 高亮顯示證據
            // highlightEvidenceInOriginalPost(result.data.results[0].predictions);
            // 按照新順序顯示：1. 綜合風險評分 2. 可疑項目 3. 詐騙類型
            (async () => {
                await displayAllAnalysisResults(result.data.results[0].predictions, lastPostContent);
            })();
        } catch (error) {
            console.error('❌ RAG 處理過程發生錯誤:', error);
            // 顯示錯誤信息
            const contentArea = document.getElementById('fb-analyzer-content');
            if (contentArea) {
                contentArea.innerHTML = ''; // 清空載入提示
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    background-color: #ffebee;
                    color: #d32f2f;
                    padding: 10px;
                    border-radius: 4px;
                    margin-bottom: 20px;
                `;
                errorDiv.textContent = `❌ RAG 處理過程發生錯誤: ${error.message}`;
                contentArea.appendChild(errorDiv);
            }
        }
    })();
}

async function clickAndCollectUrls(postUrlSet, downloadPath) {
    // 點擊貼文中第一張圖片 將圖片畫面置於前景
    const click_url = postUrlSet.values().next().value;
    const targetImg = Array.from(document.querySelectorAll('img')).find(img =>
        img.src.includes(click_url)
    );
    if (targetImg) {
        targetImg.click();
    } else {
        console.log('找不到目標圖片');
        return;
    }
    await waitForUrlChange(5000, click_url);
    setTimeout(() => {
        autoDownloadFacebookImages(downloadPath);
    }, 1500);
}

function waitForUrlChange(timeout = 5000, oldUrl) {
    // 檢核網址列網址已變更
    return new Promise((resolve, reject) => {
        const startTime = Date.now();

        const check = () => {
            console.log('Checking URL...', window.location.href);
            if (window.location.href !== oldUrl) {
                console.log('URL changed!');
                resolve();
            } else if (Date.now() - startTime > timeout) {
                console.log('URL did not change in time');
                reject('URL did not change in time');
            } else {
                requestAnimationFrame(check);
            }
        };
        check();
    });
}

function extractImages(downloadPath) {
    // 取得留言圖片
    var commentUrlSet = new Set();
    var commentImageTag = '.html-div.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x1gslohp .xwib8y2.xpdmqnj.x1g0dm76.x1y1aw1k';
    const commentContainers = document.querySelectorAll(commentImageTag);
    if (commentContainers.length === 0) {
    } else {
        commentContainers.forEach((commentContainer, commentIndex) => {
            const commentImages = commentContainer.querySelectorAll('img');
            commentImages.forEach((commentImg, commentImgIndex) => {
                let commentUrl = commentImg.src;
                commentUrlSet.add(commentUrl);
            });
        });
    }

    // 取得貼文圖片
    var postUrlSet = new Set();
    var postImageTag = '.html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl.x78zum5.xdt5ytf.x1iyjqo2.x1n2onr6.xqbnct6.xga75y6 .html-div.xdj266r.x14z9mp.xat24cr.x1lziwak.xexx8yu.xyri2b.x18d9i69.x1c1uobl .xqtp20y.x6ikm8r.x10wlt62.x1n2onr6';
    const postContainers = document.querySelectorAll(postImageTag);
    if (postContainers.length === 0) {
        console.log('找不到貼文的圖片區塊！');
        return;
    }

    postContainers.forEach((postContainer, postIndex) => {
        const postImages = postContainer.querySelectorAll('img');
        postImages.forEach((postImg, postImgIndex) => {
            if (postImg.height !== 16) { //濾除 height="16" 的圖片
                let postUrl = postImg.src;
                if (!postUrlSet.has(postUrl)) { // 過濾貼文中重複
                    if (!commentUrlSet.has(postUrl)) { // 過濾留言中重複
                        // debug console.log(postUrl);
                        postUrlSet.add(postUrl);
                    }
                }
            }
        });
    });

    if (postUrlSet.size === 1) {
        // 只有一張圖片 直接在此前景頁面下載
        const imageUrl = postUrlSet.values().next().value;
        console.log("⬇️ 準備下載圖片：", imageUrl);
        const filename = downloadPath + '/' + '001.jpg';
        chrome.runtime.sendMessage({
            action: "download_image",
            url: imageUrl,
            filename: filename
        });
    } else if (postUrlSet.size > 1) {
        // 如果有多張圖片 則點擊第一張圖片置於前景 並點擊下一張依序下載
        clickAndCollectUrls(postUrlSet, downloadPath);
    } else {
        // 沒有圖片
        console.log('❌ 沒有找到任何圖片，請確認是否選對貼文');
    }
}

function generateDownloadPath() {
    // 取得發文者名稱
    let span = document.querySelector('span.x6zurak.x18bv5gf.x184q3qc.xqxll94.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x2b8uid.x1lliihq.xzsf02u.xlh3980.xvmahel.x1x9mg3.x1xlr1w8');
    let rawText = span?.textContent;
    if (!rawText || rawText.trim() === '') {
        span = document.querySelector('span.x6zurak.x18bv5gf.x184q3qc.xqxll94.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x2b8uid.x1lliihq.xzsf02u.xlh3980.xvmahel.x1x9mg3.x1xlr1w8');
        rawText = span?.textContent;
    }
    if (!rawText || rawText.trim() === '') {
        span = document.querySelector('span.x6zurak.x18bv5gf.x184q3qc.xqxll94.x1s928wv.xhkezso.x1gmr53x.x1cpjm7i.x1fgarty.x1943h6x.x193iq5w.xeuugli.x13faqbe.x1vvkbs.x2b8uid.x1lliihq.xzsf02u.xlh3980.xvmahel.x1x9mg3.x1xlr1w8');
        rawText = span?.textContent;
    }
    
    const posterName = rawText ? rawText.replace('的貼文', '') : 'unknown';
    
    // 組合下載路徑
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = date.getSeconds();
    
    return posterName + `_${year}${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}${hour.toString().padStart(2, '0')}${minute.toString().padStart(2, '0')}${second.toString().padStart(2, '0')}`;
}

function generateCommentText(predictions) {
    let commentText = "【自動化分析摘要】此留言由AI分析產生，僅供參考：\n\n";
    if (isNoFraudDetected(predictions)) {
        commentText += '未偵測到詐騙類型';
        return commentText.trim();
    }
    predictions.forEach(prediction => {
        const scamType = prediction.ref_text;
        const confidence = (prediction.confidence * 100).toFixed(1);
        const firstEvidence = prediction.evidences.length > 0 ? prediction.evidences[0] : "無具體證據";
        commentText += `詐騙類型：${scamType} (可信度：${confidence}%)\n`;
        commentText += `主要證據：${firstEvidence}\n\n`;
    });
    return commentText.trim();
}

// function postAnalysisToFacebookComment(commentText) {
//     console.log("Attempting to post comment:", commentText);

//     // Find the comment input field
//     const inputField = document.querySelector('div[role="textbox"][aria-label*="comment"], div[role="textbox"][aria-label*="留言"]');

//     if (inputField) {
//         console.log("Comment input field found:", inputField);
//         // Ensure it's contentEditable for divs
//         if (inputField.tagName.toLowerCase() === 'div') {
//             inputField.setAttribute('contenteditable', 'true');
//         }
        
//         inputField.focus();
        
//         // Set the text content
//         // Using innerText to better simulate user input, especially for line breaks
//         inputField.innerText = commentText; 

//         // Dispatch events to make Facebook's JS acknowledge the input
//         inputField.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
//         // Some FB implementations might also need a keyup or paste event
//         inputField.dispatchEvent(new Event('keyup', { bubbles: true, cancelable: true }));
//         inputField.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));


//         // Find the submit button (this selector might need to be very specific)
//         // It's often near the input field, but global selectors are tried first.
//         // Prioritize buttons that are explicitly for posting/sending a comment.
//         let submitButton = document.querySelector(
//             'button[aria-label="Post comment"], button[aria-label="發佈留言"], ' + // Specific labels first
//             'button[aria-label*="Post"], button[aria-label*="發佈"], ' + // More general labels
//             'button[type="submit"] svg, button[data-testid="react-composer-post-button"]' // Structure/test-id based
//         );
        
//         // If a general submit button is not found, try to find one relative to the input field
//         if (!submitButton && inputField.form) {
//             submitButton = inputField.form.querySelector('button[type="submit"]');
//         }
//         // Fallback: Look for a button with a send icon (data-icon="send")
//         if (!submitButton) {
//             submitButton = document.querySelector('button[data-icon="send"], button[aria-label="Send"]');
//         }


//         if (submitButton) {
//             console.log("Submit button found:", submitButton);
//             // Brief delay to ensure text is processed, then click
//             setTimeout(() => {
//                 submitButton.click();
//                 console.log("Comment posted successfully (simulated).");
//                 // TODO: Add user feedback (e.g., a small notification)
//             }, 500); // 500ms delay, might need adjustment
//         } else {
//             console.error("Submit button not found.");
//             alert("無法找到留言發佈按鈕。請手動發佈。");
//         }
//     } else {
//         console.error("Comment input field not found.");
//         alert("無法找到留言輸入框。");
//     }
// }

// 綜合風險評分
function displayComprehensiveRiskAssessment(predictions, data) {
    const contentArea = document.getElementById('fb-analyzer-content');
    if (!contentArea) return;

    // 計算綜合評分
    const riskLevel = calculateRiskLevel(predictions, data);
    
    // 創建綜合評分顯示區域
    const riskSection = document.createElement('div');
    riskSection.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    const riskTitle = document.createElement('h4');
    // riskTitle.textContent = '🎯';
    riskTitle.style.cssText = `
        margin: 0 0 15px 0;
        color: #495057;
        font-size: 18px;
        font-weight: bold;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 10px;
    `;
    riskSection.appendChild(riskTitle);

    // 創建風險燈號顯示
    const riskIndicator = document.createElement('div');
    riskIndicator.style.cssText = `
        display: flex;
        align-items: center;
        gap: 15px;
        margin-bottom: 15px;
    `;

    // 風險燈號圓圈
    const riskCircle = document.createElement('div');
    riskCircle.style.cssText = `
        width: 60px;
        height: 60px;
        border-radius: 50%;
        background: ${getRiskColor(riskLevel)};
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: bold;
        color: white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    riskCircle.textContent = getRiskText(riskLevel);
    riskIndicator.appendChild(riskCircle);

    // 風險等級文字
    const riskText = document.createElement('div');
    riskText.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 5px;
    `;

    const riskLevelText = document.createElement('div');
    riskLevelText.style.cssText = `
        font-size: 20px;
        font-weight: bold;
        color: ${getRiskColor(riskLevel)};
    `;
    riskLevelText.textContent = getRiskLevelText(riskLevel);
    riskText.appendChild(riskLevelText);

    const riskDescription = document.createElement('div');
    riskDescription.style.cssText = `
        font-size: 14px;
        color: #6c757d;
    `;
    riskDescription.textContent = getRiskDescription(riskLevel);
    riskText.appendChild(riskDescription);

    riskIndicator.appendChild(riskText);
    riskSection.appendChild(riskIndicator);

    // 顯示評分依據
    const criteriaSection = document.createElement('div');
    criteriaSection.style.cssText = `
        background: white;
        border-radius: 6px;
        padding: 12px;
        margin-top: 10px;
    `;

    const criteriaTitle = document.createElement('div');
    criteriaTitle.style.cssText = `
        font-size: 14px;
        font-weight: bold;
        color: #495057;
        margin-bottom: 8px;
    `;
    criteriaTitle.textContent = '評分依據：';
    criteriaSection.appendChild(criteriaTitle);

    // 獲取評分依據
    const hasSuspiciousLineId = data.line_id_details.some(item => item.result === 1);
    const hasFraudType = predictions.length > 0 && !isNoFraudDetected(predictions);
    const highestUrlLevel = getHighestUrlLevel(data.url_details);

    const criteriaList = document.createElement('div');
    criteriaList.style.cssText = `
        display: flex;
        flex-direction: column;
        gap: 5px;
        font-size: 12px;
        color: #6c757d;
    `;

    criteriaList.innerHTML = `
        <div>• 可疑LINE ID: ${hasSuspiciousLineId ? '有' : '無'}</div>
        <div>• 詐騙類型: ${hasFraudType ? '有' : '無'}</div>
        <div>• 最高URL風險等級: ${highestUrlLevel}</div>
    `;
    criteriaSection.appendChild(criteriaList);
    riskSection.appendChild(criteriaSection);

    contentArea.appendChild(riskSection);
}

// 計算風險等級
function calculateRiskLevel(predictions, data) {
    const hasSuspiciousLineId = data.line_id_details.some(item => item.result === 1);
    const hasFraudType = predictions.length > 0 && !isNoFraudDetected(predictions);
    const highestUrlLevel = getHighestUrlLevel(data.url_details);

    // 根據評分標準判斷風險等級
    if (hasSuspiciousLineId && !hasFraudType && highestUrlLevel === 'LOW') return 'RED';//LINE ID O 詐騙種類有無 X URL可疑等級 LOW
    if (!hasSuspiciousLineId && hasFraudType && highestUrlLevel === 'LOW') return 'YELLOW';//LINE ID X 詐騙種類有無 O URL可疑等級 LOW
    if (hasSuspiciousLineId && hasFraudType && highestUrlLevel === 'LOW') return 'RED';//LINE ID O 詐騙種類有無 O URL可疑等級 LOW
    if (!hasSuspiciousLineId && !hasFraudType && highestUrlLevel === 'LOW') return 'GREEN';//LINE ID X 詐騙種類有無 X URL可疑等級 LOW
    if (!hasSuspiciousLineId && !hasFraudType && highestUrlLevel === 'MEDIUM') return 'YELLOW';//LINE ID X 詐騙種類有無 X URL可疑等級 MEDIUM
    if (hasSuspiciousLineId && !hasFraudType && highestUrlLevel === 'MEDIUM') return 'RED';//LINE ID O 詐騙種類有無 X URL可疑等級 MEDIUM
    if (!hasSuspiciousLineId && hasFraudType && highestUrlLevel === 'MEDIUM') return 'ORANGE';//LINE ID X 詐騙種類有無 O URL可疑等級 MEDIUM
    if (hasSuspiciousLineId && hasFraudType && highestUrlLevel === 'MEDIUM') return 'RED';//LINE ID O 詐騙種類有無 O URL可疑等級 MEDIUM
    if (!hasSuspiciousLineId && !hasFraudType && highestUrlLevel === 'HIGH') return 'ORANGE';//LINE ID X 詐騙種類有無 X URL可疑等級 HIGH
    if (!hasSuspiciousLineId && hasFraudType && highestUrlLevel === 'HIGH') return 'RED';//LINE ID X 詐騙種類有無 O URL可疑等級 HIGH
    if (hasSuspiciousLineId && !hasFraudType && highestUrlLevel === 'HIGH') return 'RED';//LINE ID O 詐騙種類有無 X URL可疑等級 HIGH
    if (hasSuspiciousLineId && hasFraudType && highestUrlLevel === 'HIGH') return 'RED';//LINE ID O 詐騙種類有無 O URL可疑等級 HIGH

    return 'GREEN'; // 預設值
}

// 獲取最高URL風險等級
function getHighestUrlLevel(urlDetails) {
    const validUrls = urlDetails.filter(item => item.status === 1);
    if (validUrls.length === 0) return 'LOW';

    const levels = validUrls.map(item => item.level);
    if (levels.includes('HIGH')) return 'HIGH';
    if (levels.includes('MEDIUM')) return 'MEDIUM';
    return 'LOW';
}

// 獲取風險顏色
function getRiskColor(riskLevel) {
    switch (riskLevel) {
        case 'GREEN': return '#28a745';
        case 'YELLOW': return '#ffc107';
        case 'ORANGE': return '#fd7e14';
        case 'RED': return '#dc3545';
        default: return '#6c757d';
    }
}

// 獲取風險文字
function getRiskText(riskLevel) {
    switch (riskLevel) {
        case 'GREEN': return '低';
        case 'YELLOW': return '中';
        case 'ORANGE': return '高';
        case 'RED': return '極';
        default: return '?';
    }
}

// 獲取風險等級文字
function getRiskLevelText(riskLevel) {
    switch (riskLevel) {
        case 'GREEN': return '低風險';
        case 'YELLOW': return '中風險';
        case 'ORANGE': return '高風險';
        case 'RED': return '極高風險';
        default: return '未知風險';
    }
}

// 獲取風險描述
function getRiskDescription(riskLevel) {
    switch (riskLevel) {
        case 'GREEN': return '此貼文風險較低，但仍需保持警覺';
        case 'YELLOW': return '此貼文存在中等風險，建議謹慎對待';
        case 'ORANGE': return '此貼文風險較高，建議避免互動';
        case 'RED': return '此貼文風險極高，強烈建議避免任何互動';
        default: return '無法評估風險等級';
    }
}

// 監聽來自 popup.js 的指令
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extract') {
        // 直接執行分析功能
        const downloadPath = generateDownloadPath();
        extractPostAndComments(downloadPath);
        sendResponse({ status: 'success' });
    } else if (message.action === 'view_results') {
        // 顯示分析結果
        createDisplayArea();
        
        // 等待數據載入完成
        (async () => {
            // 確保數據已載入
            await loadSavedData();
            
            console.log('view_results - lastPostContent:', lastPostContent);
            console.log('view_results - lastAnalysisResult:', lastAnalysisResult);
            
            if (lastPostContent && lastAnalysisResult) {
                console.log('找到保存的數據，開始顯示結果');
                // 先清空內容區域，避免重複顯示
                const contentArea = document.getElementById('fb-analyzer-content');
                if (contentArea) {
                    contentArea.innerHTML = '';
                }
                
                // 清理舊的高亮效果
                cleanupOldHighlights();
                
                // 先顯示原始貼文內容
                await updateDisplay(lastPostContent, false);
                
                // 顯示詐騙分析結果標題和按鈕
                displayAnalysisHeader(lastAnalysisResult.content);

                // TODO:高亮文本若再同一元素有複數次高亮會覆蓋上一次的高亮結果
                // 重新高亮顯示證據
                // highlightEvidenceInOriginalPost(lastAnalysisResult.predictions);
                
                // 按照新順序顯示：1. 綜合風險評分 2. 可疑項目 3. 詐騙類型
                (async () => {
                    await displayAllAnalysisResults(lastAnalysisResult.predictions, lastPostContent);
                })();
            } else {
                console.log('沒有找到保存的數據，顯示提示信息');
                // 如果沒有分析結果，顯示提示信息
                const contentArea = document.getElementById('fb-analyzer-content');
                if (contentArea) {
                    const messageDiv = document.createElement('div');
                    messageDiv.style.cssText = `
                        padding: 10px;
                        background-color: #fff3cd;
                        color: #856404;
                        border-radius: 4px;
                        margin-bottom: 10px;
                    `;
                    messageDiv.textContent = '尚未進行分析，請先點擊「分析貼文」按鈕';
                    contentArea.appendChild(messageDiv);
                }
            }
        })();
        
        sendResponse({ status: 'success' });
    }
});

// 新增函數：顯示詐騙分析結果標題和按鈕
function displayAnalysisHeader(content) {
    const contentArea = document.getElementById('fb-analyzer-content');
    if (!contentArea) return;

    const section = document.createElement('div');
    section.style.cssText = `
        margin-bottom: 20px;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    `;

    const title = document.createElement('h4');
    title.textContent = '詐騙分析結果';
    title.style.cssText = `
        margin: 0 0 15px 0;
        color: #1877f2;
        font-size: 18px;
        font-weight: bold;
        border-bottom: 2px solid #e9ecef;
        padding-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
    `;

    // 添加複製按鈕
    const copyButton = document.createElement('button');
    copyButton.textContent = '複製分析結果';
    copyButton.style.cssText = `
        background-color: #1877f2;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        transition: background-color 0.2s;
    `;
    copyButton.onmouseover = () => {
        copyButton.style.backgroundColor = '#166fe5';
    };
    copyButton.onmouseout = () => {
        copyButton.style.backgroundColor = '#1877f2';
    };
    copyButton.onclick = async () => {
        const predictions = content.data.results[0].predictions;
        let formattedText = '詐騙分析結果\n\n';
        try {
            let data = lastSuspiciousData;
            if (!data) {
                data = await getSuspiciousData(lastPostContent);
                lastSuspiciousData = data;
                await saveData();
            }
            const riskLevel = calculateRiskLevel(predictions, data);
            formattedText += `風險等級：${getRiskLevelText(riskLevel)}\n`;
            formattedText += `風險描述：${getRiskDescription(riskLevel)}\n\n`;
            const hasSuspiciousLineId = data.line_id_details.some(item => item.result === 1);
            const hasFraudType = predictions.length > 0 && !isNoFraudDetected(predictions);
            const highestUrlLevel = getHighestUrlLevel(data.url_details);
            formattedText += '評分依據：\n';
            formattedText += `• 可疑LINE ID: ${hasSuspiciousLineId ? '有' : '無'}\n`;
            formattedText += `• 詐騙類型: ${hasFraudType ? '有' : '無'}\n`;
            formattedText += `• 最高URL風險等級: ${highestUrlLevel}\n\n`;
            // 2. 可疑項目
            const suspiciousLineIds = data.line_id_details.filter(item => item.result === 1);
            if (suspiciousLineIds.length > 0) {
                formattedText += '📱 可疑LINE ID：\n';
                suspiciousLineIds.forEach(item => {
                    formattedText += `• ${item.id}\n`;
                });
                formattedText += '\n';
            }
            const suspiciousUrls = data.url_details.filter(item => 
                item.status === 1 && (item.level === 'HIGH' || item.level === 'MEDIUM')
            );
            if (suspiciousUrls.length > 0) {
                formattedText += '🌐 可疑URL：\n';
                suspiciousUrls.forEach(item => {
                    formattedText += `• ${item.url} (${item.level}, 詐騙機率: ${(item.scam_probability * 100).toFixed(2)}%)\n`;
                });
                formattedText += '\n';
            }
            if (suspiciousLineIds.length === 0 && suspiciousUrls.length === 0) {
                formattedText += '未偵測到可疑的LINE ID或URL\n\n';
            }
            // 3. 詐騙類型
            formattedText += '⚠️ 詐騙類型分析\n';
            formattedText += '================\n';
            if (isNoFraudDetected(predictions)) {
                formattedText += '未偵測到詐騙類型\n';
            } else {
                predictions.forEach((prediction, index) => {
                    if (!prediction.ref_text) return;
                    formattedText += `詐騙類型：${prediction.ref_text}\n`;
                    formattedText += `可信度：${(prediction.confidence * 100).toFixed(1)}%\n\n`;
                    formattedText += '發現的證據：\n';
                    prediction.evidences.forEach((evidence, i) => {
                        formattedText += `${i + 1}. ${evidence}\n`;
                    });
                    formattedText += '\n';
                });
            }
            await navigator.clipboard.writeText(formattedText);
            const originalText = copyButton.textContent;
            copyButton.textContent = '已複製！';
            copyButton.style.backgroundColor = '#28a745';
            setTimeout(() => {
                copyButton.textContent = originalText;
                copyButton.style.backgroundColor = '#1877f2';
            }, 2000);
        } catch (error) {
            console.error('複製分析結果失敗:', error);
            copyButton.textContent = '複製失敗';
            copyButton.style.backgroundColor = '#dc3545';
            setTimeout(() => {
                copyButton.textContent = '複製分析結果';
                copyButton.style.backgroundColor = '#1877f2';
            }, 2000);
        }
    };
    title.appendChild(copyButton);

    // Create Post Comment button
    // const postCommentButton = document.createElement('button');
    // postCommentButton.textContent = '自動留言分析結果';
    // postCommentButton.id = 'postCommentButton';
    // postCommentButton.style.cssText = `
    //     background-color: #1877f2;
    //     color: white;
    //     border: none;
    //     padding: 6px 12px;
    //     border-radius: 4px;
    //     font-size: 14px;
    //     cursor: pointer;
    //     transition: background-color 0.2s;
    //     margin-left: 8px; 
    // `;
    // postCommentButton.onmouseover = () => {
    //     postCommentButton.style.backgroundColor = '#166fe5';
    // };
    // postCommentButton.onmouseout = () => {
    //     postCommentButton.style.backgroundColor = '#1877f2';
    // };
    // postCommentButton.addEventListener('click', () => {
    //     if (lastAnalysisResult && lastAnalysisResult.predictions) {
    //         const commentText = generateCommentText(lastAnalysisResult.predictions);
    //         postAnalysisToFacebookComment(commentText);
    //         // Optional: Change button text to "Posting..." or disable it
    //         postCommentButton.textContent = '處理中...';
    //         postCommentButton.disabled = true;
    //         setTimeout(() => { // Reset button after a delay
    //             postCommentButton.textContent = '自動留言分析結果';
    //             postCommentButton.disabled = false;
    //         }, 3000); // Reset after 3 seconds
    //     } else {
    //         console.error('No analysis result available to post.');
    //         alert('沒有可用的分析結果來留言。請先執行分析。');
    //     }
    // });
    // title.appendChild(postCommentButton);

    section.appendChild(title);
    contentArea.appendChild(section);
}

// 統一處理所有顯示，確保正確順序
async function displayAllAnalysisResults(predictions, postText) {
    const contentArea = document.getElementById('fb-analyzer-content');
    if (!contentArea) return;
    try {
        // 取得API回傳資料
        const data = await getSuspiciousData(postText);
        lastSuspiciousData = data;
        await saveData();
        // 1. 綜合風險評分
        await displayComprehensiveRiskAssessment(predictions, data);
        // 2. 可疑項目
        await displaySuspiciousItems(data);
        // 3. 詐騙類型
        displayFraudTypes(predictions);
    } catch (error) {
        console.error('取得可疑資料API失敗:', error);
        // fallback: 只顯示詐騙類型
        displayFraudTypes(predictions);
    }
}

// 判斷是否無偵測到詐騙類型
function isNoFraudDetected(predictions) {
    if (!Array.isArray(predictions) || predictions.length === 0) return true;
    // 如果所有 prediction 都沒有 ref_text，視為無偵測到詐騙類型
    if (predictions.every(p => !p.ref_text || p.ref_text === '' || p.ref_text === '無法辨識' || p.ref_text === '未知')) {
        // 也可加強 plain_text 關鍵字判斷
        if (predictions.length === 1) {
            const p = predictions[0];
            if (
                typeof p.plain_text === 'string' &&
                (
                    p.plain_text.includes('沒有符合條件的比對結果') ||
                    p.plain_text.includes('沒有任何候選項的信心分數') ||
                    p.plain_text.includes('都低於') ||
                    p.plain_text.includes('[]')
                )
            ) {
                return true;
            }
        }
        // 沒有 ref_text 也算無偵測到
        return true;
    }
    return false;
}

// 新增：取得可疑資料（LINE ID/URL）
async function getSuspiciousData(postText) {
    // 透過background.js呼叫API
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            action: 'analyzeWithSecondAPI',
            description: postText
        }, (response) => {
            if (response && !response.error) {
                resolve(response);
            } else {
                reject(response && response.error ? response.error : 'API error');
            }
        });
    });
}