import { notionActivityLog } from './main';
import * as notion from './notion';
import * as core from './core';
import * as gemini from './gemini';

jest.mock('./notion');
jest.mock('./core');
jest.mock('./gemini');

const mockFetchDailyLogs = notion.fetchDailyLogs as jest.Mock;
const mockSaveSummaryToNotion = notion.saveSummaryToNotion as jest.Mock;
const mockSummarizeLogs = core.summarizeLogs as jest.Mock;
const mockGenerateSummary = gemini.generateSummary as jest.Mock;

describe('notionActivityLog Cloud Function', () => {
  let mockReq: any;
  let mockRes: any;
  const fakeDate = new Date('2025-07-19T12:00:00.000Z');

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NOTION_API_KEY = 'fake_notion_key';
    process.env.NOTION_DATABASE_ID = 'fake_log_db';
    process.env.SUMMARY_DATABASE_ID = 'fake_summary_db';
    process.env.GEMINI_API_KEY = 'fake_gemini_key';

            mockReq = {
      query: {
        date: fakeDate.toISOString(),
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
  });

  it('should orchestrate fetching, summarizing, and saving', async () => {
    const fakeLogs = [{ content: 'test log', createdAt: new Date() }];
    const fakeCategorizedLogs = {
      today: ['test log'],
      am: ['test log'],
      pm: [],
      threeHourly: [['test log'], [], [], [], [], [], [], []],
    };
    
    mockFetchDailyLogs.mockResolvedValue(fakeLogs);
    mockSummarizeLogs.mockReturnValue(fakeCategorizedLogs);
    mockGenerateSummary.mockImplementation(async (logs: string[]) => {
      return logs.length > 0 ? `AI summary` : 'none';
    });
    mockSaveSummaryToNotion.mockResolvedValue(undefined);

    await notionActivityLog(mockReq, mockRes);

    expect(mockFetchDailyLogs).toHaveBeenCalledTimes(1);
    expect(mockSummarizeLogs).toHaveBeenCalledWith(fakeLogs);
    expect(mockGenerateSummary).toHaveBeenCalledTimes(11);
        expect(mockSaveSummaryToNotion).toHaveBeenCalledWith(
      expect.any(Object),
      'fake_summary_db',
      expect.any(Date),
      expect.any(Object)
    );
    
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });
});
