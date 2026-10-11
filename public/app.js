'use strict';

const { Renderer, Stave, StaveNote, Voice, Formatter, Accidental, Dot } = Vex.Flow;

const els = {
  score: document.getElementById('score'),
  newBtn: document.getElementById('newBtn'),
  playBtn: document.getElementById('playBtn'),
  stopBtn: document.getElementById('stopBtn'),
  metronome: document.getElementById('metronome'),
  status: document.getElementById('status'),
};

const inputs = ['clef', 'key', 'mode', 'ts', 'measures', 'difficulty', 'tempo', 'rests']
  .reduce((acc, id) => { acc[id] = document.getElementById(id); return acc; }, {});

let exercise = null;
let audioCtx = null;
let playback = null;

function readConfig() {
  return {
    clef: inputs.clef.value,
    key: inputs.key.value,
    mode: inputs.mode.value,
    timeSignature: inputs.ts.value,
    measures: parseInt(inputs.measures.value, 10),
    difficulty: parseInt(inputs.difficulty.value, 10),
    tempo: parseInt(inputs.tempo.value, 10),
    restProbability: parseInt(inputs.rests.value, 10) / 100,
  };
}

async function newExercise() {
  els.status.textContent = 'Generating…';
  try {
    const res = await fetch('/api/exercise', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(readConfig()),
    });
    if (!res.ok) throw new Error((await res.json()).error || res.statusText);
    exercise = await res.json();
    render(exercise);
    els.playBtn.disabled = false;
    els.status.textContent = '';
  } catch (e) {
    els.status.textContent = 'Error: ' + e.message;
  }
}

function render(ex) {
  els.score.innerHTML = '';
  const width = 1100;
  const measuresPerLine = 4;
  const lines = Math.ceil(ex.config.measures / measuresPerLine);
  const renderer = new Renderer(els.score, Renderer.Backends.SVG);
  renderer.resize(width, 160 * lines + 40);
  const context = renderer.getContext();

  const measures = ex.measures;
  let m = 0;
  for (let line = 0; line < lines; line++) {
    const y = line * 160;
    for (let col = 0; col < measuresPerLine && m < measures.length; col++, m++) {
      const x = 10 + col * ((width - 20) / measuresPerLine);
      const staveW = (width - 20) / measuresPerLine - 8;
      const stave = new Stave(x, y, staveW);
      if (col === 0) {
        stave.addClef(ex.config.clef);
        if (line === 0) stave.addTimeSignature(ex.config.timeSignature);
      }
      if (line === 0 && col === 0) stave.addKeySignature(ex.config.key + (ex.config.mode === 'minor' ? 'm' : ''));
      const notes = measures[m].map((ev) => {
        let struct;
        if (ev.rest) {
          struct = new StaveNote({ keys: [restKey(ex.config.clef)], duration: ev.duration + 'r', dots: ev.dots });
        } else {
          struct = new StaveNote({ keys: [ev.key], duration: ev.duration, clef: ex.config.clef, dots: ev.dots });
        }
        if (ev.dots) Dot.buildAndAttach([struct], { all: true });
        return struct;
      });
      stave.setContext(context).draw();
      const voice = new Voice({ num_beats: beats(ex.config.timeSignature), beat_value: beatValue(ex.config.timeSignature) })
        .setMode(Voice.Mode.STRICT).addTickables(notes);
      new Formatter().joinVoices([voice]).format([voice], staveW - 70);
      voice.draw(context, stave);
    }
  }
}

function restKey(clef) {
  return clef === 'bass' ? 'd/3' : 'b/4';
}

function beats(ts) { return parseInt(ts.split('/')[0], 10); }
function beatValue(ts) { return parseInt(ts.split('/')[1], 10); }

function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playNote(ctx, midi, start, dur) {
  const freq = 440 * Math.pow(2, (midi - 69) / 12);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + Math.max(0.05, dur * 0.9));
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + Math.max(0.1, dur));
}

function playTick(ctx, start, accent) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.value = accent ? 1600 : 1000;
  gain.gain.setValueAtTime(0.15, start);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + 0.06);
}

function play() {
  if (!exercise) return;
  stop();
  const ctx = ensureAudio();
  const secPerBeat = 60 / exercise.config.tempo;
  const beatVal = beatValue(exercise.config.timeSignature);
  const measureBeats = beats(exercise.config.timeSignature) * (4 / beatVal);
  const t0 = ctx.currentTime + 0.15;
  const events = [];
  exercise.measures.forEach((measure, mi) => {
    let cursor = 0;
    measure.forEach((ev) => {
      const start = t0 + (mi * measureBeats + cursor) * secPerBeat;
      if (!ev.rest) events.push({ midi: ev.midi, start, dur: ev.beats * secPerBeat });
      cursor += ev.beats;
    });
    if (els.metronome.checked) {
      for (let b = 0; b < beats(exercise.config.timeSignature); b++) {
        events.push({ tick: true, start: t0 + (mi * measureBeats + b * (4 / beatVal)) * secPerBeat, accent: b === 0 });
      }
    }
  });
  const totalBeats = exercise.measures.length * measureBeats;
  playback = {
    events,
    timers: [],
    endTime: t0 + totalBeats * secPerBeat,
    finished: null,
  };
  events.forEach((ev) => {
    const delay = Math.max(0, (ev.start - ctx.currentTime) * 1000);
    const id = setTimeout(() => {
      if (ev.tick) playTick(ctx, ctx.currentTime, ev.accent);
      else playNote(ctx, ev.midi, ctx.currentTime, ev.dur);
    }, delay);
    playback.timers.push(id);
  });
  playback.timers.push(setTimeout(() => {
    stop();
    els.status.textContent = '';
  }, (playback.endTime - ctx.currentTime) * 1000));
  els.playBtn.disabled = true;
  els.stopBtn.disabled = false;
  els.status.textContent = 'Playing…';
}

function stop() {
  if (playback) {
    playback.timers.forEach(clearTimeout);
    playback = null;
  }
  els.playBtn.disabled = !exercise;
  els.stopBtn.disabled = true;
  els.status.textContent = '';
}

els.newBtn.addEventListener('click', newExercise);
els.playBtn.addEventListener('click', play);
els.stopBtn.addEventListener('click', stop);
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
    e.preventDefault();
    if (playback) stop(); else play();
  }
});

newExercise();
