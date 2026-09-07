import dotenv from 'dotenv';
dotenv.config();

/**
 * Utility to send SMS OTP to a user's mobile number.
 * Supports Twilio, Fast2SMS (India), or Console Log fallback in Development.
 */
export const sendSMS = async (mobileNumber, message) => {
  try {
    console.log(`\n======================================================`);
    console.log(`📱 [TERMINAL OTP CONSOLE LOG]`);
    console.log(`   Mobile Number : ${mobileNumber}`);
    console.log(`   SMS Content   : "${message}"`);
    console.log(`======================================================\n`);

    const provider = process.env.SMS_PROVIDER || 'CONSOLE';

    if (provider === 'TWILIO') {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        console.warn('⚠️ [SMS Warning] Twilio credentials missing in .env. Falling back to console dispatch.');
      } else {
        const formattedPhone = mobileNumber.startsWith('+') ? mobileNumber : `+91${mobileNumber}`;
        const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
          method: 'POST',
          headers: {
            'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            To: formattedPhone,
            From: fromNumber,
            Body: message
          })
        });

        const data = await response.json();
        console.log(`📲 [Twilio SMS Sent] Message SID: ${data.sid}`);
        return data;
      }
    } else if (provider === 'FAST2SMS') {
      const apiKey = process.env.FAST2SMS_API_KEY;

      if (!apiKey) {
        console.warn('⚠️ [SMS Warning] Fast2SMS API Key missing in .env. Falling back to console dispatch.');
      } else {
        const otpCode = message.match(/\d{6}/)?.[0] || '';
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
          method: 'POST',
          headers: {
            'authorization': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            route: 'otp',
            variables_values: otpCode,
            numbers: mobileNumber
          })
        });

        const data = await response.json();
        console.log('📲 [Fast2SMS Sent]', data);
        return data;
      }
    } else if (provider === 'TRUEBULKSMS') {
      const username = process.env.TRUEBULKSMS_USERNAME;
      const password = process.env.TRUEBULKSMS_PASSWORD;
      const senderId = process.env.TRUEBULKSMS_SENDER_ID || 'SOFTFY';
      const route = process.env.TRUEBULKSMS_ROUTE || '4';

      if (!username || !password) {
        console.warn('⚠️ [SMS Warning] TrueBulkSMS Username/Password missing in .env. Falling back to console dispatch.');
      } else {
        const queryParams = new URLSearchParams({
          username,
          password,
          sender: senderId,
          route: route,
          mobiles: mobileNumber,
          message: message,
          ...(process.env.TRUEBULKSMS_TEMPLATE_ID && { template_id: process.env.TRUEBULKSMS_TEMPLATE_ID })
        });

        const baseUrl = process.env.TRUEBULKSMS_API_URL || 'http://truebulksms.biz/httpapi.php';
        const url = `${baseUrl}?${queryParams.toString()}`;
        const response = await fetch(url);
        const textResult = await response.text();
        const shortResponse = textResult && textResult.includes('<html') ? '[HTML Response Received]' : textResult.substring(0, 100);
        console.log(`📲 [TrueBulkSMS Status for ${mobileNumber}]: ${shortResponse}`);
        return { success: true, response: textResult };
      }
    }

    // Default / Console Log Fallback (Development Mode)
    console.log(`📱 [SMS DISPATCH TO ${mobileNumber}]: "${message}"`);
    return { success: true, mode: 'CONSOLE_LOG' };
  } catch (error) {
    console.error('❌ Error sending SMS:', error);
    return { success: false, error: error.message };
  }
};
