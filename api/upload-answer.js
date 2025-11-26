// ======================= [api/upload-answer.js 코드 시작] =======================
import { Storage } from '@google-cloud/storage';

// --- Google Cloud 설정 ---
const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
const GCS_BUCKET_NAME = 'ai-interview-skku-is-2025';

const storage = new Storage({ credentials });

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { base64Audio, fileName } = req.body;

        if (!base64Audio || !fileName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const audioBuffer = Buffer.from(base64Audio, 'base64');
        const publicUrl = await uploadToGCS(audioBuffer, fileName);

        console.log(`File uploaded to GCS: ${publicUrl}`);
        res.status(200).json({ status: 'success', url: publicUrl });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ error: 'Failed to upload file.', details: error.message });
    }
}

// GCS에 파일을 업로드하는 함수
async function uploadToGCS(buffer, fileName) {
    const bucket = storage.bucket(GCS_BUCKET_NAME);
    const file = bucket.file(fileName);
    await file.save(buffer, { metadata: { contentType: 'audio/webm' } });

    const publicUrl = `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${fileName}`;
    return publicUrl;
}

// ======================= [api/upload-answer.js 코드 끝] =======================
