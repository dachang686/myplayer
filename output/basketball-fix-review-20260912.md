# 篮球模型修复与复查（2026-09-12）

后续复查更新：历史差值不能直接判定换队后的恩比德、莫兰特异常；文班低估和职责分配机制已另行修复。见 [本轮职责修复报告](C:/kevin/myplayer/output/player-stat-role-fix-review-20260912.md)。

上一轮九项问题的回归均通过。球队总量进入合理范围；额外的逐人统计检查仍发现明显偏差，不能判定所有现实球员的数据都已准确还原。

## 文件与变更

- [评分配置](C:/kevin/myplayer/js/data/simulation_config.js)、[拟合脚本](C:/kevin/myplayer/scripts/fit_monotonic_ovr_model.js)：重新拟合有约束的位置权重，14 项技能全部具有非零贡献；保留中锋控球/外防价值，限制 CLU 总评分贡献。525 人原始属性来源核对仍通过。
- [生涯逻辑](C:/kevin/myplayer/index.html)：普通时段剔除 CLU 总评贡献；比赛与读档重新计算 OVR；自建球员自然成长覆盖防守和身体，衰退区分身体与技术；非零年轻伤病率，诊断元数据与医学参赛限制，赛季报销覆盖季后赛。
- [联盟成长](C:/kevin/myplayer/js/offseason.js)：修复主项封顶后永久停止成长，以及请求 +3 反而少执行一轮的问题；调整新秀潜力分布与少数精英兑现速度，避免成材结果过于整齐。
- [比赛引擎](C:/kevin/myplayer/js/simulation_v2.js)：先分配个人出手，再决定出手区域；真实区分低用量射手、顺下终结和持球进攻；罚球恢复原始能力差异，恢复造犯规产量；篮板/抢断分配与球队节奏校准。投篮概率和赛前投影共用计算，并验证提升 FIN/HAN 不会反而降低篮下命中率。
- [新增回归](C:/kevin/myplayer/scripts/validate_basketball_realism.js)：已加入 npm run test:basketball-realism 及正式测试链。

## 原问题复现结果

中锋只提高控球、外防、抢断时，OVR 79 → 87；固定队友和分钟，平均分差 -1.97 → 1.71。只提高 CLU 时，两组前三节平均分差完全相同。

35 岁抽样：速度平均下降 2.14，传球下降 0.76。22 岁全部防守及身体属性都有正向自然成长。年轻球员默认伤病率 0.65%/次有效检查；风险修正也不会令其完全免疫。

常规赛剩四场的半月板手术现在结算 32 场伤停，严重度为 major，不允许带伤出战；常规赛结束后仍覆盖 28 场季后赛。脑震荡同样禁止带伤出战。康复仍使用场次抽象，未实现独立的自然日医学流程。参照：[NBA 脑震荡流程](https://pr.nba.com/nba-concussion-policy-2011/)。

10 种新秀类型的主项封顶回归全部通过；较大的成长请求不会获得更少成长，单季预算和技能上下界仍受约束。

| 球员 | 三分出手/场（前→后） | 投篮命中率（前→后） | 罚球命中率（前→后） |
|---|---:|---:|---:|
| Nic Claxton | 3.55 → 0.06 | 45.36% → 61.11% | 78.90% → 70.44% |
| Rudy Gobert | 0.05 → 0.05 | 49.10% → 65.91% | 74.92% → 51.84% |
| Stephen Curry | 10.22 → 10.79 | 47.94% → 47.52% | 86.37% → 93.01% |

低用量射手的少量三分样本不能单独用于命中率验收；这里重点验证其出手角色。

## 统计结果

5220 场名单组合模拟，30 队互相各打 12 场，主客场交替；可用性年龄统一为 27 岁控制年龄因素。另有每配置 2500 场固定轮换对照。不是现实赛程重放。

| 每队场均 | 数值 |
|---|---:|
| 得分 | 115.89 |
| 出手 | 87.65 |
| 罚球出手 | 20.88 |
| 三分出手 | 34.03 |
| 篮板 | 44.46 |
| 前场篮板 | 8.87 |
| 助攻 | 24.79 |
| 抢断 | 7.79 |
| 盖帽 | 4.48 |
| 失误 | 13.67 |

投篮 49.82%，三分 35.11%，罚球 79.49%；FTA/FGA=0.2382。NBA 2024–25 对应罚球率为 0.243。[NBA 官方数据](https://www.nba.com/news/10-numbers-know-first-10-days-2025-26)

独立统计校验覆盖 12300 场、30 队，守恒错误 0。十个 82 场周期的榜首均值：得分 31.40、篮板 13.42、助攻 11.62、抢断 2.71、盖帽 2.38。

## 额外检查发现：逐人统计仍有偏差

统一为每 36 分钟，对比仓库已有 2025–26 NBA/ESPN 样本；现实至少 20 场、15 分钟，模拟至少 150 场、15 分钟，合计 214 名球员。当前球队与队友已经变化，差值是进一步校准的证据，不能直接当作应补的属性点。

| 项目 | 球员 | 模拟/36 分钟 | 现实样本/36 分钟 |
|---|---|---:|---:|
| 得分 | Joel Embiid | 15.46 | 30.60 |
| 得分 | Victor Wembanyama | 16.93 | 30.82 |
| 得分 | Lauri Markkanen | 16.90 | 28.02 |
| 助攻 | T.J. McConnell | 5.88 | 10.73 |
| 助攻 | Jusuf Nurkic | 1.84 | 6.52 |
| 助攻 | Isaiah Hartenstein | 0.72 | 5.26 |
| 失误 | Ja Morant | 2.21 | 4.49 |
| 失误 | Giannis Antetokounmpo | 1.77 | 3.98 |
| 失误 | Russell Westbrook | 1.91 | 4.10 |

上述额外发现尚未做逐人数据修正：进攻型内线产量不足、部分组织型内线助攻偏低、持球核心失误偏低。原案例与球队总体分布通过，不等于这批新增问题已经解决。

## 验证记录

以下命令已通过：

- node scripts/check_inline_scripts.js
- node scripts/validate_player_attribute_schema.js
- node scripts/validate_league_attribute_provenance.js
- node scripts/validate_unified_player_model.js
- node scripts/validate_league_ovr_anchor.js
- node scripts/validate_player_training_growth.js
- node scripts/validate_offseason_attribute_evolution.js
- node scripts/validate_v2_career_full_chain.js
- node scripts/validate_event_system.js
- node scripts/validate_manager_mode.js
- node scripts/validate_generated_rookie_pipeline.js
- node scripts/validate_v2_interior_usage.js
- node scripts/validate_v2_engine_extreme_cases.js
- node scripts/validate_simulation_v2.js --mode=integration
- node scripts/validate_simulation_v2.js --mode=statistical
- node scripts/validate_v2_win_calibration.js --mode=statistical
- node scripts/validate_season_strength_calibration.js --engine=v2 --mode=smoke（12 赛季）
- node scripts/validate_basketball_realism.js（0 个失败）
- git diff --check

部分旧数值断言随新规则更新：CLU 不再要求超过 8 点的总评差；罚球下限提高至 18，抢断采用 6–10 区间；固定分钟极低能力合成球员仍单独设上界。胜率仍保留单调性与独立的 2 个百分点预测误差门槛。原 HEAD 的旧胜率校验也失败，复现保留在 output/baseline-win-calibration.log。

长期验证通过：5 个固定种子 × 35 赛季，共 175 个联盟赛季，failureCount=0。20–35 季检查点的 90+ 球员平均数量为 25.4–27.8，最高 OVR 均值为 95.2–96.4；没有出现 99 OVR 泛滥。

复现命令（PowerShell）：

```powershell
$env:LONG_TERM_OVR_SEEDS='5'
node scripts/validate_long_term_league_ovr.js
```

早先的 100 种子运行已中止，最终结论不包含该未完成运行。未做浏览器 UI 操作，未对 V1 作完整统计校准。
