import { notionActivityLog } from '../src/main';
import { HttpFunction } from '@google-cloud/functions-framework';

async function run() {
  console.log('🚀 Starting E2E Test...');

  const args = process.argv.slice(2);
  const query: { date?: string; day?: string } = {};
  let dateArg = 'today';

  if (args[0]) {
    dateArg = args[0];
    if (args[0].match(/^\d{4}-\d{2}-\d{2}$/)) {
      query.date = args[0];
    } else {
      query.day = args[0];
    }
  }
  
  console.log(`Targeting: ${dateArg}`);

  const mockReq: any = { query };
  const mockRes: any = {
    status: (code: number) => {
      console.log(`[RESPONSE] Status: ${code}`);
      return {
        send: (message: string) => console.log(`[RESPONSE] Body: ${message}`),
      };
    },
    send: (message: string) => console.log(`[RESPONSE] Body: ${message}`),
  };

  try {
    const target = notionActivityLog as HttpFunction;
    await target(mockReq, mockRes);
    console.log('\n🎉 E2E Test Script Finished.');
  } catch (error) {
    console.error('❌ E2E Test Script Failed:', error);
  }
}

run();