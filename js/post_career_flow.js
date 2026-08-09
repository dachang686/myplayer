// Post-career event and legacy flow.

function getBranchEventById(id) {
  var source = getBranchEventSource();
  for (var i = 0; i < source.length; i++) {
    if (source[i].id === id) return source[i];
  }
  return null;
}

function startPostCareerFlow() {
  if (!STATE.career || !STATE.career.retired) return;
  STATE.career.flags = STATE.career.flags || {};
  STATE._postCareerScenePage = 0;
  STATE._postCareerEvent = null;
  if (getBranchNode('post_career') === 'start' && !STATE.career.flags.postCareerDone) {
    askSimulateFirstSummer();
    return;
  }
  showNextPostCareerEvent();
}

function askSimulateFirstSummer() {
  var existing = document.getElementById('first-summer-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="first-summer-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>🏁 退役后的第一个夏天</span></div>';
  html += '<div style="padding:14px;">';
  html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">你从更衣室搬出行李，站在停车场里，第一次不知道明天该去哪个球馆。手机响了一整天，大家都在问你接下来想做什么。<br><br>要模拟这段退役后的夏天吗？</div>';
  html += '<button class="btn btn-primary btn-sm" style="width:100%;margin-bottom:8px;" onclick="confirmStartPostCareer()">开始模拟</button>';
  html += '<button class="btn btn-secondary btn-sm" style="width:100%;" onclick="declinePostCareerForNow()">暂不模拟</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function confirmStartPostCareer() {
  var modal = document.getElementById('first-summer-modal');
  if (modal) modal.remove();
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.postCareerDeferred = false;
  showNextPostCareerEvent();
}

function declinePostCareerForNow() {
  var modal = document.getElementById('first-summer-modal');
  if (modal) modal.remove();
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.postCareerDeferred = true;
  showCareerStats(1);
}

function showNextPostCareerEvent() {
  var node = getBranchNode('post_career');
  var id = '';
  if (node === 'start') id = 'post_career_opening';
  else if (node === 'gap_year') id = 'post_career_gap_return';
  else if (node === 'post_career_map') id = 'post_career_map';
  else if (node === 'commentator' || node === 'assistant_coach' || node === 'head_coach' || node === 'team_owner' || node === 'youth_academy' || node === 'china_consultant' || node === 'agency_partner' || node === 'freelancer') id = 'post_career_first_year';
  else if (node === 'low_key' || node === 'identity_settled' || node === 'identity_adjusted' || node === 'identity_voice') {
    finishPostCareer();
    return;
  }
  var ev = id ? getBranchEventById(id) : null;
  if (!ev) { finishPostCareer(); return; }
  STATE._postCareerEvent = ev;
  STATE._postCareerScenePage = 0;
  showPostCareerEventModal(ev);
}

function showPostCareerEventModal(ev) {
  var existing = document.getElementById('post-career-modal');
  if (existing) existing.remove();
  var scenes = ev.scenes || [];
  var sceneIdx = STATE._postCareerScenePage || 0;
  var title = getPlayerFacingBranchTitle(ev.title);
  var html = '<div class="team-picker-overlay" id="post-career-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  if (scenes.length && sceneIdx < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillBranchEventText(scenes[sceneIdx]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continuePostCareerScene()">继续</button>';
  } else {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillBranchEventText(ev.body)) + '</div>';
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
    ev.choices.forEach(function(ch, ci) {
      var locked = isBranchChoiceLocked(ch);
      var lockHint = locked ? (ch.lockHint || '需要对应线路结果') : '';
      var btnStyle = 'width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;' + (locked ? 'opacity:.45;cursor:not-allowed;' : '');
      var onclick = locked ? '' : 'onclick="choosePostCareerEvent(' + ci + ')"';
      html += '<button class="btn btn-secondary btn-sm" style="' + btnStyle + '" ' + onclick + (locked ? ' disabled' : '') + '>' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(fillBranchEventText(locked ? lockHint : (ch.hint || ''))) + '</span></button>';
    });
  }
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continuePostCareerScene() {
  var ev = STATE._postCareerEvent;
  if (!ev) return;
  STATE._postCareerScenePage = (STATE._postCareerScenePage || 0) + 1;
  showPostCareerEventModal(ev);
}

function choosePostCareerEvent(choiceIdx) {
  var ev = STATE._postCareerEvent;
  if (!ev) return;
  var ch = ev.choices[choiceIdx];
  if (!ch || isBranchChoiceLocked(ch)) return;
  var msg = ch.apply ? ch.apply() : '';
  msg = applyChoiceBonus(ch, msg);
  recordBranchChoice(ev, ch, msg, 'post_career');
  var modal = document.getElementById('post-career-modal');
  if (modal) modal.remove();
  STATE._postCareerEvent = null;
  STATE._postCareerScenePage = 0;
  showPostCareerResultModal(ev.title, msg);
}

function showPostCareerResultModal(title, msg) {
  var existing = document.getElementById('post-career-result-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="post-career-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + getPlayerFacingBranchTitle(title) + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += formatBranchResultText(fillBranchEventText(msg));
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="finishPostCareerStep()">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function finishPostCareerStep() {
  var modal = document.getElementById('post-career-result-modal');
  if (modal) modal.remove();
  showNextPostCareerEvent();
}

function applyPostCareerIdentityDelta(amount) {
  var id = (STATE.career.flags && STATE.career.flags.postCareerIdentity) || 'commentator';
  var key = 'mediaTrust';
  if (id === 'assistant_coach' || id === 'head_coach') key = 'lockerRoomTrust';
  else if (id === 'team_owner' || id === 'agency_partner') key = 'businessValue';
  else if (id === 'china_consultant') key = 'chinaPopularity';
  else if (id === 'youth_academy') key = 'fanSupport';
  else if (id === 'freelancer') key = 'mediaTrust';
  addProfileDelta(key, amount || 2);
}

function finishPostCareer() {
  STATE.career.flags = STATE.career.flags || {};
  STATE.career.flags.postCareerDone = true;
  clearAutoSaveStorage();
  showCareerStats(1);
}

var _countdownLegacyEvent = null;
var _countdownLegacyScenePage = 0;

function startCountdownLegacyFlow() {
  var ev = getBranchEventById('countdown_legacy');
  if (!ev) { showPlayerRetirementChoice(); return; }
  _countdownLegacyEvent = ev;
  _countdownLegacyScenePage = 0;
  showCountdownLegacyModal();
}

function showCountdownLegacyModal() {
  var ev = _countdownLegacyEvent;
  if (!ev) return;
  var existing = document.getElementById('countdown-legacy-modal');
  if (existing) existing.remove();
  var scenes = ev.scenes || [];
  var sceneIdx = _countdownLegacyScenePage || 0;
  var title = getPlayerFacingBranchTitle(ev.title);
  var html = '<div class="team-picker-overlay" id="countdown-legacy-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + title + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  if (scenes.length && sceneIdx < scenes.length) {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">剧情</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.65;margin-bottom:14px;">' + fillBranchEventText(scenes[sceneIdx]) + '</div>';
    html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="continueCountdownLegacyScene()">继续</button>';
  } else {
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">重点</div>';
    html += '<div style="font-size:13px;color:var(--text-dim);line-height:1.55;margin-bottom:12px;">' + sanitizePlayerFacingText(fillBranchEventText(ev.body)) + '</div>';
    html += '<div style="font-size:11px;color:var(--orange);font-weight:700;margin-bottom:6px;">选择</div>';
    ev.choices.forEach(function(ch, ci) {
      var locked = isBranchChoiceLocked(ch);
      var lockHint = locked ? (ch.lockHint || '需要对应线路结果') : '';
      var btnStyle = 'width:100%;margin-bottom:8px;justify-content:flex-start;text-align:left;' + (locked ? 'opacity:.45;cursor:not-allowed;' : '');
      var onclick = locked ? '' : 'onclick="chooseCountdownLegacyEvent(' + ci + ')"';
      html += '<button class="btn btn-secondary btn-sm" style="' + btnStyle + '" ' + onclick + (locked ? ' disabled' : '') + '>' + ch.label + '<span style="display:block;font-size:11px;font-family:var(--font-body);font-weight:400;opacity:.75;margin-left:4px;">' + sanitizePlayerFacingText(fillBranchEventText(locked ? lockHint : (ch.hint || ''))) + '</span></button>';
    });
  }
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function continueCountdownLegacyScene() {
  var ev = _countdownLegacyEvent;
  if (!ev) return;
  _countdownLegacyScenePage = (_countdownLegacyScenePage || 0) + 1;
  showCountdownLegacyModal();
}

function chooseCountdownLegacyEvent(choiceIdx) {
  var ev = _countdownLegacyEvent;
  if (!ev) return;
  var ch = ev.choices[choiceIdx];
  if (!ch || isBranchChoiceLocked(ch)) return;
  var msg = ch.apply ? ch.apply() : '';
  msg = applyChoiceBonus(ch, msg);
  recordBranchChoice(ev, ch, msg, 'countdown');
  var modal = document.getElementById('countdown-legacy-modal');
  if (modal) modal.remove();
  _countdownLegacyEvent = null;
  _countdownLegacyScenePage = 0;
  showCountdownLegacyResultModal(ev.title, msg);
}

function showCountdownLegacyResultModal(title, msg) {
  var existing = document.getElementById('countdown-legacy-result-modal');
  if (existing) existing.remove();
  var html = '<div class="team-picker-overlay" id="countdown-legacy-result-modal">';
  html += '<div class="team-picker-modal">';
  html += '<div class="team-picker-header"><span>' + getPlayerFacingBranchTitle(title) + '</span></div>';
  html += '<div style="padding:14px 14px 8px;">';
  html += formatBranchResultText(fillBranchEventText(msg));
  html += '<button class="btn btn-primary btn-sm" style="width:100%;" onclick="finishCountdownLegacy()">继续</button>';
  html += '</div></div></div>';
  document.body.insertAdjacentHTML('beforeend', html);
}

function finishCountdownLegacy() {
  var modal = document.getElementById('countdown-legacy-result-modal');
  if (modal) modal.remove();
  showPlayerRetirementChoice();
}
