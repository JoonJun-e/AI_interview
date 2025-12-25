// ===== AC (Audio + Company) 컨디션 JavaScript =====

const CONDITION = 'AC'; // 현재 컨디션

// 페이지 요소
const pages = {
    intro: document.getElementById('intro-page'),
    scenario: document.getElementById('scenario-page'),
    video1: document.getElementById('video1-page'),
    response1: document.getElementById('response1-page'),
    video2: document.getElementById('video2-page'),
    response2: document.getElementById('response2-page'),
    complete: document.getElementById('complete-page')
};

// 버튼 요소
const soundCheckBtn = document.getElementById('sound-check-btn');
const introNextBtn = document.getElementById('intro-next-btn');
const scenarioNextBtn = document.getElementById('scenario-next-btn');
const response1SubmitBtn = document.getElementById('response1-submit');
const response2SubmitBtn = document.getElementById('response2-submit');

// 오디오/비디오 요소
const testSound = document.getElementById('test-sound');
const video1 = document.getElementById('video1');
const video2 = document.getElementById('video2');

// 답변 입력 요소
const response1Text = document.getElementById('response1-text');
const response2Text = document.getElementById('response2-text');

// 페이지 전환 함수
function showPage(pageKey) {
    Object.values(pages).forEach(page => {
        if (page) page.classList.add('hidden');
    });
    if (pages[pageKey]) {
        pages[pageKey].classList.remove('hidden');
    }
}

// 소리 확인 버튼
soundCheckBtn.addEventListener('click', () => {
    testSound.currentTime = 0;
    testSound.play().catch(err => {
        console.log('Audio play failed:', err);
        alert('오디오 재생에 실패했습니다. 브라우저 설정을 확인해주세요.');
    });
});

// 실험 소개 -> 시나리오
introNextBtn.addEventListener('click', () => {
    if (testSound) {
        testSound.pause();
        testSound.currentTime = 0;
    }
    showPage('scenario');
});

// 시나리오 -> 동영상 1
scenarioNextBtn.addEventListener('click', () => {
    showPage('video1');
    playVideo(video1);
});

// 동영상 재생 함수
function playVideo(videoElement) {
    videoElement.load();

    const loadTimeout = setTimeout(() => {
        if (videoElement.readyState < 2) {
            console.error('비디오 로딩 타임아웃');
        }
    }, 5000);

    videoElement.addEventListener('loadeddata', () => {
        clearTimeout(loadTimeout);
        console.log('비디오 로딩 성공');
        const playPromise = videoElement.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('비디오 자동 재생 성공');
                })
                .catch(error => {
                    console.log('자동 재생 실패:', error);
                    videoElement.play().catch(e => console.error('재생 실패:', e));
                });
        }
    }, { once: true });

    videoElement.addEventListener('error', (e) => {
        clearTimeout(loadTimeout);
        console.error('비디오 로딩 에러:', e);
    }, { once: true });
}

// 동영상 1 종료 -> 주관식 답변 1
video1.addEventListener('ended', () => {
    showPage('response1');
});

// 주관식 답변 1 제출 -> 동영상 2
response1SubmitBtn.addEventListener('click', async () => {
    const answer = response1Text.value.trim();

    if (!answer) {
        alert('답변을 입력해주세요.');
        return;
    }

    // 버튼 비활성화
    response1SubmitBtn.disabled = true;
    response1SubmitBtn.textContent = '제출 중...';

    try {
        // Google Sheets에 저장
        await saveResponse(CONDITION, 'S1', answer);

        // 다음 페이지로 이동
        showPage('video2');
        playVideo(video2);
    } catch (error) {
        console.error('답변 저장 실패:', error);
        alert('답변 저장에 실패했습니다. 다시 시도해주세요.');
        response1SubmitBtn.disabled = false;
        response1SubmitBtn.textContent = '다음';
    }
});

// 동영상 2 종료 -> 주관식 답변 2
video2.addEventListener('ended', () => {
    showPage('response2');
});

// 주관식 답변 2 제출 -> 완료
response2SubmitBtn.addEventListener('click', async () => {
    const answer = response2Text.value.trim();

    if (!answer) {
        alert('답변을 입력해주세요.');
        return;
    }

    // 버튼 비활성화
    response2SubmitBtn.disabled = true;
    response2SubmitBtn.textContent = '제출 중...';

    try {
        // Google Sheets에 저장
        await saveResponse(CONDITION, 'S2', answer);

        // 완료 페이지로 이동
        showPage('complete');
    } catch (error) {
        console.error('답변 저장 실패:', error);
        alert('답변 저장에 실패했습니다. 다시 시도해주세요.');
        response2SubmitBtn.disabled = false;
        response2SubmitBtn.textContent = '제출';
    }
});

// Google Sheets에 답변 저장하는 함수
async function saveResponse(condition, videoNumber, response) {
    const res = await fetch('/api/save-response', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            condition: condition,
            videoNumber: videoNumber,
            response: response
        })
    });

    if (!res.ok) {
        throw new Error('Failed to save response');
    }

    const data = await res.json();
    console.log('Response saved:', data);
    return data;
}

// 페이지 로드 시 실험 소개 화면 표시
window.addEventListener('load', () => {
    showPage('intro');
});
