// --- 사용자 데이터 저장 객체 ---
const userData = {};

// --- HTML 요소 전부 가져오기 ---
const irbPage = document.getElementById('irb-page');
const infoPage = document.getElementById('info-page');
const interviewWrapperPage = document.getElementById('interview-wrapper-page'); // 수정
const loadingPage = document.getElementById('loading-page');
const resultPage = document.getElementById('result-page');

// UI 그룹 요소
const checkUI = document.getElementById('check-ui');
const micCheckUI = document.getElementById('mic-check-ui');
const interviewUI = document.getElementById('interview-ui');

// 버튼 및 폼 요소
const irbCheckbox = document.getElementById('irb-checkbox');
const irbNextBtn = document.getElementById('irb-next-btn');
const infoForm = document.getElementById('info-form');
const startInterviewBtn = document.getElementById('start-interview-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');

// 미디어 및 시각화 요소
const webcamInterview = document.getElementById('webcam-interview'); // 하나로 통합
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

// --- 페이지/UI 전환 함수 ---
function showPage(pageId) { /* 이전과 동일 */ }
function showToast(message) { /* 이전과 동일 */ }

// --- 장치 시작 및 면접 진행 로직 (단순화) ---
async function setupDevicesAndInterview() {
    if (localStream) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream;
        webcamInterview.srcObject = stream; // 비디오 요소에 바로 연결
        
        // 마이크 시각화 설정
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') await audioContext.resume();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        visualizeMic();
    } catch (err) {
        showToast("카메라/마이크 활성화에 실패했습니다: " + err.message);
    }
}

function startInterview() {
    // UI "변신"
    checkUI.classList.add('hidden');
    micCheckUI.classList.add('hidden');
    startInterviewBtn.classList.add('hidden');
    interviewUI.classList.remove('hidden');
    submitAnswerBtn.classList.remove('hidden');

    questionTextElement.textContent = "자기소개를 1분 동안 해주세요.";
    
    // 이미 켜져있는 스트림으로 녹음 및 타이머 시작
    startRecording(localStream);
    startTimer(60);
}

// --- 나머지 함수들 (이전과 동일) ---
function visualizeMic() { /* 이전과 동일 */ }
function startTimer(duration) { /* 이전과 동일 */ }
function startRecording(stream) { /* 이전과 동일, mimeType 지정 버전 */ }
function stopRecording() { /* 이전과 동일 */ }
async function submitAnswer() { /* 이전과 동일 */ }
async function sendDataToServer(blob) { /* 이전과 동일 */ }

// --- 이벤트 리스너 ---
window.addEventListener('load', () => showPage('irb-page'));
irbNextBtn.addEventListener('click', () => { /* 이전과 동일 */ });
infoForm.addEventListener('submit', event => {
    event.preventDefault();
    // 개인정보 저장... (이전과 동일)
    showPage('interview-wrapper-page'); // 통합된 페이지 보여주기
    setupDevicesAndInterview(); // 장치 켜기
});
startInterviewBtn.addEventListener('click', startInterview); // 면접 UI로 "변신"
submitAnswerBtn.addEventListener('click', submitAnswer);


// --- 여기에 복붙할 전체 함수 목록 ---

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.classList.add('hidden');
    });
    document.getElementById(pageId).classList.remove('hidden');
}

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 500);
    }, 3000);
}

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

function startTimer(duration) {
    clearInterval(timerInterval);
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

function startRecording(stream) {
    recordedChunks = [];
    const options = { mimeType: 'audio/webm;codecs=opus' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        mediaRecorder = new MediaRecorder(stream);
    } else {
        mediaRecorder = new MediaRecorder(stream, options);
    }
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.start();
}

function stopRecording() {
    return new Promise(resolve => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            resolve(new Blob(recordedChunks, { type: 'audio/webm' }));
            return;
        }
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            resolve(audioBlob);
        };
        mediaRecorder.stop();
    });
}

async function submitAnswer() {
    clearInterval(timerInterval);
    showPage('loading-page');
    const audioBlob = await stopRecording();
    if (audioBlob.size === 0) {
        showToast('녹음된 내용이 없습니다. 다시 시도해주세요.');
        // 상태 초기화 후 다시 면접 시작
        showPage('interview-wrapper-page');
        startInterview();
        return;
    }
    await sendDataToServer(audioBlob);
}

async function sendDataToServer(blob) {
    try {
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': mediaRecorder.mimeType },
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
        showToast('오류가 발생했습니다: ' + error.message);
        showPage('interview-wrapper-page');
    }
}

irbNextBtn.addEventListener('click', () => {
    if (irbCheckbox.checked) {
        userData.irb_consented = true;
        showPage('info-page');
    } else {
        showToast('연구 참여에 동의해야 다음으로 진행할 수 있습니다.');
    }
});

infoForm.addEventListener('submit', event => {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const age = document.getElementById('age').value;
    if (name && age) {
        userData.name = name;
        userData.age = age;
        showPage('interview-wrapper-page');
        setupDevicesAndInterview();
    } else {
        showToast('모든 정보를 입력해주세요.');
    }
});