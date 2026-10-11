'use strict';

const MAJOR_KEYS = {
  C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, 'F#': 6, 'C#': 7,
  F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6,
};
const MINOR_KEYS = {
  A: 0, E: 1, B: 2, 'F#': 3, 'C#': 4, 'G#': 5, 'D#': 6, 'D': -1, G: -2, C: -3, F: -4, Bb: -5, Eb: -6,
};

const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10];

const CLEF_RANGES = {
  treble: { low: 'c/4', high: 'g/5' },
  bass: { low: 'e/2', high: 'c/4' },
};

function keySignatureSpec(tonic, mode) {
  const table = mode === 'minor' ? MINOR_KEYS : MAJOR_KEYS;
  const count = table[tonic];
  if (count === undefined) throw new Error(`unknown key: ${tonic} ${mode}`);
  if (count >= 0) {
    return { accidentals: count, spec: SHARP_ORDER.slice(0, count).map((n) => `${n}/#`) };
  }
  return { accidentals: count, spec: FLAT_ORDER.slice(0, -count).map((n) => `${n}/b`) };
}

const BASE_SEMIS = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const LETTER_INDEX = { c: 0, d: 1, e: 2, f: 3, g: 4, a: 5, b: 6 };

function parseNote(note) {
  const [letter, octave] = note.split('/');
  return { letter, octave: parseInt(octave, 10) };
}

function noteToMidi(note) {
  const { letter, octave } = parseNote(note);
  return (octave + 1) * 12 + BASE_SEMIS[letter];
}

function scaleNotes(tonic, mode, low, high) {
  const steps = mode === 'minor' ? MINOR_STEPS : MAJOR_STEPS;
  const letters = Object.keys(LETTER_INDEX);
  const tonicLetter = tonic[0].toLowerCase();
  const tonicDeg = LETTER_INDEX[tonicLetter];
  const tonicMidi = noteToMidi(`${tonicLetter}/4`) + stepsOffset(tonic, tonicLetter);
  const lowMidi = noteToMidi(low);
  const highMidi = noteToMidi(high);
  const notes = [];
  for (let oct = 3; oct <= 5; oct++) {
    for (let deg = 0; deg < 7; deg++) {
      const midi = tonicMidi + (oct - 4) * 12 + steps[deg];
      const letter = letters[(tonicDeg + deg) % 7];
      const key = `${letter}/${oct + Math.floor((tonicDeg + deg) / 7)}`;
      if (midi >= lowMidi && midi <= highMidi) {
        notes.push({ key, midi, degree: deg });
      }
    }
  }
  notes.sort((a, b) => a.midi - b.midi);
  return notes;
}

function mod(n, m) { return ((n % m) + m) % m; }

function stepsOffset(tonic, letter) {
  let semi = BASE_SEMIS[letter];
  if (tonic.endsWith('#')) semi += 1;
  if (tonic.endsWith('b')) semi -= 1;
  return semi;
}

const DIFFICULTY_RHYTHMS = {
  1: [['q', 'q', 'q', 'q'], ['h', 'h'], ['q', 'h'], ['h', 'q']],
  2: [['q', 'q', 'h'], ['h', 'q', 'q'], ['w'], ['q', 'h', 'q'], ['hd', 'q'], ['q', 'hd']],
  3: [['q', 'q', 'e', 'e', 'q'], ['e', 'e', 'q', 'q', 'q'], ['q', 'e', 'e', 'q', 'q'], ['e', 'e', 'h'], ['h', 'e', 'e'], ['q', 'q', 'q', 'q']],
  4: [['q', 'q', 'e', 'e', 'e', 'e'], ['e', 'e', 'e', 'e', 'h'], ['qd', 'e', 'q', 'q'], ['q', 'qd', 'e', 'q'], ['e', 'e', 'qd', 'e'], ['q', 'q', 'qd', 'e']],
  5: [['q', 'e', 'e', 'e', 'e', 'e', 'e'], ['e', 'e', 'e', 'e', 'q', 'q'], ['s', 's', 's', 's', 'q', 'h'], ['q', 's', 's', 'e', 'e', 'q'], ['e', 's', 's', 'e', 'e', 'e', 'e'], ['qd', 'e', 's', 's', 'e', 'e']],
  6: [['s', 's', 'e', 'e', 's', 's', 'e', 'e'], ['e', 's', 's', 'e', 'qd', 'e'], ['s', 's', 's', 's', 'e', 'e', 'e', 'e'], ['q', 'e', 's', 's', 'e', 'e', 'e', 'e'], ['h', 's', 's', 'e', 'e'], ['s', 's', 'q', 's', 's', 'q']],
};

const DURATION_MAP = {
  w: { beats: 4, type: 'w' },
  h: { beats: 2, type: 'h' },
  hd: { beats: 3, type: 'h', dots: 1 },
  q: { beats: 1, type: 'q' },
  qd: { beats: 1.5, type: 'q', dots: 1 },
  e: { beats: 0.5, type: '8' },
  s: { beats: 0.25, type: '16' },
};

function beatsPerMeasure(ts) {
  const [n, d] = ts.split('/').map(Number);
  return n * (4 / d);
}

function fitRhythm(pattern, beats) {
  return pattern.reduce((s, c) => s + DURATION_MAP[c].beats, 0) === beats;
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function defaultConfig(user) {
  const cfg = {
    clef: user.clef || 'treble',
    key: user.key || 'C',
    mode: user.mode || 'major',
    timeSignature: user.timeSignature || '4/4',
    measures: clamp(parseInt(user.measures, 10) || 8, 1, 32),
    difficulty: clamp(parseInt(user.difficulty, 10) || 2, 1, 6),
    tempo: clamp(parseInt(user.tempo, 10) || 90, 40, 240),
    restProbability: clamp(user.restProbability == null ? 0.1 : user.restProbability, 0, 0.5),
    title: user.title || 'Sight-Reading Exercise',
  };
  if (!MAJOR_KEYS[cfg.key] === undefined && !(cfg.key in (cfg.mode === 'minor' ? MINOR_KEYS : MAJOR_KEYS))) {
    throw new Error(`unsupported key: ${cfg.key}`);
  }
  if (!CLEF_RANGES[cfg.clef]) throw new Error(`unsupported clef: ${cfg.clef}`);
  if (!DIFFICULTY_RHYTHMS[cfg.difficulty]) throw new Error('difficulty must be 1-6');
  if (!beatsPerMeasure(cfg.timeSignature)) throw new Error(`unsupported time signature: ${cfg.timeSignature}`);
  return cfg;
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function generateExercise(userOpts) {
  const cfg = defaultConfig(userOpts || {});
  const { accidentals, spec } = keySignatureSpec(cfg.key, cfg.mode);
  const range = CLEF_RANGES[cfg.clef];
  const notes = scaleNotes(cfg.key, cfg.mode, range.low, range.high);
  if (notes.length < 5) throw new Error('range too small');

  const beats = beatsPerMeasure(cfg.timeSignature);
  const pool = [];
  for (let d = 1; d <= cfg.difficulty; d++) {
    pool.push(...DIFFICULTY_RHYTHMS[d]);
  }
  const usable = pool.filter((p) => fitRhythm(p, beats));
  const rhythmSource = usable.length ? usable : [['q']];

  const maxLeap = 1 + cfg.difficulty;
  let idx = Math.floor(notes.length / 3) + Math.floor(Math.random() * Math.max(1, notes.length / 3));
  idx = clamp(idx, 0, notes.length - 1);

  const measures = [];
  for (let m = 0; m < cfg.measures; m++) {
    let pattern = pick(rhythmSource);
    if (!fitRhythm(pattern, beats)) pattern = fillBeats(beats);
    const events = [];
    for (const code of pattern) {
      const d = DURATION_MAP[code];
      const isRest = Math.random() < cfg.restProbability;
      if (isRest) {
        events.push({ duration: d.type, dots: d.dots || 0, beats: d.beats, rest: true });
      } else {
        let step = 0;
        if (Math.random() < 0.7) {
          step = pick([-1, -1, 0, 1, 1, -2, 2, -3, 3].filter((s) => Math.abs(s) <= maxLeap));
        }
        idx = clamp(idx + step, 0, notes.length - 1);
        const n = notes[idx];
        events.push({
          duration: d.type, dots: d.dots || 0, beats: d.beats, rest: false,
          key: n.key, midi: n.midi,
        });
      }
    }
    measures.push(events);
  }

  return {
    config: cfg,
    keySignature: { accidentals, spec },
    measures,
  };
}

function fillBeats(beats) {
  const out = [];
  let left = beats;
  while (left >= 1) { out.push('q'); left -= 1; }
  while (left >= 0.5) { out.push('e'); left -= 0.5; }
  while (left >= 0.25) { out.push('s'); left -= 0.25; }
  return out;
}

module.exports = { generateExercise, keySignatureSpec, scaleNotes, beatsPerMeasure };
