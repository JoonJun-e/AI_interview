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

// 2. 장치 시작 함수 (카메라 + 마이크)
async function startDevices() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream = stream; // 스트림 저장
        webcamCheck.srcObject = stream;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audio-context.createAnalyser();
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
    webcamInterview.srcObject = localStream; // 장치확인에서 켠 스트림 재사용
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
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) recordedChunks.push(event.data);
    };
    mediaRecorder.start();
}

// 7. 답변 제출 함수
function submitAnswer() {
    clearInterval(timerInterval);
    if (mediaRecorder && mediaRecorder.state !== "inactive") mediaRecorder.stop();
    
    showPage('loading-page');

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        console.log("녹음 완료! Blob:", audioBlob);
        
        // 가짜 로딩 및 결과 표시
        setTimeout(() => {
            showPage('result-page');
            resultTextElement.textContent = "결과: 합격";
        }, 2000);
    };
}

// --- 이벤트 리스너 설정 ---

// 1. 페이지 로드 시
window.addEventListener('load', () => showPage('irb-page'));

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

// 7. 답변 제출 함수
async function submitAnswer() {
    clearInterval(timerInterval);
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
        mediaRecorder.stop();
    }
    
    showPage('loading-page');

    mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(recordedChunks, { type: 'audio/webm' });
        
        try {
            // 2단계에서 만든 우리 API 주소('/api/evaluate')로 녹음 파일을 보냅니다.
            const response = await fetch('/api/evaluate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'audio/webm' // 파일 타입을 명시
                },
                body: audioBlob // Blob을 직접 body에 실어 보냅니다.
            });

            if (!response.ok) {
                // 서버에서 에러가 발생했을 때
                const errorData = await response.json();
                throw new Error(errorData.error || 'API 호출에 실패했습니다.');
            }

            const data = await response.json();
            
            // AI가 보내준 실제 결과로 화면을 업데이트합니다.
            showPage('result-page');
            resultTextElement.textContent = `결과: ${data.result}`;

        } catch (error) {
            console.error('Error submitting answer:', error);
            alert('오류가 발생했습니다: ' + error.message);
            showPage('interview-page'); // 오류 발생 시 면접 페이지로 복귀
        }
    };
}