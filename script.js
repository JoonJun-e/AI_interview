// --- 사용자 데이터 및 면접 질문 관리 ---
const userData = {};
const questions = [
    "자기소개를 1분 동안 해주세요.",
    "우리 회사에 지원하게 된 동기는 무엇인가요?",
    "입사 후 만들고 싶은 성과에 대해 구체적으로 말씀해주세요."
];
const userAnswers = [];

// --- HTML 요소 전부 가져오기 ---
const irbPage = document.getElementById('irb-page');
const infoPage = document.getElementById('info-page');
const interviewWrapperPage = document.getElementById('interview-wrapper-page');
const loadingPage = document.getElementById('loading-page');
const resultPage = document.getElementById('result-page');
const checkUI = document.getElementById('check-ui');
const micCheckUI = document.getElementById('mic-check-ui');
const interviewUI = document.getElementById('interview-ui');
const irbCheckbox = document.getElementById('irb-checkbox');
const irbNextBtn = document.getElementById('irb-next-btn');
const infoForm = document.getElementById('info-form');
const startInterviewBtn = document.getElementById('start-interview-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const webcamInterview = document.getElementById('webcam-interview');
const canvas = document.getElementById('mic-visualizer');
const canvasCtx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');
const questionTitleElement = document.getElementById('question-title');
const questionTextElement = document.getElementById('question-text');
const resultTextElement = document.getElementById('result-text');
const preparationOverlay = document.getElementById('preparation-overlay');
const preparationTimer = document.getElementById('preparation-timer');
const toast = document.getElementById('toast');

// --- 상태 변수 ---
let localStream, audioContext, analyser, mediaRecorder;
let recordedChunks = [];
let timerInterval;
let currentQuestionIndex = 0;
let answerStartTime;

// --- 핵심 함수들 ---

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
}

function showToast(message) {
    toast.textContent = message;
    toast.classList.remove('hidden');
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.classList.add('hidden'), 500);
    }, 3000);
}

// ✅ [최종 수정] video와 audio를 다시 함께 요청합니다.
async function setupDevices() {
    if (localStream) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream;
        webcamInterview.srcObject = stream;
        
        // 마이크 시각화 코드는 그대로 둡니다.
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') await audioContext.resume();
        analyser = audioContext.createAnalyser();
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        visualizeMic();
    } catch (err) {
        showToast("카메라/마이크 활성화 실패: " + err.message);
    }
}

function startNextQuestion() {
    if (currentQuestionIndex >= questions.length) {
        finishInterview();
        return;
    }
    
    checkUI.classList.add('hidden');
    micCheckUI.classList.add('hidden');
    startInterviewBtn.classList.add('hidden');
    interviewUI.classList.remove('hidden');
    submitAnswerBtn.classList.remove('hidden');
    submitAnswerBtn.disabled = true;
    
    questionTitleElement.textContent = `AI 질문 ${currentQuestionIndex + 1}/${questions.length}`;
    questionTextElement.textContent = questions[currentQuestionIndex];

    runPreparationTimerWithRAF();
}

function runPreparationTimerWithRAF() {
    preparationOverlay.classList.remove('hidden');
    let startTime = null;
    const duration = 10000;

    function animationFrame(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const timeLeft = Math.ceil((duration - elapsed) / 1000);
        preparationTimer.textContent = timeLeft > 0 ? timeLeft : 0;
        if (elapsed < duration) {
            requestAnimationFrame(animationFrame);
        } else {
            preparationOverlay.classList.add('hidden');
            startRecordingAndTimer();
        }
    }
    requestAnimationFrame(animationFrame);
}

function startRecordingAndTimer() {
    const isRecordingStarted = startRecording(localStream);
    
    if (isRecordingStarted) {
        startTimer(60);
        answerStartTime = Date.now();
        submitAnswerBtn.disabled = true;
    } else {
        showToast("오디오 녹음을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
}

function visualizeMic() {
    // 마이크 시각화는 그대로 유지
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
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
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
        
        const elapsedTime = (Date.now() - answerStartTime) / 1000;
        if (elapsedTime >= 30) {
            submitAnswerBtn.disabled = false;
        }

        if (--timeLeft < 0) {
            submitAnswer();
        }
    }, 1000);
}

// ✅ [최종 수정] 오디오 트랙만 분리하여 녹음하는 함수
function startRecording(stream) {
    if (!stream || !stream.active) {
        showToast("미디어 스트림이 활성화되지 않았습니다.");
        return false;
    }
    
    // 1. 원본 스트림에서 오디오 트랙만 추출합니다.
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
        showToast("오디오 트랙을 찾을 수 없습니다.");
        return false;
    }

    // 2. 오디오 트랙만으로 새로운 MediaStream을 만듭니다. 이것이 핵심입니다.
    const audioStream = new MediaStream(audioTracks);

    recordedChunks = [];
    const mimeType = 'audio/webm;codecs=opus';

    if (!MediaRecorder.isTypeSupported(mimeType)) {
        showToast("지원되는 오디오 녹음 형식이 없습니다.");
        return false;
    }

    try {
        // 3. MediaRecorder에는 비디오가 제외된 '오디오 전용 스트림'을 전달합니다.
        mediaRecorder = new MediaRecorder(audioStream, { mimeType });
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.start();
        console.log("녹음이 성공적으로 시작되었습니다:", mimeType);
        return true;
    } catch (error) {
        console.error("녹음 시작 중 오류 발생:", error);
        showToast(`녹음 시작 오류: ${error.message}`);
        return false;
    }
}

function stopRecording() {
    return new Promise(resolve => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            resolve(new Blob(recordedChunks, { type: 'audio/webm' }));
            return;
        }
        mediaRecorder.onstop = () => {
            resolve(new Blob(recordedChunks, { type: 'audio/webm' }));
        };
        mediaRecorder.stop();
    });
}

async function submitAnswer() {
    clearInterval(timerInterval);
    const isTimeout = timerElement.textContent === '00:00';
    const elapsedTime = (Date.now() - answerStartTime) / 1000;

    if (!isTimeout && elapsedTime < 30) {
        showToast("최소 30초 이상 답변해야 합니다.");
        startTimer(60 - Math.floor(elapsedTime));
        return;
    }
    
    const audioBlob = await stopRecording();
    if (audioBlob.size > 0) userAnswers.push(audioBlob);
    else userAnswers.push(new Blob());
    
    currentQuestionIndex++;
    startNextQuestion();
}

async function finishInterview() {
    showPage('loading-page');
    const base64Answers = await Promise.all(
        userAnswers.map(blob => blobToBase64(blob))
    );
    sendDataToServer(base64Answers);
}

function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
        if (blob.size === 0) { resolve(""); return; }
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

async function sendDataToServer(base64Answers) {
    const payload = { userInfo: userData, answers: base64Answers };
    try {
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'API 호출 실패');
        }
        const data = await response.json();
        showPage('result-page');
        resultTextElement.textContent = `종합 평가: ${data.result}`;
    } catch (error) {
        console.error('Error submitting answer:', error);
        showToast('오류 발생: ' + error.message);
        showPage('interview-wrapper-page');
    }
}

// --- 이벤트 리스너 설정 ---
window.addEventListener('load', () => showPage('irb-page'));
irbNextBtn.addEventListener('click', () => {
    if (irbCheckbox.checked) {
        userData.irb_consented = true;
        userData.irb_consented_at = new Date().toISOString();
        showPage('info-page');
    } else {
        showToast('연구 참여에 동의해야 합니다.');
    }
});
infoForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const age = document.getElementById('age').value;
    if (name && age) {
        userData.name = name;
        userData.age = age;
        showPage('interview-wrapper-page');
        setupDevices();
    }
});
startInterviewBtn.addEventListener('click', startNextQuestion);
submitAnswerBtn.addEventListener('click', submitAnswer);