# 经理模式审计问题修正

- 状态：待开发
- 优先级：P1
- 范围：仅经理模式及其验证脚本
- 目标：修正当前经理模式已复现的模拟、存档兼容、轮换反馈和操作入口问题，同时继续保持与个人球员模式完全隔离。

## 背景

当前经理模式的基础纵向切片和既有回归均可运行，但专项审计发现，多项行为没有被 `scripts/validate_manager_mode.js` 覆盖。现有自动化全部通过并不代表下列问题不存在。

不得修改个人模式的业务逻辑、状态或存档；不得把经理代码迁回 `index.html`。

## 已确认问题

### P1：季后赛主场顺序错误

- 位置：`js/manager/engine.js` 的 `simulateSeriesGame`。
- 当前表达式 `series.games.length % 2 < 2` 永远成立，因此高种子球队每一场都是主场。
- 已复现七场系列赛主场序列：`H H H H H H H`。
- 正确七场四胜制顺序应为：`H H A A H A H`（2-2-1-1-1）。

### P1：旧经理存档缺少迁移，进入排名页会崩溃

- 位置：`js/manager/state.js` 的 `normalize`、`js/manager/engine.js` 的 `ensureSeasonPlayerStats`。
- 当前存档版本仍为 `1`，但状态结构后来增加了 `season.playerStats` 和 `season.playerStatGameKeys`。
- 对缺少这两个字段的早期经理存档调用 `normalize` 后，`playerStatRows` 会抛出 `Cannot convert undefined or null to object`。
- `normalize` 目前只校验少数字段并直接把版本覆盖为当前版本，没有执行迁移或补默认值。

### P1：轮换即时校验显示互相矛盾

- 位置：`js/manager/app.js` 的 `handleInput`、`js/manager/state.js` 的 `validateRotation`。
- 将首名球员从 34 分钟改成 35 分钟后：
  - 页面状态变为“需要修正”，但不生成新的明确错误列表；
  - “总上场时间”错误显示为 `10/9–11`，不再显示 `241/240`；
  - 原因之一是非限定选择器 `div:nth-child(2) strong` 会再次命中第一个计数节点。
- 再把分钟修回 34 后，旧的“当前为 241 分钟”错误仍留在页面，同时状态显示“轮换合法”。
- 非首发球员设置为 `-5` 分钟时，`validateRotation` 返回 `valid: true`；负数条目因不属于 `active` 集合而跳过了范围校验。

### P1：赛季中排名按胜场数而不是胜率

- 位置：`js/manager/engine.js` 的 `standingsList`、`js/manager/app.js` 的经理主页联盟排名。
- 逐场推进时各队已赛场数可能不同，当前直接比较 `wins`，会把 `1-1` 排在部分 `1-0` 球队之前。
- 排名页文案称“按战绩与净胜分排序”，当前结果不符合常规联赛排名语义。
- 季后赛种子在完整 82 场后不受已赛场数差异影响，但赛季中展示和经理主页排名会错误。

### P1：董事会评价无法衡量未达标程度

- 位置：`js/manager/engine.js` 的 `evaluateOwner`。
- 未达到胜场目标时使用 `Math.max(0, wins - targetWins)`，导致所有低于目标的胜场贡献都为零。
- 已复现目标 36 胜时，`0` 胜与 `35` 胜均得到 `50` 分和“仍有机会”；达到 36 胜则直接跳到 72 分。
- 总分以 50 为基础且只增加，当前“低于预期”分支实际上不可达。

### P1：重开逻辑存在但界面没有入口

- 位置：`js/manager/app.js` 的 `restartGame` 和 `handleClick`、`manager.html`。
- 代码支持 `data-action="restart-game"`，但当前页面不存在任何对应控件。
- 用户进入经理会话后无法从界面明确清除经理存档并重新选队，不满足纵向切片的“重开可用”。

### P2：季后赛比赛标识不唯一

- 位置：`js/manager/engine.js` 写入 `state.season.games` 的季后赛 `index`。
- 当前标识只有轮次、分区和系列赛内场次，没有系列赛身份。
- 一次完整季后赛实测 81 场中出现 42 个重复标识，例如多个系列赛都会生成 `P1-NORTH-1`。
- 目前日志尚未依赖唯一性，但会阻碍后续单场统计、防重复记账和存档修复。

### P2：随机种子碰撞范围过大

- 位置：`js/manager/state.js` 创建状态时的 `rngState`；`js/manager/engine.js` 已有未使用的 `hashSeed`。
- 当前只异或球队 ID 的首尾字符，30 队中出现多组相同 RNG 初始状态，例如 `LAL/MEM/SAS`、`BKN/MIA/OKC`。
- 应使用完整球队 ID 和赛季标识生成稳定种子，并保持相同输入可复现。

### P2：操作状态和文案可访问性不足

- 排名视图、分区和球员统计切换按钮只有 `.is-active`，没有 `aria-pressed`、`aria-selected` 或等价语义。
- 底部主导航没有 `aria-current`；实测导航按钮高度为 48px，但排名相关切换按钮只有 36px。
- 检测到存档时仍提示“可从右上角读取”，实际读取按钮位于欢迎页下方。
- 自动保存失败被静默吞掉，页面仍只报告模拟成功，可能让用户误以为进度已经持久化。

## 实现要求

### 1. 修正模拟与排名规则

1. 用明确的七场主场序列实现 2-2-1-1-1，不使用容易产生取模错误的隐式判断。
2. 赛季中排名先比较胜率，再使用项目允许的平局规则；至少保证 `1-0` 排在 `1-1` 前。
3. 经理主页和排名页必须共用同一个排名结果，避免两套排序逻辑漂移。
4. 董事会评价必须连续、单调且能区分严重未达标、接近目标、达到目标、季后赛达标和夺冠。
5. “低于预期”“仍有机会”“达到预期”“超出预期”都必须存在可到达的输入区间。
6. 为每个季后赛系列赛生成稳定唯一 ID，并据此生成唯一比赛 ID。
7. RNG 使用完整的球队 ID 与赛季标识生成；同一输入仍需确定性复现。

### 2. 增加存档版本与迁移

1. 提升经理存档 schema 版本。
2. `normalize` 按旧版本逐步迁移，不得仅覆盖版本号。
3. 至少补齐并校验：
   - `season.playerStats`
   - `season.playerStatGameKeys`
   - `season.games`
   - `season.standings`
   - `season.scheduleIndex`
   - `season.playoffs`
   - `rotation`
   - `owner.goal` 和 `owner.evaluation`
4. 缺少可安全推导的字段时补默认值；关键身份、名单或赛季结构损坏时返回中文可理解错误，不允许以 TypeError 崩溃。
5. 迁移和读取只允许访问 `court_forge_manager_v1` / `manager_saves` / `manager_slot_1`，不得读取、写入或删除任何个人模式数据库和存档键。

### 3. 统一轮换校验与界面反馈

1. `validateRotation` 校验所有已知轮换条目，分钟必须是 `0` 到 `48` 的整数；`0` 表示不进入轮换，负数、NaN、小数和大于 48 均非法。
2. 总分钟、轮换人数、首发人数、位置覆盖和每名球员分钟范围由同一校验结果驱动。
3. 不使用模糊的后代选择器更新计数；采用明确节点标识、`:scope > ...` 或统一重渲染函数。
4. 输入变化后同步更新：
   - `当前分钟/240`
   - `当前人数/9–11`
   - `当前首发/5`
   - 合法/非法状态
   - 完整且最新的错误列表
   - 球员行的首发、轮换、未激活视觉状态
5. 页面不得同时显示“轮换合法”和错误列表。
6. 非法轮换时继续由引擎拒绝模拟；界面主操作应提供明确的不可推进原因。

### 4. 恢复可发现的重开与可靠保存反馈

1. 增加可发现的“重开经理模式”入口，同时保持现有底部“下一步 + 保存”主布局。
2. 清除前必须明确确认影响：只删除经理槽位并回到选队页。
3. 重开不得清理个人模式存档、共享联赛数据或修改 `index.html`。
4. 修正“右上角读取”的过期提示。
5. 自动保存失败必须向用户显示错误；不得用空 `catch` 静默处理。
6. 手动保存、自动保存、读取和重开期间应避免重复点击，并暴露适当的 disabled/loading 状态。

### 5. 补齐可访问性

1. 主导航当前项添加 `aria-current="page"` 或等价语义。
2. 两态切换按钮使用 `aria-pressed`；如果实现为 tabs，则完整使用 `tablist/tab/tabpanel` 和 `aria-selected`。
3. 排名与统计切换按钮触控高度不低于 44px。
4. 动态轮换错误必须通过现有 live region 或 `role="alert"` 被辅助技术感知。

## 自动化验收

扩充 `scripts/validate_manager_mode.js`，至少新增以下断言：

1. 七场系列赛主场序列严格为 `H,H,A,A,H,A,H`。
2. 所有季后赛比赛 ID 唯一。
3. `1-0` 在 `1-1` 之前，主页排名与排名页排序源一致。
4. 董事会评分随胜场改善单调增加，`0` 胜显著低于“差 1 胜”，并覆盖四个评价标签的可达性。
5. 替补球员分钟为 `-1`、`1.5`、`49` 时均被拒绝；`0` 合法。
6. 模拟一个 version 1 且缺少新增统计字段的旧存档，迁移后可打开球队排名与球员统计。
7. 损坏存档返回可理解错误而不是原生 TypeError。
8. 相同球队与赛季种子产生相同结果，不同球队不再出现当前首尾字符碰撞。
9. 重开只清除经理槽位，个人模式存档标识保持不变。

增加真实页面冒烟，覆盖：

1. 进入阵容页，将 34 改成 35，页面只显示 `241/240` 和对应错误。
2. 改回 34 后错误消失并恢复“轮换合法”。
3. 输入负数时主操作不能推进且显示明确错误。
4. 读取旧版本经理存档后，球队排名和球员统计均可打开。
5. 重开确认后回到选队页，再次读取时经理槽位为空。
6. 排名、分区和统计切换的可访问状态与视觉状态同步。

完成后继续运行并记录：

```powershell
node scripts\validate_manager_mode.js
node scripts\check_inline_scripts.js
node scripts\validate_league_schedule.js
node scripts\validate_playoff_simulation.js
node scripts\validate_awards.js
node scripts\validate_offseason_trades.js
node scripts\validate_event_system.js
```

## 修改边界

- 允许修改：`manager.html`、`css/manager.css`、`css/manager-personal.css`、`js/manager/**`、`scripts/validate_manager_mode.js`，以及经理模式专用的新测试文件。
- 禁止修改：`index.html`、个人模式 `STATE`、个人模式 IndexedDB/localStorage 键、球员生涯规则和共享球员数据。
- 不实现薪资、交易、选秀、自由球员、教练组或招式牌组。
- 不创建分支、不提交、不推送，除非用户另行明确要求。

## 完成标准

- 上述 P1 问题全部有自动化回归覆盖并通过。
- P2 数据完整性问题完成，UI 可访问性项通过真实页面检查。
- 经理模式仍只使用独立页面、独立状态和独立 IndexedDB。
- 既有七条验证命令全部通过。
- 交付报告逐项列出修改文件、复现前结果、修正后结果和未完成风险。
