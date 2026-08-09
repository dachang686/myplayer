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
runSource(read('js/player_display_names.js'), 'js/player_display_names.js');
runSource(read('js/awards.js'), 'js/awards.js');

const teams = vm.runInContext('LEAGUE_TEAM_IDS.slice()', context);
const players = vm.runInContext('LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team])', context);
const draftPools = vm.runInContext('[ROOKIE_NAMES, DRAFT_CLASS_2027, STAR_ROOKIES]', context);
const draftPlayers = draftPools.flat();
const failures = [];

if (players.length !== 525) failures.push(`球员数量应为 525，实际为 ${players.length}`);
if (new Set(players.map((player) => player.id)).size !== players.length) failures.push('球员 ID 不唯一');
players.forEach((player, index) => {
  const expectedId = `P${String(index + 1).padStart(4, '0')}`;
  if (player.id !== expectedId) failures.push(`球员顺序 ID 错误：${player.id || '(空)'}，应为 ${expectedId}`);
  if (Object.prototype.hasOwnProperty.call(player, 'name') || Object.prototype.hasOwnProperty.call(player, 'nameEN')) {
    failures.push(`${player.id} 仍含英文姓名字段`);
  }
  if (!player.cname || player.cname !== player.shortName || /[-A-Za-z]/.test(player.cname)) {
    failures.push(`${player.id} 的 cname 不是规范中文姓氏：${player.cname || '(空)'}`);
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

let baselineCompared = false;
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
    teams.forEach((team) => {
      const currentRoster = vm.runInContext(`LEAGUE_PLAYER_DATA[${JSON.stringify(team)}]`, context);
      const baselineRoster = baselineData[team] || [];
      if (currentRoster.length !== baselineRoster.length) failures.push(`${team} 阵容人数相对原基线发生变化`);
      currentRoster.forEach((player, index) => {
        const baselinePlayer = baselineRoster[index];
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
  failures.push(`无法读取 Git 基线：${error.message}`);
}

const legacyPlayer = { ...players[0], name: 'Legacy Player' };
delete legacyPlayer.id;
const legacySnapshot = {
  league: { ATL: [legacyPlayer] },
  state: {
    usedPlayers: ['Legacy Player'],
    _shownThisTeam: ['Legacy Player'],
    selectedPlayer: { ...legacyPlayer },
    attrSlots: { threePT: { player: 'Legacy Player' } },
    career: { flags: { bondedTeammate: { name: 'Legacy Player' }, superstarRecruiterEN: 'Legacy Player' } },
    season: {
      _npcSeasonProfiles: { 'ATL:Legacy Player': { sample: true } },
      leaguePlayerSeasonStats: { 'Legacy Player': { gp: 1 } },
      awards: [{ winnerEN: 'Legacy Player', players: [{ name: 'Legacy Player' }] }]
    },
    _leagueChanges: { retired: [{ nameEN: 'Legacy Player' }] }
  },
  ages: { 'Legacy Player': 23 },
  genes: { 'Legacy Player': { sample: true } }
};
context.__legacySnapshot = legacySnapshot;
vm.runInContext('migrateLegacySavePlayerIdentity(__legacySnapshot)', context);
const migrated = context.__legacySnapshot;
const migratedId = migrated.league.ATL[0].id;
if (!migratedId) failures.push('旧存档球员未迁移到稳定 ID');
if (migrated.league.ATL[0].name || migrated.state.selectedPlayer.name) failures.push('旧存档迁移后仍保留英文姓名');
if (migrated.state.usedPlayers[0] !== migratedId || migrated.state.attrSlots.threePT.player !== migratedId) {
  failures.push('旧存档玩法引用未迁移到球员 ID');
}

const result = {
  teams: teams.length,
  players: players.length,
  uniqueIds: new Set(players.map((player) => player.id)).size,
  draftPlayers: draftPlayers.length,
  legacyEnglishNameFields: players.filter((player) => player.name || player.nameEN).length,
  gameplayBaselineCompared: baselineCompared,
  legacySaveMigratedTo: migratedId
};

if (failures.length) {
  console.error(failures.slice(0, 30).join('\n'));
  if (failures.length > 30) console.error(`另有 ${failures.length - 30} 项错误`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify(result));
}
