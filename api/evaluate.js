// ======================= [api/evaluate.js 코드 시작] =======================
import { Storage } from '@google-cloud/storage';
import { google } from 'googleapis';

// --- Google Cloud 설정 ---
const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
const GCS_BUCKET_NAME = 'ai-interview-skku-is-2025'; // 👈 여기에 GCS 버킷 이름을 넣으세요.
const GOOGLE_SHEET_ID = '1qZ1wrVgvp2PGJ7i_0xF8etHLo2o-DbWcGpJ9zfhEF_E';             // 👈 여기에 구글 시트 ID를 넣으세요.

const storage = new Storage({ credentials });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { userInfo, audioUrls } = req.body;

        console.log(`Received audio URLs:`, audioUrls);

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