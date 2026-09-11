// Vercel Serverless Function: /api/analyze
// Securely proxies Gemini 3.6 Flash calls so your API key is never exposed to the client.

module.exports = async (req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-key'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed. Use POST.' } });
  }

  // Get API key strictly from Vercel environment variable (never hardcoded in file)
  const apiKey = (process.env.GEMINI_API_KEY || req.headers['x-gemini-key'] || '').trim();

  if (!apiKey) {
    return res.status(500).json({
      error: {
        message: 'Server configuration error: GEMINI_API_KEY environment variable is not set in Vercel. Please add GEMINI_API_KEY in your Vercel Project Settings > Environment Variables.'
      }
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        return res.status(400).json({ error: { message: 'Invalid JSON request body.' } });
      }
    }

    const { imageBase64, imageMimeType, language } = body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: { message: 'Missing imageBase64 in request payload.' } });
    }

    const selectedLanguage = language || 'English';
    const GEMINI_MODEL = 'gemini-3.6-flash';

    const systemPrompt = `You are an expert practical agricultural field extension officer providing guidance directly to a farmer.
Examine the plant/crop photo carefully.

CRITICAL LANGUAGE REQUIREMENT:
You MUST generate the entire report and all diagnosis content strictly in ${selectedLanguage}.
If ${selectedLanguage} is an Indian language (e.g. Hindi, Bengali, Telugu, Marathi, Tamil, Gujarati, Kannada, Malayalam, Punjabi, Odia, Assamese, Urdu), write all explanations, symptoms, immediate field steps, pest measures, chemical solutions with practical dosages (ml or grams per liter), treatments, and prevention tips in ${selectedLanguage} using everyday vocabulary that local farmers easily understand.

Return a strict JSON object without any Markdown text wrapper or code fences outside the JSON block.
Structure response in valid JSON matching this exact layout:
{
  "cropName": "Name of crop in ${selectedLanguage}",
  "issueName": "Name of disease/pest/deficiency in ${selectedLanguage}",
  "severity": "Healthy | Low | Moderate | Severe (translated into ${selectedLanguage})",
  "urgency": "e.g. Treat within 24 hours / Normal routine care (in ${selectedLanguage})",
  "symptoms": ["Symptom point 1 in ${selectedLanguage}", "Symptom point 2 in ${selectedLanguage}"],
  "immediateActions": ["Action point 1 in ${selectedLanguage}", "Action point 2 in ${selectedLanguage}"],
  "pestInfestations": ["Specific pest identified and control measure 1 in ${selectedLanguage}", "Pest measure 2 in ${selectedLanguage}"],
  "chemicalSolutions": ["Specific chemical solution/fungicide/pesticide name and dilution in ${selectedLanguage}", "Chemical solution 2 in ${selectedLanguage}"],
  "treatment": ["Recommended spray/treatment 1 in ${selectedLanguage}", "Recommended spray/treatment 2 in ${selectedLanguage}"],
  "prevention": ["Prevention tip 1 in ${selectedLanguage}", "Prevention tip 2 in ${selectedLanguage}"]
}`;

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: systemPrompt },
            { inline_data: { mime_type: imageMimeType || 'image/jpeg', data: imageBase64 } }
          ]
        }],
        generationConfig: {
          response_mime_type: 'application/json'
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!resultText) {
      return res.status(502).json({ error: { message: 'No diagnosis text returned by Gemini API.' } });
    }

    resultText = resultText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    const report = JSON.parse(resultText);

    return res.status(200).json(report);

  } catch (err) {
    console.error('Error in /api/analyze:', err);
    return res.status(500).json({
      error: {
        message: err.message || 'Internal Server Error while analyzing crop image.'
      }
    });
  }
};
