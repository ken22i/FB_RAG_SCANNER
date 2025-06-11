const API_BASE_URL = 'http://192.168.70.88:8000/api/v1/rag';
const AUTH_HEADER = 'Basic ' + btoa('user:systemadmin!23');

const referenceData = {
    "level1": [
        {
            "sid": "ref_1",
            "text": "假投資詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_2",
            "text": "假交友(投資詐財)詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_3",
            "text": "釣魚簡訊(惡意連結)詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_4",
            "text": "假中獎通知詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_5",
            "text": "假檢警詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_6",
            "text": "假廣告詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_7",
            "text": "騙取金融帳戶(卡片)詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_8",
            "text": "虛擬遊戲詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_9",
            "text": "網路購物詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_10",
            "text": "假買家騙賣家詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_11",
            "text": "假求職詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_12",
            "text": "假交友(徵婚詐財)詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_13",
            "text": "假借銀行貸款詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_14",
            "text": "色情應召詐財詐騙",
            "metadata": {"type": "test", "project": "test1"}
        },
        {
            "sid": "ref_15",
            "text": "猜猜我是誰詐騙",
            "metadata": {"type": "test", "project": "test1"}
        }
    ]
};

async function createRAGTask(postText) {
    console.log('🚀 開始創建 RAG 任務');
    const requestData = {
        "project_id": "test1",
        // "scenario": {
        //     "direction": "both",
        //     "role_desc": "你是RAG助手，負責比較文本相似度",
        //     "reference_desc": "Reference 為參考文本，用於比對",
        //     "input_desc": "Input 為輸入文本，需要與參考文本進行比對",
        //     "rag_k": 3,
        //     "rag_k_forward": 3,
        //     "rag_k_reverse": 3,
        //     "cof_threshold": 0.5,
        //     "scoring_rule": "請根據文本相似度給出信心分數，並標記出相似的文本片段",
        //     "llm_name": "openai"
        // },
        "input_data": {
            "level1": [
                {
                    "sid": "input_1",
                    "text": postText,
                    "metadata": {"type": "test", "project": "test1"}
                }
            ]
        },
        "reference_data": referenceData
    };

    console.log('📤 發送 API 請求:', API_BASE_URL);
    const response = await fetch(API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': AUTH_HEADER
        },
        body: JSON.stringify(requestData)
    });

    if (!response.ok) {
        console.error('❌ API 請求失敗:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📥 API 響應:', data);
    return data;
}

async function getRAGResult(jobId) {
    console.log(`📥 獲取 RAG 任務結果 (job_id: ${jobId})`);
    const response = await fetch(`${API_BASE_URL}/${jobId}/result`, {
        method: 'GET',
        headers: {
            'Authorization': AUTH_HEADER
        }
    });

    if (!response.ok) {
        console.error('❌ 獲取結果失敗:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📊 RAG 任務結果:', data);
    return data;
}

async function checkRAGStatus(jobId) {
    console.log(`🔄 檢查 RAG 任務狀態 (job_id: ${jobId})`);
    const response = await fetch(`${API_BASE_URL}/${jobId}/status`, {
        method: 'GET',
        headers: {
            'Authorization': AUTH_HEADER
        }
    });

    if (!response.ok) {
        console.error('❌ 檢查狀態失敗:', response.status, response.statusText);
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('📊 任務狀態:', data);
    return data;
}

// Handle messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 收到消息:', message.action);
    
    if (message.action === 'createRAGTask') {
        createRAGTask(message.postText)
            .then(response => {
                console.log('✅ 創建任務成功:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('❌ 創建任務失敗:', error);
                sendResponse({ error: error.message });
            });
        return true;
    }
    else if (message.action === 'getRAGResult') {
        getRAGResult(message.jobId)
            .then(response => {
                console.log('✅ 獲取結果成功:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('❌ 獲取結果失敗:', error);
                sendResponse({ error: error.message });
            });
        return true;
    }
    else if (message.action === 'checkRAGStatus') {
        checkRAGStatus(message.jobId)
            .then(response => {
                console.log('✅ 檢查狀態成功:', response);
                sendResponse(response);
            })
            .catch(error => {
                console.error('❌ 檢查狀態失敗:', error);
                sendResponse({ error: error.message });
            });
        return true;
    }
    else if (message.action === 'download') {
        console.log('💾 下載文件:', message.filename);
        chrome.downloads.download({
            url: 'data:text/plain;charset=utf-8,' + encodeURIComponent(message.content),
            filename: message.filename,
            saveAs: false
        });
        sendResponse({ status: 'success' });
    }
    else if (message.action === 'download_image') {
        console.log('🖼️ 下載圖片:', message.filename);
        chrome.downloads.download({
            url: message.url,
            filename: message.filename,
            saveAs: false
        });
        sendResponse({ status: 'success' });
    }
});
