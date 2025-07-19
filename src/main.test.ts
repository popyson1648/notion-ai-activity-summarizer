import { notionActivityLog } from './main';
import * as notion from './notion';
import * as core from './core';
import * as gemini from './gemini';
import { subDays, format, addDays } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

jest.mock('./notion');
jest.mock('./core');
jest.mock('./gemini');

const mockFetchDailyLogs = notion.fetchDailyLogs as jest.Mock;
const mockSaveSummaryToNotion = notion.saveSummaryToNotion as jest.Mock;
const mockSummarizeLogs = core.summarizeLogs as jest.Mock;
const mockGenerateSummary = gemini.generateSummary as jest.Mock;

const TIME_ZONE = 'Asia/Tokyo';

describe('notionActivityLog Cloud Function', () => {
  let mockReq: any;
  let mockRes: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock process.env
    process.env.NOTION_API_KEY = 'fake_notion_key';
    process.env.NOTION_DATABASE_ID = 'fake_log_db';
    process.env.SUMMARY_DATABASE_ID = 'fake_summary_db';
    process.env.GEMINI_API_KEY = 'fake_gemini_key';

    // Mock Express-like req/res objects
    mockReq = { query: {} };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    // Mock underlying functions to prevent actual API calls
    mockFetchDailyLogs.mockResolvedValue([]);
    mockSummarizeLogs.mockReturnValue({
      today: [], am: [], pm: [], threeHourly: Array(8).fill([]),
    });
    mockGenerateSummary.mockResolvedValue('none');
    mockSaveSummaryToNotion.mockResolvedValue(undefined);
  });

  // Keep the existing test for basic orchestration
  it('should orchestrate fetching, summarizing, and saving for today', async () => {
    await notionActivityLog(mockReq, mockRes);
    expect(mockFetchDailyLogs).toHaveBeenCalledTimes(1);
    expect(mockSaveSummaryToNotion).toHaveBeenCalledTimes(1);
    expect(mockRes.status).toHaveBeenCalledWith(200);
  });

  describe('Date Parameter Handling', () => {
    const today = toZonedTime(new Date(), TIME_ZONE);

    it('should target today in JST even when the server is in UTC', async () => {
      process.env.TZ = 'UTC'; // Force UTC timezone for this test

      // Simulate a time that is 7 AM in JST but 10 PM the previous day in UTC.
      // JST: 2025-07-20 07:00:00
      // UTC: 2025-07-19 22:00:00
      const mockDate = new Date('2025-07-19T22:00:00.000Z');
      jest.useFakeTimers().setSystemTime(mockDate);

      await notionActivityLog(mockReq, mockRes);

      const receivedDate = mockFetchDailyLogs.mock.calls[0][2];
      
      // The date passed to the fetch function should be for the 20th, not the 19th.
      // We format it in UTC to get the 'YYYY-MM-DD' part of the timestamp.
      const formattedDate = format(receivedDate, 'yyyy-MM-dd');
      
      expect(formattedDate).toBe('2025-07-20');

      jest.useRealTimers();
      delete process.env.TZ;
    });

    it('should target a specific date when "date" parameter is provided', async () => {
      const targetDate = subDays(today, 5);
      mockReq.query.date = format(targetDate, 'yyyy-MM-dd');
      
      await notionActivityLog(mockReq, mockRes);
      
      const receivedDate = mockFetchDailyLogs.mock.calls[0][2];
      expect(format(receivedDate, 'yyyy-MM-dd')).toBe(format(targetDate, 'yyyy-MM-dd'));
    });

    it('should target yesterday when "day=yesterday" is provided', async () => {
      const yesterday = subDays(today, 1);
      mockReq.query.day = 'yesterday';

      await notionActivityLog(mockReq, mockRes);

      const receivedDate = mockFetchDailyLogs.mock.calls[0][2];
      expect(format(receivedDate, 'yyyy-MM-dd')).toBe(format(yesterday, 'yyyy-MM-dd'));
    });

    it('should prioritize "date" over "day" when both are provided', async () => {
      const targetDate = subDays(today, 10);
      mockReq.query.date = format(targetDate, 'yyyy-MM-dd');
      mockReq.query.day = 'today';

      await notionActivityLog(mockReq, mockRes);

      const receivedDate = mockFetchDailyLogs.mock.calls[0][2];
      expect(format(receivedDate, 'yyyy-MM-dd')).toBe(format(targetDate, 'yyyy-MM-dd'));
    });

    it('should return a 400 error for a future date', async () => {
      const futureDate = addDays(today, 1);
      mockReq.query.date = format(futureDate, 'yyyy-MM-dd');

      await notionActivityLog(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Future date is not allowed'));
    });

    it('should return a 400 error for an invalid date format', async () => {
      mockReq.query.date = 'invalid-date';

      await notionActivityLog(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Invalid date format'));
    });

    it('should return a 400 error for an invalid day parameter', async () => {
      mockReq.query.day = 'invalid-day';

      await notionActivityLog(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Invalid day parameter'));
    });

    it('should target today in JST even when the server is on a different UTC day', async () => {
      // Simulate 2025-07-20 07:00:00 JST, which is 2025-07-19 22:00:00 UTC
      const mockDate = new Date('2025-07-19T22:00:00.000Z');
      jest.useFakeTimers().setSystemTime(mockDate);

      await notionActivityLog(mockReq, mockRes);

      const receivedDate = mockFetchDailyLogs.mock.calls[0][2];
      // The summary should be for 2025-07-20 in JST, not 2025-07-19
      expect(formatInTimeZone(receivedDate, TIME_ZONE, 'yyyy-MM-dd')).toBe('2025-07-20');

      jest.useRealTimers(); // Restore real timers
    });
  });
});