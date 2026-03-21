const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const MODEL = 'gemini-2.5-flash';

async function analyzeTechnicalChart(imageBase64, mimeType, stockName) {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const prompt = `Expert technical analyst for Indian stock market (NSE/BSE). Analyze this chart for ${stockName}.

Cover: 1) Trend (Bullish/Bearish/Sideways) 2) Support/Resistance levels 3) Chart patterns 4) Indicators (MA, RSI, MACD, Volume) 5) Tomorrow's price target range 6) Confidence: High/Medium/Low

Be concise with bullet points and specific prices.`;

  const result = await model.generateContent([
    prompt,
    { inlineData: { mimeType, data: imageBase64 } },
  ]);

  return result.response.text();
}

async function analyzeFundamentals(stockName, news) {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const newsText = news.length > 0
    ? news.slice(0, 8).map((n, i) => `${i + 1}. ${n.title}`).join('\n')
    : 'No recent news found.';

  const prompt = `Fundamental analyst for Indian equities. Stock: ${stockName}

News:
${newsText}

Provide: 1) Sentiment (Bullish/Bearish/Neutral) 2) Key positives 3) Key risks 4) Macro impact 5) Expected price move % 6) Events to watch

Be brief and specific.`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function getFinalPrediction(stockName, previousClose, technicalAnalysis, fundamentalAnalysis) {
  const model = genAI.getGenerativeModel({ model: MODEL });

  const techSummary = technicalAnalysis ? technicalAnalysis.slice(0, 800) : 'No chart provided.';
  const fundSummary = fundamentalAnalysis ? fundamentalAnalysis.slice(0, 800) : 'No news analysis.';

  const prompt = `Senior market analyst for Indian equities. Stock: ${stockName}, Prev Close: ₹${previousClose}

Technical: ${techSummary}

Fundamental: ${fundSummary}

Return ONLY this JSON (no markdown):
{"targetPrice":0,"stopLoss":0,"priceRangeLow":0,"priceRangeHigh":0,"recommendation":"BUY","confidence":"Medium","percentageChange":0,"technicalBias":"Neutral","fundamentalBias":"Neutral","reasoning":["r1","r2","r3"],"riskFactors":["r1","r2"],"keyLevels":{"support":0,"resistance":0},"summary":""}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return { error: 'Parse failed', rawText: text };
  }
}

module.exports = { analyzeTechnicalChart, analyzeFundamentals, getFinalPrediction };
