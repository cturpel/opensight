const express = require('express');
const path = require('path');
const { generateExercise } = require('./lib/generator');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.post('/api/exercise', (req, res) => {
  try {
    const opts = req.body || {};
    const exercise = generateExercise(opts);
    res.json(exercise);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'internal error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`sightreader listening on ${PORT}`);
});
