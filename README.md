# 篮坛造星局

## 启动

```bash
python -m http.server 8000 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8000/index.html`。不要直接使用 `file://` 打开，
部分浏览器会限制本地字体和脚本加载。

## 内容

- 入口：`index.html`
- 本地玩家资料：`js/local_player_profile.js`
- 游戏逻辑与数据：`js/`
- 原创卡通素材：`media/generated/`

运行时使用同源静态文件和浏览器 IndexedDB，不需要外部账号、云存储或上传服务。
可以运行 `node scripts/check_inline_scripts.js` 检查页面内联脚本和本地模块语法。

## 服务边界

游戏创建和生涯模拟均在本地运行。社区浏览、云端发帖和广告任务未接入；海报通过
浏览器直接保存到本地，存档保存在当前浏览器的 IndexedDB 中。

# myplayer
