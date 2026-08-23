# BuildPlayer 核心算法与逻辑引擎开发文档

本文档对 `js/core_game_logic.js` (原本内嵌于 `__ai_app.html` 中的约 1.6 万行核心逻辑) 进行深入剖析，梳理游戏内最核心的系统架构、数据模型以及关键算法。

> [!NOTE]
> 本文档所有论断均已与源代码逐行交叉比对核实（最后校验时间 2026-08-08）。

## 1. 核心架构与状态管理 (State Management)

整个游戏的生命周期和数据由一个全局单例对象 `STATE` 管理。

```javascript
const STATE = {
  mode: null,           // 游戏模式：'current' (当前联盟) | 'legend' (传奇)
  position: null,       // 玩家设定的场上位置 ('PG', 'SG', 'SF', 'PF', 'C')
  attrs: {},            // 锁定后的玩家属性集合
  buildStep: 'select',  // 初始建人阶段 ('select' | 'spin' | 'pick')
  finalOVR: 0,          // 最终计算出的总评
  season: {
    games: [], wins: 0, losses: 0,
    playerStats: {},    // 累计数据 { pts, reb, ast, stl, blk, tov, fgm, fga, ftm, fta, threeM, threeA, games, mins }
    playoffStats: {},   // 季后赛单独累计
    awards: [], playoffResult: null,
    standings: {},      // { team: { wins, losses } }
    isPlayoffs: false, playoffBracket: null,
    events: { suspensionGamesLeft, injuryGamesLeft, triggeredIds: [], storyTimeline: [], ... },
  },
  career: {
    seasonCount: 0,
    currentAge: 18,
    contract: 4,
    seasons: [],        // 历赛季存档
    totalStats: {},     // 生涯累计
    profile: { fame, businessValue, mediaTrust, controversy, chinaPopularity, loyalty, leadership, coachTrust, lockerRoomTrust, fanSupport, legacyBonus },
    branches: {},       // 分支剧情状态树
    flags: {},
    draft: null,
    nextSeasonMods: { injuryRiskBonus, formVariance, teamChemistry, moraleBonus, mediaPressure, staminaLoad },
  },
}
```

所有的模块（如界面渲染、比赛模拟、赛季结算）都强依赖读取和修改此 `STATE`，在每次状态变化后，触发对应的 UI `renderXXX()` 函数来同步界面。

---

## 2. 球员能力计算算法 (OVR 计算模型)

`calcOVR(attrs, pos)` 只使用页面可见的 14 项属性和球员位置，不读取来源 OVR，也没有球员个人加分项：

* 五个位置的权重总和统一为 `1.10`，最高四项权重总和统一为 `0.65`。
* 全部属性为 50 时，PG/SG/SF/PF/C 均为 50 OVR。
* 各位置按自身最高权重四项投入相同属性点时，OVR 差距不得超过 2。
* 位置只决定“哪些属性更重要”，不再改变同等属性点的总体收益。

1. 各属性先限制在 `[25, 99]`，再按 `(属性 - 25) × 位置权重` 累加；
2. 复合位置采用主位置 80% + 副位置 20%；
3. 额外计算得分手段完整度、最高四项均值，以及所有超过 80 的精英属性增量；
4. 加上全局基准和位置偏移后四舍五入，并限制在 `[40, 99]`。

配置位于 `SIM_CONFIG.OVR_MODEL`。所有权重与奖励系数均为非负数，因此任一属性提高都不会导致 OVR 下降。

### 2.1 跨位置惩罚机制 (`getPosPenalty`)
当玩家抽取到其他位置球员的某项属性时，系统会通过 `SIM_CONFIG.POS_AVG` 字典对比两者的位置均值进行衰减。
- 公式：`return Math.min(1.0, userAvg / srcAvg)`
- 即：当**玩家所选位置**对该属性的平均值（`userAvg`）**低于**被抽取球员位置的平均值（`srcAvg`）时，返回一个 <1 的系数，对属性进行折损。例如控卫（PG）抽取中锋（C）的篮板属性，由于 PG 的篮板均值远低于 C，该属性会被打折。反之，如果提取的是玩家位置本身就擅长的属性，则不做惩罚（系数 = 1.0）。

### 2.2 OVR 分层计算

控卫侧重组织、持球和运动能力，中锋侧重内防、篮板、力量与关键稳定性；不同位置的权重完整记录在配置中。现实球员运行时先把名单 OVR 保存为 `_sourceOvr` 供离线审计，页面和比赛实际使用的 `ovr` 始终由当前属性重算。固定新秀以审核目标 OVR 生成有强弱项的属性，再用同一公式复算，不存在单独的新秀 OVR 公式。

回归验收覆盖525名现实球员：平均绝对误差不得超过1.7，至少90%的球员须落在来源 OVR 的 `±3` 内，且不得存在误差达到5点的球员；同时逐项执行属性 `+1` 的单调性检查。

---

## 3. 比赛模拟引擎 (Match Simulation Engine)

比赛的核心算子位于 `simulateGameNew(teamA, teamB, seedBonus, probMultiplier)`。这是一个**"预定胜负 + 生成展示用比分"**的混合模拟器。

### 3.1 战力评估 (`calcTeamPowerWithPlayer`)
比赛开始前，首先调用此函数得出双方的首发阵容实力。
* 对于玩家所在的球队，系统会将玩家的 `STATE.finalOVR` 和属性作为首发替换掉原本该球队在该位置的球员。
* 战力返回值由 **5 个维度**组成：
  - `offense`：进攻维度（由 `SIM_CONFIG.TEAM_POWER.offense` 定义属性权重）
  - `defense`：防守维度
  - `athletic`：运动能力维度
  - `clutch`：关键球维度
  - `depth`：综合板凳深度（= 加权 OVR 总分）

### 3.2 胜负判定机制（逐节驱动）
比赛先根据双方战力、主场、赛季表现修正、伤病和疲劳计算 `expectedMargin`，再逐节生成真实比分：
1. 每节以比赛节奏和预期总分为基础，分别对两队得分进行正态采样。
2. 第四节分差不超过 8 分时，双方 `clutch` 差值会小幅影响该节预期分差。
3. 四节打平才进入加时；加时同样由实际得分决定结果。
4. 最终胜负直接读取 `scoreA > scoreB`，不再预定胜者，也不再强制修改第四节比分。

### 3.3 胜率公式
```javascript
const rosterEdge = (powerA.offense - powerB.offense) * 0.45
                 + (powerA.defense - powerB.defense) * 0.45
                 + (powerA.depth - powerB.depth) * 0.10;
const expectedMargin = clamp(
  rosterEdge + seasonFormEdge + homeCourtEdge + availabilityEdge + fatigueEdge,
  -18,
  18
);
```

季后赛按 `2-2-1-1-1` 安排高种子主场。赛季表现修正使用双方常规赛胜率差乘以 `12`，并限制在 `±2.5` 分；旧存档缺少有效战绩时回退到原有的小幅种子修正。这样明显拉开战绩的球队会更稳定，而战绩接近的不同种子仍主要由阵容和主场决定。带伤出战和缺阵通过预期分差惩罚影响比赛，不再直接乘最终胜率。

---

## 4. 球员场均数据模拟 (Stats Generation)

玩家的**得分、篮板、助攻**的生成由独立函数 `generatePlayerStatsNew` 完成，基于**出手倾向（Shot Distribution）**和**动态命中率（Shooting Percentage）**。

### 4.1 使用率 (Usage Rate) 计算
出手数不是固定的，由多重因子决定：
* **球队角色与出场时间**：首发/轮换地位和分钟数决定基础机会池。
* **进攻威胁与创造能力**：三分、中投、终结、持球和运动能力共同决定 `scoringLoad` / `usage`，核心球员获得更高的机会权重。
* **赛季状态偏移** (`seasonUsageBias`)：只提供 `0.92~1.08` 的小幅随机波动，并且与年龄无关。
* **爆发与比赛状态**：在核心角色基础上提供有限的单场长尾，不改变球队总出手预算。

年龄不直接参与 usage。年龄影响成长曲线、状态稳定性以及伤病/耐久风险；因此一个已经成长到 99 OVR 的年轻核心不会因为年龄标签被固定压低出手权。

### 4.2 命中率结算 (`calcShotPct`)
```javascript
function calcShotPct(type, attrVal, totalScore) { ... }
```
命中率由以下部分组成：
1. **基础命中率**：`cfg.base + (attrVal - 50) * cfg.attrFactor`
2. **比分环境修正**（注意方向）：
   - `totalScore > 220` → **+0.015**（高比分场次 = 防守强度低，命中率微升）
   - `totalScore < 180` → **-0.015**（低比分场次 = 防守强度高，命中率微降）
3. **低属性额外惩罚**：属性 < 60 时，每低 1 点扣 0.005
4. **随机波动**：`pct *= (0.92 + Math.random() * 0.16)` — 均匀分布 ±8%
5. **硬上下限**：`Math.max(cfg.min || 0.25, Math.min(cfg.max || 0.70, pct))`

### 4.3 各项数据的生成逻辑
* **得分** = 三分 + 中投 + 终结各自独立计算（出手数 × 对应命中率）+ 罚球得分。三分命中算 3 分，中投和终结算 2 分。
* **篮板** = `af(REB属性)` × 比分节奏修正 × 位置缩放 × 出场时间 × 随机 ±30%。
* **助攻** = `af((PAS + HAN + CLU) / 3)` × 比分节奏修正 × 位置缩放 × 出场时间 × 随机 ±30%。
* **抢断** = `STL` 主导 + `PDEF`/`ATH`/`HAN` 辅助（按位置加权）。
* **盖帽** = `BLK` 主导 + `IDEF`/`ATH` 辅助。
* **失误** = `(HAN + CLU) / 2` 取反向递减曲线（属性越高，失误越少）。
* **罚球** = 罚球率由 `FIN` 决定，罚球命中率由 `CLU` 通过 `calcShotPct('FT', ...)` 决定。

---

## 5. 分支剧情与互动事件引擎 (Story/Event Branching)

超过三分之一的代码量用于维持这个文字冒险（RPG）风格的生涯事件系统。

核心数据结构位于一个庞大的剧本库中，包含了：
* `requires`：前置条件函数（比如分支状态树处于某个节点、达成某项数据等）。
* `choices`：玩家可做的决定。
* `apply`：事件结算钩子（修改 `profile` 属性、设置分支节点）。

```javascript
{
  id: 'national_team_call',
  requires: function() { return getBranchNode('china_team') === 'future_commitment'; },
  choices: [
    { label: '兑现承诺，回到国家队', apply: function() { setBranchNode(...); addProfileDelta('chinaPopularity', 1); } },
    { label: '继续不回归', apply: function() { addProfileDelta('chinaPopularity', -2); } }
  ]
}
```
**状态树 (`BranchNode`)**：每一次抉择的结果都会持久化在 `STATE.career.branches` 中（如对国家队的态度、和教练的关系）。后续的剧情 `requires` 钩子会读取这些 Node 来决定是否触发连环事件。

### 5.1 赛季随机事件调度

赛季随机事件由 `EVENT_REGISTRY` 提供内容，并按后果拆成四条互不抢占名额的通道：

* `injury`：伤病，常规赛和季后赛分别最多 2 次，概率继续由年龄及休赛期身体管理修正。
* `discipline`：斗殴、驱逐和联盟处罚，常规赛和季后赛分别最多 1 次。
* `career`：宿敌、教练角色、交易流言、季后赛调整、重伤复出和奖项舆论等互动剧情，分别最多 2 次。
* `story`：赛场花絮、社交媒体、更衣室和场外生活，常规赛最多 4 次、季后赛最多 1 次。

每条通道独立保存触发次数和上次触发场次，同一事件 ID 在单赛季内不会重复。旧存档在首次检查事件时通过 `ensureSeasonEventState()` 补齐新增字段，不会覆盖原有伤停和时间线。

旧事件不再全部使用恒真条件：调度器会根据单场数据、分差、胜负、球员名气、赛季阶段和季后赛状态再次筛选。互动事件的选择会写入 `storyTimeline`，并可通过 `activeEffects` 在未来 2—5 场提供有限的球队气势修正。所有事件修正合计限制在预期分差 `±2.5` 以内，避免剧情选择替代阵容实力和比赛随机性。

---

## 6. 训练与成长系统 (Progression)

### 6.1 训练点数获取 (`calcTrainingPoints`)
每个赛季结束后，根据以下因素计算获得的训练点数 (TP)：
* 常规赛/季后赛成绩（如是否夺冠）
* 场均数据达标（得分 20+、篮板 5+、助攻 5+）
* 个人荣誉（全明星、MVP、DPOY、FMVP、最佳新秀、最佳阵容）

### 6.2 加点机制
玩家用 TP 给 `STATE.attrs` 中的各项属性手动加点：
* **递增成本**：属性值 < 90 时每点花费 1 TP；90-95 花费 **2 TP**；≥ 96 花费 **4 TP**。
* **单属性加点上限**：单赛季每项属性最多加 8 点。
* 加点完成后立即重算 `calcOVR()` 刷新面板。

### 6.3 年龄被动效果 (`getAgeInfo`)
| 年龄段 | 效果 |
|--------|------|
| ≤ 22岁 | 涨球期：加点后所有属性额外 +1 |
| 23-28岁 | 巅峰期：无被动变化 |
| 29-33岁 | 下滑期：ATH 和 STR 每年降 1 点 |
| ≥ 34岁 | 末期：所有属性降 1 点，ATH/STR 额外再降 2 点 |

`calcTrainingBreakdown()` 是一个纯展示函数，返回训练点来源的文字描述（如 "成绩:🏆冠军+ 得分20+ 全明星"），它**不执行**属性修改。

---

### 💡 开发者建议 (如何 Hack/魔改)

如果你想对游戏进行"开挂"或者修改平衡性，可以主要修改以下内容：
1. **想锁定必中/高命中率**：在 `calcShotPct` 函数中，直接 `return 0.99;`。
2. **想篡改你的球队实力**：在 `calcTeamPowerWithPlayer` 返回值中强制给 `offense` 和 `defense` 加 50。
3. **想修改随机抽卡的爆率**：在 `spinSlotMachine()` 中，降低低分球员的权重池。
4. **想让主角永远年轻**：在 `getAgeInfo` 中让所有年龄段都返回涨球期的效果。
