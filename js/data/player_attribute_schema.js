/**
 * 球员属性唯一语义规范。
 *
 * HAN 表示持球状态下的运球控制、变向稳定性和护球能力，对应 NBA 2K 的
 * Ball Handle。NBA 2K 的 Hands 表示接球和处理来球的可靠性，不能写入 HAN。
 */
var PLAYER_ATTRIBUTE_SCHEMA = Object.freeze({
  version: 2,
  fields: Object.freeze({
    HAN: Object.freeze({
      label: '控球/护球',
      meaning: '持球状态下的运球控制、变向稳定性和失误保护能力',
      nba2kAttribute: 'Ball Handle',
      excludedNba2kAttribute: 'Hands',
      excludedMeaning: '接球和处理来球的可靠性',
    }),
  }),
  NBA2K_ATTRIBUTE_MAP: Object.freeze({
    threePT: 'Three-Point',
    MID: 'Mid-Range',
    FIN: 'Close Shot',
    DNK: 'Driving Dunk',
    HAN: 'Ball Handle',
    PAS: 'Pass Accuracy',
    PDEF: 'Perimeter D',
    STL: 'Steal',
    IDEF: 'Interior D',
    BLK: 'Block',
    REB: 'Def. Rebound',
    ATH: 'Agility',
    STR: 'Strength',
  }),
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PLAYER_ATTRIBUTE_SCHEMA;
}
