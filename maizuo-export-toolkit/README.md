# 麥座導出工具包

同一個安裝頁，兩個書籤工具（唔合併成一條巨型書籤）：

1. **正式單匯出**（Project 1）— 關閉／正式單列表匯出 Excel，可選計算票數
2. **座位報表導出工具** — 座位／BI 報表關鍵字篩選同導出

## 安裝

1. 用瀏覽器打開本資料夾嘅 `install.html`
2. 將「正式單匯出」同「座位報表導出工具」兩個藍掣分別拖入書籤列
3. （或撳「複製書籤碼」手動新增／覆蓋書籤）

## 使用

- 必須先登入 `https://maizuo.imaitix.com`
- 更新版本時請**覆蓋舊書籤**，否則會繼續跑舊碼
- Console 版：開 DevTools → Console，貼上對應「複製 Console 版」內容後 Enter

## 檔案

- `install.html` — 主安裝頁（自包含）
- `formal-order-export.js` / `formal-order-export-console.js` / `formal-order-export.bookmarklet.txt`
- `seat-export.js` / `seat-export-console.js` / `seat-export.bookmarklet.txt`
