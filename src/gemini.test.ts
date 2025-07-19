import { GoogleGenerativeAI } from '@google/generative-ai';
import { generateSummary } from './gemini';

jest.mock('@google/generative-ai');

const mockGenerateContent = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContent: mockGenerateContent,
}));

(GoogleGenerativeAI as jest.Mock).mockImplementation(() => ({
  getGenerativeModel: mockGetGenerativeModel,
}));

describe('generateSummary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return "none" for empty logs', async () => {
    const summary = await generateSummary([]);
    expect(summary).toBe('none');
  });

  it('should call the Gemini API', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'AI summary' },
    });
    await generateSummary(['log 1']);
    expect(mockGetGenerativeModel).toHaveBeenCalledWith({ model: 'gemini-1.5-flash-latest' });
  });
});
