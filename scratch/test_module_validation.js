import { sendOTPSchema, verifyOTPSchema, adminLoginSchema } from '../src/modules/auth/auth.validator.js';
import { choosePackageSchema } from '../src/modules/subscription/subscription.validator.js';
import { createTaxSchema } from '../src/modules/business/business.validator.js';

function runValidationUnitTests() {
  console.log('🧪 --- STARTING MODULE VALIDATION UNIT TESTS ---');

  let passed = 0;
  let failed = 0;

  function testSchema(name, schema, input, shouldPass) {
    try {
      const result = schema.parse(input);
      if (shouldPass) {
        console.log(`✅ [PASS] ${name}`);
        passed++;
      } else {
        console.error(`❌ [FAIL] ${name} (Expected to fail validation but passed)`);
        failed++;
      }
    } catch (err) {
      if (!shouldPass) {
        console.log(`✅ [PASS] ${name} (Correctly rejected invalid input: ${err.errors?.[0]?.message || err.message})`);
        passed++;
      } else {
        console.error(`❌ [FAIL] ${name} (Expected to pass but failed: ${err.message})`);
        failed++;
      }
    }
  }

  // Auth Validation Tests
  testSchema('Send OTP (Valid 10-digit mobile)', sendOTPSchema, { body: { mobileNumber: '9876543210' } }, true);
  testSchema('Send OTP (Invalid mobile - 5 digits)', sendOTPSchema, { body: { mobileNumber: '12345' } }, false);
  testSchema('Verify OTP (Valid code)', verifyOTPSchema, { body: { mobileNumber: '9876543210', otpCode: '123456' } }, true);
  testSchema('Verify OTP (Invalid code - 3 digits)', verifyOTPSchema, { body: { mobileNumber: '9876543210', otpCode: '123' } }, false);
  testSchema('Admin Login (Valid email & password)', adminLoginSchema, { body: { email: 'admin@softfyr.com', password: 'password123' } }, true);
  testSchema('Admin Login (Invalid email format)', adminLoginSchema, { body: { email: 'invalid-email', password: 'password123' } }, false);

  // Subscription Validation Tests
  testSchema('Choose Package (Valid Package ID)', choosePackageSchema, { body: { packageId: 'pkg-1234' } }, true);
  testSchema('Choose Package (Missing Package ID)', choosePackageSchema, { body: { packageId: '' } }, false);

  // Business Validation Tests
  testSchema('Create Tax (Valid percentage number)', createTaxSchema, { body: { name: 'GST 18%', percentage: 18 } }, true);
  testSchema('Create Tax (Missing name)', createTaxSchema, { body: { percentage: 18 } }, false);

  console.log(`\n📊 SUMMARY: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runValidationUnitTests();
