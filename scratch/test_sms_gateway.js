async function testURLs() {
  const username = 'SoftFYR';
  const password = '971236';
  const sender = 'SOFTFY';
  const route = '4';
  const mobiles = '9711625120';
  const message = 'Your OTP is 123456';

  const query = new URLSearchParams({ username, password, sender, route, mobiles, message }).toString();

  const urls = [
    `http://truebulksms.biz/httpapi.php?${query}`,
    `http://sms.truebulksms.com/httpapi.php?${query}`,
    `http://www.truebulksms.com/httpapi.php?${query}`
  ];

  for (const url of urls) {
    try {
      console.log(`Testing URL: ${url}`);
      const res = await fetch(url);
      const text = await res.text();
      console.log(`Response: ${text}\n`);
    } catch (e) {
      console.error(`Failed: ${e.message}\n`);
    }
  }
}

testURLs();
