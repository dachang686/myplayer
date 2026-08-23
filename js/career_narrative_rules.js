// 退役、传记和历史文案的事实条件池。
// 文案只有在 requires/forbids 与 CareerSummary 对齐后才允许进入候选池。
(function(root) {
  'use strict';

  function number(value) {
    var result = Number(value);
    return isFinite(result) ? result : 0;
  }

  function normalizeFacts(input) {
    var source = input || {};
    var facts = Object.assign({}, source);
    facts.championships = number(source.championships != null ? source.championships : source['总冠军']);
    facts.mvp = number(source.mvp != null ? source.mvp : source['MVP']);
    facts.fmvp = number(source.fmvp != null ? source.fmvp : source['FMVP']);
    facts.dpoy = number(source.dpoy != null ? source.dpoy : source['DPOY']);
    facts.allLeague = number(source.allLeague != null ? source.allLeague : source['最佳阵容']);
    facts.allStar = number(source.allStar != null ? source.allStar : source['全明星']);
    facts.teamsPlayed = number(source.teamsPlayed != null ? source.teamsPlayed : source.teamCount != null ? source.teamCount : source['球队数']);
    facts.oneTeamCareer = source.oneTeamCareer != null ? !!source.oneTeamCareer : facts.teamsPlayed <= 1;
    facts.majorInjury = source.majorInjury != null ? !!source.majorInjury : !!source.hadMajorInjury;
    facts.wasTraded = source.wasTraded != null ? !!source.wasTraded : false;
    facts.hasRival = source.hasRival != null ? !!source.hasRival : !!source.hasRivalry;
    facts.finalsAppearances = number(source.finalsAppearances);
    facts.hof = !!source.hof;
    facts.top100 = !!source.top100;
    facts.goat = !!source.goat;
    return facts;
  }

  function readFact(facts, key) {
    if (Object.prototype.hasOwnProperty.call(facts, key)) return facts[key];
    return false;
  }

  function matchesObject(requirements, facts, mode) {
    var keys = Object.keys(requirements || {});
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var expected = requirements[key];
      var factKey = key.replace(/(Min|Max)$/, '');
      var actual = readFact(facts, factKey);
      var pass;
      if (/Min$/.test(key)) pass = number(actual) >= number(expected);
      else if (/Max$/.test(key)) pass = number(actual) <= number(expected);
      else if (typeof expected === 'number') pass = number(actual) === expected;
      else if (typeof expected === 'boolean') pass = !!actual === expected;
      else pass = actual === expected;
      if (!pass) return false;
    }
    return mode === 'any' ? keys.length > 0 : true;
  }

  function matches(entry, inputFacts) {
    var facts = normalizeFacts(inputFacts);
    var rule = entry || {};
    var requiresAll = rule.requiresAll || [];
    var requiresAny = rule.requiresAny || [];
    var forbids = rule.forbids || [];
    if (requiresAll.some(function(key) { return !readFact(facts, key); })) return false;
    if (requiresAny.length && !requiresAny.some(function(key) { return !!readFact(facts, key); })) return false;
    if (Array.isArray(forbids)) {
      if (forbids.some(function(key) { return !!readFact(facts, key); })) return false;
    } else if (!matchesObject(forbids, facts)) {
      return false;
    }
    return matchesObject(rule.requires, facts);
  }

  var copy = {
    retirement: [
      { id: 'retirement_fact_01', text: '你把{seasonsCount}个赛季、{games}场常规赛和一段完整的职业记录交给了篮球。今天的告别，不需要补写任何没有发生过的故事。' },
      { id: 'retirement_champion_01', text: '你曾经真正赢得过{championships}座总冠军。奖杯属于档案，属于你的则是每个赛季留下的比赛。', requires: { championshipsMin: 1 } },
      { id: 'retirement_no_ring_01', text: '你的档案里没有总冠军，但有{seasonsCount}个赛季、{games}场常规赛和一条没有被奖杯概括的路。', requires: { championships: 0 } },
      { id: 'retirement_injury_01', text: '生涯里确实有过重大伤病和重新回到球场的阶段。那些记录属于你的经历，也让这次告别多了一层重量。', requires: { majorInjury: true } },
      { id: 'retirement_trade_01', text: '你确实经历过球队变动。每一次换队都留在生涯路线里，最后连成了真实走过的{teamsPlayed}站。', requires: { wasTraded: true, teamsPlayedMin: 2 } },
      { id: 'retirement_rival_01', text: '档案里确实留下过宿敌与对手的交锋。告别时回望，那些对抗也是生涯的一部分。', requires: { hasRival: true } },
      { id: 'retirement_one_team_01', text: '你把整段职业生涯留在{longestTeam}。没有辗转多城的注脚，只有一支球队和一段可以核对的共同历史。', requiresAll: ['oneTeamCareer'] },
      { id: 'retirement_multi_team_01', text: '你的生涯确实经过{teamsPlayed}支球队。每一站的比赛记录都在档案里，告别因此带着不同城市的回声。', requires: { teamsPlayedMin: 2 } }
    ],
    hof: [
      { id: 'hof_fact_01', text: '名人堂记录收下的不是传说，而是{games}场常规赛、{points}分和一整段可以回看的职业生涯。', requires: { hof: true } },
      { id: 'hof_champion_01', text: '你带着{championships}座总冠军进入名人堂。它们是生涯事实，不需要再添任何未经记录的细节。', requires: { hof: true, championshipsMin: 1 } },
      { id: 'hof_defense_01', text: '你的档案里有{dpoy}次DPOY。名人堂记住的不只是次数，也包括每个赛季真实留下的防守影响。', requires: { hof: true, dpoyMin: 1 } },
      { id: 'hof_one_team_01', text: '你在{longestTeam}完成了整段旅程。名人堂把这段一人一城的事实与其他荣誉放在同一页。', requires: { hof: true, oneTeamCareer: true } },
      { id: 'hof_multi_team_01', text: '你为{teamsPlayed}支球队留下过正式比赛记录。名人堂收录的是这些可核对的章节。', requires: { hof: true, teamsPlayedMin: 2 } }
    ],
    hofFail: [
      { id: 'hof_fail_fact_01', text: '这次名人堂投票没有写下你的名字，但你的{games}场常规赛和{points}分仍然留在联盟档案里。', requires: { hof: false } },
      { id: 'hof_fail_no_ring_01', text: '你没有进入名人堂，也没有总冠军。生涯的重量仍然来自真实打过的比赛，而不是后来补上的传说。', requires: { hof: false, championships: 0 } },
      { id: 'hof_fail_injury_01', text: '名人堂没有改变投票结果，但你的重大伤病记录和回到球场的过程确实发生过。', requires: { hof: false, majorInjury: true } }
    ],
    top100: [
      { id: 'top100_fact_01', text: '历史百大收录了你的名字。档案依据的是{seasonsCount}个赛季、{games}场常规赛和实际荣誉。', requires: { top100: true } },
      { id: 'top100_champion_01', text: '你的历史档案同时记录了{championships}座总冠军。奖杯与比赛记录彼此对应。', requires: { top100: true, championshipsMin: 1 } },
      { id: 'top100_dpoy_01', text: '你有{dpoy}次DPOY，历史百大把这项真实荣誉写进了你的防守履历。', requires: { top100: true, dpoyMin: 1 } },
      { id: 'top100_one_team_01', text: '你的一人一城经历属于{longestTeam}，这份球队事实也进入了历史档案。', requires: { top100: true, oneTeamCareer: true } },
      { id: 'top100_multi_team_01', text: '你在{teamsPlayed}支球队留下正式记录，历史百大收录了这条完整路线。', requires: { top100: true, teamsPlayedMin: 2 } }
    ],
    top100Fail: [
      { id: 'top100_fail_fact_01', text: '历史百大没有写下你的名字，但你的常规赛数据、球队经历和荣誉仍然可以逐项核对。', requires: { top100: false } },
      { id: 'top100_fail_no_ring_01', text: '你没有进入历史百大，也没有总冠军。没有奖杯不等于没有生涯，档案只记录真实发生过的比赛。', requires: { top100: false, championships: 0 } },
      { id: 'top100_fail_trade_01', text: '历史百大没有收录你，但档案确实记录了你经历过的球队变动。', requires: { top100: false, wasTraded: true } }
    ],
    goat: [
      { id: 'goat_fact_01', text: '你用{mvp}次MVP、{championships}座总冠军和{fmvp}次FMVP完成了GOAT级别的正式记录。', requires: { goat: true, mvpMin: 1, championshipsMin: 1 } },
      { id: 'goat_route_01', text: 'GOAT不是一句空泛的赞美：{seasonsCount}个赛季、{games}场常规赛和一整排可核对的荣誉共同构成了这份答案。', requires: { goat: true } }
    ],
    biography: {
      title: [
        { id: 'bio_title_fact', text: '{姓名}：用{赛季数}年和真实比赛记录写完自己的生涯' },
        { id: 'bio_title_champion', text: '{姓名}：{冠军线}，奖杯与岁月都留在档案里', requires: { championshipsMin: 1 } },
        { id: 'bio_title_no_ring', text: '{姓名}：没有总冠军，也有一段完整的竞争生涯', requires: { championships: 0 } },
        { id: 'bio_title_one_team', text: '{姓名}：把整段旅程留在一支球队', requiresAll: ['oneTeamCareer'] },
        { id: 'bio_title_multi_team', text: '{姓名}：在{球队数}支球队留下正式比赛记录', requires: { teamsPlayedMin: 2 } }
      ],
      lead: [
        { id: 'bio_lead_fact', text: '回看{姓名}的生涯，最可靠的线索是{赛季数}个赛季、{场次}场常规赛，以及每一年留下的球队和荣誉记录。' },
        { id: 'bio_lead_champion', text: '你确实赢得过{总冠军}座总冠军，但这段生涯并不只由奖杯组成；每个赛季的出场、表现和球队都能在档案中找到对应位置。', requires: { championshipsMin: 1 } },
        { id: 'bio_lead_no_ring', text: '你的档案里没有总冠军，所以这篇传记不会替你补写奖杯。它记录的是{场次}场常规赛和那些没有被冠军概括的年份。', requires: { championships: 0 } },
        { id: 'bio_lead_injury', text: '你的生涯记录过重大伤病。传记只在这里写下这项已存档的事实，不把没有记录的康复细节扩展成故事。', requires: { majorInjury: true } },
        { id: 'bio_lead_multi_team', text: '你先后在{球队数}支球队留下过赛季记录。路线的变化来自存档里的球队，而不是文案的想象。', requires: { teamsPlayedMin: 2 } }
      ],
      first_city: [
        { id: 'bio_first_team', text: '你的第一支球队是{首队}。从那一季开始，成长、出场和荣誉都以赛季记录的方式累积下来。' },
        { id: 'bio_first_one_team', text: '{首队}见证了你的全部职业赛季。一人一城不是修辞，而是球队列表里只有一支球队的事实。', requires: { oneTeamCareer: true } },
        { id: 'bio_first_multi_team', text: '{首队}是起点，之后的球队也都留在你的正式路线里。每次变化都有对应赛季记录。', requires: { teamsPlayedMin: 2 } }
      ],
      core: [
        { id: 'bio_core_fact', text: '{姓名}的核心价值可以从实际数据和荣誉中读到：{核心荣誉}。传记不再向这些事实之外添加具体人生经历。' },
        { id: 'bio_core_champion', text: '冠军赛季的比赛记录写下了{championships}座总冠军。奖杯是真的，围绕它的每个具体细节则只在有正式事件时才会出现。', requires: { championshipsMin: 1 } },
        { id: 'bio_core_dpoy', text: '你有{dpoy}次DPOY。防守价值可以由这项正式荣誉和赛季数据证明。', requires: { dpoyMin: 1 } },
        { id: 'bio_core_no_ring', text: '没有总冠军的生涯也可以被完整记录：{赛季数}个赛季、{场次}场比赛，以及没有奖杯却真实发生过的竞争。', requires: { championships: 0 } },
        { id: 'bio_core_injury', text: '重大伤病是你档案中确实存在的赛季事实。除此之外，传记只保留可以从存档核对的内容。', requires: { majorInjury: true } }
      ],
      transfer: [
        { id: 'bio_transfer_fact', text: '你在{球队数}支球队留下过赛季记录。每一次换队都来自球队路线，而不是模糊的“漂泊”标签。', requires: { teamsPlayedMin: 2 } },
        { id: 'bio_transfer_trade', text: '存档明确记录过交易。它改变了球队路线，但没有替你编造电话、机场或未记录的私人场景。', requires: { wasTraded: true, teamsPlayedMin: 2 } }
      ],
      era: [
        { id: 'bio_era_fact', text: '{时代球队}的{时代范围}赛季留下了{时代荣誉}。这段球队经历只引用该时代实际拥有的荣誉和比赛。' },
        { id: 'bio_era_champion', text: '{时代球队}的这段时间确实包含{时代冠军}座总冠军，冠军归属与赛季记录一致。', requires: { eraChampionshipsMin: 1 } },
        { id: 'bio_era_dpoy', text: '{时代球队}的这段时间留下了{时代DPOY}次DPOY，防守评价有明确的荣誉来源。', requires: { eraDpoyMin: 1 } }
      ],
      low: [
        { id: 'bio_low_no_ring', text: '你没有等到总冠军，但这份遗憾只说明奖杯数量为零，不会被扩展成未记录的人生故事。', requires: { championships: 0 } },
        { id: 'bio_low_fact', text: '生涯不只有高光，也有可以从赛季结果中核对的普通年份。传记把它们原样留在时间线上。' }
      ],
      late_peak: [
        { id: 'bio_late_fact', text: '生涯后期的表现仍然写在赛季记录里。这里描述的是年龄、出场和荣誉的变化，不推导未记录的身体经历。' },
        { id: 'bio_late_champion', text: '你在生涯后期确实赢得过总冠军，这个时间点与冠军赛季记录相符。', requires: { eraChampionshipsMin: 1 } }
      ],
      city_memory: [
        { id: 'bio_city_one', text: '{城市列表}记住的是一支球队和一段正式赛季记录。', requires: { oneTeamCareer: true } },
        { id: 'bio_city_multi', text: '{城市列表}都出现在你的球队路线里。城市数量来自球队列表，而不是文案猜测。', requires: { teamsPlayedMin: 2 } },
        { id: 'bio_city_fact', text: '球迷可以从比赛记录、球队和荣誉回看你的生涯。其余没有存档依据的细节，不写进传记。' }
      ],
      legacy: [
        { id: 'bio_legacy_fact', text: '退役之后，历史会继续讨论你的真实数据、荣誉和球队经历。它们共同构成{姓名}的生涯位置。' },
        { id: 'bio_legacy_champion', text: '历史档案会记住你赢得过{总冠军}座总冠军，也会记住每个冠军对应的赛季。', requires: { championshipsMin: 1 } },
        { id: 'bio_legacy_no_ring', text: '历史档案不会把没有总冠军写成拥有奖杯，但会完整保留你打过的比赛和留下的荣誉。', requires: { championships: 0 } },
        { id: 'bio_legacy_dpoy', text: '你的{DPOY}次DPOY有正式荣誉记录，防守遗产可以从这些赛季逐项回看。', requires: { dpoyMin: 1 } }
      ]
    }
  };

  function getPool(section, facts) {
    var list = copy[section] || (copy.biography && copy.biography[section]) || [];
    return list.filter(function(entry) { return matches(entry, facts); });
  }

  root.CareerNarrativeRules = {
    copy: copy,
    normalizeFacts: normalizeFacts,
    matches: matches,
    getPool: getPool
  };
})(typeof window !== 'undefined' ? window : globalThis);
