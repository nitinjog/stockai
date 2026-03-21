const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// gemini-2.0-flash: 1500 req/day free tier (vs gemini-2.5-flash: 20/day)
const MODEL = 'gemini-2.0-flash';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callGemini(parts, retries = 3) {
  const model = genAI.getGenerativeModel({ model: MODEL });
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err) {
      const is429 = err.message?.includes('429');
      const retryMatch = err.message?.match(/retry in (\d+)s/i);
      const waitSecs = retryMatch ? parseInt(retryMatch[1]) + 2 : 15;
      if (is429 && i < retries - 1) {
        console.warn(`Gemini rate limited. Retrying in ${waitSecs}s...`);
        await sleep(waitSecs * 1000);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Single-call analysis: combines technical chart + news into one Gemini request.
 * Returns { technicalAnalysis, fundamentalAnalysis, finalPrediction }
 */
async function runFullAnalysis(stockName, previousClose, news, imageBase64, mimeType) {
  const newsText = news.length > 0
    ? news.slice(0, 8).map((n, i) => `${i + 1}. ${n.title}`).join('\n')
    : 'No recent news available.';

  const chartSection = imageBase64
    ? 'A technical chart image is attached. Analyze it carefully.'
    : 'No chart image provided. Skip chart analysis, focus on news/fundamentals.';

  const prompt = `You are a senior market analyst for Indian equities (NSE/BSE).

Stock: ${stockName}
Previous Close: ₹${previousClose}
${chartSection}

Recent News:
${newsText}

Provide a complete analysis in this EXACT JSON format (return ONLY JSON, no markdown):
{
  "technicalAnalysis": "<if chart provided: trend, support/resistance levels, patterns, indicators, tomorrow range. If no chart: 'No chart provided.'>",
  "fundamentalAnalysis": "<sentiment bullish/bearish/neutral, key positives, key risks, macro impact, expected price move %>",
  "finalPrediction": {
    "targetPrice": <specific INR price for tomorrow>,
    "stopLoss": <stop loss in INR>,
    "priceRangeLow": <low end of range>,
    "priceRangeHigh": <high end of range>,
    "recommendation": "<BUY or SELL or HOLD>",
    "confidence": "<High or Medium or Low>",
    "percentageChange": <expected % change, positive or negative>,
    "technicalBias": "<Bullish or Bearish or Neutral>",
    "fundamentalBias": "<Bullish or Bearish or Neutral>",
    "reasoning": ["<reason1>", "<reason2>", "<reason3>"],
    "riskFactors": ["<risk1>", "<risk2>"],
    "keyLevels": { "support": <number>, "resistance": <number> },
    "summary": "<2-sentence summary>"
  }
}`;

  const parts = imageBase64
    ? [prompt, { inlineData: { mimeType, data: imageBase64 } }]
    : [prompt];

  const text = await callGemini(parts);
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const result = JSON.parse(cleaned);
    return {
      technicalAnalysis: result.technicalAnalysis || null,
      fundamentalAnalysis: result.fundamentalAnalysis || null,
      finalPrediction: result.finalPrediction || { error: 'No prediction returned' },
    };
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const result = JSON.parse(match[0]);
        return {
          technicalAnalysis: result.technicalAnalysis || null,
          fundamentalAnalysis: result.fundamentalAnalysis || null,
          finalPrediction: result.finalPrediction || { error: 'No prediction returned' },
        };
      } catch {}
    }
    // Fallback: return raw text as technical analysis
    return {
      technicalAnalysis: text,
      fundamentalAnalysis: null,
      finalPrediction: { error: 'Could not parse JSON response', rawText: text.slice(0, 300) },
    };
  }
}

module.exports = { runFullAnalysis };
