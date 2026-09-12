async (page) => {
  const sleep = ms => page.waitForTimeout(ms);

  async function pageState() {
    return page.evaluate(() => ({
      careerSeason: Number(STATE.career && STATE.career.seasonCount) || 0,
      age: Number(STATE.career && STATE.career.currentAge) || 0,
      team: STATE.careerTeam,
      finalOvr: Number(STATE.finalOVR) || 0,
      games: (STATE.season && STATE.season.schedule || []).filter(game => game.simulated).length,
      totalGames: (STATE.season && STATE.season.schedule || []).length,
      auto: !!STATE._calendarAutoSimulating,
      playoffActive: !!(STATE.season && (STATE.season.playoffBracket || STATE.season.playInState)
        && !STATE.season.playoffsDone && !STATE.season.playoffEliminated
        && !(STATE.season.playInState && STATE.season.playInState.isEliminated)),
      playoffDone: !!(STATE.season && (STATE.season.playoffsDone || STATE.season.playoffEliminated || STATE.season.isChampion)),
      saved: !!STATE._careerSaved,
      trainingScreen: !!document.querySelector('.screen.active#screen-training'),
      draftPhase: STATE.offseasonDraft && STATE.offseasonDraft.phase || null,
    }));
  }

  async function handleModal() {
    const poster = page.locator('#posterOverlay');
    if (await poster.count()) {
      const close = poster.getByRole('button', { name: '关闭' });
      if (await close.count()) await close.click();
      else await page.evaluate(() => { const node = document.getElementById('posterOverlay'); if (node) node.remove(); });
      await sleep(120);
      return true;
    }
    const contractModal = page.locator('#contract-modal:visible');
    if (await contractModal.count()) {
      const card = contractModal.locator('.team-pick-card[onclick]:visible').first();
      if (await card.count()) {
        await card.click();
        await sleep(150);
        const sign = page.locator('#confirmSignBtn');
        if (await sign.count()) await sign.click();
        await sleep(150);
        return true;
      }
      await sleep(120);
      return true;
    }

    const preview = page.locator('#team-roster-preview-overlay');
    if (await preview.count()) {
      const sign = preview.locator('#confirmSignBtn');
      if (await sign.count()) await sign.click();
      else {
        const buttons = preview.locator('button:not([disabled])');
        if (await buttons.count()) await buttons.last().click();
      }
      await sleep(150);
      return true;
    }

    const retirement = page.locator('#player-retirement-choice:visible');
    if (await retirement.count()) {
      const continueButton = retirement.getByRole('button', { name: /继续战斗/ });
      if (await continueButton.count()) await continueButton.click();
      await sleep(150);
      return true;
    }

    const contractRetirement = page.locator('#contract-retirement-choice:visible');
    if (await contractRetirement.count()) {
      const back = contractRetirement.getByRole('button', { name: /返回合同选择/ });
      if (await back.count()) await back.click();
      await sleep(150);
      return true;
    }

    const overlays = page.locator('.awards-overlay:visible,.team-picker-overlay:visible');
    if (await overlays.count()) {
      const overlay = overlays.last();
      const text = (await overlay.innerText()).slice(0, 240);
      const continueButton = text.includes('是否宣布退役')
        ? overlay.getByRole('button', { name: /继续战斗/ })
        : overlay.locator('button:not([disabled])').first();
      if (await continueButton.count()) {
        await continueButton.click();
        await sleep(120);
        return true;
      }
    }
    return false;
  }

  async function drainModals(limit = 80) {
    for (let index = 0; index < limit; index += 1) {
      if (!(await handleModal())) return;
    }
  }

  async function simulateRegularSeason() {
    await page.evaluate(() => startSeasonSimulation());
    const deadline = Date.now() + 45000;
    while (Date.now() < deadline) {
      if (await handleModal()) continue;
      const status = await pageState();
      if (!status.auto && status.games >= status.totalGames) return status;
      await sleep(250);
    }
    throw new Error('常规赛模拟超时：' + JSON.stringify(await pageState()));
  }

  async function simulatePlayoffsIfNeeded() {
    let status = await pageState();
    if (!status.playoffActive) return status;

    await page.evaluate(() => resumePlayoffs());
    await sleep(250);
    const deadline = Date.now() + 150000;
    while (Date.now() < deadline) {
      if (await handleModal()) continue;
      status = await pageState();
      if (status.playoffDone || !status.playoffActive) return status;
      await page.evaluate(() => {
        if (typeof runGlobalNextAction === 'function') runGlobalNextAction();
      });
      await sleep(450);
    }
    throw new Error('季后赛模拟超时：' + JSON.stringify(await pageState()));
  }

  async function startOffseasonAndReachTraining() {
    await page.evaluate(() => {
      showSeasonResults();
      beginOffseason();
    });
    await sleep(500);

    const phase = await page.evaluate(() => STATE.offseasonDraft && STATE.offseasonDraft.phase);
    if (phase === 'lottery') {
      await page.evaluate(() => revealAllLotteryPicks());
      await sleep(450);
      await page.evaluate(() => completeOffseasonDraftLottery());
      await sleep(450);
      await page.evaluate(() => {
        STATE.offseasonDraft.pickTrades.strategy = 'hold';
        submitDraftPickTradeAdvice();
      });
      await sleep(450);
      await page.evaluate(() => completeDraftPickTradeWindow());
    }

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      if (await handleModal()) continue;
      const status = await pageState();
      if (status.trainingScreen) return status;
      await sleep(200);
    }
    throw new Error('休赛期未进入训练营：' + JSON.stringify(await pageState()));
  }

  async function completeTrainingAndDraftPipeline() {
    await page.evaluate(() => {
      const preferred = ['HAN', 'threePT', 'ATH', 'PAS', 'FIN', 'PDEF'];
      let guard = 0;
      while (calculateTrainingSpentPoints(STATE.attrs, STATE._tpPending || {}) < calcTrainingPoints()
        && guard++ < 100) {
        const pending = STATE._tpPending || {};
        const key = preferred.concat(ATTR_KEYS).find(attribute => {
          const current = Number(STATE.attrs[attribute]) || 50;
          const added = Number(pending[attribute]) || 0;
          return current + added < 99;
        });
        if (!key) break;
        addTrainingPoint(key);
      }
      confirmTraining();
    });

    const draftDeadline = Date.now() + 30000;
    while (Date.now() < draftDeadline) {
      if (await handleModal()) continue;
      const status = await pageState();
      if (status.draftPhase === 'draft' || status.trainingScreen) break;
      await sleep(200);
    }

    let phase = await page.evaluate(() => STATE.offseasonDraft && STATE.offseasonDraft.phase);
    if (phase === 'offseason') {
      await page.evaluate(() => beginOffseasonDraft());
      await sleep(250);
      phase = await page.evaluate(() => STATE.offseasonDraft && STATE.offseasonDraft.phase);
    }
    if (phase === 'draft') {
      await page.evaluate(() => finishAllDraftPicks());
      await sleep(180);
    }
    if (await page.evaluate(() => STATE.offseasonDraft && STATE.offseasonDraft.phase === 'complete')) {
      await page.evaluate(() => advanceAfterOffseasonDraft(null));
    }

    const pipelineDeadline = Date.now() + 30000;
    while (Date.now() < pipelineDeadline) {
      if (await handleModal()) continue;
      const status = await pageState();
      if (status.totalGames === 82 && status.careerSeason > 0 && !status.saved && !status.trainingScreen) {
        return status;
      }
      await sleep(220);
    }
    throw new Error('休赛期流水线未进入新赛季：' + JSON.stringify(await pageState()));
  }

  const progress = [];
  while ((await pageState()).careerSeason < 20) {
    const before = await pageState();
    const regular = await simulateRegularSeason();
    let postseason = regular;
    if (regular.playoffActive) postseason = await simulatePlayoffsIfNeeded();
    const nextSeason = await startOffseasonAndReachTraining();
    const after = await completeTrainingAndDraftPipeline();
    progress.push({
      completedSeason: after.careerSeason,
      wins: regular.wins,
      losses: regular.losses,
      userOvr: after.finalOvr,
      playoffDone: !!postseason.playoffDone,
      nextAge: after.age,
    });
    if (after.careerSeason <= before.careerSeason) throw new Error('赛季计数没有前进：' + JSON.stringify({ before, after, progress }));
  }

  return await page.evaluate(progressRows => {
    const players = LEAGUE_TEAM_IDS.flatMap(team => LEAGUE_PLAYER_DATA[team] || [])
      .concat(Array.isArray(STATE._freeAgentPool) ? STATE._freeAgentPool : [])
      .filter(player => player && !player._isUser);
    const sorted = players.slice().sort((left, right) => (Number(right.ovr) || 0) - (Number(left.ovr) || 0));
    const values = players.map(player => Number(player.ovr) || 0).sort((a, b) => a - b);
    const bands = { '90+': 0, '85-89': 0, '80-84': 0, '75-79': 0, '70-74': 0, '69及以下': 0 };
    values.forEach(value => {
      if (value >= 90) bands['90+']++;
      else if (value >= 85) bands['85-89']++;
      else if (value >= 80) bands['80-84']++;
      else if (value >= 75) bands['75-79']++;
      else if (value >= 70) bands['70-74']++;
      else bands['69及以下']++;
    });
    const initial = STATE.career.seasons[0] || {};
    return {
      seasons: STATE.career.seasonCount,
      age: STATE.career.currentAge,
      engine: [STATE.simulationEngine, STATE.season.simulationEngine],
      team: STATE.careerTeam,
      playerOvr: STATE.finalOVR,
      players: players.length,
      averageOvr: Number((values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)).toFixed(2)),
      medianOvr: values.length % 2 ? values[(values.length - 1) / 2] : Number(((values[values.length / 2 - 1] + values[values.length / 2]) / 2).toFixed(2)),
      minOvr: values[0] || 0,
      maxOvr: values[values.length - 1] || 0,
      bands,
      top20: sorted.slice(0, 20).map(player => ({ id: player.id, name: player.cname, team: LEAGUE_TEAM_IDS.find(team => (LEAGUE_PLAYER_DATA[team] || []).indexOf(player) >= 0) || 'FA', age: player._age || null, ovr: player.ovr, type: player.type || null })),
      originalPlayer: { name: 'V2测试球员', team: STATE.careerTeam, ovr: STATE.finalOVR },
      careerSeasons: STATE.career.seasons.length,
      progress: progressRows,
      initialSeason: { team: initial.team, wins: initial.wins, losses: initial.losses, playoffResult: initial.playoffResult },
    };
  }, progress);
}
