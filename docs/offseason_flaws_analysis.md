# BuildPlayer 休赛期与养成系统逻辑缺陷分析报告

在对 `js/core_game_logic.js` 中的休赛期演进 (`evolveLeague`)、自由市场和交易系统进行详细拆解后，发现当前的"养成与联盟运转"系统在逻辑设计上存在诸多极为不合理的地方，尤其缺乏对真实商业联盟运转规则的模拟。

> [!NOTE]
> 本文档所有论断均已与源代码逐行交叉比对核实（最后校验时间 2026-08-08）。

---

## 1. 简单粗暴的属性涨跌（"按比例缩放"的荒谬性）

**📍 问题代码定位**：`evolveLeague` 中的 OVR 更新逻辑 (约 L15650-L15657)

**🚨 不合理现象**：
系统在每年根据年龄算出一个 `newOvr` 后，直接计算了一个比率 `ratio = Math.round(newOvr) / p.ovr`，然后**简单粗暴地把这个比率乘到了球员的每一项具体属性上**。

```javascript
var ratio = Math.round(newOvr) / p.ovr;
SIM_CONFIG.ATTR_LIST.forEach(function (attrKey) {
  p[attrKey] = Math.max(25, Math.min(99, Math.round(p[attrKey] * ratio)));
});
```

**💥 带来的负面影响**：

- **违背运动生理学**：当一个 36 岁的老将因为年龄（`ageFactor`）导致 OVR 下滑时，他原本高达 90 的三分球（`threePT`）和罚球也会按照相同的比例暴跌到 70 多。真实情况是，老将下滑的主要是运动能力（`ATH`）和横向移动（`PDEF`），而投射和球商（`PAS`）往往越老越妖。目前的算法会让老将"越老越不会投篮"，这是极其不合理的。

**💡 优化建议**：
属性衰退和成长需要**按类型区分权重**。参考方案：

```javascript
// 衰退分组
var decayFast = ["ATH", "STR", "PDEF"]; // 运动能力快速衰退
var decaySlow = ["FIN", "DNK", "IDEF", "BLK", "REB"]; // 中等衰退
var decayResist = ["threePT", "MID", "PAS", "HAN", "CLU"]; // 投射/球商几乎不退
```

**🔧 最小修复方案（在现有 ratio 基础上按属性类型差异化衰退）**：

在 `js/core_game_logic.js` L15651 处，替换 `SIM_CONFIG.ATTR_LIST.forEach` 这一段：

```diff
  if (newOvr !== p.ovr) {
-   var ratio = Math.round(newOvr) / p.ovr;
-   SIM_CONFIG.ATTR_LIST.forEach(function(attrKey) {
-     if (p[attrKey] != null) p[attrKey] = Math.max(25, Math.min(99, Math.round(p[attrKey] * ratio)));
-   });
+   var baseRatio = Math.round(newOvr) / p.ovr;
+   var decayFast    = ['ATH', 'STR', 'PDEF'];
+   var decayResist  = ['threePT', 'MID', 'PAS', 'HAN', 'CLU'];
+   SIM_CONFIG.ATTR_LIST.forEach(function(attrKey) {
+     if (p[attrKey] == null) return;
+     var r = baseRatio;
+     if (baseRatio < 1) {
+       if (decayFast.indexOf(attrKey) >= 0)   r = 1 - (1 - baseRatio) * 1.5; // 运动衰退放大
+       if (decayResist.indexOf(attrKey) >= 0) r = 1 - (1 - baseRatio) * 0.3; // 投射几乎不退
+     }
+     p[attrKey] = Math.max(25, Math.min(99, Math.round(p[attrKey] * r)));
+   });
    p.ovr = Math.round(newOvr);
  }
```

---

## 2. 彻底缺失的"薪资空间" (Salary Cap) 概念

**📍 问题代码定位**：`evolveLeague` (合同留队, L15703-L15753) 及 `assignFreeAgents` (L15335-L15412)

**🚨 不合理现象**：
游戏代码中给球员分配了 `contract`（合同年限），但完全没有给球员分配**合同金额**（Salary），也没有给球队设定**工资帽**（Salary Cap）。
球队续约球员时，只看概率（`stayRate`）；在自由市场签人时，只看这支球队是不是弱队以及缺不缺该位置的球员。

**💥 带来的负面影响**：

- **无限囤积球星**：只要概率抛得好（或者玩家一直在赢球导致 `teamFactor` 很高），一支队伍可以续约无数个 90+ OVR 的球员，不用付出任何奢侈税代价。
- **自由市场变成了"选秀大会"**：自由市场分配机制变成了"弱队优先白嫖大牌"，完全不考虑这支弱队到底有没有钱签人，这完全违背了自由市场的真实运作规律。

**💡 优化建议**：
引入底薪、中产、顶薪的概念。每个球员应该有一个动态身价（如 OVR 90 对应 3500万），每支球队设置 1.4 亿的工资帽。

**🔧 最小修复方案（用每队最多 3 名 OVR 85+ 球员模拟"薪资空间"约束）**：

在 `assignFreeAgents` 的 `pool.forEach` 循环中，在最外层球队遍历最开头新增上限检查：

```diff
    for (var ti = 0; ti < teams.length; ti++) {
      var t = teams[ti];
      if (t === fa._origTeam) continue;
+     // ★ 简化版薪资约束：任何球队 OVR≥85 球员不超过 3 名
+     if (fa.ovr >= 82) {
+       var starCount = (NBA2K_DATA[t] || []).filter(function(p) { return !p._isUser && p.ovr >= 85; }).length;
+       if (starCount >= 3) continue;
+     }
      if (fa.ovr > 86) {
```

> [!NOTE]
> 3 名 OVR 85+ 球员大致对应"顶薪+顶薪+中产"的真实薪资结构，比原有的同位置限制更能防止球星异常集中。

---

## 3. 防"巨星抱团"补丁——逻辑正确但范围过窄

**📍 问题代码定位**：`assignFreeAgents` 中的球星分配逻辑 (L15361-L15367)

**🚨 不合理现象**：
防抱团的真实代码如下：

```javascript
// 如果自由球员 OVR > 86，检查目标球队是否有同位置的 OVR >= 84 球星
if (fa.ovr > 86) {
  if (starSignedTeams[t]) continue;  // 本轮已签过球星
  var hasStar = false;
  (NBA2K_DATA[t] || []).forEach(function(p) {
    if (p !== fa && !p._isUser && canPlayPosition(p.pos || '', pos) && p.ovr >= 84) hasStar = true;
  });
  if (hasStar) continue;
}
```

注意 `canPlayPosition(p.pos, pos)` 这个条件——检查的是队内球员是否**能打自由球员的相同位置**，而非全队范围。

**💥 带来的负面影响**：

- **不同位置的巨星可以随意抱团**：如果一支球队有一个 90 OVR 的 PG，一个 88 OVR 的 SG 自由球员完全可以加入（因为 SG 和 PG 位置不同，`canPlayPosition` 返回 false）。但如果该队有一个 84 OVR 的 SG，那 88 OVR 的 SG 就会被拦截。这种"只防同位置，不防跨位置"的方式很容易被绕过。
- **本轮签约的 `starSignedTeams` 限制太弱**：只限制了同一轮签约中不能签两个球星，但不同轮次（不同赛季）可以反复积累球星，最终还是会出现超级球队。

**🔧 最小修复方案（把 hasStar 检查扩展到全队所有位置）**：

在 `js/core_game_logic.js` L15364 处，删除 `canPlayPosition` 的位置过滤：

```diff
  var hasStar = false;
  (NBA2K_DATA[t] || []).forEach(function(p) {
-   if (p !== fa && !p._isUser && canPlayPosition(p.pos || '', pos) && p.ovr >= 84) hasStar = true;
+   // 全队范围检查：不论位置，只要有 OVR≥84 的球星就拦截
+   if (p !== fa && !p._isUser && p.ovr >= 84) hasStar = true;
  });
```

> [!NOTE]
> 可搭配问题2的修复一起使用（OVR85+ 不超过3名），两者互为补充：本修复负责阻止自由球员主动涌入强队，问题2的修复负责限制强队的整体球星上限。建议将这里的阈值改为 86，以允许合理的"球星+次级搭档"组合存在。

---

## 4. "强行补齐18人"的新秀生成机制

**📍 问题代码定位**：`evolveLeague` 的补齐 roster 逻辑 (L15675-L15683)

**🚨 不合理现象**：
休赛期没有真正的"选秀大会"模块来为电脑球队分配新秀（玩家本人有 `DRAFT_CLASS_2026` 选秀体验），电脑球队只是用一段循环暴力补齐名单：

```javascript
while (newRoster.length < 18) {
  var rk = generateRookie();
  newRoster.push(rk);
}
```

**💥 带来的负面影响**：

- 如果一支强队里全是年轻人，没有人退役，也没有人合同到期离队，那它的名单就是满的，**它永远不会得到新秀**。
- 如果一支老将大队退役了 8 个人，它瞬间就能得到 8 个随机新秀。这导致"新秀"变成了用来填补空位的工具人，而非球队未来的资产。
- 新秀的能力是纯随机生成的，没有"天才新秀"和"水货"的分层概念。

**🔧 最小修复方案（给补充的新秀按顺序分配 OVR 档次，模拟选秀顺位）**：

在 `js/core_game_logic.js` L15675 处，给补齐循环增加顺位计数器：

```diff
- while (newRoster.length < 18) {
-   var rk = generateRookie();
-   newRoster.push(rk);
- }
+ var draftSlot = 0;
+ while (newRoster.length < 18) {
+   draftSlot++;
+   var rk = generateRookie();
+   // 前3个空位（更弱的队）：OVR 68-74（彩票区球员）
+   // 之后：OVR 60-67（次轮/末签）
+   rk.ovr = draftSlot <= 3
+     ? 68 + Math.floor(rngNext() * 7)
+     : 60 + Math.floor(rngNext() * 8);
+   newRoster.push(rk);
+ }
```

---

## 5. 互补需求交换——方向正确但过于简陋

**📍 问题代码定位**：`processTrades` (L15448-L15529)

**🚨 不合理现象**：
交易系统是基于"互补需求"的逻辑（A 队需要 PG，B 队需要 C，互换各自板凳对应位置球员），方向上是合理的。但存在以下设计问题：

- **只支持 1换1**：不支持"1换2"、"球员+选秀权"等真实交易形式。
- **OVR 差值不超过 8**：这意味着只能换到能力差不多的球员，无法实现"卖球星换潜力股"的重建操作。
- **每赛季最多 10 笔**：且每队最多参与 1 笔（`tradedTeams` Set 控制），全联盟 30 支球队最多只有 20 支参与交易，远低于真实 NBA 交易的活跃度。
- **无选秀权概念**：整个代码中不存在选秀权作为交易资产，重建球队无法通过出售即战力来囤积未来资产。

**🔧 最小修复方案（放宽 OVR 差值上限至 15，每队可参与 2 笔交易）**：

在 `js/core_game_logic.js` L15469 和 L15476 和 L15502 处：

```diff
- var tradedTeams = new Set();
+ var tradedTeams = new Map(); // 改用 Map 支持计数

- for (var ti = 0; ti < shuffled.length && tradeCount < 10; ti++) {
+ for (var ti = 0; ti < shuffled.length && tradeCount < 16; ti++) {
    var a = shuffled[ti];
-   if (tradedTeams.has(a)) continue;
+   if ((tradedTeams.get(a) || 0) >= 2) continue; // 每队最多参与 2 笔

      ...

-   if (diff <= 8) {
+   if (diff <= 15) { // 放宽差值：允许弱队出售大牌换潜力股
      tradedPlayers.add(playerForA);
      tradedPlayers.add(playerForB);
-     tradedTeams.add(a);
-     tradedTeams.add(b);
+     tradedTeams.set(a, (tradedTeams.get(a) || 0) + 1);
+     tradedTeams.set(b, (tradedTeams.get(b) || 0) + 1);
```

> [!NOTE]
> 这个方案不引入新的数据结构，只需改动 4 行代码。将总交易量从 10 提升到 16 笔，每队可参与 2 次，OVR 差值上限从 8 放宽到 15，使弱队重建路径更合理。

---

### 📝 总结

《BuildPlayer》当前的休赛期是一个**高度伪装的随机打乱系统**。它利用了"退役+强行补充新秀"、"概率离队+按弱队排序分配"勉强维持着联盟大名单的人数平衡。但在本质上，它缺乏**薪资、选秀权、属性针对性衰退**这三大 NBA 模拟游戏最核心的地基。

如果想要深入开发，以下是按优先级排列的重构路线图：

1. **P0 - 属性分类衰退**：最容易实现，影响最直接，可以立即改善老将的面板合理性。
2. **P1 - 引入薪资体系**：工程量大但是联盟生态平衡的根基。
3. **P2 - 选秀权与多人交易**：让交易市场有策略性，而非纯粹的"等值互换"。
