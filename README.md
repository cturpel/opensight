# Sightreader

A self-hosted sight-reading practice app. Generates randomized sheet-music exercises,
renders them with [VexFlow](https://vexflow.com), and plays them back with a built-in Web Audio synthesizer.

## Features

- Random exercise generation: clef (treble/bass), key (9 major keys + parallel minors), time signature (4/4, 3/4, 2/4, 6/8), 1–32 measures, difficulty 1–6
- Rhythm difficulty scales with level (whole notes → 16ths, dotted figures)
- Melodies are constrained to the selected key/scale and the clef's practical range
- Configurable tempo, rest density, and accidental-free diatonic writing (accidentals come from the key signature)
- Playback with a built-in synth, optional metronome, and a count-in option via the `Start` button
- Spacebar toggles play/stop

## Run

```bash
docker build -t sightreader .
docker run --rm -p 3000:3000 sightreader
```

Then open http://localhost:3000

## Develop without Docker

```bash
npm install
npm start
```

## API

- `GET /api/health` — health check
- `POST /api/exercise` — body: `{ clef, key, mode, timeSignature, measures, difficulty, tempo, restProbability }` → exercise JSON
