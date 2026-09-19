const payload = { action: 'getPurchasingData', forceRefresh: false };
fetch('https://script.google.com/macros/s/AKfycbwF-vDCkLp6vtcH8iRMv4IeSxUjixgAX-Z4F13ajxayC_n2lP_eEEcb7VR_YQdDgghC/exec', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(payload),
  redirect: 'follow'
}).then(res => {
  console.log('Status:', res.status);
  console.log('Headers:', res.headers);
  return res.text();
}).then(text => {
  require('fs').writeFileSync('d:/Tharn/Planning_Project/401-error.html', text);
  console.log('Saved to 401-error.html');
}).catch(err => {
  console.error('Fetch error:', err);
});
