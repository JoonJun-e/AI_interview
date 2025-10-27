// ======================= [script.js 코드 시작] =======================
// --- 상태 관리 ---
const userData = {};
const userAnswers = [];
let localStream, audioContext, analyser, mediaRecorder;
let recordedChunks = [];
let timerInterval, prepTimerInterval;
let currentQuestionIndex = 0;

// --- 질문 데이터 ---
const questions = [
    { text: '1분동안 자기 소개를 해주세요.', prepTime: 3, answerTime: 60 },
    { text: '당신은 팀 프로젝트에서 중요한 결정을 내려야 하는 상황입니다. 프로젝트 마감 기한은 다가오는데, 두 명의 동료가 서로 다른 의견을 내고 있습니다. 한 명은 새로운 방식을 시도해야 한다고 주장하고, 다른 한 명은 검증된 기존 방식을 고수해야 한다고 합니다. 이 상황에서 팀원들을 어떻게 설득하고, 프로젝트를 어떤 방향으로 이끌어가시겠습니까? 구체적으로 어떤 말을 할지 설명해주세요.', prepTime: 3, answerTime: 90 },
    { text: '프로젝트에서 당신이 내린 결정이 실패했습니다. 반대하던 일부 팀원들이 당신을 비난하고 프로젝트에 지속적으로 참여하기를 거부합니다. 이 상황에서 팀원들에게 어떻게 설명하고, 책임을 지시겠습니까? 당신을 비난하고 참여를 거부하는 팀원들을 어떻게 설득하여 참여를 유도하시겠습니까? 구체적으로 어떤 말을 할지 설명해주세요.', prepTime: 3, answerTime: 90 },
    { text: '한 팀원이 ‘항상 일이 불공평하게 배분된다’고 회의에서 불만을 강하게 드러냈습니다. 다른 팀원들은 그 상황을 불편해하였고, 분위기는 냉각되었습니다. 당신은 이 상황에서 회의를 어떻게 수습하고, 불만을 제기한 동료와 다른 팀원들의 관계를 어떻게 회복시키겠습니까? 구체적으로 말씀해주세요.', prepTime: 3, answerTime: 90 },
    { text: '언뜻 사태가 마무리된 듯 해 보였으나, 회의 이후에도 팀원들 사이에 감정의 골이 남아있습니다. 팀 전체의 사기를 유지하면서도 불만을 제기한 팀원의 목소리를 존중하려면 어떻게 하면 좋을까요? 갈등이 다시 표면화되지 않도록 어떤 대화나 행동을 통해 관계 회복을 이끌어내실지 구체적으로 말씀해주세요.', prepTime: 3, answerTime: 90 },
    { text: '마케팅 부서에서 사실을 과장한 광고 문구를 쓰자는 제안이 나왔습니다. 이 방식은 매출 증대 효과가 있을 수 있지만, 고객 신뢰를 잃을 위험도 있습니다. 이 회의에서 당신은 마케팅 부서 직원들을 어떻게 설득하겠습니까? 어떻게 말을 할지 구체적으로 설명해주세요.', prepTime: 3, answerTime: 90 },
    { text: '마케팅 부서 직원들은 ‘다른 회사에서도 다들 그렇게 하니까 조금 과장해도 괜찮다’고 하며 여전히 과장된 문구 사용을 주장합니다. 당신은 회사의 단기 성과와 고객 신뢰 사이에서 균형을 어떻게 잡으시겠습니까? 당신이라면 어떻게 말을 하고, 행동할 것인지 구체적으로 설명해주세요.', prepTime: 3, answerTime: 90 },
];

// --- HTML 요소 캐싱 ---
const pages = {
    start: document.getElementById('start-page'),
    guide: document.getElementById('guide-page'),
    deviceCheck: document.getElementById('device-check-page'),
    prep: document.getElementById('prep-page'),
    interview: document.getElementById('interview-page'),
    saving: document.getElementById('saving-page'),
    resultPass: document.getElementById('result-page-pass'),
    resultFail: document.getElementById('result-page-fail'),
};

const startForm = document.getElementById('start-form');
const guideNextBtn = document.getElementById('guide-next-btn');
const startInterviewBtn = document.getElementById('start-interview-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const conditionSelect = document.getElementById('condition-select');

const webcamCheck = document.getElementById('webcam-check');
const webcamInterview = document.getElementById('webcam-interview');
const micVisualizer = document.getElementById('mic-visualizer');
const prepQuestion = document.getElementById('prep-question');
const prepTimerText = document.getElementById('prep-timer-text').querySelector('span');
const interviewTimerDisplay = document.getElementById('interview-timer-display');
const interviewQuestionBar = document.getElementById('interview-question-bar');

// --- 페이지 전환 ---
function showPage(pageId) {
    Object.values(pages).forEach(page => page.classList.add('hidden'));
    pages[pageId].classList.remove('hidden');
}

// --- 마이크 시각화 ---
function visualizeMic() {
    if (!localStream || !audioContext) return;
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(localStream);
    source.connect(analyser);
    const canvasCtx = micVisualizer.getContext('2d');
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = '#f0f0f0';
        canvasCtx.fillRect(0, 0, micVisualizer.width, micVisualizer.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#333';
        canvasCtx.beginPath();
        const sliceWidth = micVisualizer.width * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = v * micVisualizer.height / 2;
            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
            x += sliceWidth;
        }
        canvasCtx.lineTo(micVisualizer.width, micVisualizer.height / 2);
        canvasCtx.stroke();
    };
    draw();
}

// --- 장치 설정 ---
async function setupDevices() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream;
        webcamCheck.srcObject = stream;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        if (audioContext.state === 'suspended') await audioContext.resume();
        visualizeMic();
    } catch (err) {
        alert("카메라/마이크 활성화에 실패했습니다: " + err.message);
    }
}

// --- 녹음 로직 ---
function startRecording(stream) {
    if (!stream || !stream.active) return false;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return false;
    const audioStream = new MediaStream(audioTracks);
    recordedChunks = [];
    try {
        mediaRecorder = new MediaRecorder(audioStream);
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.start();
        return true;
    } catch (error) {
        console.error("녹음 시작 오류:", error);
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

// --- 면접 흐름 제어 ---
function startNextQuestion() {
    if (currentQuestionIndex >= questions.length) {
        finishInterview();
        return;
    }
    const question = questions[currentQuestionIndex];
    showPage('prep');
    prepQuestion.textContent = question.text;
    let prepTimeLeft = question.prepTime;
    prepTimerText.textContent = `${prepTimeLeft}초 뒤`;
    clearInterval(prepTimerInterval);
    prepTimerInterval = setInterval(() => {
        prepTimeLeft--;
        prepTimerText.textContent = `${prepTimeLeft}초 뒤`;
        if (prepTimeLeft <= 0) {
            clearInterval(prepTimerInterval);
            startAnswer();
        }
    }, 1000);
}

function startAnswer() {
    const question = questions[currentQuestionIndex];
    showPage('interview');
    interviewQuestionBar.textContent = question.text;
    webcamInterview.srcObject = localStream;
    if (!startRecording(localStream)) {
        alert("녹음을 시작할 수 없습니다.");
        return;
    }
    let answerTimeLeft = question.answerTime;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
        const minutes = String(Math.floor(answerTimeLeft / 60)).padStart(2, '0');
        const seconds = String(answerTimeLeft % 60).padStart(2, '0');
        interviewTimerDisplay.textContent = `${minutes}:${seconds}`;
        answerTimeLeft--;
        if (answerTimeLeft < 0) {
            submitAnswer();
        }
    }, 1000);
}

async function submitAnswer() {
    clearInterval(timerInterval);
    const audioBlob = await stopRecording();
    userAnswers.push(audioBlob);
    showPage('saving');
    setTimeout(() => {
        currentQuestionIndex++;
        startNextQuestion();
    }, 2500);
}

// ✅ [수정] 서버 저장 기능이 복구된 finishInterview 함수
async function finishInterview() {
    showPage('saving');
    
    const answersPayload = await Promise.all(
        userAnswers.map(blob => blobToBase64(blob))
    );
    
    try {
        await sendDataToServer(answersPayload);
        
        const condition = userData.testCondition;
        if (condition === 'pass') {
            showPage('resultPass');
        } else {
            showPage('resultFail');
        }

    } catch (error) {
        alert("데이터 저장에 실패했습니다: " + error.message);
        showPage('deviceCheck');
    }
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

// ✅ [수정] 서버에 데이터를 보내고 응답을 처리하는 함수
async function sendDataToServer(answersPayload) {
    const payload = { userInfo: userData, answers: answersPayload };
    const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'API 호출에 실패했습니다.');
    }
    
    return await response.json();
}

// --- 이벤트 리스너 설정 ---
window.addEventListener('load', () => {
    showPage('start');
});
startForm.addEventListener('submit', e => {
    e.preventDefault();
    userData.name = document.getElementById('name').value;
    userData.id = document.getElementById('user-id').value;
    userData.testCondition = conditionSelect.value;
    showPage('guide');
});
guideNextBtn.addEventListener('click', () => {
    showPage('deviceCheck');
    setTimeout(setupDevices, 100);
});
startInterviewBtn.addEventListener('click', startNextQuestion);
submitAnswerBtn.addEventListener('click', submitAnswer);
// ======================= [script.js 코드 끝] =======================