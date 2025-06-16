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
        displayArea.remove(); // 如果存在，先移除舊的
    }

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
    return contentArea;
}

function highlightEvidenceInOriginalPost(predictions) {
    // 找到原始貼文元素
    const postElements = document.querySelectorAll('div[data-ad-rendering-role="story_message"] div[dir="auto"]');
    if (!postElements.length) {
        console.log('找不到原始貼文元素');
        return;
    }

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
        postElements.forEach(element => {
            const text = element.textContent;
            elementTexts.push({
                element: element,
                text: text,
                startIndex: combinedText.length,
                endIndex: combinedText.length + text.length,
                originalHTML: element.innerHTML
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

                // 在每個受影響的元素中進行高亮
                affectedElements.forEach(item => {
                    const elementStart = item.startIndex;
                    const elementEnd = item.endIndex;
                    const element = item.element;

                    // 計算在此元素中的證據範圍
                    const localStart = Math.max(0, evidenceStart - elementStart);
                    const localEnd = Math.min(element.textContent.length, evidenceEnd - elementStart);

                    // 獲取要高亮的文本
                    const textToHighlight = element.textContent.substring(localStart, localEnd);
                    console.log('要高亮的文本:', textToHighlight);

                    // 創建容器元素
                    const container = document.createElement('span');
                    container.style.cssText = `
                        position: relative;
                        display: inline-block;
                    `;

                    // 創建高亮元素
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

                    // 創建提示框
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
                    tooltip.textContent = `詐騙手法: ${refText}`;

                    // 將高亮元素和提示框添加到容器中
                    container.appendChild(highlightSpan);
                    container.appendChild(tooltip);

                    // 替換原始文本中的證據部分
                    const escapedText = textToHighlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const regex = new RegExp(escapedText, 'g');
                    const newHTML = element.innerHTML.replace(regex, container.outerHTML);
                    
                    // 檢查替換是否成功
                    if (newHTML !== element.innerHTML) {
                        console.log('成功替換文本');
                        element.innerHTML = newHTML;
                    } else {
                        console.log('替換失敗，嘗試使用原始文本');
                        // 如果替換失敗，嘗試使用原始文本
                        const originalText = element.textContent;
                        const originalRegex = new RegExp(originalText.substring(localStart, localEnd).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
                        const fallbackHTML = element.innerHTML.replace(originalRegex, container.outerHTML);
                        if (fallbackHTML !== element.innerHTML) {
                            console.log('使用原始文本替換成功');
                            element.innerHTML = fallbackHTML;
                        } else {
                            console.log('所有替換嘗試都失敗');
                        }
                    }
                });
            } else {
                console.log('未找到匹配的文本:', normalizedEvidence);
            }
        });
    });

    // 在分析完成後點擊關閉按鈕
    setTimeout(() => {
        const closeButton = document.querySelector('div[aria-label="關閉"]');
        if (closeButton) {
            console.log('找到關閉按鈕，準備點擊');
            closeButton.click();
        } else {
            console.log('未找到關閉按鈕');
        }
    }, 1000); // 延遲1秒後點擊，確保分析完成
}

function updateDisplay(content, isRAGResult = false) {
    const contentArea = document.getElementById('fb-analyzer-content');
    if (!contentArea) return;

    const section = document.createElement('div');
    section.style.cssText = `
        margin-bottom: 20px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 4px;
    `;

    const title = document.createElement('h4');
    title.textContent = isRAGResult ? 'RAG 分析結果' : '貼文內容';
    title.style.cssText = `
        margin: 0 0 10px 0;
        color: #1877f2;
    `;
    section.appendChild(title);

    const contentDiv = document.createElement('div');
    contentDiv.style.cssText = `
        white-space: pre-wrap;
        word-wrap: break-word;
        font-size: 14px;
        line-height: 1.5;
    `;
    
    if (isRAGResult) {
        // 顯示完整的 JSON
        contentDiv.textContent = JSON.stringify(content, null, 2);
        section.appendChild(contentDiv);

        // 在原始貼文中高亮顯示證據
        const predictions = content.data.results[0].predictions;
        console.log('開始處理預測結果:', predictions);
        highlightEvidenceInOriginalPost(predictions);
    } else {
        contentDiv.textContent = content;
        section.appendChild(contentDiv);
    }
    
    contentArea.appendChild(section);
}

function extractPostAndComments(downloadPath) {
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
    updateDisplay(content);

    // 創建RAG任務並獲取結果
    (async () => {
        try {
            console.log('🚀 開始創建 RAG 任務');
            // 創建RAG任務
            const jobId = await createRAGTask(post);
            console.log('📝 已創建 RAG 任務，job_id:', jobId);

            // 等待任務完成並獲取結果
            const result = await waitForRAGCompletion(jobId);
            console.log('✨ RAG 任務處理完成並獲取結果');

            // 顯示 RAG 分析結果
            updateDisplay(result, true);
        } catch (error) {
            console.error('❌ RAG 處理過程發生錯誤:', error);
            // 顯示錯誤信息
            const contentArea = document.getElementById('fb-analyzer-content');
            if (contentArea) {
                const errorDiv = document.createElement('div');
                errorDiv.style.cssText = `
                    background-color: #ffd700;
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

function addAnalysisButtonsToPosts() {
    // 找到所有貼文容器
    const postContainers = document.querySelectorAll('div[data-ad-rendering-role="story_message"]');
    
    postContainers.forEach(container => {
        // 檢查是否已經添加過按鈕
        if (container.querySelector('.fb-analyzer-buttons')) {
            return;
        }

        // 創建按鈕容器
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'fb-analyzer-buttons';
        buttonContainer.style.cssText = `
            display: flex;
            gap: 10px;
            margin: 10px 0;
            padding: 5px;
        `;

        // 創建分析貼文按鈕
        const analyzeButton = document.createElement('button');
        analyzeButton.textContent = '分析貼文';
        analyzeButton.style.cssText = `
            background-color: #1877f2;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        analyzeButton.onclick = async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 點擊"查看更多"按鈕
            const moreButtons = container.querySelectorAll('div[role="button"]');
            let foundMoreButton = false;
            for (const button of moreButtons) {
                if (button.textContent.includes('查看更多')) {
                    console.log('找到"查看更多"按鈕，準備點擊');
                    button.click();
                    foundMoreButton = true;
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    break;
                }
            }

            if (!foundMoreButton) {
                console.log('未找到"查看更多"按鈕');
            }

            // 先點擊留言按鈕
            console.log('尋找留言按鈕...');
            const commentButton = container.querySelector('div[aria-label="留言"][role="button"]');
            if (commentButton) {
                console.log('找到留言按鈕，準備點擊');
                commentButton.click();
                await new Promise(resolve => setTimeout(resolve, 1000));
            } else {
                console.log('未找到留言按鈕');
            }

            // 等待並嘗試找到展開按鈕
            console.log('開始尋找展開按鈕...');
            let expandButton = null;
            let attempts = 0;
            const maxAttempts = 5;

            while (!expandButton && attempts < maxAttempts) {
                attempts++;
                console.log(`嘗試第 ${attempts} 次尋找展開按鈕...`);

                // 在整個容器中尋找展開按鈕
                const allButtons = container.querySelectorAll('div[role="none"][data-visualcompletion="ignore"]');
                for (const button of allButtons) {
                    const style = window.getComputedStyle(button);
                    if (style.borderRadius === '4px' && button.offsetHeight > 0) {
                        console.log('找到可能的展開按鈕:', button);
                        expandButton = button;
                        break;
                    }
                }

                if (!expandButton) {
                    console.log('未找到按鈕，等待後重試...');
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (expandButton) {
                console.log('找到展開按鈕，準備點擊');
                try {
                    // 嘗試多種點擊方式
                    expandButton.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 如果第一次點擊不成功，嘗試使用 MouseEvent
                    const clickEvent = new MouseEvent('click', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    });
                    expandButton.dispatchEvent(clickEvent);
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // 如果還是不成功，嘗試使用 mousedown 和 mouseup 事件
                    expandButton.dispatchEvent(new MouseEvent('mousedown', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    }));
                    await new Promise(resolve => setTimeout(resolve, 100));
                    expandButton.dispatchEvent(new MouseEvent('mouseup', {
                        view: window,
                        bubbles: true,
                        cancelable: true
                    }));
                } catch (error) {
                    console.error('點擊按鈕時發生錯誤:', error);
                }
            } else {
                console.log('在多次嘗試後仍未找到展開按鈕');
            }

            // 執行分析
            const downloadPath = generateDownloadPath();
            extractPostAndComments(downloadPath);
        };

        // 創建檢視結果按鈕
        const viewResultsButton = document.createElement('button');
        viewResultsButton.textContent = '檢視結果';
        viewResultsButton.style.cssText = `
            background-color: #42b72a;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        viewResultsButton.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            createDisplayArea();
        };

        // 添加按鈕到容器
        buttonContainer.appendChild(analyzeButton);
        buttonContainer.appendChild(viewResultsButton);

        // 將按鈕容器添加到貼文容器中
        const postContent = container.querySelector('div[dir="auto"]');
        if (postContent) {
            postContent.parentNode.insertBefore(buttonContainer, postContent.nextSibling);
        }
    });
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

// 監聽來自 popup.js 的指令
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'extract') {
        // 添加分析按鈕到所有貼文
        addAnalysisButtonsToPosts();
        sendResponse({ status: 'success' });
    }
});

// 監聽頁面變化，動態添加按鈕
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            addAnalysisButtonsToPosts();
        }
    });
});

// 開始觀察頁面變化
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// 初始添加按鈕
addAnalysisButtonsToPosts();