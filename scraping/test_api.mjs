import 'dotenv/config';

const API_KEY = process.env.COMTRADE_API_KEY;
const url = `https://comtradeapi.un.org/data/v1/get/C/A/HS?cmdCode=4419&reporterCode=699&partnerCode=842&flowCode=X&period=2020&maxRecords=5&format=JSON&includeDesc=true`;

const res = await fetch(url, {
  headers: { 'Ocp-Apim-Subscription-Key': API_KEY }
});
const data = await res.json();
console.log('Status:', res.status);
console.log('First record keys:', Object.keys(data?.data?.[0] || {}));
console.log('First record:', JSON.stringify(data?.data?.[0], null, 2));
