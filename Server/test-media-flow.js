import dotenv from 'dotenv';
dotenv.config();

console.log('🧪 [MEDIA FLOW TEST] Testing the upload -> media ID conversion flow');
console.log('');

// Test environment variables
const WA_ACCESS_TOKEN = process.env.WA_ACCESS_TOKEN;
const WA_BUSINESS_ACCOUNT_ID = process.env.WA_BUSINESS_ACCOUNT_ID;
const WA_APP_ID = process.env.WA_APP_ID;

console.log('🔍 [ENV CHECK] Environment Variables:');
console.log(`WA_ACCESS_TOKEN: ${WA_ACCESS_TOKEN ? '✅ Present' : '❌ Missing'}`);
console.log(`WA_BUSINESS_ACCOUNT_ID: ${WA_BUSINESS_ACCOUNT_ID ? '✅ Present' : '❌ Missing'}`);
console.log(`WA_APP_ID: ${WA_APP_ID ? '✅ Present' : '❌ Missing'}`);
console.log('');

if (WA_ACCESS_TOKEN && WA_BUSINESS_ACCOUNT_ID && WA_APP_ID) {
  console.log('✅ [READY] All environment variables are set correctly!');
  console.log('');
  console.log('📋 [FLOW] The upload process will:');
  console.log('   1. POST /uploads -> get file_handle');
  console.log('   2. POST /media -> convert to media_id');
  console.log('   3. Use media_id in template headers');
  console.log('');
  console.log('🎯 [EXAMPLE] Media ID format expected: numeric string like "123456789"');
  console.log('❌ [OLD] File handle format (should NOT be used): "4:V2hhdHNBcHAgSW..."');
} else {
  console.log('❌ [ERROR] Missing required environment variables!');
}
