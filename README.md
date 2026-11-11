# 2026 Planner · 手账拼贴计划本

Web 前端课程项目。一本摊在桌面上的 2026 年计划本：从封面翻开，先看一整年，再选一个月，最后在某个日期格子里写下当天要做的事。

## 页面结构（层级递进）

| 层级 | 文件 | 内容 |
| --- | --- | --- |
| 第 1 层：封面 | `index.html` | 横线笔记本封面、年计划清单、贴纸拼贴；点击本子进入 |
| 第 2 层：月份总览 | `months.html` | 十二个月份卡片，显示每月已有计划条数 |
| 第 3 层：月度日历 | `calendar.html?month=1` | 左页日历网格，右页 Weekly Reminders 便签 |
| 第 4 层：日计划 | 页内弹窗 | 点日期格子，写当天计划、贴照片 |
| 附加 | `about.html` | 关于、储存说明、技术说明 |

## 功能

- **日历**：2026 年 12 个月，周日开头，可切上/下月、回到本月；有计划的日期显示小圆点与事件标签
- **日计划**：点日期格子弹出当天面板，可添加、删除计划，支持贴一张照片（本地读取，不上传）
- **周提醒**：右页七张彩色便签，输入即保存
- **桌面宠物**：小娃娃常驻内页，可拖到任意位置（位置记住）；点击会跳一下，旁边弹出贴纸气泡对话，中英文都能聊；可在气泡里"换形象"上传自己的图片
- **全屏按钮**：一键进入全屏，隐藏浏览器控件，沉浸式查看计划本
- **本地存储**：所有内容只保存在当前浏览器

## 运行方式

在项目目录下执行：

```
python -m http.server 8000
```

访问 http://localhost:8000/ 。attach 到 GitHub Pages 也可直接访问。

## 技术实现

- HTML5 语义化结构（`header` / `main` / `section` / `nav` / `footer` / `figure`）
- 唯一外链样式表 `style.css`，Flex 布局为主，少量 Grid 用于日历
- 原生 JavaScript（`site.js`），无框架、无构建工具
- `requestFullscreen` 全屏、`pointer` 事件拖拽、`FileReader` 读取本地图片
- 存储键：`planner-events` / `planner-reminders` / `planner-pet-pos` / `planner-pet-img` / `planner-chat`

## 数据存储

| Key | 内容 |
| --- | --- |
| `planner-events` | 每日计划（日期、内容、照片 base64） |
| `planner-reminders` | 每周提醒便签 |
| `planner-pet-pos` | 桌宠位置 |
| `planner-pet-img` | 自定义桌宠形象 |
| `planner-chat` | 桌宠对话记录（最近 60 条） |

## 说明

- 桌宠对话使用本地规则引擎（关键词匹配 + 兜底回复），不依赖网络接口；如后续接入真实接口，只需替换 `site.js` 中的 `pickReply` 函数
- 照片与自定义形象以 base64 存入 localStorage，总容量约 5MB，建议使用 1MB 以内图片
- 本项目为课程作业，仅用于学习与成果展示
