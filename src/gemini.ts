import { GoogleGenerativeAI } from '@google/generative-ai';

type SummaryScope = 'broad' | 'detailed';

function getPrompt(logs: string[], scope: SummaryScope): string {
  const logLines = logs.map(log => `- ${log}`).join('\n');

  if (scope === 'broad') {
    return `以下の行動記録リストから、**高度に抽象化された**サマリーを生成してください。
個々の活動を羅列するのではなく、それらを統合し、その時間帯の**主要なテーマ、達成事項、全体的な流れ**を、複数のポイントに分けて記述してください。

最重要ルール：
- **重要な固有名詞（例：プロジェクト名、人名、ツール名）は、意味が失われないよう、要約に必ずそのまま含めてください。**

出力形式のルール：
- 各ポイントは、**必ず改行して**記述してください。
- 各ポイントの先頭には、内容を象徴する**絵文字**を一つ付けてください。
- 文章は簡潔に、要点をまとめてください。
- 絶対にマークダウンの見出し（#, ##）や太字（**）は使用しないでください。
- 該当する行動がない場合は 'none' とだけ返してください。

# 行動記録リスト：
${logLines}

# 抽象化サマリー：`;
  }

  // scope === 'detailed'
  return `以下の行動記録リストから、**構造化された**サマリーを生成してください。
まず記録から共通の関心ごとを特定し、それぞれに関連する活動をグループ化してください。

出力形式のルール：
- 各関心ごとのトピックは、適切な絵文字を先頭につけてください。（例: ✨ 新機能開発）
- 各活動は、インデントされた箇条書き（◦ activity）で記述してください。
- 絶対にマークダウンの見出し（#, ##）や太字（**）は使用しないでください。
- 該当する行動がない場合は 'none' とだけ返してください。

# 行動記録リスト：
${logLines}

# 構造化サマリー：`;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateSummary(logs: string[], scope: SummaryScope, retries = 3, delay = 1000): Promise<string> {
  if (logs.length === 0) {
    return 'none';
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-latest' });
  const prompt = getPrompt(logs, scope);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text.trim();
  } catch (error: any) {
    if (retries > 0 && error.status === 503) {
      console.warn(`Gemini API overloaded. Retrying...`);
      await sleep(delay);
      return generateSummary(logs, scope, retries - 1, delay * 2);
    }
    console.error('Error generating summary with Gemini after retries:', error);
    return logs.map(l => `◦ ${l}`).join('\n'); // Fallback
  }
}