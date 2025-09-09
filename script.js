// --- 사용자 데이터 저장 객체 ---
const userData = {};

// --- HTML 요소 전부 가져오기 ---
// 페이지 요소
const irbPage = document.getElementById('irb-page');
const infoPage = document.getElementById('info-page');
const deviceCheckPage = document.getElementById('device-check-page');
const interviewPage = document.getElementById('interview-page');
const loadingPage = document.getElementById('loading-page');
const resultPage = document.getElementById('result-page');

// 버튼 및 폼 요소
const irbCheckbox = document.getElementById('irb-checkbox');
const irbNextBtn = document.getElementById('irb-next-btn');
const infoForm = document.getElementById('info-form');
const startInterviewBtn = document.getElementById('start-interview-btn');
const submitAnswerBtn = document.getElementById('submit-answer-btn');

// 미디어 및 시각화 요소
const webcamCheck = document.getElementById('webcam-check');
const webcamInterview = document.getElementById('webcam-interview');
const canvas = document.getElementById('mic-visualizer');
const canvasCtx = canvas.getContext('2d');
const timerElement = document.getElementById('timer');
const questionTextElement = document.getElementById('question-text');
const resultTextElement = document.getElementById('result-text');

// --- 상태 변수 ---
let localStream; // 사용자의 카메라/마이크 스트림을 저장
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

// 2. 장치 시작 함수 (카메라 + 마이크) - 버그 수정본
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
    startTimer(60);
}

// 5. 타이머 함수
function startTimer(duration) {
    let timeLeft = duration;
    timerInterval = setInterval(() => {
        const minutes = String(Math.floor(timeLeft / 60)).padStart(2, '0');
        const seconds = String(timeLeft % 60).padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
        if (--timeLeft < 0) {
            clearInterval(timerInterval);
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

// 7. 답변 제출 함수 - API 연동 최종본
async function submitAnswer() {
    clearInterval(timerInterval);
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    
    showPage('loading-page');

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        
        try {
            const response = await fetch('/api/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'audio/webm' },
                body: audioBlob
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
            showPage('interview-page');
        }
    };
}

// --- 이벤트 리스너 설정 ---

// 1. 페이지 로드 시 첫 화면 보여주기
window.addEventListener('load', () => {
    showPage('irb-page');
});

// 2. IRB '다음' 버튼
irbNextBtn.addEventListener('click', () => {
    if (irbCheckbox.checked) {
        userData.irb_consented = true;
        showPage('info-page');
    } else {
        alert('연구 참여에 동의해야 다음으로 진행할 수 있습니다.');
    }
});

// 3. 개인정보 '제출' 버튼
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

// 4. 장치 확인 '면접 시작하기' 버튼
startInterviewBtn.addEventListener('click', startInterview);

// 5. '답변 완료 및 제출' 버튼
submitAnswerBtn.addEventListener('click', submitAnswer);