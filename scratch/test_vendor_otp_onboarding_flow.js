import { prisma } from '../src/config/prisma.js';
import * as authService from '../src/modules/auth/auth.service.js';
import * as subscriptionService from '../src/modules/subscription/subscription.service.js';
import * as businessService from '../src/modules/business/business.service.js';

async function runVendorOTPOnboardingTests() {
  console.log('🧪 --- STARTING VENDOR OTP LOGIN & ONBOARDING WORKFLOW TESTS (2-STEP PROFILE & REORDERED FLOW) ---');

  const existingVendorPhone = '9876543210';
  const newVendorPhone = '8888888888';

  try {
    // 1. Cleanup Test Accounts
    console.log('\n🧹 Cleaning up test accounts...');
    const testTenants = await prisma.tenant.findMany({ where: { mobileNumber: { in: [existingVendorPhone, newVendorPhone] } } });
    const tenantIds = testTenants.map(t => t.id);
    if (tenantIds.length > 0) {
      await prisma.purchaseReturnItem.deleteMany({ where: { purchaseReturn: { tenantId: { in: tenantIds } } } });
      await prisma.purchaseReturn.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.purchaseItem.deleteMany({ where: { purchaseInvoice: { tenantId: { in: tenantIds } } } });
      await prisma.purchaseInvoice.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.supplierPayment.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.supplier.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.stockHistory.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.billItem.deleteMany({ where: { bill: { tenantId: { in: tenantIds } } } });
      await prisma.bill.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.user.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await prisma.user.deleteMany({ where: { mobileNumber: { in: [existingVendorPhone, newVendorPhone] } } });
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
        isProfileComplete: true,
        profileStep: 2
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

    // TEST CASE B: New Vendor OTP Login -> Step 1 Profile -> Step 2 Profile -> Choose Package -> Dashboard Access
    console.log('\n--- TEST CASE B: NEW VENDOR 2-STEP PROFILE & PACKAGE SELECTION ONBOARDING FLOW ---');

    // Step 1: Send OTP to new mobile
    console.log('Step 1: Requesting OTP for new mobile number...');
    const sendOtpNewRes = await authService.sendLoginOTP({ mobileNumber: newVendorPhone });
    console.log('✅ Send OTP Response (New):', {
      isExistingUser: sendOtpNewRes.isExistingUser,
      mobileNumber: sendOtpNewRes.mobileNumber
    });

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
      profileStep: verifyOtpNewRes.tenant?.profileStep,
      redirectUrl: verifyOtpNewRes.redirectUrl,
      tenantId: verifyOtpNewRes.tenant.id
    });

    if (verifyOtpNewRes.redirectUrl !== '/create-business-profile/step-1') {
      throw new Error(`FAILED: New vendor redirectUrl should be '/create-business-profile/step-1', got '${verifyOtpNewRes.redirectUrl}'`);
    }

    const newTenantId = verifyOtpNewRes.tenant.id;

    // Step 3: Complete Business Profile Step 1 (Basic Details)
    console.log('Step 3: Completing Profile Step 1 (Basic Details)...');
    const step1Res = await businessService.createBusinessProfileStep1(newTenantId, {
      businessName: 'Fresh Mart Grocery Store',
      businessType: 'Retail Grocery',
      ownerName: 'New Vendor Owner',
      email: 'vendor.freshmart@example.com'
    });
    console.log('✅ Profile Step 1 Response:', {
      profileStep: step1Res.profileStep,
      isProfileComplete: step1Res.isProfileComplete,
      hasSelectedPackage: step1Res.hasSelectedPackage,
      redirectUrl: step1Res.redirectUrl
    });

    if (step1Res.redirectUrl !== '/create-business-profile/step-2') {
      throw new Error(`FAILED: Step 1 redirectUrl should be '/create-business-profile/step-2', got '${step1Res.redirectUrl}'`);
    }

    // Step 3.5: Test login resume at Step 2
    console.log('Step 3.5: Testing login resume at Step 2...');
    await prisma.oTPVerification.updateMany({ data: { lastSentAt: new Date(Date.now() - 60000) } });
    const sendOtpStep2 = await authService.sendLoginOTP({ mobileNumber: newVendorPhone });
    const verifyOtpStep2 = await authService.verifyLoginOTP({
      mobileNumber: newVendorPhone,
      otpCode: sendOtpStep2.otpCode
    });
    console.log('✅ Resume Login Response (At Step 2):', {
      redirectUrl: verifyOtpStep2.redirectUrl
    });
    if (verifyOtpStep2.redirectUrl !== '/create-business-profile/step-2') {
      throw new Error(`FAILED: Resume login should be '/create-business-profile/step-2', got '${verifyOtpStep2.redirectUrl}'`);
    }

    // Step 4: Complete Business Profile Step 2 (Location & Tax Details)
    console.log('Step 4: Completing Profile Step 2 (Location & Tax Details)...');
    const step2Res = await businessService.createBusinessProfileStep2(newTenantId, {
      businessAddress: '123 Market Street',
      city: 'Delhi',
      state: 'Delhi',
      pincode: '110001',
      gstNumber: '07AAAAA0000A1Z5'
    });
    console.log('✅ Profile Step 2 Response:', {
      profileStep: step2Res.profileStep,
      isProfileComplete: step2Res.isProfileComplete,
      hasSelectedPackage: step2Res.hasSelectedPackage,
      redirectUrl: step2Res.redirectUrl
    });

    if (step2Res.redirectUrl !== '/choose-package') {
      throw new Error(`FAILED: Step 2 redirectUrl should be '/choose-package', got '${step2Res.redirectUrl}'`);
    }

    // Step 5: Choose Package
    console.log('Step 5: New Vendor choosing subscription package...');
    const choosePkgRes = await subscriptionService.chooseInitialPackage(newTenantId, { packageId: pkg.id });
    console.log('✅ Choose Package Response:', {
      hasSelectedPackage: choosePkgRes.hasSelectedPackage,
      isProfileComplete: choosePkgRes.isProfileComplete,
      redirectUrl: choosePkgRes.redirectUrl
    });

    if (choosePkgRes.redirectUrl !== '/vendor/dashboard') {
      throw new Error(`FAILED: Choose Package redirectUrl should be '/vendor/dashboard', got '${choosePkgRes.redirectUrl}'`);
    }

    // Step 6: Subsequent Login for newly onboarded Vendor
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

    console.log('\n🎉 --- ALL VENDOR OTP & 2-STEP ONBOARDING TESTS PASSED PERFECTLY ---');
  } catch (err) {
    console.error('❌ Test failed with error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runVendorOTPOnboardingTests();
