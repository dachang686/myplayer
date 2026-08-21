const BRANCH_BIBLE = {
  china_team: { name: '中国男篮', layer: 'identity', unlocks: ['china_market', 'legacy'] },
  relationship: { name: '恋爱', layer: 'life', unlocks: ['family', 'brand', 'controversy'] },
  family: { name: '家庭', layer: 'late_career', unlocks: ['retirement_choice', 'post_career'] },
  network: { name: '高尔夫 / 人脉', layer: 'career_power', unlocks: ['rich_paul', 'brand'] },
  rich_paul: { name: '明星经纪团队', layer: 'career_power', unlocks: ['transfer'] },
  mentor: { name: '巨星导师', layer: 'growth', unlocks: ['rich_paul', 'signature_style'] },
  training: { name: '夏日训练', layer: 'growth', unlocks: ['signature_style', 'rich_paul'] },
  skill_training: { name: '专项训练', layer: 'growth', unlocks: ['signature_style', 'playoff_moment'] },
  team_practice: { name: '球队合练 / 队内领袖', layer: 'team', unlocks: ['teammate_bond', 'legacy'] },
  teammate_bond: { name: '队友羁绊', layer: 'team', unlocks: ['playoff_moment'] },
  china_market: { name: '中国市场', layer: 'business', unlocks: ['shoe_brand', 'legacy'] },
  brand: { name: '商业 / 品牌', layer: 'business', unlocks: ['shoe_brand', 'controversy'] },
  shoe_brand: { name: '球鞋品牌', layer: 'business', unlocks: ['legacy'] },
  media: { name: '媒体形象', layer: 'identity', unlocks: ['brand', 'controversy'] },
  fan_culture: { name: '球迷文化', layer: 'identity', unlocks: ['brand', 'legacy'] },
  crossover: { name: '揽佬 · 中国人能飞', layer: 'season_texture', unlocks: ['fame', 'fan_culture'] },
  mental_health: { name: '心理健康', layer: 'risk', unlocks: ['retirement_choice', 'legacy'] },
  city_culture: { name: '城市文化', layer: 'team', unlocks: ['legacy', 'retirement_choice'] },
  family_children: { name: '家人孩子', layer: 'late_career', unlocks: ['retirement_choice', 'post_career'] },
  training_camp: { name: '训练营', layer: 'legacy_seed', unlocks: ['post_career', 'legacy'] },
  charity: { name: '公益', layer: 'identity', unlocks: ['legacy', 'post_career'] },
  retirement_countdown: { name: '退役倒计时', layer: 'late_career', unlocks: ['retirement_choice', 'legacy'] },
  controversy: { name: '道德 / 争议', layer: 'risk', unlocks: ['legacy'] },
  coach_role: { name: '教练关系 / 队内地位', layer: 'team', unlocks: ['team_practice'] },
  transfer: { name: '转会风波', layer: 'career_power', unlocks: ['contender_window', 'legacy'] },
  contender_window: { name: '争冠窗口', layer: 'championship', unlocks: ['dynasty'] },
  dynasty: { name: '王朝', layer: 'championship', unlocks: ['legacy'] },
  all_star_weekend: { name: '全明星周末', layer: 'season_texture', unlocks: ['brand', 'fame'] },
  playoff_moment: { name: '季后赛名场面', layer: 'championship', unlocks: ['legacy'] },
  milestone: { name: '数据里程碑', layer: 'legacy_seed', unlocks: ['legacy', 'brand'] },
  retirement_choice: { name: '晚年退役倾向', layer: 'late_career', unlocks: ['legacy', 'post_career'] },
  legacy: { name: '历史地位', layer: 'ending', unlocks: ['jersey_retirement', 'hall_of_fame', 'top100'] },
  post_career: { name: '退役后身份', layer: 'ending', unlocks: [] }
};

const BRANCH_EVENTS = [
  {
    id: 'national_team',
    branch: 'china_team',
    phase: 'offseason',
    slot: 'main',
    weight: 12,
    title: '中国男篮征召',
    body: '中国男篮向你发来正式征召。这个夏天，国家队需要一个真正能扛球权的人。经纪团队提醒你：这是荣誉，也是压力，回到新赛季时身体负担会更重。',
    choices: [
      { label: '接受中国男篮征召', hint: '获得国家队历练和舆论声望，但新赛季伤病/疲劳风险提高', apply: function() {
        var mods = getNextSeasonMods();
        var tournament = getChinaTournamentName();
        var branch = advanceBranch('china_team', 1, { status: 'accepted', lastTournament: tournament });
        branch.reputation = (branch.reputation || 0) + 2;
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 3);
        addAttrDelta('CLU', 1); addAttrDelta('PAS', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '你抵达中国男篮训练基地的第一天，教练组就把' + tournament + '最后五分钟的战术板交到你手里。队友们看着你，没人说话，但所有人都知道这个夏天的球权会从你这里开始。',
          tournament + '热身赛最后一攻，你在高位叫挡拆，吸引包夹后把球塞到底角。三分命中后，替补席全部站了起来，国内媒体第二天把标题写成了：中国队终于有了自己的核心。',
          tournament + '小组赛面对强硬防守，你连续几个回合被撞倒。你没有抱怨，下一回合直接顶着对抗杀进内线。那一晚之后，中国男篮更衣室默认你是关键时刻的第一选择。'
        ]);
        var roll = Math.random();
        var result = '';
        if (roll < 0.18) {
          addAttrDelta('CLU', 1);
          result = '带队爆发：淘汰赛里你连续命中关键球，中国队打出了近年最振奋的一段国际赛事。赛后你没有庆祝太久，只在采访里说：这不是终点。额外效果：关键球+1。';
        } else if (roll < 0.42) {
          addAttrDelta('PAS', 1);
          result = '血战晋级：你们每一场都打到最后两分钟，身体消耗巨大，但你学会了在更小的空间里找到队友。额外效果：传球+1。';
        } else if (roll < 0.7) {
          mods.formVariance = Math.min(3, (mods.formVariance || 0) + 1);
          result = '遗憾出局：最后一场赛后，你在替补席坐了很久。网上的争论铺天盖地，有人夸你扛起球队，也有人把失败全压到你肩上。额外影响：下赛季状态波动略升。';
        } else {
          mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
          result = '受伤隐患：密集赛程让你的腿部疲劳一直没有完全消下去。队医没有给出严重诊断，但新赛季开始前，训练师明显更谨慎。额外影响：下赛季伤病/疲劳风险继续上升。';
        }
        return scene + '<br><br>' + result + '<br><br>基础效果：关键球+1，传球+1；下赛季伤病/疲劳事件风险上升。';
      }},
      { label: '婉拒征召，专注恢复', hint: '降低开季波动，但可能承受外界议论', apply: function() {
        var mods = getNextSeasonMods();
        var branch = advanceBranch('china_team', 1, { status: 'declined' });
        branch.controversy = (branch.controversy || 0) + 1;
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        var scene = pickOffseasonText([
          '你给国家队回了一通很长的电话。你说自己尊重这身球衣，但这个夏天必须把身体彻底修好。电话那头沉默了几秒，最后只说：希望下次还能等到你。',
          '拒绝征召的消息出来后，舆论很快分成两派。有人理解你的身体管理，也有人质疑你的责任感。你没有回应，只是在训练馆里把手机调成静音。',
          '经纪团队建议你发一份声明，你删掉了所有漂亮话，只留下几句简单的感谢。接下来的几周，你把每天的恢复课排得比常规训练还满。'
        ]);
        return scene + '<br><br>效果：你保留了完整休整周期；下赛季状态波动略微降低。';
      }}
    ]
  },
  {
    id: 'superstar_camp',
    branch: 'mentor',
    phase: 'offseason',
    slot: 'main',
    weight: 13,
    title: '巨星训练营邀请',
    body: '休赛期你收到几个私人训练营邀请。它们不只是训练课，更像一次路线选择：你要从谁身上偷走一部分比赛理解？',
    choices: [
      { label: '奥拉朱旺脚步训练', hint: '内线、防守、篮板提升', apply: function() {
        advanceBranch('mentor', 1, { lastMentor: 'hakeem' });
        var great = Math.random() < 0.28;
        var rough = !great && Math.random() < 0.18;
        addAttrDelta('FIN', great ? 3 : 2); addAttrDelta('IDEF', 1); addAttrDelta('REB', rough ? 0 : 1); STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '奥拉朱旺没有急着教动作，他先让你在低位连续转身二十分钟。每次你以为找到了节奏，他都会轻轻摇头：脚先骗过人，球只是最后的证明。',
          '训练馆很安静，只有鞋底摩擦地板的声音。奥拉朱旺把防守人想象成一扇门，告诉你不要撞门，要让门自己打开。',
          '你在录像室看了一整晚低位脚步。第二天训练时，你第一次发现，背身不是慢下来，而是把防守者拖进你的时间里。'
        ]);
        if (great) return scene + '<br><br>特殊结果：你突然理解了假动作的节奏，连续几次把陪练晃到失位。奥拉朱旺笑着拍了拍你的肩。<br><br>效果：终结+3，内防+1，篮板+1。';
        if (rough) return scene + '<br><br>负面结果：低位细节比你想象中折磨人，脚踝和腰背承受了不少压力。你学到了东西，但没有完全吃透篮板卡位部分。<br><br>效果：终结+2，内防+1。';
        return scene + '<br><br>普通结果：你的低位脚步更稳，面对错位时多了一个可靠惩罚手段。<br><br>效果：终结+2，内防+1，篮板+1。';
      }},
      { label: '杜兰特投射训练', hint: '中投和三分提升', apply: function() {
        advanceBranch('mentor', 1, { lastMentor: 'durant' });
        var great = Math.random() < 0.3;
        var rough = !great && Math.random() < 0.16;
        addAttrDelta('MID', great ? 3 : 2); addAttrDelta('threePT', rough ? 0 : (great ? 2 : 1)); STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '杜兰特看了你两组投篮，只说了一句：别急着摆脱，先学会在防守人面前舒服。之后整堂课，他都让你在贴身干扰下出手。',
          '训练内容简单到残酷：同一个肘区，同一个防守角度，连续投到手臂发麻。杜兰特告诉你，伟大的投篮不是空位准，而是被看穿后依然能进。',
          '你问杜兰特怎么判断该不该拔起来。他指了指地板：当你相信这个点属于你，防守人就已经晚了。'
        ]);
        if (great) return scene + '<br><br>特殊结果：某个下午，你连续命中十几记高难度干拔，训练馆里的人开始停下来看。你的出手点变得更高，也更不讲理。<br><br>效果：中投+3，三分+2。';
        if (rough) return scene + '<br><br>负面结果：你试图复制太多高难度节奏，三分线外短暂失准。好消息是，中距离单打脚步明显干净了。<br><br>效果：中投+2。';
        return scene + '<br><br>普通结果：你的急停和面框节奏更稳定，尤其在中距离区域开始有了自己的甜点位。<br><br>效果：中投+2，三分+1。';
      }},
      { label: '詹姆斯身体训练', hint: '运动能力、力量、终结提升', apply: function() {
        advanceBranch('mentor', 1, { lastMentor: 'lebron' });
        var great = Math.random() < 0.25;
        var agency = Math.random() < 0.22;
        addAttrDelta('ATH', great ? 2 : 1); addAttrDelta('STR', 1); addAttrDelta('FIN', 1); if (agency) addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '詹姆斯的训练不是单纯上重量。他会在冲刺、对抗、传球阅读之间来回切换，让你在最累的时候做最清醒的决定。',
          '凌晨的力量房里，詹姆斯一边训练一边和你聊如何照顾一个漫长职业生涯。他说天赋让人进联盟，习惯才决定你能待多久。',
          '你以为这是身体课，结果一半时间都在看录像。詹姆斯反复暂停同一个回合，问你：如果你是持球人，第三个选择在哪里？'
        ]);
        var extra = agency ? '<br><br>隐藏结果：训练结束后，一支明星经纪团队主动和你聊了几句。他们没有立刻谈合作，但你能感觉到，这条线以后可能会再出现。额外效果：传球+1。' : '';
        if (great) return scene + '<br><br>特殊结果：你的身体适应速度超出预期，对抗后的起跳和二次发力都有提升。<br><br>效果：运动+2，力量+1，终结+1。' + extra;
        return scene + '<br><br>普通结果：你的核心力量和冲击篮筐稳定性提升，长赛季身体管理意识也更强。<br><br>效果：运动+1，力量+1，终结+1。' + extra;
      }},
      { label: '保罗控场训练', hint: '控球、传球、关键球提升', apply: function() {
        advanceBranch('mentor', 1, { lastMentor: 'paul' });
        var great = Math.random() < 0.28;
        var rough = !great && Math.random() < 0.14;
        addAttrDelta('HAN', 1); addAttrDelta('PAS', great ? 3 : 2); addAttrDelta('CLU', rough ? 0 : 1); STATE.finalOVR = calcOVR(STATE.attrs);
        var scene = pickOffseasonText([
          '保罗训练你的方式很烦人：每个回合都要你先说出弱侧第二个防守人的站位。你答慢半秒，他就把球拿走重来。',
          '你们花了一下午练挡拆，但真正练的不是传球，而是等待。保罗说，控卫最值钱的能力，是让九个人都先暴露答案。',
          '保罗把训练赛切成无数个最后两分钟。他不断提醒你，关键球不是英雄球，而是让对手在最紧张的时候做选择题。'
        ]);
        if (great) return scene + '<br><br>特殊结果：你开始能提前一拍读到协防，几次传球让防守完全来不及轮转。保罗说：现在你不是在运球，你是在调度。<br><br>效果：控球+1，传球+3，关键球+1。';
        if (rough) return scene + '<br><br>负面结果：你学了太多节奏控制，短期内出手欲望被压低，关键球侵略性没有同步提升。<br><br>效果：控球+1，传球+2。';
        return scene + '<br><br>普通结果：你的挡拆阅读更稳，开始学会用停顿和眼神制造传球角度。<br><br>效果：控球+1，传球+2，关键球+1。';
      }}
    ]
  },
  {
    id: 'skill_breakthrough',
    branch: 'skill_training',
    phase: 'offseason',
    slot: 'main',
    weight: 11,
    title: '专项技术突破',
    body: '训练师建议你把整个夏天押在一项技术上。高投入有机会换来突飞猛进，也可能遇到瓶颈，甚至因为过度训练把风险带进新赛季。',
    choices: [
      { label: '冲击投射突破', hint: '大概率小涨，小概率大涨', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'shooting' });
        return applyTrainingOutcome('threePT', 'MID', 'shootingPity', [
          '你把整个夏天拆成无数个投篮点：底角、45度、弧顶、肘区。训练师不再数命中，只记录你在疲劳后的出手是否还保持同一个轨迹。',
          '每天训练结束后，你都会留下来多投一百个接球三分。灯光关掉一半，球馆里只剩篮网被刷动的声音。',
          '投篮教练把你的出手慢放到每一帧，指出手肘、脚尖和落地位置。你第一次意识到，稳定不是感觉，是重复。'
        ], { primary: '三分', secondary: '中投' });
      }},
      { label: '冲击持球突破', hint: '提升控球与终结', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'handle' });
        return applyTrainingOutcome('HAN', 'FIN', 'handlePity', [
          '训练师在半场摆满障碍物，让你每次突破前都必须先读出协防位置。你不只是练运球，也是在练怎么让防守提前犯错。',
          '你连续几天只练第一步和最后一步。第一步要骗过人，最后一步要扛住人，中间所有花活都被训练师删掉。',
          '陪练不断换成更高、更壮、更快的防守者。你被断、被撞、被盖，但慢慢开始知道该用哪个角度进入身体。'
        ], { primary: '控球', secondary: '终结' });
      }},
      { label: '冲击防守突破', hint: '提升外防与抢断', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'defense' });
        return applyTrainingOutcome('PDEF', 'STL', 'defensePity', [
          '你花了一周只练横移和追防。教练不让你赌博式抢断，只要求你每次都把持球人赶到最难受的位置。',
          '录像课里，你反复看联盟顶级侧翼如何提前半步卡住路线。第二天训练，你开始在对手启动前就移动脚步。',
          '防守训练没有漂亮镜头，只有一次次被过后的重来。你慢慢学会用身体角度，而不是手，去夺走对手的舒服空间。'
        ], { primary: '外防', secondary: '抢断' });
      }},
      { label: '冲击身体终结', hint: '提升力量与终结', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'strength' });
        return applyTrainingOutcome('STR', 'FIN', 'strengthPity', [
          '力量房和禁区训练被排在同一天。你先把身体练到发沉，再去篮下完成对抗终结，训练师说这才像第四节的真实比赛。',
          '每一次上篮都有陪练撞你的肩膀和腰。你开始学会不是躲开对抗，而是借着对抗把球送到更高的位置。',
          '这个夏天你几乎不练轻松的扣篮，只练失衡、被拉拽、被延误后的终结。难看，但有用。'
        ], { primary: '力量', secondary: '终结' });
      }},
      { label: '冲击组织突破', hint: '提升传球与关键球', apply: function() {
        advanceBranch('skill_training', 1, { lastFocus: 'playmaking' });
        return applyTrainingOutcome('PAS', 'CLU', 'playmakingPity', [
          '你和助教把每套战术拆成三层选择：第一选择被锁死，第二选择被延误，第三选择才是真正能赢季后赛的球。',
          '训练赛里，教练要求你每次叫挡拆前先喊出弱侧两个队友的位置。你开始发现，传球不是看见人，而是提前知道人会到哪里。',
          '你被禁止连续两回合用同一种方式发起进攻。这个限制很别扭，却逼你把比赛读得更完整。'
        ], { primary: '传球', secondary: '关键球' });
      }}
    ]
  },
  {
    id: 'team_practice',
    branch: 'team_practice',
    phase: 'offseason',
    slot: 'main',
    weight: 9,
    title: '球队合练',
    body: '队友们约你提前回到训练馆合练。教练组认为这能让球队更快进入状态。',
    choices: [
      { label: '组织球队合练', hint: '提升球队默契，降低开季波动', apply: function() {
        advanceBranch('team_practice', 1, { status: 'organized' });
        var mods = getNextSeasonMods();
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 2);
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '球队合练完成：传球+1，球队默契提升';
      }},
      { label: '个人恢复优先', hint: '减少身体负担', apply: function() {
        advanceBranch('team_practice', 1, { status: 'recovery' });
        var mods = getNextSeasonMods();
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return '你选择恢复：新赛季伤病风险略降';
      }}
    ]
  },
  {
    id: 'dating_star',
    branch: 'relationship',
    phase: 'offseason',
    slot: 'main',
    weight: 8,
    title: '约会邀请',
    body: '休赛期刚开始，一位很有名的女明星通过共同朋友给你发来邀请。经纪团队提醒你：这可能是轻松的夏天，也可能把你的名字送上娱乐版头条。',
    requires: function() {
      var c = STATE.career || {};
      return (c.currentAge || 22) >= 22 && ((STATE.finalOVR || 0) >= 82 || hasCareerHonor('全明星') || hasCareerHonor('最佳阵容'));
    },
    choices: [
      { label: '接受女明星邀约', hint: '可能状态火热，也可能陷入感情纠纷', apply: function() {
        var c = STATE.career;
        c.relationships = c.relationships || {};
        advanceBranch('relationship', 1, { status: 'dating' });
        var mods = getNextSeasonMods();
        var roll = Math.random();
        var intro = pickOffseasonText([
          '你们第一次见面是在一个很低调的私人餐厅。她没有问你数据，也没有问合同，只问你赢球后为什么总是先低头。你突然发现，这个夏天可能不会只属于训练馆。',
          '她在演唱会后台给你留了一张通行证。灯光、尖叫和舞台烟雾把夜晚变得不真实，你坐在角落里，第一次感觉自己像是闯进了另一个联盟。',
          '她约你去海边散步，身边没有镜头，也没有队友。你们聊到凌晨，话题从电影到伤病，从孤独到总冠军，最后谁也没提明天的训练。'
        ]);
        if (roll < 0.25) {
          c.relationships.partner = { type: 'actress', status: 'stable', sinceSeason: c.seasonCount, volatility: 1 };
          mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
          addAttrDelta('CLU', 1);
          STATE.finalOVR = calcOVR(STATE.attrs);
          return intro + '<br><br>状态火热：这段关系没有打乱你，反而让你在训练和比赛里更想证明自己。朋友说你整个人轻了一点，关键时刻却更硬。<br><br>效果：关键球+1；下赛季状态波动略降。';
        }
        if (roll < 0.5) {
          c.relationships.partner = { type: 'singer', status: 'distraction', sinceSeason: c.seasonCount, volatility: 3 };
          mods.formVariance = Math.min(4, (mods.formVariance || 0) + 2);
          return intro + '<br><br>乐不思蜀：你开始频繁改训练时间，只为了配合她的行程。训练师没有明说，但白板上你的缺席记录越来越显眼。<br><br>效果：下赛季状态波动上升。';
        }
        if (roll < 0.72) {
          c.relationships.partner = { type: 'athlete', status: 'rumor', sinceSeason: c.seasonCount, volatility: 4 };
          mods.formVariance = Math.min(5, (mods.formVariance || 0) + 3);
          mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 1);
          return intro + '<br><br>感情纠纷：几张模糊照片被放到网上，猜测和争吵迅速发酵。你不得不在训练后处理电话和声明，身体也没恢复得那么干净。<br><br>效果：下赛季状态波动明显上升；伤病/疲劳风险略升。';
        }
        c.relationships.partner = { type: 'actress', status: 'private', sinceSeason: c.seasonCount, volatility: 0 };
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        return intro + '<br><br>低调陪伴：你们决定不公开，也不把这件事变成新闻。队友偶尔调侃你，但更衣室气氛反而轻松了不少。<br><br>效果：球队默契略升。';
      }},
      { label: '礼貌拒绝，专注训练', hint: '放弃社交剧情，换取更稳定的夏天', apply: function() {
        advanceBranch('relationship', 1, { status: 'declined' });
        var roll = Math.random();
        if (roll < 0.55) {
          addAttrDelta('ATH', 1);
          STATE.finalOVR = calcOVR(STATE.attrs);
          return '你回了一条很短但体面的消息，然后把手机交给训练师保管。整个夏天，你的作息准得像比赛计时器。<br><br>效果：运动+1。';
        }
        return '你选择不让这个夏天偏离训练计划。媒体没有故事可写，朋友笑你无趣，但教练组很满意。<br><br>效果：无属性变化，但避免了感情线风险。';
      }}
    ]
  },
  {
    id: 'golf_network',
    branch: 'network',
    phase: 'offseason',
    slot: 'main',
    weight: 7,
    title: '名人高尔夫局',
    body: '赞助商给你安排了一场名人高尔夫局。球场上不只有挥杆，还有经纪团队、人脉圈和未来合作的试探。',
    requires: function() {
      return (STATE.career.currentAge || 22) >= 24 && ((STATE.finalOVR || 0) >= 85 || hasCareerHonor('全明星') || hasCareerHonor('总冠军'));
    },
    choices: [
      { label: '参加高尔夫局', hint: '可能遇到明星经纪团队、球星团队或商业机会', apply: function() {
        var c = STATE.career;
        c.flags = c.flags || {};
        advanceBranch('network', 1, { status: 'golf' });
        var mods = getNextSeasonMods();
        var roll = Math.random();
        var intro = pickOffseasonText([
          '你到球场时，几个熟悉的联盟面孔已经在练习果岭。这里没人穿球衣，但每一次寒暄都像在试探未来的合作空间。',
          '阳光很好，球车开得很慢。赞助商介绍你认识一桌人，有投资人、退役球员、经纪团队，也有几个你只在新闻里见过的名字。',
          '你原本只是想放松，结果第一洞还没打完，就有人开始聊阵容、市场和未来几年联盟的权力流向。'
        ]);
        if (roll < 0.25) {
          c.flags.richPaulContact = true;
          return intro + '<br><br>经纪团队线索：你和一支明星经纪团队在第九洞聊了很久。他们没有直接招募你，只说如果未来想管理更大的职业版图，可以再坐下来谈。<br><br>效果：记录经纪团队接触线，未来可联动经纪团队或球星训练营。';
        }
        if (roll < 0.48) {
          c.flags.curryCircle = true;
          addAttrDelta('threePT', 1);
          STATE.finalOVR = calcOVR(STATE.attrs);
          return intro + '<br><br>库里圈子：库里团队的人注意到你在果岭上的手感，玩笑说你的腕部控制像投篮。后来你们聊到训练和空间体系，对方留下了联系方式。<br><br>效果：三分+1；记录库里圈子线索。';
        }
        if (roll < 0.75) {
          mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
          return intro + '<br><br>放松成功：没有重大合作，也没有新闻爆点。你只是久违地从比赛压力里抽离出来，身体恢复得比预期更好。<br><br>效果：下赛季伤病/疲劳风险略降。';
        }
        c.flags.businessBuzz = true;
        mods.formVariance = Math.min(4, (mods.formVariance || 0) + 1);
        return intro + '<br><br>应酬过量：你认识了很多人，也拍了很多合照。商业曝光变多，但训练节奏被打碎，团队提醒你别让夏天变成巡演。<br><br>效果：记录商业热度；下赛季状态波动略升。';
      }},
      { label: '拒绝社交，留在训练馆', hint: '错过人脉，但得到纯训练收益', apply: function() {
        advanceBranch('network', 1, { status: 'training' });
        addAttrDelta('MID', 1);
        addAttrDelta('ATH', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        return '你婉拒了球局，把那一整天留给训练馆。助教说你可能错过了一些人脉，但你只回了一句：球会替我介绍自己。<br><br>效果：中投+1，运动+1。';
      }}
    ]
  }
];

const STAGED_BRANCH_EVENTS = [
  {
    id: 'china_team_first_call',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 12,
    title: '中国男篮：首次征召',
    scenes: [
      '国家队的正式征召函发到你的团队邮箱。标题很短，却让整个会议室安静下来：中国男篮集训名单确认。',
      '教练组没有把你当成普通新人。他们在战术板上写下你的名字，旁边标注：最后五分钟持球点。'
    ],
    body: '这是你第一次真正站到国家队选择面前。接受意味着荣誉和消耗，拒绝意味着恢复和争议。',
    requires: function() { return getBranchNode('china_team') === 'start'; },
    choices: [
      { label: '接受征召，证明自己', hint: '推进中国男篮线；关键球/传球提升，伤病风险上升', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('china_team', 'first_camp', { status: 'accepted', reputation: 2, controversy: 0, acceptedCount: 1 });
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
        addAttrDelta('CLU', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你穿上国家队训练服的第一天，队友们没有太多寒暄。训练赛最后一攻，教练直接把球交给你。<br><br>效果：关键球+1，传球+1；下赛季伤病风险上升。';
      }},
      { label: '婉拒征召，专注身体', hint: '降低波动，但留下舆论争议', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('china_team', 'second_call_after_decline', { status: 'declined', reputation: 0, controversy: 1, declinedCount: 1 });
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        return '你给教练组打了一通很长的电话。你说自己尊重这身球衣，但这个夏天必须把身体修好。消息传出后，舆论很快分成两派。<br><br>效果：下赛季状态波动略降。';
      }}
    ]
  },
  {
    id: 'china_team_second_call_after_decline',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 18,
    title: '中国男篮：再一次电话',
    scenes: [
      '去年婉拒之后，国家队没有把你的名字划掉。这个夏天，教练组再次打来电话。',
      '语气比第一次更克制，也更沉重：我们还是希望你回来，但这一次，我们需要一个明确答案。'
    ],
    body: '这不是简单的第二次邀请。你需要修复外界对你态度的怀疑，也需要重新决定身体和国家队之间的顺序。',
    requires: function() { return getBranchNode('china_team') === 'second_call_after_decline'; },
    choices: [
      { label: '接受再征召', hint: '带着质疑回归，用表现重新建立信任', apply: function() {
        var mods = getNextSeasonMods();
        var b = setBranchNode('china_team', 'return_under_pressure', { status: 'returned', acceptedCount: (getBranchState('china_team').acceptedCount || 0) + 1 });
        b.reputation = (b.reputation || 0) + 1;
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回到集训基地时，寒暄少了一些，观察多了一些。你没有解释太多，只是在第一堂训练课把每个回合都跑到底。<br><br>重点：信任不是靠声明修复的，你选择用训练和比赛重新把它拿回来。<br><br>影响：传球+1；下赛季伤病风险上升。';
      }},
      { label: '再次婉拒', hint: '身体更安全，但国家队关系明显疏远', apply: function() {
        var mods = getNextSeasonMods();
        var b = setBranchNode('china_team', 'national_team_distance', { status: 'distant', declinedCount: (getBranchState('china_team').declinedCount || 0) + 1 });
        b.controversy = (b.controversy || 0) + 2;
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        addProfileDelta('chinaPopularity', -1);
        return '你第二次说不。电话那头没有责备，只是安静了很久。新闻出来后，讨论不再只是身体管理，而是你和国家队之间到底还剩多少距离。<br><br>重点：你保护了身体，也让国家队关系变得更冷。<br><br>影响：下赛季伤病风险略降；国内舆论压力上升。';
      }},
      { label: '承诺未来窗口', hint: '暂缓决定，保留回归可能', apply: function() {
        setBranchNode('china_team', 'future_commitment', { status: 'future_window' });
        addProfileDelta('mediaTrust', 1);
        return '你没有把门关上。你告诉教练组，自己会在下一个大赛窗口认真考虑。这个答案不够热血，但至少诚实。<br><br>重点：你争取了一点时间，也保留了未来回归的余地。<br><br>影响：舆论暂时缓和。';
      }}
    ]
  },
  {
    id: 'china_team_future_commitment',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 14,
    title: '中国男篮：未来窗口到了',
    scenes: [
      '你曾经承诺会在下一个大赛窗口重新考虑。现在，那个窗口真的来了。',
      '这一次，国家队没有催你。选择权完整地回到了你手里。'
    ],
    body: '你要兑现承诺，还是继续把国家队放在职业规划之外？',
    requires: function() { return getBranchNode('china_team') === 'future_commitment'; },
    choices: [
      { label: '兑现承诺，回到国家队', hint: '重新开始，但需要用表现修复信任', apply: function() {
        setBranchNode('china_team', 'first_camp', { status: 'accepted_late', acceptedCount: (getBranchState('china_team').acceptedCount || 0) + 1 });
        addProfileDelta('chinaPopularity', 1);
        return '你没有再解释过去的决定。报到那天，你提前半小时到训练馆，把球放在地上，自己先练了起来。<br><br>重点：迟到的回归也是回归，接下来要靠比赛说话。<br><br>影响：中国球迷支持略有回升。';
      }},
      { label: '继续不回归', hint: '进入国家队缺席方向', apply: function() {
        setBranchNode('china_team', 'national_team_distance', { status: 'long_absence', declinedCount: (getBranchState('china_team').declinedCount || 0) + 1 });
        addProfileDelta('chinaPopularity', -2);
        return '你没有出现在名单里。久而久之，媒体每次讨论国家队都会提到你，但语气已经从期待变成了遗憾。<br><br>重点：你的职业联盟生涯仍在前进，但国家队这条路开始离你远去。<br><br>影响：中国球迷支持下降。';
      }}
    ]
  },
  {
    id: 'china_team_role_fight',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 14,
    title: '中国男篮：定位之争',
    scenes: [
      '集训第二周，教练安排了一场内部对抗。老队员仍习惯从自己手里发起进攻，年轻队员却不断把球交给你。',
      '训练馆里没人明说，但所有人都知道，这是一次无声的权力交接。'
    ],
    body: '你已经不是被观察的新人了。现在的问题是，你要怎样成为这支球队的核心。',
    requires: function() { return getBranchNode('china_team') === 'first_camp' || getBranchNode('china_team') === 'return_under_pressure'; },
    choices: [
      { label: '主动接管球权', hint: '提高个人声望和关键球，但压力上升', apply: function() {
        var b = setBranchNode('china_team', 'role_fight_primary', { role: 'primary_creator' });
        b.reputation = (b.reputation || 0) + 2;
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你在对抗赛最后三分钟连续叫挡拆，把每个回合都打成自己的判断。教练没有喊停，只是在场边点了点头。<br><br>效果：关键球+1；国家队声望提升。';
      }},
      { label: '先做组织者', hint: '提升传球和国家队默契', apply: function() {
        var b = setBranchNode('china_team', 'role_fight_connector', { role: 'connector' });
        b.reputation = (b.reputation || 0) + 1; b.chemistry = (b.chemistry || 0) + 2;
        addAttrDelta('PAS', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有急着证明自己，而是连续喂出几个简单到舒服的球。年轻队友投进后第一时间回头看你，像是在确认新的秩序。<br><br>效果：传球+2；国家队默契提升。';
      }},
      { label: '保留体能，不争定位', hint: '降低伤病风险，但声望推进较慢', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('china_team', 'role_fight_managed', { role: 'managed_load' });
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return '你主动和教练沟通出场负荷。媒体不太喜欢这个答案，但队医很满意。<br><br>效果：下赛季伤病风险略降。';
      }}
    ]
  },
  {
    id: 'china_team_core_burden',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 16,
    title: '中国男篮：绝对核心',
    scenes: [
      '这一次集训，你的名字被写在所有战术板最上面。教练没有再问你是否准备好。',
      '他说：我们需要你每晚都像核心一样活着。'
    ],
    body: '最后一攻、媒体期待、更衣室责任，现在都被推到你面前。',
    requires: function() { return ['role_fight_primary','role_fight_connector','role_fight_managed'].indexOf(getBranchNode('china_team')) >= 0; },
    choices: [
      { label: '扛起绝对核心责任', hint: '关键球大幅提升，但身体消耗明显', apply: function() {
        var mods = getNextSeasonMods();
        var b = setBranchNode('china_team', 'national_core', { coreStyle: 'hero' });
        b.reputation = (b.reputation || 0) + 3;
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 2);
        addAttrDelta('CLU', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你接受了所有关键球。赢球时全场喊你的名字，输球时所有镜头也追着你。<br><br>效果：关键球+2；国家队声望大幅提升；下赛季伤病风险上升。';
      }},
      { label: '打造团队篮球', hint: '传球和默契提升，风险较低', apply: function() {
        var b = setBranchNode('china_team', 'team_core', { coreStyle: 'system' });
        b.reputation = (b.reputation || 0) + 2; b.chemistry = (b.chemistry || 0) + 3;
        addAttrDelta('PAS', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你开始把年轻队友带进战术中心。中国队不再只等你单挑，而是每个人都知道自己该站在哪里。<br><br>效果：传球+2；国家队默契大幅提升。';
      }},
      { label: '控制负荷，做关键时刻的核心', hint: '保护身体，把责任集中到最需要你的回合', apply: function() {
        var b = setBranchNode('china_team', 'managed_core', { coreStyle: 'managed' });
        b.reputation = (b.reputation || 0) + 1; b.chemistry = (b.chemistry || 0) + 1;
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有把每个回合都揽到自己身上。前三节你让队友承担更多，到了真正需要答案的时候，你再站出来。<br><br>效果：关键球+1；国家队默契提升；下赛季伤病风险略降。';
      }}
    ]
  },
  {
    id: 'china_team_legacy_game',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 18,
    title: '中国男篮：国际大赛关键战',
    scenes: [
      '真正决定评价的比赛来了。不是热身赛，不是小组里的普通夜晚，而是一场会被反复回看的生死战。',
      '赛前发布会上，有记者问你：中国队这次能不能过这一关？你看了看桌上的国旗，没有立刻回答。'
    ],
    body: '这是中国男篮支线的关键节点。你要决定最后一节如何打。',
    requires: function() { return ['national_core','team_core','managed_core'].indexOf(getBranchNode('china_team')) >= 0; },
    choices: [
      { label: '最后一节自己解决', hint: '高声望高压力，成败都很重', apply: function() {
        var b = getBranchState('china_team');
        var win = Math.random() < 0.58;
        if (win) { setBranchNode('china_team', 'national_flag', { ending: 'hero_ball_win' }); b = getBranchState('china_team'); b.legend = (b.legend || 0) + 4; addAttrDelta('CLU', 2); STATE.finalOVR = calcOVR(STATE.attrs); return '你连续三个回合点名对手最强防守人。最后一次出手命中后，替补席冲进场内。<br><br>结果：关键战取胜；关键球+2。'; }
        setBranchNode('china_team', 'public_trial', { ending: 'hero_ball_loss' });
        b.controversy = (b.controversy || 0) + 3;
        return '最后一投砸在篮筐前沿。你站在原地，听见场馆里的声音一点点远去。<br><br>结果：遗憾失利；舆论压力上升。';
      }},
      { label: '相信队友，打团队篮球', hint: '提升传球和传承评价，但结果取决于全队回应', apply: function() {
        var win = Math.random() < 0.68;
        if (win) {
          var b = setBranchNode('china_team', 'team_revival', { ending: 'team_basketball_win' });
          b.legend = (b.legend || 0) + 2; b.chemistry = (b.chemistry || 0) + 3;
          addAttrDelta('PAS', 2); STATE.finalOVR = calcOVR(STATE.attrs);
          return '最后两分钟，你连续把球传给位置更好的队友。有人投进，也有人替你补上防守。这支球队终于不再只靠一个人呼吸。<br><br>效果：传球+2；国家队传承评价提升。';
        }
        var b = setBranchNode('china_team', 'clutch_question', { ending: 'team_basketball_loss' });
        b.controversy = (b.controversy || 0) + 1; b.chemistry = (b.chemistry || 0) + 1;
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '你把球传给了空位队友。战术没有错，出手机会也干净，可篮球有时候就是不讲道理。终场之后，镜头还是回到你脸上。<br><br>结果：团队路线遗憾失利；传球+1；媒体压力上升。';
      }},
      { label: '带伤坚持', hint: '传奇值最高，但伤病风险大幅上升', apply: function() {
        var mods = getNextSeasonMods();
        var b = setBranchNode('china_team', 'injured_hero', { ending: 'injured_legend' });
        b.legend = (b.legend || 0) + 5;
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 4);
        return '队医建议你不要再上，但你把护具重新绑紧。那一晚之后，没人再质疑你对这身球衣的态度。<br><br>结果：国家队传奇值大幅提升；下赛季伤病风险大幅上升。';
      }}
    ]
  },
  {
    id: 'china_team_public_trial',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 16,
    title: '中国男篮：舆论审判',
    scenes: [
      '失利后的几天，你没有打开社交媒体。可有些声音不用打开也会传进来。',
      '有人说你已经尽力，也有人说最后一球证明你还不是答案。'
    ],
    body: '失败没有让国家队故事结束，但它让下一次回归变得更沉重。',
    requires: function() { return getBranchNode('china_team') === 'public_trial' || getBranchNode('china_team') === 'clutch_question'; },
    choices: [
      { label: '回应质疑，准备再次冲击', hint: '承受压力，争取下一次证明', apply: function() {
        setBranchNode('china_team', 'redemption_run', { response: 'public_answer' });
        addSeasonMod('mediaPressure', 1, -10, 10);
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有逃避采访。你说最后一球可以讨论，但下一次你还会站在那里。<br><br>重点：你把失败变成下一次回来的理由。<br><br>影响：关键球+1；媒体压力上升。';
      }},
      { label: '沉默训练', hint: '降低噪音，把回应留给下一届赛事', apply: function() {
        setBranchNode('china_team', 'redemption_run', { response: 'silent_work' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有发声明。训练馆里，助教把那场比赛最后五分钟剪成一个单独文件，你一遍遍看，一遍遍重来。<br><br>重点：你没有把情绪交给舆论，而是把它留给训练。<br><br>影响：下赛季状态更稳定。';
      }},
      { label: '退出国家队', hint: '保护身体，但留下争议结局', apply: function() {
        setBranchNode('china_team', 'controversial_exit', { retiredFromNationalTeam: true });
        addProfileDelta('chinaPopularity', -2);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你宣布暂时退出国家队。声明写得很克制，但所有人都知道，这不是一个轻松的决定。<br><br>重点：你保护了身体，也让国家队故事停在一个不完整的句号。<br><br>影响：中国球迷支持下降；下赛季伤病风险略降。';
      }}
    ]
  },
  {
    id: 'china_team_redemption_run',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 18,
    title: '中国男篮：再次冲击',
    scenes: [
      '又一个大赛窗口来了。这一次，外界不再只问你能不能带队赢，而是问你能不能从上一次失败里走出来。',
      '赛前热身时，你看见看台上有人举着旧比赛的比分牌。那不是嘲讽，更像提醒。'
    ],
    body: '这是失败后的第二次机会。它不会抹掉过去，但可能改变人们记住过去的方式。',
    requires: function() { return getBranchNode('china_team') === 'redemption_run'; },
    choices: [
      { label: '这次自己承担到底', hint: '高风险高收益', apply: function() {
        var win = Math.random() < 0.62;
        if (win) {
          var b = setBranchNode('china_team', 'national_flag', { redemption: 'won' });
          b.legend = (b.legend || 0) + 4;
          addAttrDelta('CLU', 2); STATE.finalOVR = calcOVR(STATE.attrs);
          return '最后两分钟，你没有再犹豫。每一次持球，全队都为你拉开。终场哨响时，你终于把上一次没投进的那口气吐了出来。<br><br>结果：完成救赎；关键球+2。';
        }
        setBranchNode('china_team', 'national_regret', { redemption: 'failed' });
        addProfileDelta('legacyBonus', -1);
        return '你又一次站到了最后。球出手时线路很好，却还是弹了出来。你没有低头，只是慢慢走向更衣室。<br><br>结果：再次遗憾；国家队故事留下沉重注脚。';
      }},
      { label: '坚持团队路线', hint: '强化传承和团队评价', apply: function() {
        var b = setBranchNode('china_team', 'team_revival', { redemption: 'team' });
        b.chemistry = (b.chemistry || 0) + 3;
        addAttrDelta('PAS', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你不再试图一个人回答所有问题。最后阶段，你连续把球交给年轻队友，他们有人投进，也有人投丢，但这支球队终于开始像一个整体。<br><br>效果：传球+2；国家队团队评价提升。';
      }}
    ]
  },
  {
    id: 'china_team_final_resolution',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 14,
    title: '中国男篮：传承或告别',
    scenes: [
      '年轻队友叫你一声队长。你突然意识到，自己已经不是被征召的人，而是后来者判断中国篮球高度的参照物。',
      '这个夏天，国家队没有再问你能不能来。他们问的是：你希望以什么方式继续留下？'
    ],
    body: '你已经走到国家队故事的收束点。继续出战、让位，或体面告别，都会留下不同的记忆。',
    requires: function() { return ['national_flag','team_revival','injured_hero'].indexOf(getBranchNode('china_team')) >= 0; },
    choices: [
      { label: '继续出战，为年轻人压阵', hint: '声望最高，但身体负担继续存在', apply: function() {
        var b = setBranchNode('china_team', 'national_legend', { finalRole: 'captain' });
        b.legend = (b.legend || 0) + 3;
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('legacyBonus', 2);
        addSeasonMod('injuryRiskBonus', 1, -4, 8);
        return '你没有把队长袖标交出去。训练结束后，年轻队友还在等你讲最后一组战术。<br><br>重点：你选择继续站在最前面。<br><br>影响：中国球迷支持上升；历史评价上升；下赛季伤病风险略升。';
      }},
      { label: '让位年轻球员，转为精神领袖', hint: '保护身体，强化传承评价', apply: function() {
        setBranchNode('china_team', 'national_mentor', { finalRole: 'mentor' });
        addProfileDelta('chinaPopularity', 2);
        addProfileDelta('legacyBonus', 2);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把更多球权交给年轻人。暂停时，你不再总是第一个接球的人，却成了所有人回头寻找的声音。<br><br>重点：你从核心变成参照物。<br><br>影响：中国篮球评价上升；下赛季伤病风险略降。';
      }},
      { label: '宣布退出国家队', hint: '体面告别，身体保护', apply: function() {
        setBranchNode('china_team', 'honorable_exit', { retiredFromNationalTeam: true });
        addProfileDelta('legacyBonus', 1);
        addSeasonMod('injuryRiskBonus', -2, -4, 8);
        return '发布会最后，你把国家队球衣叠好放在桌上。你说自己不是离开，只是把路让给后来的人。<br><br>重点：国家队故事有了一个完整的句号。<br><br>影响：下赛季伤病风险下降；退役后的中国篮球相关评价更完整。';
      }}
    ]
  },
  {
    id: 'china_team_distance_resolution',
    branch: 'china_team', phase: 'offseason', slot: 'main', weight: 8,
    title: '中国男篮：越来越远的名单',
    scenes: [
      '又一年国家队窗口，你没有把自己的名字放进名单。公布那天你翻了一遍，果然没有你。',
      '一开始媒体还会争论，后来大家慢慢习惯把你放在另一条叙事里：职业联盟成功，但国家队缺席。'
    ],
    body: '长期拒绝国家队也应该有结局。它不是错误选择，但会留下缺口。',
    requires: function() { return getBranchNode('china_team') === 'national_team_distance'; },
    choices: [
      { label: '未来主动回归', hint: '重新打开国家队关系，但需要修复信任', apply: function() {
        setBranchNode('china_team', 'return_under_pressure', { status: 'late_return' });
        addProfileDelta('chinaPopularity', 1);
        return '你主动给教练组打了电话。电话那头没有立刻热情起来，但至少那扇门又开了一条缝。<br><br>重点：你选择重新面对曾经拉开的距离。<br><br>影响：中国球迷支持略有回升。';
      }},
      { label: '长期不回归', hint: '国家队缺席结局', apply: function() {
        setBranchNode('china_team', 'national_team_absence', { finalRole: 'absent' });
        addProfileDelta('chinaPopularity', -2);
        addProfileDelta('legacyBonus', -1);
        return '你继续专注职业联盟。很多年后，每次国际大赛名单公布，还是会有人提起你的名字，但语气已经从期待变成遗憾。<br><br>重点：你的职业生涯很成功，但国家队篇章留下了空白。<br><br>影响：中国球迷支持下降；历史评价略受影响。';
      }}
    ]
  },
  {
    id: 'relationship_first_date',
    branch: 'relationship', phase: 'offseason', slot: 'main', weight: 8,
    title: '恋爱线：约会邀请',
    scenes: [
      '休赛期刚开始，两条完全不同的邀请同时出现：一位当红女明星通过共同朋友发来邀请，朋友也介绍了一位圈外女孩，她在一家小设计工作室上班。',
      '经纪团队提醒你：一条路通往热搜和商业版图，另一条路安静得多，但同样会改变你的夏天。'
    ],
    body: '你要选择哪一种生活出现在训练馆以外？',
    requires: function() {
      var c = STATE.career || {};
      return getBranchNode('relationship') === 'start' && (c.currentAge || 22) >= 22;
    },
    choices: [
      { label: '接受女明星邀约', hint: '开启高曝光恋爱线，可能稳定也可能分心', apply: function() {
        var c = STATE.career; c.relationships = c.relationships || {};
        setBranchNode('relationship', 'dating', { status: 'dating' });
        c.relationships.partner = { type: 'actress', status: 'dating', sinceSeason: c.seasonCount, volatility: 2 };
        return '你们第一次见面是在一个很低调的私人餐厅。她没有问你数据，只问你赢球后为什么总是先低头。<br><br>结果：恋爱线开启；媒体曝光高；下一步进入关系走向。';
      }},
      { label: '接受圈外女孩约会', hint: '开启低曝光恋爱线，生活更安静', apply: function() {
        var c = STATE.career; c.relationships = c.relationships || {};
        setBranchNode('relationship', 'dating', { status: 'dating' });
        c.relationships.partner = { type: 'ordinary', status: 'dating', sinceSeason: c.seasonCount, volatility: 1 };
        return '她带你去吃了一家没有明星会去的街边小店。她说自己不看球，只知道你训练很拼。那个晚上没有照片，也没有热搜。<br><br>结果：恋爱线开启；媒体关注低；下一步进入关系走向。';
      }},
      { label: '礼貌拒绝，专注训练', hint: '不开启恋爱线，获得小训练收益', apply: function() {
        setBranchNode('relationship', 'declined', { status: 'declined', declinedSeason: STATE.career.seasonCount });
        addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回了一条很短但体面的消息，然后把手机交给训练师保管。<br><br>效果：运动+1；恋爱线记录为“曾经拒绝”。';
      }}
    ]
  },
  {
    id: 'relationship_second_chance',
    branch: 'relationship', phase: 'offseason', slot: 'main', weight: 10,
    title: '恋爱线：第二次约会邀请',
    scenes: [
      '两年过去，你几乎已经习惯训练馆、客场和一个人的夏天。直到那天，一条旧消息重新出现在屏幕上。',
      '经纪团队说得很直接：当初那条没走成的路，现在又有人递来了邀请。这一次，没人替你决定。'
    ],
    body: '两年后的夏天，你要不要让恋爱线重新开始？',
    requires: function() {
      var b = getBranchState('relationship');
      var c = STATE.career || {};
      var declinedAt = b.declinedSeason || 0;
      return getBranchNode('relationship') === 'declined' && (c.seasonCount || 0) - declinedAt >= 2;
    },
    choices: [
      { label: '接受女明星邀约', hint: '高曝光恋爱线重新开启', apply: function() {
        var c = STATE.career; c.relationships = c.relationships || {};
        setBranchNode('relationship', 'dating', { status: 'dating', secondChance: true });
        c.relationships.partner = { type: 'actress', status: 'dating', sinceSeason: c.seasonCount, volatility: 2, secondChance: true };
        return '两年后，那条没走成的邀请重新出现。你们约在最初那家私人餐厅，她没有再问你为什么拒绝，只说：这次你来了。<br><br>结果：恋爱线重新开启；媒体曝光高；下一步进入关系走向。';
      }},
      { label: '接受圈外女孩约会', hint: '低曝光恋爱线重新开启', apply: function() {
        var c = STATE.career; c.relationships = c.relationships || {};
        setBranchNode('relationship', 'dating', { status: 'dating', secondChance: true });
        c.relationships.partner = { type: 'ordinary', status: 'dating', sinceSeason: c.seasonCount, volatility: 1, secondChance: true };
        return '朋友说，那个在工作室的女孩还留着两年前那条礼貌的回复。你们约在那家街边小店，她笑你比新闻里安静。<br><br>结果：恋爱线重新开启；媒体关注低；下一步进入关系走向。';
      }},
      { label: '再次拒绝，专注篮球', hint: '恋爱线永久收束', apply: function() {
        setBranchNode('relationship', 'declined_closed', { status: 'declined', secondDecline: true });
        addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回了一条很短的感谢，然后把手机交回训练师。这次你知道，自己选的就是这条路。<br><br>效果：运动+1；恋爱线记录为“二次拒绝”，不再开启。';
      }}
    ]
  },
  {
    id: 'relationship_direction',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '恋爱线：关系走向',
    scenes: [
      '几周过去，这段关系不再只是一次约会。她开始知道你的训练表，你也开始记得她的行程。',
      '问题变得具体起来：这会成为支撑，还是成为噪音？'
    ],
    body: '你要如何处理这段关系和职业生涯的边界？',
    requires: function() { return getBranchNode('relationship') === 'dating'; },
    choices: [
      { label: '认真经营，保持低调', hint: '状态更稳定，球队默契略升', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'stable', { status: 'stable' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'stable';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        return '你们决定不公开，也不把这件事变成新闻。队友偶尔调侃你，但更衣室气氛反而轻松了不少。<br><br>效果：下赛季状态波动略降；球队默契略升。';
      }},
      { label: '享受热恋，不想太克制', hint: '可能状态火热，也可能分心', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'volatile', { status: 'volatile' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'volatile';
        var hot = Math.random() < 0.45;
        if (hot) { addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs); return '她开始频繁出现在你的主场。你每次看到场边那个位置，都像被多点燃了一点。<br><br>结果：状态火热；关键球+1。'; }
        mods.formVariance = Math.min(4, (mods.formVariance || 0) + 2);
        return '你开始频繁改训练时间，只为了配合她的行程。训练师没有明说，但白板上的缺席记录越来越显眼。<br><br>结果：乐不思蜀；下赛季状态波动上升。';
      }},
      { label: '暂时拉开距离', hint: '保护身体与专注，但关系可能降温', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'distant', { status: 'distant' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'distant';
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return '你和她约定这几个月先以比赛为重心。消息回得慢了，见面次数也少了，但至少你没有让生活失控。<br><br>效果：下赛季状态波动略降；伤病风险略降；关系进入距离期。';
      }}
    ]
  },
  {
    id: 'relationship_public_or_crisis',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '恋爱线：公开或风波',
    scenes: [
      '你不想让媒体替你们宣布。你约她坐下来，认真谈了一次：要不要由我们亲口说出这段关系？',
      '她说：你想清楚，别让我一个人站在镜头前。'
    ],
    body: '恋爱线进入公开节点。你的选择会决定这段关系的长期标签。',
    requires: function() {
      return getRelationshipPartnerType() === 'actress' && (getBranchNode('relationship') === 'stable' || getBranchNode('relationship') === 'volatile');
    },
    choices: [
      { label: '公开关系', hint: '商业热度上升，但舆论风险增加', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'public', { status: 'public' });
        STATE.career.flags.businessBuzz = true;
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'public';
        mods.formVariance = Math.min(4, (mods.formVariance || 0) + 1);
        return '你们一起发了一张没有任何品牌露出的合照。评论区爆了，赞助商也开始打电话。<br><br>结果：关系公开；商业热度上升；下赛季状态波动略升。';
      }},
      { label: '共同冷处理', hint: '稳定优先，商业收益较低', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'private', { status: 'private' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'private';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        return '你们没有回应任何传闻。几天后，新的新闻盖过旧的新闻，生活慢慢回到训练和比赛。<br><br>结果：关系保持低调；下赛季状态波动略降。';
      }},
      { label: '处理失控风波', hint: '高风险，可能影响身体和状态', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'crisis', { status: 'crisis' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'crisis';
        addProfileDelta('controversy', 1);
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 3);
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 1);
        return '几张模糊照片被放大解读，争吵和声明迅速发酵。你训练后还要处理电话，身体也没有恢复得那么干净。<br><br>结果：感情纠纷；状态波动明显上升；伤病风险略升。';
      }}
    ]
  },
  {
    id: 'relationship_ordinary_warmth',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '恋爱线：生活里的她',
    scenes: [
      '你开始主动把她带进你的生活：训练馆门口、公寓楼下、输球后的停车场。她没有热搜，也没有团队，只是每次都站在那里。',
      '你第一次意识到，和女明星在一起是“被看见”，和她在一起是“被接住”。'
    ],
    body: '普通人的恋爱没有镜头，却有温度。你选择用什么方式把这份温度留住？',
    requires: function() {
      return getRelationshipPartnerType() === 'ordinary' && (getBranchNode('relationship') === 'stable' || getBranchNode('relationship') === 'volatile');
    },
    choices: [
      { label: '带她走进你的世界', hint: '让她认识球队、家人和真实赛程', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'committed' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'committed';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        addProfileDelta('fanSupport', 1);
        return '她第一次坐在你主场的家属席，球馆灯光打下来，她比你还紧张。赛后你说这是你打过最想赢的一场。队友起哄，她脸红，你却觉得这比任何头条都值。<br><br>重点：恋爱线进入长期稳定，家庭线解锁。<br><br>影响：球队默契+1；球迷支持+1；下赛季状态波动略降。';
      }},
      { label: '走进她的世界', hint: '陪她过普通人的生活，见她的家人和朋友', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'committed' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'committed';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        addProfileDelta('fanSupport', 1);
        return '她带你去菜市场挑鱼，去她工作室看图纸，去她老家吃一顿没有赞助商的晚饭。她的妈妈说你太瘦了，往你碗里又添了一勺饭。那一晚你睡得很好。<br><br>重点：恋爱线进入长期稳定，家庭线解锁。<br><br>影响：下赛季状态波动明显下降；球迷支持+1。';
      }},
      { label: '一起扛过低谷', hint: '在她面前可以脆弱，也学会被照顾', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'committed' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'committed';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '球队连败那阵，你半夜从酒店醒来，手机里是她发的长语音：没关系，我在。后来她把感冒药和夜宵送到训练馆门口，只说了一句：吃完再练。<br><br>重点：恋爱线进入长期稳定，家庭线解锁。<br><br>影响：关键球+1；下赛季状态波动明显下降。';
      }}
    ]
  },
  {
    id: 'relationship_after_distance',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '恋爱线：距离之后',
    scenes: [
      '休赛期接近尾声，你主动约了一次安静的晚饭。没有热搜，没有行程，只有两个人重新确认彼此的位置。',
      '她说：我不想成为你训练表里的负担，也不想只是你新闻里的注脚。'
    ],
    body: '拉开距离的时间结束了。这段关系是重新靠近，还是体面退场？',
    requires: function() { return getBranchNode('relationship') === 'distant'; },
    choices: [
      { label: '重新建立节奏', hint: '关系回暖，球队默契略升', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'stable', { status: 'rekindled' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'stable';
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        return '你主动把她的时间排进恢复计划，也把训练时间排进她的行程。这次不是妥协，而是两个人都找到了节奏。<br><br>效果：关系重新稳定；球队默契略升。';
      }},
      { label: '变成普通朋友', hint: '体面结束，保护专注度', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'breakup', { status: 'friends' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'friends';
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        return '你们聊到很晚，最后把话说明白了：这段关系没有变成支撑，也没有变成噪音，只是没有继续下去的力气。<br><br>结果：和平结束；下赛季状态波动略降。';
      }}
    ]
  },
  {
    id: 'relationship_commitment',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '恋爱线：稳定关系',
    scenes: [
      '关系公开之后，生活变得更吵，但至少你们不用再躲。你主动在主场家属席给她留了位置，她也开始习惯赛后等你。',
      '真正的问题不是要不要在一起，而是要不要把彼此放进更长期的人生计划。'
    ],
    body: '这是恋爱线的收束节点。你可以把关系推向长期承诺，也可以保持现状。',
    requires: function() { return getBranchNode('relationship') === 'public' || getBranchNode('relationship') === 'private'; },
    choices: [
      { label: '正式承诺', hint: '关系进入长期稳定，家庭线可触发', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'committed' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'committed';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('fanSupport', 1);
        return '没有盛大的仪式，你在她面前把下赛季的赛程表打开，说这里面也有一份你的位置。<br><br>重点：恋爱线进入长期稳定，家庭线解锁。<br><br>影响：下赛季状态波动略降；球迷支持略升。';
      }},
      { label: '保持现状，低调陪伴', hint: '关系稳定但不急于承诺', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'long_term' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'long_term';
        mods.formVariance = Math.max(-2, (mods.formVariance || 0) - 1);
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        return '你们没有把承诺变成仪式，但每个休赛期都把对方排进生活。稳定不是一句口号，而是彼此都在场。<br><br>重点：恋爱线进入长期陪伴，家庭线解锁。<br><br>影响：下赛季状态波动略降；球队默契略升。';
      }}
    ]
  },
  {
    id: 'relationship_crisis_recovery',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 13,
    title: '恋爱线：风波之后',
    scenes: [
      '风波之后，你决定先关掉手机。媒体还在等声明，但你想先把话说给该听的人听。',
      '你第一次意识到，这段关系已经不是两个人的事，而是很多人的谈资。'
    ],
    body: '风波之后，你要决定这段关系往哪走。',
    requires: function() { return getBranchNode('relationship') === 'crisis'; },
    choices: [
      { label: '修复关系', hint: '关系转稳，降低争议', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'partnership', { status: 'repaired' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'repaired';
        addProfileDelta('controversy', -1);
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        return '你们没有立刻回应媒体，而是先关掉手机谈了一整晚。最后你只发了一句简短的话，把故事从猜测拉回事实。<br><br>重点：风波被修复，关系进入长期稳定。<br><br>影响：争议下降；下赛季状态波动明显回落。';
      }},
      { label: '转为低调陪伴', hint: '关系降温但保留，避开聚光灯', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'private', { status: 'private_after_storm' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'private';
        addProfileDelta('controversy', -1);
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        return '你们决定不再对镜头交代任何事。慢慢地，热搜被下一件事盖过，生活重新变得安静。<br><br>结果：关系转低调；争议下降；接下来可进入稳定关系。';
      }},
      { label: '分手止损', hint: '结束关系，保护状态但留下讨论', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('relationship', 'breakup', { status: 'breakup' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'breakup';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return '声明很短：我们尊重彼此，也尊重各自的未来。训练馆里没人问细节，但你知道这条新闻还会被讨论很久。<br><br>结果：恋爱线结束；下赛季状态波动略降；伤病风险略降。';
      }}
    ]
  },
  {
    id: 'relationship_betrayal',
    branch: 'relationship', phases: ['offseason', 'season'], slot: 'main', weight: 8,
    title: '恋爱线：被情感伤害',
    scenes: [
      '最近的对话越来越不对劲：临时取消、扣过去的手机、对不上的时间。你决定主动约她见面，把话说开。',
      '她没有否认。真相摆到桌上时，你才明白，信任裂开的声音很轻。'
    ],
    body: '这是恋爱线里“被情感伤害”的走向。信任一旦裂开，继续或离开都会留下痕迹。',
    requires: function() {
      var node = getBranchNode('relationship');
      var p = (STATE.career && STATE.career.relationships && STATE.career.relationships.partner) || {};
      if (node === 'volatile' || node === 'crisis') return true;
      return node === 'distant' && p.type === 'ordinary';
    },
    choices: [
      { label: '当面问清，选择原谅', hint: '关系保留，但留下信任裂缝', apply: function() {
        var mods = getNextSeasonMods();
        var p = (STATE.career.relationships && STATE.career.relationships.partner) || {};
        var intro = p.type === 'ordinary' ? '她终于坦白：她认识了一个能每天陪她吃晚饭的人。你们隔着时差和赛程维系了半年，最后还是输给了距离。' : '那张照片拍得很清楚：她和一个陌生男人在同一辆车里，时间对不上你们的行程。';
        setBranchNode('relationship', 'hurt_scar', { status: 'hurt_scar' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'hurt_scar';
        STATE.career.flags.relationshipHurt = true;
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 2);
        return intro + '<br><br>她没有否认，也没有狡辩。你听完了所有解释，最后只说了一句：我原谅你，但需要时间。<br><br>重点：关系保留，但信任裂缝已经存在。<br><br>影响：下赛季状态波动上升；不解锁家庭线。';
      }},
      { label: '决绝分手，封存感情', hint: '结束关系，保护自己，但留下防备心', apply: function() {
        var mods = getNextSeasonMods();
        var p = (STATE.career.relationships && STATE.career.relationships.partner) || {};
        var intro = p.type === 'ordinary' ? '她最终承认，自己已经先走远了。你说不出愤怒，只觉得那半年的视频通话像一场漫长的告别。' : '照片和聊天记录被放在你面前，没有误会，也没有反转。';
        setBranchNode('relationship', 'hurt_guard', { status: 'hurt_guard' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'hurt_guard';
        STATE.career.flags.relationshipHurt = true;
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 1);
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        return intro + '<br><br>你把她的联系方式全部删除。发布会没人敢问，但更衣室里所有人都知道，你的眼神变冷了。<br><br>重点：你保护了自己，也把心门关上了。<br><br>影响：下赛季状态波动略升；伤病风险略降；之后恋爱线不再开启。';
      }},
      { label: '彻底放下，专注自己', hint: '接受伤害，用训练消化情绪', apply: function() {
        var mods = getNextSeasonMods();
        var p = (STATE.career.relationships && STATE.career.relationships.partner) || {};
        var intro = p.type === 'ordinary' ? '她哭了，说对不起。你第一次发现，原谅和继续是两件完全不同的事。' : '她试图解释，但你已经不想再听版本二。';
        setBranchNode('relationship', 'hurt_moved_on', { status: 'hurt_moved_on' });
        if (STATE.career.relationships.partner) STATE.career.relationships.partner.status = 'hurt_moved_on';
        STATE.career.flags.relationshipHurt = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return intro + '<br><br>你约教练加练，把那些没回的消息全部清空。痛是真的，但你决定不让它定义你。<br><br>重点：你选择走出阴影。<br><br>影响：运动+1；下赛季状态波动略降；获得“走出阴影”标签。';
      }}
    ]
  },
  {
    id: 'relationship_single_aftermath',
    branch: 'relationship', phase: 'offseason', slot: 'main', weight: 6,
    title: '恋爱线：单身生活',
    scenes: [
      '没有新故事可写。媒体开始习惯把“感情状态”从你的档案里划掉。',
      '你发现训练馆里的时间反而变得完整：没有电话要回，没有行程要迁就。'
    ],
    body: '恋爱线以单身结束。你可以选择怎么消化这段空白。',
    requires: function() { var n = getBranchNode('relationship'); return n === 'breakup' || n === 'declined_closed'; },
    choices: [
      { label: '专注篮球', hint: '运动提升，心更静', apply: function() {
        setBranchNode('relationship', 'single_focus', { finalStatus: 'focused' });
        addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        STATE.career.flags.singleFocus = true;
        return '你把休赛期重新排满。助教说你又回到了刚进联盟时的样子：眼里只有训练和比赛。<br><br>效果：运动+1；获得“单身专注”标签。';
      }},
      { label: '顺其自然', hint: '保持开放，不刻意寻找', apply: function() {
        setBranchNode('relationship', 'single_open', { finalStatus: 'open' });
        addProfileDelta('fanSupport', 1);
        return '你没有把单身当成问题。偶尔和朋友吃饭，偶尔独自加练，生活没有因为缺少一段关系而变空。<br><br>效果：心态稳定；球迷支持略升。';
      }}
    ]
  },
  {
    id: 'network_golf_intro',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 7,
    title: '人脉线：名人高尔夫局',
    scenes: [
      '休赛期，赞助商的高尔夫局邀请函放在你桌上。你翻开看了很久，决定要不要用这个夏天换一张场外入场券。',
      '你原本只是想放松，结果第一洞还没打完，就有人开始聊阵容、市场和未来几年联盟的权力流向。'
    ],
    body: '你要不要进入这个场外圈子？',
    requires: function() {
      return getBranchNode('network') === 'start' && (STATE.career.currentAge || 22) >= 24 && ((STATE.finalOVR || 0) >= 85 || hasCareerHonor('全明星') || hasCareerHonor('总冠军'));
    },
    choices: [
      { label: '参加高尔夫局', hint: '开启人脉线，可能遇到明星经纪团队或球星圈子', apply: function() {
        var c = STATE.career; c.flags = c.flags || {};
        setBranchNode('network', 'golf_meet', { status: 'golf' });
        if (Math.random() < 0.5) { c.flags.richPaulContact = true; return '你和一支明星经纪团队在第九洞聊了很久。他们没有直接招募你，只说未来可以坐下来谈职业版图。<br><br>结果：记录经纪团队接触；人脉线进入二阶段。'; }
        c.flags.curryCircle = true; addAttrDelta('threePT', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '库里团队的人注意到你在果岭上的手感，玩笑说你的腕部控制像投篮。后来对方留下了联系方式。<br><br>效果：三分+1；记录库里圈子；人脉线进入二阶段。';
      }},
      { label: '拒绝社交，留在训练馆', hint: '放弃社交，把整个夏天留给训练', apply: function() {
        setBranchNode('network', 'training_focus', { status: 'training' });
        addAttrDelta('MID', 1); addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你婉拒了球局，把那一整天留给训练馆。助教说你可能错过了一些人脉，但你只回了一句：球会替我介绍自己。<br><br>效果：中投+1，运动+1。';
      }}
    ]
  },
  {
    id: 'superstar_recruit_call',
    branch: 'superstar_recruit', phase: 'offseason', slot: 'main', weight: 18,
    title: '巨星招募：午夜电话',
    scenes: [
      '休赛期训练结束后，手机在储物柜里亮了很久。',
      '来电的人不是记者，也不是经纪人，而是{招募者}。他说：我不想再只隔着球衣和你对抗了。我们可以一起赢。别让忠诚害了你，你难道不想复刻詹姆斯的传奇历程吗？'
    ],
    body: '{招募者}所在的{招募球队}正在寻找另一个能改变系列赛的人。你不需要现在答应，但这通电话会让自由市场变得不一样。',
    requires: function() {
      var c = STATE.career;
      if (!c || !c.flags) return false;
      var season = c.seasonCount || 0;
      if ((STATE.finalOVR || 0) < 85 && !hasCareerHonor('全明星') && !hasCareerHonor('最佳阵容')) return false;
      if ((c.contract || 0) > 1 && (c.currentAge || 22) < 24) return false;
      if (c.flags.lastSuperstarRecruitSeason != null && season - c.flags.lastSuperstarRecruitSeason < 3) return false;
      var node = getBranchNode('superstar_recruit');
      if (node && node !== 'start') return false;
      return !!prepareSuperstarRecruitment();
    },
    choices: [
      { label: '认真考虑联手', hint: '目标球队报价倾向明显提高，但争议会上升', apply: function() {
        var c = STATE.career; c.flags = c.flags || {};
        var star = prepareSuperstarRecruitment();
        if (!star) return '你让经纪人先别回应。电话挂断后，训练馆重新安静下来。';
        c.flags.lastSuperstarRecruitSeason = c.seasonCount || 0;
        c.flags.superstarRecruitInterest = 'serious';
        c.flags.freeAgentChoice = 'contender';
        setBranchNode('superstar_recruit', 'consider_team_up', { targetTeam: c.flags.superstarRecruitTargetTeam, recruiter: c.flags.superstarRecruiterName });
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你没有答应，也没有拒绝，只说：让我的团队和你们聊聊。几分钟后，经纪人的电话就打了进来。<br><br>重点：{招募球队}会成为自由市场重点选项。<br><br>影响：人气+1；争议+1；自由市场更偏争冠联手。';
      }},
      { label: '保持距离', hint: '维持自主和忠诚，不改变报价倾向', apply: function() {
        var c = STATE.career; c.flags = c.flags || {};
        prepareSuperstarRecruitment();
        c.flags.lastSuperstarRecruitSeason = c.seasonCount || 0;
        c.flags.superstarRecruitInterest = 'declined';
        setBranchNode('superstar_recruit', 'kept_distance', { targetTeam: c.flags.superstarRecruitTargetTeam, recruiter: c.flags.superstarRecruiterName });
        addProfileDelta('loyalty', 1);
        addProfileDelta('mediaTrust', 1);
        return '你感谢了他的尊重，但没有给任何承诺。你说：如果未来真的要决定，我希望那是我自己的决定。<br><br>重点：你保持距离，也保住了主动权。<br><br>影响：忠诚+1；媒体好感+1。';
      }},
      { label: '把消息放给媒体', hint: '制造热度，大市场和争冠队更关注你', apply: function() {
        var c = STATE.career; c.flags = c.flags || {};
        var star = prepareSuperstarRecruitment();
        if (!star) return '你让经纪人先别回应。电话挂断后，训练馆重新安静下来。';
        c.flags.lastSuperstarRecruitSeason = c.seasonCount || 0;
        c.flags.superstarRecruitInterest = 'public';
        c.flags.freeAgentChoice = 'market';
        setBranchNode('superstar_recruit', 'public_leverage', { targetTeam: c.flags.superstarRecruitTargetTeam, recruiter: c.flags.superstarRecruiterName });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 2);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '第二天，记者们都在问同一个问题：{招募者}是不是已经给你打过电话？你没有承认，也没有否认。自由市场的空气一下变热了。<br><br>重点：你把招募变成筹码。<br><br>影响：人气+2；争议+2；媒体压力+1；大市场报价倾向提升。';
      }}
    ]
  },
  {
    id: 'network_court_introduction',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 8,
    title: '人脉线：迟来的入场券',
    scenes: [
      '你拒绝那次高尔夫局之后，没有离开这场游戏。三年后，你主动让经纪人把你的名字放进全明星周末的晚宴名单。',
      '助教笑着说：你看，球真的会替你介绍自己。'
    ],
    body: '拒绝不是终点。当你的表现足够硬，门会自己再开一次。',
    requires: function() {
      return getBranchNode('network') === 'training_focus' && ((STATE.finalOVR || 0) >= 88 || hasCareerHonor('全明星') || hasCareerHonor('总冠军'));
    },
    choices: [
      { label: '接受迟来的入场券', hint: '重新进入人脉线，从第二次会面继续', apply: function() {
        setBranchNode('network', 'golf_meet', { status: 'reopened' });
        addProfileDelta('fame', 1);
        addProfileDelta('businessValue', 1);
        return '你坐在同一张晚宴桌旁，这次没有人再试探你，而是直接问你想要什么。<br><br>重点：你重新回到人脉线。<br><br>影响：人气+1；商业价值+1。';
      }},
      { label: '继续把时间留给训练', hint: '彻底走训练馆路线', apply: function() {
        setBranchNode('network', 'training_resource', { identity: 'training_resource' });
        addAttrDelta('MID', 1); addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把名片收进抽屉，第二天照常出现在训练馆。助教没有再劝，因为他知道，这条路同样是你想要的。<br><br>效果：中投+1，运动+1；获得“顶级训练资源”标签；人脉线以训练身份收束。';
      }}
    ]
  },
  {
    id: 'network_follow_up',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 12,
    title: '人脉线：第二次会面',
    scenes: [
      '这个夏天，你主动拨通了之前那次球局留下的联系方式。',
      '这一次不是寒暄。对方带着明确的问题来：你想把职业生涯经营成什么样？'
    ],
    body: '人脉线进入正式会面。你可以选择商业版图，或者保持球员身份的纯粹。',
    requires: function() { return getBranchNode('network') === 'golf_meet'; },
    choices: [
      { label: '接受职业版图会议', hint: '商业热度上升，未来会有更多选择', apply: function() {
        var b = setBranchNode('network', 'career_map_meeting', { status: 'business_team' });
        b.business = (b.business || 0) + 2;
        STATE.career.flags.businessBuzz = true;
        return '会议室里没有战术板，只有品牌、城市、合同和未来十年的规划。你第一次意识到，球员也可以经营自己的时代。<br><br>结果：商业热度提升；未来自由市场/品牌线获得伏笔。';
      }},
      { label: '只保留私人联系', hint: '降低商业噪音，保持训练稳定', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('network', 'private_circle', { status: 'private_circle' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        return '你没有答应任何团队，也没有拒绝任何朋友。关系被留在私人层面，训练节奏没有被打断。<br><br>结果：下赛季状态波动略降。';
      }}
    ]
  },
  {
    id: 'network_identity',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 10,
    title: '人脉线：圈层身份',
    scenes: [
      '几年过去，你已经不是被介绍进局的人。现在新的年轻球员会被带到你面前。',
      '他们看你的眼神，像是在看一个已经拿到入场券的人。'
    ],
    body: '你要把这条人脉线变成什么身份？',
    requires: function() { return getBranchNode('network') === 'career_map_meeting'; },
    choices: [
      { label: '建立自己的商业圈', hint: '商业标签成型', apply: function() {
        setBranchNode('network', 'business_circle', { identity: 'business_circle' });
        STATE.career.flags.businessLeader = true;
        return '你开始主动组织休赛期小型聚会。球员、经纪人、投资人都知道，有些事情可以通过你牵上线。<br><br>结果：获得“商业圈层”长期标签。';
      }},
      { label: '把圈子用于训练资源', hint: '训练收益稳定', apply: function() {
        setBranchNode('network', 'training_resource', { identity: 'training_resource' });
        addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把人脉主要用在训练师、康复师和高质量陪练上。它不热闹，但非常实用。<br><br>效果：运动+1；获得“顶级训练资源”长期标签。';
      }}
    ]
  },
  {
    id: 'training_camp_open',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 12,
    title: '夏日训练：夏天的岔路口',
    scenes: [
      '休赛期第一天，训练馆的灯只开了一半。助教把三份计划放在桌上：巨星训练营、专项课程、身体评估。',
      '你站在门口想了很久。过去一个赛季的疲惫、遗憾和不甘心，都堆在这个夏天面前。'
    ],
    body: '这个夏天决定的不只是属性，而是你准备成为什么样的球员。',
    requires: function() { return getBranchNode('training') === 'start'; },
    choices: [
      { label: '跟巨星练一夏', hint: '从前辈身上继承比赛理解', apply: function() {
        setBranchNode('training', 'mentor_line', { route: 'mentor' });
        return '你拨通了经纪人的电话：帮我把训练营都排上，我想看看他们怎么理解篮球。<br><br>重点：选择导师线。<br><br>影响：下一步进入导师第一课。';
      }},
      { label: '把专项磨成武器', hint: '一个方向练到对手害怕', apply: function() {
        setBranchNode('training', 'skill_line', { route: 'skill' });
        return '你把夏天的日历清空，只留下一项技术。训练师说：这是最无聊也最可怕的夏天。<br><br>重点：选择专项线。<br><br>影响：下一步进入专项第一课。';
      }},
      { label: '先把身体修好', hint: '恢复、力量、作息，重建身体底子', apply: function() {
        setBranchNode('training', 'body_line', { route: 'body' });
        return '你告诉队医：这赛季的疲劳感我不想再带着打。所有计划从一次彻底的身体评估开始。<br><br>重点：选择身体线。<br><br>影响：下一步进入身体重建计划。';
      }},
      { label: '双线并行', hint: '导师点拨 + 专项训练，强度更大', apply: function() {
        setBranchNode('training', 'dual_line', { route: 'dual' });
        return '你贪心地两个都要。教练组摇头，但你列了一张精确到小时的表：上午导师，下午专项。<br><br>重点：选择双修线。<br><br>影响：下一步进入双修计划。';
      }},
      { label: '找回篮球的乐趣', hint: '野球、孩子、家庭，让热爱先回来', apply: function() {
        setBranchNode('training', 'joy_line', { route: 'joy' });
        return '你把训练表收起来，先跑去野球场打了一下午。汗水落下来的时候，你突然觉得，自己还能再爱一次。<br><br>重点：选择乐趣线。<br><br>影响：下一步进入快乐篮球计划。';
      }}
    ]
  },
  {
    id: 'mentor_first_lesson',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 13,
    title: '夏日训练：导师第一课',
    scenes: [
      '训练馆很安静，只有鞋底摩擦地板的声音。老将没有先教动作，他先问你：你上一次真正喜欢篮球是什么时候？'
    ],
    body: '选择一位导师，带走一种比赛理解。',
    requires: function() { return getBranchNode('training') === 'mentor_line'; },
    choices: [
      { label: '奥拉朱旺：梦幻脚步', hint: '终结/内防/篮板', apply: function() {
        getBranchState('mentor').lastMentor = 'hakeem';
        setBranchNode('training', 'mentor_first', { lastMentor: 'hakeem' });
        addAttrDelta('FIN', 2); addAttrDelta('IDEF', 1); addAttrDelta('REB', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '奥拉朱旺没有急着教动作，他先让你在低位连续转身二十分钟。每次你以为找到了节奏，他都会轻轻摇头：脚先骗过人，球只是最后的证明。<br><br>效果：终结+2，内防+1，篮板+1。';
      }},
      { label: '杜兰特：无差别单打', hint: '中投/三分', apply: function() {
        getBranchState('mentor').lastMentor = 'durant';
        setBranchNode('training', 'mentor_first', { lastMentor: 'durant' });
        addAttrDelta('MID', 2); addAttrDelta('threePT', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '杜兰特让你在贴身干扰下反复出手。他说：伟大的投篮不是空位准，而是被看穿后依然能进。<br><br>效果：中投+2，三分+1。';
      }},
      { label: '詹姆斯：身体管理', hint: '运动/力量/终结', apply: function() {
        getBranchState('mentor').lastMentor = 'lebron';
        setBranchNode('training', 'mentor_first', { lastMentor: 'lebron' });
        addAttrDelta('ATH', 1); addAttrDelta('STR', 1); addAttrDelta('FIN', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '詹姆斯的训练在冲刺、对抗和阅读之间来回切换。最累的时候，他要你做最清醒的决定。<br><br>效果：运动+1，力量+1，终结+1。';
      }},
      { label: '保罗：控场大师', hint: '控球/传球/关键球', apply: function() {
        getBranchState('mentor').lastMentor = 'paul';
        setBranchNode('training', 'mentor_first', { lastMentor: 'paul' });
        addAttrDelta('HAN', 1); addAttrDelta('PAS', 2); addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '保罗不断要求你说出弱侧第二个防守人的站位。你开始明白，控场是让九个人先暴露答案。<br><br>效果：控球+1，传球+2，关键球+1。';
      }},
      { label: '库里：空间与无球', hint: '三分/无球/空间理解', apply: function() {
        getBranchState('mentor').lastMentor = 'curry';
        setBranchNode('training', 'mentor_first', { lastMentor: 'curry' });
        addAttrDelta('threePT', 2); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '库里没有让你一直投。他先带着你跑无球：什么时候加速、什么时候停、什么时候让防守人以为你放弃了。他说：三分是结果，跑动才是原因。<br><br>效果：三分+2，传球+1。';
      }},
      { label: '伦纳德：防守与重心', hint: '防守/力量/稳定', apply: function() {
        getBranchState('mentor').lastMentor = 'kawhi';
        setBranchNode('training', 'mentor_first', { lastMentor: 'kawhi' });
        addAttrDelta('PDEF', 2); addAttrDelta('STR', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '伦纳德一整个下午只让你练两件事：横移和压重心。他说：大多数人输给的不是对手，是自己的重心。<br><br>效果：外防+2，力量+1。';
      }}
    ]
  },
  {
    id: 'skill_first_lesson',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 11,
    title: '夏日训练：专项第一课',
    scenes: ['你把夏天的日历清空，只留下一项技术。训练师说：这是最无聊也最可怕的夏天。'],
    body: '选择一个专项方向，一个夏天只做一件事。',
    requires: function() { return getBranchNode('training') === 'skill_line'; },
    choices: [
      { label: '投射专项', hint: '三分/中投', apply: function() {
        getBranchState('skill_training').lastFocus = 'shooting';
        setBranchNode('training', 'skill_first', { lastFocus: 'shooting' });
        return applyTrainingOutcome('threePT', 'MID', 'shootingPity', ['你把整个夏天拆成无数个投篮点。训练师不再数命中，只记录疲劳后的出手轨迹。'], { primary: '三分', secondary: '中投' });
      }},
      { label: '持球专项', hint: '控球/终结', apply: function() {
        getBranchState('skill_training').lastFocus = 'handle';
        setBranchNode('training', 'skill_first', { lastFocus: 'handle' });
        return applyTrainingOutcome('HAN', 'FIN', 'handlePity', ['训练师在半场摆满障碍物，让你每次突破前都必须先读出协防位置。'], { primary: '控球', secondary: '终结' });
      }},
      { label: '防守专项', hint: '外防/抢断', apply: function() {
        getBranchState('skill_training').lastFocus = 'defense';
        setBranchNode('training', 'skill_first', { lastFocus: 'defense' });
        return applyTrainingOutcome('PDEF', 'STL', 'defensePity', ['你花了一周只练横移和追防。教练不让你赌博式抢断，只要求你夺走对手的舒服空间。'], { primary: '外防', secondary: '抢断' });
      }},
      { label: '身体终结专项', hint: '力量/终结', apply: function() {
        getBranchState('skill_training').lastFocus = 'strength';
        setBranchNode('training', 'skill_first', { lastFocus: 'strength' });
        return applyTrainingOutcome('STR', 'FIN', 'strengthPity', ['力量房和禁区训练被排在同一天。你先把身体练到发沉，再去篮下完成对抗终结。'], { primary: '力量', secondary: '终结' });
      }},
      { label: '组织专项', hint: '传球/关键球', apply: function() {
        getBranchState('skill_training').lastFocus = 'playmaking';
        setBranchNode('training', 'skill_first', { lastFocus: 'playmaking' });
        return applyTrainingOutcome('PAS', 'CLU', 'playmakingPity', ['你和助教把每套战术拆成三层选择：第一选择被锁死，第二选择被延误，第三选择才是真正能赢的球。'], { primary: '传球', secondary: '关键球' });
      }},
      { label: '无球跑动', hint: '空间/中投/运动', apply: function() {
        getBranchState('skill_training').lastFocus = 'offball';
        setBranchNode('training', 'skill_first', { lastFocus: 'offball' });
        addAttrDelta('MID', 1); addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你整个夏天都在和助教玩“找空位”游戏：不看球，只看防守人的眼睛。训练结束，你开始能提前半拍出现在正确的位置。<br><br>效果：中投+1，运动+1。';
      }},
      { label: '罚球稳定', hint: '关键时刻的心理锚点', apply: function() {
        getBranchState('skill_training').lastFocus = 'free_throw';
        setBranchNode('training', 'skill_first', { lastFocus: 'free_throw' });
        addAttrDelta('CLU', 1); addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你每天罚 200 球，每一球之前都做同一个呼吸。两个月后，站在罚球线上时，你听见的只剩自己的呼吸。<br><br>效果：关键球+1，运动+1。';
      }}
    ]
  },
  {
    id: 'body_rebuild_plan',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 9,
    title: '夏日训练：身体重建计划',
    scenes: [
      '身体评估报告摊在桌上：肌肉不平衡、睡眠负债、慢性炎症。队医说，好消息是这些都能修，坏消息是修它们不产生任何高光集锦。'
    ],
    body: '先成为健康的身体，再成为更强的球员。',
    requires: function() { return getBranchNode('training') === 'body_line'; },
    choices: [
      { label: '科学恢复', hint: '康复优先，长期风险下降', apply: function() {
        setBranchNode('training', 'body_plan', { plan: 'recovery' });
        addSeasonMod('injuryRiskBonus', -2, -4, 8);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你把每天的恢复课当成正式训练。训练师说：大多数人不是输在天赋，是输在不肯慢下来。<br><br>效果：伤病风险-2；状态波动-1。';
      }},
      { label: '力量加练', hint: '对抗和爆发提升，负荷较高', apply: function() {
        setBranchNode('training', 'body_plan', { plan: 'strength' });
        addAttrDelta('STR', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('injuryRiskBonus', 1, -4, 8);
        return '力量房成了你的第二个家。老将路过时只说了一句：别急，身体会给你的耐心付利息。<br><br>效果：力量+2；伤病风险+1。';
      }},
      { label: '营养作息', hint: '睡眠和饮食重建，状态更稳', apply: function() {
        setBranchNode('training', 'body_plan', { plan: 'nutrition' });
        addSeasonMod('formVariance', -2, -10, 10);
        addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你戒了夜宵，把手机放在客厅充电。两个月后，队医说你的恢复指标像换了个人。<br><br>效果：状态波动-2；运动+1。';
      }},
      { label: '家人陪伴康复', hint: '心理放松，家人参与训练生活', apply: function() {
        setBranchNode('training', 'body_plan', { plan: 'family' });
        addProfileDelta('fanSupport', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你每周空出一天让家人来训练馆。孩子在场边拍球，你在场中恢复。那一年，你第一次觉得训练馆也是家的延伸。<br><br>效果：球迷支持+1；状态波动-1。';
      }}
    ]
  },
  {
    id: 'dual_training_plan',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 10,
    title: '夏日训练：双修计划',
    scenes: ['你贪心地两个都要。教练组摇头，但你列了一张精确到小时的表：上午导师，下午专项。'],
    body: '双修不是偷懒，是更高强度的自我要求。',
    requires: function() { return getBranchNode('training') === 'dual_line'; },
    choices: [
      { label: '导师主导 + 专项辅助', hint: '比赛理解优先', apply: function() {
        setBranchNode('training', 'dual_plan', { plan: 'mentor_first' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '上午跟着导师读比赛，下午用专项把理解变成肌肉记忆。导师说：你是我见过最会用身体记笔记的人。<br><br>效果：关键球+1。';
      }},
      { label: '专项主导 + 导师点拨', hint: '技术优先，导师纠正细节', apply: function() {
        setBranchNode('training', 'dual_plan', { plan: 'skill_first' });
        addAttrDelta('MID', 1); addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('formVariance', -1, -10, 10);
        return '下午的专项课决定方向，上午的导师课只负责纠错。一个夏天下来，你的动作没变多，但每个动作都变对了。<br><br>效果：中投+1，运动+1；状态波动-1。';
      }},
      { label: '轻量双修', hint: '两项都练但都不过载', apply: function() {
        setBranchNode('training', 'dual_plan', { plan: 'light' });
        addAttrDelta('ATH', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把强度控制在八成，只求每堂课都完整。训练师说：完整比猛烈更能坚持到九月。<br><br>效果：运动+1，传球+1；伤病风险-1。';
      }}
    ]
  },
  {
    id: 'joy_basketball_plan',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 7,
    title: '夏日训练：快乐篮球计划',
    scenes: ['你把训练表收起来，先跑去野球场打了一下午。汗水落下来的时候，你突然觉得，自己还能再爱一次。'],
    body: '找回热爱，也是训练的一部分。',
    requires: function() { return getBranchNode('training') === 'joy_line'; },
    choices: [
      { label: '野球局', hint: '即兴对抗，手感与创造力', apply: function() {
        setBranchNode('training', 'joy_plan', { plan: 'pickup' });
        addAttrDelta('HAN', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你混进社区的野球局，没人让着你，也没人采访你。你打出了这个夏天最开心的几个回合。<br><br>效果：控球+1；手感提升。';
      }},
      { label: '教孩子', hint: '把技术讲出来，理解更深', apply: function() {
        setBranchNode('training', 'joy_plan', { plan: 'kids' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addProfileDelta('fanSupport', 1);
        return '你在小球馆教孩子们第一步。有个男孩怎么都学不会，你蹲下来陪他练了四十分钟。他学会那天，笑得比你还大声。<br><br>效果：传球+1；球迷支持+1。';
      }},
      { label: '家庭投篮', hint: '让篮球回到生活里', apply: function() {
        setBranchNode('training', 'joy_plan', { plan: 'family' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '你带着家人每天傍晚投一会儿篮。孩子投进第一个球时，你忽然想起自己小时候爸爸也是这样教的。<br><br>效果：状态波动-1；球迷支持+1。';
      }}
    ]
  },
  {
    id: 'mentor_deepen',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 12,
    title: '夏日训练：导师深化',
    scenes: [
      '第一次训练之后，你以为自己已经懂了。直到导师第二次见面，他把录像停在你最狼狈的那个回合：动作只是门票，理解才是房间。'
    ],
    body: '把学到的东西变成比赛习惯。',
    requires: function() { return getBranchNode('training') === 'mentor_first'; },
    choices: [
      { label: '把技术融入关键战', hint: '关键球提升', apply: function() {
        setBranchNode('training', 'mentor_deep', { lesson: 'clutch_translation' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '训练从动作课变成了最后两分钟模拟。你被迫在疲劳、包夹和噪音里做选择。<br><br>效果：关键球+1。';
      }},
      { label: '反复打磨基础动作', hint: '稳定提升核心技术', apply: function() {
        setBranchNode('training', 'mentor_deep', { lesson: 'foundation' });
        addAttrDelta('MID', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有追求新招，而是把已有动作重复到不需要思考。<br><br>效果：中投+1，传球+1。';
      }},
      { label: '学习如何教会队友', hint: '传球和队友线提升', apply: function() {
        setBranchNode('training', 'mentor_deep', { lesson: 'teaching' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        STATE.career.flags.teachingSkill = true;
        return '导师让你把刚学会的东西讲给年轻球员听。你第一次发现，教一遍比自己练十遍更能暴露理解的漏洞。<br><br>效果：传球+1；flag teachingSkill = true。';
      }},
      { label: '身体管理', hint: '伤病风险下降，晚年技术维持', apply: function() {
        setBranchNode('training', 'mentor_deep', { lesson: 'body' });
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        STATE.career.flags.bodyManagement = true;
        return '导师把恢复课排进你的每一天。他说：天赋让你进联盟，习惯才决定你能待多久。<br><br>效果：伤病风险-1；晚年技术维持倾向。';
      }}
    ]
  },
  {
    id: 'skill_deepen',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 12,
    title: '夏日训练：专项深化',
    scenes: ['第二个专项夏天，进步不再像第一次那么明显。训练师说：现在不是练更多，而是决定你到底是谁。'],
    body: '深挖、补短板、强化体能，还是拉到实战里检验？',
    requires: function() { return getBranchNode('training') === 'skill_first'; },
    choices: [
      { label: '继续深挖上次专项', hint: '更高突破概率，但过度训练风险存在', apply: function() {
        var b = getBranchState('skill_training');
        var focus = b.lastFocus || 'shooting';
        setBranchNode('training', 'skill_deep', { identityPath: focus });
        if (focus === 'handle') return applyTrainingOutcome('HAN', 'FIN', 'handlePity', ['你决定不换方向，把上个夏天没吃透的动作继续磨下去。'], { primary: '控球', secondary: '终结' });
        if (focus === 'defense') return applyTrainingOutcome('PDEF', 'STL', 'defensePity', ['你继续把自己锁在防守训练里，一次次重来脚步角度。'], { primary: '外防', secondary: '抢断' });
        if (focus === 'strength') return applyTrainingOutcome('STR', 'FIN', 'strengthPity', ['你继续泡在力量房里，把对抗终结当成每天最后一课。'], { primary: '力量', secondary: '终结' });
        if (focus === 'playmaking') return applyTrainingOutcome('PAS', 'CLU', 'playmakingPity', ['你把战术选择继续拆细，逼自己在第三选择里找到赢球答案。'], { primary: '传球', secondary: '关键球' });
        return applyTrainingOutcome('threePT', 'MID', 'shootingPity', ['你继续投，投到训练师不再看命中率，只看你的动作是否完全一样。'], { primary: '三分', secondary: '中投' });
      }},
      { label: '补强短板', hint: '低风险均衡成长', apply: function() {
        setBranchNode('training', 'skill_deep', { identityPath: 'balanced' });
        addAttrDelta('ATH', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你没有继续追逐一个夸张突破，而是把夏天拆给体能、传球和基础动作。<br><br>效果：运动+1，传球+1。';
      }},
      { label: '强化体能', hint: '运动与恢复优先', apply: function() {
        setBranchNode('training', 'skill_deep', { identityPath: 'stamina' });
        addAttrDelta('ATH', 2); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把夏天后半段交给体能师。训练师说：技术决定你有多高，体能决定你能站多高多久。<br><br>效果：运动+2；伤病风险-1。';
      }},
      { label: '实战检验', hint: '用比赛验证训练', apply: function() {
        setBranchNode('training', 'skill_deep', { identityPath: 'live' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你约了几场高强度对抗赛，把自己扔进真实的攻防里。有一场被防得很惨，但那晚你反而睡得最踏实。<br><br>效果：关键球+1；状态波动+1。';
      }}
    ]
  },
  {
    id: 'training_identity',
    branch: 'training', phase: 'offseason', slot: 'main', weight: 10,
    title: '夏日训练：训练收束',
    scenes: [
      '九月的第一场队内训练，助教把你的新数据放到大屏幕上。它已经不只是属性，而是你的打法画像。',
      '你想起这个夏天的每一个清晨、每一滴汗、每一次想放弃又继续的瞬间。'
    ],
    body: '选择你希望被记住的样子。',
    requires: function() {
      var node = getBranchNode('training');
      return node === 'mentor_deep' || node === 'skill_deep' || node === 'body_plan' || node === 'dual_plan' || node === 'joy_plan';
    },
    choices: [
      { label: '关键战解决者', hint: '关键球提升', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'closer' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你开始有了自己的招牌回合。对手知道你要做什么，但仍然很难阻止。<br><br>效果：关键球+1；获得“关键战解决者”标签。';
      }},
      { label: '技术型领袖', hint: '传球提升', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'technical_leader' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '年轻队友开始围着你问问题。你说得越多，理解得越深。<br><br>效果：传球+1；获得“技术型领袖”标签。';
      }},
      { label: '身体管理样本', hint: '伤病风险下降', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'body_standard' });
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你的恢复课成了队内模板。没有漂亮镜头，但每个人都想复制你的长赛季。<br><br>效果：伤病风险-1；获得“身体管理样本”标签。';
      }},
      { label: '招牌技术', hint: '专项主属性提升', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'signature_skill' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你终于有了对手赛前报告里必须加粗的一项技术。<br><br>效果：关键球+1；获得“招牌技术”标签。';
      }},
      { label: '全面打法', hint: '稳定性提升', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('training', 'training_identity', { identity: 'balanced_player' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        return '你没有一项极端夸张的武器，但每个夜晚都更难被针对。<br><br>效果：状态波动-1；获得“全面打法”标签。';
      }},
      { label: '双修全能', hint: '比赛理解和专项技术并存', apply: function() {
        setBranchNode('training', 'training_identity', { identity: 'dual_versatile' });
        addAttrDelta('CLU', 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '有人说你不够纯粹，但你心里清楚：你已经不是只会一种方式打球的球员。<br><br>效果：关键球+1，传球+1；获得“双修全能”标签。';
      }}
    ]
  },
  {
    id: 'team_practice_start',
    branch: 'team_practice', phase: 'offseason', slot: 'main', weight: 9,
    title: '球队线：提前合练',
    scenes: ['休赛期刚过一半，你在群里发了一条消息：想提前合练的，后天早上训练馆见。你知道这能让球队更快进入状态。'],
    body: '你要组织球队合练，还是把夏天留给个人恢复？',
    requires: function() { return getBranchNode('team_practice') === 'start'; },
    choices: [
      { label: '组织球队合练', hint: '默契提升，开启领袖线', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_start', { status: 'organized' }); mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 2); mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs); return '你把队友一个个叫回训练馆。没人说这是领袖投票，但所有人都在用行动投票。<br><br>效果：传球+1；球队默契提升；球队线进入回应阶段。'; }},
      { label: '个人恢复优先', hint: '降低伤病风险', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_start', { status: 'recovery' }); mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1); return '你选择把身体修好。教练理解这个决定，但队友们也会记住这个夏天你没有出现。<br><br>效果：下赛季伤病风险略降；球队线进入回应阶段。'; }}
    ]
  },
  {
    id: 'team_practice_response',
    branch: 'team_practice', phase: 'offseason', slot: 'main', weight: 10,
    title: '球队线：队内回应',
    scenes: ['第二年夏天，合练邀请变得微妙。年轻球员期待你开口，核心队友也在观察你的态度。'],
    body: '你要把自己推向更衣室领袖的位置吗？',
    requires: function() { return getBranchNode('team_practice') === 'practice_start'; },
    choices: [
      { label: '主动承担领袖责任', hint: '球队默契和传球提升', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_response', { leadership: 'vocal' }); mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 2); addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs); return '你不再只是参加合练的人，而是安排训练内容、提醒年轻队友站位的人。<br><br>效果：传球+1；球队默契提升；球队线进入队魂阶段。'; }},
      { label: '保持低调，只做好自己', hint: '降低波动，不争队内话语权', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_response', { leadership: 'quiet' }); mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1); return '你没有演讲，也没有喊口号，只是每天第一个到训练馆。久而久之，这也成了一种声音。<br><br>效果：下赛季状态波动略降；球队线进入队魂阶段。'; }},
      { label: '把舞台让给年轻队友', hint: '年轻球员成长，个人声望温和', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_mentor', { leadership: 'mentor' }); mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1); STATE.career.flags.youthDevelopment = true; return '你把训练安排和回合组织交给年轻人，只在关键节点帮他们纠错。他们开始敢在你面前大声说话。<br><br>重点：你选择让位。<br><br>影响：球队默契略升；年轻球员成长。'; }}
    ]
  },
  {
    id: 'team_practice_identity',
    branch: 'team_practice', phase: 'offseason', slot: 'main', weight: 8,
    title: '球队线：队魂雏形',
    scenes: ['这一次，合练不再需要你发消息。年轻球员已经提前到了。教练看着你，像是在看这支球队的秩序。'],
    body: '球队线收束。你要留下怎样的队内标签？',
    requires: function() { return getBranchNode('team_practice') === 'practice_response' || getBranchNode('team_practice') === 'practice_mentor'; },
    choices: [
      { label: '成为更衣室领袖', hint: '退役球衣队史分倾向提升', apply: function() { setBranchNode('team_practice', 'practice_identity', { identity: 'locker_room_leader' }); STATE.career.flags.lockerRoomLeader = true; return '你说话不一定最多，但关键时刻所有人都会看你。<br><br>结果：获得“更衣室领袖”长期标签。'; }},
      { label: '成为训练馆标杆', hint: '身体管理更稳定', apply: function() { var mods = getNextSeasonMods(); setBranchNode('team_practice', 'practice_identity', { identity: 'gym_standard' }); mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1); return '你的训练方式成了队内年轻人的模板。没有海报，没有口号，只有每天重复。<br><br>结果：获得“训练馆标杆”长期标签；下赛季伤病风险略降。'; }},
      { label: '成为年轻球员导师', hint: '传球和年轻球员成长提升', apply: function() { setBranchNode('team_practice', 'practice_identity', { identity: 'team_mentor' }); STATE.career.flags.youthMentor = true; addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs); return '你开始把每个夏天的录像课交给年轻人讲，自己只补最后一层。他们讲得越来越像你。<br><br>效果：传球+1；获得“年轻球员导师”标签。'; }}
    ]
  },
  {
    id: 'family_table_talk',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '家庭：餐桌上的问题',
    scenes: [
      '赛季结束后，你没有第一时间去训练馆。你主动把那个一直回避的问题摆上桌。',
      '她说：我不是要你少爱篮球，我只是想知道，我们在你的人生里有没有位置。'
    ],
    body: '这不是逼你做选择，而是让你承认篮球之外也有人在等你。',
    requires: function() {
      var c = STATE.career || {};
      var partner = (c.relationships && c.relationships.partner) || {};
      var since = partner.sinceSeason == null ? 0 : (c.seasonCount || 0) - partner.sinceSeason;
      return getBranchNode('family') === 'start' && getBranchNode('relationship') === 'partnership' && ((c.currentAge || 22) >= 28 || since >= 2);
    },
    choices: [
      { label: '把家庭放进计划里', hint: '生活更稳定，但训练安排会更谨慎', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_plan', { status: 'committed' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('fanSupport', 1);
        return '你没有说漂亮话，只是把下个月的训练表打开，认真空出几天。她看着你改行程，终于笑了一下。<br><br>重点：你开始把亲密关系当成职业生涯的一部分，而不是赛季之外的附属品。<br><br>影响：下赛季状态更稳定；生活压力下降。';
      }},
      { label: '先完成争冠窗口', hint: '短期更专注，关系压力上升', apply: function() {
        setBranchNode('family', 'career_priority', { status: 'delayed' });
        addSeasonMod('moraleBonus', 1, -10, 10);
        addProfileDelta('controversy', 1);
        return '你沉默了很久，说自己还需要一到两年。她没有吵，只是点点头。那种安静比争吵更重。<br><br>重点：你把冠军窗口放在前面，但这段关系开始承受时间的磨损。<br><br>影响：短期斗志上升；未来家庭事件可能带来更大压力。';
      }},
      { label: '暂时回避承诺', hint: '暂缓决定，但关系开始磨损', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'avoid_commitment', { status: 'avoided' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('controversy', 1);
        return '你说赛季太忙，等稳定下来再谈。她没再追问，但那个晚上之后，你们的对话少了一点东西。<br><br>重点：你争取了时间，也让关系开始磨损。<br><br>影响：下赛季状态波动略降；争议上升。';
      }}
    ]
  },
  {
    id: 'family_daily_life',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '家庭：把家过成日常',
    scenes: [
      '她开始出现在你生活的固定角落：晨练前的一杯咖啡，客场回来门口的一盏灯。',
      '你发现，承诺不需要每天说，但它需要每天都有人在场。'
    ],
    body: '家庭优先不是放弃篮球，而是让生活有地方落脚。',
    requires: function() { return getBranchNode('family') === 'family_plan'; },
    choices: [
      { label: '把家庭排进赛季日历', hint: '给家人固定时间，状态更稳', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_settled', { status: 'settled' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        mods.injuryRiskBonus = Math.max(-4, (mods.injuryRiskBonus || 0) - 1);
        addProfileDelta('fanSupport', 1);
        return '你在手机日历里给家庭日上了锁，连训练师都不许改。她说你终于学会不是把所有时间都交给球队。<br><br>重点：家庭进入长期稳定。<br><br>影响：下赛季状态波动明显下降；伤病风险略降；球迷支持+1。';
      }},
      { label: '带家人一起面对客场', hint: '让家人进入你真实的生活', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_settled', { status: 'settled' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addSeasonMod('moraleBonus', 1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '孩子第一次跟你坐球队包机，全程盯着窗外。你忽然明白，你不在家的每一晚，她们都在用另一种方式等你。<br><br>重点：家庭进入长期稳定。<br><br>影响：下赛季状态波动略降；士气+1；球迷支持+1。';
      }}
    ]
  },
  {
    id: 'family_balance',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '家庭：家庭与冠军之间',
    scenes: [
      '争冠窗口没有因为家庭停下来，但它开始变得更具体：总决赛赛程、孩子的生日、她独自撑过的那些客场。',
      '你终于要回答那个被推迟很久的问题。'
    ],
    body: '冠军和家庭不是二选一，但你需要先让家里的人相信这一点。',
    requires: function() { return getBranchNode('family') === 'career_priority'; },
    choices: [
      { label: '给家庭一个明确时限', hint: '用具体承诺修复信任', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_settled', { status: 'settled' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 2);
        addProfileDelta('controversy', -1);
        addProfileDelta('mediaTrust', 1);
        return '你告诉她：给我这两年，之后时间都是你们的。她认真看着你，最后点头：好，我信你一次。<br><br>重点：家庭转稳，信任被补回来。<br><br>影响：下赛季状态波动明显下降；争议下降；媒体好感+1。';
      }},
      { label: '让家人进入决策', hint: '把选择权和家人分享', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_settled', { status: 'settled' });
        STATE.career.flags.familyPriority = true;
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        mods.teamChemistry = Math.min(5, (mods.teamChemistry || 0) + 1);
        addProfileDelta('fanSupport', 1);
        return '你把交易流言和赛程摊在桌上，和她一起决定夏天怎么过。她第一次觉得，自己不是被你人生排除在外的人。<br><br>重点：家庭转稳，关系更真实。<br><br>影响：下赛季状态波动略降；球队默契+1；球迷支持+1。';
      }},
      { label: '把承诺继续推后', hint: '短期专注，但家庭裂痕加深', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_pressure', { status: 'pressure' });
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 1);
        mods.injuryRiskBonus = Math.min(8, (mods.injuryRiskBonus || 0) + 1);
        addProfileDelta('controversy', 1);
        return '你只说“再等等”。这句话你用过太多次，她这次没有点头，只是把门轻轻带上了。<br><br>重点：家庭进入压力状态。<br><br>影响：下赛季状态波动略升；伤病风险略升；争议上升。';
      }}
    ]
  },
  {
    id: 'family_avoidance_cost',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '家庭：回避的代价',
    scenes: [
      '你回避的那个问题没有消失，它只是换了更安静的方式出现：更少的电话、更长的沉默、更客气的“没事”。',
      '你主动约她坐下来，这一次没有人愿意再假装没事。'
    ],
    body: '回避的代价，是让两个人都在等待中磨损。',
    requires: function() { return getBranchNode('family') === 'avoid_commitment'; },
    choices: [
      { label: '认真补上承诺', hint: '修复关系，但裂缝仍然存在', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_pressure', { status: 'repaired_pressure' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('controversy', -1);
        return '你推掉一个商业活动，专门空出周末。她听完你的计划，眼睛有点红：你知道我等这句话等了多久吗。<br><br>重点：关系开始修复，但裂缝还在。<br><br>影响：下赛季状态波动略降；争议下降。';
      }},
      { label: '把话说开，体面放下', hint: '结束关系，留下遗憾', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_regret', { status: 'regret' });
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('controversy', 1);
        return '你们没有争吵，只是承认彼此需要的东西不一样。那顿饭吃完，谁都没有再联系谁。<br><br>重点：家庭故事以遗憾收场。<br><br>影响：下赛季状态波动略降；争议上升。';
      }},
      { label: '继续回避', hint: '不面对，让关系慢慢熄灭', apply: function() {
        var mods = getNextSeasonMods();
        setBranchNode('family', 'family_regret', { status: 'regret' });
        mods.formVariance = Math.min(5, (mods.formVariance || 0) + 2);
        addProfileDelta('controversy', 2);
        addProfileDelta('fanSupport', -1);
        return '她不再问，也不再等你。你训练完打开手机，消息停留在三天前。<br><br>重点：回避让家庭故事慢慢熄灭。<br><br>影响：下赛季状态波动上升；争议上升；球迷支持下降。';
      }}
    ]
  },
  {
    id: 'family_late_career',
    branch: 'family', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '家庭：客场的深夜',
    scenes: [
      '你已经不再年轻。某个客场深夜，你看着手机里孩子发来的一段视频，突然发现自己错过了太多第一次。',
      '教练组说还能打，身体也说还能扛，但你知道，有些时间一旦错过就不会再有。'
    ],
    body: '晚年收束。家庭会改变你愿意留在球场多久。',
    requires: function() {
      var node = getBranchNode('family');
      return node === 'family_settled' || node === 'family_pressure' || node === 'family_regret';
    },
    choices: [
      { label: '继续战斗', hint: '保持角色，把家庭放进未来计划', apply: function() {
        STATE.career.flags.familyRetireTendency = 'play';
        addSeasonMod('moraleBonus', 1, -10, 10);
        return '你给家里打了电话，说再给我一年。电话那头沉默了几秒，然后说：好，但这是最后一年了。<br><br>重点：你选择继续战斗，但时间开始有边界。<br><br>影响：短期斗志上升。';
      }},
      { label: '降低角色，多陪家人', hint: '调整角色，家庭优先', apply: function() {
        var mods = getNextSeasonMods();
        STATE.career.flags.familyRetireTendency = 'family';
        mods.formVariance = Math.max(-3, (mods.formVariance || 0) - 1);
        addProfileDelta('fanSupport', 1);
        return '你主动和教练谈角色调整，把上场时间让给年轻人。孩子的视频，你终于能第一时间点开。<br><br>重点：你选择把时间留给家人。<br><br>影响：下赛季状态波动略降；球迷支持+1。';
      }},
      { label: '把退役提上日程', hint: '主动结束球员生涯', apply: function() {
        STATE.career.flags.familyRetireTendency = 'retire';
        addProfileDelta('legacyBonus', 1);
        return '你在更衣室待到所有人都走光，最后把护具放进包里。不是打不动了，是有些地方更需要你。<br><br>重点：你主动决定生涯的终点。<br><br>影响：历史评价略升。';
      }}
    ]
  },
  {
    id: 'china_market_homecoming',
    branch: 'china_market', phase: 'offseason', slot: 'main', weight: 10,
    title: '中国市场：中国行',
    scenes: [
      '机场出口的人群比你想象中更夸张。有人举着你国家队的照片，也有人穿着你职业球队的球衣。',
      '你忽然意识到，这两种身份在这里重叠了。'
    ],
    body: '这趟中国行会消耗你的休赛期，但也会让你的影响力真正落到球迷面前。',
    requires: function() {
      var chinaNode = getBranchNode('china_team');
      return getBranchNode('china_market') === 'start'
        && (['national_core','team_core','managed_core','national_flag','team_revival','injured_hero','national_legend','national_mentor','honorable_exit'].indexOf(chinaNode) >= 0
            || hasCareerHonor('全明星') || hasCareerHonor('MVP'));
    },
    choices: [
      { label: '完整参加中国行', hint: '中国人气上升，但身体负担增加', apply: function() {
        setBranchNode('china_market', 'market_tour', { status: 'tour' });
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('businessValue', 1);
        addSeasonMod('injuryRiskBonus', 1, -4, 8);
        return '你跑了三座城市，签名签到手腕发酸。最后一站，有个孩子举着手写海报说，他也想进国家队。<br><br>重点：你不再只是海外联赛里的中国球员，而是很多年轻球迷的现实坐标。<br><br>影响：中国人气上升；商业价值上升；下赛季身体负担略增。';
      }},
      { label: '缩短行程保护身体', hint: '保留精力，但热度少一点', apply: function() {
        setBranchNode('china_market', 'market_light', { status: 'light' });
        addProfileDelta('chinaPopularity', 1);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你砍掉了两个商业站台，只留下球迷见面会和一次公开训练。机场的人没变少，但你的训练表终于没被活动塞满。<br><br>重点：你保住了身体，也让热度保持在场。<br><br>影响：中国人气略升；下赛季伤病风险略降；状态波动略降。';
      }},
      { label: '把时间留给青训活动', hint: '商业少一点，但中国篮球评价更高', apply: function() {
        setBranchNode('china_market', 'market_grassroots', { status: 'grassroots' });
        addProfileDelta('chinaPopularity', 2);
        addProfileDelta('legacyBonus', 1);
        return '你取消了两个商业站台，把时间留给一座小球馆。孩子们的动作很生涩，但每个人都在认真听你讲第一步。<br><br>重点：这不是流量最高的选择，却让你和中国篮球的关系变得更深。<br><br>影响：中国篮球评价上升；退役后的国家队/青训相关结局更容易出现。';
      }}
    ]
  },
  {
    id: 'china_market_brand_offer',
    branch: 'china_market', phase: 'offseason', slot: 'main', weight: 12,
    title: '中国市场：国产品牌接触',
    scenes: [
      '品牌方没有先谈钱。他们拿出一张设计图，上面写着你的中文名字。',
      '负责人说：我们想做一双中国孩子会记住的鞋。'
    ],
    body: '球鞋线在这里分叉：国产品牌、国际大牌，还是自己的品牌。',
    requires: function() {
      var node = getBranchNode('china_market');
      return node === 'market_tour' || node === 'market_light' || node === 'market_grassroots';
    },
    choices: [
      { label: '签国产品牌', hint: '国内支持强，品牌故事更稳', apply: function() {
        setBranchNode('china_market', 'domestic_brand', { status: 'domestic' });
        addProfileDelta('chinaPopularity', 2);
        addProfileDelta('businessValue', 2);
        addProfileDelta('mediaTrust', 1);
        return '你看着设计图上自己的中文名字，想起小时候隔着橱窗看球鞋的自己。你签下了名字，也签下了一个承诺。<br><br>重点：你和中国品牌绑定在一起。<br><br>影响：中国人气上升；商业价值上升；媒体好感上升。';
      }},
      { label: '等待国际大牌', hint: '商业收益更高，但舆论压力更大', apply: function() {
        addProfileDelta('businessValue', 3);
        addProfileDelta('chinaPopularity', 1);
        addSeasonMod('mediaPressure', 1, -10, 10);
        setBranchNode('china_market', 'global_brand', { status: 'global' });
        return '国际品牌的条件确实更好，但谈判拖了很久。网上开始有人问：你是不是看不上中国品牌？<br><br>重点：你选择了更大的盘子，也接住了更大的议论。<br><br>影响：商业价值大幅上升；中国人气略升；媒体压力上升。';
      }},
      { label: '尝试个人品牌', hint: '自由度和品牌烙印最高，风险也高', apply: function() {
        addProfileDelta('businessValue', 1);
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        setBranchNode('china_market', 'own_brand', { status: 'own' });
        return '你决定自己组团队、自己投钱、自己选颜色。所有人都说这条路更难，但你想要一双真正属于你的鞋。<br><br>重点：你把自己的名字押上去。<br><br>影响：商业价值略升；人气上升；争议上升。';
      }}
    ]
  },
  {
    id: 'china_market_shoe_deal',
    branch: 'china_market', phase: 'offseason', slot: 'main', weight: 12,
    title: '中国市场：球鞋落地',
    scenes: [
      '设计师把第一版鞋样推到你面前。你伸手摸了摸鞋面，忽然想起小时候站在商店橱窗外看球鞋的自己。',
      '球鞋会在中国发售，也会跟你的名字一起被反复提起。'
    ],
    body: '签名鞋的风格会决定它被记住的方式。',
    requires: function() {
      var node = getBranchNode('china_market');
      return node === 'domestic_brand' || node === 'global_brand' || node === 'own_brand';
    },
    choices: [
      { label: '强调性能', hint: '球场口碑优先', apply: function() {
        setBranchNode('china_market', 'shoe_settled', { status: 'settled' });
        STATE.career.flags.chinaShoeBrand = true;
        addProfileDelta('businessValue', 2);
        return '你把鞋底、防侧翻和缓震全部调成比赛标准。首发配色普通，但穿上的人都说：这是一双真正能打球的鞋。<br><br>重点：这双鞋开始替你说话。<br><br>影响：商业价值上升；球鞋口碑提升。';
      }},
      { label: '强调故事', hint: '用生涯叙事打动球迷', apply: function() {
        setBranchNode('china_market', 'shoe_settled', { status: 'settled' });
        STATE.career.flags.chinaShoeBrand = true;
        addProfileDelta('fanSupport', 2);
        addProfileDelta('legacyBonus', 1);
        return '鞋面上印着你的城市、号码和一路走来的年份。很多球迷说，这双鞋里装着一个完整的人生。<br><br>重点：这双鞋装着你的人生。<br><br>影响：球迷支持上升；历史评价上升。';
      }},
      { label: '强调中国元素', hint: '和中国篮球绑定更深', apply: function() {
        setBranchNode('china_market', 'shoe_settled', { status: 'settled' });
        STATE.career.flags.chinaShoeBrand = true;
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('legacyBonus', 1);
        return '鞋舌内侧绣着国旗的轮廓，后跟是汉字签名。发售那天，中国球迷把它当成一种身份的证明。<br><br>重点：这双鞋和你的身份连在一起。<br><br>影响：中国人气大幅上升；历史评价上升。';
      }},
      { label: '追求高利润', hint: '商业最大化，但口碑有风险', apply: function() {
        setBranchNode('china_market', 'shoe_settled', { status: 'settled' });
        STATE.career.flags.chinaShoeBrand = true;
        addProfileDelta('businessValue', 3);
        addProfileDelta('controversy', 1);
        return '你选了最轻便也最便宜的材料组合，定价却很高。销量不错，但球场上开始有人抱怨鞋底寿命。<br><br>重点：这双鞋带来了销量，也带来了争议。<br><br>影响：商业价值大幅上升；争议上升。';
      }}
    ]
  },
  {
    id: 'media_first_press',
    branch: 'media', phase: 'season', slot: 'main', weight: 12,
    title: '媒体：输球发布会',
    scenes: [
      '更衣室的门还没关，记者已经围上来。你刚打出一场想删掉的比赛，输球原因却在镜头前被拆成一百个问题。',
      '记者问你：今晚最后几个回合，你是不是太想自己解决了？'
    ],
    body: '同样的失利，不同的表达会留下不同的人设。',
    requires: function() {
      var c = STATE.career || {};
      var played = (c.totalStats && c.totalStats.games > 0) || (STATE.season && STATE.season.playerStats && STATE.season.playerStats.games > 0);
      var honored = hasCareerHonor('全明星') || hasCareerHonor('MVP') || hasCareerHonor('总冠军');
      return getBranchNode('media') === 'start' && (played || honored);
    },
    choices: [
      { label: '承担责任', hint: '媒体好感与队友关系提升', apply: function() {
        setBranchNode('media', 'press_accountable', { tone: 'accountable' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('lockerRoomTrust', 1);
        return '你没有甩锅，把最后几个回合的责任全部接过来。队友没有说话，但更衣室安静了几秒——那是信任开始生长的声音。<br><br>效果：媒体好感+2；更衣室信任+1。';
      }},
      { label: '强调团队问题', hint: '保护自己，但会显得回避', apply: function() {
        setBranchNode('media', 'press_team', { tone: 'team' });
        addProfileDelta('mediaTrust', 1);
        return '你说篮球是五个人的比赛，输球不该由一个人背锅。话没错，但镜头切走时，你知道媒体想要的不是答案，是标题。<br><br>效果：媒体好感+1；队友线轻微受益。';
      }},
      { label: '拒绝评价', hint: '降低热度，专注比赛', apply: function() {
        setBranchNode('media', 'press_silent', { tone: 'silent' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fame', -1);
        return '你只说了一句“下一场见”，然后起身离开。没有漂亮话，但训练师说你那晚投篮特别安静。<br><br>效果：状态波动-1；人气-1。';
      }},
      { label: '反问记者', hint: '热度上升，争议上升', apply: function() {
        setBranchNode('media', 'press_confront', { tone: 'confront', confront: true });
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你反问：如果是你最后三分钟五次失误，你会怎么总结？采访间安静了一秒，然后所有人都知道明天头条有了。<br><br>效果：人气+1；争议+1；接下来的头条，都会围着你转。';
      }}
    ]
  },
  {
    id: 'media_social_storm',
    branch: 'media', phase: 'season', slot: 'main', weight: 12,
    title: '媒体：社交媒体风波',
    scenes: [
      '你深夜发了一条社交媒体动态。醒来时，它已经被截图转发，不再是情绪话，而是所有节目讨论的标题。'
    ],
    body: '你无法控制别人怎么截图，但你可以控制自己怎么回应。',
    requires: function() {
      var node = getBranchNode('media');
      if (node === 'press_accountable' || node === 'press_team' || node === 'press_silent' || node === 'press_confront') return true;
      var rl = getBranchNode('relationship');
      var cm = getBranchNode('china_market');
      var nw = getBranchNode('network');
      var contra = (STATE.career.profile && STATE.career.profile.controversy) || 0;
      return rl === 'public' || rl === 'crisis' || cm === 'shoe_settled' || nw === 'business_circle' || contra >= 2;
    },
    choices: [
      { label: '道歉', hint: '短期口碑受损，长期形象挽回', apply: function() {
        setBranchNode('media', 'crisis_apology', { response: 'apology' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你发了一条没有删改的道歉，承认那句话不该发。评论区一半在骂，一半在说：至少他敢认。<br><br>效果：媒体好感+1；争议-1；商业热度短期下降。';
      }},
      { label: '解释', hint: '保持中立，不温不火', apply: function() {
        setBranchNode('media', 'crisis_explain', { response: 'explain' });
        return '你解释了语境，没有认错也没有反击。热度慢慢退去，但总有人觉得你在找借口。<br><br>效果：媒体好感0；争议0。';
      }},
      { label: '删除并沉默', hint: '让热度自然消退，但留下猜测', apply: function() {
        setBranchNode('media', 'crisis_delete', { response: 'delete' });
        addProfileDelta('mediaTrust', -1);
        addProfileDelta('controversy', 1);
        return '你删了动态，没有发任何解释。几天后热度被别的事盖过，但评论区永远有人提“他删了”。<br><br>效果：媒体好感-1；争议+1。';
      }},
      { label: '强硬回应', hint: '热度暴涨，人设更硬', apply: function() {
        setBranchNode('media', 'crisis_strong', { response: 'strong' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 2);
        return '你发了一条更长的回应，直接点名所有断章取义的人。转发量爆炸，支持者和批评者都更兴奋了。<br><br>效果：人气+2；争议+2。';
      }}
    ]
  },
  {
    id: 'media_persona',
    branch: 'media', phase: 'season', slot: 'main', weight: 10,
    title: '媒体：人设成型',
    scenes: [
      '几个月过去，媒体不再纠结那一条动态。他们开始用一句话概括你：你是哪种球员，也是哪种人。',
      '你发现，人设不是别人给你的，是每一次发言自己攒出来的。'
    ],
    body: '选择你希望被记住的媒体形象。每一种形象，都需要你先把对应的故事走完。',
    requires: function() {
      var node = getBranchNode('media');
      return node === 'crisis_apology' || node === 'crisis_explain' || node === 'crisis_delete' || node === 'crisis_strong';
    },
    choices: [
      { label: '谦逊团队型', hint: '媒体好感与队友信任提升', lockHint: '需要更衣室和队友已经真正认你', requires: function() {
        var tp = getBranchNode('team_practice');
        var tb = getBranchNode('teammate_bond');
        return tp === 'practice_identity' || (tb && tb !== 'start');
      }, bonus: function() {
        addProfileDelta('lockerRoomTrust', 1);
        return { text: '球队线/队友线已经成型，更衣室更认你这套说法。' };
      }, apply: function() {
        setBranchNode('media', 'persona_humble', { persona: 'humble' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('lockerRoomTrust', 1);
        return '你每次采访都先提队友。记者开始觉得你“无趣”，但更衣室里的人知道，你是把话留给他们的人。<br><br>效果：媒体好感+2；更衣室信任+1。';
      }},
      { label: '狂人巨星型', hint: '人气和争议上升', lockHint: '需要你已经在关键时刻留下名字', requires: function() {
        var t = getBranchState('training');
        return getBranchNode('training') === 'training_identity' && t.identity === 'closer';
      }, bonus: function() {
        addProfileDelta('fame', 1);
        return { text: '关键战解决者的名号让狂言更有底气。' };
      }, apply: function() {
        setBranchNode('media', 'persona_arrogant', { persona: 'arrogant' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 1);
        return '你说：我就是最好的，不接受讨论。喜欢你的人更狂热，讨厌你的人更有动力。<br><br>效果：人气+2；争议+1。';
      }},
      { label: '沉默杀手型', hint: '稳定性提升，媒体关注下降', lockHint: '需要你已经在训练中打磨出全面打法', requires: function() {
        var t = getBranchState('training');
        return getBranchNode('training') === 'training_identity' && t.identity === 'balanced_player';
      }, bonus: function() {
        addSeasonMod('formVariance', -1, -10, 10);
        return { text: '全面打法让沉默更有说服力，状态更稳。' };
      }, apply: function() {
        setBranchNode('media', 'persona_silent', { persona: 'silent' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你几乎不开口，只用表现说话。记者抱怨采访不到你，但你的比赛集锦越传越广。<br><br>效果：状态波动-1。';
      }},
      { label: '商业偶像型', hint: '商业价值上升，媒体压力上升', lockHint: '需要人脉或中国市场结果', requires: function() {
        return getBranchNode('network') === 'business_circle' || getBranchNode('china_market') === 'shoe_settled';
      }, bonus: function() {
        addProfileDelta('businessValue', 1);
        return { text: '商业圈层/球鞋线已经铺好，偶像人设直接变现。' };
      }, apply: function() {
        setBranchNode('media', 'persona_business', { persona: 'business' });
        addProfileDelta('businessValue', 3);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '你开始出现在广告牌、综艺和商业活动里。镜头喜欢你，但每个镜头后面都有一份合同在提醒你微笑。<br><br>效果：商业价值+3；媒体压力+1。';
      }},
      { label: '国家队英雄型', hint: '中国球迷支持与历史评价上升', lockHint: '需要你在国家队扛过核心位置', requires: function() {
        var cn = getBranchNode('china_team');
        return ['national_core','team_core','managed_core','national_flag','team_revival','injured_hero','national_legend','national_mentor','honorable_exit'].indexOf(cn) >= 0;
      }, bonus: function() {
        addProfileDelta('chinaPopularity', 1);
        addProfileDelta('legacyBonus', 1);
        return { text: '国家队核心身份加持，中国球迷更认这套人设。' };
      }, apply: function() {
        setBranchNode('media', 'persona_national', { persona: 'national' });
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('legacyBonus', 1);
        return '你把国家队和国家荣誉放进每一次发言。中国球迷把你当成自己人，媒体也开始用“中国篮球的骄傲”称呼你。<br><br>效果：中国人气+3；历史评价+1。';
      }},
      { label: '争议天才型', hint: '人气与争议双高', lockHint: '需要高争议值或情感伤害结果', requires: function() {
        var contra = (STATE.career.profile && STATE.career.profile.controversy) || 0;
        var rl = getBranchNode('relationship');
        return contra >= 3 || rl === 'hurt_scar' || rl === 'hurt_guard' || rl === 'hurt_moved_on' || !!getBranchState('media').confront;
      }, bonus: function() {
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return { text: '此前的争议与交锋给“天才”人设添了火。' };
      }, apply: function() {
        setBranchNode('media', 'persona_controversial', { persona: 'controversial' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 3);
        addProfileDelta('legacyBonus', 1);
        return '你承认自己不好惹，也不打算讨好任何人。媒体恨你，但离不开你；球迷也一样。<br><br>效果：人气+2；争议+3；历史评价+1。';
      }},
      { label: '自由发声', hint: '不固定人设，按本心说话', apply: function() {
        setBranchNode('media', 'persona_independent', { persona: 'independent' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有固定人设，每句话都按当时的心情来。媒体觉得你难以预测，但球迷喜欢这种真实。<br><br>效果：媒体好感+1；状态波动-1。';
      }}
    ]
  },
  {
    id: 'fan_culture_heat',
    branch: 'fan_culture', phase: 'season', slot: 'main', weight: 11,
    title: '球迷文化：社区的第一张热度帖',
    scenes: [
      '比赛结束两小时，球迷社区已经开楼。你的名字挂在标题里，点灭数和点亮数同时疯涨。',
      '有人说你是“球迷”，也有人把你和十年前那位传奇放在一起比。你第一次发现，球迷社区比发布会更早给你定性。'
    ],
    body: '第一张热度帖会定义你在社区的起点，也会决定社区以后怎么称呼你。',
    requires: function() {
      var media = getBranchNode('media');
      return getBranchNode('fan_culture') === 'start'
        && (media === 'press_accountable' || media === 'press_team' || media === 'press_silent' || media === 'press_confront'
        || media === 'crisis_apology' || media === 'crisis_explain' || media === 'crisis_delete' || media === 'crisis_strong'
        || ['persona_humble','persona_arrogant','persona_silent','persona_business','persona_national','persona_controversial','persona_independent'].indexOf(media) >= 0);
    },
    choices: [
      { label: '晒数据回应', hint: '技术流好评，数据党认可', apply: function() {
        setBranchNode('fan_culture', 'fan_heat', { tone: 'stats' });
        addProfileDelta('fanSupport', 2);
        return '你把效率值、正负值和关键球录像贴上去。热评第一变成：这数据没得黑。<br><br>效果：球迷支持+2。';
      }},
      { label: '发段子自嘲', hint: '亲和力上升，黑粉变乐子', apply: function() {
        setBranchNode('fan_culture', 'fan_heat', { tone: 'meme' });
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', -1);
        return '你转发了那张表情包，配文：我打的，认了。评论区从对骂变成整活。<br><br>效果：人气+1；争议-1。';
      }},
      { label: '正面回应黑粉', hint: '热度爆炸，立场鲜明', apply: function() {
        setBranchNode('fan_culture', 'fan_heat', { tone: 'fight' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 2);
        return '你引用黑粉的原话，一条条回怼。帖子被转到所有分区，支持者和黑粉都更兴奋了。<br><br>效果：人气+2；争议+2。';
      }},
      { label: '不回应', hint: '热度自然消退，专注比赛', apply: function() {
        setBranchNode('fan_culture', 'fan_lowkey', { tone: 'lowkey' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '你没有登录账号。帖子慢慢沉下去，但有人记住了：那个被黑的人一句话没说。<br><br>效果：状态波动-1；球迷支持+1。';
      }}
    ]
  },
  {
    id: 'fan_culture_score',
    branch: 'fan_culture', phase: 'season', slot: 'main', weight: 12,
    title: '球迷文化：社区评分事件',
    scenes: [
      '赛后评分上线，你头像下的数字跳个不停。这一晚你打得很满：关键球有，失误也有。',
      '热评第一写着“这分不真实”，第二写着“反向评分走起”，第三已经开始吵你的防守。'
    ],
    body: '评分只是一个数字，但球迷社区会用一整晚讨论它。你要给这串数字一个什么样的结尾？',
    requires: function() {
      var node = getBranchNode('fan_culture');
      return node === 'fan_heat' || node === 'fan_lowkey';
    },
    choices: [
      { label: '把评分当成镜子', hint: '关掉手机，把这一晚变成训练素材', apply: function() {
        setBranchNode('fan_culture', 'score_mirror', { score: 'mirror' });
        addSeasonMod('formVariance', -2, -10, 10);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你关掉手机，回训练馆把录像从头看到尾。评分不会变，但你决定下一场不一样。<br><br>效果：状态波动-2；伤病风险-1。';
      }},
      { label: '回热评自嘲', hint: '用幽默接住争议', apply: function() {
        setBranchNode('fan_culture', 'score_meme', { score: 'meme' });
        addProfileDelta('fame', 1);
        addProfileDelta('mediaTrust', 1);
        return '你在评论区回了一条：这分我先投了，下一场还。评论区从对骂变成整活。<br><br>效果：人气+1；媒体好感+1。';
      }},
      { label: '主动列出自己的失误', hint: '自己开楼，把问题摊开', apply: function() {
        setBranchNode('fan_culture', 'score_own', { score: 'own' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('fanSupport', 1);
        return '你自己开了一楼，把今晚的失误一条条列出来。有人说你太认真，也有人说这才是真实。<br><br>效果：媒体好感+2；球迷支持+1。';
      }},
      { label: '让团队控评', hint: '版面干净，但真实感下降', apply: function() {
        setBranchNode('fan_culture', 'score_report', { score: 'report' });
        addProfileDelta('controversy', -1);
        addProfileDelta('mediaTrust', -1);
        return '你让团队处理掉那些带节奏的帖子。版面干净了，但有人说你玩不起。<br><br>效果：争议-1；媒体好感-1。';
      }}
    ]
  },
  {
    id: 'fan_culture_community',
    branch: 'fan_culture', phase: 'season', slot: 'main', weight: 11,
    title: '球迷文化：社区互动',
    scenes: [
      '社区给你开了官方认证，邀请你空降。你发现账号有 20 万关注，但一条都没发过。',
      '编辑问你：要不要先从回一条热评开始？'
    ],
    body: '从“被谈论”到“亲自下场”，是球迷文化线最关键的转折。',
    requires: function() {
      var node = getBranchNode('fan_culture');
      return node === 'score_mirror' || node === 'score_meme' || node === 'score_own' || node === 'score_report';
    },
    choices: [
      { label: '亲自回帖', hint: '真实感上升，风评变活', apply: function() {
        setBranchNode('fan_culture', 'community_reply', { action: 'reply' });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('mediaTrust', 1);
        return '你挑了几条热评逐条回复，包括一条骂你的。骂你的那条被你回复后，楼主反而成了你粉丝。<br><br>效果：球迷支持+3；媒体好感+1。';
      }},
      { label: '空降直播', hint: '互动最高，风险也高', apply: function() {
        setBranchNode('fan_culture', 'community_live', { action: 'live' });
        addProfileDelta('fame', 3);
        addProfileDelta('controversy', 1);
        return '你在直播间聊了一个小时，从训练聊到夜宵。弹幕从“黑”变“真性情”只用了十分钟。<br><br>效果：人气+3；争议+1。';
      }},
      { label: '举报黑帖', hint: '保护自己，维护版面', apply: function() {
        setBranchNode('fan_culture', 'community_report', { action: 'report' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你让团队举报了一批带节奏的帖子。版面干净了，但也有人阴阳你“玩不起”。<br><br>效果：媒体好感+1；争议-1。';
      }},
      { label: '潜水围观', hint: '保持神秘，热度可控', apply: function() {
        setBranchNode('fan_culture', 'community_lurk', { action: 'lurk' });
        addProfileDelta('fanSupport', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你注册了账号，但只点赞不发言。老粉发现后开始找你点过赞的帖子。<br><br>效果：球迷支持+1；状态波动-1。';
      }}
    ]
  },
  {
    id: 'fan_culture_persona',
    branch: 'fan_culture', phase: 'season', slot: 'main', weight: 10,
    title: '球迷文化：球迷人设成型',
    scenes: [
      '半年后，球迷社区已经不再用你的比赛评价你，而是用“你这个人”评价你。有人做了你的梗图合集，标题是：他可能不是最强的，但一定是最会整活的。'
    ],
    body: '选择你希望被球迷社区记住的身份。点亮和点灭，最后都会变成你的一部分。',
    requires: function() {
      var node = getBranchNode('fan_culture');
      return node === 'community_reply' || node === 'community_live' || node === 'community_report' || node === 'community_lurk';
    },
    choices: [
      { label: '社区顶流', hint: '人气最高，节奏也最多', lockHint: '需要媒体已经把你塑造成偶像或争议人物', requires: function() {
        var m = getBranchNode('media');
        return m === 'persona_business' || m === 'persona_controversial';
      }, bonus: function() {
        addProfileDelta('fame', 1);
        return { text: '媒体的炒作底子，让顶流热度更高。' };
      }, apply: function() {
        setBranchNode('fan_culture', 'fan_top', { persona: 'fan_top' });
        STATE.career.flags.fanCulturePersona = 'fan_top';
        addProfileDelta('fame', 4);
        addProfileDelta('controversy', 2);
        return '你的每条动态都能上首页。黑你的人越来越多，但点亮数永远压过点灭。<br><br>效果：人气+4；争议+2。';
      }},
      { label: '球迷领袖', hint: '球迷支持最高，历史评价上升', lockHint: '需要媒体已经用谦逊或国家荣誉形容过你', requires: function() {
        var m = getBranchNode('media');
        return m === 'persona_humble' || m === 'persona_national';
      }, bonus: function() {
        addProfileDelta('fanSupport', 1);
        return { text: '谦逊或国家荣誉的形象，让球迷更认你。' };
      }, apply: function() {
        setBranchNode('fan_culture', 'fan_leader', { persona: 'fan_leader' });
        STATE.career.flags.fanCulturePersona = 'fan_leader';
        addProfileDelta('fanSupport', 4);
        addProfileDelta('legacyBonus', 1);
        return '你的评论区成了理性讨论区。新球迷来了第一句都是：这里居然能好好说话。<br><br>效果：球迷支持+4；历史评价+1。';
      }},
      { label: '低调球迷', hint: '稳定，无黑点', lockHint: '需要媒体已经记住你的沉默', requires: function() {
        return getBranchNode('media') === 'persona_silent';
      }, bonus: function() {
        addProfileDelta('mediaTrust', 1);
        return { text: '沉默的形象，让低调更有分量。' };
      }, apply: function() {
        setBranchNode('fan_culture', 'fan_lowjr', { persona: 'fan_lowjr' });
        STATE.career.flags.fanCulturePersona = 'fan_lowjr';
        addProfileDelta('mediaTrust', 2);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你很少发言，但每条都很真诚。球迷社区给你的标签是：被黑得最多，却从不黑别人。<br><br>效果：媒体好感+2；状态波动-1。';
      }},
      { label: '争议区常客', hint: '流量稳定，争议稳定', lockHint: '需要媒体已经被你的争议话题围绕', requires: function() {
        return getBranchNode('media') === 'persona_controversial' || !!getBranchState('media').confront;
      }, bonus: function() {
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return { text: '媒体的争议底子，让节奏停不下来。' };
      }, apply: function() {
        setBranchNode('fan_culture', 'fan_controversial', { persona: 'fan_controversial' });
        STATE.career.flags.fanCulturePersona = 'fan_controversial';
        addProfileDelta('fame', 3);
        addProfileDelta('controversy', 3);
        return '你的名字和“开会”“整活”绑定。无论输赢，球迷社区都有你的版面。<br><br>效果：人气+3；争议+3。';
      }},
      { label: '普通球迷', hint: '不经营人设，做自己', apply: function() {
        setBranchNode('fan_culture', 'fan_normal', { persona: 'fan_normal' });
        STATE.career.flags.fanCulturePersona = 'fan_normal';
        addProfileDelta('fanSupport', 1);
        addProfileDelta('mediaTrust', 1);
        return '你没有刻意经营人设，只是偶尔上线看看大家怎么讨论你。没有顶流的架子，也没有黑粉的烦恼，球迷社区记住的是那个愿意说真话的普通人。<br><br>效果：球迷支持+1；媒体好感+1。';
      }}
    ]
  },
  {
    id: 'mental_low',
    branch: 'mental_health', phase: 'season', slot: 'main', weight: 12,
    title: '心理健康：心理低谷',
    scenes: [
      '那段时间你照常训练、照常比赛，但一切都不对劲。赢球没有快感，输球没有愤怒，连更衣室的玩笑都让你觉得累。',
      '凌晨两点，你盯着天花板，第一次不知道自己到底在为什么打球。'
    ],
    body: '低谷不是软弱，是身体和心在提醒你停下来听一听。',
    requires: function() { return getBranchNode('mental_health') === 'start' && getMentalPressure() >= 8; },
    choices: [
      { label: '找心理医生', hint: '最专业的路径，恢复最稳', apply: function() {
        setBranchNode('mental_health', 'mh_pro', { help: 'pro' });
        addSeasonMod('formVariance', -2, -10, 10);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你约了球队推荐的心理医生。前两次你几乎不说话，第三次你开始讲童年、压力和那些“必须赢”的夜晚。她没有评价，只是听。<br><br>效果：状态波动-2；伤病风险-1。';
      }},
      { label: '找家人倾诉', hint: '最温暖的路径，关系更深', apply: function() {
        setBranchNode('mental_health', 'mh_family', { help: 'family' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '你给家里打了电话。妈妈听你说完，只说了一句：累了就回来吃饭，别自己扛。那天晚上你睡得很沉。<br><br>效果：状态波动-1；球迷支持+1；你和家人更近了一点。';
      }},
      { label: '用训练消化', hint: '保持节奏，把情绪留在球馆', apply: function() {
        setBranchNode('mental_health', 'mh_training', { help: 'training' });
        addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你把自己泡在训练馆里，练到筋疲力尽。身体累了，心反而安静了一点。训练师没有劝你休息，只在你投完最后一球时递了一瓶水。<br><br>效果：运动+1。';
      }},
      { label: '硬扛', hint: '表面没事，风险累积', apply: function() {
        setBranchNode('mental_health', 'mh_tough', { help: 'tough' });
        addSeasonMod('formVariance', -1, -10, 10);
        addSeasonMod('injuryRiskBonus', 2, -4, 8);
        return '你告诉所有人没事。笑容、训练、采访，一样都没落下。但你知道，有些东西没有消失，只是在排队。<br><br>效果：短期状态波动-1；长期伤病风险+2。';
      }}
    ]
  },
  {
    id: 'mental_recovery',
    branch: 'mental_health', phase: 'season', slot: 'main', weight: 11,
    title: '心理健康：心理恢复期',
    scenes: [
      '你开始每天固定做一件事：散步、写日记、和家人视频、或者只是睡前关掉手机。变化很小，但你重新能听清自己的呼吸。'
    ],
    body: '恢复不是突然变好，是每天多一点。',
    requires: function() {
      var node = getBranchNode('mental_health');
      return node === 'mh_pro' || node === 'mh_family' || node === 'mh_training' || node === 'mh_tough';
    },
    choices: [
      { label: '建立恢复习惯', hint: '最稳定，形成长期韧性', apply: function() {
        setBranchNode('mental_health', 'mh_resilient', { resolve: 'resilient' });
        STATE.career.flags.mentalResilient = true;
        addSeasonMod('formVariance', -2, -10, 10);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把心理恢复写进训练表，像练力量一样认真。队医说：你的恢复指标回来了，你的眼神也回来了。<br><br>效果：状态波动-2；伤病风险-1；获得“心理韧性”标签。';
      }},
      { label: '公开分享经历', hint: '影响最大，也最勇敢', apply: function() {
        setBranchNode('mental_health', 'mh_open', { resolve: 'open' });
        STATE.career.flags.mentalOpen = true;
        addProfileDelta('mediaTrust', 3);
        addProfileDelta('fanSupport', 3);
        addProfileDelta('controversy', -1);
        return '你在采访里说自己也经历过低谷。新闻稿当天刷屏，很多球迷留言说：谢谢你承认这些。<br><br>效果：媒体好感+3；球迷支持+3；争议-1。';
      }},
      { label: '保持低调恢复', hint: '安静修复，不被聚光灯打扰', apply: function() {
        setBranchNode('mental_health', 'mh_quiet', { resolve: 'quiet' });
        STATE.career.flags.mentalQuiet = true;
        addSeasonMod('formVariance', -1, -10, 10);
        addSeasonMod('mediaPressure', -1, -10, 10);
        return '你没有公开任何东西，只是让身边几个人知道。几个月后，状态悄悄回到正轨。<br><br>效果：状态波动-1；媒体关注下降。';
      }}
    ]
  },
  {
    id: 'mental_resolve',
    branch: 'mental_health', phase: 'season', slot: 'main', weight: 10,
    title: '心理健康：心理收束',
    scenes: [
      '一年后回头看，那段低谷没有毁掉你。它变成了一根你随时可以抓回来的绳子：你知道自己扛过更难的，也知道了该在什么时候向谁求助。'
    ],
    body: '选择你希望这段经历留下的形状。',
    requires: function() {
      var node = getBranchNode('mental_health');
      return node === 'mh_resilient' || node === 'mh_open' || node === 'mh_quiet';
    },
    choices: [
      { label: '成为更完整的领袖', hint: '更衣室信任提升', lockHint: '需要更衣室已经认你是领袖', requires: function() {
        return getBranchNode('team_practice') === 'practice_identity';
      }, bonus: function() {
        addProfileDelta('lockerRoomTrust', 1);
        return { text: '球队线队魂身份加持，低谷经历成了更衣室的语言。' };
      }, apply: function() {
        setBranchNode('mental_health', 'mental_leader', { final: 'leader' });
        STATE.career.flags.mentalLeader = true;
        addProfileDelta('lockerRoomTrust', 3);
        return '年轻球员状态差时，你没有催他，而是说了句：我也经历过。那晚之后，他敢在你面前说真话了。<br><br>效果：更衣室信任+3。';
      }},
      { label: '把经历讲给更多人', hint: '媒体与球迷认可', lockHint: '需要媒体或球迷已经记住你', requires: function() {
        var md = getBranchNode('media');
        var fc = getBranchNode('fan_culture');
        return ['persona_humble','persona_arrogant','persona_silent','persona_business','persona_national','persona_controversial'].indexOf(md) >= 0
          || fc === 'fan_top' || fc === 'fan_leader' || fc === 'fan_lowjr' || fc === 'fan_controversial';
      }, bonus: function() {
        addProfileDelta('mediaTrust', 1);
        return { text: '媒体/球迷人设让公开分享的声量更大。' };
      }, apply: function() {
        setBranchNode('mental_health', 'mental_advocate', { final: 'advocate' });
        STATE.career.flags.mentalAdvocate = true;
        addProfileDelta('mediaTrust', 3);
        addProfileDelta('fanSupport', 2);
        return '你开始支持心理健康公益，把经历变成别人的支撑。<br><br>效果：媒体好感+3；球迷支持+2。';
      }},
      { label: '安静地把它留在身后', hint: '稳定，不消费苦难', lockHint: '媒体线沉默杀手/球迷线低调球迷可强化', requires: function() {
        return true;
      }, bonus: function() {
        var md = getBranchNode('media');
        var fc = getBranchNode('fan_culture');
        if (md === 'persona_silent' || fc === 'fan_lowjr') {
          addSeasonMod('formVariance', -1, -10, 10);
          return { text: '沉默杀手/低调球迷人设加成，安静收束更有分量。' };
        }
        return { text: '你选择把低谷留在身后。' };
      }, apply: function() {
        setBranchNode('mental_health', 'mental_quiet_resolve', { final: 'quiet' });
        STATE.career.flags.mentalQuietResolve = true;
        addSeasonMod('formVariance', -2, -10, 10);
        addProfileDelta('legacyBonus', 1);
        return '你没有把低谷变成故事，只是把它留在了那年夏天。你继续打球，偶尔想起，心里没有重量。<br><br>效果：状态波动-2；历史评价+1。';
      }}
    ]
  },
  {
    id: 'city_first_impression',
    branch: 'city_culture', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '城市文化：来到这座城市',
    scenes: [
      '赛季开始前，你第一次认真看这座城市。它没有在等你，也不会因为你到来就改变自己。',
      '但你慢慢发现，城市和球员一样：你需要先向它自我介绍。'
    ],
    body: '你选择怎么和这座城市相处，决定了它以后怎么向别人介绍你。',
    requires: function() {
      var played = (STATE.career.totalStats && STATE.career.totalStats.games > 0) || (STATE.season && STATE.season.playerStats && STATE.season.playerStats.games > 0);
      var honored = hasCareerHonor('全明星') || hasCareerHonor('MVP') || hasCareerHonor('总冠军');
      return getBranchNode('city_culture') === 'start' && !isCityTransfer() && (played || honored);
    },
    choices: [
      { label: '融入城市生活', hint: '去街头、去球馆、去认识这座城', apply: function() {
        var city = getBranchState('city_culture');
        city.team = STATE.careerTeam;
        setBranchNode('city_culture', 'city_open', { team: STATE.careerTeam });
        addProfileDelta('fanSupport', 2);
        return '你开始混进城市里的野球场，去本地餐馆吃饭，听本地人怎么称呼这座城。慢慢地，有人开始喊你“咱们队的”。<br><br>效果：球迷支持+2。';
      }},
      { label: '专注篮球，暂不融入', hint: '先证明自己，再谈归属', apply: function() {
        var city = getBranchState('city_culture');
        city.team = STATE.careerTeam;
        setBranchNode('city_culture', 'city_distant', { team: STATE.careerTeam });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你告诉自己：打好球就是最好的融入。城市暂时还只是一个客场和主场之间的地名。<br><br>效果：状态波动-1；媒体关注下降。';
      }},
      { label: '主动做社区活动', hint: '用行动先给城市一点东西', apply: function() {
        var city = getBranchState('city_culture');
        city.team = STATE.careerTeam;
        setBranchNode('city_culture', 'city_community', { team: STATE.careerTeam });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你去了社区中心、小学球馆和一家公益机构。没有镜头，但很多家庭记住了你的名字。<br><br>效果：球迷支持+3；历史评价+1。';
      }}
    ]
  },
  {
    id: 'city_signature',
    branch: 'city_culture', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '城市文化：城市印记',
    scenes: [
      '你在这座城市打了两年，开始认得几条街道的名字，也开始有人在你输球时仍然站在场边。',
      '你意识到，归属感不是城市给你的，是你自己刻出来的。'
    ],
    body: '选择你留给这座城市的第一个印记。',
    requires: function() {
      var node = getBranchNode('city_culture');
      return (node === 'city_open' || node === 'city_distant' || node === 'city_community') && !isCityTransfer();
    },
    choices: [
      { label: '带球队去城市地标', hint: '球队与城市绑定，热度高', apply: function() {
        setBranchNode('city_culture', 'city_landmark', { mark: 'landmark' });
        addProfileDelta('fame', 2);
        addProfileDelta('fanSupport', 2);
        return '你把一次全队训练搬到城市地标前。球迷围了好几层，照片传遍全网。<br><br>效果：人气+2；球迷支持+2。';
      }},
      { label: '资助社区球馆', hint: '最扎实的印记，长期影响', apply: function() {
        setBranchNode('city_culture', 'city_ballcourt', { mark: 'ballcourt' });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你匿名资助了那座社区球馆。孩子们只知道有人翻新了地板，后来有人告诉他们：是你。<br><br>效果：球迷支持+3；历史评价+1。';
      }},
      { label: '把家人接来', hint: '让城市成为家', lockHint: '需要家人之间已经谈过未来', requires: function() {
        var fm = getBranchNode('family');
        return fm === 'family_plan' || fm === 'family_settled';
      }, bonus: function() {
        addProfileDelta('fanSupport', 1);
        return { text: '家庭线已经稳定，安家更顺理成章。' };
      }, apply: function() {
        setBranchNode('city_culture', 'city_family', { mark: 'family' });
        addSeasonMod('formVariance', -2, -10, 10);
        return '你把家人接到这座城市，孩子在这里上学，父母在这里散步。你终于不再把“回家”说成另一个地方。<br><br>效果：状态波动-2；家人更懂你，也更愿意站在你这边。';
      }},
      { label: '保持低调', hint: '用比赛说话，不刻意经营', apply: function() {
        setBranchNode('city_culture', 'city_quiet', { mark: 'quiet' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有做任何城市营销，只是每个休赛期都回来训练。本地人习惯了在球馆门口遇见你。<br><br>效果：媒体好感+1；状态波动-1。';
      }}
    ]
  },
  {
    id: 'city_bond',
    branch: 'city_culture', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '城市文化：城市羁绊',
    scenes: [
      '自由市场来了又走，你还在名单上。总经理问你：有没有想过这座城市对你意味着什么？',
      '你第一次没有用“职业”回答这个问题。'
    ],
    body: '羁绊不是合同，是你和城市之间互相记住的部分。',
    requires: function() {
      var node = getBranchNode('city_culture');
      return (node === 'city_landmark' || node === 'city_ballcourt' || node === 'city_family' || node === 'city_quiet') && !isCityTransfer();
    },
    choices: [
      { label: '承诺留队', hint: '忠诚评价最高，冠军不确定', lockHint: '需要你先在自由市场做出留守的决定', requires: function() {
        return !!(STATE.career.flags && STATE.career.flags.freeAgentChoice === 'stay');
      }, bonus: function() {
        addProfileDelta('fanSupport', 1);
        return { text: '自由市场前夜你已选择留守，承诺更有分量。' };
      }, apply: function() {
        setBranchNode('city_culture', 'city_loyal', { bond: 'loyal' });
        STATE.career.flags.cityLoyal = true;
        addProfileDelta('fanSupport', 4);
        addProfileDelta('legacyBonus', 2);
        return '你公开说：我想在这里退役。新闻出来的那晚，球馆外墙投影了你的号码。<br><br>效果：球迷支持+4；历史评价+2；flag cityLoyal = true。';
      }},
      { label: '把号码留给城市', hint: '城市符号，退役球衣加分', apply: function() {
        setBranchNode('city_culture', 'city_icon', { bond: 'icon' });
        STATE.career.flags.cityIcon = true;
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你说：如果有一天我离开，这个号码就留给这座城。从此“XX号”不再只是你的号码。<br><br>效果：球迷支持+3；历史评价+1；flag cityIcon = true。';
      }},
      { label: '开设青训基地', hint: '城市与下一代绑定', apply: function() {
        setBranchNode('city_culture', 'city_academy', { bond: 'academy' });
        STATE.career.flags.cityAcademy = true;
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你在城市里开了青训基地，第一批学员里有不少本地孩子。你开始教他们第一步，也教他们怎么喜欢上篮球。<br><br>效果：球迷支持+3；历史评价+1；flag cityAcademy = true。';
      }},
      { label: '城市巡游活动', hint: '热度最高，商业联动', apply: function() {
        setBranchNode('city_culture', 'city_parade', { bond: 'parade' });
        STATE.career.flags.cityParade = true;
        addProfileDelta('fame', 4);
        addProfileDelta('businessValue', 2);
        return '你在夺冠后包下整条街区办巡游。全城都是你的海报，连对手球迷都承认：这座城市爱他。<br><br>效果：人气+4；商业价值+2；flag cityParade = true。';
      }}
    ]
  },
  {
    id: 'city_farewell',
    branch: 'city_culture', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '城市文化：告别这座城市',
    scenes: [
      '转会基本敲定那天，你开车路过自己常去的那家球馆。城市没有责怪你，但你知道，有些告别应该由你来说。'
    ],
    body: '转会不是城市的背叛，但离开的方式会决定这座城市以后怎么提到你。',
    requires: function() { return isCityTransfer(); },
    choices: [
      { label: '体面告别', hint: '保留城市记忆，新城市重新开始', apply: function() {
        setBranchNode('city_culture', 'start', { team: STATE.careerTeam, farewell: 'grace' });
        addProfileDelta('fanSupport', 1);
        addProfileDelta('legacyBonus', 1);
        return '你发了一封给球迷的信：感谢这座城市把三年变成家。球迷在评论区刷屏：常回来看看。<br><br>效果：球迷支持+1；历史评价+1；新城市重新开始。';
      }},
      { label: '承诺未来回归', hint: '给未来留一扇门，城市会记得你', apply: function() {
        setBranchNode('city_culture', 'start', { team: STATE.careerTeam, farewell: 'promise' });
        STATE.career.flags.cityFutureReturn = true;
        addProfileDelta('fanSupport', 2);
        return '你答应合同到期后优先考虑回归。城市没有留你，但把你的号码挂在了心里。<br><br>效果：球迷支持+2；flag cityFutureReturn = true；新城市重新开始。';
      }},
      { label: '冷漠离开', hint: '快进快出，城市评价受损', apply: function() {
        setBranchNode('city_culture', 'start', { team: STATE.careerTeam, farewell: 'cold' });
        addProfileDelta('fanSupport', -2);
        addProfileDelta('controversy', 1);
        return '你没有公开发声，直接收拾行李走人。新闻发布会上，本地记者的问题比往常尖锐。<br><br>效果：球迷支持-2；争议+1；新城市重新开始。';
      }}
    ]
  },
  {
    id: 'child_pregnancy',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '家人孩子：怀孕确认',
    scenes: [
      '她告诉你怀孕那天，你在酒店房间愣了很久。职业球员最怕失控，但那一刻，你忽然觉得有一个更值得失控的未来在等你。'
    ],
    body: '你选择怎么迎接这个即将到来的变化？',
    requires: function() {
      return getBranchNode('family_children') === 'start' && (getBranchNode('relationship') === 'partnership' || getBranchNode('family') === 'family_settled');
    },
    choices: [
      { label: '一起规划', hint: '家人之间会更近', apply: function() {
        setBranchNode('family_children', 'pregnancy', { plan: 'together' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你们把下赛季的赛程摊在桌上，认真圈出几个日子。她笑你比画战术还认真。<br><br>效果：状态波动-1；你们之间，又多了一份默契。';
      }},
      { label: '全程陪伴', hint: '球迷支持上升，伤病风险下降', apply: function() {
        setBranchNode('family_children', 'pregnancy', { plan: 'present' });
        addProfileDelta('fanSupport', 1);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你告诉团队：那几天不要给我排任何行程。教练第一次看到你主动请假，愣了一下，然后点头。<br><br>效果：球迷支持+1；伤病风险-1。';
      }},
      { label: '事业照旧', hint: '短期专注，但关系压力上升', apply: function() {
        setBranchNode('family_children', 'pregnancy', { plan: 'career' });
        addProfileDelta('controversy', 1);
        return '你告诉自己赛季不能停。她没有说什么，只是把检查单收进了抽屉。<br><br>效果：争议+1；家庭压力上升。';
      }}
    ]
  },
  {
    id: 'child_birth',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '家人孩子：孩子出生',
    scenes: ['产房门口，你听见第一声啼哭时，训练馆、客场、合同全部退成背景。那声哭比任何哨声都响。'],
    body: '那一刻已经过去，但你怎么记住它，会写进孩子后来的人生。',
    requires: function() { return getBranchNode('family_children') === 'pregnancy'; },
    choices: [
      { label: '全程在场', hint: '孩子亲密度最高', apply: function() {
        setBranchNode('family_children', 'birth_present', { birth: 'present' });
        STATE.career.flags.childBirthPresent = true;
        addProfileDelta('fanSupport', 1);
        return '你在产房陪了全程。孩子被放进你怀里时，你发现自己的手在发抖。<br><br>效果：flag childBirthPresent = true；球迷支持+1。';
      }},
      { label: '赛程冲突缺席', hint: '留下遗憾与争议', apply: function() {
        setBranchNode('family_children', 'birth_absent', { birth: 'absent' });
        STATE.career.flags.childBirthAbsent = true;
        addProfileDelta('controversy', 1);
        return '那场比赛你打了，却记不清任何细节。视频通话里，她声音很轻：孩子像你。<br><br>效果：flag childBirthAbsent = true；争议+1。';
      }},
      { label: '两边都要', hint: '平衡但有损耗', apply: function() {
        setBranchNode('family_children', 'birth_balanced', { birth: 'balanced' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你赶上了出生，也赶上了飞机。累得在更衣室睡着时，手机里是她发来的照片。<br><br>效果：状态波动-1。';
      }}
    ]
  },
  {
    id: 'child_care',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '家人孩子：育儿分工',
    scenes: ['凌晨三点，孩子哭醒。你抱着他在客厅走了四十分钟，第一次觉得“累”可以有完全不同的意思。'],
    body: '照顾孩子的方式，会影响你接下来的精力和家庭温度。',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'birth_present' || n === 'birth_absent' || n === 'birth_balanced';
    },
    choices: [
      { label: '自己带', hint: '孩子亲密度高，消耗也大', apply: function() {
        setBranchNode('family_children', 'care_solo', { care: 'solo' });
        addSeasonMod('formVariance', 1, -10, 10);
        return '你学会换尿布、哄睡、冲奶粉。深夜的训练变成深夜的客厅散步，但你舍不得换人。<br><br>效果：状态波动+1；孩子亲密度高。';
      }},
      { label: '家人帮忙', hint: '状态更稳', apply: function() {
        setBranchNode('family_children', 'care_shared', { care: 'shared' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你爸妈搬来住了一个月。孩子被哄睡时，你坐在沙发上，忽然觉得家是这个样子。<br><br>效果：状态波动-1。';
      }},
      { label: '专业团队', hint: '训练时间更稳', apply: function() {
        setBranchNode('family_children', 'care_help', { care: 'help' });
        addAttrDelta('ATH', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '你请了育儿师，也请了夜班阿姨。训练没落下，但你偶尔会想：他第一次笑的时候，是谁先看见的。<br><br>效果：运动+1。';
      }}
    ]
  },
  {
    id: 'child_conflict',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '家人孩子：事业与孩子',
    scenes: ['连续第七个客场，视频通话里他开始躲镜头。你忽然意识到，他在长大，而你一直在错过。'],
    body: '这是家人孩子线的关键分叉，选择会决定你们离得多远，或靠得多近。',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'care_solo' || n === 'care_shared' || n === 'care_help';
    },
    choices: [
      { label: '调整赛程', hint: '家庭优先', apply: function() {
        setBranchNode('family_children', 'rebalance', { conflict: 'family' });
        STATE.career.flags.familyFirst = true;
        addProfileDelta('fanSupport', 1);
        return '你第一次主动和教练谈轮休，把客场安排压缩到最低。回来那晚，孩子已经会爬了。<br><br>效果：flag familyFirst = true；球迷支持+1。';
      }},
      { label: '让家人多承担', hint: '状态稳定', apply: function() {
        setBranchNode('family_children', 'rebalance', { conflict: 'share' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你把更多陪伴交给家人，自己用视频参与。不是最好的答案，但你们都在努力。<br><br>效果：状态波动-1。';
      }},
      { label: '硬扛', hint: '短期专注，压力累积', apply: function() {
        setBranchNode('family_children', 'conflict_strain', { conflict: 'strain' });
        STATE.career.flags.careerFirst = true;
        addSeasonMod('formVariance', 2, -10, 10);
        return '你告诉自己：先把这个赛季打完。电话越来越少，你越来越不敢问他想不想你。<br><br>效果：状态波动+2；心理健康加压。';
      }}
    ]
  },
  {
    id: 'child_growth',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '家人孩子：孩子成长',
    scenes: ['他会拍球了，也会在你输球时把玩具球递给你。你第一次发现，孩子才是那个一直在教你重新开始的人。'],
    body: '你希望他的童年长成什么样子？',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'rebalance' || n === 'conflict_strain';
    },
    choices: [
      { label: '教他打球', hint: '篮球启蒙', apply: function() {
        setBranchNode('family_children', 'growth_hoop', { growth: 'hoop' });
        STATE.career.flags.childHoop = true;
        return '你教他拍球，他学会后跑到球场另一头喊：爸爸看我。那一刻你比拿到总冠军还高兴。<br><br>效果：flag childHoop = true。';
      }},
      { label: '陪他做普通的事', hint: '状态更稳', apply: function() {
        setBranchNode('family_children', 'growth_life', { growth: 'life' });
        addSeasonMod('formVariance', -1, -10, 10);
        addProfileDelta('fanSupport', 1);
        return '你带他去公园、超市和游乐园。他不在意你多有名，只在意你陪了他多久。<br><br>效果：状态波动-1；球迷支持+1。';
      }},
      { label: '让他自己选', hint: '自由成长', apply: function() {
        setBranchNode('family_children', 'growth_free', { growth: 'free' });
        STATE.career.flags.childFree = true;
        return '你带他看篮球，也带他画画。你说：不一定要像爸爸。<br><br>效果：flag childFree = true。';
      }},
      { label: '带他见世界', hint: '人气上升', apply: function() {
        setBranchNode('family_children', 'growth_public', { growth: 'public' });
        addProfileDelta('fame', 1);
        return '你带他看了第一次客场。镜头围过来时，他躲在你的腿后面，又偷偷探出头。<br><br>效果：人气+1。';
      }}
    ]
  },
  {
    id: 'child_public',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '家人孩子：聚光灯下的孩子',
    scenes: ['你第一次认真考虑：要不要让孩子出现在聚光灯下。照片传开后，有人夸可爱，有人讨论他的成长环境，你决定由自己掌握节奏。'],
    body: '你会怎么保护他，又怎么让他认识这个世界？',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'growth_hoop' || n === 'growth_life' || n === 'growth_free' || n === 'growth_public';
    },
    choices: [
      { label: '保护隐私', hint: '媒体好感上升', apply: function() {
        setBranchNode('family_children', 'public_protected', { publicity: 'protected' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('fanSupport', 1);
        return '你要求媒体不再拍他，把账号里的照片也删了大半。世界还在议论，但至少他自己不知道。<br><br>效果：媒体好感+1；球迷支持+1。';
      }},
      { label: '带他亮相', hint: '人气上升，争议上升', apply: function() {
        setBranchNode('family_children', 'public_spotlight', { publicity: 'spotlight' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 1);
        return '你带他参加了一次公开活动。他挥手的样子被做成表情包，全网都在喊“太像了”。<br><br>效果：人气+2；争议+1。';
      }},
      { label: '顺其自然', hint: '状态稳定', apply: function() {
        setBranchNode('family_children', 'public_normal', { publicity: 'normal' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你不刻意曝光，也不刻意躲。有人拍到就拍到，他慢慢学会不在意镜头。<br><br>效果：状态波动-1。';
      }}
    ]
  },
  {
    id: 'child_future',
    branch: 'family_children', phases: ['offseason', 'season'], slot: 'main', weight: 9,
    title: '家人孩子：父子未来',
    scenes: ['他问你：爸爸，我也能打职业联赛吗？你认真想了很久，才发现答案不是“能”，而是“你想不想”。'],
    body: '你希望把什么留给他？',
    requires: function() {
      var n = getBranchNode('family_children');
      return n === 'public_protected' || n === 'public_spotlight' || n === 'public_normal';
    },
    choices: [
      { label: '父子同台', hint: '历史评价上升', apply: function() {
        setBranchNode('family_children', 'legacy_court', { legacy: 'court' });
        STATE.career.flags.childCourtDream = true;
        addProfileDelta('legacyBonus', 1);
        return '你告诉他：如果有一天我们同场，我会把球传给你。他笑得很用力，像是已经等到了那天。<br><br>效果：flag childCourtDream = true；历史评价+1。';
      }},
      { label: '送进青训', hint: '为他铺一条属于自己的路', apply: function() {
        setBranchNode('family_children', 'legacy_academy', { legacy: 'academy' });
        STATE.career.flags.childAcademy = true;
        addProfileDelta('legacyBonus', 1);
        return '你送他进了青训营。他第一天回来满身汗，却兴奋地讲了一整晚训练。<br><br>效果：他的篮球路有了起点，未来也可能成为你的延续。';
      }},
      { label: '尊重他的选择', hint: '球迷支持上升', apply: function() {
        setBranchNode('family_children', 'legacy_own', { legacy: 'own' });
        STATE.career.flags.childOwnChoice = true;
        addProfileDelta('fanSupport', 1);
        return '你说：你不需要像我。他第一次没有立刻反驳，只是点了点头。<br><br>效果：flag childOwnChoice = true；球迷支持+1。';
      }},
      { label: '让他过普通人生', hint: '状态稳定', apply: function() {
        setBranchNode('family_children', 'legacy_quiet', { legacy: 'quiet' });
        STATE.career.flags.childQuietLife = true;
        addSeasonMod('formVariance', -1, -10, 10);
        return '你带他钓鱼、骑车、看比赛但不教他怎么打。他想打的时候自然会来问你。<br><br>效果：flag childQuietLife = true；状态波动-1。';
      }}
    ]
  },
  {
    id: 'camp_launch',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 10,
    title: '训练营：开营决策',
    scenes: ['你租下那座球馆时，房东问你：这是要当生意做，还是当梦想做？你笑了笑：先让梦想把房租付了。'],
    body: '你选择开一间什么样的训练营？',
    requires: function() {
      var tr = getBranchNode('training');
      var tp = getBranchNode('team_practice');
      var ch = getBranchNode('charity');
      return getBranchNode('training_camp') === 'start' && (tr === 'training_identity' || tp === 'practice_identity' || ch !== 'start');
    },
    choices: [
      { label: '暑期营规模', hint: '球迷支持与商业上升', apply: function() {
        setBranchNode('training_camp', 'camp_large', { mode: 'large' });
        addProfileDelta('fanSupport', 2);
        addProfileDelta('businessValue', 1);
        return '开营第一天来了两百多个孩子，球馆门口排到街角。你站在门口，像第一次进训练馆的自己。<br><br>效果：球迷支持+2；商业价值+1。';
      }},
      { label: '精品小班', hint: '训练效果更高', apply: function() {
        setBranchNode('training_camp', 'camp_small', { mode: 'small' });
        addProfileDelta('legacyBonus', 1);
        return '你只收了十二个孩子，每个动作都亲自示范。有个孩子说：教练，你比视频里凶。<br><br>效果：历史评价+1。';
      }},
      { label: '公益名额', hint: '媒体好感与球迷支持上升', apply: function() {
        setBranchNode('training_camp', 'camp_charity', { mode: 'charity' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('fanSupport', 3);
        return '你把一半名额留给交不起学费的孩子。第一堂课上，一个男孩小声说：我以后也想当教练。<br><br>效果：媒体好感+2；球迷支持+3。';
      }},
      { label: '国际交流', hint: '人脉线效果增强', apply: function() {
        setBranchNode('training_camp', 'camp_intl', { mode: 'intl' });
        STATE.career.flags.campIntl = true;
        return '你邀请了几个海外教练和孩子来交流。语言不通，但篮球替你们翻译。<br><br>效果：flag campIntl = true。';
      }}
    ]
  },
  {
    id: 'camp_style',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 11,
    title: '训练营：教练风格',
    scenes: ['第一个学员把你教的动作做歪了。你忍住没纠正，先问他：你自己觉得哪里不对？他愣住的样子，像极了当年的你。'],
    body: '你希望孩子们记住你是一个怎样的教练？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'camp_large' || n === 'camp_small' || n === 'camp_charity' || n === 'camp_intl';
    },
    choices: [
      { label: '亲自带', hint: '最真实', apply: function() {
        setBranchNode('training_camp', 'style_own', { style: 'own' });
        STATE.career.flags.campOwnCoach = true;
        return '你每堂课都亲自下场示范。膝盖有点旧伤，但你舍不得站在场边。<br><br>效果：flag campOwnCoach = true。';
      }},
      { label: '请导师助阵', hint: '人脉更强', apply: function() {
        setBranchNode('training_camp', 'style_mentors', { style: 'mentors' });
        STATE.career.flags.campMentors = true;
        return '你请来几位老将和教练。孩子们第一次看到这么多名字一起出现，像参加全明星。<br><br>效果：flag campMentors = true。';
      }},
      { label: '让学员互相教', hint: '更衣室信任上升', apply: function() {
        setBranchNode('training_camp', 'style_peer', { style: 'peer' });
        STATE.career.flags.campPeer = true;
        addProfileDelta('lockerRoomTrust', 1);
        return '你让大孩子教小孩子。被教的那个学会后，第一件事是跑去教更小的。<br><br>效果：flag campPeer = true；更衣室信任+1。';
      }},
      { label: '魔鬼训练', hint: '成长快但风险高', apply: function() {
        setBranchNode('training_camp', 'style_strict', { style: 'strict' });
        STATE.career.flags.campStrict = true;
        return '你要求每个动作做够一百次。孩子们喊累，但结营时没人想走。<br><br>效果：flag campStrict = true。';
      }}
    ]
  },
  {
    id: 'camp_student',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 12,
    title: '训练营：特殊学员',
    scenes: ['开营第三天，一个瘦小的男孩站在门口，说想试训，但交不起学费。你让他进来，他练到所有人都走了还没走。'],
    body: '你会怎么对待这个特别的学员？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'style_own' || n === 'style_mentors' || n === 'style_peer' || n === 'style_strict';
    },
    choices: [
      { label: '按天赋重点培养', hint: '故事性最强', apply: function() {
        setBranchNode('training_camp', 'student_prodigy', { student: 'prodigy' });
        STATE.career.flags.studentProdigy = true;
        return '他的天赋比同龄人高出一截。训练时你故意压着他，怕他太早觉得世界很简单。<br><br>效果：flag studentProdigy = true。';
      }},
      { label: '免学费，送他新鞋', hint: '公益联动', apply: function() {
        setBranchNode('training_camp', 'student_hardship', { student: 'hardship' });
        STATE.career.flags.studentHardship = true;
        return '你免了他的学费，还给他买了一双新鞋。他低着头说了声谢谢，练得更狠了。<br><br>效果：flag studentHardship = true。';
      }},
      { label: '先定规矩再收下', hint: '争议上升', apply: function() {
        setBranchNode('training_camp', 'student_rebel', { student: 'rebel' });
        STATE.career.flags.studentRebel = true;
        addProfileDelta('controversy', 1);
        return '他顶撞你、迟到、态度差，但投篮手感是真的好。你决定不赶他走。<br><br>效果：flag studentRebel = true；争议+1。';
      }},
      { label: '给他时间慢慢熟悉', hint: '最有耐心的故事', apply: function() {
        setBranchNode('training_camp', 'student_quiet', { student: 'quiet' });
        STATE.career.flags.studentQuiet = true;
        return '他从不抢话，训练完总是一个人加练。你问他为什么，他说：怕被落下。<br><br>效果：flag studentQuiet = true。';
      }}
    ]
  },
  {
    id: 'camp_crisis',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 12,
    title: '训练营：训练营危机',
    scenes: ['训练营进入第三周，问题一起冒出来：那个瘦小男孩训练时扭伤了脚踝，家长群里开始质疑训练强度，赞助商也在催你加课时，还有两个学员差点在场上动手。你站在球馆门口，知道这是这个夏天第一次真正的考验。'],
    body: '问题一起压过来，你要先处理哪一件？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'student_prodigy' || n === 'student_hardship' || n === 'student_rebel' || n === 'student_quiet';
    },
    choices: [
      { label: '先守在受伤学员身边', hint: '把孩子放在第一位', apply: function() {
        setBranchNode('training_camp', 'crisis_injury', { crisis: 'injury' });
        addProfileDelta('controversy', 1);
        return '片子出来没有大碍，但舆论已经把“训练营不安全”写进标题。你守在球馆门口等他复查。<br><br>效果：争议+1。';
      }},
      { label: '先回应家长的质疑', hint: '把训练安排讲清楚', apply: function() {
        setBranchNode('training_camp', 'crisis_parent', { crisis: 'parent' });
        addProfileDelta('mediaPressure', 1, -10, 10);
        return '有家长在群里质疑训练强度。你没有删消息，只发了一条长回复，把每堂课的内容列出来。<br><br>效果：媒体压力+1。';
      }},
      { label: '先顶住赞助商的要求', hint: '坚持训练营的纯粹', apply: function() {
        setBranchNode('training_camp', 'crisis_sponsor', { crisis: 'sponsor' });
        addProfileDelta('businessValue', -1);
        return '赞助商希望加广告位、加课时、加利润。你看着那份合同，第一次知道什么叫“被钱绑架”。<br><br>效果：商业价值-1。';
      }},
      { label: '先把冲突带到中圈', hint: '让双方把话说完', apply: function() {
        setBranchNode('training_camp', 'crisis_rivalry', { crisis: 'rivalry' });
        addProfileDelta('controversy', 1);
        return '两个学员在球场上差点动手。你把所有人叫到中圈，让他们把话说完。<br><br>效果：争议+1。';
      }}
    ]
  },
  {
    id: 'camp_response',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 11,
    title: '训练营：危机回应',
    scenes: ['你关掉手机想了一晚。最后你决定：先做对的事，再谈对的话。'],
    body: '你怎么回应这场危机？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'crisis_injury' || n === 'crisis_parent' || n === 'crisis_sponsor' || n === 'crisis_rivalry';
    },
    choices: [
      { label: '安全优先', hint: '媒体好感上升', apply: function() {
        setBranchNode('training_camp', 'respond_safety', { respond: 'safety' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('controversy', -1);
        return '你停训三天，请队医给每个孩子做了检查。有人觉得小题大做，但家长群里安静了。<br><br>效果：媒体好感+2；争议-1。';
      }},
      { label: '坦诚沟通', hint: '球迷支持上升', apply: function() {
        setBranchNode('training_camp', 'respond_truth', { respond: 'truth' });
        addProfileDelta('fanSupport', 2);
        return '你没有公关稿，直接录了一段视频，把前因后果讲清楚。结尾说：我会负责。<br><br>效果：球迷支持+2。';
      }},
      { label: '拒绝干预', hint: '原则更清晰', apply: function() {
        setBranchNode('training_camp', 'respond_exit', { respond: 'exit' });
        addProfileDelta('mediaTrust', -1);
        return '你拒绝了赞助商和部分家长的“建议”。训练营少了一些人，但留下的人知道这里的规矩。<br><br>效果：媒体好感-1；原则更清晰。';
      }},
      { label: '化危机为课程', hint: '历史评价上升', apply: function() {
        setBranchNode('training_camp', 'respond_lesson', { respond: 'lesson' });
        STATE.career.flags.campLesson = true;
        addProfileDelta('legacyBonus', 1);
        return '你把这次危机变成一堂课：怎么面对伤病、压力和外界的评价。孩子们听得比训练还认真。<br><br>效果：flag campLesson = true；历史评价+1。';
      }}
    ]
  },
  {
    id: 'camp_legacy',
    branch: 'training_camp', phase: 'offseason', slot: 'main', weight: 9,
    title: '训练营：学员成名',
    scenes: ['五年后，那个男孩进了大学校队。他给你打电话时声音发抖：教练，我做到了。你听完只说了句：我知道。'],
    body: '你希望这段师生关系以什么方式收尾？',
    requires: function() {
      var n = getBranchNode('training_camp');
      return n === 'respond_safety' || n === 'respond_truth' || n === 'respond_exit' || n === 'respond_lesson';
    },
    choices: [
      { label: '全力支持', hint: '球迷支持上升', apply: function() {
        setBranchNode('training_camp', 'legacy_support', { legacy: 'support' });
        STATE.career.flags.campSupport = true;
        addProfileDelta('fanSupport', 2);
        return '他首秀那天，你坐在场边第一排。他进球后朝你比了个手势，那是你们训练营的暗号。<br><br>效果：flag campSupport = true；球迷支持+2。';
      }},
      { label: '保持距离', hint: '媒体好感上升', apply: function() {
        setBranchNode('training_camp', 'legacy_space', { legacy: 'space' });
        STATE.career.flags.campSpace = true;
        addProfileDelta('mediaTrust', 1);
        return '你没有蹭他的热度，只在电话里说：好好打。媒体问起来，你只说：那是他自己的故事。<br><br>效果：flag campSpace = true；媒体好感+1。';
      }},
      { label: '签约培养', hint: '商业价值上升', apply: function() {
        setBranchNode('training_camp', 'legacy_sign', { legacy: 'sign' });
        STATE.career.flags.campSign = true;
        addProfileDelta('businessValue', 2);
        return '你和他签了培养协议，帮他找经纪和训练资源。有人说你精明，你知道这是你唯一能给他的承诺。<br><br>效果：flag campSign = true；商业价值+2。';
      }},
      { label: '放手', hint: '历史评价上升', apply: function() {
        setBranchNode('training_camp', 'legacy_free', { legacy: 'free' });
        STATE.career.flags.campFree = true;
        addProfileDelta('legacyBonus', 1);
        return '他说想靠自己的名字打球。你点点头：那就不提我。<br><br>效果：flag campFree = true；历史评价+1。';
      }}
    ]
  },
  {
    id: 'charity_entry',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 3,
    title: '公益：第一次公益',
    scenes: ['经纪人递来公益活动清单，你原本想挑一场最省事的，直到看见一张社区球馆的照片：地板开裂，但孩子们还在打。'],
    body: '你选择怎么开始这段公益之路？',
    requires: function() {
      var played = (STATE.career.totalStats && STATE.career.totalStats.games > 0) || (STATE.season && STATE.season.playerStats && STATE.season.playerStats.games > 0);
      var honored = hasCareerHonor('全明星') || hasCareerHonor('MVP') || hasCareerHonor('总冠军');
      return getBranchNode('charity') === 'start' && (played || honored);
    },
    choices: [
      { label: '捐款', hint: '媒体好感上升，争议下降', apply: function() {
        setBranchNode('charity', 'charity_donate', { entry: 'donate' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你捐了一笔钱，没让团队宣传。直到球馆翻新的照片出来，人们才知道是你。<br><br>效果：媒体好感+1；争议-1。';
      }},
      { label: '亲自下场', hint: '球迷支持上升', apply: function() {
        setBranchNode('charity', 'charity_play', { entry: 'play' });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('fame', 1);
        return '你穿着便装出现在社区球馆，和孩子们打了两个小时。没人要求签名，但每个人都想和你一队。<br><br>效果：球迷支持+3；人气+1。';
      }},
      { label: '低调参与', hint: '状态稳定', apply: function() {
        setBranchNode('charity', 'charity_lowkey', { entry: 'lowkey' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你以个人名义参加了志愿者活动，没让任何镜头进来。结束时，你反而觉得轻松。<br><br>效果：媒体好感+1；状态波动-1。';
      }},
      { label: '商业合作', hint: '商业价值上升', apply: function() {
        setBranchNode('charity', 'charity_biz', { entry: 'biz' });
        STATE.career.flags.charityBiz = true;
        addProfileDelta('businessValue', 2);
        return '品牌方愿意配捐。你在合同里加了一条：收益的一定比例必须进公益账户。<br><br>效果：flag charityBiz = true；商业价值+2。';
      }}
    ]
  },
  {
    id: 'charity_project',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 4,
    title: '公益：公益项目',
    scenes: ['你决定不只捐钱，而是把一个项目做起来。第一次开协调会，你发现自己比打抢七还紧张。'],
    body: '你想把公益做成什么样子？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'charity_donate' || n === 'charity_play' || n === 'charity_lowkey' || n === 'charity_biz';
    },
    choices: [
      { label: '建球馆', hint: '球迷支持上升', apply: function() {
        setBranchNode('charity', 'charity_court', { project: 'court' });
        STATE.career.flags.charityCourt = true;
        addProfileDelta('fanSupport', 3);
        return '你翻新了那座社区球馆，地板、篮板、灯光全部换新。开馆那天，孩子们第一次有了自己的主场。<br><br>效果：flag charityCourt = true；球迷支持+3。';
      }},
      { label: '资助学校', hint: '历史评价上升', apply: function() {
        setBranchNode('charity', 'charity_school', { project: 'school' });
        STATE.career.flags.charitySchool = true;
        addProfileDelta('legacyBonus', 1);
        return '你资助了一所学校的篮球课程，也补上了体育老师的工资。校长说，孩子们比以前更愿意上学了。<br><br>效果：flag charitySchool = true；历史评价+1。';
      }},
      { label: '成立基金会', hint: '商业价值上升', apply: function() {
        setBranchNode('charity', 'charity_foundation', { project: 'foundation' });
        STATE.career.flags.charityFoundation = true;
        addProfileDelta('businessValue', 2);
        return '你成立了基金会，请了专业的团队。第一次理事会上，你发现自己要做的不只是给钱。<br><br>效果：flag charityFoundation = true；商业价值+2。';
      }},
      { label: '国际项目', hint: '人脉线效果增强', apply: function() {
        setBranchNode('charity', 'charity_intl', { project: 'intl' });
        STATE.career.flags.charityIntl = true;
        return '你把项目带到海外，和当地青训合作。语言不同，但球场上的默契是一样的。<br><br>效果：flag charityIntl = true。';
      }}
    ]
  },
  {
    id: 'charity_scale',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 4,
    title: '公益：规模抉择',
    scenes: ['项目做起来了，问题也跟着变多。有人劝你扩大，有人劝你收缩，你说不出哪边更对。'],
    body: '你决定把项目带到多大？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'charity_court' || n === 'charity_school' || n === 'charity_foundation' || n === 'charity_intl';
    },
    choices: [
      { label: '扩大', hint: '影响力上升，风险上升', apply: function() {
        setBranchNode('charity', 'scale_grow', { scale: 'grow' });
        STATE.career.flags.charityGrow = true;
        addProfileDelta('fame', 2);
        return '你把项目复制到三座城市。团队忙到凌晨，你第一次觉得“被需要”也会让人喘不过气。<br><br>效果：flag charityGrow = true；人气+2。';
      }},
      { label: '保持', hint: '状态稳定', apply: function() {
        setBranchNode('charity', 'scale_keep', { scale: 'keep' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有急着扩张，先把现有项目做扎实。第二年，那些孩子真的长高了。<br><br>效果：状态波动-1。';
      }},
      { label: '收缩', hint: '争议下降', apply: function() {
        setBranchNode('charity', 'scale_cut', { scale: 'cut' });
        addProfileDelta('controversy', -1);
        addProfileDelta('mediaTrust', 1);
        return '你主动收缩了规模，只保留最扎实的部分。有人说你雷声大雨点小，你知道自己在做什么。<br><br>效果：争议-1；媒体好感+1。';
      }},
      { label: '交给团队', hint: '更可持续', apply: function() {
        setBranchNode('charity', 'scale_team', { scale: 'team' });
        STATE.career.flags.charityTeam = true;
        return '你请了执行团队，自己只当发起人。第一次放手时你很不习惯，后来发现项目反而跑得更顺。<br><br>效果：flag charityTeam = true。';
      }}
    ]
  },
  {
    id: 'charity_crisis',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 4,
    title: '公益：公益争议',
    scenes: ['有人在评论区质疑你作秀。账目、动机、合作品牌、内部管理，全被拿出来逐条讨论。你第一次明白，做好事也需要勇气。'],
    body: '问题一起压过来，你要先回应哪一个？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'scale_grow' || n === 'scale_keep' || n === 'scale_cut' || n === 'scale_team';
    },
    choices: [
      { label: '先公开账目', hint: '最尖锐，也最诚实', apply: function() {
        setBranchNode('charity', 'crisis_book', { crisis: 'book' });
        addProfileDelta('controversy', 1);
        return '你决定公开每一笔账。团队连夜整理报表，你知道这是最累也最诚实的一天。<br><br>效果：争议+1。';
      }},
      { label: '先回应作秀质疑', hint: '舆论压力上升', apply: function() {
        setBranchNode('charity', 'crisis_show', { crisis: 'show' });
        addProfileDelta('mediaPressure', 1, -10, 10);
        return '热搜词条变成“球员作秀”。你没有急着发声明，因为你知道，解释可能让事情更糟。<br><br>效果：媒体压力+1。';
      }},
      { label: '先排查合作品牌', hint: '争议大幅上升', apply: function() {
        setBranchNode('charity', 'crisis_scandal', { crisis: 'scandal' });
        STATE.career.flags.charityScandal = true;
        addProfileDelta('controversy', 2);
        return '你排查合作品牌时发现对方出了事，你的名字被一起拖下水。你没有切割，先把孩子的事办完再说。<br><br>效果：flag charityScandal = true；争议+2。';
      }},
      { label: '先审计内部账目', hint: '信任危机', apply: function() {
        setBranchNode('charity', 'crisis_embezzle', { crisis: 'embezzle' });
        STATE.career.flags.charityEmbezzle = true;
        addProfileDelta('controversy', 2);
        return '你审计内部账目时发现一笔钱不对。团队里有人劝你私下处理，你选择把所有人叫到一起。<br><br>效果：flag charityEmbezzle = true；争议+2。';
      }}
    ]
  },
  {
    id: 'charity_response',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 4,
    title: '公益：危机回应',
    scenes: ['你关掉手机想了一晚。最后你决定：先做对的事，再谈对的话。'],
    body: '你选择怎样回应这场争议？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'crisis_book' || n === 'crisis_show' || n === 'crisis_scandal' || n === 'crisis_embezzle';
    },
    choices: [
      { label: '公开账目', hint: '媒体好感上升，争议下降', apply: function() {
        setBranchNode('charity', 'respond_book', { respond: 'book' });
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('controversy', -2);
        return '你把每一笔支出都公开了，包括自己的管理费。评论区从质疑变成：行，这波我服。<br><br>效果：媒体好感+2；争议-2。';
      }},
      { label: '亲自回应', hint: '球迷支持上升', apply: function() {
        setBranchNode('charity', 'respond_trust', { respond: 'trust' });
        addProfileDelta('fanSupport', 2);
        addProfileDelta('fame', 1);
        return '你没有发声明，直接在直播里回答每一个问题，回答到嗓子哑了。有人开始相信你不是在表演。<br><br>效果：球迷支持+2；人气+1。';
      }},
      { label: '沉默', hint: '热度消退但留下疑问', apply: function() {
        setBranchNode('charity', 'respond_silent', { respond: 'silent' });
        addProfileDelta('controversy', 1);
        return '你没有回应任何质疑。热度慢慢过去，但你知道，有些问题不会因为沉默消失。<br><br>效果：争议+1。';
      }},
      { label: '法律手段', hint: '争议下降，媒体好感上升', apply: function() {
        setBranchNode('charity', 'respond_law', { respond: 'law' });
        STATE.career.flags.charityLaw = true;
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('controversy', -1);
        return '你对造谣的人提起了诉讼。有人说你太较真，你说：公益经不起被当玩笑。<br><br>效果：flag charityLaw = true；媒体好感+1；争议-1。';
      }}
    ]
  },
  {
    id: 'charity_legacy',
    branch: 'charity', phases: ['offseason', 'season'], slot: 'main', weight: 3,
    title: '公益：公益收束',
    scenes: ['五年后，那座球馆的孩子们已经长大。有人问你当初为什么做公益，你只说：因为被需要的感觉，比赢球更接近幸福。'],
    body: '你希望这段公益故事被怎样记住？',
    requires: function() {
      var n = getBranchNode('charity');
      return n === 'respond_book' || n === 'respond_trust' || n === 'respond_silent' || n === 'respond_law';
    },
    choices: [
      { label: '慈善家', hint: '历史评价上升', apply: function() {
        setBranchNode('charity', 'legacy_legend', { legacy: 'legend' });
        STATE.career.flags.charityLegend = true;
        addProfileDelta('legacyBonus', 2);
        return '媒体开始用“慈善家”称呼你。你不喜欢这个头衔，但你知道那些球馆会替你记得。<br><br>效果：flag charityLegend = true；历史评价+2。';
      }},
      { label: '社区英雄', hint: '球迷支持大幅上升', apply: function() {
        setBranchNode('charity', 'legacy_hero', { legacy: 'hero' });
        STATE.career.flags.charityHero = true;
        addProfileDelta('fanSupport', 4);
        return '社区把那天定为“XX日”。你站在球馆门口，第一次觉得自己真的属于这里。<br><br>效果：flag charityHero = true；球迷支持+4。';
      }},
      { label: '安静善举', hint: '媒体好感上升', apply: function() {
        setBranchNode('charity', 'legacy_quiet', { legacy: 'quiet' });
        STATE.career.flags.charityQuiet = true;
        addProfileDelta('mediaTrust', 2);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你不再公开谈公益，只继续做。有人问起，你笑笑：做就是了。<br><br>效果：flag charityQuiet = true；媒体好感+2；状态波动-1。';
      }},
      { label: '商业公益', hint: '商业价值上升', apply: function() {
        setBranchNode('charity', 'legacy_biz', { legacy: 'biz' });
        STATE.career.flags.charityBizLegend = true;
        addProfileDelta('businessValue', 3);
        return '你把公益做成了可持续的模式：品牌出钱、社区受益、孩子打球。有人问是不是生意，你说：能一直做下去就行。<br><br>效果：flag charityBizLegend = true；商业价值+3。';
      }}
    ]
  },
  {
    id: 'countdown_trigger',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '退役倒计时：心里的声音',
    scenes: [
      '赛季结束后的深夜，你一个人坐在球馆里。灯只留了一盏，地板上的倒影比年轻时安静。',
      '你数了数这些年受过的伤，又数了数还能跑起来的夜晚。不是打不动了，是你开始能听见身体里的声音。'
    ],
    body: '那个声音越来越大：是不是到了该告别的时候？',
    requires: function() {
      var age = (STATE.career && STATE.career.currentAge) || 22;
      var tend = STATE.career && STATE.career.flags && STATE.career.flags.familyRetireTendency;
      return getBranchNode('retirement_countdown') === 'start' && (age >= 37 || tend === 'retire');
    },
    choices: [
      { label: '认真面对告别', hint: '开启退役倒计时', apply: function() {
        setBranchNode('retirement_countdown', 'countdown_open', { status: 'open' });
        addProfileDelta('mediaTrust', 1);
        return '你没有立刻告诉任何人。只是第二天训练结束，你多留了一会儿，把球馆看了一遍。<br><br>重点：你决定给这段生涯一个正式的告别。<br><br>影响：倒计时开启，接下来会走向退役收束。';
      }},
      { label: '推迟告别，再打几年', hint: '继续战斗', apply: function() {
        setBranchNode('retirement_countdown', 'postponed', { status: 'postponed' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.countdownPostponed = true;
        delete STATE.career.flags.countdownDone;
        return '你关掉灯，跟那个声音说：再等等。至少等到我不再期待踏上球场那天。<br><br>重点：你选择继续战斗。<br><br>影响：倒计时不开启，未来仍会正常出现退役选择。';
      }}
    ]
  },
  {
    id: 'countdown_reflect',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '退役倒计时：告别前的夜晚',
    scenes: [
      '赛季还没结束，你已经开始舍不得了。更衣室的味道、客场大巴的窗户、球迷喊你名字的尾音。',
      '一个普通训练日，你站在场边看年轻人跑战术，忽然意识到：自己真的快要离开这个画面了。'
    ],
    body: '在真正告别之前，你最想把什么留在心里？',
    requires: function() { return getBranchNode('retirement_countdown') === 'countdown_open'; },
    choices: [
      { label: '记住欢呼', hint: '球迷支持上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_memories', { memory: 'cheer' });
        addProfileDelta('fanSupport', 2);
        return '你把主场球迷的欢呼录了下来。不是用来发，是用来以后想念。<br><br>重点：你选择带着这些声音离开。<br><br>影响：球迷支持+2。';
      }},
      { label: '记住队友', hint: '更衣室信任上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_memories', { memory: 'teammates' });
        addProfileDelta('lockerRoomTrust', 2);
        return '那天晚上你请全队吃了饭。没人提退役，但每个人都多坐了一会儿。<br><br>重点：你选择带走这些关系。<br><br>影响：更衣室信任+2。';
      }},
      { label: '记住自己', hint: '媒体好感上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_memories', { memory: 'self' });
        addProfileDelta('mediaTrust', 1);
        return '你翻出新秀年的照片，坐在家里看了很久。那个少年不知道以后会走多远，但你知道，他没有走错路。<br><br>重点：你选择记住最初那个自己。<br><br>影响：媒体好感+1。';
      }}
    ]
  },
  {
    id: 'countdown_close',
    branch: 'retirement_countdown', phase: 'offseason', slot: 'main', weight: 10,
    title: '退役倒计时：放下球衣的那天',
    scenes: [
      '赛季真正结束时，你没有急着收拾。你坐在更衣室，把号码从身上摘下来，像摘下一段很长的日子。',
      '没有人催你。你知道，离开这件事，终于可以体面地发生了。'
    ],
    body: '放下球衣的那一刻，你希望心里留下的是什么？',
    requires: function() { return getBranchNode('retirement_countdown') === 'farewell_memories'; },
    choices: [
      { label: '圆满', hint: '没有遗憾', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_legend', { legacy: 'legend' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.countdownLegend = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', 3);
        return '你想起所有值得的瞬间，觉得这一路没有辜负任何人。<br><br>重点：退役收束为“圆满”。<br><br>影响：退役结算即将开始。';
      }},
      { label: '传承', hint: '为教练之路埋下种子', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_mentor', { legacy: 'mentor' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.countdownMentor = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', 1);
        return '你把最后一段时光用来教年轻人。他们后来会提起你，像提起一段路。<br><br>重点：退役收束为“传承”。<br><br>影响：为退役后的教练之路埋下种子。';
      }},
      { label: '安静', hint: '状态稳定', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_quiet', { legacy: 'quiet' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.countdownQuiet = true;
        STATE.career.flags.countdownDone = true;
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有办告别演出，只在离开前把更衣室收拾干净。有些人记得，那就够了。<br><br>重点：退役收束为“安静”。<br><br>影响：状态稳定。';
      }},
      { label: '遗憾', hint: '更真实但留伤疤', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_hurt', { legacy: 'hurt' });
        STATE.career.flags = STATE.career.flags || {};
        STATE.career.flags.legacyHurt = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', -1);
        return '伤病让最后一段路有点疼。你站在更衣室里，把护具放好，没让任何人看见你的眼睛。<br><br>重点：退役收束为“遗憾”，但更真实。<br><br>影响：历史评价-1。';
      }}
    ]
  },
  {
    id: 'countdown_route',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 11,
    title: '退役倒计时：最后一季路线',
    scenes: ['总经理问你怎么安排这个赛季。你第一次觉得，赛季不是赛程，而是一场漫长的告别。'],
    body: '你希望最后一季以什么方式展开？',
    requires: function() { return false; },
    choices: [
      { label: '常规赛巡演', hint: '球迷支持上升', apply: function() {
        setBranchNode('retirement_countdown', 'route_regular', { route: 'regular' });
        addProfileDelta('fanSupport', 3);
        return '你打完每一场客场，认真和每个城市的球迷挥手。有人举着“再见”的牌子，你知道那是祝福。<br><br>效果：球迷支持+3。';
      }},
      { label: '只打季后赛', hint: '状态更专注', apply: function() {
        setBranchNode('retirement_countdown', 'route_playoff', { route: 'playoff' });
        STATE.career.flags.routePlayoff = true;
        return '你选择轮休常规赛，只把力气留给季后赛。媒体说你任性，你知道自己为什么这么做。<br><br>效果：flag routePlayoff = true。';
      }},
      { label: '全明星谢幕', hint: '人气上升', apply: function() {
        setBranchNode('retirement_countdown', 'route_allstar', { route: 'allstar' });
        STATE.career.flags.routeAllStar = true;
        addProfileDelta('fame', 2);
        return '你把全明星当成谢幕战。最后一球，全场起立，连对手都停下来看。<br><br>效果：flag routeAllStar = true；人气+2。';
      }},
      { label: '减少出场', hint: '伤病风险下降', apply: function() {
        setBranchNode('retirement_countdown', 'route_light', { route: 'light' });
        STATE.career.flags.routeLight = true;
        addSeasonMod('injuryRiskBonus', -2, -4, 8);
        return '你把上场时间让给年轻人，自己只打关键回合。身体轻松了，心反而有点空。<br><br>效果：flag routeLight = true；伤病风险-2。';
      }}
    ]
  },
  {
    id: 'countdown_farewell',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '退役倒计时：告别时刻',
    scenes: ['客场球迷开始为你起立。有人举着“谢谢你”的牌子，也有人从第一年就开始看你打球。'],
    body: '你希望在哪座城市、用什么方式说再见？',
    requires: function() { return false; },
    choices: [
      { label: '每城致敬', hint: '历史评价上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_city', { farewell: 'city' });
        addProfileDelta('fanSupport', 3);
        addProfileDelta('legacyBonus', 1);
        return '你把每个客场都变成谢幕。最后一场结束时，客队球迷也站起来鼓掌。<br><br>效果：球迷支持+3；历史评价+1。';
      }},
      { label: '回母队', hint: '队史评价上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_team', { farewell: 'team' });
        STATE.career.flags.farewellHomeTeam = true;
        addProfileDelta('legacyBonus', 2);
        return '你回到职业生涯开始的地方打完最后一场。那座球馆的灯光，比记忆中更亮。<br><br>效果：flag farewellHomeTeam = true；历史评价+2。';
      }},
      { label: '主场之夜', hint: '球迷支持上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_home', { farewell: 'home' });
        addProfileDelta('fanSupport', 2);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你只在主场告别。最后一晚，整座球馆喊你的名字喊到灯光熄灭。<br><br>效果：球迷支持+2；伤病风险-1。';
      }},
      { label: '队友之夜', hint: '更衣室信任上升', apply: function() {
        setBranchNode('retirement_countdown', 'farewell_buddy', { farewell: 'buddy' });
        STATE.career.flags.farewellBuddy = true;
        addProfileDelta('lockerRoomTrust', 2);
        return '你把最后一个进球传给队友，让他完成最后一攻。他说：这球算你头上。<br><br>效果：flag farewellBuddy = true；更衣室信任+2。';
      }}
    ]
  },
  {
    id: 'countdown_teammates',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '退役倒计时：队友的反应',
    scenes: ['更衣室里没人主动提“退役”两个字。直到一个年轻球员开口：教练，我能跟你打最后一年吗？'],
    body: '队友的态度会影响你最后这段路的温度。',
    requires: function() { return false; },
    choices: [
      { label: '挽留', hint: '更衣室信任上升', apply: function() {
        setBranchNode('retirement_countdown', 'team_stay', { team: 'stay' });
        STATE.career.flags.teamStay = true;
        addProfileDelta('lockerRoomTrust', 2);
        return '老队友在更衣室说：再打一年吧，我们还行。你笑了笑：你们行，我不行了。<br><br>效果：flag teamStay = true；更衣室信任+2。';
      }},
      { label: '支持', hint: '球迷支持上升', apply: function() {
        setBranchNode('retirement_countdown', 'team_support', { team: 'support' });
        STATE.career.flags.teamSupport = true;
        addProfileDelta('fanSupport', 1);
        return '队友们没有劝你，只是把每一场都打得像你要走了一样。那一年，球队比想象中更团结。<br><br>效果：flag teamSupport = true；球迷支持+1。';
      }},
      { label: '传承', hint: '历史评价上升', apply: function() {
        setBranchNode('retirement_countdown', 'team_pass', { team: 'pass' });
        STATE.career.flags.teamPass = true;
        addProfileDelta('legacyBonus', 1);
        return '你开始把战术板交给年轻球员。他们问你为什么，你说：因为我要走的路，你们要接着走。<br><br>效果：flag teamPass = true；历史评价+1。';
      }},
      { label: '沉默', hint: '争议上升', apply: function() {
        setBranchNode('retirement_countdown', 'team_silent', { team: 'silent' });
        STATE.career.flags.teamSilent = true;
        addProfileDelta('controversy', 1);
        return '更衣室没人讨论你的退役。不是冷漠，是不知道该怎么开口。<br><br>效果：flag teamSilent = true；争议+1。';
      }}
    ]
  },
  {
    id: 'countdown_final',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 12,
    title: '退役倒计时：最后一战',
    scenes: ['最后两分钟，教练没有叫暂停。全场都在喊你的名字，你忽然想不起自己是什么时候开始打球的。'],
    body: '你希望用哪种方式告别球场？',
    requires: function() { return false; },
    choices: [
      { label: '全力输出', hint: '历史评价上升', apply: function() {
        setBranchNode('retirement_countdown', 'final_show', { final: 'show' });
        STATE.career.flags.finalShow = true;
        addProfileDelta('legacyBonus', 1);
        return '你打出了生涯末段最好的表现，全场起立。那一刻你只想再要一个回合。<br><br>效果：flag finalShow = true；历史评价+1。';
      }},
      { label: '传给年轻人', hint: '更衣室信任上升', apply: function() {
        setBranchNode('retirement_countdown', 'final_pass', { final: 'pass' });
        STATE.career.flags.finalPass = true;
        addProfileDelta('lockerRoomTrust', 3);
        return '最后两分钟，你把球一次次交给年轻人。他们投丢了，你也不生气。<br><br>效果：flag finalPass = true；更衣室信任+3。';
      }},
      { label: '享受比赛', hint: '状态稳定', apply: function() {
        setBranchNode('retirement_countdown', 'final_enjoy', { final: 'enjoy' });
        STATE.career.flags.finalEnjoy = true;
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有在意比分，只是认真看了一遍每个角落。哨响时，你笑着走下场。<br><br>效果：flag finalEnjoy = true；状态波动-1。';
      }},
      { label: '带伤告别', hint: '争议与伤病风险上升', apply: function() {
        setBranchNode('retirement_countdown', 'final_hurt', { final: 'hurt' });
        STATE.career.flags.finalHurt = true;
        addProfileDelta('controversy', 1);
        addSeasonMod('injuryRiskBonus', 2, -4, 8);
        return '你带着伤打完最后一场。走下球场时，你把护具留在更衣室，像把一段日子留在那里。<br><br>效果：flag finalHurt = true；争议+1；伤病风险+2。';
      }}
    ]
  },
  {
    id: 'countdown_legacy',
    branch: 'retirement_countdown', phases: ['offseason', 'season'], slot: 'main', weight: 10,
    title: '退役倒计时：倒计时收束',
    scenes: ['比赛结束，你绕场一圈。灯光熄灭时，你听见自己心里那句“值了”。'],
    body: '你希望这段倒计时以什么方式收尾？',
    requires: function() { return false; },
    choices: [
      { label: '完美谢幕', hint: '历史评价大幅上升', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_legend', { legacy: 'legend' });
        STATE.career.flags.countdownLegend = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', 3);
        return '你以一场漂亮的比赛结束生涯。新闻报道写下：他让告别也变成表演。<br><br>效果：flag countdownLegend/countdownDone；历史评价+3。';
      }},
      { label: '传承告别', hint: '为教练之路埋下种子', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_mentor', { legacy: 'mentor' });
        STATE.career.flags.countdownMentor = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', 1);
        return '你把最后一场留给了年轻球员。更衣室里，有人喊了你一声“教练”。<br><br>效果：你开始像一位教练一样思考，这条路从此有了方向。';
      }},
      { label: '安静转身', hint: '状态稳定', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_quiet', { legacy: 'quiet' });
        STATE.career.flags.countdownQuiet = true;
        STATE.career.flags.countdownDone = true;
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有做任何告别仪式，悄悄打完最后一场，然后安静离开。有些人记得，那就够了。<br><br>效果：flag countdownQuiet/countdownDone；状态波动-1。';
      }},
      { label: '伤病遗憾', hint: '更真实但留伤疤', apply: function() {
        setBranchNode('retirement_countdown', 'legacy_hurt', { legacy: 'hurt' });
        STATE.career.flags.legacyHurt = true;
        STATE.career.flags.countdownDone = true;
        addProfileDelta('legacyBonus', -1);
        return '伤病让你没能以最好的状态离开。你站在更衣室里，把护具放好，没让任何人看见你的眼睛。<br><br>效果：flag legacyHurt/countdownDone；历史评价-1，但更真实。';
      }}
    ]
  },
  {
    id: 'post_career_opening',
    branch: 'post_career', phase: 'post_career', slot: 'main', weight: 12,
    title: '退役后：第一个夏天',
    scenes: [
      '球员通道没有变，只是这一次你没有穿球衣。你把行李从更衣室搬出来，站在停车场里，第一次不知道明天该去哪个球馆。',
      '手机响了一整天：解说台、教练组、品牌方、老队友，都在问你同一个问题——接下来想做什么？'
    ],
    body: '退役不是离开篮球，而是换一种方式继续留在这里。',
    requires: function() { return STATE.career && STATE.career.retired; },
    choices: [
      { label: '接受圈子邀约', hint: '进入身份选择', apply: function() {
        setBranchNode('post_career', 'post_career_map', { stage: 'map' });
        return '你答应了几场采访，见了两支球队的教练组，也和以前合作过的人吃了顿饭。门没有关上，是你第一次主动推开。<br><br>重点：你选择回到篮球旁边。<br><br>影响：下一步进入身份选择。';
      }},
      { label: '先休息一年', hint: '留白，让身体和精神真正退下来', apply: function() {
        setBranchNode('post_career', 'gap_year', { stage: 'gap' });
        return '你关掉了大部分来电，陪家人过了完整的一年：接孩子、看比赛、偶尔去野球场出汗。没有身份，但你终于睡得很好。<br><br>重点：你选择留白。<br><br>影响：下一步进入空白年之后。';
      }}
    ]
  },
  {
    id: 'post_career_gap_return',
    branch: 'post_career', phase: 'post_career', slot: 'main', weight: 8,
    title: '退役后：空白年之后',
    scenes: ['一年过去，你发现自己还是想回到篮球旁边。不是想打球，是想继续参与那些正在发生的比赛和故事。'],
    body: '空白年没有浪费，它让你确认了自己真的还想留下。',
    requires: function() { return getBranchNode('post_career') === 'gap_year'; },
    choices: [
      { label: '主动联系圈子', hint: '回到身份选择', apply: function() {
        setBranchNode('post_career', 'post_career_map', { stage: 'map' });
        return '你给经纪人和电视台回了电话。对方没有惊讶，只说：早就猜到你会回来。<br><br>重点：你主动推开那扇门。<br><br>影响：下一步进入身份选择。';
      }},
      { label: '继续低调生活', hint: '彻底放下聚光灯', apply: function() {
        setBranchNode('post_career', 'low_key', { finalIdentity: 'low_key' });
        STATE.career.flags.postCareerIdentity = 'low_key';
        addProfileDelta('fanSupport', 1);
        return '你偶尔出现在野球场和社区球馆，没人采访，也没人安排行程。你第一次觉得，篮球可以只是生活的一部分。<br><br>重点：你选择彻底退场。<br><br>影响：球迷支持+1；退役后身份线以低调生活收束。';
      }}
    ]
  },
  {
    id: 'post_career_map',
    branch: 'post_career', phase: 'post_career', slot: 'main', weight: 14,
    title: '退役后：身份选择',
    scenes: [
      '所有邀请都摆在你面前。解说台想要你的观点，教练组想要你的经验，品牌方想要你的名字。',
      '你忽然明白，退役后的身份不是别人给你的，是你选出来的。'
    ],
    body: '选择一种方式继续留在篮球里。有些路，需要你先走完一段故事才能选。',
    requires: function() { return getBranchNode('post_career') === 'post_career_map'; },
    choices: [
      { label: '电视评论员', hint: '媒体好感与出镜机会上升', lockHint: '需要媒体已经为你的形象定过调', requires: function() {
        return ['persona_humble','persona_arrogant','persona_silent','persona_business','persona_national','persona_controversial'].indexOf(getBranchNode('media')) >= 0;
      }, apply: function() {
        setBranchNode('post_career', 'commentator', { identity: 'commentator' });
        STATE.career.flags.postCareerIdentity = 'commentator';
        addProfileDelta('mediaTrust', 2);
        addProfileDelta('fame', 1);
        return '你坐在解说台的第一晚，镜头扫过你时，你发现自己比打球时更紧张。但第三期节目后，弹幕开始有人喊你的名字。<br><br>效果：媒体好感+2；人气+1。';
      }},
      { label: '助教', hint: '更衣室信任上升', lockHint: '需要更衣室已经认你是领袖', requires: function() {
        var tp = getBranchState('team_practice');
        return getBranchNode('team_practice') === 'practice_identity' && (tp.identity === 'team_mentor' || tp.identity === 'locker_room_leader');
      }, apply: function() {
        setBranchNode('post_career', 'assistant_coach', { identity: 'assistant_coach' });
        STATE.career.flags.postCareerIdentity = 'assistant_coach';
        addProfileDelta('lockerRoomTrust', 2);
        return '你穿着训练服走进教练组办公室，年轻球员以为你是来加练的。你笑了笑：今天开始，我教你们怎么加练。<br><br>效果：更衣室信任+2。';
      }},
      { label: '主教练', hint: '球队地位大幅提升，压力上升', lockHint: '需要领袖地位和足够的生涯荣誉', requires: function() {
        var tp = getBranchState('team_practice');
        var legacy = STATE.career.legacy || {};
        return getBranchNode('team_practice') === 'practice_identity' && (legacy.hof || legacy.jersey);
      }, apply: function() {
        setBranchNode('post_career', 'head_coach', { identity: 'head_coach' });
        STATE.career.flags.postCareerIdentity = 'head_coach';
        addProfileDelta('controversy', 1);
        addProfileDelta('lockerRoomTrust', 2);
        return '管理层把战术板交给你时，你第一反应是想拒绝。但你想起了自己教过的那些年轻人：这支球队需要一个人告诉他们怎么赢。<br><br>效果：争议+1；更衣室信任+2。';
      }},
      { label: '球队老板', hint: '商业价值上升，媒体压力上升', lockHint: '需要你已经在商业圈留下名字', requires: function() {
        return getBranchNode('network') === 'business_circle' || getBranchNode('rich_paul') === 'rich_paul_mapped';
      }, apply: function() {
        setBranchNode('post_career', 'team_owner', { identity: 'team_owner' });
        STATE.career.flags.postCareerIdentity = 'team_owner';
        addProfileDelta('businessValue', 3);
        addSeasonMod('mediaPressure', 2, -10, 10);
        return '你出现在收购谈判桌的另一边。球员时代你习惯别人报价，现在轮到你拍板。<br><br>效果：商业价值+3；媒体压力+2。';
      }},
      { label: '青训学院', hint: '球迷支持与历史评价上升', lockHint: '需要家人已经稳定下来', requires: function() {
        return getBranchNode('family') === 'family_settled' || (STATE.career.flags && STATE.career.flags.familyRetireTendency === 'family');
      }, apply: function() {
        setBranchNode('post_career', 'youth_academy', { identity: 'youth_academy' });
        STATE.career.flags.postCareerIdentity = 'youth_academy';
        addProfileDelta('fanSupport', 2);
        addProfileDelta('legacyBonus', 1);
        return '你把一座旧球馆改成了青训学院。孩子们喊你教练，也喊你叔叔。你终于明白，有些影响不会出现在技术统计里。<br><br>效果：球迷支持+2；历史评价+1。';
      }},
      { label: '中国男篮顾问', hint: '中国人气与历史评价上升', lockHint: '需要你在国家队留下传奇结局', requires: function() {
        var cn = getBranchNode('china_team');
        return cn === 'national_legend' || cn === 'national_mentor' || cn === 'honorable_exit';
      }, apply: function() {
        setBranchNode('post_career', 'china_consultant', { identity: 'china_consultant' });
        STATE.career.flags.postCareerIdentity = 'china_consultant';
        addProfileDelta('chinaPopularity', 3);
        addProfileDelta('legacyBonus', 1);
        return '国家队给你发了顾问聘书。训练馆里，你把当年那些最后一攻的录像放给年轻后卫看：这里，记住这里。<br><br>效果：中国人气+3；历史评价+1。';
      }},
      { label: '经纪公司合伙人', hint: '商业价值与媒体好感上升', lockHint: '需要你已经在职业版图里留下名字', requires: function() {
        return getBranchNode('rich_paul') === 'rich_paul_mapped' || getBranchNode('network') === 'business_circle';
      }, apply: function() {
        setBranchNode('post_career', 'agency_partner', { identity: 'agency_partner' });
        STATE.career.flags.postCareerIdentity = 'agency_partner';
        addProfileDelta('businessValue', 3);
        addProfileDelta('mediaTrust', 1);
        return '你坐在会议室里，看着年轻球员签下第一份合同。你比他们更清楚，这份合同背后有多少场比赛要打。<br><br>效果：商业价值+3；媒体好感+1。';
      }},
      { label: '自由篮球人', hint: '不受任何一方绑定，按自己的节奏走', apply: function() {
        setBranchNode('post_career', 'freelancer', { identity: 'freelancer' });
        STATE.career.flags.postCareerIdentity = 'freelancer';
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('fanSupport', 1);
        return '你没有签任何长约。偶尔客串解说，偶尔去青训营教小孩，偶尔出现在品牌活动里。所有人都在猜你下一步做什么，只有你知道：你没有下一步，你在过自己的日子。<br><br>效果：媒体好感+1；球迷支持+1；退役后身份以“自由篮球人”成型。';
      }}
    ]
  },
  {
    id: 'post_career_first_year',
    branch: 'post_career', phase: 'post_career', slot: 'main', weight: 10,
    title: '退役后：身份第一年',
    scenes: [
      '第一年很快，快到像又打了一个赛季。你学会了新身份的语言，也开始明白：站在场边比站在场上，看得更清楚，也扛得更重。'
    ],
    body: '身份成型不是终点，它会继续被你的选择塑造。',
    requires: function() {
      var node = getBranchNode('post_career');
      return node === 'commentator' || node === 'assistant_coach' || node === 'head_coach' || node === 'team_owner' || node === 'youth_academy' || node === 'china_consultant' || node === 'agency_partner' || node === 'freelancer';
    },
    choices: [
      { label: '站稳脚跟', hint: '长期深耕，身份成型', apply: function() {
        setBranchNode('post_career', 'identity_settled', { finalIdentity: STATE.career.flags.postCareerIdentity || 'commentator' });
        applyPostCareerIdentityDelta(2);
        return '第二年，你已经不需要别人介绍你是谁。新身份开始自己说话。<br><br>重点：退役后身份成型。<br><br>影响：对应身份主属性+2。';
      }},
      { label: '换一种方式', hint: '调整方向，保留人脉', apply: function() {
        setBranchNode('post_career', 'identity_adjusted', { finalIdentity: STATE.career.flags.postCareerIdentity || 'commentator' });
        addProfileDelta('controversy', -1);
        return '你发现这条路不完全适合自己，但没有退出圈子，而是换了个更舒服的位置。<br><br>重点：你选择调整，而不是消失。<br><br>影响：争议-1；状态稳定。';
      }},
      { label: '公开表达争议', hint: '影响力上升，争议上升', apply: function() {
        setBranchNode('post_career', 'identity_voice', { finalIdentity: STATE.career.flags.postCareerIdentity || 'commentator' });
        addProfileDelta('fame', 2);
        addProfileDelta('controversy', 2);
        return '你公开批评了联盟的一项规则。支持者说你敢说，反对者说你越界。但所有人都承认：你没有消失。<br><br>重点：你选择保持声音。<br><br>影响：人气+2；争议+2。';
      }}
    ]
  },
  {
    id: 'rich_paul_career_map',
    branch: 'rich_paul', phase: 'offseason', slot: 'main', weight: 12,
    title: '经纪团队：职业版图会议',
    scenes: [
      '会议室里没有战术板，只有城市、阵容、合同和未来十年的规划。',
      '对方问你：你想只做一个好球员，还是想管理一个更大的职业版图？'
    ],
    body: '这会影响你未来合同到期时看到的选项，也会改变媒体如何解读你的每一步。',
    requires: function() {
      var netNode = getBranchNode('network');
      return getBranchNode('rich_paul') === 'start' && (STATE.career.flags.richPaulContact || getBranchState('mentor').lastMentor === 'lebron' || netNode === 'career_map_meeting' || netNode === 'private_circle');
    },
    choices: [
      { label: '接受职业版图规划', hint: '商业和大市场机会提升，舆论压力也更大', apply: function() {
        setBranchNode('rich_paul', 'rich_paul_mapped', { status: 'mapped' });
        addProfileDelta('businessValue', 2);
        addProfileDelta('fame', 1);
        addSeasonMod('mediaPressure', 1, -10, 10);
        return '你没有立刻换团队，但你开始理解他们的语言：球队、城市、品牌、窗口期，全都可以放在同一张图里。<br><br>重点：你的职业生涯开始被当成一个长期项目来经营。<br><br>影响：商业价值上升；未来自由市场会出现更激进的选择；媒体压力略升。';
      }},
      { label: '保留现有团队', hint: '稳定优先，商业增长较慢', apply: function() {
        setBranchNode('rich_paul', 'rich_paul_stable', { status: 'stable_team' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你感谢了他们的计划，但没有马上改变身边的人。离开会议室时，你反而觉得轻松了一点。<br><br>重点：你选择让篮球先于版图，至少现在如此。<br><br>影响：状态更稳定；媒体好感略升；商业扩张速度放缓。';
      }}
    ]
  },
  {
    id: 'network_free_agency_eve',
    branch: 'network', phase: 'offseason', slot: 'main', weight: 14,
    title: '人脉线：自由市场前夜',
    scenes: [
      '自由市场开始前一晚，你的手机没有停过。有人谈城市，有人谈阵容，有人谈冠军，也有人只谈你能成为谁。',
      '经纪团队把三份方案放在桌上：忠诚、权力、冠军。'
    ],
    body: '你的选择会决定下一段职业生涯的形态，也会决定未来几年你会在哪座城市、为什么而战。',
    requires: function() {
      var contract = (STATE.career && STATE.career.contract) || 4;
      var contact = !!(STATE.career && STATE.career.flags && STATE.career.flags.richPaulContact);
      return getBranchNode('rich_paul') === 'rich_paul_mapped' || (getBranchNode('network') === 'business_circle' && contract <= 1) || (contact && contract <= 1);
    },
    choices: [
      { label: '留守母队，要求补强', hint: '队史评价上升，冠军不确定', apply: function() {
        STATE.career.flags.freeAgentChoice = 'stay';
        addProfileDelta('fanSupport', 2);
        addProfileDelta('legacyBonus', 1);
        addProfileDelta('mediaTrust', 1);
        setBranchNode('network', 'stay_team', { status: 'stay' });
        return '你没有接听任何球队的电话，先给管理层发了一条消息：把阵容修好，我留在这里打到底。<br><br>重点：你选择忠诚。<br><br>影响：球迷支持+2；历史评价+1；媒体好感+1。';
      }},
      { label: '加盟争冠球队', hint: '冠军概率上升，忠诚评价下降', apply: function() {
        STATE.career.flags.freeAgentChoice = 'contender';
        addSeasonMod('moraleBonus', 1, -10, 10);
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        setBranchNode('network', 'join_contender', { status: 'contender' });
        return '你选了那支能立刻夺冠的球队。发布会很热闹，但老球迷的眼神里多了一点复杂。<br><br>重点：你选择冠军。<br><br>影响：士气+1；人气+1；争议+1。';
      }},
      { label: '选择大市场球队', hint: '商业上升，舆论压力上升', apply: function() {
        STATE.career.flags.freeAgentChoice = 'market';
        addProfileDelta('businessValue', 3);
        addSeasonMod('mediaPressure', 2, -10, 10);
        setBranchNode('network', 'big_market', { status: 'market' });
        return '你签下了更大的城市、更大的媒体和市场。球馆更大，聚光灯也更刺眼。<br><br>重点：你选择权力。<br><br>影响：商业价值+3；媒体压力+2。';
      }},
      { label: '签短约保持自由', hint: '自由度上升，稳定性下降', apply: function() {
        STATE.career.flags.freeAgentChoice = 'short';
        addSeasonMod('formVariance', 1, -10, 10);
        setBranchNode('network', 'short_deal', { status: 'short' });
        return '你只签了一年。所有人都知道，你不想被任何一座城市锁住。<br><br>重点：你选择自由。<br><br>影响：下赛季状态波动略升。';
      }}
    ]
  },
  {
    id: 'teammate_after_hours',
    branch: 'teammate_bond', phase: 'season', slot: 'main', weight: 9,
    title: '队友：训练结束后的球',
    scenes: [
      '训练结束后，你看见{队友}还留在底角加练。你把包放回更衣柜，走回场上：再跑十组？',
      '你本来已经准备回更衣室，最后还是把球传了过去。'
    ],
    body: '有些关系不是在比赛里建立的，而是在空馆里一次次重复。',
    requires: function() {
      var tp = getBranchNode('team_practice');
      return getBranchNode('teammate_bond') === 'start'
        && ['practice_start','practice_response','practice_mentor','practice_identity'].indexOf(tp) >= 0;
    },
    choices: [
      { label: '留下加练', hint: '默契和队友关系提升', apply: function() {
        bindBondedTeammate();
        setBranchNode('teammate_bond', 'bond_extra', { status: 'extra_work' });
        addProfileDelta('lockerRoomTrust', 2);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '你们没有聊太多，只是一遍遍跑同一个战术。后来比赛里，{队友}提前半步移动，你甚至不用看就把球传了出去。<br><br>重点：你和{队友}开始形成真正的场上默契。<br><br>影响：球队默契上升；更衣室信任上升。';
      }},
      { label: '提醒他别过度', hint: '关系温和提升，风险更低', apply: function() {
        bindBondedTeammate();
        setBranchNode('teammate_bond', 'bond_protected', { status: 'protected' });
        addProfileDelta('lockerRoomTrust', 1);
        addSeasonMod('injuryRiskBonus', -1, -4, 8);
        return '你把球收起来，说今天够了。{队友}愣了一下，最后点点头。第二天，他还是第一个到，但不再硬撑。<br><br>重点：你不是只想赢下一场训练，你开始照顾队友的长赛季。<br><br>影响：更衣室信任上升；下赛季伤病风险略降。';
      }},
      { label: '让助教安排计划', hint: '把加练变得可持续', apply: function() {
        bindBondedTeammate();
        setBranchNode('teammate_bond', 'bond_planned', { status: 'planned' });
        addProfileDelta('lockerRoomTrust', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你拉上助教把十组改成一整套计划：热身、对抗、录像、恢复。{队友}笑着说，跟你练比打比赛还累。<br><br>重点：你让加练变得可持续。<br><br>影响：更衣室信任上升；状态波动略降。';
      }}
    ]
  },
  {
    id: 'teammate_court_chemistry',
    branch: 'teammate_bond', phase: 'season', slot: 'main', weight: 11,
    title: '队友：场上默契',
    scenes: [
      '有些配合不需要喊。你刚过半场，{队友}已经往那个位置移动。防守人还没反应过来，球已经到了。'
    ],
    body: '你要把这份默契塑造成什么形态？',
    requires: function() {
      var node = getBranchNode('teammate_bond');
      return node === 'bond_extra' || node === 'bond_protected' || node === 'bond_planned';
    },
    choices: [
      { label: '增加双人战术', hint: '助攻和球队配合提升', apply: function() {
        setBranchNode('teammate_bond', 'bond_duo', { bondType: 'duo' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '教练把你们俩单独拉去战术室，画了七套双人配合。从那以后，你和{队友}的名字开始被写在同一行。<br><br>效果：传球+1；球队默契+1。';
      }},
      { label: '让他承担更多球权', hint: '队友成长，关系更信任', apply: function() {
        setBranchNode('teammate_bond', 'bond_share', { bondType: 'share' });
        STATE.career.flags.teammateGrowth = true;
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '你主动把一些回合让给{队友}发起。他第一次打出生涯新高时，赛后第一件事是找你撞胸。<br><br>效果：球队默契+1；队友成长。';
      }},
      { label: '关键时刻自己接管', hint: '关键球提升，关系偏依赖', apply: function() {
        setBranchNode('teammate_bond', 'bond_own', { bondType: 'own' });
        addAttrDelta('CLU', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        return '越到关键回合，球越习惯回到你手里。{队友}没有怨言，只是偶尔在训练时多练一点接球。<br><br>效果：关键球+1。';
      }}
    ]
  },
  {
    id: 'teammate_slump',
    branch: 'teammate_bond', phase: 'season', slot: 'main', weight: 12,
    title: '队友：队友低谷',
    scenes: [
      '{队友}连续几场投不进，采访区的问题越来越尖。你主动去更衣室找他，把那些问题挡在门外。他一个人坐在柜子前，鞋带解了一半。'
    ],
    body: '低谷是关系最真实的检验。',
    requires: function() {
      var node = getBranchNode('teammate_bond');
      return node === 'bond_duo' || node === 'bond_share' || node === 'bond_own';
    },
    choices: [
      { label: '公开力挺', hint: '媒体形象和队友关系提升', apply: function() {
        setBranchNode('teammate_bond', 'bond_public', { status: 'public' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('lockerRoomTrust', 1);
        return '你在采访里说：{队友}的问题不是手感，是运气。更衣室里有人笑，他低着头，但你看见他肩膀松了下来。<br><br>效果：媒体好感+1；更衣室信任+1。';
      }},
      { label: '私下谈话', hint: '关系最深，最安静', apply: function() {
        setBranchNode('teammate_bond', 'bond_private', { status: 'private' });
        addProfileDelta('lockerRoomTrust', 2);
        return '你没有提数据，只问了一句：要不要一起看录像。{队友}沉默了很久，最后说：好。<br><br>效果：更衣室信任+2。';
      }},
      { label: '用比赛给他找手感', hint: '传球和球队配合提升', apply: function() {
        setBranchNode('teammate_bond', 'bond_feel', { status: 'feel' });
        addAttrDelta('PAS', 1); STATE.finalOVR = calcOVR(STATE.attrs);
        addSeasonMod('teamChemistry', 1, -10, 10);
        return '接下来的三场，你不断把球送到{队友}最舒服的位置。他找回手感那天，冲你点了点头，什么都没说。<br><br>效果：传球+1；球队默契+1。';
      }},
      { label: '不介入', hint: '专注自己，关系保持距离', apply: function() {
        setBranchNode('teammate_bond', 'bond_passive', { status: 'passive' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你相信职业球员能自己走出来。{队友}没有怪你，但那天之后，你们的对话少了一些。<br><br>效果：状态波动-1；关系温度下降。';
      }}
    ]
  },
  {
    id: 'teammate_departure',
    branch: 'teammate_bond', phase: 'season', slot: 'main', weight: 10,
    title: '队友：离队或留下',
    scenes: [
      '自由市场前，你主动给{队友}打了电话：别让流言替我们说话，我想听你亲口说。'
    ],
    body: '这段羁绊要如何收场，会决定你们未来还会不会一起打球。',
    requires: function() {
      var node = getBranchNode('teammate_bond');
      var status = getBondedTeammateStatus();
      var afterSlump = node === 'bond_public' || node === 'bond_private' || node === 'bond_feel' || node === 'bond_passive';
      var mid = node === 'bond_extra' || node === 'bond_protected' || node === 'bond_planned' || node === 'bond_duo' || node === 'bond_share' || node === 'bond_own';
      return afterSlump || (mid && (status === 'traded' || status === 'retired_released'));
    },
    choices: [
      { label: '劝他留下', hint: '争取留队，关系更深', apply: function() {
        setBranchNode('teammate_bond', 'bond_stay', { status: 'stay' });
        STATE.career.flags.teammateStayed = true;
        addProfileDelta('lockerRoomTrust', 1);
        return '你直接给{队友}打了电话：留下，我们再试一次。他在电话那头停了几秒，说：好。<br><br>效果：更衣室信任+1；flag teammateStayed = true。';
      }},
      { label: '尊重他的决定', hint: '体面告别，媒体好感上升', apply: function() {
        setBranchNode('teammate_bond', 'bond_leave', { status: 'leave' });
        addProfileDelta('mediaTrust', 1);
        return '你说：去哪都行，别让自己后悔。{队友}走那天，你们没有告别仪式，只是互相拍了拍肩膀。<br><br>效果：媒体好感+1。';
      }},
      { label: '邀请未来重聚', hint: '约定未来重逢，历史会记住这段情谊', apply: function() {
        setBranchNode('teammate_bond', 'bond_reunite', { status: 'reunite' });
        STATE.career.flags.teammateReunion = true;
        addProfileDelta('legacyBonus', 1);
        return '你说：不管你去哪，等你合同到期，我们再一起打一年。{队友}笑了：这句话我会记住。<br><br>效果：历史评价+1；flag teammateReunion = true。';
      }}
    ]
  },
  {
    id: 'crossover_invite',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 12,
    title: '揽佬 · 中国人能飞：邀约',
    scenes: [
      '休赛期刚过一半，揽佬的团队打来电话：新歌《中国人能飞》的演唱会，想请你当嘉宾。电话那头没先聊档期，只问了一句——你相信这首歌是写给你的吗。'
    ],
    body: '你决定要不要站上那个舞台。',
    requires: function() {
      var c = STATE.career || {};
      var profile = c.profile || {};
      return getBranchNode('crossover') === 'start'
        && ((c.currentAge || 22) <= 25) // 25 岁后失去进入机会
        && (getBranchNode('media') !== 'start' || (profile.fame || 0) >= 6 || getBranchNode('china_market') === 'shoe_settled');
    },
    choices: [
      { label: '答应，去唱《中国人能飞》', hint: '彩排、舞台，把这首歌替你唱完', apply: function() {
        setBranchNode('crossover', 'concert_pick', { status: 'accepted' });
        addProfileDelta('fame', 1);
        return '你在电话里说：来。揽佬那边安静了一秒，然后笑着说：我就知道你会答应。<br><br>重点：你决定把篮球之外的第一个舞台，交给这首歌。<br><br>影响：人气+1；下一步进入演唱会彩排。';
      }},
      { label: '婉拒，专注训练', hint: '把邀约放进抽屉，夏天留给球馆', apply: function() {
        setBranchNode('crossover', 'declined', { status: 'declined' });
        addAttrDelta('ATH', 1);
        STATE.finalOVR = calcOVR(STATE.attrs);
        return '你回了一条很短的感谢，然后把手机交给训练师保管。训练馆里没有舞台，但你听了一晚上《中国人能飞》。<br><br>影响：运动+1；你暂时选择了球馆。';
      }}
    ]
  },
  {
    id: 'concert_rehearsal',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 10,
    title: '揽佬 · 中国人能飞：演唱会彩排',
    scenes: [
      '排练室里只有你和揽佬。他放了一遍《中国人能飞》，放到那句歌词时把音乐停了，看着你说：这句你来唱，台下的人会更信。',
      '你第一次觉得，唱歌不是表演，是替很多人把一句话喊出来。'
    ],
    body: '你要用哪种方式准备这次登台？',
    requires: function() { return getBranchNode('crossover') === 'concert_pick'; },
    choices: [
      { label: '认真彩排', hint: '把每一遍都走完整，状态最稳', apply: function() {
        setBranchNode('crossover', 'rehearsal_done', { prep: 'serious' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你让乐队把同一个段落走了十二遍。揽佬说：够了。你说：再一遍。<br><br>影响：下赛季状态波动略降。';
      }},
      { label: '随性发挥', hint: '把排练室当野球场，凭感觉来', apply: function() {
        setBranchNode('crossover', 'rehearsal_done', { prep: 'free' });
        addSeasonMod('formVariance', 1, -10, 10);
        return '你没有按台本练，唱到一半还自己改了节奏。揽佬笑：你这不是彩排，是来抢歌的。<br><br>影响：舞台更有个人色彩；下赛季状态波动略升。';
      }},
      { label: '让团队把关', hint: '先录一遍，反复听哪里不够好', apply: function() {
        setBranchNode('crossover', 'rehearsal_done', { prep: 'team' });
        addProfileDelta('mediaTrust', 1);
        return '你录完一遍，和团队对着回放听了一下午。他们说已经够好了，你点头，然后又要了一次录音。<br><br>影响：媒体好感+1。';
      }}
    ]
  },
  {
    id: 'concert_stage',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 10,
    title: '揽佬 · 中国人能飞：演唱会登台',
    scenes: [
      '灯光暗下来，几万人的场馆安静了一瞬。前奏响起，揽佬在台上喊你的名字，大屏幕切到你。',
      '你看见看台上有孩子举着你的球衣，也举着手电筒。你站到麦架前，忽然明白那句歌词为什么能让人哭。'
    ],
    body: '这首歌，你要怎么唱给台下的人听？',
    requires: function() { return getBranchNode('crossover') === 'rehearsal_done'; },
    choices: [
      { label: '合唱《中国人能飞》', hint: '把歌词唱稳，也把现场唱热', apply: function() {
        setBranchNode('crossover', 'stage_done', { stage: 'sing' });
        addProfileDelta('fanSupport', 2);
        addProfileDelta('fame', 1);
        return '你和揽佬一人一句，唱到那句时，全场跟着一起喊。你没有看提词器，因为这句话你早就想喊了。<br><br>影响：球迷支持+2；人气+1。';
      }},
      { label: '扣篮舞台版', hint: '唱到那句时接球扣进临时篮筐，最炸', apply: function() {
        setBranchNode('crossover', 'stage_done', { stage: 'dunk' });
        addProfileDelta('fame', 3);
        addProfileDelta('controversy', 1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '唱到“中国人能飞”时，工作人员把球抛上来。你接住，起跳，扣进台上临时架起的小篮筐。那一刻，场馆是真的炸了。<br><br>影响：人气+3；争议+1；下赛季状态波动略升。';
      }},
      { label: '玩梗自嘲', hint: '把“球员唱歌”这个梗接住，主动笑自己', apply: function() {
        setBranchNode('crossover', 'stage_done', { stage: 'meme' });
        addProfileDelta('fanSupport', 1);
        addProfileDelta('fame', 2);
        addProfileDelta('mediaTrust', -1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你在台上先说：我唱歌和打球一样，全凭感觉。台下笑成一片，然后你认真把歌唱完了。<br><br>影响：球迷支持+1；人气+2；媒体好感-1；下赛季状态波动略升。';
      }}
    ]
  },
  {
    id: 'crossover_aftermath',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 10,
    title: '揽佬 · 中国人能飞：当晚反响',
    scenes: [
      '热搜第一是“中国人能飞 篮球版”。有人剪了你彩排时反复练同一句的画面，说这是今年最诚实的舞台。',
      '也有人问，他到底还打不打球。你刷到一条评论：我妈第一次看篮球，看到哭。'
    ],
    body: '热度来了，你决定怎么接住它？',
    requires: function() { return getBranchNode('crossover') === 'stage_done'; },
    choices: [
      { label: '高调接住', hint: '转发热搜，认真说一句谢谢', apply: function() {
        setBranchNode('crossover', 'aftermath_done', { after: 'proud' });
        addProfileDelta('fame', 2);
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你转发了那条“篮球版”的视频，只写了一句：谢谢揽佬，谢谢这首歌。评论区安静了一瞬，然后更热闹了。<br><br>影响：人气+2；媒体好感+1；下赛季状态波动略升。';
      }},
      { label: '低调消化', hint: '不回应，让讨论自然过去', apply: function() {
        setBranchNode('crossover', 'aftermath_done', { after: 'quiet' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你没有回复任何热搜。第二天早上，你准时出现在训练馆。有人把热搜拿给你看，你说：等练完再说。<br><br>影响：下赛季状态波动略降。';
      }},
      { label: '发段子自嘲', hint: '自己开楼，把节奏握在手里', apply: function() {
        setBranchNode('crossover', 'aftermath_done', { after: 'meme' });
        addProfileDelta('fanSupport', 2);
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你发了一条：练习时长两小时的球员歌手，请多包涵。底下全是哈哈哈，也有人开始认真讨论你的舞台。<br><br>影响：球迷支持+2；人气+1；争议+1。';
      }}
    ]
  },
  {
    id: 'crossover_close',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 10,
    title: '揽佬 · 中国人能飞：演唱会收束',
    scenes: [
      '演唱会结束，揽佬在后台叫住你：以后每年，我都给你留一首。',
      '你回到训练馆，把那天的门票夹进更衣柜，然后开始投篮。'
    ],
    body: '这个夏天留下的约定，你要怎么回答？',
    requires: function() { return getBranchNode('crossover') === 'aftermath_done'; },
    choices: [
      { label: '答应每年都来', hint: '和揽佬定下每年之约', apply: function() {
        setBranchNode('crossover', 'legacy_every_year', { legacy: 'every_year' });
        STATE.career.flags.crossoverIdentity = 'every_year';
        STATE.career.flags.crossoverDone = true;
        addProfileDelta('fanSupport', 2);
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('businessValue', 1);
        return '你说：好，每年都给我留一句。揽佬伸手，你们像队友一样击掌。回到训练馆，你练得更狠了，因为你知道夏天还有另一个舞台。<br><br>影响：球迷支持+2；媒体好感+1；商业价值+1。';
      }},
      { label: '只此一次', hint: '把这一晚当成最好的告别', apply: function() {
        setBranchNode('crossover', 'legacy_once', { legacy: 'once' });
        STATE.career.flags.crossoverIdentity = 'once';
        STATE.career.flags.crossoverDone = true;
        addProfileDelta('fame', 1);
        addSeasonMod('formVariance', -1, -10, 10);
        return '你笑着摇头：这一晚很值，但我想把它留成唯一。揽佬没有劝你，只是把那首歌的歌词本递给你。<br><br>影响：人气+1；下赛季状态波动略降。';
      }},
      { label: '以后再说', hint: '留个念想，不急着答应', apply: function() {
        setBranchNode('crossover', 'legacy_open', { legacy: 'open' });
        STATE.career.flags.crossoverIdentity = 'open';
        STATE.career.flags.crossoverDone = true;
        addProfileDelta('fanSupport', 1);
        return '你说：先让我把下一个赛季打好。揽佬点头：行，我等你。那张门票你一直夹在更衣柜里。<br><br>影响：球迷支持+1。';
      }}
    ]
  },
  {
    id: 'crossover_second_chance',
    branch: 'crossover', phase: 'offseason', slot: 'main', weight: 8,
    title: '揽佬 · 中国人能飞：第二次邀约',
    scenes: ['一年后，揽佬托人带来一句话：上次的邀请还在。《中国人能飞》改版了，第二句我想让你唱。'],
    body: '机会又来了，这次你怎么选？',
    requires: function() {
      var c = STATE.career || {};
      var profile = c.profile || {};
      return getBranchNode('crossover') === 'declined' && (profile.fame || 0) >= 8;
    },
    choices: [
      { label: '这次答应', hint: '进入演唱会彩排', apply: function() {
        setBranchNode('crossover', 'concert_pick', { status: 'accepted_again' });
        addProfileDelta('fame', 1);
        return '你拨通了那通早就该拨的电话。揽佬接起来第一句：我就知道你会回来。<br><br>影响：人气+1；下一步进入演唱会彩排。';
      }},
      { label: '继续婉拒', hint: '彻底留在篮球这一侧', apply: function() {
        setBranchNode('crossover', 'declined', { status: 'declined' });
        addSeasonMod('formVariance', -1, -10, 10);
        return '你说：替我谢谢揽佬，这个夏天我还是想在球馆里。电话那头没有失望，只说：那歌我给你留着。<br><br>影响：下赛季状态波动略降。';
      }}
    ]
  },
  {
    id: 'transfer_settle',
    branch: 'transfer', phase: 'offseason', slot: 'main', weight: 14,
    title: '转会风波：新城市',
    body: '换一支球队，不只是换球衣。这座城市、球迷、训练馆、更衣室的规矩，都要重新学一遍。',
    requires: function() {
      var n = getBranchNode('transfer');
      return n === 'transfer_start' || n === 'transfer_resentment';
    },
    choices: [
      { label: '低调融入', hint: '先熟悉环境，再谈表现', apply: function() {
        setBranchNode('transfer', 'transfer_settle_low', { status: 'low' });
        addProfileDelta('coachTrust', 1);
        return '你提前一小时到训练馆，把每个柜子、每台器材的位置都记下来。新队友还没记住你的名字，但开始习惯了你的脚步声。<br><br>效果：教练信任+1。';
      }},
      { label: '高调登场', hint: '让新城市第一时间记住你', apply: function() {
        setBranchNode('transfer', 'transfer_settle_high', { status: 'high' });
        addProfileDelta('fame', 1);
        addProfileDelta('controversy', 1);
        return '你在首场公开训练里打出几记好球，社交媒体立刻剪出了你的集锦。有人觉得这是态度，有人觉得太高调。<br><br>效果：人气+1；争议+1。';
      }},
      { label: '保留旧队情谊', hint: '先赢得尊重，再谈亲近', apply: function() {
        setBranchNode('transfer', 'transfer_settle_old', { status: 'old' });
        addProfileDelta('loyalty', 1);
        addProfileDelta('fanSupport', 1);
        return '你没有刻意讨好谁，只是在更衣室提起老队友时语气正常。新队友们反而先向你伸出手。<br><br>效果：忠诚+1；球迷支持+1。';
      }}
    ]
  },
  {
    id: 'transfer_identity',
    branch: 'transfer', phase: 'offseason', slot: 'main', weight: 13,
    title: '转会风波：新队角色',
    body: '教练在训练后把你叫住，说要谈谈新赛季的计划。他知道你经历过什么，所以把话问得很直接：你想在这里成为什么？',
    requires: function() {
      var n = getBranchNode('transfer');
      return n === 'transfer_settle_low' || n === 'transfer_settle_high' || n === 'transfer_settle_old';
    },
    choices: [
      { label: '证明自己', hint: '争取更多球权', apply: function() {
        setBranchNode('transfer', 'transfer_identity_prove', { status: 'prove' });
        addProfileDelta('mediaTrust', 1);
        addSeasonMod('formVariance', 1, -10, 10);
        return '你说：我不是来过渡的，我是来让这里变得更好的。教练没有立刻答应，但训练赛里给了你更多回合。<br><br>效果：媒体好感+1；状态波动+1。';
      }},
      { label: '接受角色', hint: '先站稳，再谈野心', apply: function() {
        setBranchNode('transfer', 'transfer_identity_role', { status: 'role' });
        addProfileDelta('coachTrust', 2);
        return '你说：球队需要我做什么，我就做好什么。教练点头，在新赛季计划里写下了你的名字。<br><br>效果：教练信任+2。';
      }},
      { label: '和教练谈定位', hint: '把话摊开说', apply: function() {
        setBranchNode('transfer', 'transfer_identity_talk', { status: 'talk' });
        addProfileDelta('mediaTrust', 1);
        addProfileDelta('coachTrust', -1);
        return '你问了上场时间、战术地位和球权分配。教练回答得很坦率，但更衣室很快知道你很在意这些。<br><br>效果：媒体好感+1；教练信任-1。';
      }}
    ]
  },
  {
    id: 'transfer_close',
    branch: 'transfer', phase: 'offseason', slot: 'main', weight: 12,
    title: '转会风波：留下来，还是继续走',
    body: '一个夏天过去，你已经能叫出这座城市大部分球迷的口头禅。经纪人打来电话：下赛季，你想把哪里当作家？',
    requires: function() {
      var n = getBranchNode('transfer');
      return n === 'transfer_identity_prove' || n === 'transfer_identity_role' || n === 'transfer_identity_talk';
    },
    choices: [
      { label: '这里成为家', hint: '长期留队，加深城市羁绊', apply: function() {
        setBranchNode('transfer', 'transfer_close_home', { status: 'home' });
        addProfileDelta('loyalty', 1);
        addProfileDelta('fanSupport', 2);
        return '你在休赛期留在这座城市训练，参加社区的开放日。球迷开始把你的名字和这里连在一起。<br><br>效果：忠诚+1；球迷支持+2。';
      }},
      { label: '继续漂泊', hint: '保持机动，等待更大的舞台', apply: function() {
        setBranchNode('transfer', 'transfer_close_roam', { status: 'roam' });
        addProfileDelta('mediaTrust', 1);
        return '你没有买房，也没有急着表态。经纪人说：这样更自由。你点了点头：自由，也要自己挣。<br><br>效果：媒体好感+1。';
      }},
      { label: '等待争冠窗口', hint: '关注强队的动态', apply: function() {
        setBranchNode('transfer', 'transfer_close_window', { status: 'window' });
        addProfileDelta('businessValue', 1);
        return '你让经纪人盯着几支争冠球队的名单。不是想走，而是想让自己始终出现在名单上。<br><br>效果：商业价值+1。';
      }}
    ]
  },
];

const OFFSEASON_EVENTS = getBranchEventSource().filter(function(ev) {
  return getEventPhases(ev).indexOf('offseason') >= 0;
});

