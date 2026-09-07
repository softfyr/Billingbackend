import express from 'express';
import { uploadSingleImage } from '../src/middlewares/upload.middleware.js';

const app = express();
app.post('/test', uploadSingleImage('productImage'), (req, res) => {
  res.json({ success: true, file: !!req.file, bodyKeys: Object.keys(req.body) });
});

// Error handling middleware
app.use((err, req, res, next) => {
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message
  });
});

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`Server listening on port ${port}`);

  async function testSize(sizeMb) {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const largeFieldString = 'a'.repeat(sizeMb * 1024 * 1024); // Size in MB

    const bodyParts = [
      `--${boundary}\r\nContent-Disposition: form-data; name="productImage"\r\n\r\n${largeFieldString}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="name"\r\n\r\nTest Product\r\n`,
      `--${boundary}--\r\n`
    ];
    const body = bodyParts.join('');

    const response = await fetch(`http://localhost:${port}/test`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body
    });

    const json = await response.json();
    console.log(`Size ${sizeMb}MB -> Status Code: ${response.status}`, json);
  }

  try {
    console.log('Testing 1MB...');
    await testSize(1);
    console.log('Testing 2MB...');
    await testSize(2);
    console.log('Testing 12MB...');
    await testSize(12);
  } catch (err) {
    console.error('Fetch error:', err);
  } finally {
    server.close();
  }
});
