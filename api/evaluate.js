// ======================= [api/evaluate.js 코드 시작] =======================
import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';
// ❌ VertexAI 관련 import 제거

// --- Google Cloud 설정 ---
const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
const GCS_BUCKET_NAME = 'ai-interview-skku-is-2025'; // 👈 여기에 GCS 버킷 이름을 넣으세요.
const GOOGLE_SHEET_ID = 'YOUR_SHEET_ID';             // 👈 여기에 구글 시트 ID를 넣으세요.

const storage = new Storage({ credentials });
// ❌ VertexAI 초기화 코드 제거

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { userInfo, answers } = req.body;
        const audioUrls = [];

        // 모든 답변을 순회하며 GCS에 업로드합니다.
        for (const base64Audio of answers) {
            if (!base64Audio) {
                audioUrls.push("N/A");
                continue;
            }
            const audioBuffer = Buffer.from(base64Audio, 'base64');
            const uniqueFileName = `${Date.now()}-${userInfo.name.replace(/\s/g, '')}-${audioUrls.length + 1}.webm`;
            const publicUrl = await uploadToGCS(audioBuffer, uniqueFileName);
            audioUrls.push(publicUrl);
        }
        
        console.log(`Files uploaded to GCS:`, audioUrls);

        // 구글 시트에 기록할 데이터를 준비합니다.
        const sheetRow = [
            new Date().toISOString(),   // 제출 시간
            userInfo.name,              // 이름
            userInfo.id,                // ID
            userInfo.testCondition,     // ✅ userInfo에서 가져오도록 수정
            audioUrls.join(', \n'),     // 모든 녹음 파일 링크
        ];
        
        await appendToSheet(sheetRow);
        console.log('Data successfully appended to Google Sheet.');
        
        // 클라이언트에는 단순 성공 메시지만 보냅니다.
        res.status(200).json({ status: 'success', message: 'Data saved successfully.' });

    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Failed to save data.', details: error.message });
    }
}

// GCS에 파일을 업로드하는 함수
async function uploadToGCS(buffer, fileName) {
    const bucket = storage.bucket(GCS_BUCKET_NAME);
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: 'audio/webm' } });
    await file.makePublic(); 
    return file.publicUrl();
}

// 구글 시트에 한 행을 추가하는 함수
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

// ❌ getGeminiResult 함수 완전히 제거
// ======================= [api/evaluate.js 코드 끝] =======================