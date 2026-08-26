const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp, Error, Promise, Set, Map, Uint8Array });
context.window = context;
context.globalThis = context;

function run(file, target = context) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(source, target, { filename: file });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createFakeIndexedDb(records) {
  const data = records;
  const db = {
    objectStoreNames: { contains: name => name === 'manager_saves' },
    close() {},
    transaction(name) {
      if (name !== 'manager_saves') throw new Error('错误的存储对象');
      const tx = {};
      const complete = callback => {
        setTimeout(() => {
          try {
            callback();
            if (tx.oncomplete) tx.oncomplete();
          } catch (error) {
            tx.error = error;
            if (tx.onerror) tx.onerror();
          }
        }, 0);
      };
      const store = {
        put(value, key) {
          const request = {};
          complete(() => { data[key] = JSON.parse(JSON.stringify(value)); request.result = key; });
          return request;
        },
        get(key) {
          const request = {};
          complete(() => { request.result = data[key]; });
          return request;
        },
        delete(key) {
          const request = {};
          complete(() => { delete data[key]; request.result = undefined; });
          return request;
        }
      };
      tx.objectStore = () => store;
      return tx;
    }
  };
  return {
    open() {
      const request = {};
      setTimeout(() => {
        request.result = db;
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    }
  };
}

async function validateManagerSlotIsolation() {
  const records = {
    manager_slot_1: { mode: 'manager', selectedTeam: 'OLD' },
    player_slot_1: { mode: 'player', career: { id: 'personal-save-must-remain' } }
  };
  const storageContext = vm.createContext({ console, Date, JSON, Object, Array, Number, String, Boolean, Error, Promise });
  storageContext.window = storageContext;
  storageContext.globalThis = storageContext;
  storageContext.indexedDB = createFakeIndexedDb(records);
  storageContext.ManagerState = {
    deepClone: value => JSON.parse(JSON.stringify(value)),
    normalize: value => value
  };
  run('js/manager/storage.js', storageContext);
  await storageContext.ManagerStorage.clear();
  assert(!Object.prototype.hasOwnProperty.call(records, 'manager_slot_1'), '重开没有清除经理槽位');
  assert(records.player_slot_1 && records.player_slot_1.career.id === 'personal-save-must-remain', '重开错误影响个人模式存档标识');
}

function combinations(items, count) {
  const result = [];
  function visit(start, selected) {
    if (selected.length === count) {
      result.push(selected.slice());
      return;
    }
    for (let index = start; index <= items.length - (count - selected.length); index++) {
      selected.push(items[index]);
      visit(index + 1, selected);
      selected.pop();
    }
  }
  visit(0, []);
  return result;
}

function findAcceptedPackage(engine, tradeState, teamIds, outgoingCount, incomingCount) {
  const outgoingPackages = combinations(tradeState.leagueData[tradeState.selectedTeam], outgoingCount);
  for (const partnerTeam of teamIds) {
    if (partnerTeam === tradeState.selectedTeam) continue;
    const incomingPackages = combinations(tradeState.leagueData[partnerTeam] || [], incomingCount);
    for (const outgoing of outgoingPackages) {
      for (const incoming of incomingPackages) {
        const proposal = engine.evaluateTrade(tradeState, outgoing.map(player => player.id), incoming.map(player => player.id));
        if (proposal.valid && proposal.accepted) return { partnerTeam, outgoing, incoming, proposal };
      }
    }
  }
  return null;
}

run('js/data/league_players.js');
run('js/data/league_schedule.js');
run('js/data/simulation_config.js');
run('js/data/fictional_team_names.js');
run('js/manager/state.js');
run('js/manager/engine.js');

async function main() {
  const sourceLeague = vm.runInContext('JSON.parse(JSON.stringify(LEAGUE_PLAYER_DATA))', context);
  const teamIds = vm.runInContext('LEAGUE_TEAM_IDS.slice()', context);
  const createState = vm.runInContext('ManagerState.create', context);
  const deepClone = vm.runInContext('ManagerState.deepClone', context);
  const normalize = vm.runInContext('ManagerState.normalize', context);
  const validateRotation = vm.runInContext('ManagerState.validateRotation', context);
  const state = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  const engine = vm.runInContext('ManagerEngine', context);
  const roster = state.leagueData[state.selectedTeam];
  const validRotation = validateRotation(roster, state.rotation);
  assert(validRotation.valid && validRotation.totalMinutes === 240, '合法轮换校验失败');

  const invalidRotation = deepClone(state.rotation);
  const firstId = Object.keys(invalidRotation)[0];
  invalidRotation[firstId].minutes += 1;
  const invalidResult = validateRotation(roster, invalidRotation);
  assert(invalidResult.valid === false && invalidResult.errors.some(error => error.includes('240')), '非法轮换未被拒绝');
  const invalidState = deepClone(state);
  invalidState.rotation = invalidRotation;
  let invalidSimulationRejected = false;
  try {
    engine.simulateRemainingRegularSeason(invalidState);
  } catch (error) {
    invalidSimulationRejected = true;
  }
  assert(invalidSimulationRejected, '非法轮换仍可推进赛季');

  const inactivePlayer = roster.find(player => Number(state.rotation[player.id].minutes) === 0);
  assert(inactivePlayer, '测试需要一名默认未激活球员');
  [-1, 1.5, 49].forEach(minutes => {
    const rotation = deepClone(state.rotation);
    rotation[inactivePlayer.id].minutes = minutes;
    assert(!validateRotation(roster, rotation).valid, '分钟 ' + minutes + ' 未被拒绝');
  });
  const zeroMinuteRotation = deepClone(state.rotation);
  zeroMinuteRotation[inactivePlayer.id].minutes = 0;
  assert(validateRotation(roster, zeroMinuteRotation).valid, '0 分钟应表示未进入轮换且保持合法');

  const userStepState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  const userStep = engine.simulateNextUserRegularGame(userStepState);
  assert(userStep.result && (userStep.result.home === userStepState.selectedTeam || userStep.result.away === userStepState.selectedTeam), '下一步没有停在用户球队比赛');
  const userRegularScheduleCount = userStepState.season.schedule.filter(game => game.home === userStepState.selectedTeam || game.away === userStepState.selectedTeam).length;
  assert(userRegularScheduleCount === 82, '用户常规赛赛程数量不正确');

  const conference = vm.runInContext('SIM_CONFIG.CONFERENCE.NORTH.slice()', context);
  const rankingState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  conference.forEach(id => { rankingState.season.standings[id] = { wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 }; });
  rankingState.season.standings[conference[0]] = { wins: 1, losses: 0, pointsFor: 100, pointsAgainst: 90 };
  rankingState.season.standings[conference[1]] = { wins: 1, losses: 1, pointsFor: 200, pointsAgainst: 180 };
  const rankedConference = engine.standingsList(rankingState, 'NORTH');
  assert(rankedConference.indexOf(conference[0]) < rankedConference.indexOf(conference[1]), '排名没有让 1-0 排在 1-1 前');
  const appSource = fs.readFileSync(path.join(root, 'js/manager/app.js'), 'utf8');
  assert(appSource.includes('ManagerEngine.overallStandingsList(current)'), '经理主页没有复用统一排名结果');
  assert(appSource.includes('SEASON_CALENDAR_MONTHS') && appSource.includes('renderSeasonCalendar(current, userSchedule)') && appSource.includes('data-action="simulate-to-season-day"'), '经理赛季页没有使用日历式赛程和按日推进操作');
  assert(appSource.includes('seasonImportantEvents') && appSource.includes('赛季大事 / SEASON NOTES') && !appSource.includes('MY GAME LOG'), '经理赛季页应以重要事项替代重复的逐场比赛记录');

  const homeSeries = { homeSeed: 'HOME', awaySeed: 'AWAY' };
  const homePattern = [0, 1, 2, 3, 4, 5, 6].map(index => engine.seriesHomeTeam(homeSeries, index) === 'HOME' ? 'H' : 'A');
  assert(homePattern.join(',') === 'H,H,A,A,H,A,H', '七场系列赛主场顺序不是 2-2-1-1-1');

  const ownerScores = [];
  const ownerLabels = new Set();
  for (let wins = 0; wins <= 82; wins++) {
    const evaluationState = deepClone(state);
    evaluationState.season.standings[evaluationState.selectedTeam].wins = wins;
    evaluationState.season.userRound = 0;
    evaluationState.season.champion = null;
    const evaluation = engine.evaluateOwner(evaluationState);
    ownerScores.push(evaluation.score);
  }
  assert(ownerScores.every((score, index) => index === 0 || score >= ownerScores[index - 1]), '董事会评分没有随胜场单调提升');
  const nearTargetState = deepClone(state);
  nearTargetState.season.standings[nearTargetState.selectedTeam].wins = nearTargetState.owner.goal.targetWins - 1;
  const zeroWinsState = deepClone(state);
  zeroWinsState.season.standings[zeroWinsState.selectedTeam].wins = 0;
  assert(engine.evaluateOwner(nearTargetState).score - engine.evaluateOwner(zeroWinsState).score >= 30, '董事会评分无法区分 0 胜和接近目标');
  [0, Math.ceil(state.owner.goal.targetWins * 0.7), state.owner.goal.targetWins].forEach(wins => {
    const evaluationState = deepClone(state);
    evaluationState.season.standings[evaluationState.selectedTeam].wins = wins;
    ownerLabels.add(engine.evaluateOwner(evaluationState).label);
  });
  const exceedingState = deepClone(state);
  exceedingState.season.standings[exceedingState.selectedTeam].wins = state.owner.goal.targetWins + 8;
  exceedingState.season.userRound = state.owner.goal.targetRound + 1;
  ownerLabels.add(engine.evaluateOwner(exceedingState).label);
  ['低于预期', '仍有机会', '达到预期', '超出预期'].forEach(label => assert(ownerLabels.has(label), '董事会标签不可达：' + label));

  const sameSeedState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  assert(state.rngState === sameSeedState.rngState, '相同球队和赛季没有生成确定性随机种子');
  const seeds = teamIds.map(id => createState(id, sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context)).rngState);
  assert(new Set(seeds).size === seeds.length, '不同球队仍出现初始随机种子碰撞');

  const oldSave = deepClone(state);
  oldSave.version = 1;
  delete oldSave.season.playerStats;
  delete oldSave.season.playerStatGameKeys;
  delete oldSave.season.games;
  delete oldSave.season.standings;
  delete oldSave.season.scheduleIndex;
  delete oldSave.season.playoffs;
  delete oldSave.rotation;
  delete oldSave.owner;
  const migrated = normalize(oldSave);
  assert(migrated.version === 5 && migrated.season.playerStats && migrated.season.playerStatGameKeys && Array.isArray(migrated.season.games) && migrated.season.standings && Number.isInteger(migrated.season.scheduleIndex) && migrated.season.playoffs === null && migrated.rotation && migrated.owner.goal && migrated.owner.evaluation === null && Array.isArray(migrated.tradeHistory), '旧经理存档没有完成字段迁移');
  assert(Array.isArray(engine.standingsList(migrated, 'NORTH')) && Array.isArray(engine.playerStatRows(migrated)), '旧经理存档无法打开球队排名或球员统计');
  let corruptSaveError = null;
  try {
    normalize({ mode: 'manager', selectedTeam: teamIds[0], leagueData: {}, season: {} });
  } catch (error) {
    corruptSaveError = error;
  }
  assert(corruptSaveError && /存档|名单|赛季/.test(corruptSaveError.message) && !/TypeError/.test(corruptSaveError.message), '损坏存档没有返回可理解错误');

  const tradeState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  const tradeSourceBefore = JSON.stringify(sourceLeague);
  const outgoing = tradeState.leagueData[tradeState.selectedTeam].slice().sort((first, second) => (Number(first.ovr) || 0) - (Number(second.ovr) || 0))[0];
  const partnerTeam = teamIds.find(teamId => teamId !== tradeState.selectedTeam);
  const tradeProposals = engine.tradeTargets(tradeState, outgoing.id, partnerTeam);
  assert(tradeProposals.length === tradeState.leagueData[partnerTeam].length, '交易目标没有覆盖交易对象全部球员');
  assert(tradeProposals.every(proposal => proposal.valid && proposal.outgoing[0].player.id === outgoing.id && proposal.incoming[0].teamId === partnerTeam), '交易目标归属或评估不正确');
  const acceptedProposal = tradeProposals.find(proposal => proposal.accepted);
  assert(acceptedProposal, '测试未找到可接受的一换一交易');
  const originalUserRosterSize = tradeState.leagueData[tradeState.selectedTeam].length;
  const originalPartnerRosterSize = tradeState.leagueData[partnerTeam].length;
  const executedTrade = engine.executeTrade(tradeState, outgoing.id, acceptedProposal.incoming[0].player.id);
  assert(executedTrade.trade && tradeState.tradeHistory.length === 1, '接受交易没有写入交易记录');
  assert(tradeState.leagueData[tradeState.selectedTeam].length === originalUserRosterSize && tradeState.leagueData[partnerTeam].length === originalPartnerRosterSize, '一换一交易错误改变球队名单数量');
  assert(tradeState.leagueData[tradeState.selectedTeam].some(player => player.id === acceptedProposal.incoming[0].player.id) && !tradeState.leagueData[tradeState.selectedTeam].some(player => player.id === outgoing.id), '用户球队名单没有正确交换球员');
  assert(tradeState.leagueData[partnerTeam].some(player => player.id === outgoing.id) && !tradeState.leagueData[partnerTeam].some(player => player.id === acceptedProposal.incoming[0].player.id), '交易对象球队名单没有正确交换球员');
  assert(validateRotation(tradeState.leagueData[tradeState.selectedTeam], tradeState.rotation).valid, '交易后的轮换没有保持或恢复合法');
  assert(JSON.stringify(sourceLeague) === tradeSourceBefore, '经理交易修改了共享基础数据');
  const rejectedProposal = tradeProposals.find(proposal => !proposal.accepted);
  let rejectedTradeBlocked = true;
  if (rejectedProposal) {
    const rejectedState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
    let rejectionError = null;
    try {
      engine.executeTrade(rejectedState, outgoing.id, rejectedProposal.incoming[0].player.id);
    } catch (error) {
      rejectionError = error;
    }
    assert(rejectionError && /不接受|回报不足/.test(rejectionError.message) && rejectedState.tradeHistory.length === 0, '被拒绝交易仍被执行');
    rejectedTradeBlocked = !!rejectionError;
  }
  const closedWindowState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  closedWindowState.season.phase = 'playoffs';
  const closedProposal = engine.evaluateTrade(closedWindowState, outgoing.id, acceptedProposal.incoming[0].player.id);
  assert(!closedProposal.valid && /交易窗口已关闭/.test(closedProposal.reason), '季后赛交易窗口没有关闭');
  const tradeRoundTrip = normalize(JSON.parse(JSON.stringify(tradeState)));
  assert(tradeRoundTrip.version === 5 && tradeRoundTrip.tradeHistory.length === 1 && tradeRoundTrip.tradeHistory[0].received[0].id === acceptedProposal.incoming[0].player.id, '交易记录无法随经理存档保存');

  const twoForOneState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  const twoForOne = findAcceptedPackage(engine, twoForOneState, teamIds, 2, 1);
  assert(twoForOne, '测试未找到可接受的多换一交易');
  const twoForOneUserSize = twoForOneState.leagueData[twoForOneState.selectedTeam].length;
  const twoForOnePartnerSize = twoForOneState.leagueData[twoForOne.partnerTeam].length;
  const twoForOneResult = engine.executeTrade(twoForOneState, twoForOne.outgoing.map(player => player.id), twoForOne.incoming.map(player => player.id));
  assert(twoForOneResult.trade.sent.length === 2 && twoForOneResult.trade.received.length === 1, '多换一没有写入完整资产包');
  assert(twoForOneState.leagueData[twoForOneState.selectedTeam].length === twoForOneUserSize - 1 && twoForOneState.leagueData[twoForOne.partnerTeam].length === twoForOnePartnerSize + 1, '多换一名单数量不正确');
  assert(twoForOne.incoming.every(player => twoForOneState.leagueData[twoForOneState.selectedTeam].some(candidate => candidate.id === player.id)) && twoForOne.outgoing.every(player => !twoForOneState.leagueData[twoForOneState.selectedTeam].some(candidate => candidate.id === player.id)), '多换一用户名单没有正确交换');
  assert(validateRotation(twoForOneState.leagueData[twoForOneState.selectedTeam], twoForOneState.rotation).valid, '多换一后轮换没有保持或恢复合法');

  const oneForTwoState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  const oneForTwo = findAcceptedPackage(engine, oneForTwoState, teamIds, 1, 2);
  assert(oneForTwo, '测试未找到可接受的一换多交易');
  const oneForTwoUserSize = oneForTwoState.leagueData[oneForTwoState.selectedTeam].length;
  const oneForTwoPartnerSize = oneForTwoState.leagueData[oneForTwo.partnerTeam].length;
  const oneForTwoResult = engine.executeTrade(oneForTwoState, oneForTwo.outgoing.map(player => player.id), oneForTwo.incoming.map(player => player.id));
  assert(oneForTwoResult.trade.sent.length === 1 && oneForTwoResult.trade.received.length === 2, '一换多没有写入完整资产包');
  assert(oneForTwoState.leagueData[oneForTwoState.selectedTeam].length === oneForTwoUserSize + 1 && oneForTwoState.leagueData[oneForTwo.partnerTeam].length === oneForTwoPartnerSize - 1, '一换多名单数量不正确');
  assert(oneForTwo.incoming.every(player => oneForTwoState.leagueData[oneForTwoState.selectedTeam].some(candidate => candidate.id === player.id)) && oneForTwo.outgoing.every(player => !oneForTwoState.leagueData[oneForTwoState.selectedTeam].some(candidate => candidate.id === player.id)), '一换多用户名单没有正确交换');
  assert(validateRotation(oneForTwoState.leagueData[oneForTwoState.selectedTeam], oneForTwoState.rotation).valid, '一换多后轮换没有保持或恢复合法');

  const packageValidationState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  const packageUserRoster = packageValidationState.leagueData[packageValidationState.selectedTeam];
  const packagePartnerRoster = packageValidationState.leagueData[partnerTeam];
  const tooManyPlayers = engine.evaluateTrade(packageValidationState, packageUserRoster.slice(0, 4).map(player => player.id), [packagePartnerRoster[0].id]);
  const duplicatePlayer = engine.evaluateTrade(packageValidationState, [packageUserRoster[0].id, packageUserRoster[0].id], [packagePartnerRoster[0].id]);
  const mixedPartner = engine.evaluateTrade(packageValidationState, [packageUserRoster[0].id], [packagePartnerRoster[0].id, packageValidationState.leagueData[teamIds.find(teamId => teamId !== packageValidationState.selectedTeam && teamId !== partnerTeam)][0].id]);
  assert(!tooManyPlayers.valid && /最多选择/.test(tooManyPlayers.reason), '四人资产包没有被拒绝');
  assert(!duplicatePlayer.valid && /重复/.test(duplicatePlayer.reason), '重复球员资产包没有被拒绝');
  assert(!mixedPartner.valid && /同一支/.test(mixedPartner.reason), '跨球队得到资产包没有被拒绝');

  const versionThreeTradeSave = deepClone(state);
  versionThreeTradeSave.version = 3;
  versionThreeTradeSave.tradeHistory = [{ id: 'legacy-trade', userTeam: state.selectedTeam, partnerTeam, sent: { id: outgoing.id, name: outgoing.cname || outgoing.name || outgoing.id }, received: { id: acceptedProposal.incoming[0].player.id, name: acceptedProposal.incoming[0].player.cname || acceptedProposal.incoming[0].player.name || acceptedProposal.incoming[0].player.id }, acceptedMargin: 0, scheduleIndex: 0, rotationReset: false, createdAt: '2026-01-01T00:00:00.000Z' }];
  const versionThreeMigrated = normalize(versionThreeTradeSave);
  assert(versionThreeMigrated.version === 5 && versionThreeMigrated.tradeHistory[0].sent.length === 1 && versionThreeMigrated.tradeHistory[0].received.length === 1, 'v3 一换一交易记录没有迁移为资产包');

  const inquiryState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  const inquiryOutgoing = inquiryState.leagueData[inquiryState.selectedTeam].slice().sort((first, second) => (Number(second.ovr) || 0) - (Number(first.ovr) || 0)).slice(0, 2).map(player => player.id);
  const inquiryBefore = JSON.stringify(inquiryState);
  const inquiryResult = engine.inquireTrade(inquiryState, inquiryOutgoing);
  assert(inquiryResult.valid && inquiryResult.offers.length > 0, '问价没有返回感兴趣球队的报价');
  assert(JSON.stringify(inquiryState) === inquiryBefore, '问价不应修改经理状态');
  assert(new Set(inquiryResult.offers.map(offer => offer.partnerTeam)).size === inquiryResult.offers.length, '同一球队返回了多份问价报价');
  assert(inquiryResult.offers.every(offer => offer.accepted && offer.partnerTeam !== inquiryState.selectedTeam && offer.outgoing.length === inquiryOutgoing.length && offer.incoming.length >= 1 && offer.incoming.length <= 3 && offer.outgoing.every(location => location.teamId === inquiryState.selectedTeam) && offer.incoming.every(location => location.teamId === offer.partnerTeam)), '问价报价的球队归属或资产包数量不正确');
  const inquiryOffer = inquiryResult.offers[0];
  const inquiryOfferCheck = engine.evaluateTrade(inquiryState, inquiryOutgoing, inquiryOffer.incoming.map(location => location.player.id));
  assert(inquiryOfferCheck.valid && inquiryOfferCheck.accepted, '问价返回了不可执行报价');
  const singlePlayerInquiry = engine.inquireTrade(inquiryState, inquiryOutgoing.slice(0, 1));
  const threePlayerInquiry = engine.inquireTrade(inquiryState, inquiryState.leagueData[inquiryState.selectedTeam].slice().sort((first, second) => (Number(second.ovr) || 0) - (Number(first.ovr) || 0)).slice(0, 3).map(player => player.id));
  assert(singlePlayerInquiry.valid && singlePlayerInquiry.outgoing.length === 1, '单人资产包无法发起问价');
  assert(threePlayerInquiry.valid && threePlayerInquiry.outgoing.length === 3, '三人资产包无法发起问价');
  const emptyInquiry = engine.inquireTrade(inquiryState, []);
  const oversizedInquiry = engine.inquireTrade(inquiryState, inquiryState.leagueData[inquiryState.selectedTeam].slice(0, 4).map(player => player.id));
  assert(!emptyInquiry.valid && /至少选择/.test(emptyInquiry.reason), '空资产包仍可发起问价');
  assert(!oversizedInquiry.valid && /最多选择/.test(oversizedInquiry.reason), '超过三人的资产包仍可发起问价');
  const closedInquiryState = createState(teamIds[0], sourceLeague, teamIds, vm.runInContext('generateLeagueSchedule', context), vm.runInContext('SIM_CONFIG', context));
  closedInquiryState.season.phase = 'playoffs';
  const closedInquiry = engine.inquireTrade(closedInquiryState, inquiryOutgoing);
  assert(!closedInquiry.valid && /交易窗口已关闭/.test(closedInquiry.reason), '季后赛仍可发起问价');

  const sourceBefore = JSON.stringify(sourceLeague);
  const regularGames = engine.simulateRemainingRegularSeason(state);
  assert(regularGames === 1230 && state.season.games.filter(game => game.phase === 'regular').length === 1230, '完整常规赛场数不正确');
  assert(state.season.phase === 'playoffs', '常规赛结束后未进入季后赛');
  const playerStatRows = engine.playerStatRows(state);
  assert(playerStatRows.length && playerStatRows.every(row => row.games > 0 && row.points >= 0), '球员赛季统计未正确生成');
  const playoffGames = engine.simulateRemainingPostseason(state);
  assert(playoffGames && state.season.phase === 'complete' && state.season.champion, '季后赛未决出冠军');
  const playoffIds = state.season.games.filter(game => game.phase === 'playoffs').map(game => game.index);
  assert(new Set(playoffIds).size === playoffIds.length, '季后赛比赛 ID 不唯一');
  assert(JSON.stringify(sourceLeague) === sourceBefore, '经理引擎修改了共享基础数据');
  assert(!state.career && !state.careerTeam && !state.finalOVR && !state.achievements, '经理状态包含玩家生涯字段');

  const roundTrip = normalize(JSON.parse(JSON.stringify(state)));
  assert(roundTrip.mode === 'manager' && roundTrip.selectedTeam === state.selectedTeam && roundTrip.season.champion === state.season.champion, '经理存档 round-trip 失败');
  await validateManagerSlotIsolation();

  console.log(JSON.stringify({
    rotation240: validRotation.totalMinutes === 240,
    invalidRotationRejected: !invalidResult.valid,
    invalidMinutesRejected: true,
    invalidSimulationRejected,
    nextStepStopsAtUserGame: true,
    userRegularScheduleCount,
    winPercentageRanking: true,
    homePattern: homePattern.join(','),
    ownerEvaluationLabels: Array.from(ownerLabels).sort(),
    deterministicDistinctSeeds: true,
    oldSaveMigrated: true,
    corruptSaveHandled: true,
    tradeTargets: tradeProposals.length,
    acceptedTradeExecuted: true,
    twoForOneTradeExecuted: true,
    oneForTwoTradeExecuted: true,
    tradePackageValidation: true,
    versionThreeTradeMigrated: true,
    tradeInquiryOffers: inquiryResult.offers.length,
    tradeInquiryStateUntouched: true,
    tradeInquiryValidation: true,
    rejectedTradeBlocked,
    postseasonTradeBlocked: true,
    tradeHistoryRoundTrip: true,
    regularGames,
    playerStatRows: playerStatRows.length,
    playoffGames,
    uniquePlayoffIds: true,
    champion: state.season.champion,
    sourceLeagueUnchanged: JSON.stringify(sourceLeague) === sourceBefore,
    playerStateUntouched: !state.career && !state.careerTeam && !state.finalOVR,
    managerSlotIsolation: true,
    roundTrip: roundTrip.mode === 'manager'
  }, null, 2));
}

main().catch(error => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
