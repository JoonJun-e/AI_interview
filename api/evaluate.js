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
        const audioBuffer = await streamToBuffer(req);

        // Google Speech-to-Text API로 보내 텍스트로 변환
        const transcript = await speechToText(audioBuffer);
        console.log('STT Result:', transcript);

        if (!transcript) {
            return res.status(200).json({ result: '음성을 인식하지 못했습니다. 다시 시도해주세요.' });
        }

        // 변환된 텍스트를 Gemini API로 보내 합격/불합격 판단
        const result = await getGeminiResult(transcript);
        console.log('Gemini Result:', result);

        // 최종 결과를 브라우저로 전송
        res.status(200).json({ result });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: error.message });
    }
}

// --- Helper