import fs from 'fs';
const payload = { action: 'getPurchasingData', forceRefresh: false };
fetch('https://script.google.com/macros/s/AKfycbxqbf_OCtXGSFMSjoUb73_Kc2HOROvOV49St6eJFv1_e6qnrgYjmeCeBv_hQ_HVu93Q/exec', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
  body: JSON.stringify(payload),
  redirect: 'follow'
}).then(res => {
  console.log('Status:', res.status);
  return res.text();
}).then(text => {
  fs.writeFileSync('d:/Tharn/Planning_Project/401-error.html', text);
  console.log('Saved to 401-error.html');
}).catch(err => {
  console.error('Fetch error:', err);
});
