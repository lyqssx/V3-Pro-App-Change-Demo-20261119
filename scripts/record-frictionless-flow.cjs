const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const sharp = require('sharp');

const projectDir = path.resolve(__dirname, '..');
const handPath = path.join(projectDir, 'assets/video-guides/finger-pointer.svg');
const ffmpegPath = '/Users/lute/.local/bin/ffmpeg';
const sourceUrl = process.env.DEMO_URL || 'http://127.0.0.1:8765/index.html';
const scenario = process.env.RECORD_SCENARIO || 'frictionless';
const scenarioConfig = {
  frictionless: {
    folder: 'frictionless',
    outputName: 'SA-P01-frictionless-flow'
  },
  'fit-not-detected': {
    folder: 'fit-not-detected',
    outputName: 'SA-P02-fit-not-detected'
  },
  'minor-leak': {
    folder: 'minor-leak-compensation',
    outputName: 'SA-P03-minor-leak-compensation'
  },
  'major-leak-resolved': {
    folder: 'major-leak-resolved',
    outputName: 'SA-P04-major-leak-resolved'
  },
  'major-leak-skipped': {
    folder: 'major-leak-skipped',
    outputName: 'SA-P05-major-leak-skipped'
  },
  'major-leak-recheck-failed': {
    folder: 'major-leak-recheck-failed',
    outputName: 'SA-P06-major-leak-recheck-failed'
  }
};
if (!scenarioConfig[scenario]) throw new Error(`Unsupported recording scenario: ${scenario}`);
const outputDir = path.resolve(projectDir, `../../output/videos/v3-pro-stability-assistant/${scenarioConfig[scenario].folder}`);
const outputName = scenarioConfig[scenario].outputName;
const chromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const captureViewport = { width: 402, height: 874 };
const handWidth = 266;
fs.mkdirSync(outputDir, { recursive: true });
const tempVideoDir = fs.mkdtempSync(path.join(outputDir, '.recording-'));
const handPngPath = path.join(tempVideoDir, 'figma-right-hand.png');

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function validateRecordingLayout(page) {
  const layout = await page.evaluate(() => {
    const demo = document.querySelector('#demo');
    const start = document.querySelector('#demo [data-v4="start"]');
    const levels = document.querySelector('#demo .v57-levels');
    if (!demo || !start || !levels) return null;
    const demoRect = demo.getBoundingClientRect();
    const startRect = start.getBoundingClientRect();
    return {
      demo: { width: demoRect.width, height: demoRect.height },
      start: {
        left: startRect.left,
        right: startRect.right,
        width: startRect.width,
        center: startRect.left + startRect.width / 2
      },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      levelClass: levels.className
    };
  });
  if (!layout) throw new Error('Recording layout is missing the start button or v57 level control');
  const expectedCenter = captureViewport.width / 2;
  const centered = Math.abs(layout.start.center - expectedCenter) <= 0.5;
  const expectedCanvas = layout.demo.width === captureViewport.width && layout.demo.height === captureViewport.height;
  if (!centered || !expectedCanvas) {
    throw new Error(`Recording layout validation failed: ${JSON.stringify(layout)}`);
  }
  return layout;
}

async function resetDemo(page) {
  await page.evaluate(() => {
    if (window.V3ProLeakFlow && typeof window.V3ProLeakFlow.resetSession === 'function') {
      window.V3ProLeakFlow.resetSession();
    }
    state.page = 'control';
    state.modal = null;
    state.running = false;
    state.paused = false;
    state.timer = 0;
    state.auto = false;
    state.selectedProgram = null;
    state.controlNotice = null;
    state.hasLogged = false;
    state.milkL = 0;
    state.milkR = 0;
    state.air2SessionEnded = false;
    state.air2SessionSummaryKind = null;
    state.air2ShowSessionSummary = false;
    state.air2ShowLoggedSummary = false;
    state.microLeakDuringSession = false;
    state.v3LeakEvents = [];
    v4View();
  });
  await page.waitForSelector('#demo [data-v4="start"]', { state: 'visible' });
}

async function pointAt(page, selector, options = {}) {
  const locator = page.locator(selector).last();
  await locator.waitFor({ state: 'visible' });
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Cannot locate ${selector}`);
  const x = box.x + box.width * (options.xRatio ?? 0.5);
  const y = box.y + box.height * (options.yRatio ?? 0.5);
  await page.mouse.move(x, y, { steps: 18 });
  await pause(options.approachMs || 760);
  return { x, y, locator };
}

async function tap(page, selector, timeline, recordingEpoch, options = {}) {
  const approachStartedAt = (Date.now() - recordingEpoch) / 1000;
  const point = await pointAt(page, selector, options);
  const downAt = (Date.now() - recordingEpoch) / 1000;
  await page.mouse.down();
  await pause(options.holdMs || 180);
  await page.mouse.up();
  const upAt = (Date.now() - recordingEpoch) / 1000;
  timeline.push({
    kind: 'tap',
    x: point.x,
    y: point.y,
    start: approachStartedAt,
    down: downAt,
    up: upAt,
    end: upAt + 0.62
  });
  await pause(options.afterMs || 650);
}

async function hold(page, selector, holdMs, timeline, recordingEpoch) {
  const approachStartedAt = (Date.now() - recordingEpoch) / 1000;
  const point = await pointAt(page, selector, { yRatio: 0.18, approachMs: 820 });
  const downAt = (Date.now() - recordingEpoch) / 1000;
  await page.mouse.down();
  await pause(holdMs);
  await page.mouse.up();
  const upAt = (Date.now() - recordingEpoch) / 1000;
  timeline.push({
    kind: 'hold',
    x: point.x,
    y: point.y,
    start: approachStartedAt,
    down: downAt,
    up: upAt,
    end: upAt + 0.68
  });
  await pause(800);
}

function overlayExpression(mark, cropX, trimStart) {
  const fixed = (value) => Number(value).toFixed(3);
  const start = mark.start - trimStart;
  const down = mark.down - trimStart;
  const up = mark.up - trimStart;
  const end = mark.end - trimStart;
  const x = mark.x - cropX;
  const y = mark.y;
  const approachX = `if(lt(t,${fixed(down)}),${fixed(x)}+54*(${fixed(down)}-t)/${fixed(Math.max(0.001, down - start))},if(lt(t,${fixed(up)}),${fixed(x - 5)},${fixed(x)}+36*(t-${fixed(up)})/${fixed(Math.max(0.001, end - up))}))`;
  const approachY = `if(lt(t,${fixed(down)}),${fixed(y)}+82*(${fixed(down)}-t)/${fixed(Math.max(0.001, down - start))},if(lt(t,${fixed(up)}),${fixed(y - 5)},${fixed(y)}+52*(t-${fixed(up)})/${fixed(Math.max(0.001, end - up))}))`;
  return {
    x: approachX,
    y: approachY,
    enable: `between(t,${fixed(start)},${fixed(end)})`
  };
}

(async () => {
  // The source remains the Figma-exported vector. Rasterization only happens
  // because the final delivery format is video.
  await sharp(handPath).resize({ width: handWidth }).png().toFile(handPngPath);

  const browser = await chromium.launch({
    executablePath: chromeExecutable,
    headless: true
  });
  const context = await browser.newContext({
    viewport: captureViewport,
    deviceScaleFactor: 1,
    recordVideo: { dir: tempVideoDir, size: captureViewport }
  });
  const page = await context.newPage();
  const video = page.video();
  const recordingEpoch = Date.now();
  const timeline = [];

  await page.goto(sourceUrl, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) await document.fonts.ready;
  });
  await resetDemo(page);
  await page.evaluate(() => {
    const debugTrigger = document.querySelector('.demo-trigger-root');
    if (debugTrigger) debugTrigger.style.visibility = 'hidden';
  });
  const validatedLayout = await validateRecordingLayout(page);
  const demoBox = await page.locator('#demo').boundingBox();
  if (!demoBox) throw new Error('Cannot locate the Demo canvas');
  const crop = {
    x: Math.floor(demoBox.x),
    y: Math.floor(demoBox.y),
    width: Math.round(demoBox.width / 2) * 2,
    height: Math.round(demoBox.height / 2) * 2
  };
  const trimStart = (Date.now() - recordingEpoch) / 1000;
  await pause(1400);

  await tap(page, '#demo [data-v4="start"]', timeline, recordingEpoch, { yRatio: 0.18, afterMs: 850 });
  await page.waitForFunction(() => state.running === true && state.modal === null);
  if (scenario === 'fit-not-detected') {
    await pause(4000);
    const fitResult = await page.evaluate(() => ({
      triggered: window.V3ProLeakFlow.trigger('fit-not-detected-20s'),
      stage: state.v3LeakFlow && state.v3LeakFlow.stage,
      mode: state.v3LeakFlow && state.v3LeakFlow.guideMode,
      index: state.v3LeakFlow && state.v3LeakFlow.guideIndex
    }));
    if (!fitResult.triggered || fitResult.stage !== 'guide' || fitResult.mode !== 'fit-not-detected' || fitResult.index !== 2) {
      throw new Error(`Fit-not-detected guide did not open: ${JSON.stringify(fitResult)}`);
    }
    await page.waitForSelector('#demo .sa-guide-layer.is-fit-not-detected [data-sa-action="resume-fit-not-detected"]', { state: 'visible' });
    await pause(1600);
    await tap(page, '#demo .sa-guide-layer.is-fit-not-detected [data-sa-action="resume-fit-not-detected"]', timeline, recordingEpoch, { yRatio: 0.5, afterMs: 850 });
    await page.waitForFunction(() => state.running === true && state.paused === false && state.v3LeakFlow && state.v3LeakFlow.stage === 'idle');
    await pause(10000);
  } else if (scenario === 'minor-leak') {
    await pause(4000);
    const leakResult = await page.evaluate(() => ({
      triggered: window.V3ProLeakFlow.trigger('minor-leak'),
      recorded: state.microLeakDuringSession === true
    }));
    if (!leakResult.triggered || !leakResult.recorded) throw new Error('Minor leak trigger was not recorded');
    await pause(6000);
  } else if (scenario === 'major-leak-resolved' || scenario === 'major-leak-skipped' || scenario === 'major-leak-recheck-failed') {
    await pause(4000);
    const leakResult = await page.evaluate(() => ({
      triggered: window.V3ProLeakFlow.trigger('serious-leak-right'),
      stage: state.v3LeakFlow && state.v3LeakFlow.stage,
      side: state.v3LeakFlow && state.v3LeakFlow.side
    }));
    if (!leakResult.triggered || leakResult.stage !== 'guide' || leakResult.side !== 'right') {
      throw new Error(`Serious leak guide did not open: ${JSON.stringify(leakResult)}`);
    }
    await page.waitForSelector('#demo .sa-guide-layer [data-sa-action="guide-next"]', { state: 'visible' });
    await pause(scenario === 'major-leak-skipped' ? 2600 : 1400);

    if (scenario === 'major-leak-skipped') {
      await tap(page, '#demo .sa-guide-layer [data-sa-action="ignore-for-now"]', timeline, recordingEpoch, { afterMs: 700 });
      await page.waitForSelector('#demo .sa-unresolved-layer [data-sa-action="continue-unresolved"]', { state: 'visible' });
      await pause(2200);

      await tap(page, '#demo .sa-unresolved-layer [data-sa-action="continue-unresolved"]', timeline, recordingEpoch, { yRatio: 0.42, afterMs: 700 });
      await page.waitForSelector('#demo .sa-status-active', { state: 'visible' });
      const continued = await page.evaluate(() => ({
        stage: state.v3LeakFlow && state.v3LeakFlow.stage,
        running: state.running,
        paused: state.paused
      }));
      if (continued.stage !== 'ignored' || !continued.running || continued.paused) {
        throw new Error(`Unresolved leak did not continue correctly: ${JSON.stringify(continued)}`);
      }
      await pause(8000);
    } else {

      await tap(page, '#demo .sa-guide-layer [data-sa-action="guide-next"]', timeline, recordingEpoch, { afterMs: 650 });
      await page.waitForFunction(() => state.v3LeakFlow && state.v3LeakFlow.guideIndex === 1);
      await pause(1200);

      await tap(page, '#demo .sa-guide-layer [data-sa-action="guide-next"]', timeline, recordingEpoch, { afterMs: 650 });
      await page.waitForFunction(() => state.v3LeakFlow && state.v3LeakFlow.guideIndex === 2);
      await pause(1400);

      await tap(page, '#demo .sa-guide-layer [data-sa-action="guide-next"]', timeline, recordingEpoch, { afterMs: 700 });
      await page.waitForSelector('#demo .sa-result-layer [data-sa-action="resume-after-check"]', { state: 'visible' });
      await pause(1400);

      await tap(page, '#demo .sa-result-layer [data-sa-action="resume-after-check"]', timeline, recordingEpoch, { yRatio: 0.42, afterMs: 700 });
      await page.waitForSelector('#demo .sa-status-active', { state: 'visible' });
      const activeCopy = await page.locator('#demo .sa-status-active').innerText();
      if (!activeCopy.includes('Air leak') || !activeCopy.includes('Suction adjusting...')) {
        throw new Error(`Unexpected active leak notification: ${activeCopy}`);
      }
      if (scenario === 'major-leak-resolved') {
        await pause(2200);

        const resolved = await page.evaluate(() => window.V3ProLeakFlow.trigger('suction-normal'));
        if (!resolved) throw new Error('Serious leak did not resolve');
        await page.waitForSelector('#demo .sa-status-resolved', { state: 'visible' });
        await pause(2200);
        await page.waitForSelector('#demo .sa-status-resolved', { state: 'hidden', timeout: 5000 });
        await pause(2500);
      } else {
        await page.waitForSelector('#demo .sa-unresolved-layer [data-sa-action="continue-unresolved"]', {
          state: 'visible',
          timeout: 13000
        });
        const timedOut = await page.evaluate(() => ({
          stage: state.v3LeakFlow && state.v3LeakFlow.stage,
          origin: state.v3LeakFlow && state.v3LeakFlow.confirmOrigin,
          running: state.running,
          paused: state.paused
        }));
        if (timedOut.stage !== 'unresolved_confirm' || timedOut.origin !== 'timeout_after_start' || !timedOut.paused) {
          throw new Error(`Recheck timeout did not open correctly: ${JSON.stringify(timedOut)}`);
        }
        await pause(1500);

        await tap(page, '#demo .sa-unresolved-layer [data-sa-action="continue-unresolved"]', timeline, recordingEpoch, { yRatio: 0.42, afterMs: 700 });
        await page.waitForSelector('#demo .sa-status-active', { state: 'visible' });
        const continued = await page.evaluate(() => ({
          stage: state.v3LeakFlow && state.v3LeakFlow.stage,
          running: state.running,
          paused: state.paused
        }));
        if (continued.stage !== 'ignored' || !continued.running || continued.paused) {
          throw new Error(`Failed recheck did not continue correctly: ${JSON.stringify(continued)}`);
        }
        await pause(6000);
      }
    }
  } else {
    await pause(10000);
  }

  await hold(page, '#demo [data-v4="finish"]', 2300, timeline, recordingEpoch);
  await page.waitForSelector('#demo [data-v4="save"]', { state: 'visible' });
  await pause(900);

  await tap(page, '#demo [data-v4="save"]', timeline, recordingEpoch, { yRatio: 0.18, afterMs: 650 });
  if (scenario === 'minor-leak') {
    await page.waitForSelector('#demo .air2-abnormal-logged [data-air2-logged-done]', { state: 'visible' });
    await pause(1400);
    await tap(page, '#demo [data-air2-wear-guide]', timeline, recordingEpoch, { yRatio: 0.45, afterMs: 650 });
    await page.waitForSelector('#demo [data-sa-log-guide-step="0"]', { state: 'visible' });
    await pause(1200);
    await tap(page, '#demo [data-sa-log-guide="next"]', timeline, recordingEpoch, { afterMs: 550 });
    await page.waitForSelector('#demo [data-sa-log-guide-step="1"]', { state: 'visible' });
    await pause(1100);
    await tap(page, '#demo [data-sa-log-guide="next"]', timeline, recordingEpoch, { afterMs: 550 });
    await page.waitForSelector('#demo [data-sa-log-guide-step="2"]', { state: 'visible' });
    await pause(1400);
    await tap(page, '#demo [data-sa-log-guide-back]', timeline, recordingEpoch, { afterMs: 650 });
    await page.waitForSelector('#demo .air2-abnormal-logged:not(.sa-guide-open) [data-air2-logged-done]', { state: 'visible' });
    await pause(800);
    await tap(page, '#demo [data-air2-logged-done]', timeline, recordingEpoch, { yRatio: 0.35, afterMs: 650 });
    await page.waitForSelector('#demo .v4-home', { state: 'visible', timeout: 5000 });
  } else if (scenario === 'major-leak-resolved' || scenario === 'major-leak-skipped' || scenario === 'major-leak-recheck-failed') {
    await page.waitForSelector('#demo .air2-abnormal-logged [data-air2-logged-done]', { state: 'visible' });
    await pause(scenario === 'major-leak-skipped' ? 2200 : 1400);
    await tap(page, '#demo [data-air2-wear-guide]', timeline, recordingEpoch, { yRatio: 0.45, afterMs: 650 });
    await page.waitForSelector('#demo [data-sa-log-guide-step="0"]', { state: 'visible' });
    await pause(scenario === 'major-leak-skipped' ? 1800 : 1200);
    await tap(page, '#demo [data-sa-log-guide="next"]', timeline, recordingEpoch, { afterMs: 550 });
    await page.waitForSelector('#demo [data-sa-log-guide-step="1"]', { state: 'visible' });
    await pause(scenario === 'major-leak-skipped' ? 1800 : 1100);
    await tap(page, '#demo [data-sa-log-guide="next"]', timeline, recordingEpoch, { afterMs: 550 });
    await page.waitForSelector('#demo [data-sa-log-guide-step="2"]', { state: 'visible' });
    await pause(scenario === 'major-leak-skipped' ? 2000 : 1400);
    await tap(page, '#demo [data-sa-log-guide-back]', timeline, recordingEpoch, { afterMs: 650 });
    await page.waitForSelector('#demo .air2-abnormal-logged:not(.sa-guide-open) [data-air2-logged-done]', { state: 'visible' });
    await pause(800);
    await tap(page, '#demo [data-air2-logged-done]', timeline, recordingEpoch, { yRatio: 0.35, afterMs: 650 });
    await page.waitForSelector('#demo .v4-home', { state: 'visible', timeout: 5000 });
  } else {
    await page.waitForSelector('#demo .v4-logged', { state: 'visible' });
    await page.waitForSelector('#demo .v4-home', { state: 'visible', timeout: 7000 });
  }
  const finalState = await page.evaluate(() => ({
    page: state.page,
    hasHome: !!document.querySelector('#demo .v4-home'),
    triggerVisible: !!document.querySelector('.demo-trigger-root') && getComputedStyle(document.querySelector('.demo-trigger-root')).visibility !== 'hidden'
  }));
  if (!finalState.hasHome || finalState.triggerVisible) {
    throw new Error(`Recording did not finish cleanly on sub-home: ${JSON.stringify(finalState)}`);
  }
  await pause(1800);

  await context.close();
  await browser.close();

  const webmPath = await video.path();
  const finalWebm = path.join(outputDir, `${outputName}-browser-raw.webm`);
  const finalMp4 = path.join(outputDir, `${outputName}.mp4`);
  fs.copyFileSync(webmPath, finalWebm);
  const probe = spawnSync(ffmpegPath, ['-i', finalWebm], { encoding: 'utf8' });
  const durationMatch = String(probe.stderr).match(/Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!durationMatch) throw new Error('Unable to read raw recording duration');
  const rawDuration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
  const finalDuration = Math.max(0.1, rawDuration - trimStart);

  const overlays = timeline.map((mark) => overlayExpression(mark, crop.x, trimStart));
  const filterParts = [
    `[0:v]trim=start=${trimStart.toFixed(3)},setpts=PTS-STARTPTS,crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}[base]`,
    `[1:v]format=rgba[hand]`,
    `[hand]split=${overlays.length}${overlays.map((_, index) => `[h${index}]`).join('')}`
  ];
  let current = 'base';
  overlays.forEach((item, index) => {
    const next = index === overlays.length - 1 ? 'composited' : `v${index}`;
    filterParts.push(`[${current}][h${index}]overlay=x='${item.x}':y='${item.y}':enable='${item.enable}'[${next}]`);
    current = next;
  });
  filterParts.push(`[${current}]format=yuv420p[out]`);

  const encode = spawnSync(ffmpegPath, [
    '-y', '-i', finalWebm,
    '-loop', '1', '-framerate', '25', '-i', handPngPath,
    '-filter_complex', filterParts.join(';'), '-map', '[out]', '-shortest',
    '-t', finalDuration.toFixed(3),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
    '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    '-an', finalMp4
  ], { stdio: 'inherit' });
  if (encode.status !== 0) throw new Error(`ffmpeg exited with ${encode.status}`);

  const result = {
    sourceUrl,
    scenario,
    rawBrowserRecording: finalWebm,
    mp4: finalMp4,
    viewport: captureViewport,
    crop,
    handWidth,
    browser: 'Google Chrome',
    chromeExecutable,
    validatedLayout,
    duration: finalDuration,
    timeline: timeline.map((item) => ({ ...item, x: item.x - crop.x, start: item.start - trimStart, down: item.down - trimStart, up: item.up - trimStart, end: item.end - trimStart })),
    bytes: fs.statSync(finalMp4).size
  };
  fs.writeFileSync(path.join(outputDir, `${outputName}.json`), JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
