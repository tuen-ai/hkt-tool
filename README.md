# HKT Tool · Excel 揀欄／揀行工具

離線單檔 HTML：拖入麥座「座位信息」xlsx（或其他 Excel），即場揀欄、過濾、調次序、中英字眼替換，匯出前自動逐格核對原檔。

## 使用

1. 打開 [excel-picker.html](./excel-picker.html)（或本 repo 的 GitHub Pages 首頁）
2. 拖入 `.xlsx`
3. 預設會套用「改後檔」規則（去未规划、去三個鎖座欄、統計表縮簡）；可自行改
4. ⑥ 值替換表已預填常用英文；可改、可存 preset
5. 匯出前會彈總結，核對通過先下載

全部喺瀏覽器本地處理，**唔會上載去任何伺服器**。

## 檔案

| 檔案 | 說明 |
|------|------|
| `index.html` / `excel-picker.html` | 工具本體（同一份） |
| `核對機制說明.md` | 匯出前核對點運作 |
| `diff-findings.md` | 改前／改後樣本對照研究 |

## 注意

- 只支援現代瀏覽器（Chrome／Edge 較穩）
- 大檔（幾十萬行）可能較慢
- Preset 同替換表存在該瀏覽器的 localStorage；可匯出 JSON 做備份
