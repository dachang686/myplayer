# 事件系统审查问题修复复核

本文件记录 `event-system-audit-20260912.md` 中已修复的问题及验证结果。

## 已修复

### 旧队友季后赛误触发

- 根因：旧队友长线只检查“已达到开场场次”。季后赛内部场次编号为 `1000 + 已打季后赛场数`，所以首轮首场必然超过常规赛排定的开场场次；原逻辑没有比较本场对手，导致只要两队都在首轮就可能在错误系列赛提示重逢。
- 修复：旧队友线现在读取其在实时联盟名单中的球队，并要求本场 `game.opponent` 与该球队一致。球员转会后，旧的 payload 球队不会继续作为触发依据。

实现：[旧队友对阵守卫](/C:/kevin/myplayer/index.html:13258)。

验证：`npm run test:events` 新增 `formerTeammateMatchupGuard`。该用例断言在 `PLAYOFF_OTHER` 的首轮不触发，在旧友转会后的 `PLAYOFF_OLD` 对阵中触发。

### 纪律事件概率与因果

- 常规赛纪律通道基础检查率由 0.55% 调整为 0.18%，季后赛为 0.25%。
- 所有严重事件不再对无前因的球员开放：斗殴、推搡裁判、冲突等要求接近比分和争议度；媒体类事件要求输球、接近比分或足够争议度。
- 药检违规不再作为随机指控出现。只有存档中的 `supplementViolationPending` 明确为真时，才可触发 25 场禁赛，结算后会清除该标记。
- 赛后采访拒绝、公开批评裁判、社交媒体不当言论改为罚款，统一通过 `fine` 结算为 `mediaTrust -1` 与 `controversy +1`；不再错误触发停赛。

实现：[纪律上下文与频率](/C:/kevin/myplayer/index.html:14030)、[处罚结算](/C:/kevin/myplayer/index.html:14303)、[事件定义](/C:/kevin/myplayer/index.html:15320)。

### 赛后触发与事件文字

- `shower_slip`、`food_poisoning`、`towel_slip` 统一为赛后诊断，并结算为下一场缺席一场，避免已打完比赛却声称本场被减分钟。
- 关键时刻剧情只允许出现在赢 3 分以内，且要求对应得分或助攻门槛；文字改为最后阶段的关键贡献，不再声明引擎未记录的压哨命中。
- `power_outage` 改为赛后的训练设施问题，避免对已结算比赛虚构第三节中断。

实现：[健康事件](/C:/kevin/myplayer/index.html:14719)、[关键时刻事件](/C:/kevin/myplayer/index.html:15066)、[设施事件](/C:/kevin/myplayer/index.html:15258)。

### 忠诚剧情的真实结算

- 公开承诺写入的 `career.profile.loyalty` 已接入续约意愿与主动申请交易的审批概率。
- 在固定随机数 0.95、OVR 86 的控制条件下：中性忠诚不会续约，忠诚 +4 会续约；主动交易获批率由 64 降至 59。忠诚 -3 时获批率为 68。

实现：[续约意愿](/C:/kevin/myplayer/js/offseason.js:112)、[交易审批](/C:/kevin/myplayer/js/offseason.js:2390)。

### 休赛期主线数量

- 退役倒计时现在纳入 `OFFSEASON_MAX_MAIN_EVENTS` 的两条主线总上限；强制关系和跨界事件同样只有在尚有容量时才加入。

实现：[队列构建](/C:/kevin/myplayer/index.html:9197)。

## 验证

- `npm run test:events`：通过。覆盖 98 条事件的注册、选择与结算；并新增纪律条件、罚款、健康缺席、药检前因、忠诚结算和主线数量断言。
- `node scripts/check_inline_scripts.js`：通过，7 个内联脚本与 18 个本地模块均可解析。
- `node scripts/validate_player_trade_payroll.js`：通过，交易后薪资约束正确。
- `node scripts/validate_manager_mode.js`：通过，1230 场常规赛和 89 场季后赛的经理模式模拟完成。
- `node scripts/validate_v2_engine_extreme_cases.js`：通过，500 场脏属性与零分钟明星等极端阵容校验无失败。
- `node scripts/validate_basketball_realism.js`：通过，`failureCount: 0`；文班亚马得分角色偏差为 11.33%，在接受范围内。

`git diff --check` 未发现空白错误；输出仅为 Windows 行尾转换提示。
