# HKT tools - MZ Seat Detail Report


## 使用

1. 打開 [excel-picker.html](./excel-picker.html)（或本 repo 的 GitHub Pages 首頁）
2. 拖入 `.xlsx`
3. 預設會套用「改後檔」規則（去未规划、去三個鎖座欄、統計表縮簡）；可自行改
4. ⑥ 值替換表已預填常用英文；可改、可存 preset
5. 匯出前會彈總結，核對通過先下載


## 檔案

| 檔案 | 說明 |
|------|------|
| `index.html` / `excel-picker.html` | 工具本體（同一份） |
| `核對機制說明.md` | 匯出前核對點運作 |
| `diff-findings.md` | 改前／改後樣本對照研究 |


## 建置說明

GitHub Pages 提供嘅係**混淆／壓縮後**嘅單檔（`index.html` / `excel-picker.html`），方便阻吓隨便 View Source／F12；**唔係**真正保密。可維護嘅清晰原始碼存放喺私有維護位置，**唔會** commit 清晰源碼入呢個公開 repo。

瀏覽器阻吓（可繞過）：關閉右鍵、攔截 F12／Ctrl+Shift+I·J·C／Ctrl+U、短暫 debugger 偵測＋粵語提示。



## 版本（頁底）

頁底顯示 **版本** 同 **更新日期**（例：`版本0.1`、`更新日期：20261017`）。

維護端單一來源：`build/version.json`。每次用 `node build/build-obf.js` 做公開 rebuild／deploy 會自動：

1. 版本 **+0.1**（0.1 → 0.2 → 0.3 …）
2. 更新日期改為當日 `YYYYMMDD`（Asia/Hong_Kong）

清晰源碼 rebuild（`node build/build.js`）唔會 bump。若要重出同一版，用 `node build/build-obf.js --no-bump`。


## 開啟次數（全球合計）

頁面右上角會顯示全球合計開啟次數（同一瀏覽器分頁 session 內重整唔會重複加 1）。

- **後端：** [Abacus](https://jasoncameron.dev/abacus/)（CountAPI 相容、免註冊；唔記錄 IP）
- **命名空間／鍵：** `hkt-tool` / `pageviews`
- **查目前數字（唔加 1）：**  
  https://abacus.jasoncameron.dev/get/hkt-tool/pageviews  
  回傳例：`{"value":123}`
- **手動加 1（測試用）：**  
  https://abacus.jasoncameron.dev/hit/hkt-tool/pageviews

> 備註：舊 CountAPI（`api.countapi.xyz`）同 CounterAPI v1 已不可用；CounterAPI v2 要註冊 API key，故改用 Abacus。


## 注意

- 只支援現代瀏覽器（Chrome／Edge 較穩）
- 大檔（幾十萬行）可能較慢
- Preset 同替換表存在該瀏覽器的 localStorage；可匯出 JSON 做備份
