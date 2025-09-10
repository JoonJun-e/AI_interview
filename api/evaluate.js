import { SpeechClient } from '@google-cloud/speech';
import { VertexAI } from '@google-cloud/vertexai';
import { Readable } from 'stream';

export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }
    try {
        const audioBuffer = await streamToBuffer(req);

        const transcript = await speechToText(audioBuffer);
        console.log('STT Result:', transcript);
        if (!transcript) {
            return res.status(200).json({ result: '음성을 인식하지 못했습니다. 다시 시도해주세요.' });
        }
        
        const result = await getGeminiResult(transcript);
        console.log('Gemini Result:', result);
        res.status(200).json({ result });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
}

// ★★★ 누락되었던 필수 함수 ★★★
function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', err => reject(err));
    });
}

async function speechToText(audioBuffer) {
    const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
    const speechClient = new SpeechClient({ credentials });

    const audio = { content: audioBuffer.toString('base64') };
    const config = {
        languageCode: 'ko-KR',
    };
    const request = { audio, config };

    const [response] = await speechClient.recognize(request);
    return response.results.map(result => result.alternatives[0].transcript).join('\n');
}

async function getGeminiResult(text) {
    const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
    const projectId = credentials.project_id;
    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1', credentials });
    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    const prompt = `당신은 AI 면접관입니다. 다음 답변을 듣고 '합격' 또는 '불합격'으로 판단해주세요. 다른 어떤 설명은 필요시 추가할 수 있습니다. 답변: "${text}"`;
    const resp = await generativeModel.generateContent(prompt);
    const response = resp.response;
    return response.candidates[0].content.parts[0].text;
}