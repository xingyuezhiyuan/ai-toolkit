# AI Toolkit 本地化（中文化）

AI Toolkit UI 的中文语言支持上下文：在不破坏上游同步能力的前提下，让界面可一键在中英文之间切换。本术语表约束所有翻译产物的用语。

## Language

**翻译覆盖层 (Translation Overlay)**:
不修改业务组件文案、在界面渲染之后按词典替换显示文字的语言层。与上游代码解耦，是跟随上游更新策略的前提。
_Avoid_: i18n 改造、语言插件（它不是标准 i18n 框架的接线，而是一层替换）

**词典 (Dictionary)**:
英文原文 → 中文译文的一对一映射表，翻译覆盖层的唯一数据源。可增量修补，随上游更新生长。
_Avoid_: 语言包、文案表

**核心术语表 (Core Glossary)**:
约束所有词典条目的译法基准，规定每个领域术语保留英文还是译为固定中文。术语表调整后可批量重刷词典。
_Avoid_: 命名规范（它只管词的译法，不管代码命名）

**界面文案 (UI Copy)**:
前端组件渲染的静态文字：菜单、按钮、表单标签与说明、占位符、前端报错与弹窗提示。属于翻译范围。
_Avoid_: 与"日志""用户数据"混称"界面文字"

**日志流 (Log Stream)**:
Python 训练后端进程输出的运行日志。不翻译，保持英文原样，以便检索报错关键字、对照官方文档与社区讨论。
_Avoid_: 控制台输出

**用户数据 (User Data)**:
数据集名、任务名、文件路径、prompt 示例、YAML 配置内容等由用户持有或影响训练结果的文字。绝不翻译。
_Avoid_: 动态文本（那是匹配策略概念，不是数据类别）

**内嵌帮助文档 (Embedded Docs)**:
UI 内置的英文教程长文（docs.tsx）。二期范围：本期保持英文。
_Avoid_: 文档系统

**语言偏好 (Language Preference)**:
用户选定的界面语言（en / zh）。真源存储于服务器端设置；浏览器本地缓存一份镜像用于首帧免闪烁。
_Avoid_: 语言设置（那是 Settings 页上的控件名）

**一键切换 (Instant Toggle)**:
在 Settings 页点选语言分段控件后全界面即时生效、零刷新、无需再点保存的交互承诺。
_Avoid_: 热切换

**首访语言推断 (First-visit Language Detection)**:
仅当不存在已保存的语言偏好时，按浏览器语言决定初始界面语言；用户手动切换过一次后，保存值终身优先。
_Avoid_: 自动翻译

**漏翻收集器 (Miss Collector)**:
记录匹配失败的非数据文本的机制。是词典的补货通道：上游更新带来的新文案靠它渐进吸收。
_Avoid_: 错误日志

## 核心术语表（S2 风格 · 词典译法基准）

原则：**模型名/格式名/社区惯用英文术语保留原文；纯 UI 操作词译为中文**。

### 保留英文（不翻译）

`LoRA` `LoKr` `prompt` `checkpoint` `epoch` `step(s)` `seed` `lora_alpha` `rank` `dropout` `network`（本工具语境下指 LoRA/LoKr 挂载结构）
`FLUX` `SDXL` `SD 1.5` `Wan` `Qwen` 等一切模型名
`HF` `Hugging Face` `CUDA` `GPU` `VRAM` `safetensors` `yaml` `json`
`RunPod` `Modal` `Ostris Cloud` 等服务名

### 固定中译

| 英文 | 中文 |
|---|---|
| Dataset | 数据集 |
| Sample / Samples | 样例 |
| Sampler | 采样器 |
| Scheduler | 调度器 |
| Training | 训练 |
| Save | 保存 |
| Start / Stop | 启动 / 停止 |
| Delete | 删除 |
| Upload / Download | 上传 / 下载 |
| Settings | 设置 |
| Dashboard | 概览 |
| Jobs | 任务 |
| Generate | 生成 |
| Cancel / Confirm | 取消 / 确认 |
| Warning / Error | 警告 / 错误 |
| Loading... / Saving... | 加载中… / 保存中… |
| Trigger word | 触发词 |
| Resolution | 分辨率 |
| Batch size | 批大小 |
| Learning rate | 学习率 |
| Caption | 标注 |
| Folder / Path | 文件夹 / 路径 |
| Preview | 预览 |
| Log(s) | 日志 |
| Loss | 损失 |
| Output | 输出 |

## Flagged ambiguities

- **"界面"一词**：曾同时指 UI 页面和"界面上的所有可见文字"。已决议：翻译对象 = 界面文案 + 前端报错提示；日志流、用户数据、内嵌帮助文档（二期）不在其列。
- **sample 的双重含义**：`Sample`（训练样例图，译为「样例」）与 `Sampler`（采样算法组件，译为「采样器」）在中文里易混。已决议：Sample→样例、Sampler→采样器，词典必须遵守。
- **network 不是"网络"**：在本工具中指 LoRA/LoKr 挂载结构（`network.type`），译为「网络」会引起误解，保留英文。

## 示例对话

> **Dev**：上游更新后任务详情页冒出英文的 "Delete 3 samples?"，日志里的 "Sample every 500 steps" 也还是英文——都要翻吗？
> **领域负责人**：前者是界面文案，让漏翻收集器抓到后补一条模板词典："delete {num} sample(s)?" → 「删除 {num} 个样例？」。后者是日志流，永远不动——工程师搜报错要关键字。
> **Dev**：用户任务名叫 "Flux 甜妹"，确认弹窗里会带进来。
> **领域负责人**：那是用户数据，作为占位符原样回填，词典只翻句子的壳。

## Boundaries（范围决议）

- 翻译范围 = 界面文案（含动态模板句）+ 前端报错与弹窗提示。
- 排除 = 日志流、用户数据、内嵌帮助文档（移入二期）。
- 上游同步策略：持续跟随 ostris/ai-toolkit 更新，采用覆盖层而非源码级改造（见 ADR-0001、ADR-0002）。
