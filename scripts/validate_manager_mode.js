const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp, Error, Promise, Set, Map, Uint8Array });
context.window = context;
context.globalThis = context;

function run(file) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  vm.runInContext(source, context, { filename: file });
}

run('js/data/league_players.js');
run('js/data/league_schedule.js');
run('js/data/simulation_config.js');
run('js/data/fictional_team_names.js');
run('js/manager/state.js');
run('js/manager/engine.js');

const sourceLeague = vm.runInContext('JSON.parse(JSON.stringify(LEAGUE_PLAYER_DATA))', context);
const teamIds = vm.runInContext('LEAGUE_TEAM_IDS.slice()', context);
const state = vm.runInContext('ManagerState.create(LEAGUE_TEAM_IDS[0], LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS, generateLeagueSchedule, SIM_CONFIG)', context);
const roster = state.leagueData[state.selectedTeam];
const validRotation = vm.runInContext('ManagerState.validateRotation', context)(roster, state.rotation);
if (!validRotation.valid || validRotation.totalMinutes !== 240) throw new Error('合法轮换校验失败');

const invalidRotation = vm.runInContext('ManagerState.deepClone', context)(state.rotation);
const firstId = Object.keys(invalidRotation)[0];
invalidRotation[firstId].minutes += 1;
const invalidResult = vm.runInContext('ManagerState.validateRotation', context)(roster, invalidRotation);
if (invalidResult.valid || !invalidResult.errors.some(error => error.includes('240'))) throw new Error('非法轮换未被拒绝');
const invalidState = vm.runInContext('ManagerState.deepClone', context)(state);
invalidState.rotation = invalidRotation;
let invalidSimulationRejected = false;
try { enginePlaceholder(); } catch (error) { invalidSimulationRejected = true; }

function enginePlaceholder() {
  vm.runInContext('ManagerEngine.simulateRemainingRegularSeason', context)(invalidState);
}
if (!invalidSimulationRejected) throw new Error('非法轮换仍可推进赛季');

const engine = vm.runInContext('ManagerEngine', context);
const userStepState = vm.runInContext('ManagerState.create(LEAGUE_TEAM_IDS[0], LEAGUE_PLAYER_DATA, LEAGUE_TEAM_IDS, generateLeagueSchedule, SIM_CONFIG)', context);
const userStep = engine.simulateNextUserRegularGame(userStepState);
if (!userStep.result || (userStep.result.home !== userStepState.selectedTeam && userStep.result.away !== userStepState.selectedTeam)) throw new Error('下一步没有停在用户球队比赛');
const userRegularScheduleCount = userStepState.season.schedule.filter(game => game.home === userStepState.selectedTeam || game.away === userStepState.selectedTeam).length;
if (userRegularScheduleCount !== 82) throw new Error('用户常规赛赛程数量不正确');
const sourceBefore = JSON.stringify(sourceLeague);
const regularGames = engine.simulateRemainingRegularSeason(state);
if (regularGames !== 1230 || state.season.games.filter(game => game.phase === 'regular').length !== 1230) throw new Error('完整常规赛场数不正确');
if (state.season.phase !== 'playoffs') throw new Error('常规赛结束后未进入季后赛');
const playerStatRows = engine.playerStatRows(state);
if (!playerStatRows.length || !playerStatRows.every(row => row.games > 0 && row.points >= 0)) throw new Error('球员赛季统计未正确生成');
const playoffGames = engine.simulateRemainingPostseason(state);
if (!playoffGames || state.season.phase !== 'complete' || !state.season.champion) throw new Error('季后赛未决出冠军');
if (JSON.stringify(sourceLeague) !== sourceBefore) throw new Error('经理引擎修改了共享基础数据');
if (state.career || state.careerTeam || state.finalOVR || state.achievements) throw new Error('经理状态包含玩家生涯字段');

const roundTrip = vm.runInContext('ManagerState.normalize', context)(JSON.parse(JSON.stringify(state)));
if (roundTrip.mode !== 'manager' || roundTrip.selectedTeam !== state.selectedTeam || roundTrip.season.champion !== state.season.champion) throw new Error('经理存档 round-trip 失败');

console.log(JSON.stringify({
  rotation240: validRotation.totalMinutes === 240,
  invalidRotationRejected: !invalidResult.valid,
  invalidSimulationRejected,
  nextStepStopsAtUserGame: true,
  userRegularScheduleCount,
  regularGames,
  playerStatRows: playerStatRows.length,
  playoffGames,
  champion: state.season.champion,
  sourceLeagueUnchanged: JSON.stringify(sourceLeague) === sourceBefore,
  playerStateUntouched: !state.career && !state.careerTeam && !state.finalOVR,
  roundTrip: roundTrip.mode === 'manager'
}, null, 2));
