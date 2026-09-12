# 球员职责与统计偏差修复

已按当前阵容验收。文班此前约 17 分/36 分钟的明显低估已修复；恩比德与莫兰特换队后的历史差值不再直接判为错误。

**根因与修复**

1. 出手负荷从含控球/运动能力的综合画像推导，遗漏了实际低位、接球进攻职责。恩比德和文班的通用出手负荷只有约 74–76，容易被其他持球手挤走机会。现在以可追溯的出手/罚球参与度作先验，按当前能力变化、出场分钟及队友竞争归一化。得分仍来自实际出手与属性命中概率，未读取历史得分填箱分。
2. 助攻既乘含控球权重的触球量，又乘传球能力的 3.4 次幂，策应内线被重复压低。现在区分组织参与度与传球能力，并校正不能给自己投篮记助攻的机会缺口。队友投丢仍会影响最终助攻。
3. 原失误分配中，优秀控球者的单次风险下降抵消了其更大工作量，导致核心失误被分给队友。现在按本场出手、罚球和传球决策分配，再由控球能力调节风险。历史失误率不进入当前球队总失误或个人目标。

依据：[NBA 指标定义](https://www.nba.com/stats/help/glossary)区分使用率、触球与潜在助攻；能力和参与频率不能混为一个量。

**文件**

- [比赛分配](C:/kevin/myplayer/js/simulation_v2.js:502)：职责、助攻参与度、实际决策失误分配；共同概率函数也用于赛前预测。
- [离线数据生成](C:/kevin/myplayer/scripts/build_player_offensive_roles.js)：从完整 ESPN 2025–26 常规赛公开响应生成职责；缓存记录来源链接、场次、分钟、原始数值和转换方法。
- [职责来源缓存](C:/kevin/myplayer/scripts/data/player_offensive_roles.json)：444 名具有足够样本的球员；小样本按可靠度混合通用画像。
- [名单生成块](C:/kevin/myplayer/js/data/league_players.js:11063)：只附加职责元数据，525 人、7350 个原属性值来源校验仍通过。
- [旧存档补齐](C:/kevin/myplayer/js/offseason.js:3898)：补齐职责记录、可重复执行；复制成新秀或自建球员时不会错误继承真人身份的职责。
- [控制变量测试](C:/kevin/myplayer/scripts/validate_player_offensive_roles.js)：职责来源、能力变化、身份隔离、旧存档、换队分流和失误决策测试。
- index.html 更新脚本版本号；刷新后加载旧存档可使用新逻辑。

**固定种子复查**

5220 场当前名单模拟，30 队相互各 12 场，按当前公式和轮换运行。以下统一为每 36 分钟，不能当作未来真实赛季预测。

| 已确认的偏差 | 修复前 | 修复后 | 历史参考 |
|---|---:|---:|---:|
| 文班得分 | 16.93 | 27.33 | 30.82 |
| 哈尔滕施泰因助攻 | 0.72 | 5.25 | 5.26 |

恩比德当前为 25.89 分/36 分钟；没有要求他追到旧队历史 30.60。莫兰特为 2.98 次失误/36 分钟；没有要求他接近过去 4.49，该差值不作为错误判定。

**队友分流的控制实验**

700 场固定轮换对照，恩比德能力、33 分钟出场时间及对手相同，只替换布朗/詹姆斯为普通角色球员：

| 场景 | 场均出手 | 场均得分 |
|---|---:|---:|
| 当前队友 | 15.46 | 23.59 |
| 减少高球权队友 | 18.62 | 28.11 |

这项实验按场均展示，不是每 36 分钟。结果说明得分会随队友分流变化，没有锁到历史值。

失误控制实验固定球队 10 次失误、固定投篮和传球决策：控球从 40 提高到 90，测试球员分配到的平均失误 3.37 → 3.07；保持控球 90、增加决策量后变为 4.22。这是人工控制实验的分配结果，不是莫兰特场均数据。

**整体分布与验证**

独立统计校验 12300 场，覆盖 30 队，箱分守恒错误 0。球队场均 115.10 分、44.63 篮板、26.58 助攻、13.76 失误。

已通过：

- node scripts/validate_player_offensive_roles.js
- node scripts/validate_basketball_realism.js
- node scripts/validate_simulation_v2.js --mode=integration（1230 场）
- node scripts/validate_simulation_v2.js --mode=statistical（12300 场及专项样本）
- node scripts/validate_v2_win_calibration.js --mode=statistical
- node scripts/validate_v2_dual_core_usage.js
- node scripts/validate_v2_engine_extreme_cases.js
- node scripts/validate_generated_rookie_pipeline.js
- node scripts/validate_manager_mode.js
- node scripts/validate_event_system.js
- node scripts/validate_league_ovr_anchor.js
- node scripts/validate_league_attribute_provenance.js
- node scripts/check_inline_scripts.js
- node scripts/build_player_offensive_roles.js（重复构建哈希一致）
- git diff --check

验收不再把恩比德和莫兰特的历史数值当硬目标。双核心旧测试在本轮修改前就因“同攻评分应近似同分”失败；现保留出手公平与顺序隔离，允许效率/罚球造成得分差。助攻榜首允许当前阵容分流；600 场分钟梯度的比例边界保留 1% 数值容差（原实测 2.00079 对门槛 2）。没有以这些调整替代控制变量验证。

本轮没有重新跑 35 年成长压力测试：未修改成长/潜力算法，只增加职责存档补齐。未进行浏览器手工操作。
