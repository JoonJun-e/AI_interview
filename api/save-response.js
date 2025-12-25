// ======================= [api/save-response.js 코드 시작] =======================
import { google } from 'googleapis';

// Google Sheets 설정
const SPREADSHEET_ID = '1M35KyJHZa_mDoft_07habACKOYRmWIHTgOv28LhTg-M';
const SHEET_NAME = 'responses'; // 시트 탭 이름 (필요시 수정)

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { condition, videoNumber, response } = req.body;

        if (!condition || !videoNumber || !response) {
            return res.status(400).json({ error: 'Missing required fields: condition, videoNumber, response' });
        }

        // 서비스 어카운트 인증
        const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });

        const sheets = google.sheets({ version: 'v4', auth });

        // 저장할 데이터 구성
        const timestamp = new Date().toISOString();
        const rowData = [timestamp, condition, videoNumber, response];

        // Google Sheets에 데이터 추가
        await sheets.spreadsheets.values.append({
            spreadsheetId: SPREADSHEET_ID,
            range: `${SHEET_NAME}!A:D`, // A열~D열까지
            valueInputOption: 'USER_ENTERED',
            resource: {
                values: [rowData]
            }
        });

        console.log(`Response saved: ${condition} - ${videoNumber}`);
        res.status(200).json({ status: 'success', message: 'Response saved to Google Sheets' });

    } catch (error) {
        console.error('Save Response Error:', error);
        res.status(500).json({
            error: 'Failed to save response',
            details: error.message
        });
    }
}

// ======================= [api/save-response.js 코드 끝] =======================
