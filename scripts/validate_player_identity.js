const fs = require('fs');
const path = require('path');
const vm = require('vm');
const childProcess = require('child_process');

const root = path.resolve(__dirname, '..');
const context = { console };
context.window = context;
vm.createContext(context);

function runSource(source, filename, target = context) {
  vm.runInContext(source, target, { filename });
}

function read(relative) {
  return fs.readFileSync(path.join(root, relative), 'utf8');
}

runSource(read('js/data/league_players.js'), 'js/data/league_players.js');
runSource(read('js/data/draft_data.js'), 'js/data/draft_data.js');
runSource(read('js/awards.js'), 'js/awards.js');

const teams = vm.runInContext('LEAGUE_TEAM_IDS.slice()', context);
const players = vm.runInContext('LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team])', context);
const draftPools = vm.runInContext('[ROOKIE_NAMES, DRAFT_CLASS_2027, STAR_ROOKIES]', context);
const draftPlayers = draftPools.flat();
const failures = [];

if (players.length !== 525) failures.push(`球员数量应为 525，实际为 ${players.length}`);
if (new Set(players.map((player) => player.id)).size !== players.length) failures.push('球员 ID 不唯一');
players.forEach((player) => {
  if (Object.prototype.hasOwnProperty.call(player, 'name') || Object.prototype.hasOwnProperty.call(player, 'nameEN')) {
    failures.push(`${player.id} 仍含英文姓名字段`);
  }
  if (!player.cname || /[-A-Za-z]/.test(player.cname) || Object.prototype.hasOwnProperty.call(player, 'shortName')) {
    failures.push(`${player.id} 的 cname 不是规范中文姓氏：${player.cname || '(空)'}`);
  }
  if (!Number.isInteger(player.STL) || player.STL < 25 || player.STL > 99) {
    failures.push(`${player.id} 的 STL 无效：${player.STL}`);
  }
});

if (new Set(draftPlayers.map((player) => player.id)).size !== draftPlayers.length) failures.push('新秀 ID 不唯一');
draftPlayers.forEach((player) => {
  if (!player.id) failures.push(`新秀 ${player.cn || '(未知)'} 缺少 ID`);
  if (Object.prototype.hasOwnProperty.call(player, 'en') || Object.prototype.hasOwnProperty.call(player, 'nameEN')) {
    failures.push(`新秀 ${player.id || '(未知)'} 仍含英文姓名字段`);
  }
  if (!player.cn || /[-A-Za-z]/.test(player.cn)) {
    failures.push(`新秀 ${player.id || '(未知)'} 的 cn 不是规范中文姓氏：${player.cn || '(空)'}`);
  }
});
const starIdentityWorks = vm.runInContext(
  "isMvpStar({ id: 'D26-01' }) && isMvpStar({ _prospectId: 'S001' }) && " +
  "getMvpStarAllLeagueStart({ _prospectId: 'S001' }) === 2030 && " +
  "getMvpStarAllLeagueStart({ _prospectId: 'S004' }) === 2031",
  context
);
if (!starIdentityWorks) failures.push('明星新秀未按来源 ID 正确识别');

const html = read('index.html');
const escapeSeasonUiTextStart = html.indexOf('function escapeSeasonUiText');
const escapeSeasonUiTextEnd = html.indexOf('function bindSeasonRankingInteractions', escapeSeasonUiTextStart);
if (escapeSeasonUiTextStart < 0 || escapeSeasonUiTextEnd < 0) {
  failures.push('未找到昵称 HTML 转义工具');
} else {
  const escapeSeasonUiText = new Function(
    `${html.slice(escapeSeasonUiTextStart, escapeSeasonUiTextEnd)}\nreturn escapeSeasonUiText;`,
  )();
  const hostileNickname = '<img src=x onerror=alert(1)>';
  if (escapeSeasonUiText(hostileNickname) !== '&lt;img src=x onerror=alert(1)&gt;') {
    failures.push('昵称 HTML 转义结果错误');
  }
  const protectedNicknameSinks = [
    /class="big-cname">\$\{escapeSeasonUiText\(getMyPlayerDisplayName\(\)\)\}<\/div>/,
    /var displayName = escapeSeasonUiText\(typeof getMyPlayerDisplayName === 'function' \? getMyPlayerDisplayName\(\) : '我的球员'\);/,
    /class="mc-name">\$\{escapeSeasonUiText\(getMyPlayerDisplayName\(\)\)\}<\/span>/,
  ];
  if (!protectedNicknameSinks.every((pattern) => pattern.test(html))) {
    failures.push('昵称写入 HTML 的展示页未统一转义');
  }
}
const positionLogicStart = html.indexOf('// ==================== 跨位置衰减 ====================');
const positionLogicEnd = html.indexOf('// ==================== 初始化 ====================', positionLogicStart);
if (positionLogicStart < 0 || positionLogicEnd < 0) {
  failures.push('未找到跨位置折损逻辑');
} else {
  const positionContext = {
    towns: JSON.parse(JSON.stringify(players.find((player) => player.cname === '唐斯') || null)),
    SIM_CONFIG: {
      POS_AVG: {
        PG: { REB: 60, FIN: 90 },
        SG: { REB: 65, FIN: 85 },
        SF: { REB: 70, FIN: 80 },
        PF: { REB: 80, FIN: 75 },
        C: { REB: 90, FIN: 70 }
      }
    }
  };
  vm.createContext(positionContext);
  runSource(html.slice(positionLogicStart, positionLogicEnd), 'index.html:position-penalty', positionContext);
  const multiPositionPenaltyWorks = vm.runInContext(
    "getBuildPlayerPositions({ pos: 'C / PF' }).join(',') === 'C,PF' && " +
    "getPlayerMainPos({ pos: 'C / PF' }) === 'C' && " +
    "playerCanPlayPosition({ pos: 'C / PF' }, 'PF') && " +
    "towns && towns.pos === 'C / PF' && getPlayerPosPenalty('PF', towns, 'REB') === 1 && " +
    "getPlayerPosPenalty('PF', { pos: 'C / PF' }, 'REB') === 1 && " +
    "getPlayerPosPenalty('C', { pos: 'C / PF' }, 'REB') === 1 && " +
    "getPosPenalty('PG', 'SG') === 0.9 && getPosPenalty('SG', 'PG') === 0.9 && " +
    "getPosPenalty('SG', 'SF') === 0.9 && getPosPenalty('SF', 'PF') === 0.9 && getPosPenalty('PF', 'C') === 0.9 && " +
    "getPosPenalty('PG', 'SF') === 0.8 && getPosPenalty('SG', 'C') === 0.8 && getPosPenalty('PG', 'C') === 0.8 && " +
    "getPlayerPosPenalty('SF', { pos: 'C / PF' }, 'REB') === 0.9 && " +
    "getPlayerPosPenalty('PG', { pos: 'C / PF' }, 'REB') === 0.8",
    positionContext
  );
  if (!multiPositionPenaltyWorks) failures.push('多位置球员的跨位置折损规则错误');
}
const ageMatch = html.match(/<script id=['"]player-age-data['"] type=['"]application\/json['"]>([\s\S]*?)<\/script>/);
if (!ageMatch) {
  failures.push('未找到球员年龄数据');
} else {
  const ages = JSON.parse(ageMatch[1]);
  ages.forEach((row) => {
    if (!row.id || Object.prototype.hasOwnProperty.call(row, 'n') || Object.prototype.hasOwnProperty.call(row, 'name')) {
      failures.push('球员年龄数据仍使用姓名键');
    }
  });
}

const teamAgeHelperStart = html.indexOf('function getSeasonTeamPlayerAge');
const teamAgeHelperEnd = html.indexOf('function showSeasonTeamModal', teamAgeHelperStart);
if (teamAgeHelperStart < 0 || teamAgeHelperEnd < 0) {
  failures.push('球队阵容缺少统一年龄读取逻辑');
} else {
  const getSeasonTeamPlayerAge = new Function(
    'STATE', 'getLeaguePlayerAge',
    `${html.slice(teamAgeHelperStart, teamAgeHelperEnd)}\nreturn getSeasonTeamPlayerAge;`,
  )({ career: { currentAge: 29 } }, player => player._testAge || 0);
  if (getSeasonTeamPlayerAge({ _isUser: true }) !== 29) failures.push('球队阵容中的玩家年龄读取错误');
  if (getSeasonTeamPlayerAge({ _testAge: 34 }) !== 34) failures.push('球队阵容中的联盟球员年龄读取错误');
}
if (!html.includes('class="season-team-age-cell"') || !html.includes('<th scope="col" title="球员年龄">年龄</th>') || !html.includes("' · ' + age + '岁'")) {
  failures.push('球队阵容或球员统计列表没有输出年龄');
}

let baselineCompared = false;
let baselineSkipped = false;
try {
  const trackedPlayerFiles = childProcess.execFileSync('git', ['ls-tree', '-r', '--name-only', 'HEAD', 'js/data'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).trim().split(/\r?\n/).filter((relative) => /players\.js$/.test(relative));
  const baselinePath = trackedPlayerFiles.find((relative) => relative !== 'js/data/league_players.js');
  const baselineSource = baselinePath
      ? childProcess.execFileSync('git', ['show', `HEAD:${baselinePath}`], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    })
    : '';
  if (baselineSource && /"name"\s*:/.test(baselineSource)) {
    const dataVariable = (baselineSource.match(/const\s+([A-Z][A-Z0-9_]*_DATA)\s*=/) || [])[1];
    const teamsVariable = (baselineSource.match(/const\s+([A-Z][A-Z0-9_]*_TEAMS)\s*=/) || [])[1];
    if (!dataVariable || !teamsVariable) throw new Error('无法识别历史球员数据变量');
    const baselineContext = {};
    baselineContext.window = baselineContext;
    vm.createContext(baselineContext);
    runSource(`${baselineSource}\nthis.__data = ${dataVariable}; this.__teams = ${teamsVariable};`, 'git:index:player_baseline.js', baselineContext);
    const baselineTeams = baselineContext.__teams;
    const baselineData = baselineContext.__data;
    const gameplayFields = ['pos', 'height', 'type', 'ovr', 'threePT', 'MID', 'FIN', 'DNK', 'HAN', 'PAS', 'PDEF', 'IDEF', 'BLK', 'REB', 'ATH', 'STR', 'CLU'];
    if (JSON.stringify(teams) !== JSON.stringify(baselineTeams)) failures.push('球队顺序相对原基线发生变化');
    const baselinePlayers = baselineTeams.flatMap((team) => baselineData[team] || []);
    const baselineById = new Map(baselinePlayers.map((player) => [player.id, player]));
    const currentById = new Map(players.map((player) => [player.id, player]));
    if (baselineById.size !== currentById.size || [...baselineById.keys()].some((id) => !currentById.has(id))) {
      failures.push('球员 ID 覆盖范围相对原基线发生变化');
    }
    teams.forEach((team) => {
      const currentRoster = vm.runInContext(`LEAGUE_PLAYER_DATA[${JSON.stringify(team)}]`, context);
      currentRoster.forEach((player) => {
        const baselinePlayer = baselineById.get(player.id);
        if (!baselinePlayer) return;
        gameplayFields.forEach((field) => {
          if (player[field] !== baselinePlayer[field]) {
            failures.push(`${player.id} 的 ${field} 相对原基线发生变化`);
          }
        });
      });
    });
    baselineCompared = true;
  }
} catch (error) {
  // 压缩包/发布产物通常不带 .git；当前数据完整性检查仍然有效，基线比较仅在 Git 可用时执行。
  baselineSkipped = true;
  console.warn(`跳过 Git 基线比较：${error.message}`);
}

const result = {
  teams: teams.length,
  players: players.length,
  uniqueIds: new Set(players.map((player) => player.id)).size,
  draftPlayers: draftPlayers.length,
  legacyEnglishNameFields: players.filter((player) => player.name || player.nameEN).length,
  nicknameHtmlEscaping: !failures.some((failure) => failure.indexOf('昵称') >= 0),
  gameplayBaselineCompared: baselineCompared,
  gameplayBaselineSkipped: baselineSkipped
};

if (failures.length) {
  console.error(failures.slice(0, 30).join('\n'));
  if (failures.length > 30) console.error(`另有 ${failures.length - 30} 项错误`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result));
}
