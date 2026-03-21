const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function analyzeTechnicalChart(imageBase64, mimeType, stockName) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are an expert technical analyst specializing in Indian stock markets (NSE/BSE). Analyze this technical chart for ${stockName}.

Provide a structured technical analysis with these sections:

1. **TREND ANALYSIS**
   - Primary trend (Bullish/Bearish/Sideways)
   - Trend strength and momentum

2. **KEY PRICE LEVELS**
   - Immediate support levels (2-3 levels with prices)
   - Immediate resistance levels (2-3 levels with prices)
   - Critical breakout/breakdown zones

3. **CHART PATTERNS**
   - Any visible patterns (Head & Shoulders, Double Top/Bottom, Triangle, Flag, Cup & Handle, etc.)
   - Pattern completion status and target

4. **TECHNICAL INDICATORS** (analyze what's visible)
   - Moving averages (position, crossovers, golden/death cross)
   - RSI: level and interpretation (overbought >70, oversold <30)
   - MACD: signal and histogram
   - Volume: trend confirmation or divergence
   - Bollinger Bands position if visible

5. **CANDLESTICK ANALYSIS**
   - Recent significant candle patterns
   - Price action signals

6. **TOMORROW'S OUTLOOK**
   - Expected direction
   - Target price range for next session
   - Recommended entry/exit levels
   - Key levels to watch

7. **CONFIDENCE LEVEL**: High / Medium / Low

Be specific with price levels where possible. Format clearly with bullet points.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  return result.response.text();
}

async function analyzeFundamentals(stockName, news) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const newsText = news.length > 0
    ? news.slice(0, 15).map((n, i) => `${i + 1}. [${n.source || 'News'}] ${n.title}${n.description ? ': ' + n.description.slice(0, 150) : ''}`).join('\n')
    : 'No recent news found.';

  const prompt = `You are a fundamental analyst specializing in Indian equities (NSE/BSE).

Stock: ${stockName}

Recent News & Developments:
${newsText}

Analyze and provide:

1. **OVERALL SENTIMENT**: Bullish / Bearish / Neutral (with strength)

2. **POSITIVE CATALYSTS**
   - List key bullish factors from news

3. **NEGATIVE FACTORS / RISKS**
   - List key bearish factors or risks

4. **MACROECONOMIC IMPACT**
   - RBI policy, inflation, FII/DII flows, global cues
   - Sector-specific factors

5. **COMPANY-SPECIFIC EVENTS**
   - Results, management changes, contracts, regulatory issues

6. **NEWS SENTIMENT SCORE**: Rate -10 (very bearish) to +10 (very bullish)

7. **EXPECTED PRICE IMPACT**
   - Direction and estimated % move based on news

8. **KEY EVENTS TO WATCH** tomorrow

Format clearly with bullet points. Be concise and specific.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function getFinalPrediction(stockName, previousClose, technicalAnalysis, fundamentalAnalysis) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `You are a senior market analyst for Indian equities (NSE/BSE). Synthesize the following analyses to provide a final actionable prediction.

Stock: ${stockName}
Previous Close Price: ₹${previousClose}

TECHNICAL ANALYSIS:
${technicalAnalysis}

FUNDAMENTAL / NEWS ANALYSIS:
${fundamentalAnalysis}

Based on BOTH analyses, provide your final prediction as a JSON object. Return ONLY valid JSON, no markdown, no explanation outside the JSON.

{
  "targetPrice": <number - specific INR price target for tomorrow>,
  "stopLoss": <number - stop loss price in INR>,
  "priceRangeLow": <number - lower bound of expected range>,
  "priceRangeHigh": <number - upper bound of expected range>,
  "recommendation": <"BUY" | "SELL" | "HOLD">,
  "confidence": <"High" | "Medium" | "Low">,
  "percentageChange": <number - expected % change from previous close, positive or negative>,
  "technicalBias": <"Bullish" | "Bearish" | "Neutral">,
  "fundamentalBias": <"Bullish" | "Bearish" | "Neutral">,
  "reasoning": [<string>, <string>, <string>, <string>],
  "riskFactors": [<string>, <string>, <string>],
  "keyLevels": {
    "support": <number>,
    "resistance": <number>
  },
  "summary": <string - 2-3 sentence executive summary of the prediction>
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code blocks if present
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try extracting JSON object from text
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return { error: 'Parse failed', rawText: text };
      }
    }
    return { error: 'No JSON found', rawText: text };
  }
}

module.exports = { analyzeTechnicalChart, analyzeFundamentals, getFinalPrediction };
