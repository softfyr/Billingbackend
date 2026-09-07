import 'dotenv/config';
import { v2 as cloudinary } from 'cloudinary';
import https from 'https';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Download a real sample image and try uploading to Cloudinary
async function testRealImageUpload() {
  const imageUrl = 'https://picsum.photos/200/300';
  console.log('Testing upload of real image URL to Cloudinary...');
  
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: 'billing_saas/products'
    });
    console.log('✅ Cloudinary Upload SUCCESS:', result);
  } catch (err) {
    console.error('❌ Real Image Upload Error:', err);
  }
}

testRealImageUpload();
