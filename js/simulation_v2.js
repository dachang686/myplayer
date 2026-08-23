/* Quarter-level aggregate simulation engine.
 * V1 remains the default until this path passes the long-run comparison gate.
 * The engine deliberately does not use player OVR for offensive or defensive
 * event probabilities; OVR may still affect rotation selection upstream.
 */
(function installSimulationV2(global) {
  'use strict';

  function clamp(value, min, max) {
    var number = Number(value);
    if (!Number.isFinite(number)) number = 0;
    return Math.max(min, Math.min(max, number));
  }

  function norm(player, key) {
    return clamp(((parseInt(player && player[key], 10) || 50) - 25) / 74, 0, 1);
  }

  // 80 是联盟中性能力锚点。比赛事件使用压缩后的有效能力，
  // 但球队攻防诊断仍保留原始能力，用于统一的赛前胜率分差。
  var ATTRIBUTE_ANCHOR = (80 - 25) / 74;
  var OFFENSE_EFFECT_SCALE = 0.45;
  var DEFENSE_EFFECT_SCALE = 0.55;

  function anchoredMetric(value, scale) {
    return clamp(ATTRIBUTE_ANCHOR + (Number(value) - ATTRIBUTE_ANCHOR) * scale, 0, 1);
  }

  function offenseMetric(value) {
    return anchoredMetric(value, OFFENSE_EFFECT_SCALE);
  }

  function defenseMetric(value) {
    return anchoredMetric(value, DEFENSE_EFFECT_SCALE);
  }

  function normal(mean, deviation) {
    var u = Math.max(Math.random(), 0.000001);
    var v = Math.random();
    return mean + Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v) * deviation;
  }

  function sampleMakes(attempts, probability) {
    attempts = Math.max(0, Math.floor(Number(attempts) || 0));
    probability = clamp(probability, 0, 1);
    var made = 0;
    for (var attempt = 0; attempt < attempts; attempt++) {
      if (Math.random() < probability) made++;
    }
    return made;
  }

  function weightedMean(values, weights) {
    var sum = 0;
    var weightSum = 0;
    values.forEach(function(value, index) {
      var weight = Math.max(0, Number(weights[index]) || 0);
      sum += (Number(value) || 0) * weight;
      weightSum += weight;
    });
    return weightSum > 0 ? sum / weightSum : 0;
  }

  function allocateTotal(total, weights, caps) {
    total = Math.max(0, Math.round(Number(total) || 0));
    var safeWeights = weights.map(function(weight) { return Math.max(0.0001, Number(weight) || 0); });
    var safeCaps = (caps || safeWeights.map(function() { return total; })).map(function(cap) {
      return Math.max(0, Math.floor(Number(cap) || 0));
    });
    var capacity = safeCaps.reduce(function(sum, cap) { return sum + cap; }, 0);
    if (capacity < total) {
      var deficit = total - capacity;
      for (var extra = 0; extra < safeCaps.length && deficit > 0; extra++) {
        safeCaps[extra] += Math.ceil(deficit / Math.max(1, safeCaps.length - extra));
        deficit = total - safeCaps.reduce(function(sum, cap) { return sum + cap; }, 0);
      }
    }
    var weightSum = safeWeights.reduce(function(sum, weight) { return sum + weight; }, 0);
    var output = safeWeights.map(function(weight, index) {
      return Math.min(safeCaps[index], Math.floor(total * weight / weightSum * 0.72));
    });
    var remaining = total - output.reduce(function(sum, value) { return sum + value; }, 0);
    var guard = 0;
    while (remaining > 0 && guard++ < 10000) {
      var best = -1;
      var bestScore = -Infinity;
      output.forEach(function(value, index) {
        if (value >= safeCaps[index]) return;
        var score = safeWeights[index] / (value + 1);
        if (score > bestScore) {
          bestScore = score;
          best = index;
        }
      });
      if (best < 0) break;
      output[best]++;
      remaining--;
    }
    return output;
  }

  // 跨节累计的确定性出手配额。每节仍只分配已生成的出手数，但此前小数份额
  // 不会因逐节整数化而清零，深度替补可在后续节自然兑现累计机会。
  function allocatePeriodQuota(total, weights, caps, ledger) {
    total = Math.max(0, Math.round(Number(total) || 0));
    var safeWeights = weights.map(function(weight) { return Math.max(0.0001, Number(weight) || 0); });
    var safeCaps = caps.map(function(cap) { return Math.max(0, Math.floor(Number(cap) || 0)); });
    var state = ledger && typeof ledger === 'object' ? ledger : {};
    var quotaCarry = Array.isArray(state.quotaCarry) ? state.quotaCarry : safeWeights.map(function() { return 0; });
    var weightSum = safeWeights.reduce(function(sum, weight) { return sum + weight; }, 0);
    var capacity = safeCaps.reduce(function(sum, cap) { return sum + cap; }, 0);
    if (safeCaps.length !== safeWeights.length || quotaCarry.length !== safeWeights.length
      || !Number.isFinite(weightSum) || weightSum <= 0 || capacity < total
      || quotaCarry.some(function(value) { return !Number.isFinite(Number(value)) || Number(value) < 0; })) {
      throw new Error('[V2] 出手配额账本无效或容量不足');
    }
    // 60% 比例配额跨节结转，剩余 40% 保留原核心优先的残余竞争规则。
    // 这样小权重替补会累计到一次出手，而核心球员原有的残余竞争逻辑不被平均化。
    var quotas = safeWeights.map(function(weight, index) {
      var quota = total * weight / weightSum * 0.60 + Number(quotaCarry[index]);
      if (!Number.isFinite(quota) || quota < 0) throw new Error('[V2] 出手配额账本计算无效');
      return quota;
    });
    var output = quotas.map(function(quota, index) {
      return Math.min(safeCaps[index], Math.floor(quota));
    });
    // 多名球员的跨节余量可能在同一节同时达到整数。超出本节 FGA 时，
    // 回退最小的未兑现余量，并把该份额留在账本中等待后续节结算。
    var baseTotal = output.reduce(function(sum, value) { return sum + value; }, 0);
    while (baseTotal > total) {
      var rollbackIndex = -1;
      var smallestRemainder = Infinity;
      output.forEach(function(value, index) {
        if (value <= 0) return;
        var remainder = quotas[index] - (value - 1);
        if (remainder < smallestRemainder) {
          smallestRemainder = remainder;
          rollbackIndex = index;
        }
      });
      if (rollbackIndex < 0) throw new Error('[V2] 出手配额账本无法回退');
      output[rollbackIndex]--;
      baseTotal--;
    }
    quotaCarry = quotas.map(function(quota, index) { return quota - output[index]; });
    var remaining = total - output.reduce(function(sum, value) { return sum + value; }, 0);
    var guard = 0;
    while (remaining > 0 && guard++ < 10000) {
      var best = -1;
      var bestScore = -Infinity;
      safeWeights.forEach(function(weight, index) {
        if (output[index] >= safeCaps[index]) return;
        var score = weight / (output[index] + 1);
        if (score > bestScore) {
          bestScore = score;
          best = index;
        }
      });
      if (best < 0) break;
      output[best]++;
      remaining--;
    }
    var allocatedTotal = output.reduce(function(sum, value) { return sum + value; }, 0);
    if (allocatedTotal !== total
      || output.some(function(value, index) { return !Number.isFinite(value) || value < 0 || value > safeCaps[index]; })
      || quotaCarry.some(function(value) { return !Number.isFinite(value) || value < 0; })) {
      throw new Error('[V2] 出手配额无法完整分配');
    }
    state.quotaCarry = quotaCarry;
    return output;
  }

  function weightedRandomAllocation(total, weights, caps) {
    total = Math.max(0, Math.round(Number(total) || 0));
    var safeWeights = weights.map(function(weight) { return Math.max(0, Number(weight) || 0); });
    var safeCaps = (caps || safeWeights.map(function() { return total; })).map(function(cap) {
      return Math.max(0, Math.floor(Number(cap) || 0));
    });
    var output = safeWeights.map(function() { return 0; });
    for (var event = 0; event < total; event++) {
      var weightSum = 0;
      safeWeights.forEach(function(weight, index) {
        if (output[index] < safeCaps[index]) weightSum += weight;
      });
      if (weightSum <= 0) break;
      var roll = Math.random() * weightSum;
      var selected = -1;
      for (var index = 0; index < safeWeights.length; index++) {
        if (output[index] >= safeCaps[index]) continue;
        roll -= safeWeights[index];
        if (roll <= 0) {
          selected = index;
          break;
        }
      }
      if (selected < 0) {
        selected = safeWeights.findIndex(function(_, index) { return output[index] < safeCaps[index]; });
      }
      if (selected < 0) break;
      output[selected]++;
    }
    return output;
  }

  function contextForTeam(team, options) {
    var prepared = options._preparedRotations && options._preparedRotations[team];
    var rotation = prepared || prepareLeagueGameRotation(team, options);
    var players = rotation && Array.isArray(rotation.players) ? rotation.players : [];
    if (players.length < 5) {
      throw new Error('[V2] 无法生成有效轮换：' + team + '（可用球员不足5人）');
    }
    var minutes = rotation && Array.isArray(rotation.minutes)
      ? rotation.minutes.slice()
      : (rotation
        ? allocateLeagueRotationMinutes(players, rotation.roleRanks || [], { randomize: true })
        : []);
    var regulationMinutes = minutes.reduce(function(sum, value) { return sum + (Number(value) || 0); }, 0);
    if (minutes.length !== players.length
      || minutes.some(function(value) { return !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 48; })
      || Math.round(regulationMinutes) !== 240) {
      throw new Error('[V2] 无法生成有效轮换：' + team + '（常规赛分钟必须总计240且单人不超过48）');
    }
    var requestedUserMinutesFactor = options.userMinutesFactor == null ? 1 : Number(options.userMinutesFactor);
    if (!Number.isFinite(requestedUserMinutesFactor)) requestedUserMinutesFactor = 1;
    requestedUserMinutesFactor = clamp(requestedUserMinutesFactor, 0.55, 1);
    var appliedUserMinutesFactor = 1;
    // 仅剩五名可用球员时，带伤出战只能保留必要分钟；伤病仍通过属性因子生效。
    // 不能把五人全部压到48分钟以下后再强行补回，否则必然突破硬上限。
    if (options.userMinutesFactor != null && players.length > 5) {
      var userIndex = players.findIndex(function(player) { return !!player._isUser; });
      if (userIndex >= 0) {
        var originalUserMinutes = minutes[userIndex];
        var adjustedUserMinutes = Math.min(originalUserMinutes, Math.max(4, Math.round(originalUserMinutes * requestedUserMinutesFactor)));
        var minutesToRedistribute = Math.max(0, originalUserMinutes - adjustedUserMinutes);
        minutes[userIndex] = adjustedUserMinutes;
        if (minutesToRedistribute > 0) {
          var redistributionCaps = minutes.map(function(value, index) {
            return index === userIndex ? 0 : Math.max(0, 48 - value);
          });
          var redistributionCapacity = redistributionCaps.reduce(function(sum, cap) { return sum + cap; }, 0);
          if (redistributionCapacity < minutesToRedistribute) {
            throw new Error('[V2] 无法生成有效轮换：' + team + '（伤病分钟无法在48分钟上限内重分配）');
          }
          var redistributed = allocateTotal(
            minutesToRedistribute,
            minutes.map(function(value, index) { return index === userIndex ? 0 : Math.max(0.1, value); }),
            redistributionCaps,
          );
          if (redistributed.reduce(function(sum, value) { return sum + value; }, 0) !== minutesToRedistribute) {
            throw new Error('[V2] 无法生成有效轮换：' + team + '（伤病分钟重分配未完成）');
          }
          redistributed.forEach(function(value, index) { minutes[index] += value; });
        }
        appliedUserMinutesFactor = originalUserMinutes > 0 ? minutes[userIndex] / originalUserMinutes : 1;
      }
    }

    var adjustedMinutesTotal = minutes.reduce(function(sum, value) { return sum + (Number(value) || 0); }, 0);
    if (minutes.some(function(value) { return !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 48; })
      || Math.round(adjustedMinutesTotal) !== 240) {
      throw new Error('[V2] 无法生成有效轮换：' + team + '（伤病调整后常规赛分钟越过硬上限）');
    }

    var roleRanks = rotation.roleRanks || players.map(function(_, index) { return index; });
    if (!players.length) return null;
    var userAttributeSnapshot = {};

    function playerNorm(player, key) {
      var rawValue = parseInt(player && player[key], 10);
      if (!Number.isFinite(rawValue)) rawValue = 50;
      var snapshotKey = player && player.id || 'user';
      if (options._collectContext && player && player._isUser) {
        if (!userAttributeSnapshot[snapshotKey]) userAttributeSnapshot[snapshotKey] = {};
        userAttributeSnapshot[snapshotKey][key] = rawValue;
      }
      var value = norm({ [key]: rawValue }, key);
      if (player && player._isUser && options.userAttributeFactor != null) {
        var factor = clamp(Number(options.userAttributeFactor), 0.55, 1);
        rawValue = Math.max(25, rawValue * factor);
        value = clamp((rawValue - 25) / 74, 0, 1);
        if (options._collectContext && player && player._isUser) {
          userAttributeSnapshot[snapshotKey][key + '_after'] = rawValue;
        }
      }
      return value;
    }
    var weights = minutes.map(function(value) { return Math.max(0, Number(value) || 0); });
    var rawThree = players.map(function(player) { return playerNorm(player, 'threePT'); });
    var rawMid = players.map(function(player) { return playerNorm(player, 'MID'); });
    var rawFin = players.map(function(player) { return playerNorm(player, 'FIN'); });
    var rawDnk = players.map(function(player) { return playerNorm(player, 'DNK'); });
    var rawHan = players.map(function(player) { return playerNorm(player, 'HAN'); });
    var rawPas = players.map(function(player) { return playerNorm(player, 'PAS'); });
    var ath = players.map(function(player) { return playerNorm(player, 'ATH'); });
    var rawStr = players.map(function(player) { return playerNorm(player, 'STR'); });
    var rawReb = players.map(function(player) { return playerNorm(player, 'REB'); });
    var rawPdef = players.map(function(player) { return playerNorm(player, 'PDEF'); });
    var rawIdef = players.map(function(player) { return playerNorm(player, 'IDEF'); });
    var rawStl = players.map(function(player) { return playerNorm(player, 'STL'); });
    var rawBlk = players.map(function(player) { return playerNorm(player, 'BLK'); });
    var clu = players.map(function(player) { return playerNorm(player, 'CLU'); });

    var rawRimAbility = players.map(function(_, index) {
      return rawFin[index] * 0.55 + rawDnk[index] * 0.20 + ath[index] * 0.13 + rawStr[index] * 0.12;
    });
    var rawThreat = players.map(function(_, index) {
      var regions = [rawThree[index], rawMid[index], rawRimAbility[index]];
      regions.sort(function(a, b) { return b - a; });
      return regions[0] * 0.58 + regions[1] * 0.27 + regions[2] * 0.15;
    });
    var rawCreation = players.map(function(_, index) {
      return clamp(rawHan[index] * 0.45 + ath[index] * 0.25 + rawThreat[index] * 0.30, 0, 1);
    });
    var rawAttack = rawThreat.map(function(value, index) {
      return value * 0.58 + rawCreation[index] * 0.27 + ath[index] * 0.15;
    });
    var rawDefense = players.map(function(_, index) {
      return rawPdef[index] * 0.32 + rawIdef[index] * 0.28 + rawReb[index] * 0.14
        + rawBlk[index] * 0.16 + rawStr[index] * 0.10;
    });

    // 出手机会、角色和球员原始攻防评分继续使用原始能力，避免压缩整个
    // 联盟的得分生态；只有命中效率读取下方的 effective* 数组。
    var three = rawThree.slice();
    var mid = rawMid.slice();
    var fin = rawFin.slice();
    var dnk = rawDnk.slice();
    var han = rawHan.slice();
    var pas = rawPas.slice();
    var effectiveThree = rawThree.map(offenseMetric);
    var effectiveMid = rawMid.map(offenseMetric);
    var effectiveFin = rawFin.map(offenseMetric);
    var effectiveDnk = rawDnk.map(offenseMetric);
    var str = rawStr.slice();
    var effectiveReb = rawReb.map(defenseMetric);
    var reb = rawReb.map(function(value, index) {
      return value * 0.70 + effectiveReb[index] * 0.30;
    });
    var pdef = rawPdef.map(defenseMetric);
    var idef = rawIdef.map(defenseMetric);
    var stl = rawStl.map(defenseMetric);
    var blk = rawBlk.map(defenseMetric);
    var positions = players.map(function(player) { return String(player.pos || 'SF').split('/')[0].trim(); });

    var volumeThree = players.map(function(_, index) { return 0.18 + three[index] * 0.52; });
    var volumeMid = players.map(function(_, index) { return 0.16 + mid[index] * 0.30; });
    var volumeRim = players.map(function(_, index) {
      return 0.22 + fin[index] * 0.32 + dnk[index] * 0.18 + ath[index] * 0.10 + str[index] * 0.06;
    });
    var rimAbility = players.map(function(_, index) {
      return fin[index] * 0.55 + dnk[index] * 0.20 + ath[index] * 0.13 + str[index] * 0.12;
    });
    var threat = players.map(function(_, index) {
      var regions = [three[index], mid[index], rimAbility[index]];
      regions.sort(function(a, b) { return b - a; });
      return regions[0] * 0.58 + regions[1] * 0.27 + regions[2] * 0.15;
    });
    var creation = players.map(function(_, index) {
      return clamp(han[index] * 0.45 + ath[index] * 0.25 + threat[index] * 0.30, 0, 1);
    });
    var form = players.map(function(player) {
      if (player._isUser) {
        var baseForm = typeof getSeasonUsageBias === 'function'
          ? clamp(Math.sqrt(Number(getSeasonUsageBias()) || 1), 0.88, 1.12)
          : 1;
        var seasonMods = (STATE && STATE.season && STATE.season.mods) || {};
        var variance = (Number(seasonMods.formVariance) || 0)
          + (Number(seasonMods.mediaPressure) || 0) * 0.35;
        var varianceScale = clamp(1 + variance * 0.06, 0.55, 1.60);
        return clamp(baseForm + (normal(1, 0.055) - 1) * varianceScale, 0.76, 1.24);
      }
      if (typeof getNpcSeasonProfile === 'function') {
        var profile = getNpcSeasonProfile(team, player);
        return clamp(Number(profile && profile.scoring) || 1, 0.86, 1.14);
      }
      return 1;
    });
    var scoringLoads = players.map(function(_, index) {
      return threat[index] * 0.62 + creation[index] * 0.38;
    });
    // 进攻角色由实际得分/持球能力决定；rotation.roleRanks 只描述轮换顺序，不能把 PG/SG 槽位当成第一、第二得分手。
    // 相同能力使用相同进攻档位，让阵容数组顺序本身不会制造出手权差异。
    var offensiveRoleRanks = scoringLoads.map(function(scoringLoad) {
      return scoringLoads.filter(function(otherLoad) { return otherLoad > scoringLoad + 0.001; }).length;
    });
    var teamScoringLoad = weightedMean(scoringLoads, weights);
    var opportunity = players.map(function(player, index) {
      var offensiveRoleRank = offensiveRoleRanks[index];
      var roleFactor = clamp(1 + (scoringLoads[index] - teamScoringLoad) * 1.95, 0.72, 1.32);
      var creationFactor = 0.58 + creation[index] * 0.85;
      var threatFactor = 0.54 + threat[index] * 0.90;
      var scoringLoad = scoringLoads[index];
      // 低技术球员仍需参与半场进攻；软底座避免 creation/threat 相乘后把长时间上场者压到几乎零出手。
      // 补偿随 scoringLoad 平方衰减，中高端球员基本保持原有机会分配。
      var participationFactor = creationFactor * threatFactor
        + 0.18 * Math.pow(1 - scoringLoad, 2);
      var baseOpportunity = Math.max(0.1, weights[index] * roleFactor * participationFactor * form[index]);
      var isCoreScorer = offensiveRoleRank < 2 && weights[index] >= 28 && scoringLoad >= 0.62;
      // 爆发保留稀有长尾；上限和 legendary 档位避免 50+/60+ 在联盟生态中泛滥。
      var gameMultiplier = weights[index] >= 28
        ? clamp(normal(1, 0.11), 0.72, 1.32)
        : clamp(normal(1, 0.06), 0.82, 1.18);
      // 用户赛季状态需要真实改变单场机会波动；仅放在机会分配中会被球队总出手再归一化而大幅抵消。
      if (player._isUser) gameMultiplier *= form[index];
      var burstChance = isCoreScorer
        ? clamp(0.018 + Math.max(0, scoringLoad - 0.60) * 0.18, 0.018, 0.070)
        : 0;
      // 满技能包已经拥有稳定效率和机会优势，不再叠加同等幅度的爆发概率。
      if (scoringLoad > 0.985) burstChance *= 0.35;
      var legendaryBurst = weights[index] >= 30
        && scoringLoad >= 0.70
        && Math.random() < (scoringLoad > 0.985 ? 0.00175 : 0.005);
      if (legendaryBurst) {
        gameMultiplier = 4.00 + Math.random() * 0.70;
      } else if (burstChance > 0 && Math.random() < burstChance) {
        gameMultiplier *= 1.45 + Math.random() * 0.45;
      }
      return baseOpportunity * gameMultiplier;
    });

    return {
      team: team,
      players: players,
      minutes: minutes,
      roleRanks: roleRanks,
      offensiveRoleRanks: offensiveRoleRanks,
      positions: positions,
      weights: weights,
      opportunity: opportunity,
      three: three,
      mid: mid,
      fin: fin,
      dnk: dnk,
      effectiveThree: effectiveThree,
      effectiveMid: effectiveMid,
      effectiveFin: effectiveFin,
      effectiveDnk: effectiveDnk,
      han: han,
      pas: pas,
      ath: ath,
      str: str,
      reb: reb,
      pdef: pdef,
      idef: idef,
      stl: stl,
      blk: blk,
      effectiveReb: effectiveReb,
      rawStr: rawStr,
      rawPdef: rawPdef,
      rawIdef: rawIdef,
      rawStl: rawStl,
      rawBlk: rawBlk,
      rawStealing: weightedMean(rawStl.map(function(value, index) {
        return value * 0.58 + rawPdef[index] * 0.24 + ath[index] * 0.18;
      }), weights),
      clu: clu,
      volumeThree: volumeThree,
      volumeMid: volumeMid,
      volumeRim: volumeRim,
      rimAbility: rimAbility,
      threat: threat,
      creation: creation,
      teamCreation: weightedMean(creation, weights),
      // 保留原始攻防评分供赛前 expectedMargin 使用；比赛事件读取下方的
      // 压缩后有效能力，避免同一属性差在多个事件层被重复放大。
      attack: weightedMean(rawAttack, weights),
      effectiveAttack: weightedMean(threat.map(function(value, index) {
        return value * 0.58 + creation[index] * 0.27 + ath[index] * 0.15;
      }), weights),
      defense: weightedMean(rawDefense, weights),
      perimeterDefense: weightedMean(players.map(function(_, index) {
        return pdef[index] * 0.55 + stl[index] * 0.20 + ath[index] * 0.25;
      }), weights),
      rimProtection: weightedMean(players.map(function(_, index) {
        return idef[index] * 0.42 + blk[index] * 0.34 + str[index] * 0.16 + effectiveReb[index] * 0.08;
      }), weights),
      rawRimProtection: weightedMean(players.map(function(_, index) {
        return rawIdef[index] * 0.42 + rawBlk[index] * 0.34 + rawStr[index] * 0.16 + rawReb[index] * 0.08;
      }), weights),
      offensiveRebound: weightedMean(players.map(function(_, index) {
        return effectiveReb[index] * 0.55 + str[index] * 0.25 + ath[index] * 0.20;
      }), weights),
      defensiveRebound: weightedMean(players.map(function(_, index) {
        return effectiveReb[index] * 0.56 + idef[index] * 0.22 + str[index] * 0.22;
      }), weights),
      stealing: weightedMean(players.map(function(_, index) {
        return stl[index] * 0.58 + pdef[index] * 0.24 + ath[index] * 0.18;
      }), weights),
      blocking: weightedMean(players.map(function(_, index) {
        return blk[index] * 0.58 + idef[index] * 0.24 + str[index] * 0.18;
      }), weights),
      passing: weightedMean(players.map(function(_, index) {
        return pas[index] * 0.72 + han[index] * 0.28;
      }), weights),
      handling: weightedMean(players.map(function(_, index) {
        return han[index] * 0.68 + pas[index] * 0.20 + ath[index] * 0.12;
      }), weights),
      pace: weightedMean(players.map(function(_, index) {
        return ath[index] * 0.50 + han[index] * 0.25 + creation[index] * 0.25;
      }), weights),
      clutch: weightedMean(clu, weights),
      fatigue: 0,
      userAttributeSnapshot: userAttributeSnapshot,
      requestedUserMinutesFactor: requestedUserMinutesFactor,
      appliedUserMinutesFactor: appliedUserMinutesFactor,
    };
  }

  function emptyLine(player, context, index) {
    return {
      name: player.cname || '球员',
      playerId: player.id || '',
      pos: context.positions[index],
      pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0,
      fgm: 0, fga: 0, ftm: 0, fta: 0, threeM: 0, threeA: 0,
      mins: Math.max(0, Math.round(Number(context.minutes[index]) || 0)),
      _isUser: !!player._isUser,
      isUser: !!player._isUser,
    };
  }

  function makeQuarter(context, opponent, possessions, bias, isClutch, fgaLedger, threeLedger) {
    var weightedThree = weightedMean(context.volumeThree, context.opportunity);
    var weightedMid = weightedMean(context.volumeMid, context.opportunity);
    var weightedRim = weightedMean(context.volumeRim, context.opportunity);
    var turnoverRate = clamp(
      0.105 + (1 - context.handling) * 0.050
        + (opponent.perimeterDefense - 0.50) * 0.030
        + (1 - context.teamCreation) * 0.018
        + context.fatigue * 0.012,
      0.080, 0.190,
    );
    var turnovers = sampleMakes(possessions, turnoverRate);
    var effectivePossessions = Math.max(1, possessions - turnovers);
    var rimAttack = clamp(weightedRim / Math.max(0.01, weightedRim + weightedMid + weightedThree), 0.20, 0.65);
    var freeThrowRate = clamp(
      0.095 + rimAttack * 0.070 + context.teamCreation * 0.022
        - opponent.rimProtection * 0.015,
      0.075, 0.185,
    );
    // 罚球先按“造犯规回合”抽样，再按 1/2/3 罚决定实际 FTA；这样单节可以自然出现 0 次或较高罚球量。
    var freeThrowTripRate = clamp(freeThrowRate * 0.56, 0.030, 0.14);
    var freeThrowTrips = sampleMakes(effectivePossessions, freeThrowTripRate);
    var freeThrowTripSizes = [];
    for (var trip = 0; trip < freeThrowTrips; trip++) {
      var tripRoll = Math.random();
      freeThrowTripSizes.push(tripRoll < 0.08 ? 3 : (tripRoll < 0.28 ? 1 : 2));
    }
    var fta = freeThrowTripSizes.reduce(function(sum, value) { return sum + value; }, 0);
    // OREB 只从真实投丢产生；率区间校准到约 5-9 个/队/场，避免二次进攻消失或泛滥。
    var offensiveReboundRate = clamp(
      0.095 + context.offensiveRebound * 0.100 - opponent.defensiveRebound * 0.035,
      0.085, 0.180,
    );
    // 先生成基础投篮，等真实 miss 出现后再生成二次进攻；OREB 不再凭空创造可抢篮板。
    var rawFga = Math.round(effectivePossessions - fta * 0.44);
    var fga = Math.max(1, rawFga);
    var threeRate = clamp(
      weightedThree / Math.max(0.01, weightedThree + weightedMid + weightedRim)
        - (opponent.perimeterDefense - 0.50) * 0.055,
      0.24, 0.54,
    );
    var threeA = Math.max(0, Math.min(fga, Math.round(fga * threeRate)));
    var fgaCaps = context.players.map(function(_, index) {
      return Math.max(4, Math.round(fga * (0.30 + context.threat[index] * 0.13)));
    });
    var fgaByPlayer = allocatePeriodQuota(fga, context.opportunity, fgaCaps, fgaLedger);
    var threeWeights = context.players.map(function(_, index) {
      return context.opportunity[index] * (0.35 + context.volumeThree[index] * 1.45);
    });
    // 三分配额与 FGA 一样跨节累计，且逐节硬受 FGA 约束，避免替补分钟跨过整数阈值时突增。
    var threeByPlayer = allocatePeriodQuota(threeA, threeWeights, fgaByPlayer, threeLedger);
    var ftaWeights = context.players.map(function(_, index) {
      return context.opportunity[index] * (0.28 + context.volumeRim[index] * 1.55 + context.creation[index] * 0.25);
    });
    var ftaTripsByPlayer = weightedRandomAllocation(freeThrowTrips, ftaWeights, fgaByPlayer.map(function(value) {
      return Math.max(1, Math.round(value * 0.50) + 2);
    }));
    var tripCursor = 0;
    var ftaByPlayer = ftaTripsByPlayer.map(function(tripCount) {
      var attempts = 0;
      for (var tripIndex = 0; tripIndex < tripCount; tripIndex++) {
        attempts += freeThrowTripSizes[tripCursor++] || 2;
      }
      return attempts;
    });

    function addFieldGoalAttempts(line, index, threeAttempts, twoAttempts) {
      var rimShareBase = context.volumeRim[index] / Math.max(0.01, context.volumeRim[index] + context.volumeMid[index]);
      var rimDeterrence = clamp((opponent.rimProtection - 0.50) * 0.75, -0.15, 0.30);
      var rimShare = clamp(rimShareBase * (1 - rimDeterrence), 0.15, 0.75);
      // 每次两分出手独立决定区域，避免 Math.round 在低出手量下制造
      // 防守属性跨阈值时的篮下出手断崖。
      var rimAttempts = sampleMakes(twoAttempts, rimShare);
      var midAttempts = twoAttempts - rimAttempts;
      var defensePenalty = (opponent.rimProtection - 0.50) * 0.11;
      var perimeterPenalty = (opponent.perimeterDefense - 0.50) * 0.085;
      var clutchBonus = isClutch ? (context.clutch - 0.50) * 0.045 : 0;
      var qualityBias = bias + (context.passing - 0.50) * 0.014 - context.fatigue * 0.004;
      var threePct = clamp(0.255 + context.effectiveThree[index] * 0.210 - perimeterPenalty + qualityBias + clutchBonus, 0.20, 0.58);
      var midPct = clamp(0.300 + context.effectiveMid[index] * 0.170 - perimeterPenalty * 0.55 + qualityBias + clutchBonus, 0.23, 0.60);
      var rimPct = clamp(
        0.400 + context.effectiveFin[index] * 0.200 + context.effectiveDnk[index] * 0.040
          + context.ath[index] * 0.025 + context.str[index] * 0.035 - defensePenalty + qualityBias + clutchBonus,
        0.28, 0.72,
      );
      var rawBlockProtection = Number(opponent.rawRimProtection);
      var blockProtection = Number.isFinite(rawBlockProtection)
        ? rawBlockProtection * 0.70 + opponent.rimProtection * 0.30
        : opponent.rimProtection;
      var blockChance = clamp(0.006 + blockProtection * 0.092, 0.004, 0.115);
      var preventedBlocks = sampleMakes(rimAttempts, blockChance);
      var rimMakes = sampleMakes(Math.max(0, rimAttempts - preventedBlocks), rimPct);
      var midMakes = sampleMakes(midAttempts, midPct);
      var threeMakes = sampleMakes(threeAttempts, threePct);
      // 盖帽既包括直接改变出手结果的封盖，也包括原本已落入投失集合的封盖记录。
      // 后一部分只补齐事件归因，不再二次降低命中率，避免校准盖帽时破坏球队得分环境。
      var uncreditedRimMisses = Math.max(0, rimAttempts - preventedBlocks - rimMakes);
      var creditedMissBlockRate = clamp(0.020 + blockProtection * 0.245, 0.015, 0.21);
      var blocked = preventedBlocks + sampleMakes(uncreditedRimMisses, creditedMissBlockRate);
      line.fga += threeAttempts + twoAttempts;
      line.threeA += threeAttempts;
      line.threeM += threeMakes;
      line.fgm += threeMakes + rimMakes + midMakes;
      line.pts += threeMakes * 3 + rimMakes * 2 + midMakes * 2;
      line._twoA += twoAttempts;
      line._twoM += rimMakes + midMakes;
      line._rimA += rimAttempts;
      line._blocked += blocked;
    }

    var lines = context.players.map(function(player, index) {
      var line = emptyLine(player, context, index);
      var threeAttempts = threeByPlayer[index];
      var twoAttempts = Math.max(0, fgaByPlayer[index] - threeAttempts);
      line._twoA = 0;
      line._twoM = 0;
      line._rimA = 0;
      line._blocked = 0;
      addFieldGoalAttempts(line, index, threeAttempts, twoAttempts);
      var ftSkill = context.effectiveThree[index] * 0.52 + context.effectiveMid[index] * 0.48;
      var qualityBias = bias + (context.passing - 0.50) * 0.014 - context.fatigue * 0.004;
      var ftPct = clamp(0.60 + ftSkill * 0.30 + qualityBias * 0.35, 0.56, 0.94);
      var ftMakes = sampleMakes(ftaByPlayer[index], ftPct);
      line.fta = ftaByPlayer[index];
      line.ftm = ftMakes;
      line.pts += ftMakes;
      line._missedField = Math.max(0, line.fga - line.fgm);
      line._missedFt = Math.max(0, line.fta - line.ftm);
      return line;
    });

    var reboundableMisses = lines.reduce(function(sum, line) {
      return sum + Math.max(0, line._missedField) + Math.floor(Math.max(0, line._missedFt) * 0.45);
    }, 0);
    var offensiveRebounds = sampleMakes(reboundableMisses, offensiveReboundRate);
    var extraFgaByPlayer = weightedRandomAllocation(
      offensiveRebounds,
      context.players.map(function(_, index) { return context.opportunity[index] * (0.72 + context.volumeRim[index] * 0.60); }),
      context.players.map(function() { return 24; }),
    );
    var extraThree = sampleMakes(offensiveRebounds, clamp(threeRate * 0.72, 0.16, 0.44));
    var extraThreeByPlayer = weightedRandomAllocation(
      extraThree,
      context.players.map(function(_, index) { return context.opportunity[index] * (0.35 + context.volumeThree[index] * 1.45); }),
      extraFgaByPlayer,
    );
    extraFgaByPlayer.forEach(function(extraAttempts, index) {
      var extraThreeAttempts = extraThreeByPlayer[index] || 0;
      addFieldGoalAttempts(lines[index], index, extraThreeAttempts, Math.max(0, extraAttempts - extraThreeAttempts));
      lines[index]._missedField = Math.max(0, lines[index].fga - lines[index].fgm);
    });
    return {
      lines: lines,
      score: lines.reduce(function(sum, line) { return sum + line.pts; }, 0),
      possessions: possessions,
      fgm: lines.reduce(function(sum, line) { return sum + line.fgm; }, 0),
      turnovers: turnovers,
      offensiveRebounds: offensiveRebounds,
      fga: lines.reduce(function(sum, line) { return sum + line.fga; }, 0),
      fta: lines.reduce(function(sum, line) { return sum + line.fta; }, 0),
      freeThrowTrips: freeThrowTrips,
      missedField: lines.reduce(function(sum, line) { return sum + line._missedField; }, 0),
      missedFt: lines.reduce(function(sum, line) { return sum + line._missedFt; }, 0),
      rimAttempts: lines.reduce(function(sum, line) { return sum + line._rimA; }, 0),
    };
  }

  function addAssists(context, quarter) {
    quarter.lines.forEach(function(shooter, shooterIndex) {
      var probability = clamp(
        0.12 + context.passing * 0.60
          + (shooter.threeA / Math.max(1, shooter.fga)) * 0.10
          + (shooter._rimA / Math.max(1, shooter.fga)) * 0.06,
        0.12, 0.78,
      );
      var assistedMakes = sampleMakes(shooter.fgm, probability);
      if (!assistedMakes) return;
      var passWeights = context.players.map(function(_, index) {
        if (index === shooterIndex) return 0;
        var passSkill = context.pas[index] * 0.78 + context.han[index] * 0.22;
        return context.weights[index] * (0.005 + Math.pow(passSkill, 4.2) * 4.3);
      });
      var assists = weightedRandomAllocation(assistedMakes, passWeights, context.players.map(function() { return 17; }));
      assists.forEach(function(value, index) { quarter.lines[index].ast += value; });
    });
  }

  function addTurnovers(context, quarter) {
    var weights = context.players.map(function(_, index) {
      return context.opportunity[index] * (0.30 + (1 - context.han[index]) * 1.05 + context.usagePressure * 0.20);
    });
    var turnovers = weightedRandomAllocation(quarter.turnovers, weights, context.players.map(function() { return 9; }));
    turnovers.forEach(function(value, index) { quarter.lines[index].tov += value; });
  }

  function addDefensiveEvents(defender, offense) {
    var steals = sampleMakes(offense.turnovers, clamp(0.15 + defender.rawStealing * 0.48, 0, 1));
    var stealsByPlayer = weightedRandomAllocation(
      steals,
      defender.players.map(function(_, index) {
        var stealSkill = defender.rawStl[index] * 0.72 + defender.rawPdef[index] * 0.18 + defender.ath[index] * 0.10;
        return defender.weights[index] * (0.010 + Math.pow(stealSkill, 2.4) * 3.0);
      }),
      defender.players.map(function() { return 7; }),
    );
    stealsByPlayer.forEach(function(value, index) { defender._quarterLines[index].stl += value; });

    var blocked = offense.lines.reduce(function(sum, line) { return sum + line._blocked; }, 0);
    var blocksByPlayer = weightedRandomAllocation(
      blocked,
      defender.players.map(function(_, index) {
        var blockSkill = defender.rawBlk[index] * 0.72 + defender.rawIdef[index] * 0.18 + defender.rawStr[index] * 0.10;
        return defender.weights[index] * (0.004 + Math.pow(blockSkill, 3.3) * 3.5);
      }),
      defender.players.map(function() { return 8; }),
    );
    blocksByPlayer.forEach(function(value, index) { defender._quarterLines[index].blk += value; });
  }

  function addRebounds(firstContext, secondContext, firstQuarter, secondQuarter) {
    var firstReboundable = secondQuarter.missedField + Math.floor(secondQuarter.missedFt * 0.45);
    var secondReboundable = firstQuarter.missedField + Math.floor(firstQuarter.missedFt * 0.45);
    var firstTotal = firstQuarter.offensiveRebounds + Math.max(0, firstReboundable - secondQuarter.offensiveRebounds);
    var secondTotal = secondQuarter.offensiveRebounds + Math.max(0, secondReboundable - firstQuarter.offensiveRebounds);
    var firstByPlayer = weightedRandomAllocation(
      firstTotal,
      firstContext.players.map(function(_, index) { return firstContext.weights[index] * (0.20 + Math.pow(firstContext.reb[index], 1.3) * 1.58); }),
      firstContext.players.map(function() { return 24; }),
    );
    var secondByPlayer = weightedRandomAllocation(
      secondTotal,
      secondContext.players.map(function(_, index) { return secondContext.weights[index] * (0.20 + Math.pow(secondContext.reb[index], 1.3) * 1.58); }),
      secondContext.players.map(function() { return 24; }),
    );
    firstByPlayer.forEach(function(value, index) { firstQuarter.lines[index].reb += value; });
    secondByPlayer.forEach(function(value, index) { secondQuarter.lines[index].reb += value; });
  }

  function mergeLines(totalLines, quarterLines, includeMinutes) {
    quarterLines.forEach(function(line, index) {
      var target = totalLines[index];
      ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fgm', 'fga', 'ftm', 'fta', 'threeM', 'threeA'].forEach(function(field) {
        target[field] += Number(line[field]) || 0;
      });
      if (includeMinutes) target.mins += Number(line.mins) || 0;
    });
  }
  function recomputeTeamAggregates(context, weights) {
    return Object.assign({}, context, {
      weights: weights,
      teamCreation: weightedMean(context.creation, weights),
      attack: weightedMean(context.threat.map(function(value, index) {
        return value * 0.58 + context.creation[index] * 0.27 + context.ath[index] * 0.15;
      }), weights),
      effectiveAttack: weightedMean(context.threat.map(function(value, index) {
        return value * 0.58 + context.creation[index] * 0.27 + context.ath[index] * 0.15;
      }), weights),
      defense: weightedMean(context.players.map(function(_, index) {
        return context.pdef[index] * 0.32 + context.idef[index] * 0.28 + context.reb[index] * 0.14
          + context.blk[index] * 0.16 + context.str[index] * 0.10;
      }), weights),
      perimeterDefense: weightedMean(context.players.map(function(_, index) {
        return context.pdef[index] * 0.55 + context.stl[index] * 0.20 + context.ath[index] * 0.25;
      }), weights),
      rimProtection: weightedMean(context.players.map(function(_, index) {
        return context.idef[index] * 0.42 + context.blk[index] * 0.34 + context.str[index] * 0.16 + context.effectiveReb[index] * 0.08;
      }), weights),
      offensiveRebound: weightedMean(context.players.map(function(_, index) {
        return context.effectiveReb[index] * 0.55 + context.str[index] * 0.25 + context.ath[index] * 0.20;
      }), weights),
      defensiveRebound: weightedMean(context.players.map(function(_, index) {
        return context.effectiveReb[index] * 0.56 + context.idef[index] * 0.22 + context.str[index] * 0.22;
      }), weights),
      stealing: weightedMean(context.players.map(function(_, index) {
        return context.stl[index] * 0.58 + context.pdef[index] * 0.24 + context.ath[index] * 0.18;
      }), weights),
      blocking: weightedMean(context.players.map(function(_, index) {
        return context.blk[index] * 0.58 + context.idef[index] * 0.24 + context.str[index] * 0.18;
      }), weights),
      passing: weightedMean(context.players.map(function(_, index) {
        return context.pas[index] * 0.72 + context.han[index] * 0.28;
      }), weights),
      handling: weightedMean(context.players.map(function(_, index) {
        return context.han[index] * 0.68 + context.pas[index] * 0.20 + context.ath[index] * 0.12;
      }), weights),
      pace: weightedMean(context.players.map(function(_, index) {
        return context.ath[index] * 0.50 + context.han[index] * 0.25 + context.creation[index] * 0.25;
      }), weights),
      clutch: weightedMean(context.clu, weights),
    });
  }

  function makePeriodContext(context, periodMinutes) {
    var opportunity = context.opportunity.map(function(value, index) {
      return value * (Number(periodMinutes[index]) || 0) / Math.max(1, Number(context.minutes[index]) || 0);
    });
    var periodContext = recomputeTeamAggregates(context, periodMinutes);
    return Object.assign(periodContext, {
      minutes: periodMinutes,
      opportunity: opportunity,
    });
  }


  function simulateGameAggregateV2(teamA, teamB, seedBonus, probMultiplier, gameOptions) {
    var options = Object.assign({}, gameOptions || {});
    var schedule = STATE && STATE.season && STATE.season.schedule || [];
    var gameIndex = schedule.findIndex(function(game) { return !game.simulated; });
    var currentGame = gameIndex >= 0 ? schedule[gameIndex] : null;
    var previousGame = gameIndex > 0 ? schedule[gameIndex - 1] : null;
    var currentDay = Number.isFinite(Number(options.gameDay))
      ? Number(options.gameDay)
      : (currentGame ? Number(currentGame.day) : null);
    function playedPreviousDay(team) {
      if (!Number.isFinite(currentDay) || !STATE || !STATE.season || !STATE.season._dayMap) return false;
      return (STATE.season._dayMap[currentDay - 1] || []).some(function(game) {
        return game && (game.home === team || game.away === team);
      });
    }
    if (typeof options.isHomeA !== 'boolean' && currentGame && STATE && STATE.careerTeam) {
      if (STATE.careerTeam === teamA) options.isHomeA = !!currentGame.home;
      else if (STATE.careerTeam === teamB) options.isHomeA = !currentGame.home;
    }
    if (probMultiplier != null && STATE && STATE.careerTeam
      && (STATE.careerTeam === teamA || STATE.careerTeam === teamB)) {
      var userAvailabilityFactor = clamp(Number(probMultiplier), 0.55, 1);
      if (options.userAttributeFactor == null) options.userAttributeFactor = userAvailabilityFactor;
      if (options.userMinutesFactor == null) options.userMinutesFactor = userAvailabilityFactor;
    }

    var legacyB2B = !!(currentGame && previousGame
      && Number(currentGame.day) - Number(previousGame.day) === 1);
    var legacyB2BA = legacyB2B && (!STATE || !STATE.careerTeam || STATE.careerTeam === teamA);
    var legacyB2BB = legacyB2B && STATE && STATE.careerTeam === teamB;
    if (typeof options.isB2BA !== 'boolean') {
      options.isB2BA = typeof options.isB2B === 'boolean'
        ? options.isB2B
        : (playedPreviousDay(teamA) || legacyB2BA);
    }
    if (typeof options.isB2BB !== 'boolean') options.isB2BB = playedPreviousDay(teamB) || legacyB2BB;
    options._preparedRotations = Object.assign({}, options._preparedRotations || {});
    if (!options._preparedRotations[teamA]) options._preparedRotations[teamA] = prepareLeagueGameRotation(teamA, options);
    if (!options._preparedRotations[teamB]) options._preparedRotations[teamB] = prepareLeagueGameRotation(teamB, options);
    var first = contextForTeam(teamA, options);
    var second = contextForTeam(teamB, options);
    if (!first || !second) {
      throw new Error('[V2] 无法生成有效轮换：' + String(!first ? teamA : teamB));
    }
    first.fatigue = options.isB2BA === true || options.isB2B === true ? 1 : 0;
    second.fatigue = options.isB2BB === true ? 1 : 0;
    first.usagePressure = 0;
    second.usagePressure = 0;
    var isHomeA = typeof options.isHomeA === 'boolean' ? options.isHomeA : null;
    var activeEventEdge = typeof getActiveEventTeamEdge === 'function' ? getActiveEventTeamEdge(teamA, teamB) : 0;
    var seasonEdge = typeof getSeasonModifierTeamEdge === 'function' ? getSeasonModifierTeamEdge(teamA, teamB) : 0;
    var homeA = isHomeA === true ? 0.014 : (isHomeA === false ? -0.014 : 0);
    var homeB = isHomeA === false ? 0.014 : (isHomeA === true ? -0.014 : 0);
    var biasA = homeA + Number(seedBonus || 0) * 0.003 + activeEventEdge * 0.004 + seasonEdge * 0.004 - first.fatigue * 0.012;
    var biasB = homeB - activeEventEdge * 0.004 - seasonEdge * 0.004 - second.fatigue * 0.012;
    var basePace = clamp(Math.round(
      105 + ((first.pace + second.pace) / 2 - 0.50) * 7
        - (first.fatigue + second.fatigue) * 1.5 + normal(0, 1.8),
    ), 88, 108);
    var totalLinesA = first.players.map(function(player, index) { return emptyLine(player, first, index); });
    var totalLinesB = second.players.map(function(player, index) { return emptyLine(player, second, index); });
    var qScoresA = [];
    var qScoresB = [];
    var scoreA = 0;
    var scoreB = 0;
    var rimAttemptsA = 0;
    var rimAttemptsB = 0;
    var highlight = false;
    var keyEvents = [];
    var periodDiagnostics = [];
    var fgaLedgerA = { quotaCarry: first.players.map(function() { return 0; }) };
    var fgaLedgerB = { quotaCarry: second.players.map(function() { return 0; }) };
    var threeLedgerA = { quotaCarry: first.players.map(function() { return 0; }) };
    var threeLedgerB = { quotaCarry: second.players.map(function() { return 0; }) };

    function runQuarter(possessions, quarterIndex, isOvertime) {
      var clutch = (quarterIndex === 3 && Math.abs(scoreA - scoreB) <= 8)
        || quarterIndex >= 4;
      var contextA = first;
      var contextB = second;
      if (isOvertime) {
        contextA = makePeriodContext(first, allocateTotal(25, first.weights, first.players.map(function() { return 5; })));
        contextB = makePeriodContext(second, allocateTotal(25, second.weights, second.players.map(function() { return 5; })));
      }
      contextA.usagePressure = clamp((contextA.effectiveAttack - 0.50) * 0.50, 0, 0.25);
      contextB.usagePressure = clamp((contextB.effectiveAttack - 0.50) * 0.50, 0, 0.25);
      var periodPossessions = Math.max(1, possessions + Math.round(normal(0, 0.7)));
      var quarterA = makeQuarter(contextA, contextB, periodPossessions, biasA, clutch, fgaLedgerA, threeLedgerA);
      var quarterB = makeQuarter(contextB, contextA, periodPossessions, biasB, clutch, fgaLedgerB, threeLedgerB);
      rimAttemptsA += quarterA.rimAttempts;
      rimAttemptsB += quarterB.rimAttempts;
      contextA._quarterLines = quarterA.lines;
      contextB._quarterLines = quarterB.lines;
      addAssists(contextA, quarterA);
      addAssists(contextB, quarterB);
      addTurnovers(contextA, quarterA);
      addTurnovers(contextB, quarterB);
      addDefensiveEvents(contextA, quarterB);
      addDefensiveEvents(contextB, quarterA);
      addRebounds(contextA, contextB, quarterA, quarterB);
      mergeLines(totalLinesA, quarterA.lines, !!isOvertime);
      mergeLines(totalLinesB, quarterB.lines, !!isOvertime);
      scoreA += quarterA.score;
      scoreB += quarterB.score;
      if (Math.abs(quarterA.score - quarterB.score) >= 10) highlight = true;
      return {
        scoreA: quarterA.score,
        scoreB: quarterB.score,
        possessionsA: quarterA.possessions,
        possessionsB: quarterB.possessions,
        fgaA: quarterA.fga,
        fgaB: quarterB.fga,
        ftaA: quarterA.fta,
        ftaB: quarterB.fta,
        freeThrowTripsA: quarterA.freeThrowTrips,
        freeThrowTripsB: quarterB.freeThrowTrips,
        tovA: quarterA.turnovers,
        tovB: quarterB.turnovers,
        offensiveReboundsA: quarterA.offensiveRebounds,
        offensiveReboundsB: quarterB.offensiveRebounds,
        missedFieldA: quarterA.missedField,
        missedFieldB: quarterB.missedField,
        missedFtA: quarterA.missedFt,
        missedFtB: quarterB.missedFt,
        isOvertime: !!isOvertime,
      };
    }

    for (var quarter = 0; quarter < 4; quarter++) {
      var quarterResult = runQuarter(Math.max(15, Math.round(basePace / 4)), quarter);
      qScoresA.push(quarterResult.scoreA);
      qScoresB.push(quarterResult.scoreB);
      periodDiagnostics.push(quarterResult);
    }
    var overtime = 0;
    while (scoreA === scoreB) {
      overtime++;
      var overtimeResult = runQuarter(Math.max(1, Math.round(basePace * 5 / 48)), 4, true);
      periodDiagnostics.push(overtimeResult);
      keyEvents.push('⏱ 加时赛 #' + overtime);
      highlight = true;
      if (overtimeResult.scoreA !== overtimeResult.scoreB) break;
    }

    totalLinesA.forEach(function(line) {
      delete line._twoA; delete line._twoM; delete line._rimA; delete line._blocked;
      delete line._missedField; delete line._missedFt;
    });
    totalLinesB.forEach(function(line) {
      delete line._twoA; delete line._twoM; delete line._rimA; delete line._blocked;
      delete line._missedField; delete line._missedFt;
    });
    var directEdge = (first.attack - second.attack) * 23 + (first.defense - second.defense) * 13.5;
    var homeCourtEdge = (homeA - homeB) * 100;
    var seedBonusEdge = Number(seedBonus || 0) * 0.5;
    var eventTeamMarginEdge = activeEventEdge * 0.4;
    var seasonModifierMarginEdge = seasonEdge * 0.4;
    var fatigueEdge = second.fatigue - first.fatigue;
    var pregameExpectedMargin = clamp(
      directEdge
        + homeCourtEdge
        + seedBonusEdge
        + eventTeamMarginEdge
        + seasonModifierMarginEdge
        + fatigueEdge * 1.0,
      -18, 18,
    );
    return {
      won: scoreA > scoreB,
      scoreA: scoreA,
      scoreB: scoreB,
      qScoresA: qScoresA,
      qScoresB: qScoresB,
      highlight: highlight,
      keyEvents: keyEvents,
      ot: overtime,
      teamA: { power: { overall: null, offense: first.attack * 100, defense: first.defense * 100, rotationMinutes: totalLinesA.map(function(line) { return line.mins; }) } },
      teamB: { power: { overall: null, offense: second.attack * 100, defense: second.defense * 100, rotationMinutes: totalLinesB.map(function(line) { return line.mins; }) } },
      pace: basePace,
      possPerQ: Math.round(basePace / 4),
      isHomeA: isHomeA,
      isB2BA: first.fatigue > 0,
      isB2BB: second.fatigue > 0,
      expectedMargin: pregameExpectedMargin,
      actualMargin: scoreA - scoreB,
      marginComponents: {
        rosterEdge: 0,
        rawMatchupEdge: directEdge,
        matchupEdge: directEdge,
        rawStarEdge: 0,
        starEdge: 0,
        seasonFormEdge: 0,
        homeCourtEdge: homeCourtEdge,
        seedBonusEdge: seedBonusEdge,
        userAttributeFactorA: STATE && STATE.careerTeam === teamA ? Number(options.userAttributeFactor) || 1 : 1,
        userAttributeFactorB: STATE && STATE.careerTeam === teamB ? Number(options.userAttributeFactor) || 1 : 1,
        requestedUserMinutesFactor: first.players.some(function(player) { return !!player._isUser; })
          ? first.requestedUserMinutesFactor
          : second.requestedUserMinutesFactor,
        appliedUserMinutesFactor: first.players.some(function(player) { return !!player._isUser; })
          ? first.appliedUserMinutesFactor
          : second.appliedUserMinutesFactor,
        userMinutesFactor: first.players.some(function(player) { return !!player._isUser; })
          ? first.appliedUserMinutesFactor
          : second.appliedUserMinutesFactor,
        fatigueEdge: fatigueEdge,
        eventTeamEdge: eventTeamMarginEdge,
        seasonModifierTeamEdge: seasonModifierMarginEdge,
      },
      eventTeamEdge: activeEventEdge,
      estimatedWinProb: 1 / (1 + Math.exp(-pregameExpectedMargin / 6.5)),
      boxScore: { [teamA]: totalLinesA, [teamB]: totalLinesB },
      _celebrationGameId: 'v2:' + Date.now() + ':' + Math.random().toString(36).slice(2),
      engineVersion: 'v2',
      engineDiagnostics: {
        rimAttemptsA: rimAttemptsA,
        rimAttemptsB: rimAttemptsB,
        userAttributeSnapshotA: first.userAttributeSnapshot,
        userAttributeSnapshotB: second.userAttributeSnapshot,
        periods: periodDiagnostics,
        pregameExpectedMargin: pregameExpectedMargin,
        actualMargin: scoreA - scoreB,
      },
    };
  }

  global.simulateGameAggregateV2 = simulateGameAggregateV2;
  global.SIMULATION_ENGINE_V2 = 'quarter-aggregate';
})(typeof window !== 'undefined' ? window : globalThis);
