# 事件内容、触发与结算审查

审查范围是默认生涯事件系统：`EVENT_REGISTRY` 的 98 条随机事件、赛季导演、分支事件队列、伤停/禁赛、短期球队效果及档案字段。没有修改游戏逻辑。

## 已确认问题

### P0：禁赛池会把严重违规当作常见赛季随机事件

`discipline` 通道在常规赛每场有 0.55% 的独立触发机会，赛季最多一次；16 个候选中全部 `condition: true`。其中 11 个 `susp_` 禁赛事件合计权重 165，总权重 216，占 76.39%。在 82 场都可检查的简化口径下，至少一次纪律事件概率为 `1-(1-0.0055)^82 = 36.38%`，其中落到禁赛的近似概率为 27.79%。伤停会减少可检查场次，因此实际值略低，但量级没有改变。

这意味着普通新秀、无技术犯规、无争议行为的玩家，仍会以约三成赛季概率遭遇停车场斗殴、药检阳性、锁喉或冲进对手更衣室。所有这类内容不仅没有前置行为证据，权重还相同。

证据：[`getRandomEventLaneRate`](/C:/kevin/myplayer/index.html:14030)、[`checkRandomEvents`](/C:/kevin/myplayer/index.html:14378)、禁赛定义从 [`susp_parking_fight`](/C:/kevin/myplayer/index.html:15264) 至 [`susp_choke`](/C:/kevin/myplayer/index.html:15375)。NBA 官方近期案例中，药检违规可导致 25 场停赛，而拒绝赛后采访及公开批评裁判通常是罚款，并不等同于自动禁赛。[药检 25 场](https://official.nba.com/milwaukee-bucks-bobby-portis-jr-suspended-25-games/)，[采访违规罚款](https://pr.nba.com/kyrie-irving-nets-fined/)，[批评裁判罚款](https://pr.nba.com/devin-booker-fined-4-23-26/)。

### P0：事件在比赛结束后结算，却大量叙述为本场已经发生的比赛中行为

常规赛流程先运行 `simulateGameNew`、写入本场数据和胜负，最后才调用 `checkRandomEvents`。因此事件无法改变当前比分、上场时间、数据或本场可用性。

但以下内容都要求已经发生本场事件：`food_poisoning` 说第一、二节反复离场、教练减少上场时间；`power_outage` 说第三节停电并中断节奏；`celebrate_coach`、`behind_the_back`、`gamemom_call`、`towel_celebration` 都要求压哨绝杀或最后一攻。实际事件只有文本，没有回写本场箱分或比赛状态。

证据：[`simulateGameNew` 后才检查事件](/C:/kevin/myplayer/index.html:4406)、[`checkRandomEvents` 调用](/C:/kevin/myplayer/index.html:4442)；对应事件见 [`food_poisoning`](/C:/kevin/myplayer/index.html:14699)、[`celebrate_coach`](/C:/kevin/myplayer/index.html:14758)、[`behind_the_back`](/C:/kevin/myplayer/index.html:15033)、[`gamemom_call`](/C:/kevin/myplayer/index.html:15044)、[`towel_celebration`](/C:/kevin/myplayer/index.html:15055)、[`power_outage`](/C:/kevin/myplayer/index.html:15225)。V2 只记录加时为 `keyEvents`，没有最后一攻、压哨命中、个人绝杀等可供触发条件读取的比赛信号。[V2 事件记录](/C:/kevin/myplayer/js/simulation_v2.js:1400)

### P1：健康/出场叙事未进入任何结算

`shower_slip` 明确写“队医确认轻微扭伤”，`food_poisoning` 明确写“教练减少上场时间”，`towel_slip` 写腹股沟不适；它们均是 story lane，返回值没有 `_consequence: 'injury'`、伤停场次、分钟因子或下一场减益。自动结算函数也只处理少量固定 ID，未包含以上事件。

这会让玩家看到健康或轮换后果的内容，但实际比赛完全不受影响；同时真伤病事件则全部直接缺席，不存在“轻微不适、短时限、带伤降分钟”的连续层级。

证据：[`shower_slip`](/C:/kevin/myplayer/index.html:14686)、[`food_poisoning`](/C:/kevin/myplayer/index.html:14699)、[`towel_slip`](/C:/kevin/myplayer/index.html:14744)；[`applyAutomaticEventImpact`](/C:/kevin/myplayer/index.html:14274)；真正伤停仅在 [`checkRandomEvents`](/C:/kevin/myplayer/index.html:14400) 写入 `injuryGamesLeft`。

### P1：关键时刻叙事的触发条件不足以支撑文本事实

`behind_the_back` 仅要求赢球且助攻至少 8；`gamemom_call` 仅要求得分至少 35；`towel_celebration` 仅要求赢球且得分至少 25。它们都可能在大比分胜利、没有最后一攻或没有个人绝杀的比赛后触发。`celebrate_coach` 连这三项门槛都没有。

现有上下文筛选只覆盖少数事件，不能识别“最后五秒”“比分打平”“压哨命中”这类文本承诺。应补充 V2 的最终回合/关键命中事件数据，或把这些故事改为不声称具体比赛事实的赛后版本。

证据：[`meetsRandomEventContext`](/C:/kevin/myplayer/index.html:14171)、事件定义见上节链接。

### P1：交易剧情的“忠诚”结算没有进入真实续约/留队模型

交易截止日剧情的“公开承诺留队”写入的是 `career.profile.loyalty`；主动要求交易则减这个字段。但联盟留队概率读取的是球员基因 `getPlayerLoyalty(player)`，由 `gene.loyalty` 决定。两者没有同步。因此文本所称“承诺会继续影响之后的阵容判断”缺少对应的真实留队结算。

证据：[`applyCareerEventVariantChoice`](/C:/kevin/myplayer/index.html:12219)、[`getPlayerLoyalty`](/C:/kevin/myplayer/js/offseason.js:4195)、[`calculateContractStayRate`](/C:/kevin/myplayer/js/offseason.js:4385)。

### P2：休赛期“最多两条主线”的队列上限没有计入退役倒计时

`buildOffseasonBranchQueue` 先把退役倒计时事件压入队列，但 `forcedMainCount` 只统计恋爱和 crossover 强制项。后续仍按 `OFFSEASON_MAX_MAIN_EVENTS = 2` 追加普通主线。因此倒计时赛季可能出现“倒计时 + 两条普通主线”，与变量名称和赛季中“倒计时独占”的规则不一致。

证据：[`OFFSEASON_MAX_MAIN_EVENTS`](/C:/kevin/myplayer/index.html:9178)、[`buildOffseasonBranchQueue`](/C:/kevin/myplayer/index.html:9197)、[`forcedMainCount`](/C:/kevin/myplayer/index.html:9243)。

## 正常或已覆盖的部分

- 伤停与禁赛会在下一场开始缺席；伤病优先级和缺席计数有存档兼容层。
- 重伤、脑震荡、手术不能选择带伤出战；伤停与复出剧情有实例标识，避免旧事件重复结算。
- 短期 `teamEdge` 能进入 V2 的赛前分差，且每场只消费一次；赛季导演事件会同时记录到时间线和导演日志。
- 事件生命周期、队友换队、季后赛记忆、重复结算和旧存档迁移已有覆盖测试。

## 已运行验证

`node scripts/validate_event_system.js` 通过：98 条事件、描述/选择结构、伤停禁赛、短期效果、导演剧情、生命周期、队友迁移均通过。

`node scripts/check_inline_scripts.js` 通过：7 个内联脚本与 18 个本地模块可解析。

这些验证说明系统没有结构性断链；它们没有覆盖本报告列出的现实概率、文本与比赛事实一致性、或 profile 与基因字段之间的语义同步。
