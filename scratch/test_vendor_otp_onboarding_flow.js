import { prisma } from '../src/config/prisma.js';
import * as authService from '../src/modules/auth/auth.service.js';
import * as subscriptionService from '../src/modules/subscription/subscription.service.js';
import * as businessService from '../src/modules/business/business.service.js';

async function runVendorOTPOnboardingTests() {
  console.log('🧪 --- STARTING VENDOR OTP LOGIN & ONBOARDING WORKFLOW TESTS ---');

  const existingVendorPhone = '9876543210';
  const newVendorPhone = '8888888888';

  try {
    // 1. Cleanup Test Accounts
    console.log('\n🧹 Cleaning up test accounts...');
    await prisma.user.deleteMany({ where: { mobileNumber: { in: [existingVendorPhone, newVendorPhone] } } });
    await prisma.tenant.deleteMany({ where: { mobileNumber: { in: [existingVendorPhone, newVendorPhone] } } });
    await prisma.oTPVerification.deleteMany({ where: { mobileNumber: { in: [existingVendorPhone, newVendorPhone] } } });

    // Seed a package if needed
    let pkg = await prisma.package.findFirst({ where: { status: 'ACTIVE' } });
    if (!pkg) {
      pkg = await prisma.package.create({
        data: {
          packageName: 'Silver Plan',
          description: 'Standard Silver Plan',
          durationMonths: 1,
          amount: 499,
          isFreeTrial: false,
          status: 'ACTIVE'
        }
      });
    }

    // 2. Setup Existing Vendor
    console.log('\n👤 Setting up Existing Vendor (Fully Onboarded)...');
    const existingTenant = await prisma.tenant.create({
      data: {
        businessName: 'Existing Super Store',
        ownerName: 'Existing Owner',
        mobileNumber: existingVendorPhone,
        currentPackageId: pkg.id,
        subscriptionStatus: 'UPGRADED',
        accountStatus: 'ACTIVE',
        subscriptionStartDate: new Date(),
        subscriptionExpiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isProfileComplete: true
      }
    });
    await prisma.user.create({
      data: {
        name: 'Existing Owner',
        mobileNumber: existingVendorPhone,
        passwordHash: 'hashed_pwd',
        role: 'TENANT_ADMIN',
        status: 'ACTIVE',
        tenantId: existingTenant.id
      }
    });

    // TEST CASE A: Existing Vendor Login
    console.log('\n--- TEST CASE A: EXISTING VENDOR LOGIN ---');
    const sendOtpExistingRes = await authService.sendLoginOTP({ mobileNumber: existingVendorPhone });
    console.log('✅ Send OTP Response (Existing):', {
      isExistingUser: sendOtpExistingRes.isExistingUser,
      role: sendOtpExistingRes.role
    });

    if (!sendOtpExistingRes.isExistingUser) {
      throw new Error('FAILED: Existing vendor should be identified as isExistingUser: true');
    }

    const verifyOtpExistingRes = await authService.verifyLoginOTP({
      mobileNumber: existingVendorPhone,
      otpCode: sendOtpExistingRes.otpCode
    });
    console.log('✅ Verify OTP Response (Existing Vendor):', {
      isExistingUser: verifyOtpExistingRes.isExistingUser,
      hasSelectedPackage: verifyOtpExistingRes.hasSelectedPackage,
      isProfileComplete: verifyOtpExistingRes.isProfileComplete,
      redirectUrl: verifyOtpExistingRes.redirectUrl
    });

    if (verifyOtpExistingRes.redirectUrl !== '/vendor/dashboard') {
      throw new Error(`FAILED: Existing vendor redirectUrl should be '/vendor/dashboard', got '${verifyOtpExistingRes.redirectUrl}'`);
    }

    // TEST CASE B: New Vendor OTP Login -> Package Choose -> Business Profile -> Dashboard Access
    console.log('\n--- TEST CASE B: NEW VENDOR FULL ONBOARDING FLOW ---');

    // Step 1: Send OTP to new mobile
    console.log('Step 1: Requesting OTP for new mobile number...');
    const sendOtpNewRes = await authService.sendLoginOTP({ mobileNumber: newVendorPhone });
    console.log('✅ Send OTP Response (New):', {
      isExistingUser: sendOtpNewRes.isExistingUser,
      mobileNumber: sendOtpNewRes.mobileNumber
    });
    if (sendOtpNewRes.isExistingUser) {
      throw new Error('FAILED: New vendor should return isExistingUser: false');
    }

    // Step 2: Verify OTP
    console.log('Step 2: Verifying OTP for new vendor...');
    const verifyOtpNewRes = await authService.verifyLoginOTP({
      mobileNumber: newVendorPhone,
      otpCode: sendOtpNewRes.otpCode
    });
    console.log('✅ Verify OTP Response (New Vendor):', {
      isExistingUser: verifyOtpNewRes.isExistingUser,
      hasSelectedPackage: verifyOtpNewRes.hasSelectedPackage,
      isProfileComplete: verifyOtpNewRes.isProfileComplete,
      redirectUrl: verifyOtpNewRes.redirectUrl,
      tenantId: verifyOtpNewRes.tenant.id
    });

    if (verifyOtpNewRes.redirectUrl !== '/choose-package') {
      throw new Error(`FAILED: New vendor redirectUrl should be '/choose-package', got '${verifyOtpNewRes.redirectUrl}'`);
    }

    const newTenantId = verifyOtpNewRes.tenant.id;

    // Step 3: Choose Package
    console.log('Step 3: New Vendor choosing subscription package...');
    const choosePkgRes = await subscriptionService.chooseInitialPackage(newTenantId, { packageId: pkg.id });
    console.log('✅ Choose Package Response:', {
      hasSelectedPackage: choosePkgRes.hasSelectedPackage,
      isProfileComplete: choosePkgRes.isProfileComplete,
      redirectUrl: choosePkgRes.redirectUrl
    });

    if (choosePkgRes.redirectUrl !== '/create-business-profile') {
      throw new Error(`FAILED: Choose Package redirectUrl should be '/create-business-profile', got '${choosePkgRes.redirectUrl}'`);
    }

    // Step 4: Create Business Profile
    console.log('Step 4: New Vendor creating business profile...');
    const createProfileRes = await businessService.createBusinessProfile(newTenantId, {
      businessName: 'Fresh Mart Grocery Store',
      businessType: 'Retail Store',
      ownerName: 'New Vendor Owner',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      gstNumber: '07AAAAA0000A1Z5'
    });

    console.log('✅ Create Business Profile Response:', {
      isProfileComplete: createProfileRes.isProfileComplete,
      hasSelectedPackage: createProfileRes.hasSelectedPackage,
      redirectUrl: createProfileRes.redirectUrl,
      businessName: createProfileRes.businessName
    });

    if (createProfileRes.redirectUrl !== '/vendor/dashboard') {
      throw new Error(`FAILED: Create Profile redirectUrl should be '/vendor/dashboard', got '${createProfileRes.redirectUrl}'`);
    }

    // Step 5: Subsequent Login for newly onboarded Vendor
    console.log('\n--- TEST CASE C: SUBSEQUENT LOGIN FOR NEWLY ONBOARDED VENDOR ---');
    await prisma.oTPVerification.updateMany({ data: { lastSentAt: new Date(Date.now() - 60000) } });
    const sendOtpSubsequent = await authService.sendLoginOTP({ mobileNumber: newVendorPhone });
    const verifyOtpSubsequent = await authService.verifyLoginOTP({
      mobileNumber: newVendorPhone,
      otpCode: sendOtpSubsequent.otpCode
    });

    console.log('✅ Subsequent Login Response:', {
      isExistingUser: verifyOtpSubsequent.isExistingUser,
      hasSelectedPackage: verifyOtpSubsequent.hasSelectedPackage,
      isProfileComplete: verifyOtpSubsequent.isProfileComplete,
      redirectUrl: verifyOtpSubsequent.redirectUrl
    });

    if (verifyOtpSubsequent.redirectUrl !== '/vendor/dashboard') {
      throw new Error(`FAILED: Subsequent login redirectUrl should be '/vendor/dashboard', got '${verifyOtpSubsequent.redirectUrl}'`);
    }

    console.log('\n🎉 --- ALL VENDOR OTP & ONBOARDING TESTS PASSED PERFECTLY ---');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVendorOTPOnboardingTests();
