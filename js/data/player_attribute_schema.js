/**
 * 球员属性唯一语义规范 V3。
 *
 * V9 的现实球员属性按球员逐个建立画像：详细 2K 技能是主基线，实际赛季
 * 数据只校正可观察产量。OVR 只作为名单显示/审计锚点，不反向平移属性。
 * HAN 仅表示 NBA 2K Ball Handle（控球）；Hands 永远不得写入 HAN。
 */
var PLAYER_ATTRIBUTE_SCHEMA = Object.freeze({
  version: 3,
  calibration: Object.freeze({
    method: 'per-player-semantic-v9',
    ovrUsedForAttributeFitting: false,
    uniformShiftForbidden: true,
  }),
  fields: Object.freeze({
    threePT: Object.freeze({ label: '三分', meaning: '三分投射能力', nba2kAttribute: 'Three-Point' }),
    MID: Object.freeze({ label: '中投', meaning: '中距离投射能力', nba2kAttribute: 'Mid-Range' }),
    FIN: Object.freeze({ label: '终结', meaning: '篮下近筐、上篮与造犯规的综合终结能力', nba2kAttributes: ['Close Shot','Layup','Draw Foul'] }),
    DNK: Object.freeze({ label: '扣篮', meaning: '结合位置的行进间/站立扣篮能力', nba2kAttributes: ['Driving Dunk','Standing Dunk'] }),
    HAN: Object.freeze({
      label: '控球',
      meaning: '持球状态下的运球控制、变向稳定性和持球保护能力',
      nba2kAttribute: 'Ball Handle',
      excludedNba2kAttribute: 'Hands',
      excludedMeaning: '接球和处理来球的可靠性',
    }),
    PAS: Object.freeze({ label: '传球', meaning: '传球准确性、判断与视野的综合组织能力', nba2kAttributes: ['Pass Accuracy','Pass IQ','Pass Vision'] }),
    PDEF: Object.freeze({ label: '外防', meaning: '外线单防、协防判断和传球路线感知', nba2kAttributes: ['Perimeter D','Help Defense IQ','Pass Perception','Def. Consistency'] }),
    STL: Object.freeze({ label: '抢断', meaning: '直接抢断、传球路线破坏与外线施压的综合制造失误能力', nba2kAttributes: ['Steal','Pass Perception','Perimeter D'] }),
    IDEF: Object.freeze({ label: '内防', meaning: '内线对抗、协防、护框站位的综合能力', nba2kAttributes: ['Interior D','Help Defense IQ','Strength','Def. Consistency','Block'] }),
    BLK: Object.freeze({ label: '盖帽', meaning: '封盖与护框垂直威胁', nba2kAttributes: ['Block','Interior D','Vertical'] }),
    REB: Object.freeze({ label: '篮板', meaning: '防守篮板、进攻篮板和卡位对抗的综合能力', nba2kAttributes: ['Def. Rebound','Off. Rebound','Strength'] }),
    ATH: Object.freeze({ label: '速度', meaning: '速度与敏捷性的综合运动能力', nba2kAttributes: ['Speed','Agility'] }),
    STR: Object.freeze({ label: '力量', meaning: '身体对抗力量', nba2kAttribute: 'Strength' }),
    CLU: Object.freeze({ label: '关键', meaning: '关键回合稳定性；不用于填补 OVR 差值' }),
  }),
  NBA2K_ATTRIBUTE_MAP: Object.freeze({
    threePT: 'Three-Point', MID: 'Mid-Range', HAN: 'Ball Handle', STR: 'Strength'
  }),
});

if (typeof module !== 'undefined' && module.exports) module.exports = PLAYER_ATTRIBUTE_SCHEMA;
