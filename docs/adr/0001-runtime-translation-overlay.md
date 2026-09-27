# 用运行时翻译覆盖层实现中文化，而非源码级 i18n 改造

本仓库是 ostris/ai-toolkit 的活跃跟踪克隆（Manager 每次启动尝试同步上游，检测到本地改动即跳过更新）。为了让中文界面支持不破坏上游更新通道，我们决定不改写任何业务组件的硬编码文案，而是在 layout 挂载一个「翻译覆盖层」，渲染后按词典对 DOM 文本与 placeholder/title 属性做 EN→ZH 替换；词典采用两级匹配（精确 + 数字归一化模板），用户数据经占位符原样回填、天然不被翻译。

## Considered Options

- **源码级 i18n 改造（t() key 化，路线 X）**：翻译质量上限最高，但会污染 100+ 个 UI 文件，上游更新实质报废，此后官方新模型支持/修复全靠手工合并。因上游迭代频率极高（每周级）而否决。
- **混合路线（覆盖层 + 对拆碎长句做少量源码包裹，路线 Z）**：任何一处源码包裹都会重新引入合并冲突面，且"哪几处值得包"的判断随上游变化漂移。本期不采用；若覆盖层上线后拆句瑕疵集中爆发，可再评估。

## Consequences

- 被 JSX 拆碎的长句翻译质量有上限，靠漏翻收集器与词典迭代渐进修复，而非一次做对。
- 上游补丁面实测为 6 处（均已在 feat/ui-zh-i18n 提交中隔离为最小 diff）：`ui/src/app/layout.tsx`（挂载壳一行）、`ui/src/app/settings/page.tsx`（LanguageSwitch）、`ui/src/app/api/settings/route.ts`（partial-safe POST + LANGUAGE 白名单，顺带修复了缺失字段被写 undefined 清空配置的隐患）、`ui/package.json` + `ui/package-lock.json`（vitest/jsdom devDep、test:i18n 脚本）、根 `.gitignore`（tools/i18n 产物）。超出此清单的源码改动需新 ADR。
- 一键切换 = 换词典，纯客户端行为，故可做到零刷新即时生效（I2 交互）。
