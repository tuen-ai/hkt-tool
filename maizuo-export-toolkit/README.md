# 麥座導出工具包

同一個安裝頁，兩個書籤工具（唔合併成一條巨型書籤）：

1. **正式單匯出**（Project 1）— 關閉／正式單列表匯出 Excel，可選計算票數
2. **座位報表導出工具** — 座位／BI＋PMS 場次篩選同導出（信息 xlsx／狀態 PDF）

## 安裝

線上頁：https://tuen-ai.github.io/hkt-tool/maizuo-export-toolkit.html

1. 打開安裝頁，將「正式單匯出」同「座位報表導出工具」兩個藍掣分別**拖入書籤列**
2. 書籤係短 loader（約 500 字元），撳嘅時候先由 GitHub Pages 載入最新 `.js`
3. （或撳「複製書籤碼」手動新增／覆蓋；仍唔得就用「複製 Console 版」）

> 舊版把成段腳本塞入 `javascript:` URL（>100KB），Chrome 拖曳會靜默失敗。唔好再裝舊嘅巨型書籤。

## 使用

- 必須先登入 `https://maizuo.imaitix.com` 再撳書籤
- 需要能訪問 `tuen-ai.github.io`（loader 拉腳本）；公司網擋 GitHub 時用 Console 版
- 更新版本時請**覆蓋舊書籤**（短 loader 本身很少變；邏輯喺 Pages 上嘅 `.js`）

## 檔案

- `install.html` — 主安裝頁
- `formal-order-export.js` / `seat-export.js` — Pages 託管、書籤 loader 載入
- `*-console.js` — Console 貼上備用
- `*.bookmarklet.txt` — 短 loader 原文
