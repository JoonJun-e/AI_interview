import { SpeechClient } from '@google-cloud/speech';
import { VertexAI } from '@google-cloud/vertexai';
import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';

// --- Google Cloud 설정 ---
const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
const GCS_BUCKET_NAME = 'YOUR_BUCKET_NAME'; // 👈 여기에 생성한 GCS 버킷 이름을 넣으세요.
const GOOGLE_SHEET_ID = 'YOUR_SHEET_ID';   // 👈 여기에 구글 시트 ID를 넣으세요.

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

        // 전달받은 answers 배열을 순회하며 유형에 따라 다르게 처리
        for (const answer of answers) {
            if (answer.type === 'video' && answer.content) {
                // 비디오 답변 처리
                const audioBuffer = Buffer.from(answer.content, 'base64');
                const uniqueFileName = `${Date.now()}-${userInfo.name.replace(/\s/g, '')}.webm`;
                const gcsUri = `gs://${GCS_BUCKET_NAME}/${uniqueFileName}`;

                const [publicUrl, transcript] = await Promise.all([
                    uploadToGCS(audioBuffer, uniqueFileName),
                    speechToTextLong(gcsUri)
                ]);
                
                audioUrls.push(publicUrl);
                transcripts.push(transcript || "(음성 인식 실패)");

            } else if (answer.type === 'text') {
                // 텍스트 답변 처리
                transcripts.push(`[코딩 테스트 답변]:\n${answer.content || "(답변 없음)"}`);
                audioUrls.push("(텍스트 답변)"); // 시트에 표시될 내용
            }
        }
        
        console.log(`Files uploaded:`, audioUrls);
        console.log(`STT Results:`, transcripts);

        const fullTranscript = transcripts.join('\n\n---\n\n');
        const geminiResult = await getGeminiResult(fullTranscript);
        console.log('Gemini Result:', geminiResult);

        const sheetRow = [
            userInfo.irb_consented_at,
            userInfo.name,
            userInfo.id, // 'age' 대신 'id'를 시트에 기록
            audioUrls.join(', '),
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

async function speechToTextLong(gcsUri) {
    if (!gcsUri) return "";
    const audio = { uri: gcsUri };
    const config = {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'ko-KR',
    };
    const request = { audio, config };
    const [operation] = await speechClient.longRunningRecognize(request);
    const [response] = await operation.promise();
    return response.results.map(result => result.alternatives[0].transcript).join('\n');
}

async function getGeminiResult(text) {
    const generativeModel = vertexAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
    const prompt = `당신은 AI 면접관입니다. 지원자의 여러 질문에 대한 답변이 순서대로 주어집니다. 모든 답변을 종합적으로 고려하여 최종적으로 '합격' 또는 '불합격'으로만 판단해주세요. 코딩 테스트 답변에 대해서는 정답 여부를 간략하게 언급하고, 나머지 인성 질문에 대한 답변을 종합하여 최종 결론을 내주세요.
    ---
    [지원자 답변 내용]
    ${text}
    ---
    `;
    const resp = await generativeModel.generateContent(prompt);
    return resp.response.candidates[0].content.parts[0].text;
}