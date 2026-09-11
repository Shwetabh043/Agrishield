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

    const systemPrompt = `You are an expert practical agricultural field extension officer providing guidance directly to a farmer.
Examine the plant/crop photo carefully.

CRITICAL PERFORMANCE & CONCISENESS REQUIREMENT:
Provide direct, concise, and high-impact field guidance. Keep each item brief (1-2 clear sentences per point, maximum 2-3 bullet items per section) so the diagnosis generates rapidly without long delays.

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

    // Resilient Candidate Models Chain: if one model experiences high demand (503) or rate limits (429),
    // the system automatically transparently tries the next high-speed model.
    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-8b',
      'gemini-3.6-flash'
    ];

    let lastError = null;
    let report = null;

    for (const model of candidateModels) {
      try {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

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
              response_mime_type: 'application/json',
              temperature: 0.2,
              max_output_tokens: 1024
            }
          })
        });

        const data = await response.json();

        if (!response.ok) {
          const errMsg = data.error?.message || '';
          console.warn(`Gemini model ${model} failed with status ${response.status}: ${errMsg}`);
          lastError = { status: response.status, data };

          // If high demand (503), rate limit (429), or temporary server error (500/504), fail over to next model
          if (
            response.status === 503 ||
            response.status === 429 ||
            response.status >= 500 ||
            errMsg.toLowerCase().includes('demand') ||
            errMsg.toLowerCase().includes('quota') ||
            errMsg.toLowerCase().includes('overloaded') ||
            errMsg.toLowerCase().includes('resource_exhausted')
          ) {
            continue; // Try next model in candidate list
          }

          // Non-retriable client error (e.g. 400 bad key), break immediately
          break;
        }

        let resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!resultText) {
          lastError = { status: 502, data: { error: { message: `No diagnosis text returned by model ${model}.` } } };
          continue;
        }

        resultText = resultText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
        report = JSON.parse(resultText);
        break; // Successfully obtained diagnosis!

      } catch (loopErr) {
        console.warn(`Exception calling model ${model}:`, loopErr);
        lastError = { status: 500, data: { error: { message: loopErr.message } } };
        continue;
      }
    }

    if (!report) {
      return res.status(lastError?.status || 500).json(lastError?.data || {
        error: { message: 'All diagnosis models are temporarily experiencing high demand. Please try again in a few moments.' }
      });
    }

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
