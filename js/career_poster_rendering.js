// Career poster rendering and preview UI.


// ── 配置 ──
var POSTER_TAG_ID = 152165;
var POSTER_TAG_NAME = '球员生涯';
var POSTER_TOPIC_NAME = '社区话题';
var POSTER_TOPIC_ID = 177;
var POSTER_W = 620;
var POSTER_SCALE = 2;

// window.require shim
window.require = window.require || function(name) {
  if (name === 'ali-oss') return window.OSS;
  if (name === '@hupu/kaleido-fed-sdk') return window.KaleidoOSS;
  return null;
};

var _ossClient = null;

// ── 预加载默认Logo ──
var _hupuLogo = null;
(function(){
  var img = new Image();
  if (window.location.protocol !== 'file:') img.crossOrigin = 'anonymous';
  img.onload = function(){ _hupuLogo = img; };
  img.src = 'assets/i3.hoopchina.com.cn/newsPost/de00f9a83014c2b3196d831d4be1adb9_w_300_h_300_.png';
})();

var _posterTeamLogoImages = {};
function preloadPosterTeamLogos() {
  if (!window.TEAM_LOGOS) return;
  Object.keys(window.TEAM_LOGOS).forEach(function(team) {
    if (_posterTeamLogoImages[team]) return;
    var img = new Image();
    var src = window.TEAM_LOGOS[team] || '';
    if (window.location.protocol !== 'file:' && (src.indexOf('http://') === 0 || src.indexOf('https://') === 0)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = function(){ img._ready = true; };
    img.src = src;
    _posterTeamLogoImages[team] = img;
  });
}
preloadPosterTeamLogos();

function drawPosterTeamLogo(ctx, team, x, y, size, colors) {
  var img = _posterTeamLogoImages && _posterTeamLogoImages[team];
  ctx.save();
  ctx.fillStyle = colors.paper;
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (img && img._ready && img.naturalWidth > 0) {
    try {
      ctx.drawImage(img, x + 2, y + 2, size - 4, size - 4);
      ctx.restore();
      return;
    } catch(e) {}
  }
  ctx.fillStyle = colors.red;
  ctx.font = '900 ' + Math.max(6, Math.round(size * 0.28)) + 'px ' + colors.fd;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(team || '', x + size / 2, y + size / 2 + 0.5);
  ctx.restore();
}
function getOssClient() {
  if (_ossClient) return _ossClient;
  var K = window.KaleidoOSS || (typeof require === 'function' ? require('@hupu/kaleido-fed-sdk') : null);
  if (K) {
    _ossClient = new K({
      appId: 'b1AcxWKA1u0hyDYv5kXgImZBRSQ=',
      module: 'activity-screenshot-fed',
      path: '/screenshot/activity/fed',
      sk: 'HioGpkmGe9bsW0iqRLJEyGoLr4Q=',
      action: '1',
    });
    if (typeof _ossClient.start === 'function') _ossClient.start();
  }
  return _ossClient;
}

function roundRectC(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function generateBuildPlayerPoster() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC9",label:"生成生涯海报"});
  updatePosterModeButtons();
  var s = STATE;
  if (!s.finalOVR) { alert('请先完成赛季！'); return; }

  var ps = s.season.playerStats;
  var gp = Math.max(ps.games, 1);
  var avg = {
    pts: Math.round(ps.pts / gp * 10) / 10,
    reb: Math.round(ps.reb / gp * 10) / 10,
    ast: Math.round(ps.ast / gp * 10) / 10,
    stl: Math.round(ps.stl / gp),
    blk: Math.round(ps.blk / gp),
    tov: Math.round(ps.tov / gp * 10) / 10,
    fgm: Math.round(ps.fgm / gp * 10) / 10,
    fga: Math.round(ps.fga / gp * 10) / 10,
    ftm: Math.round(ps.ftm / gp * 10) / 10,
    fta: Math.round(ps.fta / gp * 10) / 10,
    threeM: Math.round(ps.threeM / gp * 10) / 10,
    threeA: Math.round(ps.threeA / gp * 10) / 10,
  };
  var pct = avg.fga > 0 ? (avg.fgm / avg.fga * 100).toFixed(1) : '—';
  var threePct = avg.threeA > 0 ? (avg.threeM / avg.threeA * 100).toFixed(1) : '—';
  var ftPct = avg.fta > 0 ? (avg.ftm / avg.fta * 100).toFixed(1) : '—';
  var ovrGrade = getOvrGrade ? getOvrGrade(s.finalOVR) : '';
  var teamName = getTeamName ? getTeamName(s.careerTeam) : s.careerTeam;
  var posName = (SIM_CONFIG && SIM_CONFIG.POSITIONS) ? SIM_CONFIG.POSITIONS[s.position] : s.position;

  // 季后赛结果
  var bracket = s.season.playoffBracket;
  var seed = getConferenceSeed ? getConferenceSeed(s.careerTeam) : 99;
  var seasonDone = !s.season.schedule || !s.season.schedule.find(function(g){return !g.simulated;});
  var playoffResult = '';
  if (!seasonDone) {
    playoffResult = '';
  } else if (s.season.isChampion) {
    playoffResult = '🏆 总冠军';
  } else if (bracket && bracket.results) {
    var myResults = bracket.results.filter(function(r){ return r.isMySeries; });
    var lastMy = myResults.length > 0 ? myResults[myResults.length - 1] : null;
    if (lastMy) {
      var userWon = lastMy.teamA === s.careerTeam ? lastMy.aWon : !lastMy.aWon;
      var rnList = ['首轮', '次轮', '分区决赛', '总决赛'];
      var rn = rnList[lastMy.round] || ('第' + (lastMy.round + 1) + '轮');
      if (lastMy.round === 3 && userWon) playoffResult = '🏆 总冠军';
      else if (lastMy.round === 3) playoffResult = '总决赛失利';
      else playoffResult = rn + '淘汰';
    }
  } else if (seed > 10) {
    playoffResult = '未进季后赛';
  } else {
    var pi = s.season.playInState;
    if (pi && pi.isEliminated) playoffResult = '附加赛淘汰';
  }

  var po = s.season.playoffStats;
  var hasPo = po && po.games > 0;
  var poAvg = null;
  if (hasPo) {
    var poG = po.games;
    poAvg = {
      pts: Math.round(po.pts / poG * 10) / 10,
      reb: Math.round(po.reb / poG * 10) / 10,
      ast: Math.round(po.ast / poG * 10) / 10,
      stl: Math.round(po.stl / poG),
      blk: Math.round(po.blk / poG),
      tov: Math.round(po.tov / poG * 10) / 10,
    };
  }

  // ── 模板信息 ──
  var archMatch = (typeof matchPlayerArchetype === 'function') ? matchPlayerArchetype(s.attrs, 1) : [];
  var archInfo = archMatch.length > 0 ? archMatch[0] : null;
  var tiered = (typeof findTieredPlayers === 'function') ? findTieredPlayers(s.attrs, s.position) : [];

  // ── 颜色常量 ──
  var C = {
    bg: '#faf5eb', bgCard: '#fffaf2', border: '#f0e0cc',
    text: '#2d1f0e', textDim: '#8a7a66', textMuted: '#baa992',
    orange: '#ff6b35', gold: '#f7a600', green: '#2ec4b6', red: '#e63946',
    fd: '"Fredoka","Noto Sans SC",sans-serif',
    fb: '"Nunito","Noto Sans SC",sans-serif',
  };

  var W = 480, cardW = W - 28, cardX = 14, cx = W / 2;

  // ═══ 动态高度（按内容自动撑长）════
  var sections = [
    80,   // sr-header + 分隔线
    96,   // 球员信息
    66,   // 模板
    140,  // 常规赛
  ];
  if (hasPo) sections.push(130);  // 季后赛
  sections.push(126); // 最终属性
  sections.push(18);  // 底部边距
  var H = sections.reduce(function(a,b){return a+b+6;}, 0) + 8;

  var canvas = document.getElementById('posterCanvas');
  canvas.width = W * POSTER_SCALE;
  canvas.height = H * POSTER_SCALE;
  var ctx = canvas.getContext('2d');
  ctx.scale(POSTER_SCALE, POSTER_SCALE);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  function card(x, y, w, h) {
    ctx.fillStyle = '#fffaf2';
    roundRectC(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = '#f0e0cc';
    ctx.lineWidth = 1.2;
    roundRectC(ctx, x, y, w, h, 12); ctx.stroke();
  }

  function fillCell(x, y, w, h, r) {
    ctx.fillStyle = 'rgba(255,107,53,0.06)';
    roundRectC(ctx, x, y, w, h, r); ctx.fill();
  }

  var y = 0;

  // ═══ 1. sr-header ═══
  y = 16;
  // 右上角默认Logo
  if (_hupuLogo) {
    ctx.save();
    var logoSize = 28;
    ctx.drawImage(_hupuLogo, W - 14 - logoSize, y - 4, logoSize, logoSize);
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.text;
  ctx.font = '800 22px ' + C.fd;
  ctx.fillText(teamName, cx, y);
  y += 30;
  ctx.fillStyle = C.orange;
  ctx.font = '800 32px ' + C.fd;
  ctx.fillText(s.season.wins + '-' + s.season.losses, cx, y);
  y += 36;
  var isChamp = playoffResult.indexOf('总冠军') >= 0;
  ctx.fillStyle = isChamp ? C.gold : C.textDim;
  ctx.font = '500 12px ' + C.fd;
  ctx.fillText(playoffResult || '赛季结束', cx, y);
  y += 16;

  // 分隔线
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cardX, y); ctx.lineTo(cardX + cardW, y); ctx.stroke();
  y += 12;

  // ═══ 2. 球员信息（sr-section风格）═══
  var infoH = 88;
  card(cardX, y, cardW, infoH);
  var ix = cardX + 14, iw = cardW - 28;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 12px ' + C.fd;
  ctx.fillText('👤 我的球员信息', ix, y + 8);

  function infoRow(label, val, yy) {
    ctx.fillStyle = C.textDim;
    ctx.font = '400 11px ' + C.fb;
    ctx.textAlign = 'left';
    ctx.fillText(label, ix, yy);
    ctx.fillStyle = C.text;
    ctx.font = '500 12px ' + C.fd;
    ctx.textAlign = 'right';
    ctx.fillText(val, ix + iw, yy);
  }
  infoRow('位置', posName, y + 30);
  infoRow('总评', s.finalOVR.toString(), y + 50);
  infoRow('球队', teamName, y + 70);
  y += infoH + 6;

  // ═══ 3. 模板信息 ═══
  cardH = 66;
  card(cardX, y, cardW, cardH);

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 12px ' + C.fd;
  ctx.fillText('🔍 球员模板', cardX + 14, y + 6);

  var archY = y + 24;
  ctx.fillStyle = C.text;
  ctx.font = '400 12px ' + C.fd;
  if (archInfo) {
    ctx.fillText('风格：' + archInfo.cn, cardX + 14, archY);
  } else {
    ctx.fillText('风格：无', cardX + 14, archY);
  }

  // 球员模板名称
  ctx.fillStyle = C.text;
  ctx.font = '400 12px ' + C.fd;
  if (tiered.length > 0) {
    var nameStr = '球员模板：';
    for (var ti = 0; ti < Math.min(tiered.length, 3); ti++) {
      var item = tiered[ti];
      var p = item.player;
      nameStr += (ti > 0 ? '、' : '') + (p.cname || p.name);
    }
    ctx.fillText(nameStr, cardX + 14, archY + 20);
  } else {
    ctx.fillText('球员模板：无', cardX + 14, archY + 20);
  }

  y += cardH + 6;

  // ═══ 4. 常规赛 ═══
  cardH = 140;
  card(cardX, y, cardW, cardH);

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 13px ' + C.fd;
  ctx.fillText('📊 常规赛 ' + gp + '场', cardX + 14, y + 8);

  var statLabels = ['得分', '篮板', '助攻', '抢断', '盖帽', '失误'];
  var statVals = [avg.pts, avg.reb, avg.ast, avg.stl, avg.blk, avg.tov];
  var sCols = 3, sGap = 5;
  var sW = (cardW - 32 - (sCols - 1) * sGap) / sCols, sH = 34;
  for (var si = 0; si < 6; si++) {
    var scol = si % sCols, srow = Math.floor(si / sCols);
    var sx = cardX + 14 + scol * (sW + sGap);
    var sy = y + 30 + srow * (sH + sGap);
    fillCell(sx, sy, sW, sH, 6);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = '500 16px ' + C.fd;
    ctx.fillText(statVals[si].toString(), sx + sW / 2, sy + 2);
    ctx.fillStyle = C.textDim;
    ctx.font = '400 9px ' + C.fb;
    ctx.fillText(statLabels[si], sx + sW / 2, sy + 22);
  }

  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.textDim;
  ctx.font = '400 10px ' + C.fb;
  var pctY2 = y + 30 + 2 * (sH + sGap) + 3;
  ctx.fillText(avg.fgm + '-' + avg.fga + ' (' + pct + '%) · 三分 ' + avg.threeM + '-' + avg.threeA + ' (' + threePct + '%)', cx, pctY2);
  y += cardH + 6;

  // ═══ 5. 季后赛 ═══
  if (hasPo) {
    cardH = 130;
    card(cardX, y, cardW, cardH);

    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.orange;
    ctx.font = '500 13px ' + C.fd;
    ctx.fillText('🏀 季后赛 ' + po.games + '场', cardX + 14, y + 8);

    var poVals = [poAvg.pts, poAvg.reb, poAvg.ast, poAvg.stl, poAvg.blk, poAvg.tov];
    for (var pi2 = 0; pi2 < 6; pi2++) {
      var pcol = pi2 % sCols, prow = Math.floor(pi2 / sCols);
      var psx = cardX + 14 + pcol * (sW + sGap);
      var psy = y + 30 + prow * (sH + sGap);
      fillCell(psx, psy, sW, sH, 6);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = C.text;
      ctx.font = '500 16px ' + C.fd;
      ctx.fillText(poVals[pi2].toString(), psx + sW / 2, psy + 2);
      ctx.fillStyle = C.textDim;
      ctx.font = '400 9px ' + C.fb;
      ctx.fillText(statLabels[pi2], psx + sW / 2, psy + 22);
    }
    y += cardH + 6;
  }

  // ═══ 6. 最终属性（3排：5-4-4）═══
  cardH = 126;
  card(cardX, y, cardW, cardH);

  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 13px ' + C.fd;
  ctx.fillText('🏷️ 最终属性', cardX + 14, y + 8);

  var attrKeys = (SIM_CONFIG && SIM_CONFIG.ATTR_LIST) ? SIM_CONFIG.ATTR_LIST : [];
  var attrCN = (typeof window.attrCN === 'function') ? window.attrCN : function(k) { return k; };
  var aCols = 5, aGap = 3;
  var aW = (cardW - 32 - (aCols - 1) * aGap) / aCols, aH = 28;

  for (var ai = 0; ai < attrKeys.length; ai++) {
    var k = attrKeys[ai];
    var val = (s.attrs[k] !== null && s.attrs[k] !== undefined) ? s.attrs[k] : 50;
    var grade = getGrade ? getGrade(val) : { letter: 'C', color: C.textDim };
    var acol = ai % aCols, arow = Math.floor(ai / aCols);
    var ax = cardX + 14 + acol * (aW + aGap);
    var ay = y + 28 + arow * (aH + aGap);
    fillCell(ax, ay, aW, aH, 5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.textDim;
    ctx.font = '400 8px ' + C.fb;
    ctx.fillText(attrCN(k), ax + aW / 2, ay + 2);
    ctx.fillStyle = grade.color;
    ctx.font = '500 13px ' + C.fd;
    ctx.fillText(grade.letter, ax + aW / 2, ay + 14);
  }

  y += cardH + 6;

  // ═══ 7. 水印 ═══
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = C.textMuted;
  ctx.font = '400 9px ' + C.fb;
  ctx.fillText('我的球员作品', cx, H - 6);

  canvas._corsSafe = true;
  var dataURL = canvas.toDataURL('image/png');
  setPosterPages([dataURL], 0);
}

var _posterMode = 'career';
var _posterPages = [];
var _posterPageIndex = 0;

function updatePosterModeButtons() {
  _posterMode = 'career';
}

function switchPosterMode(mode) {
  _posterMode = 'career';
  generateCareerPoster();
}

function setPosterPages(pages, index) {
  _posterPages = (pages || []).filter(function(url) { return !!url; });
  _posterPageIndex = Math.max(0, Math.min(index || 0, _posterPages.length - 1));
  renderPosterPage();
}

function renderPosterPage() {
  var img = document.getElementById('posterPreviewImg');
  var overlay = document.getElementById('posterOverlay');
  var pager = document.getElementById('posterPager');
  var label = document.getElementById('posterPageLabel');
  if (!_posterPages.length) return;
  window._posterDataURL = _posterPages[_posterPageIndex];
  window._posterDataURLs = _posterPages.slice();
  if (img) img.src = window._posterDataURL;
  if (label) label.textContent = (_posterPageIndex + 1) + ' / ' + _posterPages.length;
  if (pager) pager.style.display = _posterPages.length > 1 ? 'flex' : 'none';
  if (overlay) overlay.style.display = 'flex';
}

function switchPosterPage(delta) {
  if (!_posterPages.length) return;
  _posterPageIndex = (_posterPageIndex + delta + _posterPages.length) % _posterPages.length;
  renderPosterPage();
}

// 生涯评价数据由 career-evaluation-500.md 生成，修改请编辑 md 后运行 tools/build_career_eval.py

function wrapBiographyText(ctx, text, maxWidth, font) {
  ctx.font = font;
  return wrapCareerEvaluationText(text, maxWidth, ctx);
}

function wrapBiographyParagraphText(ctx, text, maxWidth, firstIndent, font) {
  ctx.font = font;
  var lines = [];
  var line = '';
  var noStart = '，。！？；、：,.!?;:）】」』”’…—';
  var noEnd = '“‘（【「『';
  var t = String(text || '');
  function lineWidth(s) { return ctx.measureText(s).width; }
  function currentMaxWidth() { return lines.length === 0 ? Math.max(40, maxWidth - firstIndent) : maxWidth; }
  for (var i = 0; i < t.length; i++) {
    var ch = t[i];
    var test = line + ch;
    if (line && lineWidth(test) > currentMaxWidth()) {
      if (noStart.indexOf(ch) >= 0) {
        line = test;
        continue;
      }
      if (noEnd.indexOf(line[line.length - 1]) >= 0) {
        line = test;
        continue;
      }
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function generateCareerBiographyPosterDataURL(r) {
  var bio = buildCareerBiographyText(r);
  var C = {
    bg: '#ded6c9', paper: '#fffdf5', ink: '#14110e', ink2: '#40362f',
    muted: '#76695f', line: '#cdbda8', red: '#b82822',
    redSoft: 'rgba(184,40,34,0.10)', cream: '#f4e6d2',
    fd: '"Fredoka","Noto Sans SC",sans-serif',
    fb: '"Nunito","Noto Sans SC",sans-serif'
  };
  var W = 560, cx = W / 2, pad = 30, textW = W - pad * 2;
  var eras = analyzeTeamEras(bio.facts);
  var measureCtx = document.createElement('canvas').getContext('2d');
  var displayName = bio.facts['姓名'] || '我的球员';
  var subtitle = String(bio.title || '').replace(displayName, '').replace(/^[:：\s]+/, '').trim();
  if (!subtitle) subtitle = bio.facts['球员类型'] + ' · ' + bio.facts['生涯曲线'];
  var subtitleLines = wrapBiographyText(measureCtx, subtitle, textW - 26, '800 14px ' + C.fd).slice(0, 2);
  var bodyParts = bio.body.split(/\n{2,}/);

  var bodyFont = '500 11.2px ' + C.fb;
  var bodyLineH = 17;
  var paraGap = 11;
  var firstIndent = 12;
  var colGap = 24;
  var colW = (W - pad * 2 - colGap) / 2;
  var paraBlocks = bodyParts.map(function(p) {
    return wrapBiographyParagraphText(measureCtx, p, colW, firstIndent, bodyFont);
  });
  var totalColumnWeight = paraBlocks.reduce(function(sum, lines) { return sum + lines.length + 1; }, 0);
  var targetColumnWeight = totalColumnWeight / 2;
  var runningColumnWeight = 0;
  var splitIdx = paraBlocks.length;
  for (var pi = 0; pi < paraBlocks.length; pi++) {
    var pWeight = paraBlocks[pi].length + 1;
    if (pi > 0 && runningColumnWeight + pWeight > targetColumnWeight) {
      var beforeDiff = Math.abs(targetColumnWeight - runningColumnWeight);
      var afterDiff = Math.abs(targetColumnWeight - (runningColumnWeight + pWeight));
      splitIdx = afterDiff < beforeDiff ? pi + 1 : pi;
      break;
    }
    runningColumnWeight += pWeight;
  }
  if (splitIdx <= 0 || splitIdx >= paraBlocks.length) splitIdx = Math.ceil(paraBlocks.length / 2);
  var leftBlocks = paraBlocks.slice(0, splitIdx);
  var rightBlocks = paraBlocks.slice(splitIdx);
  if (!rightBlocks.length && leftBlocks.length > 1) {
    rightBlocks = leftBlocks.splice(Math.ceil(leftBlocks.length / 2));
  }
  function blocksHeight(blocks) {
    var h = 0;
    blocks.forEach(function(lines) { h += lines.length * bodyLineH + paraGap; });
    return h;
  }
  var routeItems = eras.map(function(era, idx) {
    return { no: idx + 1, range: era.range, team: era.teamName, code: era.team };
  });
  var routeH = routeItems.length ? 112 : 0;
  var quote = '“' + (bio.facts['多城称谓'] || '这段岁月') + '记住他的方式不总是宏大，而是那些被认真陪伴过的年份。”';
  var quoteFont = '900 14px ' + C.fd;
  var quoteInnerPad = 22;
  var quoteLineH = 20;
  var quoteLines = wrapBiographyText(measureCtx, quote, textW - quoteInnerPad * 2, quoteFont);
  if (quoteLines.length > 3) {
    quoteFont = '900 12.5px ' + C.fd;
    quoteLineH = 18;
    quoteLines = wrapBiographyText(measureCtx, quote, textW - quoteInnerPad * 2, quoteFont);
  }
  var quoteH = 30 + quoteLines.length * quoteLineH;
  var bodyH = Math.max(blocksHeight(leftBlocks), blocksHeight(rightBlocks));
  var H = Math.max(920, 274 + routeH + quoteH + bodyH + 92);

  var canvas = document.getElementById('posterCanvas');
  canvas.width = W * POSTER_SCALE;
  canvas.height = H * POSTER_SCALE;
  var ctx = canvas.getContext('2d');
  ctx.scale(POSTER_SCALE, POSTER_SCALE);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.fillStyle = C.paper;
  ctx.fillRect(12, 12, W - 24, H - 24);
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 2.2;
  ctx.strokeRect(12, 12, W - 24, H - 24);
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = C.ink;
  for (var noiseY = 26; noiseY < H - 20; noiseY += 36) {
    for (var noiseX = 24; noiseX < W - 24; noiseX += 23) {
      if ((noiseX + noiseY) % 5 === 0) ctx.fillRect(noiseX, noiseY, 1, 1);
    }
  }
  ctx.restore();

  var y = 22;
  var mastY = y;
  ctx.fillStyle = C.ink;
  ctx.fillRect(pad, y, textW, 46);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.paper;
  ctx.font = '900 25px ' + C.fd;
  ctx.fillText('BUILDPLAYER DAILY', pad + 14, y + 8);
  var logoSize = 22;
  var logoX = W - pad - logoSize - 10;
  var logoY = mastY + 11;
  ctx.font = '700 9px ' + C.fb;
  ctx.textAlign = 'right';
  ctx.fillText('RETIREMENT SPECIAL · CAREER FEATURE', logoX - 12, y + 18);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.red;
  ctx.fillRect(pad, y + 43, textW, 3);

  if (_hupuLogo) {
    ctx.save();
    ctx.fillStyle = C.paper;
    ctx.fillRect(logoX - 4, logoY - 4, logoSize + 8, logoSize + 8);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(_hupuLogo, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }
  y += 60;

  ctx.fillStyle = C.red;
  ctx.fillRect(pad, y, 8, 100);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  var titleSize = 54;
  measureCtx.font = '900 ' + titleSize + 'px ' + C.fd;
  while (measureCtx.measureText(displayName).width > textW - 34 && titleSize > 36) {
    titleSize -= 2;
    measureCtx.font = '900 ' + titleSize + 'px ' + C.fd;
  }
  ctx.font = '900 ' + titleSize + 'px ' + C.fd;
  ctx.fillText(displayName, pad + 20, y - 4);
  y += Math.max(50, titleSize - 2);
  ctx.fillStyle = C.ink2;
  ctx.font = '800 14px ' + C.fd;
  subtitleLines.forEach(function(line) {
    ctx.fillText(line, pad + 20, y);
    y += 18;
  });
  y += 10;
  ctx.fillStyle = C.cream;
  ctx.fillRect(pad + 20, y, textW - 20, 40);
  ctx.fillStyle = C.red;
  ctx.font = '700 10px ' + C.fb;
  ctx.fillText(bio.facts['赛季数'] + '年生涯 · ' + bio.facts['场次'] + '场 · ' + bio.facts['历史档位'], pad + 34, y + 6);
  ctx.fillStyle = C.ink2;
  ctx.font = '600 9px ' + C.fb;
  var routeText = bio.facts['球队列表'] || bio.facts['首队'];
  var routeTextLines = wrapBiographyText(measureCtx, routeText, textW - 70, '600 9px ' + C.fb).slice(0, 2);
  routeTextLines.forEach(function(line, idx) {
    ctx.fillText(line, pad + 34, y + 19 + idx * 11);
  });
  y += 56;

  if (routeItems.length) {
    ctx.fillStyle = C.red;
    ctx.fillRect(pad, y, 82, 20);
    ctx.fillStyle = C.ink;
    ctx.fillRect(pad + 82, y, textW - 82, 20);
    ctx.fillStyle = C.paper;
    ctx.font = '900 9px ' + C.fd;
    ctx.fillText('CAREER ROUTE', pad + 8, y + 5);
    y += 31;
    var itemGap = routeItems.length >= 9 ? 3 : 6;
    var itemW = (textW - itemGap * Math.max(0, routeItems.length - 1)) / routeItems.length;
    var logoSz = Math.max(13, Math.min(28, Math.floor(itemW * 0.34)));
    var teamFontSize = Math.max(6.2, Math.min(9.2, itemW / 7.2));
    var rangeFontSize = Math.max(5.8, Math.min(8, itemW / 8.3));
    routeItems.forEach(function(item, idx) {
      var x = pad + idx * (itemW + itemGap);
      var iy = y;
      ctx.fillStyle = idx % 2 === 0 ? C.paper : C.redSoft;
      ctx.fillRect(x, iy, itemW, 62);
      ctx.strokeStyle = C.line;
      ctx.lineWidth = 0.8;
      ctx.strokeRect(x, iy, itemW, 62);
      drawPosterTeamLogo(ctx, item.code, x + (itemW - logoSz) / 2, iy + 6, logoSz, C);
      ctx.fillStyle = C.ink;
      ctx.font = '900 ' + teamFontSize + 'px ' + C.fd;
      measureCtx.font = '900 ' + teamFontSize + 'px ' + C.fd;
      var teamLabel = item.team;
      while (teamLabel.length > 1 && measureCtx.measureText(teamLabel).width > itemW - 5) {
        teamLabel = teamLabel.slice(0, -1);
      }
      if (teamLabel !== item.team && teamLabel.length > 1) teamLabel = teamLabel.slice(0, -1) + '…';
      ctx.textAlign = 'center';
      ctx.fillText(teamLabel, x + itemW / 2, iy + logoSz + 17);
      ctx.fillStyle = C.muted;
      ctx.font = '700 ' + rangeFontSize + 'px ' + C.fb;
      ctx.fillText(item.range, x + itemW / 2, iy + logoSz + 28);
      ctx.textAlign = 'left';
    });
    y += 76;
  }

  ctx.fillStyle = C.ink;
  ctx.fillRect(pad, y, textW, 5);
  y += 12;
  ctx.fillStyle = C.redSoft;
  ctx.fillRect(pad, y, textW, quoteH);
  ctx.strokeStyle = C.red;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(pad, y, textW, quoteH);
  ctx.fillStyle = C.red;
  ctx.fillRect(pad, y, 5, quoteH);
  ctx.textAlign = 'left';
  ctx.fillStyle = C.ink;
  ctx.font = quoteFont;
  quoteLines.forEach(function(line, idx) {
    ctx.fillText(line, pad + quoteInnerPad, y + 14 + idx * quoteLineH);
  });
  y += quoteH + 20;

  ctx.fillStyle = C.ink;
  ctx.font = '900 10px ' + C.fd;
  ctx.fillStyle = C.red;
  var featureBadgeW = 112;
  ctx.fillRect(pad, y - 1, featureBadgeW, 20);
  ctx.fillStyle = C.paper;
  ctx.fillText('FEATURE STORY', pad + 10, y + 4);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad + featureBadgeW + 12, y + 9); ctx.lineTo(W - pad, y + 9); ctx.stroke();
  y += 28;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  function drawBlocks(blocks, x, startY) {
    var yy = startY;
    ctx.fillStyle = C.ink;
    ctx.font = bodyFont;
    blocks.forEach(function(lines, blockIdx) {
      lines.forEach(function(line, lineIdx) {
        ctx.fillText(line, lineIdx === 0 ? x + firstIndent : x, yy);
        yy += bodyLineH;
      });
      yy += paraGap;
    });
    return yy;
  }
  var colY = y;
  drawBlocks(leftBlocks, pad, colY);
  drawBlocks(rightBlocks, pad + colW + colGap, colY);

  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = C.line;
  ctx.beginPath();
  ctx.moveTo(cx, colY);
  ctx.lineTo(cx, H - 48);
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = C.ink;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(pad, H - 42);
  ctx.lineTo(W - pad, H - 42);
  ctx.stroke();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = C.muted;
  ctx.font = '400 9px ' + C.fb;
  ctx.fillText('我的球员退役特刊', cx, H - 14);
  canvas._corsSafe = true;
  return canvas.toDataURL('image/png');
}

function generateCareerPoster() {
  trackEvent({act:"click",blk:"BMC098",pos:"TC9",label:"生成生涯海报"});
  updatePosterModeButtons();
  var s = STATE;
  var c = s.career || {};
  if (!c.totalStats && !s.finalOVR) { alert('请先完成生涯！'); return; }

  var ts = c.totalStats || {};
  var tg = Math.max(ts.games || 0, 1);
  var avg = {
    pts: +((ts.pts || 0) / tg).toFixed(1),
    reb: +((ts.reb || 0) / tg).toFixed(1),
    ast: +((ts.ast || 0) / tg).toFixed(1),
    stl: +((ts.stl || 0) / tg).toFixed(1),
    blk: +((ts.blk || 0) / tg).toFixed(1),
    tov: +((ts.tov || 0) / tg).toFixed(1)
  };
  var fga = ts.fga || 0, fgm = ts.fgm || 0;
  var fta = ts.fta || 0, ftm = ts.ftm || 0;
  var t3a = ts.threeA || 0, t3m = ts.threeM || 0;
  var pct = fga > 0 ? (fgm / fga * 100).toFixed(1) : '—';
  var ftPct = fta > 0 ? (ftm / fta * 100).toFixed(1) : '—';
  var threePct = t3a > 0 ? (t3m / t3a * 100).toFixed(1) : '—';

  var honors = c.honors || [];
  function cnt(key) { return honors.filter(function(h) { return (h.label || '').indexOf(key) >= 0 && !isRookieHonorForLaterSeason(h); }).length; }
  var championships = cnt('总冠军');
  var mvp = honors.filter(function(h) { return (h.label || '') === 'MVP'; }).length;
  var fmvp = cnt('总决赛MVP') + cnt('FMVP');
  var dpoy = cnt('DPOY');
  var allNBA = cnt('最佳阵容');
  var allStar = cnt('全明星');
  var roty = cnt('最佳新秀');

  var teamName = getTeamName ? getTeamName(s.careerTeam) : s.careerTeam;
  var allTeams = [];
  (c.seasons || []).forEach(function(se) {
    if (allTeams.indexOf(se.team) < 0) allTeams.push(se.team);
  });
  var allTeamsStr = allTeams.length ? allTeams.map(function(t) { return getTeamName ? getTeamName(t) : t; }).join('、') : teamName;
  var honorEntries = [];
  var champBySeason = {};
  (c.seasons || []).forEach(function(se) {
    if ((se.playoffResult || '').indexOf('总冠军') >= 0) champBySeason[se.seasonNum] = true;
  });
  (c.honors || []).forEach(function(h) {
    var label = h.label || '';
    if (label.indexOf('最佳新秀') >= 0) return; // 海报不显示最佳新秀/最佳新秀阵容
    if (label.indexOf('总冠军') >= 0 && !champBySeason[h.seasonNum]) return; // 与赛季战绩冲突的冠军荣誉忽略
    var hSeason = null;
    for (var hs2 = 0; hs2 < (c.seasons || []).length; hs2++) {
      if (c.seasons[hs2].seasonNum === h.seasonNum) { hSeason = c.seasons[hs2]; break; }
    }
    honorEntries.push({
      seasonNum: h.seasonNum || 1,
      team: hSeason && hSeason.team ? hSeason.team : s.careerTeam,
      label: label
    });
  });
  (c.seasons || []).forEach(function(se) {
    if (champBySeason[se.seasonNum]) {
      var hasChampEntry = honorEntries.some(function(he) { return he.seasonNum === se.seasonNum && (he.label || '').indexOf('总冠军') >= 0; });
      if (!hasChampEntry) honorEntries.push({ seasonNum: se.seasonNum, team: se.team, label: '🏆 总冠军' });
    }
  });
  honorEntries.sort(function(a, b) { return a.seasonNum - b.seasonNum; });
  function seasonYear(n) { return 2025 + (parseInt(n, 10) || 1); }
  function shortSeasonLabel(n) { var y = seasonYear(n); return y + '-' + String((y + 1) % 100); }
  // 按连续效力同一队的时代合并，一行展示该时代的全部荣誉
  var eraList = [];
  var eraTeam = null, eraFirst = 0, eraLast = 0;
  (c.seasons || []).slice().sort(function(a, b) { return a.seasonNum - b.seasonNum; }).forEach(function(se) {
    if (eraTeam === se.team) {
      eraLast = se.seasonNum;
    } else {
      if (eraTeam != null) eraList.push({ team: eraTeam, first: eraFirst, last: eraLast });
      eraTeam = se.team; eraFirst = se.seasonNum; eraLast = se.seasonNum;
    }
  });
  if (eraTeam != null) eraList.push({ team: eraTeam, first: eraFirst, last: eraLast });
  var seasonTeamMap = {};
  (c.seasons || []).forEach(function(se) { seasonTeamMap[se.seasonNum] = se.team; });
  var eraHonorMap = {};
  honorEntries.forEach(function(he) {
    var eTeam = seasonTeamMap[he.seasonNum] || he.team || s.careerTeam;
    var targetEra = null;
    for (var ei2 = 0; ei2 < eraList.length; ei2++) {
      if (eraList[ei2].team === eTeam && he.seasonNum >= eraList[ei2].first && he.seasonNum <= eraList[ei2].last) {
        targetEra = eraList[ei2]; break;
      }
    }
    if (!targetEra) {
      targetEra = { team: eTeam, first: he.seasonNum, last: he.seasonNum };
      eraList.push(targetEra);
      eraList.sort(function(a, b) { return a.first - b.first; });
    }
    var eIdx = eraList.indexOf(targetEra);
    if (!eraHonorMap[eIdx]) eraHonorMap[eIdx] = {};
    eraHonorMap[eIdx][he.label] = (eraHonorMap[eIdx][he.label] || 0) + 1;
  });
  var honorRows = [];
  eraList.forEach(function(er, eIdx) {
    var labels = Object.keys(eraHonorMap[eIdx] || {});
    var labelStr = labels.map(function(lb) {
      var n2 = eraHonorMap[eIdx][lb];
      return n2 > 1 ? lb + ' ×' + n2 : lb;
    }).join('、');
    var erTeamCn = getTeamName ? getTeamName(er.team) : er.team;
    var erRange = er.last > er.first ? seasonYear(er.first) + '-' + String(seasonYear(er.last) % 100) : shortSeasonLabel(er.first);
    honorRows.push(erRange + ' ' + erTeamCn + (labelStr ? ' ' + labelStr : ''));
  });
  if (!honorRows.length) honorRows.push('暂无主要荣誉');
  var honorCardH = 32 + honorRows.length * 20;

  var legacy = c.legacy || null;
  var retired = !!c.retired;
  var posName = (SIM_CONFIG && SIM_CONFIG.POSITIONS) ? SIM_CONFIG.POSITIONS[s.position] : s.position;
  var displayName = (typeof getHupuDisplayName === 'function') ? getHupuDisplayName() : '我的球员';

  var C = {
    bg: '#faf5eb', bgCard: '#fffaf2', border: '#f0e0cc',
    text: '#2d1f0e', textDim: '#8a7a66', textMuted: '#baa992',
    orange: '#ff6b35', gold: '#f7a600', green: '#2ec4b6', red: '#e63946',
    fd: '"Fredoka","Noto Sans SC",sans-serif',
    fb: '"Nunito","Noto Sans SC",sans-serif'
  };

  var W = 480, cardW = W - 28, cardX = 14, cx = W / 2;
  var evalText = pickCareerEvaluation();
  var measureCtx = document.createElement('canvas').getContext('2d');
  measureCtx.font = '500 11px ' + C.fb;
  var evalLines = wrapCareerEvaluationText(evalText, cardW - 28, measureCtx);
  var evalCardH = 38 + evalLines.length * 20;
  var sections = [80, 92, 126, 130, honorCardH, 104, evalCardH, 18];
  var H = sections.reduce(function(a, b) { return a + b + 6; }, 0) + 8;

  var canvas = document.getElementById('posterCanvas');
  canvas.width = W * POSTER_SCALE;
  canvas.height = H * POSTER_SCALE;
  var ctx = canvas.getContext('2d');
  ctx.scale(POSTER_SCALE, POSTER_SCALE);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  function card(x, y, w, h) {
    ctx.fillStyle = '#fffaf2';
    roundRectC(ctx, x, y, w, h, 12); ctx.fill();
    ctx.strokeStyle = '#f0e0cc';
    ctx.lineWidth = 1.2;
    roundRectC(ctx, x, y, w, h, 12); ctx.stroke();
  }

  function fillCell(x, y, w, h, r) {
    ctx.fillStyle = 'rgba(255,107,53,0.06)';
    roundRectC(ctx, x, y, w, h, r); ctx.fill();
  }

  var y = 0;

  // 1. header
  y = 16;
  if (_hupuLogo) {
    ctx.save();
    ctx.drawImage(_hupuLogo, W - 14 - 28, y - 4, 28, 28);
    ctx.restore();
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '600 12px ' + C.fd;
  ctx.fillText('🏆 生涯海报', cx, y);
  y += 22;
  ctx.fillStyle = C.text;
  ctx.font = '800 30px ' + C.fd;
  ctx.fillText(displayName, cx, y);
  y += 34;

  // 2. 名片区
  var infoH = 92;
  card(cardX, y, cardW, infoH);
  var ix = cardX + 14, iw = cardW - 28;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 12px ' + C.fd;
  ctx.fillText('👤 我的球员信息', ix, y + 8);

  function infoRow(label, val, yy) {
    ctx.fillStyle = C.textDim;
    ctx.font = '400 11px ' + C.fb;
    ctx.textAlign = 'left';
    ctx.fillText(label, ix, yy);
    ctx.fillStyle = C.text;
    ctx.font = '500 12px ' + C.fd;
    ctx.textAlign = 'right';
    ctx.fillText(val, ix + iw, yy);
  }
  infoRow('位置', posName, y + 30);
  infoRow('总评', String(s.finalOVR || 0), y + 50);
  infoRow('球队', allTeamsStr, y + 70);
  y += infoH + 6;

  // 3. 我的最后属性
  cardH = 126;
  card(cardX, y, cardW, cardH);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 13px ' + C.fd;
  ctx.fillText('🏷️ 我的最后属性', cardX + 14, y + 8);

  var attrKeys2 = (SIM_CONFIG && SIM_CONFIG.ATTR_LIST) ? SIM_CONFIG.ATTR_LIST : [];
  var attrCN2 = (typeof window.attrCN === 'function') ? window.attrCN : function(k) { return k; };
  var aCols2 = 5, aGap2 = 3;
  var aW2 = (cardW - 32 - (aCols2 - 1) * aGap2) / aCols2, aH2 = 28;
  for (var ai2 = 0; ai2 < attrKeys2.length; ai2++) {
    var k2 = attrKeys2[ai2];
    var val2 = (s.attrs && s.attrs[k2] != null) ? s.attrs[k2] : 50;
    var grade2 = getGrade ? getGrade(val2) : { letter: 'C', color: C.textDim };
    var acol2 = ai2 % aCols2, arow2 = Math.floor(ai2 / aCols2);
    var ax2 = cardX + 14 + acol2 * (aW2 + aGap2);
    var ay2 = y + 28 + arow2 * (aH2 + aGap2);
    fillCell(ax2, ay2, aW2, aH2, 5);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.textDim;
    ctx.font = '400 8px ' + C.fb;
    ctx.fillText(attrCN2(k2), ax2 + aW2 / 2, ay2 + 2);
    ctx.fillStyle = grade2.color;
    ctx.font = '500 13px ' + C.fd;
    ctx.fillText(grade2.letter, ax2 + aW2 / 2, ay2 + 14);
  }
  y += cardH + 6;

  // 4. 生涯数据
  var cardH = 130;
  card(cardX, y, cardW, cardH);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 13px ' + C.fd;
  ctx.fillText('📊 生涯总数据', cardX + 14, y + 8);

  var statLabels = ['总出场', '总得分', '场均得分', '场均篮板', '场均助攻', '场均抢断'];
  var statVals = [tg, Math.round(ts.pts || 0), avg.pts, avg.reb, avg.ast, avg.stl];
  var sCols = 3, sGap = 5;
  var sW = (cardW - 32 - (sCols - 1) * sGap) / sCols, sH = 34;
  for (var si = 0; si < 6; si++) {
    var scol = si % sCols, srow = Math.floor(si / sCols);
    var sx = cardX + 14 + scol * (sW + sGap);
    var sy = y + 30 + srow * (sH + sGap);
    fillCell(sx, sy, sW, sH, 6);
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillStyle = C.text;
    ctx.font = '500 16px ' + C.fd;
    ctx.fillText(statVals[si].toString(), sx + sW / 2, sy + 2);
    ctx.fillStyle = C.textDim;
    ctx.font = '400 9px ' + C.fb;
    ctx.fillText(statLabels[si], sx + sW / 2, sy + 22);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.textDim;
  ctx.font = '400 10px ' + C.fb;
  ctx.fillText(fgm + '-' + fga + ' (' + pct + '%)、三分 ' + t3m + '-' + t3a + ' (' + threePct + '%)', cx, y + 30 + 2 * (sH + sGap) + 3);
  y += cardH + 6;

  // 5. 荣誉墙
  cardH = honorCardH;
  card(cardX, y, cardW, cardH);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 13px ' + C.fd;
  ctx.fillText('🏆 生涯纪录', cardX + 14, y + 8);
  for (var hri = 0; hri < honorRows.length; hri++) {
    fillCell(cardX + 14, y + 26 + hri * 20, cardW - 28, 18, 5);
    ctx.fillStyle = C.text;
    ctx.font = '500 10px ' + C.fd;
    ctx.fillText(honorRows[hri], cardX + 18, y + 26 + hri * 20 + 3);
  }
  y += cardH + 6;

  // 6. 历史地位 / 最终模板摘要
  cardH = 104;
  card(cardX, y, cardW, cardH);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 13px ' + C.fd;
  ctx.fillText(retired && legacy ? '🏅 历史地位' : '🏷️ 最终模板', cardX + 14, y + 8);
  if (retired && legacy) {
    infoRow('历史档位', legacy.tier || '—', y + 32);
    infoRow('名人堂', legacy.hof ? '✅ 入选' : '未入选', y + 54);
    infoRow('历史百大', legacy.top100 ? '✅ 入选' : '未入选', y + 76);
  } else {
    var archMatch = (typeof matchPlayerArchetype === 'function') ? matchPlayerArchetype(s.attrs, 1) : [];
    var archInfo = archMatch.length > 0 ? archMatch[0] : null;
    infoRow('总评', String(s.finalOVR || 0), y + 32);
    infoRow('风格', archInfo ? archInfo.cn : '无', y + 54);
    infoRow('位置', posName, y + 76);
  }
  y += cardH + 6;

  // 7. 生涯评价
  cardH = evalCardH;
  card(cardX, y, cardW, cardH);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillStyle = C.orange;
  ctx.font = '500 13px ' + C.fd;
  ctx.fillText('💬 生涯评价', cardX + 14, y + 8);
  ctx.fillStyle = C.text;
  ctx.font = '500 11px ' + C.fb;
  for (var eli = 0; eli < evalLines.length; eli++) {
    ctx.fillText(evalLines[eli], cardX + 14, y + 30 + eli * 20);
  }
  y += cardH + 6;

  // 8. 水印
  ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
  ctx.fillStyle = C.textMuted;
  ctx.font = '400 9px ' + C.fb;
  ctx.fillText('我的球员作品', cx, H - 6);

  canvas._corsSafe = true;
  var dataURL = canvas.toDataURL('image/png');
  var pages = [dataURL];
  if (c.retired && c.legacy) {
    pages.push(generateRetirementStoryPosterDataURL(c.legacy));
  }
  if (c.retired && c.legacy) {
    pages.push(generateCareerBiographyPosterDataURL(c.legacy));
  }
  setPosterPages(pages, 0);
}

function stripPosterHtml(text) {
  return String(text || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildRetirementStoryPosterSections(r) {
  r = r || calculateLegacyResult();
  var c = STATE.career || {};
  var displayName = (typeof getHupuDisplayName === 'function') ? getHupuDisplayName() : '我的球员';
  var jerseyTeams = Array.isArray(r.jerseyTeams) ? r.jerseyTeams : [];
  var jerseyText = '';
  if (jerseyTeams.length) {
    var first = jerseyTeams[0];
    jerseyText = buildJerseyCeremonyCopy(first);
  } else {
    jerseyText = displayName + '离开球场时，没有球衣被升上屋顶。可有些号码不需要仪式确认，记住它的人会在多年后提起某个夜晚、某个回合、某次沉默的掌声。';
  }

  return [
    {
      title: '退役发言',
      kicker: 'Final Words',
      text: buildRetirementCopy(r)
    },
    {
      title: '退役球衣',
      kicker: 'Jersey Ceremony',
      text: jerseyText
    },
    {
      title: '名人堂',
      kicker: 'Hall of Fame',
      text: buildHofCopy(r)
    },
    {
      title: '历史百大',
      kicker: 'All-Time Top 100',
      text: buildTop100Copy(r)
    }
  ].map(function(section) {
    section.text = stripPosterHtml(section.text);
    return section;
  });
}

function getRetirementPosterLines(ctx, text, maxW, font) {
  ctx.font = font;
  var rawLines = String(text || '').split('\n');
  var lines = [];
  for (var i = 0; i < rawLines.length; i++) {
    var piece = rawLines[i].trim();
    if (!piece) {
      if (lines.length && lines[lines.length - 1] !== '') lines.push('');
      continue;
    }
    var wrapped = wrapCareerEvaluationText(piece, maxW, ctx);
    for (var j = 0; j < wrapped.length; j++) lines.push(wrapped[j]);
  }
  return lines;
}

function drawRetirementPosterText(ctx, text, x, y, maxW, lineH, maxLines, font, color) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  var lines = getRetirementPosterLines(ctx, text, maxW, font);
  if (maxLines && lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines[maxLines - 1] = lines[maxLines - 1].replace(/[，。！？；、,.!?;:]*$/, '') + '…';
  }
  for (var li = 0; li < lines.length; li++) {
    if (lines[li]) ctx.fillText(lines[li], x, y + li * lineH);
  }
}

function generateRetirementStoryPosterDataURL(r) {
  var c = STATE.career || {};
  r = r || c.legacy || calculateLegacyResult();
  if (!r) return '';

  var displayName = (typeof getHupuDisplayName === 'function') ? getHupuDisplayName() : '我的球员';
  var seasons = (c.seasons || []).length || (r.seasons || 0);
  var summary = seasons + '年生涯，' + Math.round(r.games || 0) + '场，' + Math.round(r.points || 0) + '分，' + (r.mvp || 0) + '座MVP，' + (r.championships || 0) + '枚总冠军戒指。';
  var C = {
    bg: '#faf5eb', bgCard: '#fffaf2', border: '#ead6bb',
    text: '#2d1f0e', textDim: '#7f6e59', textMuted: '#b49d80',
    orange: '#ff6b35', gold: '#d49a35', seal: '#b94835',
    fd: '"Fredoka","Noto Sans SC",sans-serif',
    fb: '"Nunito","Noto Sans SC",sans-serif'
  };
  var W = 480, cx = W / 2;
  var sections = buildRetirementStoryPosterSections(r);
  var gap = 12, headerH = 138, footerH = 38;
  var bodyFont = '500 11px ' + C.fb, bodyLineH = 20;
  var measureCtx = document.createElement('canvas').getContext('2d');
  var cardMetrics = sections.map(function(section, idx) {
    var cardW = idx % 2 === 0 ? 420 : 392;
    var lines = getRetirementPosterLines(measureCtx, section.text, cardW - 30, bodyFont);
    return { lines: lines, w: cardW, h: Math.max(136, 64 + Math.max(lines.length, 1) * bodyLineH) };
  });
  var H = headerH + footerH + (sections.length - 1) * gap;
  for (var mi = 0; mi < cardMetrics.length; mi++) H += cardMetrics[mi].h;
  H = Math.max(720, H);

  var canvas = document.getElementById('posterCanvas');
  canvas.width = W * POSTER_SCALE;
  canvas.height = H * POSTER_SCALE;
  var ctx = canvas.getContext('2d');
  ctx.scale(POSTER_SCALE, POSTER_SCALE);

  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  for (var gy = 94; gy < H; gy += 42) {
    ctx.beginPath();
    ctx.moveTo(24, gy);
    ctx.lineTo(W - 24, gy);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.12;
  ctx.strokeStyle = C.gold;
  ctx.beginPath();
  ctx.arc(cx, 82, 126, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();
  ctx.restore();

  if (_hupuLogo) {
    ctx.save();
    ctx.drawImage(_hupuLogo, W - 42, 16, 28, 28);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = C.textMuted;
  ctx.font = '700 10px ' + C.fb;
  ctx.fillText('CAREER ARCHIVE', cx, 20);
  ctx.fillStyle = C.text;
  ctx.font = '900 34px ' + C.fd;
  ctx.fillText(displayName, cx, 42);

  ctx.fillStyle = C.bgCard;
  roundRectC(ctx, 34, 94, W - 68, 28, 14); ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  roundRectC(ctx, 34, 94, W - 68, 28, 14); ctx.stroke();
  ctx.fillStyle = C.textDim;
  ctx.font = '500 10px ' + C.fb;
  ctx.fillText('生涯小结：' + summary, cx, 102);

  var y = headerH;
  for (var si = 0; si < sections.length; si++) {
    var section = sections[si];
    var metric = cardMetrics[si];
    var cardH = metric.h;
    var cardW = metric.w;
    var cardX = si % 2 === 0 ? 18 : W - cardW - 18;
    var nodeX = si % 2 === 0 ? cardX + cardW + 11 : cardX - 11;

    ctx.save();
    ctx.globalAlpha = 0.72;
    ctx.strokeStyle = C.gold;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(nodeX, y - 6);
    ctx.lineTo(nodeX, y + cardH + 6);
    ctx.stroke();
    ctx.fillStyle = C.bg;
    ctx.beginPath();
    ctx.arc(nodeX, y + 31, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = C.bgCard;
    roundRectC(ctx, cardX, y, cardW, cardH, 12); ctx.fill();
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 1.2;
    roundRectC(ctx, cardX, y, cardW, cardH, 12); ctx.stroke();

    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = C.orange;
    ctx.font = '800 14px ' + C.fd;
    ctx.fillText(section.title, cardX + 14, y + 12);
    ctx.fillStyle = C.textMuted;
    ctx.font = '700 8px ' + C.fb;
    ctx.textAlign = 'right';
    ctx.fillText(section.kicker.toUpperCase(), cardX + cardW - 14, y + 16);

    if (si === 0 || si === 3) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.strokeStyle = C.seal;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cardX + cardW - 44, y + cardH - 42, 28, 0, Math.PI * 2);
      ctx.stroke();
      ctx.font = '800 16px ' + C.fd;
      ctx.textAlign = 'center';
      ctx.fillStyle = C.seal;
      ctx.fillText(si === 0 ? '终章' : '史册', cardX + cardW - 44, y + cardH - 51);
      ctx.restore();
    }

    drawRetirementPosterText(ctx, section.text, cardX + 15, y + 44, cardW - 30, bodyLineH, null, bodyFont, C.text);
    y += cardH + gap;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = C.textMuted;
  ctx.font = '400 9px ' + C.fb;
  ctx.fillText('我的球员作品', cx, H - 10);

  canvas._corsSafe = true;
  return canvas.toDataURL('image/png');
}

function generateRetirementStoryPoster() {
  var dataURL = generateRetirementStoryPosterDataURL();
  if (dataURL) setPosterPages([dataURL], 0);
}

// ── 关闭海报 ──
function closePoster() {
  document.getElementById('posterOverlay').style.display = 'none';
  if (STATE && STATE.career && STATE.career.retired) {
    if (STATE.career.flags && STATE.career.flags.postCareerDeferred) showCareerStats(1);
    else startPostCareerFlow();
  }
}
