const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

app.post('/merge', async (req, res) => {
  const { urls } = req.body;
  const tmpDir = '/tmp/merge_' + Date.now();
  fs.mkdirSync(tmpDir);

  try {
    // Download all files
    const files = [];
    for (let i = 0; i < urls.length; i++) {
      const filePath = path.join(tmpDir, `${i}.mp3`);
      const response = await fetch(urls[i]);
      const buffer = await response.buffer();
      fs.writeFileSync(filePath, buffer);
      files.push(filePath);
    }

    // Write concat list file
    const listPath = path.join(tmpDir, 'list.txt');
    const listContent = files.map(f => `file '${f}'`).join('\n');
    fs.writeFileSync(listPath, listContent);

    // Merge using concat demuxer
    const outputPath = path.join(tmpDir, 'merged.mp3');
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename=merged.mp3');
    fs.createReadStream(outputPath).pipe(res);

  } catch (err) {
    console.error('Merge error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log('MP3 merger running on port ' + (process.env.PORT || 3000));
});
