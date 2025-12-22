// ======================= [script.js 코드 시작] =======================

// ======================= [시간 설정] =======================
// ⚠️ 이 부분을 수정하여 면접 시간을 조절할 수 있습니다
const TIME_CONFIG = {
    PREP_TIME: 3,              // 준비 시간 (초)
    MIN_ANSWER_TIME: 30,//30       // 최소 답변 시간 (초)
    ENABLE_MIN_ANSWER_TIME: true,  // ⭐ 최소 답변 시간 제한 활성화 (false로 설정하면 30초 제한 없이 바로 넘어갈 수 있음)
    SAVING_PAGE_DELAY: 1000,//10000  // 저장 페이지 대기 시간 (밀리초) - 10초 (기본값, 자기소개용)
    SAVING_PAGE_DELAY_SHORT: 1000,//5000  // 저장 페이지 대기 시간 (밀리초) - 5초 (코딩/설명 문항용)

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
const uploadedUrls = []; // 업로드된 파일의 URL을 저장
const userCodes = []; // 코딩 문제 답변 코드를 저장
let localStream, audioContext, analyser, mediaRecorder;
let recordedChunks = [];
let timerInterval, prepTimerInterval;
let currentQuestionIndex = 0;
let interviewType = '';
let lastSubmittedCode = "";
let answerStartTime = null;
let isSubmitting = false; // 중복 클릭 방지

// --- URL 파라미터 및 경로 파싱 ---
const urlParams = new URLSearchParams(window.location.search);
let urlType = urlParams.get('type'); // 'soft' or 'hard'
let urlResult = urlParams.get('result'); // 'pass' or 'fail'

// 경로 기반 파싱 (TSOA, TSOR, THOA, THOR)
const pathname = window.location.pathname;
let directPageAccess = null; // 직접 페이지 접근 확인

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
// 동영상 재생 → 결과 페이지 링크 (4개)
else if (pathname === '/VSOA') {
    directPageAccess = 'video';
    interviewType = 'soft';
    userData.testCondition = 'pass';
} else if (pathname === '/VSOR') {
    directPageAccess = 'video';
    interviewType = 'soft';
    userData.testCondition = 'fail';
} else if (pathname === '/VHOA') {
    directPageAccess = 'video';
    interviewType = 'hard';
    userData.testCondition = 'pass';
} else if (pathname === '/VHOR') {
    directPageAccess = 'video';
    interviewType = 'hard';
    userData.testCondition = 'fail';
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
        prepTime: 20,//20
        answerTime: 60//60
    },

    // 코딩 문제 1 (난이도 최하)
    {
        type: 'coding',
        text: `정수 num1, num2를 곱한 결과를 출력하는 프로그램을 만들어보세요.`,
        prepTime: 20,//20
        answerTime: 90//90
    },
    {
        type: 'video',
        text: `방금 작성한 프로그램이 어떤 순서로 동작하는지 설명하세요.
그리고 작성한 코드가 제대로 작동하는지 어떻게 확인할 수 있나요?
`,
        prepTime: 20,//20
        answerTime: 60,//60
        reviewCode: true
    },

    // 코딩 문제 2 (난이도 하)
    {
        type: 'coding',
        text: `if문을 사용해서 세 정수 a, b, c 중 최댓값을 구하는 프로그램을 만들어보세요.`,
        prepTime: 20,//20
        answerTime: 90//90
    },
    {
        type: 'video',
        text: `if문이 어떤 순서로 실행되는지 설명해주세요.

만약 세 숫자가 모두 같다면 어떤 결과가 나올까요?`,
        prepTime: 20,//20
        answerTime: 60,//60
        reviewCode: true
    },

    // 코딩 문제 3 (난이도 중)
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
        prepTime: 20,//20
        answerTime: 90//90
    },
    {
        type: 'video',
        text: `작성하신 solution 함수에서 조건문 구조가 어떻게 동작하는지 설명해주세요.

그리고 코드가 올바르게 동작하는지 검증하기위해 어떻게 하실건지 예시를 들어 설명해주세요.`,
        prepTime: 20,//20
        answerTime: 60,//60
        reviewCode: true
    },

    // 코딩 문제 4 (난이도 상)
    {
        type: 'coding',
        text: `자연수 N이 주어지면, N의 각 자릿수의 합을 구해서 return 하는 solution 함수를 만들어 주세요.
예를들어 N = 123이면 1 + 2 + 3 = 6을 return 하면 됩니다.

제한사항:
- N의 범위 : 100,000,000 이하의 자연수`,
        prepTime: 20,//20
        answerTime: 120//120
    },
    {
        type: 'video',
        text: `작성하신 함수에서 자릿수를 더하는 과정이 어떻게 동작하는지 구체적으로 설명해주세요.

그리고 만약 자릿수의 합이 아니라 자릿수의 곱을 구해야 한다면, 코드를 어떻게 바꾸실건지 설명하시고, 코드가 올바르게 동작하는지 확인하기 위해 어떤 입력값을 테스트할건지 예시를 들어 설명해주세요.`,
        prepTime: 20,//20
        answerTime: 60,//60
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
    // 중복 클릭 방지
    if (isSubmitting) return;
    isSubmitting = true;

    // 최소 답변 시간 제한 체크 (구두 답변 문항 전체 적용)
    if (TIME_CONFIG.ENABLE_MIN_ANSWER_TIME && answerStartTime) {
        const elapsedSeconds = (Date.now() - answerStartTime) / 1000;
        if (elapsedSeconds < TIME_CONFIG.MIN_ANSWER_TIME) {
            const remainingSeconds = Math.ceil(TIME_CONFIG.MIN_ANSWER_TIME - elapsedSeconds);
            showToast(`최소 ${TIME_CONFIG.MIN_ANSWER_TIME}초 이상 답변해주세요. (${remainingSeconds}초 남음)`);
            isSubmitting = false;
            return;
        }
    }

    clearInterval(timerInterval);
    const audioBlob = await stopRecording();
    userAnswers.push(audioBlob);

    // 즉시 업로드
    try {
        const base64Audio = await blobToBase64(audioBlob);
        const fileName = `${Date.now()}-${userData.name?.replace(/\s/g, '') || 'user'}-${uploadedUrls.length + 1}.webm`;
        const uploadResult = await uploadSingleAnswer(base64Audio, fileName);
        uploadedUrls.push(uploadResult.url);
    } catch (error) {
        console.error('업로드 실패:', error);
        alert('답변 저장에 실패했습니다: ' + error.message);
        isSubmitting = false;
        return;
    }

    showSavingAndNext();
}

async function submitCode() {
    // 중복 클릭 방지
    if (isSubmitting) return;
    isSubmitting = true;

    clearInterval(timerInterval);
    const code = codeEditor.value;
    lastSubmittedCode = code;
    const codeBlob = new Blob([code], { type: 'text/plain' });
    userAnswers.push(codeBlob);

    // 코드를 userCodes 배열에 저장 (스프레드시트 저장용)
    userCodes.push(code);

    // 코드는 텍스트이므로 N/A로 저장
    uploadedUrls.push("N/A (코드 답변)");

    showSavingAndNext();
}

function showSavingAndNext() {
    showPage('saving');
    // 자기소개(첫 문항)는 10초, 나머지는 5초
    const isIntro = (currentQuestionIndex === 0);
    const delay = isIntro ? TIME_CONFIG.SAVING_PAGE_DELAY : TIME_CONFIG.SAVING_PAGE_DELAY_SHORT;

    setTimeout(() => {
        currentQuestionIndex++;
        isSubmitting = false; // 다음 질문을 위해 리셋
        startNextQuestion();
    }, delay);
}

async function finishInterview() {
    showPage('saving');
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }

    try {
        // 업로드된 URL 목록과 코드 데이터를 메타데이터로 전송
        await sendMetadataToServer(uploadedUrls, userCodes);
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

// 개별 답변 업로드 함수
async function uploadSingleAnswer(base64Audio, fileName) {
    const payload = { base64Audio, fileName };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60초

    try {
        const response = await fetch('/api/upload-answer', {
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
                const errorText = await response.text();
                errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('업로드 시간 초과');
        }
        throw error;
    }
}

// 메타데이터만 서버에 전송
async function sendMetadataToServer(audioUrls, codes = []) {
    const payload = { userInfo: userData, audioUrls, codes, interviewType };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30초

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
                const errorText = await response.text();
                errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }
        return await response.json();
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error('요청 시간 초과');
        }
        throw error;
    }
}

// 영상 페이지로 이동하고 영상 재생하는 함수
function loadAndPlayVideo() {
    showPage('video');
    // 로딩 메시지 표시
    const loadingMsg = document.getElementById('video-loading-msg');
    const playManual = document.getElementById('video-play-manual');
    loadingMsg.style.display = 'block';
    playManual.style.display = 'none';

    // 동영상 로드
    postInterviewPlayer.load();

    // loadeddata 이벤트 - 충분한 데이터가 로드되면 재생 시도
    postInterviewPlayer.addEventListener('loadeddata', () => {
        loadingMsg.style.display = 'none';
        const playPromise = postInterviewPlayer.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    // 자동 재생 성공
                    console.log('비디오 자동 재생 성공');
                })
                .catch(error => {
                    // 자동 재생 실패 - 음소거 후 재시도
                    console.log('자동 재생 실패, 음소거 후 재시도:', error);
                    postInterviewPlayer.muted = true;
                    postInterviewPlayer.play().catch(e => {
                        console.log('음소거 재생도 실패:', e);
                        // 사용자에게 수동 재생 안내
                        playManual.style.display = 'block';
                    });
                });
        }
    }, { once: true });

    // error 이벤트 - 로딩 실패 시 처리
    postInterviewPlayer.addEventListener('error', (e) => {
        console.error('비디오 로딩 실패:', e);
        loadingMsg.textContent = '영상 로딩에 실패했습니다. 페이지를 새로고침해주세요.';
        loadingMsg.style.color = '#e74c3c';
    }, { once: true });
}

// --- 이벤트 리스너 설정 ---
window.addEventListener('load', () => {
    // 직접 페이지 접근이 설정된 경우
    if (directPageAccess) {
        if (directPageAccess === 'video') {
            // 영상 진입점인 경우 먼저 로그인 페이지 표시
            showPage('userInfo');
        } else {
            // 결과 페이지 직접 접근
            showPage(directPageAccess);
        }
    }
    // URL 파라미터가 있으면 자동으로 설정
    else if (urlType && urlResult) {
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

    // 영상 진입점인 경우 바로 영상 재생
    if (directPageAccess === 'video') {
        loadAndPlayVideo();
    } else if (interviewType === 'soft') {
        showPage('guideSoft');
    } else if (interviewType === 'hard') {
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