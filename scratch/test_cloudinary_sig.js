import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testSignature() {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = 'billing_saas/products';
  
  // Signature format: folder=billing_saas/products&timestamp=1234567890<API_SECRET>
  const strToSign = `folder=${folder}&timestamp=${timestamp}${process.env.CLOUDINARY_API_SECRET}`;
  const signature = crypto.createHash('sha1').update(strToSign).digest('hex');

  console.log('Timestamp:', timestamp);
  console.log('Signature:', signature);

  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  try {
    const res = await cloudinary.uploader.upload(sampleBase64, {
      folder,
      timestamp,
      signature,
      api_key: process.env.CLOUDINARY_API_KEY
    });
    console.log('Upload result:', res);
  } catch (err) {
    console.error('Manual signature upload error:', err);
  }
}

testSignature();
