// ===== APPLICATION STATE =====
let appState = {
  currentModule: 'writing',
  characters: [],
  chapters: [],
  timeline: [],
  locations: [],
  research: [],
  storyStructure: {
    beginning: '',
    conflict: '',
    climax: '',
    ending: ''
  },
  currentChapter: {
    title: '',
    content: ''
  },
  isConnected: false
};

// ===== DOM ELEMENTS =====
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const menuToggle = document.getElementById('menuToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const moduleItems = document.querySelectorAll('.module-item');
const contentPanels = document.querySelectorAll('.content-panel');
const saveStatusInline = document.getElementById('saveStatusInline');
const loadingIndicator = document.getElementById('loadingIndicator');

// ===== APPLICATION INITIALIZATION =====
let isAppInitialized = false;

function preventDuplicateInitialization() {
  if (isAppInitialized) {
    console.log('⚠️ แอปพลิเคชันถูกเริ่มต้นแล้ว - ข้ามการเริ่มต้นซ้ำ');
    return true;
  }
  return false;
}

document.addEventListener('DOMContentLoaded', function() {
  if (preventDuplicateInitialization()) return;

  initializeApp();
  setupEventListeners();
  loadLocalData();

  isAppInitialized = true;
});

async function initializeApp() {
  if (window.appInitialized) {
    console.log('⚠️ ระบบถูกเริ่มต้นแล้ว - ข้ามการเริ่มต้นซ้ำ');
    return;
  }

  console.log('🏮 คัมภีร์หมื่นอักษร - เริ่มต้นระบบ');
  window.appInitialized = true;

  // ตรวจสอบสุขภาพระบบก่อน
  await performSystemHealthCheck();

  // Initialize save status
  showSaveStatus('ready');

  // Initialize Firebase securely first
  const firebaseReady = await initializeFirebase();

  if (firebaseReady) {
    // Check Firebase connection
    checkFirebaseConnection();
  } else {
    console.log('🔌 Firebase: ยังไม่ได้เชื่อมต่อ (กำลังใช้พื้นที่เก็บข้อมูลท้องถิ่น)');
    appState.isConnected = false;
    const statusIndicator = document.querySelector('.status-indicator');
    statusIndicator.classList.add('offline');
    statusIndicator.classList.remove('online');
    loadLocalData();
  }

  // Initialize modules
  initializeModules();

  // Initialize Undo/Redo System
  if (window.UndoRedoSystem) {
    window.UndoRedoSystem.initialize();
  }

  // Setup auto-save
  setupAutoSave();
}

function setupEventListeners() {
  // ใช้ AbortController สำหรับจัดการ event listeners
  try {
    if (window.appEventController) {
      window.appEventController.abort();
    }
    window.appEventController = new AbortController();
    const { signal } = window.appEventController;

    // Sidebar toggle
    sidebarToggle?.addEventListener('click', closeSidebar, { passive: true, signal });
    menuToggle?.addEventListener('click', toggleSidebar, { passive: true, signal });
    sidebarOverlay?.addEventListener('click', closeSidebar, { passive: true, signal });

    // Module navigation - use delegation for better performance
    const sidebar = document.getElementById('sidebar');
    sidebar?.addEventListener('click', (e) => {
      const moduleItem = e.target.closest('.module-item');
      if (moduleItem) {
        const module = moduleItem.dataset.module;
        switchModule(module);
        closeSidebar();
      }
    }, { passive: true, signal });

    // AI analyze button
    const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');
    aiAnalyzeBtn?.addEventListener('click', analyzeWithAI, { passive: true, signal });

    // Add button events
    setupAddButtonEvents();

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts, { passive: true, signal });

  } catch (error) {
    console.error('❌ Error setting up event listeners:', error);
    // Fallback to basic event listeners without AbortController
    setupBasicEventListeners();
  }
}

function setupBasicEventListeners() {
  // Fallback event listeners without AbortController
  sidebarToggle?.addEventListener('click', closeSidebar);
  menuToggle?.addEventListener('click', toggleSidebar);
  sidebarOverlay?.addEventListener('click', closeSidebar);

  const sidebar = document.getElementById('sidebar');
  sidebar?.addEventListener('click', (e) => {
    const moduleItem = e.target.closest('.module-item');
    if (moduleItem) {
      const module = moduleItem.dataset.module;
      switchModule(module);
      closeSidebar();
    }
  });

  const aiAnalyzeBtn = document.getElementById('aiAnalyzeBtn');
  aiAnalyzeBtn?.addEventListener('click', analyzeWithAI);

  setupAddButtonEvents();
}

function handleKeyboardShortcuts(e) {
  // Toggle sidebar with Escape key
  if (e.key === 'Escape') {
    closeSidebar();
  }

  // Toggle sidebar with Ctrl/Cmd + B
  if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
    e.preventDefault();
    toggleSidebar();
  }
}

// ===== SIDEBAR MANAGEMENT =====
function toggleSidebar() {
  const isOpen = sidebar.classList.contains('open');

  if (isOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('visible');
  menuToggle.classList.add('hidden');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('visible');
  menuToggle.classList.remove('hidden');
  document.body.style.overflow = 'auto';
}

// ===== MODULE MANAGEMENT =====
function switchModule(moduleName) {
  // Update active module
  moduleItems.forEach(item => item.classList.remove('active'));
  document.querySelector(`[data-module="${moduleName}"]`).classList.add('active');

  // Show corresponding panel
  contentPanels.forEach(panel => panel.classList.remove('active'));
  document.getElementById(`${moduleName}-panel`).classList.add('active');

  // Update app state
  appState.currentModule = moduleName;

  console.log(`📖 เปลี่ยนไปยังโมดูล: ${moduleName}`);
}

// ===== SAVE STATUS MANAGEMENT =====
function showSaveStatus(status) {
  const statusElement = document.getElementById('saveStatusText');
  const container = document.querySelector('.save-status-inline');

  if (!statusElement) {
    console.log('⚠️ ไม่พบ saveStatusText element');
    return;
  }

  if (!container) {
    console.log('⚠️ ไม่พบ save-status-inline container');
    return;
  }

  // Clear any existing timeouts
  if (window.saveStatusTimeout) {
    clearTimeout(window.saveStatusTimeout);
  }

  console.log(`🔄 อัปเดตสถานะ: ${status}`);

  switch(status) {
    case 'saving':
      statusElement.innerHTML = '<span class="status-dot">🟡</span>กำลังบันทึก...';
      container.style.background = 'rgba(243, 156, 18, 0.2)';
      container.style.borderColor = 'rgba(243, 156, 18, 0.6)';
      container.style.color = '#f39c12';
      break;

    case 'saved':
      const location = appState.isConnected ? 'ออนไลน์' : 'ท้องถิ่น';
      const statusColor = appState.isConnected ? '🟢' : '🔵';
      statusElement.innerHTML = `<span class="status-dot">${statusColor}</span>บันทึกแล้ว (${location})`;

      if (appState.isConnected) {
        container.style.background = 'rgba(39, 174, 96, 0.2)';
        container.style.borderColor = 'rgba(39, 174, 96, 0.6)';
        container.style.color = '#27ae60';
      } else {
        container.style.background = 'rgba(52, 152, 219, 0.2)';
        container.style.borderColor = 'rgba(52, 152, 219, 0.6)';
        container.style.color = '#3498db';
      }

      // Auto reset to ready after 4 seconds
      window.saveStatusTimeout = setTimeout(() => {
        if (statusElement.innerHTML.includes('บันทึกแล้ว')) {
          showSaveStatus('ready');
        }
      }, 4000);
      break;

    case 'error':
      statusElement.innerHTML = '<span class="status-dot">🔴</span>เกิดข้อผิดพลาด';
      container.style.background = 'rgba(231, 76, 60, 0.2)';
      container.style.borderColor = 'rgba(231, 76, 60, 0.6)';
      container.style.color = '#e74c3c';

      // Auto reset to ready after 5 seconds
      window.saveStatusTimeout = setTimeout(() => {
        showSaveStatus('ready');
      }, 5000);
      break;

    case 'ready':
      statusElement.innerHTML = '<span class="status-dot">🟢</span>พร้อมเขียน';
      container.style.background = 'rgba(102, 126, 234, 0.15)';
      container.style.borderColor = 'rgba(102, 126, 234, 0.4)';
      container.style.color = '#2c3e50';
      break;
  }

  // Add pulse animation for active states
  if (status === 'saving') {
    container.style.animation = 'pulse 1s ease-in-out infinite';
  } else {
    container.style.animation = '';
  }
}

// ===== AUTO-SAVE SETUP =====
function setupAutoSave() {
  let saveTimeout;
  let lastSaveTime = 0;
  let isCurrentlySaving = false;

  const debouncedSave = debounce(async () => {
    if (isCurrentlySaving) {
      console.log('⏳ กำลังบันทึกอยู่ รอสักครู่...');
      return;
    }

    // ตรวจสอบความจำเป็นในการบันทึก
    const writingEditor = document.getElementById('writingEditor');
    const currentContent = writingEditor ? writingEditor.value : '';
    const lastSavedContent = localStorage.getItem('lastSavedContent') || '';

    if (currentContent === lastSavedContent) {
      console.log('📝 ไม่มีการเปลี่ยนแปลง - ข้าม auto-save');
      return;
    }

    isCurrentlySaving = true;
    showSaveStatus('saving');

    try {
      // รวบรวมข้อมูลที่จะบันทึก
      if (writingEditor) {
        appState.currentChapter.content = writingEditor.value;
        localStorage.setItem('lastSavedContent', writingEditor.value);
        console.log(`📝 บันทึกเนื้อหา: ${writingEditor.value.length} ตัวอักษร`);
      }

      const success = await saveToFirebase();

      if (success) {
        showSaveStatus('saved');
        lastSaveTime = Date.now();
        console.log('✅ Auto-save สำเร็จ:', new Date().toLocaleTimeString());
      } else {
        showSaveStatus('error');
        console.log('❌ Auto-save ล้มเหลว');
      }
    } catch (error) {
      showSaveStatus('error');
      console.error('❌ Auto-save error:', error);
    } finally {
      isCurrentlySaving = false;
    }
  }, 3000); // เพิ่มเป็น 3 วินาที เพื่อลดการกระตุก

  // ติดตาม elements หลากหลาย
  function attachAutoSave() {
    const elements = [
      'writingEditor',
      'chapterTitle',
    ];

    elements.forEach(elementId => {
      const element = document.getElementById(elementId);
      if (element) {
        // Event listener สำหรับการพิมพ์ with throttle
        const throttledInput = throttle((e) => {
          console.log(`📝 ตรวจพบการพิมพ์ใน: ${elementId} - ${e.target.value.length} ตัวอักษร`);
          showSaveStatus('saving');
          debouncedSave();
        }, 500); // Throttle ทุกๆ 500ms

        element.addEventListener('input', throttledInput);

        // Event listener สำหรับการออกจากช่อง
        element.addEventListener('blur', () => {
          console.log(`👆 ออกจากช่อง: ${elementId}`);
          if (Date.now() - lastSaveTime > 1000) {
            debouncedSave();
          }
        });

        // Event listener สำหรับการ focus
        element.addEventListener('focus', () => {
          console.log(`👆 เข้าช่อง: ${elementId}`);
          if (element.value.trim()) {
            showSaveStatus('ready');
          }
        });

        console.log(`✅ Auto-save ติดตั้งสำหรับ: ${elementId}`);
      } else {
        console.log(`⚠️ ไม่พบ element: ${elementId}`);
      }
    });

    // ติดตาม character และ module อื่นๆ
    document.addEventListener('characterUpdated', () => {
      console.log('📝 Character updated - triggering save');
      debouncedSave();
    });

    document.addEventListener('chapterUpdated', () => {
      console.log('📝 Chapter updated - triggering save');
      debouncedSave();
    });

    console.log('💾 Auto-save system เริ่มต้นสมบูรณ์');
  }

  // เริ่มต้น auto-save
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attachAutoSave);
  } else {
    setTimeout(attachAutoSave, 100); // รอให้ DOM เสถียร
  }

  // บันทึกทุก 60 วินาที (heartbeat save) - ลดความถี่
  setInterval(() => {
    if (Date.now() - lastSaveTime > 60000 && !isCurrentlySaving) {
      console.log('💓 Heartbeat auto-save เริ่มต้น');
      debouncedSave();
    }
  }, 60000);

  // แสดงสถานะเริ่มต้นและเริ่ม Auto-save
  setTimeout(() => {
    showSaveStatus('ready');
    console.log('🟢 Auto-save พร้อมใช้งาน');
    console.log('💾 Auto-save system เริ่มต้นสมบูรณ์');

    // ตรวจสอบว่า elements พร้อมหรือยัง
    const writingEditor = document.getElementById('writingEditor');
    if (writingEditor) {
      console.log('✅ Writing Editor พบแล้ว - Auto-save พร้อมทำงาน');
    } else {
      console.log('⚠️ Writing Editor ยังไม่พบ - รอการโหลด');
    }
  }, 500);
}

// ===== ADD BUTTON EVENTS =====
function setupAddButtonEvents() {
  // Add Chapter
  document.getElementById('addChapterBtn')?.addEventListener('click', () => {
    if (window.ChapterModule) {
      window.ChapterModule.addChapter();
    }
  });

  // Add Character
  document.getElementById('addCharacterBtn')?.addEventListener('click', () => {
    if (window.CharacterModule) {
      window.CharacterModule.addCharacter();
    }
  });

  // Add Timeline Event
  document.getElementById('addTimelineBtn')?.addEventListener('click', () => {
    if (window.TimelineModule) {
      window.TimelineModule.addTimelineEvent();
    }
  });

  // Add Location
  document.getElementById('addLocationBtn')?.addEventListener('click', () => {
    if (window.WorldModule) {
      window.WorldModule.addLocation();
    }
  });

  // Add Research
  document.getElementById('addResearchBtn')?.addEventListener('click', () => {
    if (window.ResearchModule) {
      window.ResearchModule.addResearch();
    }
  });
}

// ===== MODULE INITIALIZATION =====
function initializeModules() {
  console.log('🔧 เริ่มต้นโมดูลทั้งหมด');

  // Initialize empty character if none exist
  if (appState.characters.length === 0 && window.CharacterModule) {
    window.CharacterModule.addCharacter();
  }
}

// ===== AI ANALYSIS =====
async function analyzeWithAI() {
  try {
    if (loadingIndicator) {
      loadingIndicator.style.display = 'flex';
    }
    console.log('🤖 เริ่มการวิเคราะห์ด้วย Gemini AI...');

    // เตรียมข้อมูลสำหรับส่งไป Gemini
    const analysisData = {
      content: appState.currentChapter.content || '',
      characters: appState.characters || [],
      storyStructure: appState.storyStructure || {}
    };

    // ตรวจสอบว่ามีเนื้อหาให้วิเคราะห์หรือไม่
    if (!analysisData.content.trim()) {
      if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
      }
      alert('กรุณาเขียนเนื้อหาก่อนขอการวิเคราะห์จาก AI');
      return;
    }

    // เรียก Gemini API
    const apiUrl = 'http://0.0.0.0:5000/api/gemini-analyze';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(analysisData)
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ API');
    }

    // แสดงผลการวิเคราะห์
    showAIAnalysisModal(result.analysis);

    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    console.log('🤖 วิเคราะห์ด้วย Gemini AI สำเร็จ');

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการวิเคราะห์ AI:', error);
    if (loadingIndicator) {
      loadingIndicator.style.display = 'none';
    }
    alert(`เกิดข้อผิดพลาด: ${error.message}`);
  }
}

function showAIAnalysisModal(analysis) {
  // ปิด modal เดิมถ้ามี
  const existingModal = document.querySelector('.ai-analysis-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // สร้าง modal สำหรับแสดงผลการวิเคราะห์
  const modal = document.createElement('div');
  modal.className = 'ai-analysis-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3><i class="fas fa-brain"></i> การวิเคราะห์จาก Gemini AI</h3>
        <button class="modal-close">&times;</button>
      </div>
      <div class="modal-body">
        <div class="analysis-content">${analysis.replace(/\n/g, '<br>')}</div>
      </div>
      <div class="modal-footer">
        <button class="btn-primary modal-close">เข้าใจแล้ว</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // ฟังก์ชันสำหรับปิด modal และทำความสะอาด
  const closeModal = () => {
    if (modal.parentNode) {
      document.body.removeChild(modal);
    }
  };

  // เพิ่ม event listeners สำหรับปิด modal
  modal.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });

  // ปิด modal เมื่อคลิกพื้นหลัง
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  // ปิด modal ด้วย Escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
}

// ===== SYSTEM HEALTH CHECK =====
async function performSystemHealthCheck() {
  const checks = {
    localStorage: false,
    domElements: false,
    apiServer: false,
    eventListeners: false
  };

  try {
    // ตรวจสอบ localStorage
    localStorage.setItem('healthCheck', 'test');
    localStorage.removeItem('healthCheck');
    checks.localStorage = true;
    console.log('✅ localStorage: พร้อมใช้งาน');
  } catch (error) {
    console.error('❌ localStorage: ไม่สามารถใช้งานได้');
  }

  try {
    // ตรวจสอบ DOM elements ที่สำคัญ
    const requiredElements = ['sidebar', 'saveStatus'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));

    if (missingElements.length === 0) {
      checks.domElements = true;
      console.log('✅ DOM Elements: ครบถ้วน');
    } else {
      console.error('❌ DOM Elements ขาดหาย:', missingElements);
    }
  } catch (error) {
    console.error('❌ DOM Elements: เกิดข้อผิดพลาด', error);
  }

  try {
    // ตรวจสอบ API Server
    if (window.FirebaseModule) {
      checks.apiServer = await window.FirebaseModule.checkAPIHealth();
    }
    if (checks.apiServer) {
      console.log('✅ API Server: เชื่อมต่อได้');
    } else {
      console.log('⚠️ API Server: ไม่สามารถเชื่อมต่อได้');
    }
  } catch (error) {
    console.error('❌ API Server: เกิดข้อผิดพลาด', error);
  }

  try {
    // ตรวจสอบ Event Listeners
    checks.eventListeners = typeof window.addEventListener === 'function';
    console.log('✅ Event Listeners: พร้อมใช้งาน');
  } catch (error) {
    console.error('❌ Event Listeners: ไม่สามารถใช้งานได้');
  }

  // รายงานผลรวม
  const healthScore = Object.values(checks).filter(Boolean).length;
  const totalChecks = Object.keys(checks).length;

  console.log(`🏥 สุขภาพระบบ: ${healthScore}/${totalChecks} (${Math.round(healthScore/totalChecks*100)}%)`);

  if (healthScore < totalChecks * 0.75) {
    console.warn('⚠️ ระบบมีปัญหา - บางฟีเจอร์อาจไม่ทำงาน');
  }

  return checks;
}

// ===== UTILITY FUNCTIONS =====
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function throttle(func, delay) {
  let timeoutId;
  let lastExecTime = 0;
  return function (...args) {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func.apply(this, args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
}

// ===== GLOBAL FUNCTIONS =====
async function initializeFirebase() {
  if (window.FirebaseModule) {
    return await window.FirebaseModule.initializeFirebase();
  }
  return false;
}

async function checkFirebaseConnection() {
  if (window.FirebaseModule) {
    return await window.FirebaseModule.checkFirebaseConnection();
  }
  return false;
}

async function saveToFirebase() {
  if (window.FirebaseModule) {
    try {
      const result = await window.FirebaseModule.saveToFirebase(appState);
      if (result) {
        // อัพเดต connection status
        appState.isConnected = true;
        updateConnectionStatus('online');
        return true;
      }
    } catch (error) {
      console.error('💾 Save error:', error);
      appState.isConnected = false;
      updateConnectionStatus('offline');
    }
  }

  // Fallback บันทึกใน localStorage
  try {
    localStorage.setItem('jadeScrollData', JSON.stringify(appState));
    console.log('💾 บันทึกลง localStorage สำเร็จ');
    return true;
  } catch (error) {
    console.error('❌ localStorage error:', error);
    return false;
  }
}

function updateConnectionStatus(status) {
  const statusIndicator = document.querySelector('.status-indicator');
  const statusSpan = statusIndicator?.querySelector('span');

  if (statusIndicator && statusSpan) {
    if (status === 'online') {
      statusIndicator.className = 'status-indicator online';
      statusSpan.textContent = 'ออนไลน์';
    } else {
      statusIndicator.className = 'status-indicator offline';
      statusSpan.textContent = 'ออฟไลน์';
    }
  }
}

function loadLocalData() {
  try {
    const savedData = localStorage.getItem('jadeScrollData');
    if (savedData) {
      const data = JSON.parse(savedData);
      appState = { ...appState, ...data };
      console.log('📂 โหลดข้อมูลจาก localStorage สำเร็จ');

      // Render all modules if they exist
      if (window.CharacterModule && appState.characters) {
        window.CharacterModule.renderCharacters(appState.characters);
      }
      
      if (window.ChapterPreview && appState.chapters) {
        // Chapter Preview จะจัดการข้อมูลเอง
        console.log('📋 พบข้อมูลบท:', appState.chapters.length, 'บท');
      }

      if (window.WorldModule && appState.locations) {
        window.WorldModule.renderLocations(appState.locations);
      }

      if (window.ResearchModule && appState.research) {
        window.ResearchModule.renderResearch(appState.research);
      }

      if (window.StructureModule && appState.storyStructure) {
        window.StructureModule.renderStoryStructure(appState.storyStructure);
      }

      // โหลดเนื้อหาการเขียนล่าสุด
      const writingEditor = document.getElementById('writingEditor');
      if (writingEditor && appState.currentChapter && appState.currentChapter.content) {
        writingEditor.value = appState.currentChapter.content;
        console.log('📝 โหลดเนื้อหาการเขียนล่าสุดสำเร็จ');
      }
    } else {
      console.log('📂 ไม่พบข้อมูลที่บันทึกไว้ - เริ่มต้นใหม่');
      // สร้างข้อมูลเริ่มต้นผ่าน ChapterPreview
      if (window.ChapterPreview) {
        window.ChapterPreview.loadData();
      }
    }
  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการโหลดข้อมูล:', error);
    // สร้างข้อมูลเริ่มต้น
    if (window.ChapterPreview) {
      window.ChapterPreview.loadData();
    }
  }
}

// ===== CHAPTER CARDS BORDER CONTROL=====
function toggleWritingAreaBorder(isCardsOpen) {
  const writingArea = document.querySelector('.writing-area');
  if (writingArea) {
    if (isCardsOpen) {
      writingArea.classList.add('cards-open');
    } else {
      writingArea.classList.remove('cards-open');
    }
  }
}

// ===== Chapter Cards functionality =====
function initializeChapterCards() {
  const trigger = document.getElementById('chapterCardsTrigger');
  const overlay = document.getElementById('chapterCardsOverlay');
  const cardsContainer = document.getElementById('chapterInfoCards');

  if (!trigger || !overlay || !cardsContainer) return;

  trigger.addEventListener('click', function() {
    const isActive = overlay.classList.contains('active');

    if (isActive) {
      overlay.classList.remove('active');
      trigger.classList.remove('active');
      toggleWritingAreaBorder(false); // ปิดเส้นขอบ
    } else {
      generateChapterCards();
      overlay.classList.add('active');
      trigger.classList.add('active');
      toggleWritingAreaBorder(true); // เปิดเส้นขอบ

      // เพิ่มเอฟเฟกต์การปรากฏของการ์ด
      setTimeout(() => {
        const cards = cardsContainer.querySelectorAll('.chapter-info-card');
        cards.forEach((card, index) => {
          card.style.opacity = '0';
          card.style.transform = 'translateY(20px) scale(0.9)';
          setTimeout(() => {
            card.style.transition = 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0) scale(1)';
          }, index * 100);
        });
      }, 100);
    }
  });

  // เพิ่มเอฟเฟกต์เมื่อเลื่อน - ลด lag และเพิ่ม performance
  let scrollTimeout;
  const throttledScroll = throttle(() => {
    cardsContainer.classList.add('scrolling');

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      cardsContainer.classList.remove('scrolling');
    }, 100);
  }, 16); // 60fps

  cardsContainer.addEventListener('scroll', throttledScroll, { passive: true });

  // เพิ่มการ์ดนำทาง (scroll buttons)
  addScrollButtons(cardsContainer);

  // Close when clicking outside
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay && overlay.classList.contains('active')) {
      overlay.classList.remove('active');
      trigger.classList.remove('active');
      toggleWritingAreaBorder(false); // ปิดเส้นขอบ
    }
  });
}

function generateChapterCards() {
  const cardsContainer = document.getElementById('chapterInfoCards');
  if (!cardsContainer) return;

  // Clear existing cards
  cardsContainer.innerHTML = '';

  // Enhanced chapter data with editable metadata
  const chapterCardsData = [
    {
      id: 'chapter-1',
      title: 'บท 1: จุดเริ่มต้น',
      characters: ['เจ้าหญิงลิเหมย', 'พระราชา'],
      locations: ['พระราชวัง', 'ห้องพระราชา'],
      keyEvents: ['การถูกขับไล่', 'การตัดสินใจของพระราชา'],
      summary: 'เจ้าหญิงลิเหมยถูกขับไล่ออกจากวัง',
      content: `ในวันที่ท้องฟ้าครึ้มเมฆดำ เจ้าหญิงลิเหมยนั่งอยู่ริมหน้าต่างห้องนอนของเธอ มองออกไปยังสวนที่เคยเป็นที่ผ่อนคลายใจของเธอ แต่วันนี้ทุกอย่างดูเหมือนจะเปลี่ยนไป

"เจ้าหญิง ฝ่าบาทขอให้เสด็จไปยังพระที่นั่ง" เสียงของนางรำที่เธอไว้วางใจมากที่สุดดังขึ้น แต่เสียงนั้นสั่นเครือไม่เหมือนเดิม

ลิเหมยรู้ดีว่าวันนี้คือวันที่เธอจะต้องเผชิญกับความจริงที่เธอหลีกเลี่ยงมานาน เรื่องราวเกี่ยวกับการสืบราชบัลลังก์ และการตัดสินใจที่จะเปลี่ยนแปลงชีวิตเธอไปตลอดกาล`
    },
    {
      id: 'chapter-2',
      title: 'บท 2: การพบกัน',
      characters: ['ลิเหมย', 'เฉิน เหอ'],
      locations: ['ป่าลึก', 'กระต๊อบในป่า'],
      keyEvents: ['การหลบหนี', 'การพบกับเฉิน เหอ'],
      summary: 'ลิเหมยพบกับนักรบลูกครึ่งในป่า',
      content: `ป่าลึกในยามค่ำคืนเต็มไปด้วยเสียงแปลกๆ ที่ทำให้ลิเหมยต้องหยุดเดินทางและพักผ่อนใต้ต้นไผ่ใหญ่`
    },
    {
      id: 'chapter-3',
      title: 'บท 3: การทดสอบ',
      characters: ['ลิเหมย', 'เฉิน เหอ'],
      locations: ['กระต๊อบ', 'สนามฝึก'],
      keyEvents: ['การฝึกต่อสู้', 'การทดสอบแรก'],
      summary: 'ลิเหมยเริ่มเรียนรู้การต่อสู้',
      content: `การเดินทางร่วมกันของลิเหมยและเฉิน เหอ เริ่มต้นขึ้นด้วยความไม่ไว้วางใจซึ่งกันและกัน`
    },
    {
      id: 'chapter-4',
      title: 'บท 4: ความลับ',
      characters: ['ลิเหมย', 'เฉิน เหอ', 'ผู้สืบเร้น'],
      locations: ['ป่าลึก', 'ถ้ำลับ'],
      keyEvents: ['การเปิดเผยความลับ', 'การถูกตามล่า'],
      summary: 'ความลับของตระกูลถูกเปิดเผย',
      content: ''
    },
    {
      id: 'chapter-5',
      title: 'บท 5: การสู้รบ',
      characters: ['ลิเหมย', 'เฉิน เหอ', 'ศัตรู'],
      locations: ['สนามรบ', 'หุบเขา'],
      keyEvents: ['การต่อสู้ครั้งแรก', 'การเสียสละ'],
      summary: 'การต่อสู้ครั้งสำคัญ',
      content: ''
    }
  ];

  // สร้างการ์ดแต่ละใบ
  chapterCardsData.forEach((chapterData, index) => {
    const card = createEditableChapterCard(chapterData, index);
    cardsContainer.appendChild(card);
  });

  // เพิ่มการ์ดเพิ่มบทใหม่
  const addCard = createAddChapterCard();
  cardsContainer.appendChild(addCard);

  console.log(`📋 สร้างการ์ดบท ${chapterCardsData.length} ใบเรียบร้อย`);
}

// สร้างการ์ดที่แก้ไขได้
function createEditableChapterCard(data, index) {
  const card = document.createElement('div');
  card.className = 'chapter-info-card editable-card';
  card.dataset.chapterId = data.id;

  card.innerHTML = `
    <div class="card-header">
      <div class="chapter-number">${index + 1}</div>
      <button class="edit-toggle-btn" onclick="toggleCardEdit('${data.id}')">
        <i class="fas fa-edit"></i>
      </button>
    </div>

    <div class="card-content">
      <!-- Title Section -->
      <div class="editable-section">
        <div class="display-mode">
          <h4 class="card-title">${data.title}</h4>
        </div>
        <div class="edit-mode" style="display: none;">
          <input type="text" class="title-edit" value="${data.title}" placeholder="ชื่อบท">
        </div>
      </div>

      <!-- Characters Section -->
      <div class="metadata-section">
        <div class="metadata-label">
          <i class="fas fa-users"></i> ตัวละคร
        </div>
        <div class="editable-section">
          <div class="display-mode">
            <div class="tags-display characters-tags">
              ${data.characters.map(char => `<span class="metadata-tag">${char}</span>`).join('')}
            </div>
          </div>
          <div class="edit-mode" style="display: none;">
            <input type="text" class="characters-edit" value="${data.characters.join(', ')}" placeholder="ตัวละคร (คั่นด้วยจุลภาค)">
          </div>
        </div>
      </div>

      <!-- Locations Section -->
      <div class="metadata-section">
        <div class="metadata-label">
          <i class="fas fa-map-marker-alt"></i> สถานที่
        </div>
        <div class="editable-section">
          <div class="display-mode">
            <div class="tags-display locations-tags">
              ${data.locations.map(loc => `<span class="metadata-tag location-tag">${loc}</span>`).join('')}
            </div>
          </div>
          <div class="edit-mode" style="display: none;">
            <input type="text" class="locations-edit" value="${data.locations.join(', ')}" placeholder="สถานที่ (คั่นด้วยจุลภาค)">
          </div>
        </div>
      </div>

      <!-- Key Events Section -->
      <div class="metadata-section">
        <div class="metadata-label">
          <i class="fas fa-star"></i> เหตุการณ์สำคัญ
        </div>
        <div class="editable-section">
          <div class="display-mode">
            <div class="tags-display events-tags">
              ${data.keyEvents.map(event => `<span class="metadata-tag event-tag">${event}</span>`).join('')}
            </div>
          </div>
          <div class="edit-mode" style="display: none;">
            <input type="text" class="events-edit" value="${data.keyEvents.join(', ')}" placeholder="เหตุการณ์สำคัญ (คั่นด้วยจุลภาค)">
          </div>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div class="quick-actions">
        <button class="action-btn jump-btn" onclick="jumpToChapter('${data.id}')" title="กระโดดไปยังบทนี้">
          <i class="fas fa-arrow-right"></i>
        </button>
        <button class="action-btn view-btn" onclick="previewChapter('${data.id}')" title="ดูตัวอย่าง">
          <i class="fas fa-eye"></i>
        </button>
      </div>

      <div class="edit-actions" style="display: none;">
        <button class="save-btn" onclick="saveCardEdits('${data.id}')">
          <i class="fas fa-check"></i> บันทึก
        </button>
        <button class="cancel-btn" onclick="cancelCardEdits('${data.id}')">
          <i class="fas fa-times"></i> ยกเลิก
        </button>
      </div>
    </div>
  `;

  return card;
}

// สร้างการ์ดเพิ่มบทใหม่
function createAddChapterCard() {
  const card = document.createElement('div');
  card.className = 'chapter-info-card add-chapter-card';
  card.innerHTML = `
    <div class="add-card-content" onclick="addNewChapter()">
      <i class="fas fa-plus"></i>
      <span>เพิ่มบทใหม่</span>
    </div>
  `;
  return card;
}

// ฟังก์ชันการทำงานของการ์ด
function toggleCardEdit(chapterId) {
  const card = document.querySelector(`[data-chapter-id="${chapterId}"]`);
  if (!card) return;

  const isEditing = card.classList.contains('editing');

  if (isEditing) {
    // บันทึกการแก้ไข
    saveCardEdits(chapterId);
  } else {
    // เข้าสู่โหมดแก้ไข
    enterEditMode(card);
  }
}

function enterEditMode(card) {
  card.classList.add('editing');

  // แสดงโหมดแก้ไข ซ่อนโหมดแสดงผล
  const displayModes = card.querySelectorAll('.display-mode');
  const editModes = card.querySelectorAll('.edit-mode');
  const quickActions = card.querySelector('.quick-actions');
  const editActions = card.querySelector('.edit-actions');

  displayModes.forEach(mode => mode.style.display = 'none');
  editModes.forEach(mode => mode.style.display = 'block');

  if (quickActions) quickActions.style.display = 'none';
  if (editActions) editActions.style.display = 'flex';

  // เปลี่ยนไอคอนปุ่มแก้ไข
  const editBtn = card.querySelector('.edit-toggle-btn i');
  if (editBtn) {
    editBtn.className = 'fas fa-check';
  }
}

function saveCardEdits(chapterId) {
  const card = document.querySelector(`[data-chapter-id="${chapterId}"]`);
  if (!card) return;

  // ดึงข้อมูลจากฟอร์มแก้ไข
  const titleEdit = card.querySelector('.title-edit');
  const charactersEdit = card.querySelector('.characters-edit');
  const locationsEdit = card.querySelector('.locations-edit');
  const eventsEdit = card.querySelector('.events-edit');

  // อัปเดตการแสดงผล
  const cardTitle = card.querySelector('.card-title');
  const charactersDisplay = card.querySelector('.characters-tags');
  const locationsDisplay = card.querySelector('.locations-tags');
  const eventsDisplay = card.querySelector('.events-tags');

  if (titleEdit && cardTitle) {
    cardTitle.textContent = titleEdit.value;
  }

  if (charactersEdit && charactersDisplay) {
    const characters = charactersEdit.value.split(',').map(s => s.trim()).filter(s => s);
    charactersDisplay.innerHTML = characters.map(char =>
      `<span class="metadata-tag">${char}</span>`
    ).join('');
  }

  if (locationsEdit && locationsDisplay) {
    const locations = locationsEdit.value.split(',').map(s => s.trim()).filter(s => s);
    locationsDisplay.innerHTML = locations.map(loc =>
      `<span class="metadata-tag location-tag">${loc}</span>`
    ).join('');
  }

  if (eventsEdit && eventsDisplay) {
    const events = eventsEdit.value.split(',').map(s => s.trim()).filter(s => s);
    eventsDisplay.innerHTML = events.map(event =>
      `<span class="metadata-tag event-tag">${event}</span>`
    ).join('');
  }

  // ออกจากโหมดแก้ไข
  exitEditMode(card);

  // บันทึกข้อมูลและซิงค์กับเนื้อหาหลัก
  syncCardToMainContent(chapterId);

  console.log(`💾 บันทึกการ์ด ${chapterId} สำเร็จ`);
}

function cancelCardEdits(chapterId) {
  const card = document.querySelector(`[data-chapter-id="${chapterId}"]`);
  if (!card) return;
  exitEditMode(card);
}

function exitEditMode(card) {
  card.classList.remove('editing');

  // แสดงโหมดแสดงผล ซ่อนโหมดแก้ไข
  const displayModes = card.querySelectorAll('.display-mode');
  const editModes = card.querySelectorAll('.edit-mode');
  const quickActions = card.querySelector('.quick-actions');
  const editActions = card.querySelector('.edit-actions');

  displayModes.forEach(mode => mode.style.display = 'block');
  editModes.forEach(mode => mode.style.display = 'none');

  if (quickActions) quickActions.style.display = 'flex';
  if (editActions) editActions.style.display = 'none';

  // เปลี่ยนไอคอนปุ่มแก้ไข
  const editBtn = card.querySelector('.edit-toggle-btn i');
  if (editBtn) {
    editBtn.className = 'fas fa-edit';
  }
}

// ฟังก์ชันเชื่อมโยงกับเนื้อหาหลัก
function syncCardToMainContent(chapterId) {
  // ในอนาคตจะเชื่อมโยงกับระบบ AI เพื่ออัปเดตเนื้อหาหลัก
  console.log(`🔄 ซิงค์การ์ด ${chapterId} กับเนื้อหาหลัก`);
}

function jumpToChapter(chapterId) {
  // เปลี่ยนไปยังโมดูลเขียนและโหลดเนื้อหาบท
  switchModule('writing');
  loadChapterContent(chapterId);
  console.log(`🎯 กระโดดไปยังบท ${chapterId}`);
}

function previewChapter(chapterId) {
  // เปิดโมดอลพรีวิวบท
  console.log(`👁️ พรีวิวบท ${chapterId}`);
}

function loadChapterContent(chapterId) {
  const writingEditor = document.getElementById('writingEditor');
  if (!writingEditor) return;

  // ข้อมูลตัวอย่าง - ในอนาคตจะดึงจาก Firebase
  const chapterContent = {
    'chapter-1': 'ในวันที่ท้องฟ้าครึ้มเมฆดำ เจ้าหญิงลิเหมยนั่งอยู่ริมหน้าต่างห้องนอนของเธอ...',
    'chapter-2': 'ป่าลึกในยามค่ำคืนเต็มไปด้วยเสียงแปลกๆ...',
    'chapter-3': 'การเดินทางร่วมกันของลิเหมยและเฉิน เหอ...'
  };

  const content = chapterContent[chapterId] || '';
  writingEditor.value = content;
  writingEditor.focus();
}

function addNewChapter() {
  const newChapterId = `chapter-${Date.now()}`;
  const newChapterData = {
    id: newChapterId,
    title: 'บทใหม่',
    characters: [],
    locations: [],
    keyEvents: [],
    summary: '',
    content: ''
  };

  // เพิ่มการ์ดใหม่
  const cardsContainer = document.getElementById('chapterInfoCards');
  const addCard = cardsContainer.querySelector('.add-chapter-card');
  const newCard = createEditableChapterCard(newChapterData, cardsContainer.children.length);

  cardsContainer.insertBefore(newCard, addCard);

  // เข้าสู่โหมดแก้ไขทันที
  setTimeout(() => {
    enterEditMode(newCard);
    const titleInput = newCard.querySelector('.title-edit');
    if (titleInput) {
      titleInput.focus();
      titleInput.select();
    }
  }, 100);

  console.log(`➕ เพิ่มบทใหม่: ${newChapterId}`);
}

// Chapter Cards Trigger
  const chapterCardsTrigger = document.getElementById('chapterCardsTrigger');
  const chapterCardsOverlay = document.getElementById('chapterCardsOverlay');

  if (chapterCardsTrigger && chapterCardsOverlay) {
    chapterCardsTrigger.addEventListener('click', function() {
      chapterCardsOverlay.style.display = 'flex';
      toggleWritingAreaBorder(true); // เปิดเส้นขอบ
      generateChapterCards();
    });

    chapterCardsOverlay.addEventListener('click', function(e) {
      if (e.target === chapterCardsOverlay) {
        chapterCardsOverlay.style.display = 'none';
        toggleWritingAreaBorder(false); // ปิดเส้นขอบ
      }
    });
  }

// Export for debugging and module access
window.appState = appState;
window.saveToFirebase = saveToFirebase;
window.performSystemHealthCheck = performSystemHealthCheck;
window.showSaveStatus = showSaveStatus;

console.log('✨ คัมภีร์หมื่นอักษร - พร้อมใช้งาน');

// ฟังก์ชันเพิ่มปุ่มเลื่อน
function addScrollButtons(container) {
  // สร้างปุ่มเลื่อนซ้าย
  const leftBtn = document.createElement('button');
  leftBtn.className = 'scroll-btn scroll-left';
  leftBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
  leftBtn.style.cssText = `
    position: absolute;
    left: 5px;
    top: 50%;
    transform: translateY(-50%);
    background: rgba(212, 175, 55, 0.9);
    border: none;
    border-radius: 50%;
    width: 35px;
    height: 35px;
    color: white;
    cursor: pointer;
    z-index: 1001;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    backdrop-filter: blur(10px);
  `;

  // สร้างปุ่มเลื่อนขวา
  const rightBtn = document.createElement('button');
  rightBtn.className = 'scroll-btn scroll-right';
  rightBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
  rightBtn.style.cssText = leftBtn.style.cssText.replace('left: 5px', 'right: 5px');

  // เพิ่มเอฟเฟกต์ hover
  [leftBtn, rightBtn].forEach(btn => {
    btn.addEventListener('mouseenter', () => {
      btn.style.transform = btn.className.includes('left') ?
        'translateY(-50%) scale(1.1) translateX(-2px)' :
        'translateY(-50%) scale(1.1) translateX(2px)';
      btn.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.3)';
    });

    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'translateY(-50%) scale(1)';
      btn.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
    });
  });

  // เพิ่มฟังก์ชันเลื่อน
  leftBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.scrollBy({ left: -180, behavior: 'smooth' });
  });

  rightBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    container.scrollBy({ left: 180, behavior: 'smooth' });
  });

  // เพิ่มปุ่มเข้า overlay
  const overlay = document.getElementById('chapterCardsOverlay');
  overlay.appendChild(leftBtn);
  overlay.appendChild(rightBtn);

  // อัพเดทการมองเห็นปุ่ม
  function updateScrollButtons() {
    const scrollLeft = container.scrollLeft;
    const maxScroll = container.scrollWidth - container.clientWidth;

    leftBtn.style.opacity = scrollLeft > 0 ? '1' : '0.5';
    rightBtn.style.opacity = scrollLeft < maxScroll ? '1' : '0.5';
  }

  container.addEventListener('scroll', updateScrollButtons);
  updateScrollButtons();
}
