// ======================= [api/evaluate.js 코드 시작] =======================
import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';

// --- Google Cloud 설정 ---
const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
const GCS_BUCKET_NAME = 'ai-interview-skku-is-2025'; // 👈 여기에 GCS 버킷 이름을 넣으세요.
const GOOGLE_SHEET_ID = '1fr_HI18bXX1DIHXVJUMEpSScXUe-9ExTYz9fRWdk5V0';             // 👈 여기에 구글 시트 ID를 넣으세요.

const storage = new Storage({ credentials });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { userInfo, answers } = req.body;
        const audioUrls = [];

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

        const sheetRow = [
            new Date().toISOString(),   // 제출 시간
            userInfo.name,              // 이름
            userInfo.id,                // ID
            userInfo.testCondition,     // 선택한 조건 (pass/fail)
            audioUrls.join(', \n'),     // 모든 녹음 파일 링크
        ];
        
        await appendToSheet(sheetRow);
        console.log('Data successfully appended to Google Sheet.');
        
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
    
    // ❌ [수정] 아래 줄을 삭제하여 개별 파일 공개 설정을 제거합니다.
    // await file.makePublic(); 
    
    // 공개 URL은 파일 경로를 기반으로 직접 생성합니다.
    const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileName}`;
    return publicUrl;
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

// ======================= [api/evaluate.js 코드 끝] =======================