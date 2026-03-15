// Firebase 모듈 import
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import { getDatabase, ref as dbRef, set as dbSet, get as dbGet } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js';

// 전역 변수
let db, ref, set, get;
let isAdmin = false;
let currentBusList = [];
let draggedItem = null;
let adminLoginBtn, adminModal, adminLoginOk;

// ============================================
// Firebase 초기화
// ============================================
async function initFirebase() {
  try {
    const firebaseConfig = {
      apiKey: "AIzaSyAcaIcwlhwAOgKPD5BKD3mAuXiAqLKHTu4",
      databaseURL: "https://parking22-886c6-default-rtdb.asia-southeast1.firebasedatabase.app"
    };

    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    ref = dbRef;
    set = dbSet;
    get = dbGet;

    console.log('Firebase 초기화 완료');
  } catch (err) {
    console.error("Firebase 초기화 실패:", err);
  }
}

// ============================================
// 팀 계산 (2026-03-14 기준)
// ============================================
function getTeamByDate(dateStr) {
  const baseDate = new Date("2026-03-14");
  const targetDate = new Date(dateStr);

  const diff = Math.floor((targetDate - baseDate) / (1000 * 60 * 60 * 24));

  if (diff % 2 === 0) {
    return "🔴 B TEAM";
  } else {
    return "🔵 A TEAM";
  }
}

// ============================================
// 날짜 포맷팅
// ============================================
function formatDateDisplay(dateStr) {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekDay = weekDays[date.getDay()];
  
  return `📅 ${year}-${month}-${day} (${weekDay})`;
}

// ============================================
// Firebase에서 busList 로드
// ============================================
async function loadBusListFromDB() {
  try {
    console.log('busList 로드 시작...');
    const snapshot = await get(ref(db, 'busList'));
    console.log('Firebase snapshot:', snapshot);
    console.log('snapshot.exists():', snapshot.exists());
    
    if (snapshot.exists()) {
      currentBusList = snapshot.val() || [];
      console.log('Firebase에서 로드된 busList:', currentBusList);
      if (!Array.isArray(currentBusList)) {
        currentBusList = Object.values(currentBusList);
        console.log('객체를 배열로 변환:', currentBusList);
      }
    } else {
      console.log('Firebase에 busList가 없음. 기본값 사용');
      currentBusList = ["714","750","751","752","753","754","755","756","757","768","769","770","771","776","778","780","785"];
    }
    console.log('최종 busList:', currentBusList);
    return currentBusList;
  } catch (err) {
    console.error("busList 로드 실패:", err);
    console.error("에러 메시지:", err.message);
    console.error("에러 코드:", err.code);
    currentBusList = ["714","750","751","752","753","754","755","756","757","768","769","770","771","776","778","780","785"];
    return currentBusList;
  }
}

// ============================================
// busList를 Firebase에 저장
// ============================================
async function saveBusListToDB() {
  try {
    await set(ref(db, 'busList'), currentBusList);
  } catch (err) {
    console.error("busList 저장 실패:", err);
  }
}

// ============================================
// 차량 목록 렌더링
// ============================================
function renderVehicleList() {
  const container = document.getElementById('vehicleListContainer');
  container.innerHTML = '';
  
  currentBusList.forEach((bus, index) => {
    const item = document.createElement('div');
    item.className = 'vehicle-item';
    item.draggable = true;
    item.dataset.index = index;
    
    item.innerHTML = `
      <div class="vehicle-item-content">
        <span class="vehicle-item-drag-handle">⋮⋮</span>
        <span class="vehicle-item-number">${bus}</span>
      </div>
      <button class="vehicle-item-delete">-</button>
    `;
    
    const deleteBtn = item.querySelector('.vehicle-item-delete');
    deleteBtn.addEventListener('click', () => {
      const busNumber = currentBusList[index];
      const confirmDelete = confirm(`${busNumber} 차량번호를 정말로 삭제하시겠습니까?`);

      if (!confirmDelete) return;

      currentBusList.splice(index, 1);
      saveBusListToDB();
      renderVehicleList();
      refreshOptions(document.querySelectorAll('.cell select'));
    });
    
    item.addEventListener('dragstart', (e) => {
      draggedItem = item;
      item.classList.add('dragging');
    });
    
    item.addEventListener('dragend', () => {
      item.classList.remove('dragging');
    });
    
    item.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (draggedItem && draggedItem !== item) {
        const allItems = Array.from(container.querySelectorAll('.vehicle-item'));
        const draggedIndex = allItems.indexOf(draggedItem);
        const targetIndex = allItems.indexOf(item);
        
        if (draggedIndex < targetIndex) {
          item.parentNode.insertBefore(draggedItem, item.nextSibling);
        } else {
          item.parentNode.insertBefore(draggedItem, item);
        }
      }
    });
    
    item.addEventListener('drop', (e) => {
      e.preventDefault();
    });
    
    container.appendChild(item);
  });
  
  container.addEventListener('dragend', () => {
    const items = Array.from(container.querySelectorAll('.vehicle-item'));
    const newOrder = items.map(item => currentBusList[item.dataset.index]);
    currentBusList = newOrder;
    saveBusListToDB();
  });
}

// ============================================
// Select 옵션 새로고침
// ============================================
function refreshOptions(selects) {
  const selected = [...selects].map(s => s.value).filter(v => v);
  selects.forEach(select => {
    const current = select.value;
    select.innerHTML = '<option value=""></option>';
    currentBusList.forEach(num => {
      if (!selected.includes(num) || num === current) {
        const opt = document.createElement('option');
        opt.value = num;
        opt.textContent = num;
        if (num === current) opt.selected = true;
        select.appendChild(opt);
      }
    });
  });
}

// ============================================
// 데이터 로드
// ============================================
async function loadData(date) {
  if (!date) return;
  
  const selects = document.querySelectorAll('.cell select');
  const cells = document.querySelectorAll('.cell');
  const wrappers = document.querySelectorAll('.cells-wrapper');
  
  selects.forEach(s => {
    s.innerHTML = '<option value=""></option>';
    currentBusList.forEach(num => {
      const opt = document.createElement('option');
      opt.value = num;
      opt.textContent = num;
      s.appendChild(opt);
    });
    s.value = "";
  });
  cells.forEach(c => c.classList.remove("active"));
  wrappers.forEach(w => w.style.transform = "translateX(0px)");

  const snapshot = await get(ref(db, 'parking/' + date));
  const data = snapshot.val();
  console.log('로드된 parking 데이터:', data);
  
  if (data) {
    const valuesArray = data.values ? Object.values(data.values) : [];
    console.log('변환된 values 배열:', valuesArray);
    selects.forEach((s, i) => {
      s.value = valuesArray[i] || "";
    });
    cells.forEach((c, i) => c.classList.toggle("active", data.active?.[i]));
    wrappers.forEach((w, i) => w.style.transform = `translateX(${data.drag?.[i] || 0}px)`);
  }
  refreshOptions(selects);
}

// ============================================
// 데이터 저장
// ============================================
function saveData() {
  if (!isAdmin) return;
  
  const datePicker = document.getElementById('datePicker');
  const date = datePicker.value;
  if (!date) return;
  
  const selects = document.querySelectorAll('.cell select');
  const cells = document.querySelectorAll('.cell');
  const wrappers = document.querySelectorAll('.cells-wrapper');
  
  const values = {}, active = {}, drag = {};
  selects.forEach((s, i) => values[i] = s.value);
  cells.forEach((c, i) => active[i] = c.classList.contains("active"));
  wrappers.forEach((w, i) => {
    const m = w.style.transform.match(/-?\d+/);
    drag[i] = m ? parseInt(m[0]) : 0;
  });
  set(ref(db, 'parking/' + date), { values, active, drag });
}

// ============================================
// 게시판 로드
// ============================================
async function loadBulletinPosts() {
  try {
    const snapshot = await get(ref(db, 'bulletin/posts'));
    const bulletinPosts = document.getElementById('bulletinPosts');
    bulletinPosts.innerHTML = '';
    
    if (snapshot.exists()) {
      const posts = snapshot.val();
      const postsArray = Array.isArray(posts) ? posts : Object.values(posts);
      
      postsArray.reverse().forEach((post, index) => {
        if (post) {
          const postEl = document.createElement('div');
          postEl.className = 'bulletin-post';
          const time = new Date(post.time).toLocaleTimeString('ko-KR');
          
          postEl.innerHTML = `
            <div class="bulletin-post-content">${post.text}</div>
            <div class="bulletin-post-time">${time}</div>
            <div class="bulletin-post-actions">
              <button class="bulletin-post-action-btn edit" data-index="${index}">수정</button>
              <button class="bulletin-post-action-btn delete" data-index="${index}">삭제</button>
            </div>
          `;
          
          bulletinPosts.appendChild(postEl);
          
          // 답글 컨테이너
          const repliesContainer = document.createElement('div');
          repliesContainer.className = 'bulletin-replies-container';
          repliesContainer.id = `replies-${index}`;
          
          if (post.replies && Array.isArray(post.replies)) {
            post.replies.forEach((reply, replyIndex) => {
              const replyEl = document.createElement('div');
              replyEl.className = 'bulletin-reply';
              const replyTime = new Date(reply.time).toLocaleTimeString('ko-KR');
              
              replyEl.innerHTML = `
                <div class="bulletin-reply-content">${reply.text}</div>
                <div class="bulletin-reply-time">${replyTime}</div>
                <div class="bulletin-reply-actions">
                  <button class="bulletin-reply-action-btn edit" data-post-index="${index}" data-reply-index="${replyIndex}">수정</button>
                  <button class="bulletin-reply-action-btn delete" data-post-index="${index}" data-reply-index="${replyIndex}">삭제</button>
                </div>
              `;
              
              repliesContainer.appendChild(replyEl);
            });
          }
          
          // 답글 입력 폼
          const replyInputEl = document.createElement('div');
          replyInputEl.className = 'bulletin-reply-input';
          replyInputEl.innerHTML = `
            <input type="text" class="bulletin-reply-text" placeholder="답글 입력..." data-post-index="${index}">
            <button class="bulletin-reply-submit" data-post-index="${index}">작성</button>
          `;
          
          repliesContainer.appendChild(replyInputEl);
          bulletinPosts.appendChild(repliesContainer);
        }
      });
      
      // 게시글 수정/삭제 이벤트
      bulletinPosts.querySelectorAll('.bulletin-post-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const index = parseInt(e.target.dataset.index);
          const action = e.target.classList[2];
          
          if (action === 'delete') {
            if (confirm('이 글을 삭제하시겠습니까?')) {
              const snapshot = await get(ref(db, 'bulletin/posts'));
              const posts = snapshot.val();
              const postsArray = Array.isArray(posts) ? posts : Object.values(posts);
              postsArray.reverse();
              postsArray.splice(index, 1);
              postsArray.reverse();
              await set(ref(db, 'bulletin/posts'), postsArray);
              loadBulletinPosts();
            }
          } else if (action === 'edit') {
            const snapshot = await get(ref(db, 'bulletin/posts'));
            const posts = snapshot.val();
            const postsArray = Array.isArray(posts) ? posts : Object.values(posts);
            postsArray.reverse();
            const newText = prompt('글을 수정하세요:', postsArray[index].text);
            if (newText !== null && newText.trim()) {
              postsArray[index].text = newText.trim();
              postsArray.reverse();
              await set(ref(db, 'bulletin/posts'), postsArray);
              loadBulletinPosts();
            }
          }
        });
      });
      
      // 답글 수정/삭제 이벤트
      bulletinPosts.querySelectorAll('.bulletin-reply-action-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const postIndex = parseInt(e.target.dataset.postIndex);
          const replyIndex = parseInt(e.target.dataset.replyIndex);
          const action = e.target.classList[2];
          
          if (action === 'delete') {
            if (confirm('이 답글을 삭제하시겠습니까?')) {
              const snapshot = await get(ref(db, 'bulletin/posts'));
              const posts = snapshot.val();
              const postsArray = Array.isArray(posts) ? posts : Object.values(posts);
              postsArray.reverse();
              if (postsArray[postIndex].replies) {
                postsArray[postIndex].replies.splice(replyIndex, 1);
              }
              postsArray.reverse();
              await set(ref(db, 'bulletin/posts'), postsArray);
              loadBulletinPosts();
            }
          } else if (action === 'edit') {
            const snapshot = await get(ref(db, 'bulletin/posts'));
            const posts = snapshot.val();
            const postsArray = Array.isArray(posts) ? posts : Object.values(posts);
            postsArray.reverse();
            const currentReply = postsArray[postIndex].replies[replyIndex];
            const newText = prompt('답글을 수정하세요:', currentReply.text);
            if (newText !== null && newText.trim()) {
              postsArray[postIndex].replies[replyIndex].text = newText.trim();
              postsArray.reverse();
              await set(ref(db, 'bulletin/posts'), postsArray);
              loadBulletinPosts();
            }
          }
        });
      });
      
      // 답글 작성 이벤트
      bulletinPosts.querySelectorAll('.bulletin-reply-submit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const postIndex = parseInt(e.target.dataset.postIndex);
          const inputEl = bulletinPosts.querySelector(`.bulletin-reply-text[data-post-index="${postIndex}"]`);
          const replyText = inputEl.value.trim();
          
          if (!replyText) {
            alert('답글을 입력해주세요.');
            return;
          }
          
          const snapshot = await get(ref(db, 'bulletin/posts'));
          const posts = snapshot.val();
          const postsArray = Array.isArray(posts) ? posts : Object.values(posts);
          postsArray.reverse();
          
          if (!postsArray[postIndex].replies) {
            postsArray[postIndex].replies = [];
          }
          
          postsArray[postIndex].replies.push({
            text: replyText,
            time: new Date().toISOString()
          });
          
          postsArray.reverse();
          await set(ref(db, 'bulletin/posts'), postsArray);
          inputEl.value = '';
          loadBulletinPosts();
        });
      });
    }
  } catch (err) {
    console.error('게시판 로드 실패:', err);
  }
}

// ============================================
// 게시판 글 작성
// ============================================
function setupBulletinSubmit() {
  const bulletinInput = document.getElementById('bulletinInput');
  const bulletinSubmitBtn = document.getElementById('bulletinSubmitBtn');
  
  bulletinSubmitBtn.addEventListener('click', async () => {
    const text = bulletinInput.value.trim();
    if (!text) {
      alert('내용을 입력해주세요.');
      return;
    }
    
    try {
      const snapshot = await get(ref(db, 'bulletin/posts'));
      let posts = [];
      if (snapshot.exists()) {
        const data = snapshot.val();
        posts = Array.isArray(data) ? data : Object.values(data);
      }
      
      posts.push({
        text: text,
        time: new Date().toISOString(),
        replies: []
      });
      
      await set(ref(db, 'bulletin/posts'), posts);
      bulletinInput.value = '';
      loadBulletinPosts();
    } catch (err) {
      console.error('게시판 저장 실패:', err);
      alert('저장 중 오류가 발생했습니다.');
    }
  });
}

// ============================================
// 해버거 메뉴 토글
// ============================================
function setupHamburgerMenu() {
  const hamburgerToggle = document.getElementById('hamburgerToggle');
  const hamburgerNav = document.getElementById('hamburgerNav');
  const hamburgerClose = document.getElementById('hamburgerClose');
  
  hamburgerToggle.addEventListener('click', () => {
    hamburgerNav.classList.add('active');
  });
  
  hamburgerClose.addEventListener('click', () => {
    hamburgerNav.classList.remove('active');
  });
  
  // 메뉴 링크 클릭 시 닫기
  document.querySelectorAll('.hamburger-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      hamburgerNav.classList.remove('active');
    });
  });
  
  // 바깥쪽 클릭 시 닫기
  document.addEventListener('click', (e) => {
    if (!hamburgerNav.contains(e.target) && !hamburgerToggle.contains(e.target)) {
      hamburgerNav.classList.remove('active');
    }
  });
}

// ============================================
// 날짜 네비게이션
// ============================================
function setupDateNavigation() {
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');
  const dateDisplay = document.getElementById('dateDisplay');
  const datePicker = document.getElementById('datePicker');
  const teamDisplay = document.getElementById('teamDisplay');
  
  prevBtn.addEventListener('click', () => {
    const currentDate = new Date(datePicker.value);
    currentDate.setDate(currentDate.getDate() - 1);
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const newDate = `${yyyy}-${mm}-${dd}`;
    
    datePicker.value = newDate;
    dateDisplay.textContent = formatDateDisplay(newDate);
    teamDisplay.textContent = getTeamByDate(newDate);
    loadData(newDate);
  });
  
  nextBtn.addEventListener('click', () => {
    const currentDate = new Date(datePicker.value);
    currentDate.setDate(currentDate.getDate() + 1);
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, '0');
    const dd = String(currentDate.getDate()).padStart(2, '0');
    const newDate = `${yyyy}-${mm}-${dd}`;
    
    datePicker.value = newDate;
    dateDisplay.textContent = formatDateDisplay(newDate);
    teamDisplay.textContent = getTeamByDate(newDate);
    loadData(newDate);
  });
  
  dateDisplay.addEventListener('click', () => {
    datePicker.click();
  });
  
  datePicker.addEventListener('change', () => {
    dateDisplay.textContent = formatDateDisplay(datePicker.value);
    teamDisplay.textContent = getTeamByDate(datePicker.value);
    loadData(datePicker.value);
  });
}

// ============================================
// 관리자 UI 업데이트
// ============================================
function updateAdminButton() {
  if (isAdmin) {
    adminLoginBtn.textContent = "관리자 모드";
    document.getElementById("adminPanel").style.display = "block";
    document.getElementById('adminButtonsContainer').style.display = "grid";
    document.getElementById("copyVehicleBtn").style.display = "block";
  } else {
    adminLoginBtn.textContent = "게스트 모드";
    document.getElementById("adminPanel").style.display = "none";
    document.getElementById('adminButtonsContainer').style.display = 'none';
    document.getElementById('vehiclePanel').style.display = 'none';
    document.getElementById("copyVehicleBtn").style.display = "none";
  }
}

// ============================================
// 권한 UI 적용
// ============================================
function applyPermissionUI(cells, selects, wrappers) {
  if (!isAdmin) {
    cells.forEach(cell => {
      cell.style.pointerEvents = "none";
      cell.style.opacity = "1";
    });
    selects.forEach(sel => {
      sel.disabled = true;
    });
    wrappers.forEach(w => {
      w.style.pointerEvents = "none";
    });
  } else {
    cells.forEach(cell => {
      cell.style.pointerEvents = "auto";
      cell.style.opacity = "1";
    });
    selects.forEach(sel => {
      sel.disabled = false;
    });
    wrappers.forEach(w => {
      w.style.pointerEvents = "auto";
    });
  }
}

// ============================================
// 팝업 설정
// ============================================
function setupPopupSettings() {
  const popupSettingBtn = document.getElementById('popupSettingBtn');
  const popupSettingsModal = document.getElementById('popupSettingsModal');
  const popupSettingsClose = document.getElementById('popupSettingsClose');
  const popupSettingsCancelBtn = document.getElementById('popupSettingsCancelBtn');
  const popupSettingsSaveBtn = document.getElementById('popupSettingsSaveBtn');
  const popupOverlay = document.getElementById('popupOverlay');

  popupSettingBtn.addEventListener('click', async () => {
    const snap = await get(ref(db, 'popup/settings'));
    
    if (snap.exists()) {
      const data = snap.val();
      document.getElementById('popupContent').value = data.content || '';
      document.getElementById('popupStartTime').value = data.startTime || '09:00';
      document.getElementById('popupEndTime').value = data.endTime || '18:00';
      
      document.querySelectorAll('.popup-day-checkbox input')
        .forEach(cb => {
          cb.checked = data.days?.includes(cb.value) || false;
        });
    }
    
    popupSettingsModal.style.display = 'block';
    popupOverlay.style.display = 'block';
  });

  popupSettingsClose.addEventListener('click', () => {
    popupSettingsModal.style.display = 'none';
    popupOverlay.style.display = 'none';
  });

  popupSettingsCancelBtn.addEventListener('click', () => {
    popupSettingsModal.style.display = 'none';
    popupOverlay.style.display = 'none';
  });

  popupSettingsSaveBtn.addEventListener('click', async () => {
    const content = document.getElementById('popupContent').value.trim();
    const startTime = document.getElementById('popupStartTime').value;
    const endTime = document.getElementById('popupEndTime').value;
    
    const checkedDays = [];
    document.querySelectorAll('.popup-day-checkbox input:checked')
      .forEach(cb => checkedDays.push(cb.value));
    
    const popupData = {
      content,
      startTime,
      endTime,
      days: checkedDays
    };
    
    await set(ref(db, 'popup/settings'), popupData);
    popupSettingsModal.style.display = 'none';
    popupOverlay.style.display = 'none';
    alert('팝업 설정 저장 완료');
  });
}

// ============================================
// 팝업 자동 표시
// ============================================
async function checkAndShowPopup() {
  try {
    const snap = await get(ref(db, 'popup/settings'));
    if (!snap.exists()) return;

    const data = snap.val();
    if (!data.content) return;

    const now = new Date();
    const day = String(now.getDay());
    const currentTime = now.toTimeString().slice(0, 5);

    if (
      data.days?.includes(day) &&
      currentTime >= data.startTime &&
      currentTime <= data.endTime
    ) {
      const popupNotificationContent = document.getElementById('popupNotificationContent');
      const popupNotification = document.getElementById('popupNotification');
      const popupOverlay = document.getElementById('popupOverlay');
      
      popupNotificationContent.textContent = data.content;
      popupNotification.style.display = 'block';
      popupOverlay.style.display = 'block';
    }
  } catch (err) {
    console.error('팝업 표시 실패:', err);
  }
}

// ============================================
// 페이지 로드 시 초기화
// ============================================
window.addEventListener('load', async () => {
  // Firebase 초기화
  await initFirebase();
  
  // DOM 요소 선택
  const selects = document.querySelectorAll('.cell select');
  const cells = document.querySelectorAll('.cell');
  const wrappers = document.querySelectorAll('.cells-wrapper');
  const datePicker = document.getElementById('datePicker');
  const currentVehicleBtn = document.getElementById('currentVehicleBtn');
  const vehiclePanel = document.getElementById('vehiclePanel');
  const vehiclePanelCloseBtn = document.getElementById('vehiclePanelCloseBtn');
  const vehicleAddBtn = document.getElementById('vehicleAddBtn');
  const vehicleAddInputContainer = document.getElementById('vehicleAddInputContainer');
  const vehicleAddInput = document.getElementById('vehicleAddInput');
  const vehicleAddConfirmBtn = document.getElementById('vehicleAddConfirmBtn');
  const vehicleAddCancelBtn = document.getElementById('vehicleAddCancelBtn');
  const resetBtn = document.getElementById('resetBtn');
  const copyVehicleBtn = document.getElementById('copyVehicleBtn');
  const popupNotificationClose = document.getElementById('popupNotificationClose');
  const popupOverlay = document.getElementById('popupOverlay');
  const popupNotification = document.getElementById('popupNotification');
  const adminToggleBtn = document.getElementById('adminToggleBtn');
  const adminButtonsContainer = document.getElementById('adminButtonsContainer');
  const adminCloseBtn = document.getElementById('adminCloseBtn');

  adminLoginBtn = document.getElementById('adminLoginBtn');
  adminModal = document.getElementById('adminModal');
  adminLoginOk = document.getElementById('adminLoginOk');

  // busList 로드
  await loadBusListFromDB();

  // 오늘 날짜로 초기화
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const todayStr = `${yyyy}-${mm}-${dd}`;
  datePicker.value = todayStr;
  
  // 날짜 및 팀 표시 업데이트
  document.getElementById('dateDisplay').textContent = formatDateDisplay(todayStr);
  document.getElementById('teamDisplay').textContent = getTeamByDate(todayStr);
  
  // 초기 데이터 로드
  loadData(todayStr);
  loadBulletinPosts();

  // sessionStorage에서 관리자 상태 복원
  if (sessionStorage.getItem("isAdmin") === "1") {
    isAdmin = true;
  }

  applyPermissionUI(cells, selects, wrappers);
  updateAdminButton();

  // Select 변경 이벤트
  selects.forEach(s => s.addEventListener("change", () => {
    if (isAdmin) {
      refreshOptions(selects);
      saveData();
    }
  }));

  // Cell 롱프레스 이벤트
  cells.forEach(cell => {
    let timer;
    const startPress = () => {
      timer = setTimeout(() => {
        if (!isAdmin) return;
        cell.classList.toggle("active");
        saveData();
      }, 600);
    };
    const endPress = () => {
      clearTimeout(timer);
    };
    cell.addEventListener("pointerdown", startPress);
    cell.addEventListener("pointerup", endPress);
    cell.addEventListener("pointerleave", endPress);
    cell.addEventListener("pointercancel", endPress);
  });

  // Wrapper 드래그 이벤트
  wrappers.forEach(wrapper => {
    let startX = 0;
    let isDragging = false;

    wrapper.addEventListener("pointerdown", e => {
      if (!isAdmin) return;
      if (e.target.tagName === "SELECT") return;

      isDragging = true;
      const currentX = parseInt(wrapper.style.transform.replace(/[^\d\-]/g,'')) || 0;
      startX = e.clientX - currentX;
      wrapper.setPointerCapture(e.pointerId);
    });

    wrapper.addEventListener("pointermove", e => {
      if (!isDragging) return;
      let x = e.clientX - startX;
      x = Math.max(0, Math.min(18, x));
      wrapper.style.transform = `translateX(${x}px)`;
    });

    wrapper.addEventListener("pointerup", e => {
      if (!isDragging) return;
      isDragging = false;
      wrapper.releasePointerCapture(e.pointerId);
      saveData();
    });

    wrapper.addEventListener("pointercancel", () => {
      isDragging = false;
    });
  });

  // 관리자 로그인 버튼
  adminLoginBtn.addEventListener('click', () => {
    if (isAdmin) {
      isAdmin = false;
      sessionStorage.removeItem("isAdmin");
      applyPermissionUI(cells, selects, wrappers);
      updateAdminButton();
      alert("게스트 모드로 전환 되었습니다");
    } else {
      adminModal.style.display = "flex";
    }
  });

  // 관리자 로그인 확인
  adminLoginOk.addEventListener('click', async () => {
    const pw = document.getElementById("adminPw").value;
    const snap = await get(ref(db, "admin/password"));
    if (snap.exists() && String(snap.val()) === String(pw)) {
      isAdmin = true;
      sessionStorage.setItem("isAdmin", "1");
      adminModal.style.display = "none";
      document.getElementById("adminPw").value = '';
      applyPermissionUI(cells, selects, wrappers);
      updateAdminButton();
      alert("관리자 모드로 전환 되었습니다");
    } else {
      alert("비밀번호 오류");
    }
  });

  // 관리자 모달 닫기
  adminCloseBtn.addEventListener('click', () => {
    adminModal.style.display = "none";
  });

  // 관리자 메뉴 토글
  adminToggleBtn.addEventListener('click', () => {
    if (adminButtonsContainer.style.display === 'none' || adminButtonsContainer.style.display === '') {
      adminButtonsContainer.style.display = 'grid';
      adminToggleBtn.textContent = '관리자 메뉴 ▲';
    } else {
      adminButtonsContainer.style.display = 'none';
      adminToggleBtn.textContent = '관리자 메뉴 ▼';
    }
  });

  // 차량 패널 표시/숨김
  currentVehicleBtn.addEventListener('click', () => {
    vehiclePanel.style.display = vehiclePanel.style.display === 'none' ? 'block' : 'none';
  });

  vehiclePanelCloseBtn.addEventListener('click', () => {
    vehiclePanel.style.display = 'none';
  });

  // 차량 추가 버튼
  vehicleAddBtn.addEventListener('click', () => {
    vehicleAddBtn.style.display = 'none';
    vehicleAddInputContainer.style.display = 'flex';
    vehicleAddInput.focus();
  });

  vehicleAddConfirmBtn.addEventListener('click', () => {
    const newBus = vehicleAddInput.value.trim();
    if (newBus && !currentBusList.includes(newBus)) {
      currentBusList.push(newBus);
      saveBusListToDB();
      renderVehicleList();
      refreshOptions(selects);
      vehicleAddInput.value = '';
      vehicleAddBtn.style.display = 'block';
      vehicleAddInputContainer.style.display = 'none';
    } else {
      alert('유효한 차량번호를 입력해주세요.');
    }
  });

  vehicleAddCancelBtn.addEventListener('click', () => {
    vehicleAddInput.value = '';
    vehicleAddBtn.style.display = 'block';
    vehicleAddInputContainer.style.display = 'none';
  });

  vehicleAddInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      vehicleAddConfirmBtn.click();
    }
  });

  renderVehicleList();
  refreshOptions(selects);

  // 초기화 버튼
  resetBtn.addEventListener('click', () => {
    if (!isAdmin) return;
    const date = datePicker.value;
    if (!date) {
      alert('날짜를 선택해주세요.');
      return;
    }
    if (confirm('선택된 날짜의 차량 번호 설정을 초기화하시겠습니까?')) {
      set(ref(db, 'parking/' + date), null);
      loadData(date);
      alert('초기화 완료되었습니다.');
    }
  });

  // 차량 복사 버튼
  copyVehicleBtn.addEventListener('click', () => {
    const dateInput = datePicker.value;
    let dateText = dateInput;
    
    const selects = document.querySelectorAll('.cell select');
    let result = [];
    
    selects.forEach(select => {
      if (select.value) {
        result.push(select.value);
      }
    });
    
    const finalText = dateText + "\n\n" + result.join("\n");
    navigator.clipboard.writeText(finalText);
    alert("차량 목록이 복사되었습니다.");
  });

  // 팝업 설정
  setupPopupSettings();

  // 팝업 알림 닫기
  popupNotificationClose.addEventListener('click', () => {
    popupNotification.style.display = 'none';
    popupOverlay.style.display = 'none';
  });

  // 게시판 설정
  setupBulletinSubmit();
  
  // 해버거 메뉴 설정
  setupHamburgerMenu();
  
  // 날짜 네비게이션 설정
  setupDateNavigation();

  // 팝업 자동 표시
  checkAndShowPopup();

  // 초기 상태
  document.getElementById('adminPanel').style.display = 'none';
  document.getElementById('adminButtonsContainer').style.display = 'none';
  document.getElementById('vehiclePanel').style.display = 'none';
});
