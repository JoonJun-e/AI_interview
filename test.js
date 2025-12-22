// ===== 테스트 프로젝트 JavaScript =====

// 페이지 요소
const pages = {
    intro: document.getElementById('intro-page'),
    scenario: document.getElementById('scenario-page'),
    video: document.getElementById('video-page'),
    complete: document.getElementById('complete-page')
};

// 버튼 요소
const soundCheckBtn = document.getElementById('sound-check-btn');
const introNextBtn = document.getElementById('intro-next-btn');
const scenarioNextBtn = document.getElementById('scenario-next-btn');

// 오디오/비디오 요소
const testSound = document.getElementById('test-sound');
const testVideo = document.getElementById('test-video');

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
    // 오디오 중지
    if (testSound) {
        testSound.pause();
        testSound.currentTime = 0;
    }
    showPage('scenario');
});

// 시나리오 -> 동영상
scenarioNextBtn.addEventListener('click', () => {
    showPage('video');
    // 동영상 로드 및 자동 재생 시도
    testVideo.load();

    // 로딩 시작 후 3초 동안 데이터가 로드되지 않으면 에러 표시
    const loadTimeout = setTimeout(() => {
        if (testVideo.readyState < 2) { // HAVE_CURRENT_DATA 미만
            console.error('비디오 로딩 타임아웃');
            const errorMsg = document.getElementById('video-error');
            if (errorMsg) errorMsg.style.display = 'block';
        }
    }, 5000);

    testVideo.addEventListener('loadeddata', () => {
        clearTimeout(loadTimeout);
        console.log('비디오 로딩 성공');
        const playPromise = testVideo.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    console.log('비디오 자동 재생 성공');
                })
                .catch(error => {
                    console.log('자동 재생 실패:', error);
                    // 자동 재생 실패 시에도 재생 시도
                    testVideo.play().catch(e => console.error('재생 실패:', e));
                });
        }
    }, { once: true });

    testVideo.addEventListener('error', (e) => {
        clearTimeout(loadTimeout);
        console.error('비디오 로딩 에러:', e);
        const errorMsg = document.getElementById('video-error');
        if (errorMsg) errorMsg.style.display = 'block';
    }, { once: true });
});

// 동영상 종료 -> 완료 페이지
testVideo.addEventListener('ended', () => {
    showPage('complete');
});

// 페이지 로드 시 실험 소개 화면 표시
window.addEventListener('load', () => {
    showPage('intro');
});
