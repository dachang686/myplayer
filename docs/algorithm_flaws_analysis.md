# BuildPlayer 核心算法缺陷与不合理性分析报告

在对 `js/core_game_logic.js` 的核心模拟算法（特别是比赛模拟和数据生成引擎）进行深入解剖后，发现当前游戏引擎在底层设计上存在多处"反直觉"和"缺乏模拟真实性"的机制缺陷。

> [!NOTE]
> 本文档所有论断均已与源代码逐行交叉比对核实（最后校验时间 2026-08-08）。

> [!IMPORTANT]
> 2026-08-09 更新：第 1 项“预定胜负”和第 5 项“CLU 不影响胜负”已由逐节驱动引擎修复；季后赛主场顺序和另一分区半区映射也已修正。下方对应章节保留为历史问题说明，其余统计生成问题仍需分别评估。

---

## 1. "先射箭后画靶"的胜负判定机制（已修复）

**📍 问题代码定位**：`simulateGameNew` 函数 (约 L3594 - L3740)

**🚨 不合理现象**：
游戏并不是通过模拟 4 节比赛中每个回合的得分来顺理成章地得出胜者，而是**在函数一开始就通过 `finalProb` 和 `Math.random()` 直接内定了整场比赛的胜负 (`predeterminedWinner`)**。

随后，系统去生成 4 节比赛的比分，并在循环里强行"微调"每节的得分，试图让预定胜者领先。如果到了最后，预定胜者的得分依然落后，引擎会触发一段极其粗暴的强行修正代码：
```javascript
// 强制修正逻辑 (L3712-3720)
const won = predeterminedWinner === teamA;
if (won && scoreB >= scoreA) {
  const add = scoreB - scoreA + 1;
  scoreA += add;
  if (qScoresA.length) qScoresA[qScoresA.length - 1] += add;
}
```
**💥 带来的负面影响**：
* 会出现极度不科学的第四节（Q4）单节比分。比如前三节预定胜者落后了 30 分，第四节系统会直接强行给他加上 31 分的修正值，导致出现类似单节 55:12 这种极其不真实的单节比分。
* 完全摧毁了比赛的悬念模拟，过程毫无意义，仅仅是为了凑出结果。

**💡 优化建议**：
应该改为**过程导向 (Process-driven)**。每一节单独结算真实的攻防回合（Possessions），通过投篮命中率和回合数真实产生该节得分。4 节打完谁分数高谁就赢。如果平局，则进入加时赛循环。

**🔧 最小修复方案（不改结构，只限制强行加分的幅度）**：

在 `js/core_game_logic.js` 约 L3712 处，为强制修正加一个上限（最多允许修正 15 分），避免离谱单节比分：

```diff
  if (won && scoreB >= scoreA) {
-   const add = scoreB - scoreA + 1;
+   const add = Math.min(15, scoreB - scoreA + 1); // 最多修正15分，避免单节离谱比分
    scoreA += add;
    if (qScoresA.length) qScoresA[qScoresA.length - 1] += add;
  } else if (!won && scoreA >= scoreB) {
-   const add = scoreA - scoreB + 1;
+   const add = Math.min(15, scoreA - scoreB + 1);
    scoreB += add;
    if (qScoresB.length) qScoresB[qScoresB.length - 1] += add;
  }
```

> [!NOTE]
> 这不解决"先射箭后画靶"的根本问题，只是防止单节出现 50+ 的离谱比分。若 15 分仍不足以让预定胜者翻盘，比分会出现平局，此时已有的加时赛循环可自然接手。

---

## 2. 球队得分与球员数据的割裂 (Top-Down Box Score Allocation)

**📍 问题代码定位**：`generateBoxScore` 函数 (约 L3742 - L3860)

**🚨 不合理现象**：
在真实篮球游戏中（如 NBA 2K 的模拟引擎），球队的总分是由每个球员在场上"投篮、命中、罚球"累加而来的。
但当前算法采用了**自顶向下（Top-Down）的分配制**：
1. 先得出球队本场总分（如 115分）。
2. 根据上场球员的 `OVR` 算出权重。
3. 把 115 分按权重"切蛋糕"一样分给每个球员。

```javascript
// OVR 指数分配 (L3759)
const ovrFactor = Math.pow(Math.max(0, (ovr - 55) / 44), 2.0);
let allocated = weights.map((w, i) => Math.round(totalPts * w / totalW));
```
**💥 带来的负面影响**：
* **球星毫无存在感**：如果你的球员 OVR 高达 99，你的球队进攻本来应该非常厉害，但你的单场得分上限完全受制于"球队随机出来的总分"。就算你各项进攻属性拉满，一旦球队总分被随机成了 80 分，你的得分也会被强行压低。
* **低分球员断崖式崩盘**：公式中 `(ovr - 55)` 导致任何 OVR 小于等于 55 的球员在 `ovrFactor` 这一步直接变成 0（只剩下保底的 0.05 权重），这在数值设计上是非常极端的平滑缺失。

**💡 优化建议**：
使用**自底向上 (Bottom-up)** 的逻辑。按照出场时间分配"回合使用率 (Usage Rate, USG%)"，用球员真实的各项进攻能力（三分、中投、终结）独立 Roll 命中率，球员的得分累加，构成球队最终的总分。

**🔧 最小修复方案（平滑 OVR 权重的断崖，避免低分球员完全消失）**：

在 `js/core_game_logic.js` 约 L3759 处，将指数衰减改为线性，消除 OVR ≤ 55 的硬性断崖：

```diff
- const ovrFactor = Math.pow(Math.max(0, (ovr - 55) / 44), 2.0);
+ // 线性权重：OVR=40时权重=0.1，OVR=99时权重=1.0，无断崖
+ const ovrFactor = Math.max(0.1, (ovr - 40) / 59);
```

> [!NOTE]
> 这一改动不解决"自顶向下分配"的根本问题（球队总分仍是先算好的），但能防止低分球员权重归零，让 Box Score 中的数据分布更合理。

---

## 3. 主角个人数据与球队 Box Score 的状态不同步 (Desync Issues)

**📍 问题代码定位**：`generatePlayerStatsNew` (L3860) 与 `generateBoxScore` (L3742)

**🚨 不合理现象**：
由于主角（玩家）的个人数据是使用一套独立的函数 `generatePlayerStatsNew` 并在 `calcShotPct` 里加入浮动生成的，而球队的 Box Score 又是上面提到的"切蛋糕分配"生成的。
这会导致在赛后查看数据时：
* `STATE.season.playerStats` 中记录的玩家本场得了 45 分。
* 但是，比赛结算画面的球队数据统计表里，玩家作为球员在那个分配算法中可能只分到了 28 分。
* 两套统计系统各自为战，底层没有对齐。

**🔧 最小修复方案（玩家槽位直接写入本场实际数据，跳过权重分配）**：

在 `js/core_game_logic.js` `generateBoxScore` 函数内（约 L3788），在 `players.map` 的映射回调最开头插入玩家特判逻辑：

```diff
  return players.map((p, i) => {
+   // 玩家角色：直接读取本场由 generatePlayerStatsNew 生成的真实数据
+   if (p._isUser) {
+     const games = STATE.season.games;
+     const lastStat = games.length > 0 ? games[games.length - 1].stats : null;
+     if (lastStat) {
+       return { name: p.name, cname: p.cname, pos: p.pos, ovr: p.ovr,
+                pts: lastStat.pts, reb: lastStat.reb, ast: lastStat.ast,
+                stl: lastStat.stl, blk: lastStat.blk, tov: lastStat.tov,
+                fgm: lastStat.fgm, fga: lastStat.fga, mins: lastStat.mins };
+     }
+   }
    const pos = (p.pos || 'SF').split('/')[0].trim();
    // ... 原有逻辑
```

## 4. 命中率环境修正的方向违反直觉 (Counter-intuitive Defense Pressure)

**📍 问题代码定位**：`calcShotPct` 函数 (L3975)

**🚨 不合理现象**：
```javascript
// 防守压力 (L3982-3985)
if (totalScore > 220) pct += 0.015;  // 高比分场次 → 命中率升
if (totalScore < 180) pct -= 0.015;  // 低比分场次 → 命中率降
```
代码的变量名和注释称之为"防守压力"，但实际的计算方向是：**总比分越高，命中率反而越高**。这可以解读为"高比分说明双方防守都松，所以命中率高"，但更常见的解读应该是"高出手量导致疲劳，命中率应该下降"。无论如何，这段逻辑与变量命名和直觉之间存在认知冲突，且修正幅度仅有 ±1.5%，影响极其微弱。

此外，命中率的随机波动使用的是**均匀分布**（`0.92 + Math.random() * 0.16`），而非更贴近真实手感的正态分布（Gaussian）。这导致出现极端高/极端低命中率的概率与中等命中率完全相同，缺乏向均值回归的自然趋势。

**🔧 最小修复方案 A（修正方向语义）**：

将"防守压力"改为符合真实语义的正方向（高比分高命中），同时通过两次取均值模拟正态收敛：

```diff
- // 防守压力
- if (totalScore > 220) pct += 0.015;
- if (totalScore < 180) pct -= 0.015;
+ // 节奏修正：高比分节奏快、防守松弛，命中率微升；低比分防守硬朗，命中率微降
+ const paceMod = totalScore > 220 ? 0.012 : totalScore < 180 ? -0.012 : 0;
+ pct += paceMod;
```

**🔧 最小修复方案 B（用两次随机均值模拟正态收敛）**：

在 `js/core_game_logic.js` 约 L3993 处：

```diff
- pct *= (0.92 + Math.random() * 0.16);
+ // 两次随机取均值，使波动集中在中心（约±8%，但极端值概率减半）
+ const jitter = ((Math.random() + Math.random()) / 2 - 0.5) * 0.16;
+ pct *= (1.0 + jitter);
```

---

## 5. 玩家 CLU（关键球）属性对胜负完全无效（已修复）

**📍 问题代码定位**：`simulateGameNew` 函数 (L3594-L3740) 全文

**🚨 不合理现象**：
尽管 `calcTeamPowerWithPlayer` 返回了一个 `clutch` 维度，但 `simulateGameNew` 在计算胜率 (`netRatingA`) 时**只使用了 `offense`、`defense` 和 `depth` 三个维度**，完全忽略了 `athletic` 和 `clutch`。

```javascript
// 胜率公式 (L3600-3603) — 注意：只用了 offense/defense/depth
const netRatingA = (powerA.offense - powerB.offense) * 0.4
                 + (powerA.defense - powerB.defense) * 0.4
                 + (powerA.depth - powerB.depth) * 0.2
                 + (seedBonus || 0);
```

这意味着玩家辛辛苦苦通过分支剧情事件积累的 `CLU` 属性加成，对比赛的胜负和关键时刻**没有任何实际作用**。`CLU` 只在 `generatePlayerStatsNew` 中影响罚球命中率、助攻和失误数据，但不影响你是赢还是输。

**🔧 最小修复方案（把 clutch 纳入胜率公式，权重从 depth 中匀出 10%）**：

在 `js/core_game_logic.js` L3600 处修改 `netRatingA` 计算：

```diff
  const netRatingA = (powerA.offense - powerB.offense) * 0.4 
                   + (powerA.defense - powerB.defense) * 0.4 
-                  + (powerA.depth - powerB.depth) * 0.2
+                  + (powerA.depth - powerB.depth) * 0.1
+                  + (powerA.clutch - powerB.clutch) * 0.1  // CLU 正式参与胜负判定
                   + (seedBonus || 0);
```

> [!NOTE]
> `calcTeamPowerWithPlayer` 已经把玩家的 CLU 属性纳入 `clutch` 维度计算（见 L3588），此处只需一行改动即可生效，无需其他改动。CLU 高的玩家（例如通过剧情事件练到 85+）会带来约 +3% 的额外胜率加成。

---

### 📝 总结与重构路线图

目前的引擎属于典型的**"视觉小说式模拟 (Visual Novel Simulation)"**，一切为了产出一个剧情向的结果。如果要走向真实的体育模拟，必须要经历一次架构重构：

1. **废弃预定胜负**，建立基于 `Possession` (回合) 的微观模拟循环。
2. **统一数据源**，玩家本场的数据必须和全队 Box Score 使用同一个生成通道。
3. **让 CLU 和 ATH 参与胜率计算**，否则这两个维度就是浪费计算。
4. **引入状态机**，球员需要加入 `Stamina` (体力) 和 `Hot/Cold` (手感) 动态变量，以替代当前单纯的纯随机数浮动。
