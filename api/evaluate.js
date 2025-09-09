// Google Cloud 라이브러리를 가져옵니다.
// Vercel 환경에서는 require 대신 import를 사용해야 할 수 있습니다.
import { SpeechClient } from '@google-cloud/speech';
import { VertexAI } from '@google-cloud/vertexai';
import { Readable } from 'stream';

// Vercel에서 파일을 처리하기 위한 설정입니다.
export const config = {
    api: {
        bodyParser: false,
    },
};

// Vercel 서버리스 함수의 기본 핸들러
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        // 1. 브라우저에서 보낸 오디오 파일 받기
        const audioBuffer = await streamToBuffer(req);

        // 2. Google Speech-to-Text API로 보내 텍스트로 변환
        const transcript = await speechToText(audioBuffer);
        console.log('STT Result:', transcript);

        if (!transcript) {
            // 음성 인식이 안됐을 경우를 대비
            return res.status(200).json({ result: '음성을 인식하지 못했습니다. 다시 시도해주세요.' });
        }

        // 3. 변환된 텍스트를 Gemini API로 보내 합격/불합격 판단
        const result = await getGeminiResult(transcript);
        console.log('Gemini Result:', result);

        // 4. 최종 결과를 브라우저로 전송
        res.status(200).json({ result });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
}

// --- Helper Functions ---

function streamToBuffer(stream) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', err => reject(err));
    });
}

async function speechToText(audioBuffer) {
    // gcp-credentials.json 내용을 직접 사용 (Vercel 환경 변수 사용 권장)
    const credentials = JSON.parse(process.env.GCP_CREDENTIALS);

    const speechClient = new SpeechClient({ credentials });

    const audio = { content: audioBuffer.toString('base64') };
    const config = {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'ko-KR',
    };
    const request = { audio, config };

    const [response] = await speechClient.recognize(request);
    return response.results.map(result => result.alternatives[0].transcript).join('\n');
}

async function getGeminiResult(text) {
    const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
    const projectId = credentials.project_id; // JSON 파일에서 프로젝트 ID 읽어오기

    const vertexAI = new VertexAI({ project: projectId, location: 'us-central1', credentials });
    
    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    
    const prompt = `당신은 AI 면접관입니다. 다음 답변을 듣고 '합격' 또는 '불합격'으로만 판단해주세요. 오직 '합격' 또는 '불합격' 한 단어로만 답해야 합니다. 다른 어떤 설명도 추가하지 마세요. 답변: "${text}"`;

    const resp = await generativeModel.generateContent(prompt);
    const response = resp.response;
    return response.candidates[0].content.parts[0].text;
}