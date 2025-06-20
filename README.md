# 📘 Facebook 貼文分析器（Facebook Post Analyzer）

一款專為 Facebook 設計的 Chrome 擴充功能，能自動分析貼文與留言內容，辨識詐騙風險並提供詳細智能分析結果。

---

## 📖 專案簡介（Overview / Description）

本擴充功能旨在協助用戶快速辨識 Facebook 貼文中的潛在詐騙風險。
透過 RAG（Retrieval-Augmented Generation）技術與多重 API 分析，能自動提取貼文與留言、辨識可疑 LINE ID、URL 及詐騙類型，並以互動式面板與高亮標記方式呈現分析依據，提升社群安全與用戶警覺。

---

## 🚀 功能特色（Features）

- 📝 一鍵自動提取 Facebook 貼文與留言內容
- 🖼️ 自動下載貼文圖片（支援多圖批次下載）(可選)
- 🤖 RAG 技術與 LLM 智能詐騙分析
- 🔍 高亮標記貼文內可疑證據(可選)
- 📊 互動式右側分析面板，顯示風險燈號、可疑項目、詐騙類型
- 📋 一鍵複製完整分析結果
- 🎯 智能辨識多種詐騙手法（如假投資、假交友、釣魚連結等）
- 📈 顯示 AI 分析可信度


---

## DEMO

![Demo](docs/@demo_2025_06_20.gif)

 右側分析面板顯示風險等級、複製分析結果按鈕等功能示意。

---

## 🛠️ 安裝方式（Installation / Getting Started）

1. 下載本專案並解壓縮
2. 開啟 Chrome，進入 `chrome://extensions/`
3. 啟用右上角「開發人員模式」
4. 點擊「載入未封裝項目」，選擇解壓縮後的資料夾
5. 安裝完成後，於 Facebook 貼文頁面點擊擴充功能圖示即可使用

---

## ⚙️ 使用方式（Usage）

1. 於 Facebook 貼文頁面點擊擴充功能圖示
2. 按下「分析貼文」開始自動分析
3. 分析完成後，右側會顯示互動式分析面板
   - 可點擊「複製分析結果」快速複製
   - 點擊高亮文字可查看證據說明(可選)
4. 可隨時點擊「檢視結果」回顯上次分析內容

---

## 📁 專案結構（Project Structure）

```
/manifest.json         // 擴充功能設定檔
/background.js         // 背景 API 與下載、分析邏輯
/content.js            // 注入 Facebook 頁面的主分析腳本
/popup.html            // 擴充功能彈出視窗 UI
/popup.js              // 彈出視窗互動邏輯
/mockdata.json         // 測試用假資料（開發用）
/icon.png              // 擴充功能圖示
/README.md             // 專案說明文件
```

---

## 🔒 權限說明（Permissions）

- `scripting`：注入分析腳本到 Facebook 頁面
- `downloads`：自動下載貼文圖片
- `activeTab`：取得當前分頁資訊
- `storage`：本地儲存分析結果與貼文內容
- `host_permissions: https://www.facebook.com/*`：僅作用於 Facebook 網域

---

## 🧪 開發與建置（Development / Build）

- 本專案為純前端 Chrome Extension，無需額外打包工具
- 若需測試 API，可修改 `background.js` 內 API 端點或使用 `mockdata.json`
- 建議於 Chrome 開發人員模式下進行除錯

---

## 📌 注意事項（Notes / Known Issues）

- 僅支援新版 Facebook 網頁版（桌面瀏覽器）
- 需保持網路連線以取得即時分析結果
- 若 Facebook 介面大幅改版，部分選取器可能需調整
- 目前僅支援 Chrome，其他瀏覽器未經完整測試


---

## 📜 授權條款（License）

MIT License

---

## 🙋‍♂️ 聯絡與貢獻（Contact & Contributing）

- 歡迎提交 Pull Request 或 Issue 回報問題
- 請於提交前確保程式碼有適當註解與測試
- 聯絡方式：請於 GitHub Issue 留言或 Pull Request

---

如需更詳細的技術說明或有其他需求，歡迎隨時聯絡或參與貢獻！ 