// ==================== Play-In 附加赛 ====================
function renderPlayIn() {
  showScreen('screen-playoffs');
  
  const conf = getConference(STATE.careerTeam);
  const sorted = getConferenceSorted(conf);
  const mySeed = getConferenceSeed(STATE.careerTeam);
  
  // 提取附加赛球队 (7-10)
  const playInTeams = sorted.filter(t => {
    const s = getConferenceSeed(t.team);
    return s >= 7 && s <= 10;
  });
  
  // 确定各队角色
  const seed7 = playInTeams.find(t => getConferenceSeed(t.team) === 7);
  const seed8 = playInTeams.find(t => getConferenceSeed(t.team) === 8);
  const seed9 = playInTeams.find(t => getConferenceSeed(t.team) === 9);
  const seed10 = playInTeams.find(t => getConferenceSeed(t.team) === 10);
  
  STATE.season.playInState = {
    seed7, seed8, seed9, seed10,
    gameAResult: null,  // 7v8
    gameBResult: null,  // 9v10
    gameCResult: null,  // 败7/8 vs 胜9/10
    isEliminated: false,
    playoffSeed: null,  // 最终进入季后赛的种子 (7 or 8)
  };
  
  renderPlayInUI();
  if (typeof queueSeasonAutoSave === 'function') queueSeasonAutoSave();
}

function renderPlayInUI() {
  const pi = STATE.season.playInState;
  if (!pi) return;
  if (typeof setGlobalNextStatus === 'function') setGlobalNextStatus('⏳ 正在更新附加赛');
  
  const isMyTeam = (team) => team === STATE.careerTeam;
  const myTeam = STATE.careerTeam;
  let nextPlayInGame = null;
  
  let h = `<div class="playin-container" style="padding:8px 0;">`;
  h += `<div style="text-align:center;margin-bottom:12px;">
    <div style="font-size:14px;color:var(--text-dim);">🔥 附加赛</div>
    <div style="font-size:20px;font-weight:800;">${getConference(STATE.careerTeam) === 'SOUTH' ? '南方' : '北方'} Play-In</div>
  </div>`;
  
  // Game A: 7 vs 8
  const gA = pi.gameAResult;
  const myInA = isMyTeam(pi.seed7?.team) || isMyTeam(pi.seed8?.team);
  h += `<div class="playin-game" style="background:var(--bg-card);border-radius:var(--radius);padding:12px;margin-bottom:10px;border:1px solid var(--border);">`;
  h += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">🏀 第7vs8种子 · 胜者晋级季后赛（7号种子）</div>`;
  if (!gA) {
      h += `<div style="display:flex;justify-content:space-around;align-items:center;padding:8px 0;">
        <div style="text-align:center;flex:1;">${getTeamName(pi.seed7?.team) || '?'}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed7?.wins || 0}胜</span></div>
        <div style="font-size:18px;font-weight:700;color:var(--accent);padding:0 12px;">VS</div>
        <div style="text-align:center;flex:1;">${getTeamName(pi.seed8?.team) || '?'}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed8?.wins || 0}胜</span></div>
      </div>`;
    if (myInA) {
      nextPlayInGame = { id: 'A', label: '▶ 模拟附加赛第7vs8' };
    }
  } else {
    const winTeam = gA.winner;
    h += `<div style="text-align:center;padding:4px 0;">
      <span style="color:var(--green);font-weight:700;">✅ ${getTeamName(winTeam)}</span> 晋级（7号种子）
      <span style="color:var(--red);margin-left:8px;">❌ ${getTeamName(gA.loser)}</span> 落入败者组
    </div>`;
    if (isMyTeam(gA.winner)) {
      h += `<div style="text-align:center;color:var(--gold);font-weight:700;margin-top:4px;">🎉 你赢了！以7号种子进入季后赛！</div>`;
    }
  }
  h += `</div>`;
  
  // Game B: 9 vs 10
  const gB = pi.gameBResult;
  const myInB = isMyTeam(pi.seed9?.team) || isMyTeam(pi.seed10?.team);
  h += `<div class="playin-game" style="background:var(--bg-card);border-radius:var(--radius);padding:12px;margin-bottom:10px;border:1px solid var(--border);">`;
  h += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">🏀 第9vs10种子 · 败者淘汰</div>`;
  if (!gB) {
      h += `<div style="display:flex;justify-content:space-around;align-items:center;padding:8px 0;">
        <div style="text-align:center;flex:1;">${getTeamName(pi.seed9?.team) || '?'}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed9?.wins || 0}胜</span></div>
        <div style="font-size:18px;font-weight:700;color:var(--accent);padding:0 12px;">VS</div>
        <div style="text-align:center;flex:1;">${getTeamName(pi.seed10?.team) || '?'}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed10?.wins || 0}胜</span></div>
      </div>`;
    if (myInB) {
      nextPlayInGame = { id: 'B', label: '▶ 模拟附加赛第9vs10' };
    }
  } else {
    const winTeam = gB.winner;
    h += `<div style="text-align:center;padding:4px 0;">
      <span style="color:var(--green);font-weight:700;">✅ ${getTeamName(winTeam)}</span> 进入败者组决赛
      <span style="color:var(--red);margin-left:8px;">❌ ${getTeamName(gB.loser)}</span> 淘汰
    </div>`;
    if (isMyTeam(gB.loser)) {
      h += `<div style="text-align:center;color:var(--text-dim);margin-top:4px;">😢 被淘汰了</div>`;
    }
  }
  h += `</div>`;
  
  // Game C: 败7/8 vs 胜9/10
  if (gA && gB) {
    const gC = pi.gameCResult;
    const teamA = gA.loser;
    const teamB = gB.winner;
    const myInC = isMyTeam(teamA) || isMyTeam(teamB);
    
    h += `<div class="playin-game" style="background:var(--bg-card);border-radius:var(--radius);padding:12px;margin-bottom:10px;border:1px solid var(--border);">`;
    h += `<div style="font-size:12px;color:var(--text-dim);margin-bottom:6px;">🏀 败者组决赛 · 胜者晋级季后赛（8号种子）</div>`;
    if (!gC) {
      h += `<div style="display:flex;justify-content:space-around;align-items:center;padding:8px 0;">
        <div style="text-align:center;flex:1;">${getTeamName(teamA)}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed8?.wins || 0}胜</span></div>
        <div style="font-size:18px;font-weight:700;color:var(--accent);padding:0 12px;">VS</div>
        <div style="text-align:center;flex:1;">${getTeamName(teamB)}<br><span style="font-size:11px;color:var(--text-dim);">${pi.seed9?.wins || 0}胜</span></div>
      </div>`;
      if (myInC) {
        nextPlayInGame = { id: 'C', label: '▶ 模拟附加赛败者组决赛' };
      }
    } else {
      const winTeam = gC.winner;
      h += `<div style="text-align:center;padding:4px 0;">
        <span style="color:var(--green);font-weight:700;">✅ ${getTeamName(winTeam)}</span> 晋级（8号种子）
        <span style="color:var(--red);margin-left:8px;">❌ ${getTeamName(gC.loser)}</span> 淘汰
      </div>`;
      if (isMyTeam(gC.winner)) {
        h += `<div style="text-align:center;color:var(--gold);font-weight:700;margin-top:4px;">🎉 你赢了！以8号种子进入季后赛！</div>`;
      }
    }
    h += `</div>`;
  }
  
  h += `</div>`;
  document.getElementById('playoffs-area').innerHTML = h;
  if (checkPlayInComplete()) {
    const ps = STATE.season.playInState.playoffSeed;
    setGlobalNextAction(`🏀 进入季后赛（${ps}号种子）`, renderPlayoffs);
  } else if (pi.isEliminated) {
    setGlobalNextAction('📊 查看赛季总结', showSeasonResults);
  } else if (nextPlayInGame) {
    setGlobalNextAction(nextPlayInGame.label, function() { simPlayInGame(nextPlayInGame.id); });
  } else {
    setGlobalNextStatus('⏳ 等待附加赛对阵更新');
  }
  
  // ★ 自动模拟不涉及玩家的附加赛比赛
  setTimeout(autoSimNonUserPlayInGames, 100);
}

/** 自动模拟不涉及玩家的附加赛比赛 */
function autoSimNonUserPlayInGames() {
  const pi = STATE.season.playInState;
  if (!pi || pi.isEliminated || pi.playoffSeed) return;
  
  const myTeam = STATE.careerTeam;
  const inA = pi.seed7 && (pi.seed7.team === myTeam || pi.seed8.team === myTeam);
  const inB = pi.seed9 && (pi.seed9.team === myTeam || pi.seed10.team === myTeam);
  
  // 玩家在 Game A → 自动模拟 Game B（9vs10）
  if (inA && !pi.gameBResult && pi.seed9 && pi.seed10) {
    simPlayInGame('B');
    return;
  }
  
  // 玩家在 Game B → 自动模拟 Game A（7vs8）
  if (inB && !pi.gameAResult && pi.seed7 && pi.seed8) {
    simPlayInGame('A');
    return;
  }
  
  // Game A 已打完且玩家输了 → 玩家进入Game C, 需要 Game B 完成
  if (pi.gameAResult && !pi.gameBResult && pi.seed9 && pi.seed10 && pi.gameAResult.loser === myTeam) {
    simPlayInGame('B');
    return;
  }
  
  // Game B 已打完且玩家赢了 → 需要 Game A 完成才能进行 Game C
  if (pi.gameBResult && !pi.gameAResult && pi.seed7 && pi.seed8 && pi.gameBResult.winner) {
    simPlayInGame('A');
    return;
  }
}

function simPlayInGame(gameId) {
  trackEvent({act:"click",blk:"BMC098",pos:"TC11",label:"模拟附加赛"});
  const pi = STATE.season.playInState;
  if (!pi) return;
  
  let teamA, teamB, resultKey, label;
  
  if (gameId === 'A') {
    teamA = pi.seed7.team;
    teamB = pi.seed8.team;
    resultKey = 'gameAResult';
    label = '第7vs8种子';
  } else if (gameId === 'B') {
    teamA = pi.seed9.team;
    teamB = pi.seed10.team;
    resultKey = 'gameBResult';
    label = '第9vs10种子';
  } else if (gameId === 'C') {
    teamA = pi.gameAResult.loser;
    teamB = pi.gameBResult.winner;
    resultKey = 'gameCResult';
    label = '败者组决赛';
  }
  
  // 模拟单场
  const powerA = calcTeamPowerWithPlayer(teamA);
  const powerB = calcTeamPowerWithPlayer(teamB);
  const avgA = (powerA.offense + powerA.defense + powerA.depth) / 3;
  const avgB = (powerB.offense + powerB.defense + powerB.depth) / 3;
  
  // 增加随机性，让附加赛更刺激
  const rand = Math.random();
  const winProb = avgA / (avgA + avgB + 0.01);
  const adjustedProb = winProb * 0.6 + 0.2 + rand * 0.2; // 40-80%范围，增加变数
  const aWins = Math.random() < adjustedProb;
  
  const winner = aWins ? teamA : teamB;
  const loser = aWins ? teamB : teamA;
  
  const result = {
    winner, loser,
    teamAScore: Math.round(avgA * (0.8 + Math.random() * 0.4)),
    teamBScore: Math.round(avgB * (0.8 + Math.random() * 0.4)),
    label,
  };
  
  pi[resultKey] = result;
  
  // 检测是否涉及玩家
  const myTeam = STATE.careerTeam;
  if (winner === myTeam) {
    if (gameId === 'A') {
      pi.playoffSeed = 7;
    } else if (gameId === 'C') {
      pi.playoffSeed = 8;
    }
  }
  if (loser === myTeam && gameId === 'B') {
    pi.isEliminated = true;
  }
  if (loser === myTeam && gameId === 'C') {
    pi.isEliminated = true;
  }
  
  renderPlayInUI();
  if (typeof queueSeasonAutoSave === 'function') queueSeasonAutoSave();
}

function checkPlayInComplete() {
  const pi = STATE.season.playInState;
  if (!pi) return false;
  if (pi.isEliminated) return false;
  
  // 已经通过Game A直接晋级
  if (pi.playoffSeed === 7) return true;
  
  // Game A + Game B完成后，Game C也完成则晋级
  if (pi.gameAResult && pi.gameBResult && pi.gameCResult) {
    if (pi.playoffSeed === 8) return true;
  }
  
  return false;
}

// ==================== 赛季结束 ====================
function endSeason() {
  const ps = STATE.season.playerStats;
  const games = ps.games || 1;
  
  STATE.season.avgStats = {
    pts: Math.round(ps.pts / games * 10) / 10,
    reb: Math.round(ps.reb / games * 10) / 10,
    ast: Math.round(ps.ast / games * 10) / 10,
    stl: Math.round(ps.stl / games * 10) / 10,
    blk: Math.round(ps.blk / games * 10) / 10,
    tov: Math.round(ps.tov / games * 10) / 10,
    fgm: Math.round(ps.fgm / games * 10) / 10,
    fga: Math.round(ps.fga / games * 10) / 10,
    ftm: Math.round(ps.ftm / games * 10) / 10,
    fta: Math.round(ps.fta / games * 10) / 10,
    threeM: Math.round(ps.threeM / games * 10) / 10,
    threeA: Math.round(ps.threeA / games * 10) / 10,
    mins: Math.round(ps.mins / games),
  };
  
  calcSeasonAwards();
  
  // 赛季结束，转到 MyCard
  renderMyCard(true);
}

// ==================== 季后赛系统（真实排名版）====================
const PLAYOFF_HIGH_SEED_HOME_PATTERN = [true, true, false, false, true, false, true];

function isTeamAHigherPlayoffSeed(teamA, teamB) {
  const standings = STATE.season?.standings || {};
  const a = standings[teamA] || { wins: 0, losses: 0 };
  const b = standings[teamB] || { wins: 0, losses: 0 };
  const aGames = (a.wins || 0) + (a.losses || 0);
  const bGames = (b.wins || 0) + (b.losses || 0);
  const aPct = aGames > 0 ? (a.wins || 0) / aGames : 0;
  const bPct = bGames > 0 ? (b.wins || 0) / bGames : 0;
  if (aPct !== bPct) return aPct > bPct;
  if ((a.wins || 0) !== (b.wins || 0)) return (a.wins || 0) > (b.wins || 0);
  return getConferenceSeed(teamA) <= getConferenceSeed(teamB);
}

function isPlayoffTeamAHome(gameNum, teamAIsHigherSeed) {
  const highSeedHome = PLAYOFF_HIGH_SEED_HOME_PATTERN[gameNum] !== false;
  return highSeedHome ? !!teamAIsHigherSeed : !teamAIsHigherSeed;
}

/** 为指定分区构建季后赛对阵数据结构 */
function buildPlayoffBracket(conf, playInState) {
  const sorted = getConferenceSorted(conf);
  const teams = sorted.slice(0, 8);
  
  // ★ 附加赛结果替换7/8号种子
  if (playInState && !playInState.isEliminated) {
    // Game A winner → 7号种子
    if (playInState.gameAResult?.winner) {
      teams[6] = { team: playInState.gameAResult.winner, ovr: calcTeamPowerWithPlayer(playInState.gameAResult.winner) };
    }
    // Game C winner → 8号种子（只有C打完才确定）
    if (playInState.gameCResult?.winner) {
      teams[7] = { team: playInState.gameCResult.winner, ovr: calcTeamPowerWithPlayer(playInState.gameCResult.winner) };
    }
  }
  return {
    conf: conf,
    teams: teams,
    rounds: [
      [
        { high: teams[0], low: teams[7], winner: null },
        { high: teams[1], low: teams[6], winner: null },
        { high: teams[2], low: teams[5], winner: null },
        { high: teams[3], low: teams[4], winner: null },
      ],
      [null, null],
      [null],
      [null],  // 总决赛 (第3轮)
    ],
    currentRound: 0,
    results: [],
    confChampion: null,
  };
}

/** 自动模拟整个分区的季后赛（用于另一分区） */
function autoSimConferenceBracket(confBracket) {
  if (!confBracket) return;
  const bracketOrder = [0, 7, 1, 6, 2, 5, 3, 4];
  // 顺序必须让首轮胜者自然组成 1/8 vs 4/5、2/7 vs 3/6 两个半区。
  const simulationOrder = [0, 7, 3, 4, 1, 6, 2, 5];
  const firstRoundSeriesOrder = [0, 3, 1, 2];
  let roundTeams = simulationOrder.map(i => confBracket.teams[i]?.team).filter(Boolean);
  
  for (let r = 0; r < 3; r++) {
    const pairs = [];
    for (let i = 0; i < roundTeams.length; i += 2) {
      if (i + 1 >= roundTeams.length) { pairs.push([roundTeams[i], null]); break; }
      pairs.push([roundTeams[i], roundTeams[i + 1]]);
    }
    const winners = [];
    pairs.forEach(([tA, tB], idx) => {
      if (!tB) { winners.push(tA); return; }
      const seriesIdx = r === 0 ? firstRoundSeriesOrder[idx] : idx;
      let wA = 0, wB = 0;
      const sGames = [];
      const teamAIsHigherSeed = isTeamAHigherPlayoffSeed(tA, tB);
      // ★ 首轮根据种子排名计算 seedBonus
      let sb = 0;
      if (r === 0) {
        const seedIdxA = bracketOrder[seriesIdx * 2];
        const seedIdxB = bracketOrder[seriesIdx * 2 + 1];
        const gapSeed = Math.abs(seedIdxA - seedIdxB);
        sb = 0.4 * gapSeed;
        sb = seedIdxA < seedIdxB ? sb : -sb;
      }
      for (let g = 0; g < 7 && wA < 4 && wB < 4; g++) {
        const isHomeA = isPlayoffTeamAHome(g, teamAIsHigherSeed);
        const gr = simulateGameNew(tA, tB, sb, null, { isHomeA: isHomeA, isB2B: false });
        if (gr.won) wA++; else wB++;
        sGames.push({ myScore: gr.scoreA, oppScore: gr.scoreB, won: gr.won, home: isHomeA, qScoresA: gr.qScoresA, qScoresB: gr.qScoresB, boxScore: gr.boxScore });
      }
      const sWinner = wA >= 4 ? tA : tB;
      winners.push(sWinner);
      
      // 存储结果
      if (confBracket.rounds[r]) {
        if (!confBracket.rounds[r][seriesIdx]) {
          confBracket.rounds[r][seriesIdx] = { high: null, low: null, winner: null };
        }
        const s = confBracket.rounds[r][seriesIdx];
        if (r === 0) {
          const orderIdx = seriesIdx * 2;
          s.high = confBracket.teams[bracketOrder[orderIdx]];
          s.low = confBracket.teams[bracketOrder[orderIdx + 1]];
        } else {
          s.high = { team: tA };
          s.low = { team: tB };
        }
        s.winner = sWinner;
      }
      
      confBracket.results.push({
        round: r, seriesIdx: seriesIdx,
        roundName: ['首轮', '分区半决赛', '分区决赛'][r],
        teamA: tA, teamB: tB,
        winner: sWinner,
        winnerWins: wA >= 4 ? wA : wB,
        loserWins: wA >= 4 ? wB : wA,
        aWon: wA >= 4,
        seriesGames: sGames,
        isMySeries: false,
      });
      
      // 更新下一轮槽位（联盟规则：1v8胜者vs4v5胜者，2v7胜者vs3v6胜者）
      if (r < 2) {
        const nr = confBracket.rounds[r + 1];
        if (nr) {
          var ni, isHigh;
          if (r === 0) {
            ni = (seriesIdx === 0 || seriesIdx === 3) ? 0 : 1;
            isHigh = (seriesIdx === 0 || seriesIdx === 1);
          } else {
            ni = 0;
            isHigh = idx === 0;
          }
          if (!nr[ni]) nr[ni] = { high: null, low: null, winner: null };
          if (isHigh) nr[ni].high = { team: sWinner };
          else nr[ni].low = { team: sWinner };
        }
      }
    });
    roundTeams = winners;
  }
  confBracket.confChampion = roundTeams[0] || null;
  confBracket.currentRound = 3;
}

function renderPlayoffs() {
  STATE.season.isPlayoffs = true;
  trackEvent({act:"click",blk:"BMC098",pos:"TC10",label:"进入季后赛"});
  showScreen('screen-playoffs');
  
  // 安全检查
  if (!STATE.season || !STATE.careerTeam) {
    showScreen('screen-season');
    return;
  }
  
  // ★ 附加赛检测：种子7-10且附加赛未完成 → 初始化附加赛
  const seed = getConferenceSeed(STATE.careerTeam);
  let pi = STATE.season.playInState;
  const playInNeeded = seed >= 7 && seed <= 10;
  const playInComplete = pi?.playoffSeed != null && !pi?.isEliminated;
  const playInEliminated = pi?.isEliminated;
  
  if (playInNeeded && !playInComplete && !playInEliminated && (!pi || !pi.seed7)) {
    // 初始化附加赛状态
    const conf = getConference(STATE.careerTeam);
    const sorted = getConferenceSorted(conf);
    const playInTeams = sorted.filter(t => {
      const s = getConferenceSeed(t.team);
      return s >= 7 && s <= 10;
    });
    const seed7 = playInTeams.find(t => getConferenceSeed(t.team) === 7);
    const seed8 = playInTeams.find(t => getConferenceSeed(t.team) === 8);
    const seed9 = playInTeams.find(t => getConferenceSeed(t.team) === 9);
    const seed10 = playInTeams.find(t => getConferenceSeed(t.team) === 10);
    
    STATE.season.playInState = {
      seed7, seed8, seed9, seed10,
      gameAResult: null, gameBResult: null, gameCResult: null,
      isEliminated: false, playoffSeed: null,
    };
    pi = STATE.season.playInState;
  }
  
  // 季后赛流程
  const pi2 = STATE.season.playInState;
  const mySeed = pi2?.playoffSeed || seed;
  const conf = getConference(STATE.careerTeam);
  
  // ★ 附加赛结果修正种子：用附加赛晋级者替换原7/8号种子
  const bracket = buildPlayoffBracket(conf, pi2);
  const otherConf = conf === 'SOUTH' ? 'NORTH' : 'SOUTH';
  const otherBracket = buildPlayoffBracket(otherConf);
  
  // 自动模拟另一分区的季后赛（用户不能操作）
  autoSimConferenceBracket(otherBracket);
  
  STATE.season.playoffBracket = bracket;
  STATE.season.otherBracket = otherBracket;
  STATE.season.playoffSeed = mySeed;
  STATE.season._viewConf = conf;
  
  if (typeof queueSeasonAutoSave === 'function') queueSeasonAutoSave();
  renderPlayoffBracketUI();
}

function resumePlayoffs() {
  showScreen('screen-playoffs');
  if (STATE.season && STATE.season.playoffBracket) {
    renderPlayoffBracketUI();
  } else {
    renderPlayoffs();
  }
}

function getPlayoffTreeSeriesResult(confBracket, round, seriesIdx) {
  return (confBracket.results || []).find(function(result) {
    return result.round === round && result.seriesIdx === seriesIdx;
  }) || null;
}

function renderPlayoffTreeTeam(confBracket, series, result, team) {
  if (!team) {
    return '<div class="bv-s-team"><span class="bv-seed">·</span><span class="bv-s-name">待定</span></div>';
  }
  var winner = series && series.winner;
  var isComplete = !!winner;
  var isWinner = winner === team;
  var isUser = team === STATE.careerTeam;
  var score = '';
  if (result) {
    if (team === result.teamA && result.winsA != null) score = result.winsA;
    else if (team === result.teamB && result.winsB != null) score = result.winsB;
    else score = isWinner ? result.winnerWins : result.loserWins;
  }
  var rowClass = 'bv-s-team';
  if (isComplete) rowClass += isWinner ? ' bv-winner' : ' bv-loser';
  if (isUser) rowClass += ' bv-s-user';
  var seed = getSeedOf(confBracket.teams, team);
  if (seed === '?' && STATE.season && STATE.season.otherBracket) {
    seed = getSeedOf(STATE.season.otherBracket.teams, team);
  }
  return '<div class="' + rowClass + '">' +
    '<span class="bv-seed ' + (isUser ? 'bv-seed-my' : (isWinner ? 'bv-seed-w' : '')) + '">' + seed + '</span>' +
    '<span class="bv-s-name">' + getTeamLogo(team, 14) + ' ' + getTeamName(team) + '</span>' +
    (score !== '' && score != null ? '<span class="bv-s-score ' + (isWinner ? 'bv-sc-w' : '') + '">' + score + '</span>' : '') +
  '</div>';
}

function renderPlayoffTreeSeries(confBracket, round, seriesIdx) {
  var series = confBracket.rounds[round] && confBracket.rounds[round][seriesIdx];
  var result = getPlayoffTreeSeriesResult(confBracket, round, seriesIdx);
  var teamA = series && series.high && series.high.team;
  var teamB = series && series.low && series.low.team;
  var isUser = teamA === STATE.careerTeam || teamB === STATE.careerTeam;
  var classes = 'bv-tree-series';
  if (!series || !teamA || !teamB) classes += ' is-pending';
  else if (series.winner) classes += ' is-complete';
  if (isUser) classes += ' is-user';
  return '<div class="' + classes + '" aria-label="' + (teamA && teamB ? getTeamName(teamA) + ' 对阵 ' + getTeamName(teamB) : '对阵待定') + '">' +
    renderPlayoffTreeTeam(confBracket, series, result, teamA) +
    renderPlayoffTreeTeam(confBracket, series, result, teamB) +
  '</div>';
}

function renderPlayoffBracketUI() {
  const bracket = STATE.season?.playoffBracket;
  if (!bracket) { renderPlayoffs(); return; }
  if (typeof setGlobalNextStatus === 'function') setGlobalNextStatus('⏳ 正在更新季后赛');
  
  const mySeed = STATE.season.playoffSeed || getConferenceSeed(STATE.careerTeam);
  const viewConf = STATE.season._viewConf || bracket.conf;
  const isViewingOther = viewConf !== bracket.conf;
  
  if (STATE.season.isChampion) {
    setGlobalNextAction('📊 查看赛季总结', showSeasonResults);
    return;
  }
  
  // 选择要显示的分区对阵数据
  const activeBracket = isViewingOther ? STATE.season.otherBracket : bracket;
  if (!activeBracket) return;
  const confName = activeBracket.conf === 'SOUTH' ? '南方' : '北方';
  
  const pi = STATE.season.playInState;
  let h = `<div class="bv-wrap">`;
  
  // ===== 分区切换标签 =====
  const myConfName = bracket.conf === 'SOUTH' ? '南方' : '北方';
  const otherConfName = bracket.conf === 'SOUTH' ? '北方' : '南方';
  h += `<div class="bv-conf-tabs">
    <button class="bv-conf-tab ${!isViewingOther ? 'bv-conf-tab-active' : ''}" onclick="switchPlayoffConf('${bracket.conf}')">🏀 ${myConfName}</button>
    <button class="bv-conf-tab ${isViewingOther ? 'bv-conf-tab-active' : ''}" onclick="switchPlayoffConf('${bracket.conf === 'SOUTH' ? 'NORTH' : 'SOUTH'}')">🏀 ${otherConfName}</button>
  </div>`;
  
  h += `<div class="bv-header">
    <div class="bv-header-title">${confName}淘汰赛树</div>
    <div class="bv-header-sub">${!isViewingOther ? `${getTeamName(STATE.careerTeam)} · 第${mySeed}种子` : '完整分区对阵'}</div>
  </div>`;

  h += `<div class="bv-tree-scroll"><div class="bv-tree" aria-label="${confName}季后赛淘汰赛树">
    <div class="bv-tree-flow-label">首轮 ↓ 分区半决赛 ↓ 分区决赛</div>
    <div class="bv-tree-branches">
      <div class="bv-tree-branch">
        <div class="bv-tree-first-pair">${renderPlayoffTreeSeries(activeBracket, 0, 0)}${renderPlayoffTreeSeries(activeBracket, 0, 3)}</div>
        <div class="bv-tree-branch-merge" aria-hidden="true"></div>
        <div class="bv-tree-semi">${renderPlayoffTreeSeries(activeBracket, 1, 0)}</div>
      </div>
      <div class="bv-tree-branch">
        <div class="bv-tree-first-pair">${renderPlayoffTreeSeries(activeBracket, 0, 1)}${renderPlayoffTreeSeries(activeBracket, 0, 2)}</div>
        <div class="bv-tree-branch-merge" aria-hidden="true"></div>
        <div class="bv-tree-semi">${renderPlayoffTreeSeries(activeBracket, 1, 1)}</div>
      </div>
    </div>
    <div class="bv-tree-final-merge" aria-hidden="true"></div>
    <div class="bv-tree-final">${renderPlayoffTreeSeries(activeBracket, 2, 0)}</div>
    ${activeBracket.confChampion ? `<div class="bv-conf-champion">${getTeamLogo(activeBracket.confChampion, 16)} ${getTeamName(activeBracket.confChampion)} · ${confName}冠军</div>` : ''}
  </div></div>`;

  const finalsSeries = bracket.rounds[3] && bracket.rounds[3][0];
  if (finalsSeries) {
    h += `<div class="bv-finals-stage">
      <div class="bv-finals-title">🏆 联盟总决赛</div>
      ${renderPlayoffTreeSeries(bracket, 3, 0)}
    </div>`;
  }

  let nextRoundAction = null;
  if (!isViewingOther) {
    for (let actionRound = 0; actionRound <= 3 && !nextRoundAction; actionRound++) {
      const actionSeriesList = bracket.rounds[actionRound] || [];
      for (let actionIdx = 0; actionIdx < actionSeriesList.length; actionIdx++) {
        const actionSeries = actionSeriesList[actionIdx];
        const isUserSeries = actionSeries && !actionSeries.winner &&
          (actionSeries.high?.team === STATE.careerTeam || actionSeries.low?.team === STATE.careerTeam);
        if (!isUserSeries) continue;
        nextRoundAction = {
          label: actionRound === 3 ? '🏆 开始总决赛' : actionRound === 2 ? '🏆 开始分区决赛' : actionRound === 1 ? '▶ 开始分区半决赛' : '▶ 开始首轮系列赛',
          run: (function(round, seriesIdx) { return function() { simPlayoffSeries(round, seriesIdx); }; })(actionRound, actionIdx)
        };
        break;
      }
    }
  }
  
  // gamecast（放在 bv-po-stats 上方）
  h += `<div id="playoff-gamecast" style="display:none;padding:0 12px 8px;"></div>`;

  // 季后赛场均数据
  if (!isViewingOther) {
    const po = STATE.season.playoffStats;
    if (po.games > 0) {
      const poG = po.games;
      h += `<div class="bv-po-stats">
        <div class="bv-po-title">📊 季后赛场均</div>
        <div class="bv-po-grid">
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.pts/poG*10)/10}</span><span class="bv-po-lbl">得分</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.reb/poG*10)/10}</span><span class="bv-po-lbl">篮板</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.ast/poG*10)/10}</span><span class="bv-po-lbl">助攻</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.stl/poG*10)/10}</span><span class="bv-po-lbl">抢断</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.blk/poG*10)/10}</span><span class="bv-po-lbl">盖帽</span></div>
          <div class="bv-po-stat"><span class="bv-po-val">${Math.round(po.tov/poG*10)/10}</span><span class="bv-po-lbl">失误</span></div>
        </div>
        <div style="text-align:center;font-size:11px;color:var(--text-dim);margin-top:4px;">
          出战 ${poG} 场 · 命中 ${Math.round(po.fgm/poG*10)/10}-${Math.round(po.fga/poG*10)/10} (${po.fga>0?Math.round(po.fgm/po.fga*100):0}%)
        </div>
      </div>`;
    }
  }
  
  h += `</div>`;
  document.getElementById('playoffs-area').innerHTML = h;
  if (!isViewingOther && (STATE.season.playoffEliminated || pi?.isEliminated)) {
    setGlobalNextAction('📊 查看赛季总结', showSeasonResults);
  } else if (isViewingOther) {
    setGlobalNextAction('🏀 返回我的季后赛', function() { switchPlayoffConf(bracket.conf); });
  } else if (nextRoundAction) {
    setGlobalNextAction(nextRoundAction.label, nextRoundAction.run);
  } else {
    setGlobalNextStatus('请选择未完成的季后赛轮次');
  }
}

/** 切换查看的分区 */
function switchPlayoffConf(conf) {
  
  STATE.season._viewConf = conf;
  renderPlayoffBracketUI();
}

/** 通过索引查找系列赛结果并弹窗 */
function showSeriesResultByIdx(round, seriesIdx, source) {
  // 已取消弹窗，改用页面刷新
  renderPlayoffBracketUI();
}

/** 获取球队在季后赛球队数组中的种子号 */
function getSeedOf(teams, team) {
  if (!teams || !team) return '?';
  const idx = teams.findIndex(t => t.team === team);
  return idx >= 0 ? (idx + 1) : '?';
}

/** 比赛单场简报卡片（用于一场一场弹） */
function renderPlayoffGameBrief(gameEntry, teamA, teamB, isMySeries, roundName, gameNum, totalNum, round, seriesIdx) {
  const gcContainer = document.getElementById('playoff-gamecast');
  if (!gcContainer) return;
  
  gcContainer.style.display = 'block';
  const isUserA = teamA === STATE.careerTeam;
  const myScore = isUserA ? gameEntry.myScore : gameEntry.oppScore;
  const oppScore = isUserA ? gameEntry.oppScore : gameEntry.myScore;
  const oppName = isUserA ? teamB : teamA;
  const stats = gameEntry.myStats;
  
  let statsLine = '';
  if (stats) {
    const pct = stats.fga > 0 ? Math.round(stats.fgm / stats.fga * 100) : 0;
    statsLine = `<div style="font-size:9px;color:var(--text-dim);margin-top:2px;">${stats.pts}分 ${stats.reb}板 ${stats.ast}助 · ${stats.fgm}-${stats.fga} (${pct}%)</div>`;
  }
  
  const brief = document.createElement('div');
  brief.style.cssText = `
    display:flex;align-items:center;gap:8px;
    padding:8px 12px;margin-bottom:6px;
    background:var(--bg-card);border:1.5px solid ${gameEntry.suspended ? '#000' : (gameEntry.won ? 'var(--green)' : 'var(--red)')};
    border-radius:10px;animation:slideUp 0.2s ease;cursor:pointer;
  `;
  brief.innerHTML = `
    <span style="font-size:13px;">${gameEntry.won ? '✅' : '❌'}</span>
    <span style="font-family:var(--font-display);font-size:12px;font-weight:700;min-width:36px;">G${gameEntry.game}</span>
    <span style="font-family:var(--font-display);font-size:14px;font-weight:700;color:${gameEntry.suspended ? '#000' : (gameEntry.won ? 'var(--green)' : 'var(--red)')};">${myScore}-${oppScore}</span>
    <span style="font-size:10px;color:var(--text-dim);flex:1;">G${gameEntry.game} vs ${getTeamName(oppName)}${gameEntry.ot ? ' · '+(gameEntry.ot>1?gameEntry.ot+'OT':'OT') : ''}${gameEntry.suspended ? (gameEntry.skipReason === 'injury' ? ' · 🏥 伤病' : ' · 🔇 禁赛') : ''}${gameEntry.playedThroughInjury ? ' · 🏥 带伤出战' : ''}</span>
    ${gameEntry.suspended ? '' : statsLine}
    <span style="font-size:16px;color:var(--text-muted);">›</span>
  `;
  // 点击查看详情
  brief.onclick = () => showPlayoffGamePopup(round, seriesIdx, gameEntry.game - 1);
  
  gcContainer.prepend(brief);
  
  // 最多保留5条简报
  while (gcContainer.children.length > 5) {
    gcContainer.removeChild(gcContainer.lastChild);
  }
}

/** 清空季后赛比赛简报 */
function clearPlayoffGamecast() {
  const gc = document.getElementById('playoff-gamecast');
  if (gc) { gc.innerHTML = ''; gc.style.display = 'none'; }
}

/** 单场模拟并更新简报（递归，一场一场模拟） */
function simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum, winsA, winsB, seriesGames, userGameStats, roundName, onDone) {
  if (winsA >= 4 || winsB >= 4 || gameNum >= 7) {
    onDone(winsA, winsB, seriesGames, userGameStats);
    return;
  }
  
  // 根据真实常规赛排名确定主场归属，避免爆冷晋级后沿用错误槽位身份。
  const teamAIsHigherSeed = isTeamAHigherPlayoffSeed(teamA, teamB);
  const isHomeA = isPlayoffTeamAHome(gameNum, teamAIsHigherSeed);
  
  let seedBonus = 0;
  // 同分区保留很小的赛季表现修正；主要高种子优势由真实主场顺序提供。
  if (getConference(teamA) === getConference(teamB)) {
    const rankA = getConferenceSeed(teamA);
    const rankB = getConferenceSeed(teamB);
    if (rankA < 99 && rankB < 99) {
      const gap = Math.max(1, Math.min(8, Math.abs(rankA - rankB)));
      seedBonus = 0.4 * gap * (rankA < rankB ? 1 : -1);
    }
  }
  
  const userDebuff = 1.0;
  
  // ★ 跳过检查（禁赛优先于伤病）
  const skipEv = STATE.season.events;
  var skipReason = null;
  if (skipEv && skipEv.suspensionGamesLeft > 0) skipReason = 'suspension';
  else if (skipEv && skipEv.injuryGamesLeft > 0) skipReason = 'injury';
  if (skipReason) {
    var runSkippedPlayoffGame = function() {
      if (skipReason === 'suspension') skipEv.suspensionGamesLeft--;
      else skipEv.injuryGamesLeft--;
      var skipResult = simulateGameNew(teamA, teamB, seedBonus, userDebuff, { isHomeA: isHomeA, isB2B: false, availabilityEdge: -4 });
      const skipWon = skipResult.won;
      const skipNewWinsA = winsA + (skipWon ? 1 : 0);
      const skipNewWinsB = winsB + (skipWon ? 0 : 1);
      const skipEntry = {
        game: gameNum + 1, myScore: skipResult.scoreA, oppScore: skipResult.scoreB,
        won: skipWon, home: isHomeA,
        qScoresA: skipResult.qScoresA, qScoresB: skipResult.qScoresB,
        keyEvents: skipResult.keyEvents, ot: skipResult.ot,
        boxScore: skipResult.boxScore,
        suspended: true,
        skipReason: skipReason,
      };
      if (isMySeries) {
        renderPlayoffGameBrief(skipEntry, teamA, teamB, true, roundName, gameNum + 1, 7, round, seriesIdx);
      }
      seriesGames.push(skipEntry);
      setTimeout(function() {
        simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum + 1, skipNewWinsA, skipNewWinsB, seriesGames, userGameStats, roundName, onDone);
      }, isMySeries ? 600 : 50);
    };
    var runPlayedThroughPlayoffGame = function(severity) {
      skipEv.injuryGamesLeft = Math.max(0, (skipEv.injuryGamesLeft || 0) - 1);
      var hurtResult = simulateGameNew(teamA, teamB, seedBonus, getInjuryPlayWinMultiplier(severity), { isHomeA: isHomeA, isB2B: false });
      const hurtWon = hurtResult.won;
      const hurtNewWinsA = winsA + (hurtWon ? 1 : 0);
      const hurtNewWinsB = winsB + (hurtWon ? 0 : 1);
      const hurtStats = scaleHurtStats(generatePlayerStatsNew(buildHurtAttrs(STATE.attrs, severity), hurtResult, true), severity);
      syncUserStatsToBoxScore(hurtResult, hurtStats);
      userGameStats.push(hurtStats);
      const poH = STATE.season.playoffStats;
      poH.pts += hurtStats.pts; poH.reb += hurtStats.reb; poH.ast += hurtStats.ast;
      poH.stl += hurtStats.stl; poH.blk += hurtStats.blk; poH.tov += hurtStats.tov;
      poH.fgm += hurtStats.fgm; poH.fga += hurtStats.fga;
      poH.ftm += hurtStats.ftm; poH.fta += hurtStats.fta;
      poH.threeM += hurtStats.threeM; poH.threeA += hurtStats.threeA;
      poH.mins = (poH.mins || 0) + hurtStats.mins;
      poH.games++;
      const hurtEntry = {
        game: gameNum + 1, myScore: hurtResult.scoreA, oppScore: hurtResult.scoreB,
        won: hurtWon, home: isHomeA,
        qScoresA: hurtResult.qScoresA, qScoresB: hurtResult.qScoresB,
        keyEvents: hurtResult.keyEvents, ot: hurtResult.ot,
        boxScore: hurtResult.boxScore,
        myStats: hurtStats,
        playedThroughInjury: true,
        injuryReason: skipEv.injuryReason || '伤病',
      };
      seriesGames.push(hurtEntry);
      renderPlayoffGameBrief(hurtEntry, teamA, teamB, true, roundName, gameNum + 1, 7, round, seriesIdx);
      maybeWorsenInjuryAfterPlaying(skipEv, severity);
      setTimeout(function() {
        simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum + 1, hurtNewWinsA, hurtNewWinsB, seriesGames, userGameStats, roundName, onDone);
      }, 600);
    };
    if (isMySeries && skipReason === 'injury' && shouldOfferPlayThroughInjury('po-season', false)) {
      showPlayThroughInjuryModal({
        desc: roundName + ' G' + (gameNum + 1) + ' 前，你仍在伤病名单里，系列赛比分是 ' + winsA + '-' + winsB + '。教练组把最终决定交给你。'
      }, runSkippedPlayoffGame, runPlayedThroughPlayoffGame);
      return;
    }
    runSkippedPlayoffGame();
    return;
  }
  
  const gameResult = simulateGameNew(teamA, teamB, seedBonus, userDebuff, { isHomeA: isHomeA, isB2B: false });
  const finalA = gameResult.scoreA;
  const finalB = gameResult.scoreB;
  const won = gameResult.won;
  const newWinsA = winsA + (won ? 1 : 0);
  const newWinsB = winsB + (won ? 0 : 1);
  
  const gameEntry = {
    game: gameNum + 1, myScore: finalA, oppScore: finalB,
    won, home: isHomeA,
    qScoresA: gameResult.qScoresA, qScoresB: gameResult.qScoresB,
    keyEvents: gameResult.keyEvents, ot: gameResult.ot,
    boxScore: gameResult.boxScore,
  };
  
  if (isMySeries) {
    const stats = generatePlayerStatsNew(STATE.attrs, gameResult, true);
    gameEntry.myStats = stats;
    userGameStats.push(stats);
    
    const po = STATE.season.playoffStats;
    po.pts += stats.pts; po.reb += stats.reb; po.ast += stats.ast;
    po.stl += stats.stl; po.blk += stats.blk; po.tov += stats.tov;
    po.fgm += stats.fgm; po.fga += stats.fga;
    po.ftm += stats.ftm; po.fta += stats.fta;
    po.threeM += stats.threeM; po.threeA += stats.threeA;
    po.mins = (po.mins || 0) + stats.mins;
    po.games++;
    
    // 🎯 一场一场弹：显示本场简报
    renderPlayoffGameBrief(gameEntry, teamA, teamB, true, roundName, gameNum + 1, 7, round, seriesIdx);
  }
  
  seriesGames.push(gameEntry);
  
  // 下一场（延迟600ms让用户看到简报动画，然后检测随机事件）
  setTimeout(function() {
    // ★ 赛后检测随机事件（仅限用户系列赛，简报显示完后才触发）
    if (isMySeries) {
      try {
        var poEvData = checkRandomEvents({ opponent: teamB, isWin: won, day: 0, simulated: true }, { won: won, scoreA: finalA, scoreB: finalB }, gameEntry.myStats || null);
        if (poEvData) {
          if (poEvData._consequence === 'suspension') {
            STATE.season.events.suspensionReason = poEvData.desc;
          } else if (poEvData._consequence === 'injury') {
            STATE.season.events.injuryReason = poEvData.desc;
          }
          if (typeof showEventModal === 'function') {
            showEventModal(poEvData, function() {
              setTimeout(function() {
                simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum + 1, newWinsA, newWinsB, seriesGames, userGameStats, roundName, onDone);
              }, 600);
            });
            return;
          }
        }
      } catch(ex) {}
    }
    simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, gameNum + 1, newWinsA, newWinsB, seriesGames, userGameStats, roundName, onDone);
  }, isMySeries ? 600 : 50);
}

/** 主要入口：模拟季后赛系列赛（用户系列赛一场一场弹） */
function simPlayoffSeries(round, seriesIdx) {
  trackEvent({act:"click",blk:"BMC098",pos:"TC12",label:"开始系列赛"});
  const bracket = STATE.season.playoffBracket;
  if (!bracket) return;
  
  const series = bracket.rounds[round]?.[seriesIdx];
  if (!series || series.winner) return;
  
  const isMySeries = series.high?.team === STATE.careerTeam || series.low?.team === STATE.careerTeam;
  
  let teamA, teamB;
  if (isMySeries) {
    teamA = STATE.careerTeam;
    teamB = series.high?.team === teamA ? series.low?.team : series.high?.team;
  } else {
    teamA = series.high?.team;
    teamB = series.low?.team;
  }
  
  const roundName = ['首轮', '分区半决赛', '分区决赛'][round] || '第'+(round+1)+'轮';
  
  // 清空旧简报，开始新的系列赛
  clearPlayoffGamecast();
  
  if (isMySeries) {
    // 显示"开始"提示
    const gc = document.getElementById('playoff-gamecast');
    if (gc) {
      gc.style.display = 'block';
      gc.innerHTML = `<div style="font-size:11px;color:var(--orange);padding:4px 0;font-family:var(--font-display);">🏀 ${roundName} · ${getTeamName(teamA)} vs ${getTeamName(teamB)} 开始</div>`;
    }
  }
  
  // 用递归一场一场模拟
  simOnePlayoffGame(round, seriesIdx, teamA, teamB, isMySeries, 0, 0, 0, [], [], roundName, (winsA, winsB, seriesGames, userGameStats) => {
    // ===== 系列赛结束 =====
    const aWon = winsA >= 4;
    const winner = aWon ? teamA : teamB;
    const winnerWins = aWon ? winsA : winsB;
    const loserWins = aWon ? winsB : winsA;
    series.winner = winner;
    
    const result = {
      round, seriesIdx, roundName,
      teamA, teamB, winner, winnerWins, loserWins,
      winsA, winsB, aWon, seriesGames, isMySeries,
    };
    bracket.results.push(result);
    
    // 更新下一轮对阵（联盟规则：1v8胜者vs4v5胜者，2v7胜者vs3v6胜者）
    if (round < 2) {
      const nextRound = bracket.rounds[round + 1];
      if (nextRound) {
        var nextIdx, isHigh;
        if (round === 0) {
          nextIdx = (seriesIdx === 0 || seriesIdx === 3) ? 0 : 1;
          isHigh = (seriesIdx === 0 || seriesIdx === 1);
        } else {
          nextIdx = 0;
          isHigh = seriesIdx === 0;
        }
        if (nextRound[nextIdx] === null) nextRound[nextIdx] = { high: null, low: null, winner: null };
        if (isHigh) nextRound[nextIdx].high = { team: winner };
        else nextRound[nextIdx].low = { team: winner };
      }
    } else if (round === 2) {
      bracket.confChampion = winner;
    }
    
    // ★ 自动模拟同轮其他系列赛（使用完整引擎，快速）
    const mySeriesIdx = seriesIdx;
    const otherSeries = bracket.rounds[round]
      .map((s, i) => ({ series: s, idx: i }))
      .filter(({ series: s, idx }) => s && !s.winner && idx !== mySeriesIdx);
    
    for (const { series: s, idx } of otherSeries) {
      const sTeamA = s.high?.team;
      const sTeamB = s.low?.team;
      if (!sTeamA || !sTeamB) continue;
      
      // ★ 首轮根据种子排名计算 seedBonus
      let sb = 0;
      if (round === 0) {
        const highIdx = bracket.teams.findIndex(t => t.team === sTeamA);
        const lowIdx = bracket.teams.findIndex(t => t.team === sTeamB);
        if (highIdx >= 0 && lowIdx >= 0) {
          const gapSeed = Math.abs(highIdx - lowIdx);
          sb = 0.4 * gapSeed;
          sb = highIdx < lowIdx ? sb : -sb;
        }
      }
      
      let sWA = 0, sWB = 0;
      const sGames = [];
      const sTeamAIsHigherSeed = isTeamAHigherPlayoffSeed(sTeamA, sTeamB);
      for (let g = 0; g < 7 && sWA < 4 && sWB < 4; g++) {
        const isHomeA = isPlayoffTeamAHome(g, sTeamAIsHigherSeed);
        const gr = simulateGameNew(sTeamA, sTeamB, sb, null, { isHomeA: isHomeA, isB2B: false });
        if (gr.won) sWA++; else sWB++;
        sGames.push({ myScore: gr.scoreA, oppScore: gr.scoreB, won: gr.won, home: isHomeA, qScoresA: gr.qScoresA, qScoresB: gr.qScoresB, boxScore: gr.boxScore });
      }
      const sWinner = sWA >= 4 ? sTeamA : sTeamB;
      s.winner = sWinner;
      bracket.results.push({
        round, seriesIdx: idx, roundName,
        teamA: sTeamA, teamB: sTeamB, winner: sWinner,
        winnerWins: sWA >= 4 ? sWA : sWB, loserWins: sWA >= 4 ? sWB : sWA,
        winsA: sWA, winsB: sWB, aWon: sWA >= 4, seriesGames: sGames, isMySeries: false,
      });
      if (round < 2) {
        const nr = bracket.rounds[round + 1];
        if (nr) {
          var ni2, isHigh2;
          if (round === 0) {
            ni2 = (idx === 0 || idx === 3) ? 0 : 1;
            isHigh2 = (idx === 0 || idx === 1);
          } else {
            ni2 = 0;
            isHigh2 = idx === 0;
          }
          if (nr[ni2] === null) nr[ni2] = { high: null, low: null, winner: null };
          if (isHigh2) nr[ni2].high = { team: sWinner };
          else nr[ni2].low = { team: sWinner };
        }
      } else if (round === 2) bracket.confChampion = sWinner;
    }
    
    // 检查是否所有同轮系列赛都完成了
    const allDone = bracket.rounds[round].every(s => s?.winner);
    if (allDone && round < 2) bracket.currentRound = round + 1;
    
    // ★ 先设置淘汰标志，确保后续所有渲染都能看到
    const userWonSeries = isMySeries ? (teamA === STATE.careerTeam ? aWon : !aWon) : false;
    if (isMySeries && !userWonSeries) STATE.season.playoffEliminated = true;
    if (isMySeries && !userWonSeries) STATE.season.playoffsDone = true;
    
    // ★ 分区决赛完成 → 先设置总决赛 (第3轮) 对阵（在用户跳转前执行）
    if (round === 2 && allDone) {
      const otherBracket = STATE.season.otherBracket;
      bracket.otherConfChampion = otherBracket?.confChampion || simOtherConference(bracket.conf === 'SOUTH' ? 'NORTH' : 'SOUTH');
      const finalsRound = bracket.rounds[3];
      if (finalsRound && finalsRound[0] === null) {
        finalsRound[0] = {
          high: { team: bracket.confChampion },
          low: { team: bracket.otherConfChampion },
          winner: null,
        };
        bracket.currentRound = 3;
      }
    }
    
    if (typeof queueSeasonAutoSave === 'function') queueSeasonAutoSave();

    // 如果是用户的系列赛，直接刷新页面
    if (isMySeries) {
      if (userWonSeries) {
        // ★ 总决赛夺冠标记
        if (round === 3) {
          STATE.season.isChampion = true;
          STATE.season.playoffsDone = true;
          STATE.season.awards = STATE.season.awards || [];
          STATE.season.awards.push({ act: 'champion', label: '🏆 总冠军', winner: getMyPlayerDisplayName(), winnerId: '', team: STATE.careerTeam, isUser: true });
          var poStats = STATE.season.playoffStats || {};
          if (poStats.games > 0 && (poStats.pts || 0) / poStats.games >= 20) {
            STATE.season.awards.push({ act: 'fmvp', label: '👑 总决赛MVP', winner: getMyPlayerDisplayName(), winnerId: '', team: STATE.careerTeam, isUser: true });
          }
          // ★ 成就系统：记录夺冠
          if (window.CONQUEST_API) {
            setTimeout(function() { CONQUEST_API.recordChampionship(); }, 100);
          }
          showSeasonResults();
          return;
        }
      }
      if (!userWonSeries) {
        clearPlayoffGamecast();
        renderPlayoffBracketUI();
        if (typeof showManualSaveToast === 'function') showManualSaveToast('季后赛已被淘汰');
        return;
      }
      clearPlayoffGamecast();
      renderPlayoffBracketUI();
      return;
    }
    
    renderPlayoffBracketUI();
  });
}
/** 模拟另一分区的季后赛，返回冠军球队（使用联盟对阵：1v8/4v5/2v7/3v6） */
function simOtherConference(conf) {
  const sorted = getConferenceSorted(conf);
  const teams = sorted.slice(0, 8).map(t => t.team);
  if (teams.length < 8) return teams[0] || '';
  
  // 让首轮胜者自然进入正确半区：1/8 vs 4/5、2/7 vs 3/6。
  const bracketOrder = [0, 7, 3, 4, 1, 6, 2, 5];
  let roundTeams = bracketOrder.map(i => teams[i]);
  
  // 3轮7场4胜
  const simSeries = (tA, tB) => {
    const teamAIsHigherSeed = isTeamAHigherPlayoffSeed(tA, tB);
    let wA = 0, wB = 0;
    for (let g = 0; g < 7 && wA < 4 && wB < 4; g++) {
      const isHomeA = isPlayoffTeamAHome(g, teamAIsHigherSeed);
      const result = simulateGameNew(tA, tB, 0, null, { isHomeA: isHomeA, isB2B: false });
      if (result.won) wA++;
      else wB++;
    }
    return wA >= 4 ? tA : tB;
  };
  
  for (let r = 0; r < 3; r++) {
    const winners = [];
    for (let i = 0; i < roundTeams.length; i += 2) {
      if (i + 1 >= roundTeams.length) { winners.push(roundTeams[i]); break; }
      winners.push(simSeries(roundTeams[i], roundTeams[i + 1]));
    }
    roundTeams = winners;
  }
  return roundTeams[0];
}

function maybeRecordFirstSixtyWinMilestone() {
  var c = STATE.career;
  if (!c || !STATE.season) return false;
  c.flags = c.flags || {};
  if (c.flags.firstSixtyWinCelebrated) return false;
  var wins = STATE.season.wins || 0;
  if (wins < 60) return false;
  c.flags.firstSixtyWinCelebrated = true;
  STATE.season._sixtyWinPageNotice = wins;
  return true;
}

/** 季后赛比赛详情弹窗（各节比分 + 你的数据 + 全队BoxScore） */
function showPlayoffGamePopup(round, seriesIdx, gameIdx) {
  const bracket = STATE.season.playoffBracket;
  if (!bracket) return;
  const result = bracket.results.find(r => r.round === round && r.seriesIdx === seriesIdx);
  if (!result || !result.seriesGames || !result.seriesGames[gameIdx]) return;
  
  const g = result.seriesGames[gameIdx];
  const isUserA = result.teamA === STATE.careerTeam;
  const myTeam = STATE.careerTeam;
  const myScore = isUserA ? g.myScore : g.oppScore;
  const oppScore = isUserA ? g.oppScore : g.myScore;
  const oppName = isUserA ? result.teamB : result.teamA;
  const myTeamTag = isUserA ? result.teamA : result.teamB;
  const oppTeamTag = isUserA ? result.teamB : result.teamA;
  const qLabels = ['Q1', 'Q2', 'Q3', 'Q4'];
  
  // 四节比分
  let quartersHtml = '';
  if (g.qScoresA && g.qScoresB) {
    for (let q = 0; q < 4; q++) {
      const qA = g.qScoresA[q] || 0;
      const qB = g.qScoresB[q] || 0;
      const myQ = isUserA ? qA : qB;
      const oppQ = isUserA ? qB : qA;
      quartersHtml += `<div style="display:flex;gap:4px;padding:3px 0;font-size:12px;border-bottom:1px solid var(--border);">
        <span style="width:28px;color:var(--text-muted);font-size:10px;">${qLabels[q]}</span>
        <span style="flex:1;text-align:center;font-weight:${myQ > oppQ ? 700 : 400};color:${myQ > oppQ ? 'var(--green)' : 'var(--text-dim)'};">${myQ}</span>
        <span style="flex:1;text-align:center;font-weight:${oppQ > myQ ? 700 : 400};color:${oppQ > myQ ? 'var(--green)' : 'var(--text-dim)'};">${oppQ}</span>
      </div>`;
    }
  }
  
  // 本场你的球员数据（精确到每场！）
  let myStatsHtml = '';
  if (g.myStats) {
    const s = g.myStats;
    const pct = s.fga > 0 ? Math.round(s.fgm / s.fga * 100) : 0;
    const threePct = s.threeA > 0 ? Math.round(s.threeM / s.threeA * 100) : 0;
    myStatsHtml = `
      <div style="padding:8px 14px 4px;">
        <div style="font-size:12px;color:var(--orange);margin-bottom:4px;">📊 我的球员 · 本场数据</div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          <span style="background:var(--orange-bg);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;color:var(--orange);">${s.pts}</div>
            <div style="font-size:8px;color:var(--text-muted);">得分</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;">${s.reb}</div>
            <div style="font-size:8px;color:var(--text-muted);">篮板</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:44px;">
            <div style="font-size:16px;font-weight:700;">${s.ast}</div>
            <div style="font-size:8px;color:var(--text-muted);">助攻</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${Math.round(s.stl)}</div>
            <div style="font-size:8px;color:var(--text-muted);">断</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${Math.round(s.blk)}</div>
            <div style="font-size:8px;color:var(--text-muted);">帽</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 8px;border-radius:6px;text-align:center;min-width:36px;">
            <div style="font-size:14px;font-weight:700;">${Math.round(s.tov)}</div>
            <div style="font-size:8px;color:var(--text-muted);">误</div>
          </span>
        </div>
        <div style="margin-top:4px;font-size:10px;color:var(--text-dim);text-align:center;">
          投篮 ${s.fgm}-${s.fga} (${pct}%) · 三分 ${s.threeM}-${s.threeA} (${threePct}%)
        </div>
      </div>`;
  } else {
    // 没有本场数据时显示季后赛场均
    const po = STATE.season.playoffStats;
    const poG = po.games || 1;
    myStatsHtml = `
      <div style="padding:8px 14px 4px;">
        <div style="font-size:12px;color:var(--orange);margin-bottom:4px;">📊 我的季后赛场均</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <span style="background:var(--orange-bg);padding:4px 10px;border-radius:6px;text-align:center;min-width:50px;">
            <div style="font-size:16px;font-weight:700;color:var(--orange);">${Math.round(po.pts/poG*10)/10}</div>
            <div style="font-size:9px;color:var(--text-muted);">得分</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 10px;border-radius:6px;text-align:center;min-width:50px;">
            <div style="font-size:16px;font-weight:700;">${Math.round(po.reb/poG*10)/10}</div>
            <div style="font-size:9px;color:var(--text-muted);">篮板</div>
          </span>
          <span style="background:var(--bg-card);padding:4px 10px;border-radius:6px;text-align:center;min-width:50px;">
            <div style="font-size:16px;font-weight:700;">${Math.round(po.ast/poG*10)/10}</div>
            <div style="font-size:9px;color:var(--text-muted);">助攻</div>
          </span>
        </div>
      </div>`;
  }
  
  // 全队BoxScore — 各队得分前5的球员
  let boxHtml = '';
  if (g.boxScore) {
    const homeBox = g.boxScore[myTeamTag] || [];
    const awayBox = g.boxScore[oppTeamTag] || [];
    
    // 按得分排序取前5
    const topHome = [...homeBox].sort((a, b) => b.pts - a.pts).slice(0, 5);
    const topAway = [...awayBox].sort((a, b) => b.pts - a.pts).slice(0, 5);
    
    function renderBoxRows(players, label, isHome) {
      let h = `<div style="margin-top:6px;">
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:2px;font-weight:600;">${label}</div>`;
      players.forEach(p => {
        const isU = p.isUser;
        h += `<div style="display:flex;gap:2px;padding:2px 0;font-size:9px;border-bottom:1px solid var(--border-light);${isU ? 'background:var(--orange-dim);border-radius:4px;padding:2px 4px;' : ''}">
          <span style="width:14px;font-size:8px;color:var(--text-muted);">${p.pos || '—'}</span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:${isU ? 700 : 400};${isU ? 'color:var(--orange);' : ''}">${p.name}</span>
          <span style="width:18px;text-align:right;font-weight:600;">${p.pts}</span>
          <span style="width:14px;text-align:right;">${p.reb}</span>
          <span style="width:14px;text-align:right;">${p.ast}</span>
          <span style="width:22px;text-align:right;font-size:8px;">${p.fgm}-${p.fga}</span>
        </div>`;
      });
      h += `</div>`;
      return h;
    }
    
    boxHtml = '';
  }
  
  // 关键事件
  
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:310px;">
      <div class="modal-header" style="padding:8px 12px;">
        <span style="font-family:var(--font-display);font-size:14px;">
          ${g.won ? '✅' : '❌'} G${g.game}: ${myScore}-${oppScore}
        </span>
        <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">✕</button>
      </div>
      <div style="text-align:center;padding:3px 10px 6px;font-size:11px;color:var(--text-dim);border-bottom:1px solid var(--border);">
        ${result.roundName} · ${getTeamName(myTeam)} vs ${getTeamName(oppName)} · ${g.home ? '主场' : '客场'} ${g.ot ? '· ' + (g.ot > 1 ? g.ot+'OT' : 'OT') : ''}
      </div>
      
      ${quartersHtml ? `<div style="padding:4px 12px 3px;">${quartersHtml}</div>` : 
        `<div style="padding:8px 12px;text-align:center;font-size:12px;font-weight:700;">全场 ${myScore} - ${oppScore}</div>`
      }
      
      ${myStatsHtml}
      ${boxHtml}
    </div>`;
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
  document.body.appendChild(modal);
}

