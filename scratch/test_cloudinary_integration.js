import { uploadToCloudinary, extractPublicIdFromUrl, deleteFromCloudinary } from '../src/utils/cloudinary.js';

async function runTests() {
  console.log('--- Testing Cloudinary Utility Integration ---');

  // Test 1: extractPublicIdFromUrl
  const testUrl = 'https://res.cloudinary.com/demo/image/upload/v1612345678/billing_saas/logos/sample_logo.png';
  const publicId = extractPublicIdFromUrl(testUrl);
  console.log('Extracted public_id:', publicId);
  if (publicId !== 'billing_saas/logos/sample_logo') {
    throw new Error(`Failed public_id extraction test. Expected "billing_saas/logos/sample_logo", got "${publicId}"`);
  }

  // Test 2: uploadToCloudinary with base64 sample / dummy fallback
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const uploadResult = await uploadToCloudinary(sampleBase64, 'billing_saas/test');
  console.log('Upload result:', uploadResult);

  if (!uploadResult.url) {
    throw new Error('Upload result missing URL.');
  }

  console.log('✅ All Cloudinary integration tests PASSED successfully!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
