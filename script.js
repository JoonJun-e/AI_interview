// ======================= [script.js 코드 시작] =======================

// ======================= [시간 설정] =======================
// ⚠️ 이 부분을 수정하여 면접 시간을 조절할 수 있습니다
const TIME_CONFIG = {
    PREP_TIME: 3,              // 준비 시간 (초)
    MIN_ANSWER_TIME: 30,//30       // 최소 답변 시간 (초)
    ENABLE_MIN_ANSWER_TIME: true,  // ⭐ 최소 답변 시간 제한 활성화 (false로 설정하면 30초 제한 없이 바로 넘어갈 수 있음)
    SAVING_PAGE_DELAY: 10000,  // 저장 페이지 대기 시간 (밀리초) - 10초

    // 답변 시간 설정 (초)
    SELF_INTRO_TIME: 60,       // 자기소개 시간
    SHORT_ANSWER_TIME: 60,     // 짧은 답변 시간
    NORMAL_ANSWER_TIME: 90,    // 일반 답변 시간
    LONG_ANSWER_TIME: 120,     // 긴 답변 시간
};
// ======================= [시간 설정 끝] =======================

// --- 상태 관리 ---
const userData = {};
const userAnswers = [];
let localStream, audioContext, analyser, mediaRecorder;
let recordedChunks = [];
let timerInterval, prepTimerInterval;
let currentQuestionIndex = 0;
let interviewType = '';
let lastSubmittedCode = "";
let answerStartTime = null;

// --- URL 파라미터 및 경로 파싱 ---
const urlParams = new URLSearchParams(window.location.search);
let urlType = urlParams.get('type'); // 'soft' or 'hard'
let urlResult = urlParams.get('result'); // 'pass' or 'fail'

// 경로 기반 파싱 (TSOA, TSOR, THOA, THOR)
const pathname = window.location.pathname;
if (pathname === '/TSOA') {
    urlType = 'soft';
    urlResult = 'pass';
} else if (pathname === '/TSOR') {
    urlType = 'soft';
    urlResult = 'fail';
} else if (pathname === '/THOA') {
    urlType = 'hard';
    urlResult = 'pass';
} else if (pathname === '/THOR') {
    urlType = 'hard';
    urlResult = 'fail';
}

// --- 질문 데이터 (실제 진행용) ---
const softSkillQuestions = [
    {
        type: 'video',
        text: '1분동안 자기 소개를 해주세요.',
        prepTime: 20,//20
        answerTime: 60
    },
    {
        type: 'video',
        text: `당신은 팀 프로젝트에서 중요한 결정을 내려야 하는 상황입니다.

프로젝트 마감 기한은 다가오는데, 두 명의 동료가 서로 다른 의견을 내고 있습니다. 한 명은 새로운 방식을 시도해야 한다고 주장하고, 다른 한 명은 검증된 기존 방식을 고수해야 한다고 합니다.

이 상황에서 팀원들을 어떻게 설득하고, 프로젝트를 어떤 방향으로 이끌어가시겠습니까?

구체적으로 어떤 말을 할지 설명해주세요.`,
        prepTime: 25, //25
        answerTime: 90
    },
    {
        type: 'video',
        text: `프로젝트에서 당신이 내린 결정이 실패했습니다.
반대하던 일부 팀원들이 당신을 비난하고 프로젝트에 지속적으로 참여하기를 거부합니다.

이 상황에서 팀원들에게 어떻게 설명하고, 책임을 지시겠습니까?

당신을 비난하고 참여를 거부하는 팀원들을 어떻게 설득하여 참여를 유도하시겠습니까?

구체적으로 어떤 말을 할지 설명해주세요.`,
        prepTime: 25,//25
        answerTime: 90
    },
    {
        type: 'video',
        text: `한 팀원이 '항상 일이 불공평하게 배분된다'고 회의에서 불만을 강하게 드러냈습니다. 다른 팀원들은 그 상황을 불편해하였고, 분위기는 냉각되었습니다.

당신은 이 상황에서 회의를 어떻게 수습하고, 불만을 제기한 동료와 다른 팀원들의 관계를 어떻게 회복시키겠습니까?

구체적으로 말씀해주세요.`,
        prepTime: 25,//25
        answerTime: 90
    },
    {
        type: 'video',
        text: `언뜻 사태가 마무리된 듯 해 보였으나, 회의 이후에도 팀원들 사이에 감정의 골이 남아있습니다.

팀 전체의 사기를 유지하면서도 불만을 제기한 팀원의 목소리를 존중하려면 어떻게 하면 좋을까요?

갈등이 다시 표면화되지 않도록 어떤 대화나 행동을 통해 관계 회복을 이끌어내실지 구체적으로 말씀해주세요.`,
        prepTime: 25,//25
        answerTime: 90
    },
    {
        type: 'video',
        text: `마케팅 부서에서 사실을 과장한 광고 문구를 쓰자는 제안이 나왔습니다. 이 방식은 매출 증대 효과가 있을 수 있지만, 고객 신뢰를 잃을 위험도 있습니다.

이 회의에서 당신은 마케팅 부서 직원들을 어떻게 설득하겠습니까?

어떻게 말을 할지 구체적으로 설명해주세요.`,
        prepTime: 25,//25
        answerTime: 90
    },
    {
        type: 'video',
        text: `마케팅 부서 직원들은 '다른 회사에서도 다들 그렇게 하니까 조금 과장해도 괜찮다'고 하며 여전히 과장된 문구 사용을 주장합니다.

당신은 회사의 단기 성과와 고객 신뢰 사이에서 균형을 어떻게 잡으시겠습니까?

당신이라면 어떻게 말을 하고, 행동할 것인지 구체적으로 설명해주세요.`,
        prepTime: 25, //25
        answerTime: 90
    },
];

const hardSkillQuestions = [
    {
        type: 'video',
        text: '1분동안 자기 소개를 해주세요.',
        prepTime: 5,
        answerTime: 60
    },

    // 코딩 문제 1
    {
        type: 'coding',
        text: `정수 num1, num2가 매개변수 주어집니다.
num1과 num2를 곱한 값을 return 하도록 solution 함수를 완성해주세요.

제한사항:
- 0 ≤ num1 ≤ 100
- 0 ≤ num2 ≤ 100`,
        prepTime: 5,
        answerTime: 90
    },
    {
        type: 'video',
        text: `방금 작성한 solution 함수에서 각 줄이 어떤 역할을 하는지, 함수의 구조를 설명해주세요.
함수 구조, 매개변수, return 구문을 중심으로 답변해주세요.

그리고 본인의 풀이가 올바른지 어떻게 검증할 수 있나요?
예를 들어 어떤 입력 값을 테스트하고, 그 결과가 어떻게 나와야 하는지 설명해주세요.`,
        prepTime: 5,
        answerTime: 60,
        reviewCode: true
    },

    // 코딩 문제 2
    {
        type: 'coding',
        text: `각에서 0도 초과 90도 미만은 예각, 90도는 직각, 90도 초과 180도 미만은 둔각 180도는 평각으로 분류합니다.
각 angle이 매개변수로 주어질 때 예각일 때 1, 직각일 때 2, 둔각일 때 3, 평각일 때 4를 return하도록 solution 함수를 완성해주세요.

- 예각 : 0 < angle < 90
- 직각 : angle = 90
- 둔각 : 90 < angle < 180
- 평각 : angle = 180

제한사항:
- 0 < angle ≤ 180
- angle은 정수입니다.`,
        prepTime: 5,
        answerTime: 90
    },
    {
        type: 'video',
        text: `작성하신 solution 함수에서 조건문 구조가 어떻게 동작하는지 설명해주세요.

그리고 코드가 올바르게 동작하는지 검증하기위해 어떻게 하실건지 예시를 들어 설명해주세요.`,
        prepTime: 5,
        answerTime: 60,
        reviewCode: true
    },

    // 코딩 문제 3
    {
        type: 'coding',
        text: `자연수 N이 주어지면, N의 각 자릿수의 합을 구해서 return 하는 solution 함수를 만들어 주세요.
예를들어 N = 123이면 1 + 2 + 3 = 6을 return 하면 됩니다.

제한사항:
- N의 범위 : 100,000,000 이하의 자연수`,
        prepTime: 5,
        answerTime: 120
    },
    {
        type: 'video',
        text: `작성하신 함수에서 자릿수를 더하는 과정이 어떻게 동작하는지 구체적으로 설명해주세요.

그리고 만약 자릿수의 합이 아니라 자릿수의 곱을 구해야 한다면, 코드를 어떻게 바꾸실건지 설명하시고, 코드가 올바르게 동작하는지 확인하기 위해 어떤 입력값을 테스트할건지 예시를 들어 설명해주세요.`,
        prepTime: 5,
        answerTime: 60,
        reviewCode: true
    },

    // 코딩 문제 4
    {
        type: 'coding',
        text: `JadenCase란 모든 단어의 첫 문자가 대문자이고, 그 외의 알파벳은 소문자인 문자열입니다.
단, 첫 문자가 알파벳이 아닐 때에는 이어지는 알파벳은 소문자로 쓰면 됩니다. (첫 번째 입출력 예 참고)
문자열 s가 주어졌을 때, s를 JadenCase로 바꾼 문자열을 리턴하는 함수, solution을 완성해주세요.

제한 조건:
- s는 길이 1 이상 200 이하인 문자열입니다.
- s는 알파벳과 숫자, 공백문자(" ")로 이루어져 있습니다.
- 숫자는 단어의 첫 문자로만 나옵니다.
- 숫자로만 이루어진 단어는 없습니다.
- 공백문자가 연속해서 나올 수 있습니다.

입출력 예:
- s: "3people unFollowed me" -> return: "3people Unfollowed Me"
- s: "for the last week" -> return: "For The Last Week"`,
        prepTime: 5,
        answerTime: 120
    },
    {
        type: 'video',
        text: `capitalize( ) 메서드를 쓸 수 있는데, 이 문제에서는 바로 쓰면 왜 안되는지 설명해주세요.

그리고 다국어 문자열(예, 한글, 중국어)이 포함된 경우에는 어떻게 동작할까요?`,
        prepTime: 5,
        answerTime: 60,
        reviewCode: true
    },
];

// --- HTML 요소 캐싱 ---
const pages = {
    start: document.getElementById('start-page'),
    userInfo: document.getElementById('user-info-page'),
    guideSoft: document.getElementById('guide-page-soft'),
    guideHard: document.getElementById('guide-page-hard'),
    deviceCheck: document.getElementById('device-check-page'),
    prep: document.getElementById('prep-page'),
    interview: document.getElementById('interview-page'),
    coding: document.getElementById('coding-page'),
    saving: document.getElementById('saving-page'),
    video: document.getElementById('video-page'),
    resultPass: document.getElementById('result-page-pass'),
    resultFail: document.getElementById('result-page-fail'),
    resultSoftPass: document.getElementById('result-page-pass'),
    resultSoftFail: document.getElementById('result-page-fail'),
    resultHardPass: document.getElementById('result-page-hard-pass'),
    resultHardFail: document.getElementById('result-page-hard-fail'),
    survey: document.getElementById('survey-page'),
};

const startForm = document.getElementById('user-info-form');
const guideNextBtnSoft = document.getElementById('guide-next-btn-soft');
const guideNextBtnHard = document.getElementById('guide-next-btn-hard');
const startInterviewBtn = document.getElementById('start-interview-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');
const submitCodeBtn = document.getElementById('submit-code-btn');

const webcamCheck = document.getElementById('webcam-check');
const webcamInterview = document.getElementById('webcam-interview');
const webcamCoding = document.getElementById('webcam-coding');
const micVisualizer = document.getElementById('mic-visualizer');
const prepQuestion = document.getElementById('prep-question');
const prepTimerText = document.getElementById('prep-timer-text').querySelector('span');
const interviewTimerDisplay = document.getElementById('interview-timer-display');
const interviewQuestionBar = document.getElementById('interview-question-bar');
const codingTimerDisplay = document.getElementById('coding-timer-display');
const codingQuestionTitle = document.getElementById('coding-question-title');
const codingQuestionText = document.getElementById('coding-question-text');
const codeEditor = document.getElementById('code-editor');
const postInterviewPlayer = document.getElementById('post-interview-player');
const codeReviewArea = document.getElementById('code-review-area');
const reviewedCode = document.getElementById('reviewed-code');
const toast = document.getElementById('toast');

// --- 페이지 전환 ---
function showPage(pageId) {
    Object.values(pages).forEach(page => { if (page) page.classList.add('hidden'); });
    if (pages[pageId]) pages[pageId].classList.remove('hidden');

    // 안내 페이지 진입 시 오디오 자동 재생
    if (pageId === 'guideSoft') {
        const softAudio = document.getElementById('soft-intro-audio');
        if (softAudio) {
            softAudio.currentTime = 0;
            softAudio.play().catch(err => console.log('Audio play failed:', err));
        }
    } else if (pageId === 'guideHard') {
        const hardAudio = document.getElementById('hard-intro-audio');
        if (hardAudio) {
            hardAudio.currentTime = 0;
            hardAudio.play().catch(err => console.log('Audio play failed:', err));
        }
    }

    // start 페이지로 이동시 모든 오디오 중지
    if (pageId === 'start') {
        const softAudio = document.getElementById('soft-intro-audio');
        const hardAudio = document.getElementById('hard-intro-audio');
        const explainAudio = document.getElementById('explain-audio');
        if (softAudio) softAudio.pause();
        if (hardAudio) hardAudio.pause();
        if (explainAudio) explainAudio.pause();
    }

    // deviceCheck 페이지 진입 시 오디오 자동 재생
    if (pageId === 'deviceCheck' && interviewType === 'soft') {
        const explainAudio = document.getElementById('explain-audio');
        if (explainAudio) {
            explainAudio.currentTime = 0;
            explainAudio.play().catch(err => console.log('Audio play failed:', err));
        }
    }
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
        canvasCtx.fillStyle = '#fff';
        canvasCtx.fillRect(0, 0, micVisualizer.width, micVisualizer.height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = '#4a90e2';
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
    const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
    const supportedMimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
    if (!supportedMimeType) { alert("지원되는 오디오 녹음 형식이 없습니다."); return false; }
    try {
        mediaRecorder = new MediaRecorder(audioStream, { mimeType: supportedMimeType });
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
        if (!mediaRecorder || mediaRecorder.state === "inactive") { resolve(new Blob(recordedChunks, { type: 'audio/webm' })); return; }
        mediaRecorder.onstop = () => resolve(new Blob(recordedChunks, { type: 'audio/webm' }));
        mediaRecorder.stop();
    });
}

// --- 면접 흐름 제어 ---
function startNextQuestion() {
    // deviceCheck 페이지의 오디오 멈추기
    const explainAudio = document.getElementById('explain-audio');
    if (explainAudio) explainAudio.pause();

    const questions = (interviewType === 'hard') ? hardSkillQuestions : softSkillQuestions;
    if (currentQuestionIndex >= questions.length) {
        finishInterview();
        return;
    }
    const question = questions[currentQuestionIndex];

    webcamInterview.classList.remove('video-small');

    if (question.type === 'video') {
        showPage('prep');
        prepQuestion.textContent = question.text;
        let prepTimeLeft = question.prepTime;
        prepTimerText.textContent = `${prepTimeLeft}초 뒤`;
        
        if (question.reviewCode && lastSubmittedCode) {
            codeReviewArea.classList.add('visible');
            reviewedCode.textContent = lastSubmittedCode;
        } else {
            codeReviewArea.classList.remove('visible');
        }

        clearInterval(prepTimerInterval);
        prepTimerInterval = setInterval(() => {
            prepTimeLeft--;
            prepTimerText.textContent = `${prepTimeLeft}초 뒤`;
            if (prepTimeLeft <= 0) {
                clearInterval(prepTimerInterval);
                startAnswer();
            }
        }, 1000);
    } else if (question.type === 'coding') {
        showPage('coding');
        webcamCoding.srcObject = localStream;

        let questionNum = 0;
        for(let i=0; i<=currentQuestionIndex; i++) { if(questions[i].type === 'coding') questionNum++; }
        codingQuestionTitle.textContent = `코딩 테스트 ${questionNum}`;
        codingQuestionText.textContent = question.text;
        codeEditor.value = '';

        let answerTimeLeft = question.answerTime;
        const updateTimer = () => {
            const minutes = String(Math.floor(answerTimeLeft / 60)).padStart(2, '0');
            const seconds = String(answerTimeLeft % 60).padStart(2, '0');
            codingTimerDisplay.textContent = `${minutes}:${seconds}`;
            answerTimeLeft--;
            if (answerTimeLeft < 0) {
                submitCode();
            }
        };
        clearInterval(timerInterval);
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    }
}

function startAnswer() {
    const questions = (interviewType === 'hard') ? hardSkillQuestions : softSkillQuestions;
    const question = questions[currentQuestionIndex];
    showPage('interview');
    interviewQuestionBar.textContent = question.text;
    webcamInterview.srcObject = localStream;
    if (question.reviewCode && lastSubmittedCode) {
        codeReviewArea.classList.add('visible');
        reviewedCode.textContent = lastSubmittedCode;
    } else {
        codeReviewArea.classList.remove('visible');
    }
    if (!startRecording(localStream)) return;

    // 답변 시작 시간 기록
    answerStartTime = Date.now();

    let answerTimeLeft = question.answerTime;
    const updateTimer = () => {
        const minutes = String(Math.floor(answerTimeLeft / 60)).padStart(2, '0');
        const seconds = String(answerTimeLeft % 60).padStart(2, '0');
        interviewTimerDisplay.textContent = `${minutes}:${seconds}`;
        answerTimeLeft--;
        if (answerTimeLeft < 0) {
            submitAnswer();
        }
    };
    clearInterval(timerInterval);
    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
}

async function submitAnswer() {
    // 최소 답변 시간 제한 체크 (구두 답변 문항 전체 적용)
    if (TIME_CONFIG.ENABLE_MIN_ANSWER_TIME && answerStartTime) {
        const elapsedSeconds = (Date.now() - answerStartTime) / 1000;
        if (elapsedSeconds < TIME_CONFIG.MIN_ANSWER_TIME) {
            const remainingSeconds = Math.ceil(TIME_CONFIG.MIN_ANSWER_TIME - elapsedSeconds);
            showToast(`최소 ${TIME_CONFIG.MIN_ANSWER_TIME}초 이상 답변해주세요. (${remainingSeconds}초 남음)`);
            return;
        }
    }

    clearInterval(timerInterval);
    const audioBlob = await stopRecording();
    userAnswers.push(audioBlob);
    showSavingAndNext();
}

function submitCode() {
    clearInterval(timerInterval);
    const code = codeEditor.value;
    lastSubmittedCode = code;
    const codeBlob = new Blob([code], { type: 'text/plain' });
    userAnswers.push(codeBlob);
    showSavingAndNext();
}

function showSavingAndNext() {
    showPage('saving');
    setTimeout(() => {
        currentQuestionIndex++;
        startNextQuestion();
    }, TIME_CONFIG.SAVING_PAGE_DELAY);
}

async function finishInterview() {
    showPage('saving');
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    const answersPayload = await Promise.all(
        userAnswers.map(blob => blobToBase64(blob))
    );
    try {
        await sendDataToServer(answersPayload);
        showPage('video');
        postInterviewPlayer.load();
        postInterviewPlayer.play().catch(() => {
            postInterviewPlayer.muted = true;
            postInterviewPlayer.play();
        });
    } catch (error) {
        alert("데이터 저장에 실패했습니다: " + error.message);
        window.location.reload();
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

async function sendDataToServer(answersPayload) {
    const payload = { userInfo: userData, answers: answersPayload, interviewType: interviewType };

    // 타임아웃 설정 (5분)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    try {
        const response = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMessage = 'API 호출 실패';
            try {
                const errorData = await response.json();
                errorMessage = errorData.details || errorData.error || errorMessage;
            } catch (e) {
                // JSON 파싱 실패시 텍스트로 읽기
                const errorText = await response.text();
                errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('요청 시간 초과: 서버 응답이 너무 오래 걸립니다.');
        }
        throw error;
    }
}

// --- 이벤트 리스너 설정 ---
window.addEventListener('load', () => {
    // URL 파라미터가 있으면 자동으로 설정
    if (urlType && urlResult) {
        interviewType = urlType; // 'soft' or 'hard'
        userData.testCondition = urlResult; // 'pass' or 'fail'
        showPage('userInfo');
    } else {
        showPage('start');
    }
});

document.getElementById('soft-pass-btn').addEventListener('click', () => {
    interviewType = 'soft';
    userData.testCondition = 'pass';
    showPage('userInfo');
});

document.getElementById('soft-fail-btn').addEventListener('click', () => {
    interviewType = 'soft';
    userData.testCondition = 'fail';
    showPage('userInfo');
});

document.getElementById('hard-pass-btn').addEventListener('click', () => {
    interviewType = 'hard';
    userData.testCondition = 'pass';
    showPage('userInfo');
});

document.getElementById('hard-fail-btn').addEventListener('click', () => {
    interviewType = 'hard';
    userData.testCondition = 'fail';
    showPage('userInfo');
});

startForm.addEventListener('submit', e => {
    e.preventDefault();
    userData.name = document.getElementById('name').value;
    userData.id = document.getElementById('user-id').value;
    // URL 파라미터로 이미 설정되지 않은 경우에만 기본값 설정
    if (!userData.testCondition) {
        userData.testCondition = 'pass'; // 기본값
    }
    if (interviewType === 'soft') {
        showPage('guideSoft');
    } else {
        showPage('guideHard');
    }
});

guideNextBtnSoft.addEventListener('click', () => {
    const softAudio = document.getElementById('soft-intro-audio');
    if (softAudio) softAudio.pause();
    showPage('deviceCheck');
    setTimeout(setupDevices, 100);
});

guideNextBtnHard.addEventListener('click', () => {
    const hardAudio = document.getElementById('hard-intro-audio');
    if (hardAudio) hardAudio.pause();
    showPage('deviceCheck');
    setTimeout(setupDevices, 100);
});

startInterviewBtn.addEventListener('click', startNextQuestion);
submitAnswerBtn.addEventListener('click', submitAnswer);
submitCodeBtn.addEventListener('click', submitCode);

postInterviewPlayer.addEventListener('ended', () => {
    const condition = userData.testCondition;
    if (interviewType === 'soft') {
        if (condition === 'pass') showPage('resultSoftPass');
        else showPage('resultSoftFail');
    } else {
        if (condition === 'pass') showPage('resultHardPass');
        else showPage('resultHardFail');
    }
});

// 결과 페이지의 "다음" 버튼 이벤트 리스너
document.getElementById('soft-pass-next-btn').addEventListener('click', () => {
    showPage('survey');
});

document.getElementById('soft-fail-next-btn').addEventListener('click', () => {
    showPage('survey');
});

document.getElementById('hard-pass-next-btn').addEventListener('click', () => {
    showPage('survey');
});

document.getElementById('hard-fail-next-btn').addEventListener('click', () => {
    showPage('survey');
});
// ======================= [script.js 코드 끝] =======================