import 'dotenv/config';
import { uploadToCloudinary, extractPublicIdFromUrl } from '../src/utils/cloudinary.js';

async function testUpload() {
  console.log('--- Testing Cloudinary Image Upload Formats ---');
  console.log('Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME);
  
  const sampleBuffer = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  const mockMulterFile = {
    fieldname: 'productImage',
    originalname: 'test_product.png',
    encoding: '7bit',
    mimetype: 'image/png',
    buffer: sampleBuffer,
    size: sampleBuffer.length
  };

  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  console.log('\n1. Testing Multer file object (req.file)...');
  try {
    const res1 = await uploadToCloudinary(mockMulterFile, 'billing_saas/products');
    console.log('✅ Multer file result:', res1);
  } catch (err) {
    console.error('❌ Multer file upload failed:', err.message);
  }

  console.log('\n2. Testing Buffer directly...');
  try {
    const res2 = await uploadToCloudinary(sampleBuffer, 'billing_saas/products');
    console.log('✅ Buffer result:', res2);
  } catch (err) {
    console.error('❌ Buffer upload failed:', err.message);
  }

  console.log('\n3. Testing Base64 Data URI string...');
  try {
    const res3 = await uploadToCloudinary(sampleBase64, 'billing_saas/products');
    console.log('✅ Base64 result:', res3);
  } catch (err) {
    console.error('❌ Base64 upload failed:', err.message);
  }
}

testUpload();
