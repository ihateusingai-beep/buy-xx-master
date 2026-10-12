# 買××小達人 — 到商場去

將軍澳培智學校 · 中國語文 · SEN 購物短語遊戲

Live: https://ihateusingai-beep.github.io/buy-xx-master/

## 部署

單頁 PWA — `index.html` + `assets/` + `manifest.json` + `sw.js`。
所有依賴同源，學校 wifi 唔穩亦可離線使用（service worker 預快取全站）。

## 結構

```
buy-xx-master/
├── index.html       # 主程式（單檔 HTML/JS/CSS）
├── manifest.json    # PWA manifest（standalone、zh-HK）
├── sw.js            # Service Worker（cache-first 圖、network-first HTML）
├── assets/
│   ├── bag.jpg .. ruler.jpg   # 9 個商品圖（文具 4 + 商場 5）
│   ├── puichi-logo.png         # 學校 logo（288×288）
│   └── icon-192.png / icon-512.png  # PWA 啟動圖示
└── README.md
```

## 玩法

8 個模式：🚀 一條龍（5 關經典）／🎮 Retro 一條龍（3 關 arcade）／
聽圖選／店員任務／啱定錯／砌短語／要定唔要／接貨小店員／像素店員／商場走線。

難度 3 級（初 2 選 / 中 3 選 / 高 4 選）、身份 8 個、題數 3-8 可調。
