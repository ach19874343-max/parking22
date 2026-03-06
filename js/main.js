let isAdmin = sessionStorage.getItem("isAdmin") === "1";
let adminLoginBtn, adminModal, adminLoginOk;
let db, ref, set, get;
let currentBusList = [];
let draggedItem = null;

function updateAdminButton() {
  if (isAdmin) {
    adminLoginBtn.textContent = "관리자 모드";
    document.getElementById('adminButtonsContainer').style.display = 'flex';
    document.getElementById("copyVehicleBtn").style.display = "block";
  } else {
    adminLoginBtn.textContent = "게스트 모드";
    document.getElementById('adminButtonsContainer').style.display = 'none';
    document.getElementById('vehiclePanel').style.display = 'none';
    document.getElementById("copyVehicleBtn").style.display = "none";
  }
}

function formatDateWithDay(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = days[date.getDay()];
  return `${dateStr} ${dayName}`;
}

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
      sel.style.display = "block";
    });
    wrappers.forEach(w => {
      w.style.pointerEvents = "auto";
    });
  }
}

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

async function saveBusListToDB() {
  try {
    await set(ref(db, 'busList'), currentBusList);
  } catch (err) {
    console.error("busList 저장 실패:", err);
  }
}

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

  const confirmDelete = confirm(
    `${busNumber} 차량번호를 정말로 삭제하시겠습니까?`
  );

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

async function initFirebase() {
  try {
    const { initializeApp } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js");
    const { getDatabase, ref: dbRef, set: dbSet, get: dbGet } = await import("https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js");

    const firebaseConfig = {
      apiKey: "AIzaSyAcaIcwlhwAOgKPD5BKD3mAuXiAqLKHTu4",
      databaseURL: "https://parking22-886c6-default-rtdb.asia-southeast1.firebasedatabase.app"
    };

    const app = initializeApp(firebaseConfig);
    db = getDatabase(app);
    ref = dbRef;
    set = dbSet;
    get = dbGet;

    const selects = document.querySelectorAll('.cell select');
    const cells = document.querySelectorAll('.cell');
    const wrappers = document.querySelectorAll('.cells-wrapper');
    const datePicker = document.getElementById('datePicker');
    
    adminLoginBtn = document.getElementById('adminLoginBtn');
    adminModal = document.getElementById('adminModal');
    adminLoginOk = document.getElementById('adminLoginOk');

    // busList 로드
    await loadBusListFromDB();

    async function loadData(date) {
      if (!date) return;
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

    function saveData() {
      if (!isAdmin) return;
      const date = datePicker.value;
      if (!date) return;
      const values = {}, active = {}, drag = {};
      selects.forEach((s, i) => values[i] = s.value);
      cells.forEach((c, i) => active[i] = c.classList.contains("active"));
      wrappers.forEach((w, i) => {
        const m = w.style.transform.match(/-?\d+/);
        drag[i] = m ? parseInt(m[0]) : 0;
      });
      set(ref(db, 'parking/' + date), { values, active, drag });
    }

    selects.forEach(s => s.addEventListener("change", () => {
      if (isAdmin) {
        refreshOptions(selects);
        saveData();
      }
    }));
    
    datePicker.addEventListener("change", () => loadData(datePicker.value));

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
      cell.addEventListener("mousedown", startPress);
      cell.addEventListener("mouseup", endPress);
      cell.addEventListener("mouseleave", endPress);
      cell.addEventListener("touchstart", startPress, { passive: false });
      cell.addEventListener("touchend", endPress);
      cell.addEventListener("touchcancel", endPress);
    });

    wrappers.forEach(wrapper => {
      let startX = 0, isDragging = false;
      wrapper.addEventListener("mousedown", e => {
        if (!isAdmin || e.target.tagName === "SELECT") return;
        isDragging = true;
        startX = e.clientX - (parseInt(wrapper.style.transform.replace(/\D/g, '')) || 0);
      });
      document.addEventListener("mousemove", e => {
        if (!isDragging) return;
        let x = e.clientX - startX;
        x = Math.max(0, Math.min(18, x));
        wrapper.style.transform = `translateX(${x}px)`;
      });
      document.addEventListener("mouseup", () => {
        if (isDragging) {
          isDragging = false;
          saveData();
        }
      });
    });

    // 현재차량상황 패널 이벤트
    const vehiclePanel = document.getElementById('vehiclePanel');
    const currentVehicleBtn = document.getElementById('currentVehicleBtn');
    const vehiclePanelCloseBtn = document.getElementById('vehiclePanelCloseBtn');
    const vehicleAddBtn = document.getElementById('vehicleAddBtn');
    const vehicleAddInputContainer = document.getElementById('vehicleAddInputContainer');
    const vehicleAddInput = document.getElementById('vehicleAddInput');
    const vehicleAddConfirmBtn = document.getElementById('vehicleAddConfirmBtn');
    const vehicleAddCancelBtn = document.getElementById('vehicleAddCancelBtn');

    currentVehicleBtn.addEventListener('click', () => {
      vehiclePanel.style.display = vehiclePanel.style.display === 'none' ? 'block' : 'none';
      currentVehicleBtn.classList.toggle('active');
    });

    vehiclePanelCloseBtn.addEventListener('click', () => {
      vehiclePanel.style.display = 'none';
      currentVehicleBtn.classList.remove('active');
    });

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
      } else if (currentBusList.includes(newBus)) {
        alert('이미 존재하는 차량번호입니다.');
      } else {
        alert('차량번호를 입력해주세요.');
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

    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;
    datePicker.value = todayStr;
    loadData(todayStr);

    applyPermissionUI(cells, selects, wrappers);
    updateAdminButton();

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

    adminLoginOk.addEventListener('click', async () => {
      const pw = document.getElementById("adminPw").value;
      const snap = await get(ref(db, "admin/password"));
      if (snap.exists() && String(snap.val()) === String(pw)) {
        isAdmin = true;
        sessionStorage.setItem("isAdmin", "1");
        adminModal.style.display = "none";
        applyPermissionUI(cells, selects, wrappers);
        updateAdminButton();
        alert("관리자 모드로 전환 되었습니다");
      } else {
        alert("비밀번호 오류");
      }
    });

    document.addEventListener("click", (e) => {
      if (e.target.id === "adminCloseBtn") {
        adminModal.style.display = "none";
      }
    });

    // 초기화 버튼 기능
    const resetBtn = document.getElementById('resetBtn');
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

    // 게시판 기능
    const bulletinInput = document.getElementById('bulletinInput');
    const bulletinSubmitBtn = document.getElementById('bulletinSubmitBtn');
    const bulletinPosts = document.getElementById('bulletinPosts');

    async function loadBulletinPosts(date) {
      try {
        const snapshot = await get(ref(db, 'bulletin/' + date));
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
                <div>
                  <div class="bulletin-post-content">${post.text}</div>
                  <div class="bulletin-post-time">${time}</div>
                </div>
                <button class="bulletin-post-delete" data-index="${index}">삭제</button>
              `;
              bulletinPosts.appendChild(postEl);
            }
          });
          bulletinPosts.querySelectorAll('.bulletin-post-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const index = parseInt(e.target.dataset.index);
              if (confirm('이 글을 삭제하시겠습니까?')) {
                const snapshot = await get(ref(db, 'bulletin/' + date));
                const posts = snapshot.val();
                const postsArray = Array.isArray(posts) ? posts : Object.values(posts);
                postsArray.reverse();
                postsArray.splice(index, 1);
                postsArray.reverse();
                await set(ref(db, 'bulletin/' + date), postsArray);
                loadBulletinPosts(date);
              }
            });
          });
        }
      } catch (err) {
        console.error('게시판 로드 실패:', err);
      }
    }

    bulletinSubmitBtn.addEventListener('click', async () => {
      const text = bulletinInput.value.trim();
      if (!text) {
        alert('내용을 입력해주세요.');
        return;
      }
      const date = datePicker.value;
      if (!date) {
        alert('날짜를 선택해주세요.');
        return;
      }
      try {
        const snapshot = await get(ref(db, 'bulletin/' + date));
        let posts = [];
        if (snapshot.exists()) {
          const data = snapshot.val();
          posts = Array.isArray(data) ? data : Object.values(data);
        }
               posts.push({
          text: text,
          time: new Date().toISOString()
        });

        await set(ref(db, 'bulletin/' + date), posts);
        bulletinInput.value = '';
        loadBulletinPosts(date);

      } catch (err) {
        console.error('게시판 저장 실패:', err);
        alert('저장 중 오류가 발생했습니다.');
      }
    });

    // 날짜 변경 시 게시판도 다시 로드
    datePicker.addEventListener("change", () => {
      loadData(datePicker.value);
      loadBulletinPosts(datePicker.value);
    });

    // 팝업 설정 기능
    const popupSettingsModal = document.getElementById('popupSettingsModal');
    const popupSettingBtn = document.getElementById('popupSettingBtn');
    const popupSettingsClose = document.getElementById('popupSettingsClose');
    const popupSettingsCancelBtn = document.getElementById('popupSettingsCancelBtn');
    const popupSettingsSaveBtn = document.getElementById('popupSettingsSaveBtn');
    const popupOverlay = document.getElementById('popupOverlay');
    const popupNotification = document.getElementById('popupNotification');
    const popupNotificationContent = document.getElementById('popupNotificationContent');
    const popupNotificationClose = document.getElementById('popupNotificationClose');

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

  popupSettingsModal.classList.add('active');
});

    popupSettingsClose.addEventListener('click', () => {
      popupSettingsModal.classList.remove('active');
    });

    popupSettingsCancelBtn.addEventListener('click', () => {
      popupSettingsModal.classList.remove('active');
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

      popupSettingsModal.classList.remove('active');
      alert('팝업 설정 저장 완료');
    });

    popupNotificationClose.addEventListener('click', () => {
      popupNotification.classList.remove('active');
      popupOverlay.classList.remove('active');
    });

    // 팝업 자동 표시 체크
    async function checkAndShowPopup() {
      const snap = await get(ref(db, 'popup/settings'));
      if (!snap.exists()) return;

      const data = snap.val();
      if (!data.content) return;

      const now = new Date();
      const day = String(now.getDay());
      const currentTime = now.toTimeString().slice(0,5);

      if (
        data.days?.includes(day) &&
        currentTime >= data.startTime &&
        currentTime <= data.endTime
      ) {
        popupNotificationContent.textContent = data.content;
        popupNotification.classList.add('active');
        popupOverlay.classList.add('active');
      }
    }

    checkAndShowPopup();
    loadBulletinPosts(datePicker.value);

  } catch (err) {
    console.error("Firebase 초기화 실패:", err);
  }
}

document.getElementById("copyVehicleBtn").addEventListener("click", () => {

  // 날짜 가져오기
  const dateInput = document.querySelector('.date-box input');
  let dateText = "";

  if (dateInput && dateInput.value) {
    const d = new Date(dateInput.value);
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dateText = `${month}/${day}`;
  }

  const rows = document.querySelectorAll(".row");
  let result = [];

  rows.forEach(row => {

    const selects = row.querySelectorAll("select");
    let cars = [];

    selects.forEach(sel => {
      if (sel.value) cars.push(sel.value);
    });

    if (cars.length > 0) {
      result.push(cars.join("-"));
    }

  });

  const finalText = dateText + "\n\n" + result.join("\n");

  navigator.clipboard.writeText(finalText);

  alert("차량 목록이 복사되었습니다.");
});

initFirebase();