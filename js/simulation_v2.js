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

  function contextForTeam(team, options) {
    var prepared = options._preparedRotations && options._preparedRotations[team];
    var rotation = prepared || prepareLeagueGameRotation(team, options);
    var players = rotation && rotation.players ? rotation.players : [];
    var minutes = rotation && rotation.minutes
      ? rotation.minutes.slice()
      : allocateLeagueRotationMinutes(players, rotation.roleRanks, { randomize: true });
    var roleRanks = rotation.roleRanks || players.map(function(_, index) { return index; });
    if (!players.length) return null;

    var weights = minutes.map(function(value) { return Math.max(0, Number(value) || 0); });
    var three = players.map(function(player) { return norm(player, 'threePT'); });
    var mid = players.map(function(player) { return norm(player, 'MID'); });
    var fin = players.map(function(player) { return norm(player, 'FIN'); });
    var dnk = players.map(function(player) { return norm(player, 'DNK'); });
    var han = players.map(function(player) { return norm(player, 'HAN'); });
    var pas = players.map(function(player) { return norm(player, 'PAS'); });
    var ath = players.map(function(player) { return norm(player, 'ATH'); });
    var str = players.map(function(player) { return norm(player, 'STR'); });
    var reb = players.map(function(player) { return norm(player, 'REB'); });
    var pdef = players.map(function(player) { return norm(player, 'PDEF'); });
    var idef = players.map(function(player) { return norm(player, 'IDEF'); });
    var stl = players.map(function(player) { return norm(player, 'STL'); });
    var blk = players.map(function(player) { return norm(player, 'BLK'); });
    var clu = players.map(function(player) { return norm(player, 'CLU'); });
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
    var opportunity = players.map(function(player, index) {
      var roleFactor = roleRanks[index] < 5 ? 1.10 : (roleRanks[index] === 5 ? 1.01 : 0.87);
      var creationFactor = 0.72 + creation[index] * 0.55;
      var threatFactor = 0.68 + threat[index] * 0.62;
      return Math.max(0.1, weights[index] * roleFactor * creationFactor * threatFactor * form[index]);
    });

    return {
      team: team,
      players: players,
      minutes: minutes,
      roleRanks: roleRanks,
      positions: positions,
      weights: weights,
      opportunity: opportunity,
      three: three,
      mid: mid,
      fin: fin,
      dnk: dnk,
      han: han,
      pas: pas,
      ath: ath,
      str: str,
      reb: reb,
      pdef: pdef,
      idef: idef,
      stl: stl,
      blk: blk,
      clu: clu,
      volumeThree: volumeThree,
      volumeMid: volumeMid,
      volumeRim: volumeRim,
      rimAbility: rimAbility,
      threat: threat,
      creation: creation,
      teamCreation: weightedMean(creation, weights),
      attack: weightedMean(threat.map(function(value, index) {
        return value * 0.58 + creation[index] * 0.27 + ath[index] * 0.15;
      }), weights),
      defense: weightedMean(players.map(function(_, index) {
        return pdef[index] * 0.32 + idef[index] * 0.28 + reb[index] * 0.14
          + blk[index] * 0.16 + str[index] * 0.10;
      }), weights),
      perimeterDefense: weightedMean(players.map(function(_, index) {
        return pdef[index] * 0.55 + stl[index] * 0.20 + ath[index] * 0.25;
      }), weights),
      rimProtection: weightedMean(players.map(function(_, index) {
        return idef[index] * 0.42 + blk[index] * 0.34 + str[index] * 0.16 + reb[index] * 0.08;
      }), weights),
      offensiveRebound: weightedMean(players.map(function(_, index) {
        return reb[index] * 0.55 + str[index] * 0.25 + ath[index] * 0.20;
      }), weights),
      defensiveRebound: weightedMean(players.map(function(_, index) {
        return reb[index] * 0.56 + idef[index] * 0.22 + str[index] * 0.22;
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

  function makeQuarter(context, opponent, possessions, bias, isClutch) {
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
    var turnovers = Math.round(possessions * turnoverRate);
    var effectivePossessions = Math.max(1, possessions - turnovers);
    var rimAttack = clamp(weightedRim / Math.max(0.01, weightedRim + weightedMid + weightedThree), 0.20, 0.65);
    var freeThrowRate = clamp(
      0.095 + rimAttack * 0.070 + context.teamCreation * 0.022
        - opponent.rimProtection * 0.015,
      0.075, 0.185,
    );
    var fta = Math.max(1, Math.round(effectivePossessions * freeThrowRate * 1.10));
    var offensiveReboundRate = clamp(
      0.065 + context.offensiveRebound * 0.055 - opponent.defensiveRebound * 0.025,
      0.050, 0.120,
    );
    var offensiveRebounds = Math.round(effectivePossessions * offensiveReboundRate);
    var rawFga = Math.round(effectivePossessions - fta * 0.44 + offensiveRebounds);
    var fga = clamp(
      rawFga,
      1, Math.max(1, effectivePossessions + offensiveRebounds),
    );
    var threeRate = clamp(
      weightedThree / Math.max(0.01, weightedThree + weightedMid + weightedRim)
        - (opponent.perimeterDefense - 0.50) * 0.055,
      0.24, 0.54,
    );
    var threeA = Math.max(0, Math.min(fga, Math.round(fga * threeRate)));
    var fgaCaps = context.players.map(function(_, index) {
      return Math.max(4, Math.round(fga * (0.30 + context.threat[index] * 0.13)));
    });
    var fgaByPlayer = allocateTotal(fga, context.opportunity, fgaCaps);
    var threeWeights = context.players.map(function(_, index) {
      return context.opportunity[index] * (0.35 + context.volumeThree[index] * 1.45);
    });
    var threeByPlayer = allocateTotal(threeA, threeWeights, fgaByPlayer);
    var ftaWeights = context.players.map(function(_, index) {
      return context.opportunity[index] * (0.28 + context.volumeRim[index] * 1.55 + context.creation[index] * 0.25);
    });
    var ftaByPlayer = allocateTotal(fta, ftaWeights, fgaByPlayer.map(function(value) {
      return Math.max(2, Math.round(value * 0.75) + 2);
    }));
    var lines = context.players.map(function(player, index) {
      var line = emptyLine(player, context, index);
      var threeAttempts = threeByPlayer[index];
      var twoAttempts = Math.max(0, fgaByPlayer[index] - threeAttempts);
      var rimShareBase = context.volumeRim[index] / Math.max(0.01, context.volumeRim[index] + context.volumeMid[index]);
      var rimDeterrence = clamp((opponent.rimProtection - 0.50) * 0.75, -0.15, 0.30);
      var rimShare = clamp(rimShareBase * (1 - rimDeterrence), 0.15, 0.75);
      var rimAttempts = Math.round(twoAttempts * rimShare);
      var midAttempts = twoAttempts - rimAttempts;
      var defensePenalty = (opponent.rimProtection - 0.50) * 0.11;
      var perimeterPenalty = (opponent.perimeterDefense - 0.50) * 0.085;
      var clutchBonus = isClutch ? (context.clutch - 0.50) * 0.045 : 0;
      var qualityBias = bias + (context.passing - 0.50) * 0.014 - context.fatigue * 0.004;
      var threePct = clamp(0.255 + context.three[index] * 0.210 - perimeterPenalty + qualityBias + clutchBonus, 0.20, 0.58);
      var midPct = clamp(0.300 + context.mid[index] * 0.170 - perimeterPenalty * 0.55 + qualityBias + clutchBonus, 0.23, 0.60);
      var rimPct = clamp(
        0.400 + context.fin[index] * 0.200 + context.dnk[index] * 0.040
          + context.ath[index] * 0.025 + context.str[index] * 0.035 - defensePenalty + qualityBias + clutchBonus,
        0.28, 0.72,
      );
      var blockChance = clamp(0.018 + opponent.rimProtection * 0.080, 0.015, 0.115);
      var blocked = sampleMakes(rimAttempts, blockChance);
      var rimMakes = sampleMakes(Math.max(0, rimAttempts - blocked), rimPct);
      var midMakes = sampleMakes(midAttempts, midPct);
      var threeMakes = sampleMakes(threeAttempts, threePct);
      var ftSkill = context.three[index] * 0.52 + context.mid[index] * 0.48;
      var ftPct = clamp(0.60 + ftSkill * 0.30 + qualityBias * 0.35, 0.56, 0.94);
      var ftMakes = sampleMakes(ftaByPlayer[index], ftPct);
      line.fga = fgaByPlayer[index];
      line.threeA = threeAttempts;
      line.threeM = threeMakes;
      line.fta = ftaByPlayer[index];
      line.ftm = ftMakes;
      line.fgm = threeMakes + rimMakes + midMakes;
      line.pts = threeMakes * 3 + rimMakes * 2 + midMakes * 2 + ftMakes;
      line._twoA = twoAttempts;
      line._twoM = rimMakes + midMakes;
      line._rimA = rimAttempts;
      line._blocked = blocked;
      line._missedField = Math.max(0, line.fga - line.fgm);
      line._missedFt = Math.max(0, line.fta - line.ftm);
      return line;
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
      missedField: lines.reduce(function(sum, line) { return sum + line._missedField; }, 0),
      missedFt: lines.reduce(function(sum, line) { return sum + line._missedFt; }, 0),
      rimAttempts: lines.reduce(function(sum, line) { return sum + line._rimA; }, 0),
    };
  }

  function addAssists(context, quarter) {
    quarter.lines.forEach(function(shooter, shooterIndex) {
      var probability = clamp(
        0.30 + context.passing * 0.34
          + (shooter.threeA / Math.max(1, shooter.fga)) * 0.10
          + (shooter._rimA / Math.max(1, shooter.fga)) * 0.06,
        0.26, 0.78,
      );
      var assistedMakes = sampleMakes(shooter.fgm, probability);
      if (!assistedMakes) return;
      var passWeights = context.players.map(function(_, index) {
        return index === shooterIndex ? 0 : context.weights[index] * (0.35 + context.pas[index] * 1.25 + context.han[index] * 0.25);
      });
      var assists = allocateTotal(assistedMakes, passWeights, context.players.map(function() { return 17; }));
      assists.forEach(function(value, index) { quarter.lines[index].ast += value; });
    });
  }

  function addTurnovers(context, quarter) {
    var weights = context.players.map(function(_, index) {
      return context.opportunity[index] * (0.30 + (1 - context.han[index]) * 1.05 + context.usagePressure * 0.20);
    });
    var turnovers = allocateTotal(quarter.turnovers, weights, context.players.map(function() { return 9; }));
    turnovers.forEach(function(value, index) { quarter.lines[index].tov += value; });
  }

  function addDefensiveEvents(defender, offense) {
    var steals = Math.min(
      offense.turnovers,
      Math.max(0, Math.round(offense.turnovers * (0.30 + defender.stealing * 0.24))),
    );
    var stealsByPlayer = allocateTotal(
      steals,
      defender.players.map(function(_, index) {
        return defender.weights[index] * (0.22 + defender.stl[index] * 1.20 + defender.pdef[index] * 0.25);
      }),
      defender.players.map(function() { return 7; }),
    );
    stealsByPlayer.forEach(function(value, index) { defender._quarterLines[index].stl += value; });

    var blocked = offense.lines.reduce(function(sum, line) { return sum + line._blocked; }, 0);
    var blocksByPlayer = allocateTotal(
      blocked,
      defender.players.map(function(_, index) {
        return defender.weights[index] * (0.20 + defender.blk[index] * 1.35 + defender.idef[index] * 0.25);
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
    var firstByPlayer = allocateTotal(
      firstTotal,
      firstContext.players.map(function(_, index) { return firstContext.weights[index] * (0.30 + firstContext.reb[index] * 1.45); }),
      firstContext.players.map(function() { return 24; }),
    );
    var secondByPlayer = allocateTotal(
      secondTotal,
      secondContext.players.map(function(_, index) { return secondContext.weights[index] * (0.30 + secondContext.reb[index] * 1.45); }),
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
  function makePeriodContext(context, periodMinutes) {
    var opportunity = context.opportunity.map(function(value, index) {
      return value * (Number(periodMinutes[index]) || 0) / Math.max(1, Number(context.minutes[index]) || 0);
    });
    return Object.assign({}, context, {
      minutes: periodMinutes,
      weights: periodMinutes,
      opportunity: opportunity,
    });
  }


  function simulateGameAggregateV2(teamA, teamB, seedBonus, probMultiplier, gameOptions) {
    var options = Object.assign({}, gameOptions || {});
    options._preparedRotations = Object.assign({}, options._preparedRotations || {});
    if (!options._preparedRotations[teamA]) options._preparedRotations[teamA] = prepareLeagueGameRotation(teamA, options);
    if (!options._preparedRotations[teamB]) options._preparedRotations[teamB] = prepareLeagueGameRotation(teamB, options);
    var first = contextForTeam(teamA, options);
    var second = contextForTeam(teamB, options);
    if (!first || !second) {
      return { won: false, scoreA: 0, scoreB: 0, qScoresA: [0, 0, 0, 0], qScoresB: [0, 0, 0, 0], boxScore: { [teamA]: [], [teamB]: [] } };
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
    var availabilityA = probMultiplier == null ? 0 : (Number(probMultiplier) - 1) * 0.045;
    var availabilityB = 0;
    var biasA = homeA + availabilityA + Number(seedBonus || 0) * 0.003 + activeEventEdge * 0.004 + seasonEdge * 0.004 - first.fatigue * 0.012;
    var biasB = homeB + availabilityB - activeEventEdge * 0.004 - seasonEdge * 0.004 - second.fatigue * 0.012;
    var basePace = clamp(Math.round(
      100 + ((first.pace + second.pace) / 2 - 0.50) * 7
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

    function runQuarter(possessions, quarterIndex, isOvertime) {
      var clutch = (quarterIndex === 3 && Math.abs(scoreA - scoreB) <= 8)
        || quarterIndex >= 4;
      var contextA = first;
      var contextB = second;
      if (isOvertime) {
        contextA = makePeriodContext(first, allocateTotal(25, first.weights, first.players.map(function() { return 5; })));
        contextB = makePeriodContext(second, allocateTotal(25, second.weights, second.players.map(function() { return 5; })));
      }
      contextA.usagePressure = clamp((contextA.attack - 0.50) * 0.50, 0, 0.25);
      contextB.usagePressure = clamp((contextB.attack - 0.50) * 0.50, 0, 0.25);
      var quarterA = makeQuarter(contextA, contextB, Math.max(1, possessions + Math.round(normal(0, 0.7))), biasA, clutch);
      var quarterB = makeQuarter(contextB, contextA, Math.max(1, possessions + Math.round(normal(0, 0.7))), biasB, clutch);
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
        tovA: quarterA.turnovers,
        tovB: quarterB.turnovers,
        offensiveReboundsA: quarterA.offensiveRebounds,
        offensiveReboundsB: quarterB.offensiveRebounds,
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
    var directEdge = (first.attack - second.attack) * 4 + (first.defense - second.defense) * 3;
    return {
      won: scoreA > scoreB,
      scoreA: scoreA,
      scoreB: scoreB,
      qScoresA: qScoresA,
      qScoresB: qScoresB,
      highlight: highlight,
      keyEvents: keyEvents,
      ot: overtime,
      teamA: { power: { overall: null, offense: first.attack * 100, defense: first.defense * 100, rotationMinutes: first.minutes } },
      teamB: { power: { overall: null, offense: second.attack * 100, defense: second.defense * 100, rotationMinutes: second.minutes } },
      pace: basePace,
      possPerQ: Math.round(basePace / 4),
      isHomeA: isHomeA,
      isB2BA: first.fatigue > 0,
      isB2BB: second.fatigue > 0,
      expectedMargin: scoreA - scoreB,
      marginComponents: {
        rosterEdge: 0,
        rawMatchupEdge: directEdge,
        matchupEdge: directEdge,
        rawStarEdge: 0,
        starEdge: 0,
        seasonFormEdge: 0,
        homeCourtEdge: homeA * 100,
        availabilityEdge: availabilityA * 100,
        fatigueEdge: (second.fatigue - first.fatigue),
        eventTeamEdge: activeEventEdge,
        seasonModifierTeamEdge: seasonEdge,
      },
      eventTeamEdge: activeEventEdge,
      estimatedWinProb: 1 / (1 + Math.exp(-directEdge / 3.2)),
      boxScore: { [teamA]: totalLinesA, [teamB]: totalLinesB },
      _celebrationGameId: 'v2:' + Date.now() + ':' + Math.random().toString(36).slice(2),
      engineVersion: 'v2',
      engineDiagnostics: {
        rimAttemptsA: rimAttemptsA,
        rimAttemptsB: rimAttemptsB,
        periods: periodDiagnostics,
      },
    };
  }

  global.simulateGameAggregateV2 = simulateGameAggregateV2;
  global.SIMULATION_ENGINE_V2 = 'quarter-aggregate';
})(typeof window !== 'undefined' ? window : globalThis);
