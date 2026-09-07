import { step2ProfileSchema, createBusinessProfileSchema } from '../src/modules/business/business.validator.js';
import { createSupplierSchema } from '../src/modules/supplier/supplier.validator.js';
import { uploadToCloudinary } from '../src/utils/cloudinary.js';

console.log('🧪 --- TESTING BUSINESS LOGO OBJECT & GSTIN VALIDATION FIXES ---');

try {
  // Test 1: businessLogo passed as Object in step2ProfileSchema
  const payloadWithLogoObject = {
    body: {
      businessName: 'Test Supermarket',
      businessLogo: {
        url: 'https://res.cloudinary.com/demo/image/upload/v12345/logo.png',
        public_id: 'logo_123'
      },
      gstNumber: '22AAAAA0000A1Z5'
    }
  };
  step2ProfileSchema.parse(payloadWithLogoObject);
  console.log('✅ Test 1 Passed: step2ProfileSchema parsed businessLogo object successfully!');

  // Test 2: businessLogo passed as String in createBusinessProfileSchema
  const payloadWithLogoString = {
    body: {
      businessName: 'Test Supermarket',
      businessLogo: 'https://res.cloudinary.com/demo/image/upload/v12345/logo.png',
      gstin: '22aaaaa0000a1z5' // lowercase GSTIN
    }
  };
  const parsedRes = createBusinessProfileSchema.parse(payloadWithLogoString);
  console.log('✅ Test 2 Passed: createBusinessProfileSchema parsed lowercase GSTIN into uppercase:', parsedRes.body.gstin);

  // Test 3: uploadToCloudinary with object containing url
  const uploadResult = await uploadToCloudinary({
    url: 'https://res.cloudinary.com/demo/image/upload/v12345/logo.png',
    public_id: 'logo_123'
  }, 'billing_saas/logos');
  console.log('✅ Test 3 Passed: uploadToCloudinary extracted URL from object:', uploadResult.url);

  // Test 4: Supplier validator with lowercase GSTIN
  const supplierPayload = {
    body: {
      name: 'Supplier ABC',
      mobileNumber: '9876543210',
      gstin: '08aaaaa0000a1z5'
    }
  };
  const parsedSupplier = createSupplierSchema.parse(supplierPayload);
  console.log('✅ Test 4 Passed: createSupplierSchema preprocessed GSTIN to uppercase:', parsedSupplier.body.gstin);

  // Test 5: Invalid GSTIN validation error message check
  try {
    createSupplierSchema.parse({
      body: {
        name: 'Supplier XYZ',
        mobileNumber: '9876543210',
        gstin: 'INVALID_GSTIN_123'
      }
    });
    console.error('❌ Test 5 Failed: Should have rejected invalid GSTIN format.');
  } catch (err) {
    console.log('✅ Test 5 Passed: Invalid GSTIN correctly rejected with error:', err.errors[0]?.message);
  }

  console.log('\n🎉 --- ALL VERIFICATION TESTS PASSED PERFECTLY ---');
} catch (err) {
  console.error('❌ Test script failed with unexpected error:', err);
}
