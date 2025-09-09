// --- 사용자 데이터 저장 객체 ---
const userData = {};

// --- HTML 요소 전부 가져오기 ---
// (이전과 동일)
const irbPage = document.getElementById('irb-page');
const infoPage = document.getElementById('info-page');
const deviceCheckPage = document.getElementById('device-check-page');
const interviewPage = document.getElementById('interview-page');
const loadingPage = document.getElementById('loading-page');
const resultPage = document.getElementById('result-page');
const irbCheckbox = document.getElementById('irb-checkbox');
const irbNextBtn = document.getElementById('irb-next-btn');
const infoForm = document.getElementById('info-form');
const startInterviewBtn = document.getElementById('start-interview-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const webcamCheck = document.getElementById('webcam-check');
const webcamInterview = document.getElementById('webcam-interview');
const canvas = document.getElementById('mic-visualizer');
const canvasCtx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');
const questionTextElement = document.getElementById('question-text');
const resultTextElement = document.getElementById('result-text');

// --- 상태 변수 ---
let localStream;
let audioContext, analyser;
let mediaRecorder;
let recordedChunks = [];
let timerInterval;

// --- 핵심 함수들 ---

// 1. 페이지 전환 함수
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(pageId).classList.remove('hidden');
}

// 2. 장치 시작 함수 - 버그 수정본
async function startDevices() {
    if (localStream) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream;
        webcamCheck.srcObject = stream;
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        visualizeMic();
    } catch (err) {
        console.error("장치 에러:", err);
        alert("카메라와 마이크를 찾을 수 없거나 권한을 허용해야 합니다.");
    }
}

// 3. 마이크 시각화 함수
function visualizeMic() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const draw = () => {
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = '#f4f1e9';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#3c3c3c';
        canvasCtx.beginPath();
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * canvas.height / 2;
            if (i === 0) {
                canvasCtx.moveTo(x, y);
            } else {
                canvasCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }
        canvasCtx.lineTo(canvas.width, canvas.height / 2);
        canvasCtx.stroke();
    };
    draw();
}

// 4. 면접 시작 함수
function startInterview() {
    showPage('interview-page');
    questionTextElement.textContent = "자기소개를 1분 동안 해주세요.";
    webcamInterview.srcObject = localStream;
    startRecording(localStream);
    startTimer(60); // 타이머 시작
}

// 5. 타이머 함수 - 수정본
function startTimer(duration) {
    clearInterval(timerInterval); // ★ FIX: 기존 타이머가 있다면 무조건 초기화
    let timeLeft = duration;
    timerInterval = setInterval(() => {
        const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        const seconds = String(timeLeft % 60).padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
        if (--timeLeft < 0) {
            submitAnswer();
        }
    }, 1000);
}

// 6. 녹음 시작 함수
function startRecording(stream) {
    recordedChunks = [];
    mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.start();
}

// 7. 녹음 중지 및 파일(Blob) 반환을 위한 Promise 함수
function stopRecording() {
    return new Promise(resolve => {
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            resolve(audioBlob);
        };
        mediaRecorder.stop();
    });
}

// 8. 답변 제출 함수 - 수정본
async function submitAnswer() {
    clearInterval(timerInterval); // 타이머 즉시 중지
    showPage('loading-page');

    if (!mediaRecorder || mediaRecorder.state === "inactive") {
        // 이미 녹음이 중지된 경우 (시간 초과 등)
        // recordedChunks에 데이터가 있는지 확인 후 처리
        if (recordedChunks.length === 0) {
            alert('녹음된 내용이 없습니다. 다시 시도해주세요.');
            startInterview(); // ★ FIX: 상태를 초기화하고 면접 다시 시작
            return;
        }
        // 이미 데이터가 있다면 Blob으로 만듦
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        await sendDataToServer(audioBlob);
    } else {
        // 녹음이 진행중인 경우
        const audioBlob = await stopRecording(); // ★ FIX: 녹음이 완전히 멈추고 파일이 만들어질 때까지 기다림
        await sendDataToServer(audioBlob);
    }
}

// 9. 서버로 데이터를 전송하는 로직 분리
async function sendDataToServer(blob) {
    try {
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'audio/webm' },
            body: blob
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API 호출에 실패했습니다.');
        }
        const data = await response.json();
        showPage('result-page');
        resultTextElement.textContent = `결과: ${data.result}`;
    } catch (error) {
        console.error('Error submitting answer:', error);
        alert('오류가 발생했습니다: ' + error.message);
        startInterview(); // ★ FIX: 오류 발생 시 상태를 초기화하고 면접을 다시 시작
    }
}


// --- 이벤트 리스너 설정 ---
window.addEventListener('load', () => showPage('irb-page'));
irbNextBtn.addEventListener('click', () => {
    if (irbCheckbox.checked) {
        userData.irb_consented = true;
        showPage('info-page');
    } else {
        alert('연구 참여에 동의해야 다음으로 진행할 수 있습니다.');
    }
});
infoForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const age = document.getElementById('age').value;
    if (name && age) {
        userData.name = name;
        userData.age = age;
        showPage('device-check-page');
        startDevices();
    } else {
        alert('모든 정보를 입력해주세요.');
    }
});
startInterviewBtn.addEventListener('click', startInterview);
submitAnswerBtn.addEventListener('click', submitAnswer);