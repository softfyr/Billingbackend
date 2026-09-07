import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

async function testCloudinaryUpload() {
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  console.log('--- Test 1: upload with folder "billing_saas/products" ---');
  try {
    const res1 = await cloudinary.uploader.upload(sampleBase64, { folder: 'billing_saas/products' });
    console.log('Success 1:', res1);
  } catch (err) {
    console.error('Error 1:', err);
  }

  console.log('\n--- Test 2: upload without folder ---');
  try {
    const res2 = await cloudinary.uploader.upload(sampleBase64);
    console.log('Success 2:', res2);
  } catch (err) {
    console.error('Error 2:', err);
  }
}

testCloudinaryUpload();
