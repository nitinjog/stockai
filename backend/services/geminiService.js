const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Primary and fallback Gemini models
const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

// OpenRouter vision-enabled fallback models (in order of preference)
const OPENROUTER_MODELS = [
  'google/gemini-2.5-flash-preview',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-4-maverick',
  'openai/gpt-4o-mini',
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callOpenRouter(prompt, imageBase64, mimeType) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('No OpenRouter API key configured');

  let lastErr;
  for (const modelId of OPENROUTER_MODELS) {
    try {
      console.log(`Trying OpenRouter model: ${modelId}`);
      const userContent = imageBase64
        ? [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ]
        : [{ type: 'text', text: prompt }];

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: modelId,
          messages: [{ role: 'user', content: userContent }],
        },
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://stockai.app',
            'X-Title': 'StockAI',
          },
          timeout: 60000,
        }
      );

      return response.data.choices[0].message.content;
    } catch (err) {
      lastErr = err;
      const status = err.response?.status;
      console.warn(`OpenRouter model ${modelId} failed (${status || err.message}), trying next...`);
    }
  }
  throw lastErr;
}

async function callGemini(parts) {
  let lastErr;
  for (const modelId of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({ model: modelId });
    try {
      console.log(`Trying Gemini model: ${modelId}`);
      const result = await model.generateContent(parts);
      return result.response.text();
    } catch (err) {
      lastErr = err;
      const is429 = err.message?.includes('429');
      const is503 = err.message?.includes('503');
      if (is503) {
        // High demand — don't waste time retrying same model, move to next immediately
        console.warn(`Gemini ${modelId} returned 503, trying next model...`);
        continue;
      }
      if (is429) {
        // Rate limited — wait briefly then try next model
        console.warn(`Gemini ${modelId} rate limited (429), trying next model in 5s...`);
        await sleep(5000);
        continue;
      }
      throw err; // non-retriable error
    }
  }
  // All Gemini models failed — fall back to OpenRouter
  console.warn('All Gemini models failed. Falling back to OpenRouter...');
  return null;
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

  let text = await callGemini(parts);
  if (text === null) {
    text = await callOpenRouter(prompt, imageBase64, mimeType);
  }
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
