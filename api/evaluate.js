import { SpeechClient } from '@google-cloud/speech';
import { VertexAI } from '@google-cloud/vertexai';
import { Storage } from '@google-cloud/storage'; // GCS 라이브러리
import { google } from 'googleapis'; // Google Sheets 라이브러리

// --- Google Cloud 설정 ---
const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
const GCS_BUCKET_NAME = 'ai-interview-skku-is-2025'; // 👈 1. 여기에 생성한 GCS 버킷 이름을 넣으세요.
const GOOGLE_SHEET_ID = '1GY6cJMDakcDmgdthJiGj1N0DLWF9kgrpaTCZniJ4VMk';   // 👈 2. 여기에 구글 시트 ID를 넣으세요.

// Google 서비스 클라이언트 초기화
const speechClient = new SpeechClient({ credentials });
const storage = new Storage({ credentials });
const vertexAI = new VertexAI({ project: credentials.project_id, location: 'us-central1' });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { userInfo, answers } = req.body;
        const transcripts = [];
        const audioUrls = [];

        // 모든 답변을 순회하며 처리
        for (const base64Audio of answers) {
            if (!base64Audio) {
                transcripts.push("(답변 없음)");
                audioUrls.push("");
                continue;
            }

            const audioBuffer = Buffer.from(base64Audio, 'base64');
            const uniqueFileName = `${Date.now()}-${userInfo.name.replace(/\s/g, '')}.webm`;
            
            const [publicUrl, transcript] = await Promise.all([
                uploadToGCS(audioBuffer, uniqueFileName),
                speechToText(base64Audio)
            ]);
            
            audioUrls.push(publicUrl);
            transcripts.push(transcript || "(음성 인식 실패)");
        }
        
        console.log(`Files uploaded:`, audioUrls);
        console.log(`STT Results:`, transcripts);

        const fullTranscript = transcripts.join('\n\n');
        const geminiResult = await getGeminiResult(fullTranscript);
        console.log('Gemini Result:', geminiResult);

        const sheetRow = [
            userInfo.irb_consented_at,
            userInfo.name,
            userInfo.age,
            audioUrls.join(', '), // 모든 파일 링크를 한 셀에 저장
            fullTranscript,
            geminiResult
        ];
        await appendToSheet(sheetRow);
        
        res.status(200).json({ result: geminiResult });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'An error occurred.', details: error.message });
    }
}

async function uploadToGCS(buffer, fileName) {
    const bucket = storage.bucket(GCS_BUCKET_NAME);
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: 'audio/webm' } });
    await file.makePublic(); 
    return file.publicUrl();
}

async function appendToSheet(rowData) {
    const auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheets = google.sheets({ version: 'v4', auth });
    await sheets.spreadsheets.values.append({
        spreadsheetId: GOOGLE_SHEET_ID,
        range: 'A1',
        valueInputOption: 'USER_ENTERED',
        resource: { values: [rowData] },
    });
}

async function speechToText(base64Audio) {
    if (!base64Audio) return "";
    const audio = { content: base64Audio };
    const config = { encoding: 'WEBM_OPUS', sampleRateHertz: 48000, languageCode: 'ko-KR' };
    const request = { audio, config };
    const [response] = await speechClient.recognize(request);
    return response.results.map(result => result.alternatives[0].transcript).join('\n');
}

async function getGeminiResult(text) {
    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    const prompt = `당신은 AI 면접관입니다. 지원자의 여러 질문에 대한 답변이 순서대로 주어집니다. 모든 답변을 종합적으로 고려하여 최종적으로 '합격' 또는 '불합격'으로만 판단해주세요. 판단에 대한 간단한 이유를 한 줄 덧붙일 수 있습니다.
    ---
    [지원자 답변 내용]
    ${text}
    ---
    `;
    const resp = await generativeModel.generateContent(prompt);
    return resp.response.candidates[0].content.parts[0].text;
}