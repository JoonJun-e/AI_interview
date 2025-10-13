// --- 사용자 데이터 및 면접 질문 관리 ---
const userData = {};
const questions = [
    { type: 'text', text: '주어진 배열에서 중복된 숫자를 제거하는 함수를 작성하세요. (예: [1, 2, 2, 3] -> [1, 2, 3])' },
    { type: 'video', text: '우리 회사에 지원하게 된 동기는 무엇인가요?' },
    { type: 'video', text: '입사 후 만들고 싶은 성과에 대해 구체적으로 말씀해주세요.' }
];
const userAnswers = [];

// --- HTML 요소 전부 가져오기 ---
const startPage = document.getElementById('start-page');
const guidePage = document.getElementById('guide-page');
const interviewWrapperPage = document.getElementById('interview-wrapper-page');
const loadingPage = document.getElementById('loading-page');
const resultPage = document.getElementById('result-page');
const savingPage = document.getElementById('saving-page');

const startForm = document.getElementById('start-form');
const guideNextBtn = document.getElementById('guide-next-btn');
const conditionSelect = document.getElementById('condition-select');

const checkUI = document.getElementById('check-ui');
const micCheckUI = document.getElementById('mic-check-ui');
const interviewUI = document.getElementById('interview-ui');
const startInterviewBtn = document.getElementById('start-interview-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const webcamInterview = document.getElementById('webcam-interview');
const canvas = document.getElementById('mic-visualizer');
const canvasCtx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');
const resultTextElement = document.getElementById('result-text');
const preparationOverlay = document.getElementById('preparation-overlay');
const toast = document.getElementById('toast');
const textAnswerArea = document.getElementById('text-answer-area');
const videoInterviewContainer = document.getElementById('video-interview-container');
const codingTestContainer = document.getElementById('coding-test-container');
const commonControls = document.getElementById('common-controls');

const preparationQuestion = document.getElementById('preparation-question');
const questionTitlePrep = document.getElementById('question-title-prep');
const preparationTimerDisplay = document.getElementById('preparation-timer-display');
const timerProgress = document.getElementById('timer-progress');
const answerNowBtn = document.getElementById('answer-now-btn');

// --- 상태 변수 ---
let localStream, audioContext, analyser, mediaRecorder;
let recordedChunks = [];
let timerInterval, prepAnimationId;
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

async function setupDevices() {
    if (localStream) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream;
        webcamInterview.srcObject = stream;
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
    const currentQuestion = questions[currentQuestionIndex];
    checkUI.classList.add('hidden');
    micCheckUI.classList.add('hidden');
    interviewUI.classList.remove('hidden');
    commonControls.classList.remove('hidden');
    if (currentQuestion.type === 'text') {
        videoInterviewContainer.classList.add('hidden');
        codingTestContainer.classList.remove('hidden');
        webcamInterview.classList.add('video-small');
        document.body.append(webcamInterview);
        codingTestContainer.querySelector('#question-title-coding').textContent = `AI 질문 ${currentQuestionIndex + 1}/${questions.length}`;
        codingTestContainer.querySelector('#question-text-coding').textContent = currentQuestion.text;
        submitAnswerBtn.disabled = false;
        textAnswerArea.value = '';
    } else {
        videoInterviewContainer.classList.remove('hidden');
        codingTestContainer.classList.add('hidden');
        webcamInterview.classList.remove('video-small');
        videoInterviewContainer.insertBefore(webcamInterview, preparationOverlay);
        questionTitlePrep.textContent = `AI 질문 ${currentQuestionIndex + 1}/${questions.length}`;
        preparationQuestion.textContent = currentQuestion.text;
        videoInterviewContainer.querySelector('#question-title-video').textContent = `AI 질문 ${currentQuestionIndex + 1}/${questions.length}`;
        videoInterviewContainer.querySelector('#question-text-video').textContent = currentQuestion.text;
        submitAnswerBtn.disabled = true;
        runPreparationTimerWithRAF();
    }
}

function runPreparationTimerWithRAF() {
    preparationOverlay.classList.remove('hidden');
    let startTime = null;
    const duration = 10000;
    const radius = timerProgress.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    timerProgress.style.strokeDasharray = circumference;
    timerProgress.style.strokeDashoffset = 0;
    function animationFrame(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        const timeLeft = Math.ceil((duration - elapsed) / 1000);
        preparationTimerDisplay.textContent = timeLeft > 0 ? timeLeft : 0;
        const progress = elapsed / duration;
        const offset = circumference * progress;
        timerProgress.style.strokeDashoffset = offset;
        if (elapsed < duration) {
            prepAnimationId = requestAnimationFrame(animationFrame);
        } else {
            skipPreparation();
        }
    }
    prepAnimationId = requestAnimationFrame(animationFrame);
}

function skipPreparation() {
    cancelAnimationFrame(prepAnimationId);
    preparationOverlay.classList.add('hidden');
    startRecordingAndTimer();
}

function startRecordingAndTimer() {
    const isRecordingStarted = startRecording(localStream);
    if (isRecordingStarted) {
        startTimer(30);
        answerStartTime = Date.now();
        submitAnswerBtn.disabled = true;
    } else {
        showToast("오디오 녹음을 시작할 수 없습니다. 잠시 후 다시 시도해주세요.");
    }
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
        if (elapsedTime >= 30) submitAnswerBtn.disabled = false;
        if (--timeLeft < 0) submitAnswer();
    }, 1000);
}

function startRecording(stream) {
    if (!stream || !stream.active) { showToast("미디어 스트림이 활성화되지 않았습니다."); return false; }
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) { showToast("오디오 트랙을 찾을 수 없습니다."); return false; }
    const audioStream = new MediaStream(audioTracks);
    recordedChunks = [];
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm'];
    const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    if (!supportedMimeType) { showToast("지원되는 오디오 녹음 형식이 없습니다."); return false; }
    try {
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: supportedMimeType });
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.start();
        return true;
    } catch (error) {
        showToast(`녹음 시작 오류: ${error.message}`);
        return false;
    }
}

function stopRecording() {
    return new Promise(resolve => {
        if (!mediaRecorder || mediaRecorder.state === "inactive") { resolve(new Blob(recordedChunks)); return; }
        mediaRecorder.onstop = () => resolve(new Blob(recordedChunks));
        mediaRecorder.stop();
    });
}

// ✅ [수정] '답변 저장 중' 화면을 제거하고 즉시 다음 질문으로 넘어가도록 수정
async function submitAnswer() {
    const currentQuestion = questions[currentQuestionIndex];
    let answerData;
    if (currentQuestion.type === 'text') {
        const textAnswer = textAnswerArea.value;
        answerData = { type: 'text', content: textAnswer };
    } else {
        clearInterval(timerInterval);
        const isTimeout = timerElement.textContent === '00:00';
        const elapsedTime = (Date.now() - answerStartTime) / 1000;
        if (!isTimeout && elapsedTime < 30) {
            showToast("최소 30초 이상 답변해야 합니다.");
            startTimer(30 - Math.floor(elapsedTime));
            return;
        }
        const audioBlob = await stopRecording();
        answerData = { type: 'video', content: audioBlob };
    }
    userAnswers.push(answerData);

    if (currentQuestionIndex >= questions.length - 1) {
        finishInterview();
    } else {
        // 'saving-page'와 setTimeout을 제거하고 바로 다음 단계 실행
        currentQuestionIndex++;
        startNextQuestion();
    }
}

async function finishInterview() {
    showPage('loading-page');
    const choice = userData.testCondition;
    let resultMessage = "";
    switch (choice) {
        case '1': resultMessage = "코딩 테스트 결과: 합격입니다."; break;
        case '2': resultMessage = "코딩 테스트 결과: 아쉽지만 불합격입니다."; break;
        case '3': resultMessage = "AI 면접 평가 결과: 합격입니다. 좋은 결과 기대합니다."; break;
        case '4': resultMessage = "AI 면접 평가 결과: 아쉽지만 다음 기회에 뵙겠습니다."; break;
        default: resultMessage = "오류: 테스트 조건을 선택하지 않았습니다.";
    }
    setTimeout(() => { showFinalResult(resultMessage); }, 1000);
}

function showFinalResult(message) {
    showPage('result-page');
    resultTextElement.textContent = message;
}

// --- 이벤트 리스너 설정 ---
window.addEventListener('load', () => showPage('start-page'));
startForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const userId = document.getElementById('user-id').value;
    const testCondition = conditionSelect.value;
    if (name && userId) {
        userData.name = name;
        userData.id = userId;
        userData.testCondition = testCondition;
        showPage('guide-page');
    } else {
        showToast('모든 정보를 입력해주세요.');
    }
});
guideNextBtn.addEventListener('click', () => {
    showPage('interview-wrapper-page');
    setupDevices();
});
startInterviewBtn.addEventListener('click', startNextQuestion);
submitAnswerBtn.addEventListener('click', submitAnswer);
answerNowBtn.addEventListener('click', skipPreparation);