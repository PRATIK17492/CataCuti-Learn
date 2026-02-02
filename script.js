// ============================================
// CataCuti App - Complete Learning Platform
// Version: 2.2 with Stable Backend Sync
// ============================================

// Global Variables
let currentUser = null;
let users = JSON.parse(localStorage.getItem('catacutiUsers') || '[]');
let subjects = JSON.parse(localStorage.getItem('catacutiSubjects') || '[]');
let chapters = JSON.parse(localStorage.getItem('catacutiChapters') || '[]');
let videos = JSON.parse(localStorage.getItem('catacutiVideos') || '[]');
let questions = JSON.parse(localStorage.getItem('catacutiQuestions') || '[]');
let notes = JSON.parse(localStorage.getItem('catacutiNotes') || '[]');
let liveClasses = JSON.parse(localStorage.getItem('catacutiLiveClasses') || '[]');
let userProgress = JSON.parse(localStorage.getItem('catacutiUserProgress') || '{}');
let appClasses = JSON.parse(localStorage.getItem('catacutiClasses') || '[]');
let chatMessages = [];
let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = [];
let searchQuery = '';
let currentSubject = 'math';
let currentSection = 'chapters';

// Sync Configuration
const APP_ID = 'catacuti-app-cloud-v2';
let lastSyncTime = localStorage.getItem('catacutiLastSync') || 0;
let isSyncing = false;
let syncTimeout = null;

// ============================================
// BACKEND API SYNC SYSTEM (STABLE VERSION)
// ============================================

function initBackendSync() {
    console.log('🚀 Initializing stable backend sync...');
    
    // Load from backend once on startup
    setTimeout(loadFromBackendOnce, 1000);
    
    // Start periodic sync (less frequent)
    setInterval(() => {
        if (!isSyncing && currentUser) {
            safeSync();
        }
    }, 30000); // Every 30 seconds
    
    console.log('✅ Backend sync initialized');
}

async function loadFromBackendOnce() {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
        console.log('📡 Loading content from backend...');
        const response = await fetch('/api/content');
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.data) {
                console.log(`✅ Loaded ${data.data.length} items from backend`);
                
                // Process backend content without refreshing UI
                data.data.forEach(backendItem => {
                    const existingIndex = chapters.findIndex(ch => 
                        ch.title === backendItem.title && 
                        ch.class === (backendItem.classes?.split(',')[0] || 'All Classes')
                    );
                    
                    if (existingIndex === -1) {
                        // Add new chapter from backend
                        chapters.push({
                            id: backendItem.id.toString(),
                            title: backendItem.title,
                            description: backendItem.description || '',
                            subjectId: backendItem.subject.toLowerCase(),
                            difficulty: backendItem.difficulty || 'beginner',
                            questions: 5,
                            duration: 45,
                            class: backendItem.classes?.split(',')[0] || 'All Classes',
                            source: 'backend',
                            createdAt: new Date(backendItem.created_at).getTime() || Date.now(),
                            updatedAt: Date.now()
                        });
                    }
                });
                
                // Save without triggering UI refresh
                saveDataSilently();
            }
        }
    } catch (error) {
        console.log('⚠️ Backend not available:', error.message);
    } finally {
        isSyncing = false;
        lastSyncTime = Date.now();
        localStorage.setItem('catacutiLastSync', lastSyncTime.toString());
    }
}

async function safeSync() {
    if (isSyncing) return;
    isSyncing = true;
    
    try {
        // Only sync progress, not content fetching
        if (currentUser && userProgress[currentUser.id]) {
            const progressData = userProgress[currentUser.id];
            
            for (const chapterId in progressData) {
                const chapterProgress = progressData[chapterId];
                const chapter = chapters.find(ch => ch.id === chapterId);
                
                if (chapter) {
                    await fetch('/api/progress', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            user_id: parseInt(currentUser.id) || 1,
                            subject: chapter.subjectId,
                            chapter: chapter.title,
                            score: chapterProgress.score,
                            completed: chapterProgress.completed ? 1 : 0
                        })
                    });
                }
            }
        }
        
        console.log('✅ Progress synced to backend');
    } catch (error) {
        console.error('Sync error:', error);
    } finally {
        isSyncing = false;
    }
}

// Admin content sync - only when admin adds content
async function syncSingleChapterToBackend(chapter) {
    try {
        const response = await fetch('/api/content', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: chapter.title,
                description: chapter.description,
                subject: chapter.subjectId.charAt(0).toUpperCase() + chapter.subjectId.slice(1),
                chapter: `Chapter ${chapter.id}`,
                content_type: 'notes',
                difficulty: chapter.difficulty,
                classes: chapter.class,
                notes: chapter.description,
                created_at: new Date().toISOString()
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Update chapter with backend ID
            const index = chapters.findIndex(ch => ch.id === chapter.id);
            if (index !== -1) {
                chapters[index].source = 'backend';
                chapters[index].backendId = data.data?.id;
                saveAllData();
            }
            return true;
        }
    } catch (error) {
        console.error('Backend sync error:', error);
    }
    return false;
}

// ============================================
// LOCAL DATA MANAGEMENT (STABLE)
// ============================================

function saveAllData() {
    if (syncTimeout) clearTimeout(syncTimeout);
    
    syncTimeout = setTimeout(() => {
        try {
            localStorage.setItem('catacutiUsers', JSON.stringify(users));
            localStorage.setItem('catacutiSubjects', JSON.stringify(subjects));
            localStorage.setItem('catacutiChapters', JSON.stringify(chapters));
            localStorage.setItem('catacutiVideos', JSON.stringify(videos));
            localStorage.setItem('catacutiQuestions', JSON.stringify(questions));
            localStorage.setItem('catacutiNotes', JSON.stringify(notes));
            localStorage.setItem('catacutiLiveClasses', JSON.stringify(liveClasses));
            localStorage.setItem('catacutiUserProgress', JSON.stringify(userProgress));
            localStorage.setItem('catacutiClasses', JSON.stringify(appClasses));
            localStorage.setItem('catacutiLastUpdate', Date.now().toString());
            
            console.log('💾 Data saved at', new Date().toLocaleTimeString());
        } catch (error) {
            console.error('Save error:', error);
        }
    }, 500);
}

function saveDataSilently() {
    try {
        localStorage.setItem('catacutiChapters', JSON.stringify(chapters));
        localStorage.setItem('catacutiLastUpdate', Date.now().toString());
    } catch (error) {
        console.error('Silent save error:', error);
    }
}

// ============================================
// INITIALIZATION
// ============================================

function initializeData() {
    console.log('🚀 Initializing CataCuti App...');
    
    // Initialize default data
    if (appClasses.length === 0) {
        appClasses = ['6th Grade', '7th Grade', '8th Grade', '9th Grade', '10th Grade'];
    }
    
    if (users.length === 0) {
        users = [
            {
                id: '1',
                email: 'student@gmail.com',
                password: '123456',
                displayName: 'Demo Student',
                class: '8th Grade',
                gender: 'male',
                school: 'Demo Public School',
                streak: 5,
                coins: 250,
                level: 2,
                isAdmin: false,
                isSuperAdmin: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            {
                id: '2',
                email: 'pratikpreetam1714@gmail.com',
                password: 'pratik17',
                displayName: 'Dr. Pratik Platinum',
                class: '8th Grade',
                gender: 'male',
                school: 'CataCuti Institute',
                streak: 100,
                coins: 1000,
                level: 10,
                isAdmin: true,
                isSuperAdmin: true,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        ];
    }
    
    if (subjects.length === 0) {
        subjects = [
            {
                id: 'math',
                name: 'Mathematics',
                description: 'Learn math concepts from basic to advanced',
                color: '#4361ee',
                classes: appClasses,
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            {
                id: 'science',
                name: 'Science',
                description: 'Explore scientific concepts and experiments',
                color: '#4CAF50',
                classes: appClasses,
                createdAt: Date.now(),
                updatedAt: Date.now()
            },
            {
                id: 'english',
                name: 'English',
                description: 'Improve language and communication skills',
                color: '#FF9800',
                classes: appClasses,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        ];
    }
    
    if (chapters.length === 0) {
        const demoChapters = [
            { class: '8th Grade', subject: 'math', title: 'Algebra Basics', difficulty: 'beginner', questions: 5, duration: 45 },
            { class: '9th Grade', subject: 'math', title: 'Geometry Introduction', difficulty: 'intermediate', questions: 6, duration: 60 },
            { class: '10th Grade', subject: 'math', title: 'Trigonometry', difficulty: 'advanced', questions: 8, duration: 75 },
            { class: '8th Grade', subject: 'science', title: 'Basic Physics', difficulty: 'beginner', questions: 4, duration: 40 },
            { class: '9th Grade', subject: 'science', title: 'Chemistry Basics', difficulty: 'intermediate', questions: 7, duration: 65 }
        ];
        
        demoChapters.forEach((demo, index) => {
            chapters.push({
                id: (index + 1).toString(),
                subjectId: demo.subject,
                title: demo.title,
                description: `${demo.title} for ${demo.class}`,
                difficulty: demo.difficulty,
                questions: demo.questions,
                duration: demo.duration,
                class: demo.class,
                createdAt: Date.now(),
                updatedAt: Date.now()
            });
        });
    }
    
    saveAllData();
    initBackendSync();
    console.log('✅ App initialized successfully');
}

// ============================================
// AUTHENTICATION SYSTEM (UNCHANGED)
// ============================================

function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const isSignup = document.getElementById('switchBtn').textContent.includes('Login');
    
    if (isSignup) {
        const name = document.getElementById('loginName').value;
        const studentClass = document.getElementById('loginClass').value;
        const gender = document.getElementById('loginGender').value;
        const school = document.getElementById('loginSchool').value;
        signup(email, password, name, studentClass, gender, school);
    } else {
        login(email, password);
    }
}

function login(email, password) {
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        currentUser = user;
        localStorage.setItem('catacutiCurrentUser', JSON.stringify(user));
        showNotification(`Welcome back, ${user.displayName}!`, 'success');
        showHomeScreen();
    } else {
        showNotification('Invalid email or password.', 'error');
    }
}

function signup(email, password, displayName, studentClass, gender, school) {
    if (users.find(u => u.email === email)) {
        showNotification('User already exists. Please login.', 'error');
        return;
    }

    if (!email || !password || !displayName || !studentClass || !gender || !school) {
        showNotification('Please fill in all fields', 'error');
        return;
    }

    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }

    const newUser = {
        id: Date.now().toString(),
        email: email,
        password: password,
        displayName: displayName,
        class: studentClass,
        gender: gender,
        school: school,
        streak: 0,
        coins: 100,
        level: 1,
        isAdmin: false,
        isSuperAdmin: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    users.push(newUser);
    currentUser = newUser;
    localStorage.setItem('catacutiCurrentUser', JSON.stringify(newUser));
    saveAllData();
    
    showNotification(`Welcome ${displayName}! Account created.`, 'success');
    showHomeScreen();
}

function toggleSignup() {
    const switchBtn = document.getElementById('switchBtn');
    const loginBtn = document.getElementById('loginBtn');
    const nameInput = document.getElementById('loginName');
    const classInput = document.getElementById('loginClass');
    const genderInput = document.getElementById('loginGender');
    const schoolInput = document.getElementById('loginSchool');
    
    if (switchBtn.textContent.includes('Register')) {
        switchBtn.textContent = 'Already have an account? Login';
        loginBtn.textContent = 'Create Account';
        nameInput.style.display = 'block';
        classInput.style.display = 'block';
        genderInput.style.display = 'block';
        schoolInput.style.display = 'block';
    } else {
        switchBtn.textContent = 'Register as Student';
        loginBtn.textContent = 'Login';
        nameInput.style.display = 'none';
        classInput.style.display = 'none';
        genderInput.style.display = 'none';
        schoolInput.style.display = 'none';
    }
}

function logout() {
    currentUser = null;
    localStorage.removeItem('catacutiCurrentUser');
    showLoginScreen();
}

// ============================================
// MAIN SCREENS (STABLE VERSION)
// ============================================

function showLoginScreen() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('app').innerHTML = '';
}

function showHomeScreen() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('adminModal').style.display = 'none';
    document.getElementById('classModal').style.display = 'none';
    
    // Filter content by user's class
    const subjectChapters = chapters.filter(ch => 
        ch.subjectId === currentSubject && 
        ch.class === currentUser.class
    );
    
    const subjectVideos = videos.filter(vid => 
        vid.subjectId === currentSubject && 
        vid.class === currentUser.class
    );
    
    const userLiveClasses = liveClasses.filter(lc => 
        lc.class === currentUser.class
    );
    
    const userProgressData = userProgress[currentUser.id] || {};
    const overallAccuracy = calculateOverallAccuracy(userProgressData);
    const chaptersCompleted = calculateChaptersCompleted(userProgressData);
    
    let contentHTML = '';
    
    if (currentSection === 'chapters') {
        contentHTML = `
            <div class="content-section">
                <h3>📚 Chapters (${filterChapters(subjectChapters).length})</h3>
                ${filterChapters(subjectChapters).length === 0 ? 
                    `<div class="empty-state">
                        <div class="empty-icon">📚</div>
                        <h4>No chapters available</h4>
                        <p>No chapters found for ${currentUser.class} - ${subjects.find(s => s.id === currentSubject)?.name}</p>
                        ${currentUser.isAdmin ? '<button class="streak-btn" onclick="loadAdminContent(\'chapters\'); showAdminPanel()">Add Chapters</button>' : ''}
                    </div>` :
                    `<div class="content-grid">
                        ${filterChapters(subjectChapters).map(chapter => `
                            <div class="content-card" onclick="showChapterNotes('${chapter.id}')">
                                <h4>${chapter.title}</h4>
                                <p>${chapter.description}</p>
                                <div class="content-meta">
                                    <span>📊 ${chapter.questions} questions</span>
                                    <span>⏱️ ${chapter.duration} min</span>
                                    <span class="class-badge">${chapter.class}</span>
                                    <span class="difficulty-badge ${chapter.difficulty}">${chapter.difficulty}</span>
                                    ${chapter.source === 'backend' ? '<span style="background:#28a745;color:white;padding:2px 6px;border-radius:10px;font-size:0.7rem;">🔄</span>' : ''}
                                </div>
                                ${userProgressData[chapter.id] ? 
                                    `<div class="progress-indicator">
                                        <div class="progress-bar">
                                            <div class="progress-fill" style="width: ${userProgressData[chapter.id].score}%"></div>
                                        </div>
                                        <span>${userProgressData[chapter.id].score}%</span>
                                    </div>` : 
                                    ''
                                }
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;
    } else if (currentSection === 'videos') {
        contentHTML = `
            <div class="content-section">
                <h3>🎥 Video Lessons (${filterVideos(subjectVideos).length})</h3>
                ${filterVideos(subjectVideos).length === 0 ? 
                    `<div class="empty-state">
                        <div class="empty-icon">🎥</div>
                        <h4>No videos available</h4>
                        <p>No videos found for ${currentUser.class} - ${subjects.find(s => s.id === currentSubject)?.name}</p>
                    </div>` :
                    `<div class="content-grid">
                        ${filterVideos(subjectVideos).map(video => `
                            <div class="content-card" onclick="playVideo('${video.id}')">
                                <h4>${video.title}</h4>
                                <p>${video.description}</p>
                                <div class="content-meta">
                                    <span>⏱️ ${video.duration}</span>
                                    <span class="class-badge">${video.class}</span>
                                    <span>🎬 Video Lesson</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>
        `;
    } else if (currentSection === 'progress') {
        const userClassChapters = chapters.filter(ch => ch.class === currentUser.class);
        const userClassChaptersCompleted = userClassChapters.filter(ch => {
            const progress = userProgress[currentUser.id] || {};
            return progress[ch.id] && progress[ch.id].completed;
        }).length;
        
        contentHTML = `
            <div class="progress-grid">
                <div class="progress-card">
                    <div class="progress-number">${overallAccuracy}%</div>
                    <div class="progress-label">Overall Accuracy</div>
                </div>
                <div class="progress-card">
                    <div class="progress-number">${userClassChaptersCompleted}/${userClassChapters.length}</div>
                    <div class="progress-label">Chapters Completed</div>
                </div>
                <div class="progress-card">
                    <div class="progress-number">${Math.round(currentUser.coins / 10)}h</div>
                    <div class="progress-label">Study Hours</div>
                </div>
                <div class="progress-card">
                    <div class="progress-number">${currentUser.streak}🔥</div>
                    <div class="progress-label">Day Streak</div>
                </div>
            </div>

            <div class="content-section">
                <h3>📊 Subject-wise Performance</h3>
                <div class="content-grid">
                    ${subjects.map(subject => {
                        const subjectChapters = chapters.filter(ch => 
                            ch.subjectId === subject.id && ch.class === currentUser.class
                        );
                        const completed = subjectChapters.filter(ch => {
                            const progress = userProgress[currentUser.id] || {};
                            return progress[ch.id] && progress[ch.id].completed;
                        }).length;
                        const percentage = subjectChapters.length > 0 ? Math.round((completed / subjectChapters.length) * 100) : 0;
                        
                        return `
                            <div class="content-card">
                                <h4 style="color: ${subject.color}">${subject.name}</h4>
                                <p>${completed}/${subjectChapters.length} chapters completed</p>
                                <div class="progress-bar">
                                    <div class="progress-fill" style="width: ${percentage}%; background: ${subject.color}"></div>
                                </div>
                                <div class="content-meta">
                                    <span>${percentage}% Complete</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } else if (currentSection === 'live') {
        contentHTML = `
            <div class="content-section">
                <h3>🎥 Live Classes (${userLiveClasses.length})</h3>
                ${userLiveClasses.length === 0 ? 
                    `<div class="empty-state">
                        <div class="empty-icon">🎥</div>
                        <h4>No live classes scheduled</h4>
                        <p>No live classes scheduled for ${currentUser.class} yet.</p>
                        ${currentUser.isAdmin ? '<button class="streak-btn" onclick="showLiveClassForm()">Schedule Live Class</button>' : ''}
                    </div>` :
                    `<div class="content-grid">
                        ${userLiveClasses.map(liveClass => {
                            const scheduleDate = new Date(liveClass.schedule);
                            const now = new Date();
                            const timeDiff = scheduleDate - now;
                            const hoursUntil = Math.floor(timeDiff / (1000 * 60 * 60));
                            const minutesUntil = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
                            
                            let statusBadge = '';
                            if (liveClass.status === 'live') {
                                statusBadge = '<span class="live-status live">🔴 LIVE NOW</span>';
                            } else if (liveClass.status === 'scheduled') {
                                statusBadge = `<span class="live-status scheduled">⏰ In ${hoursUntil}h ${minutesUntil}m</span>`;
                            } else {
                                statusBadge = '<span class="live-status completed">✅ Completed</span>';
                            }
                            
                            return `
                                <div class="content-card ${liveClass.status === 'live' ? 'live-now' : ''}">
                                    <h4>${liveClass.title}</h4>
                                    <p>${liveClass.description}</p>
                                    <div class="content-meta">
                                        <span>📚 ${liveClass.subject}</span>
                                        <span>👨‍🏫 ${liveClass.teacher}</span>
                                        <span>⏱️ ${liveClass.duration}</span>
                                        <span>📅 ${new Date(liveClass.schedule).toLocaleDateString()}</span>
                                    </div>
                                    <div style="margin-top: 10px;">
                                        ${statusBadge}
                                        ${liveClass.status === 'live' || liveClass.status === 'scheduled' ? 
                                            `<button class="streak-btn join-btn" onclick="joinLiveClass('${liveClass.id}')" style="margin-top: 10px; width: 100%;">
                                                ${liveClass.status === 'live' ? 'Join Now 🔴' : 'Set Reminder ⏰'}
                                            </button>` : ''
                                        }
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>`
                }
                ${currentUser.isAdmin ? 
                    `<button class="streak-btn" onclick="showLiveClassForm()" style="margin-top: 20px; width: 100%;">
                        🎥 Schedule New Live Class
                    </button>` : ''
                }
            </div>
        `;
    }
    
    document.getElementById('app').innerHTML = `
        <div class="home-container">
            <div class="home-header">
                <div>
                    <h1>Welcome back, ${currentUser.displayName}! 👋</h1>
                    <p>📧 ${currentUser.email} • 🏫 ${currentUser.class} • 🎓 ${currentUser.school}</p>
                    <p>🔥 ${currentUser.streak} day streak • ⭐ ${currentUser.coins} coins • 🏆 Level ${currentUser.level}</p>
                </div>
                <div class="header-actions">
                    ${currentUser.isAdmin ? '<button class="admin-btn" onclick="showAdminPanel()">Admin Panel</button>' : ''}
                    ${currentUser.isSuperAdmin ? '<button class="admin-btn" onclick="showClassManagement()" style="background: #9C27B0;">🏫 Manage Classes</button>' : ''}
                    <button class="logout-btn" onclick="logout()">Logout</button>
                </div>
            </div>

            <div class="nav-menu">
                <button class="nav-item ${currentSection === 'chapters' ? 'active' : ''}" onclick="changeSection('chapters')">📚 Chapters</button>
                <button class="nav-item" onclick="showAIDoubtSolver()">🤖 AI Tutor</button>
                <button class="nav-item ${currentSection === 'progress' ? 'active' : ''}" onclick="changeSection('progress')">📊 Progress</button>
                <button class="nav-item ${currentSection === 'videos' ? 'active' : ''}" onclick="changeSection('videos')">🎥 Videos</button>
                <button class="nav-item ${currentSection === 'live' ? 'active' : ''}" onclick="changeSection('live')">🎥 Live Classes</button>
                <button class="nav-item" onclick="showQuizSelection()">🧠 Quiz</button>
                <button class="nav-item" onclick="showCertificate()">🏆 Certificate</button>
            </div>

            <div class="selector-container">
                <p>Choose a subject:</p>
                <div class="selector-scroll">
                    ${subjects.map(subject => `
                        <button class="selector-btn ${currentSubject === subject.id ? 'active' : ''}" 
                                onclick="changeSubject('${subject.id}')"
                                style="background: ${currentSubject === subject.id ? subject.color : '#f0f0f0'}; color: ${currentSubject === subject.id ? 'white' : '#666'}">
                            ${subject.name}
                        </button>
                    `).join('')}
                </div>
            </div>

            <div class="search-container">
                <input type="text" class="search-bar" placeholder="Search chapters, videos, or notes..." 
                       oninput="handleSearch(this.value)" id="searchInput" value="${searchQuery}">
            </div>

            <div class="subject-content">
                ${contentHTML}
            </div>

            <div class="streak-card">
                <h3>🔥 ${currentUser.streak} Day Streak! • ⭐ ${currentUser.coins} Coins</h3>
                <p>Complete today's quiz to keep your streak going and earn coins!</p>
                <button class="streak-btn" onclick="showQuizSelection()">Take Daily Quiz</button>
            </div>
        </div>
    `;
}

// ============================================
// NAVIGATION FUNCTIONS (UNCHANGED)
// ============================================

function changeSubject(subjectId) {
    currentSubject = subjectId;
    showHomeScreen();
}

function changeSection(section) {
    currentSection = section;
    showHomeScreen();
}

function handleSearch(query) {
    searchQuery = query;
    showHomeScreen();
}

function filterChapters(chapterList) {
    if (!searchQuery) return chapterList;
    const query = searchQuery.toLowerCase();
    return chapterList.filter(chapter => 
        chapter.title.toLowerCase().includes(query) || 
        chapter.description.toLowerCase().includes(query)
    );
}

function filterVideos(videoList) {
    if (!searchQuery) return videoList;
    const query = searchQuery.toLowerCase();
    return videoList.filter(video => 
        video.title.toLowerCase().includes(query) || 
        video.description.toLowerCase().includes(query)
    );
}

// ============================================
// ADMIN PANEL - SIMPLIFIED
// ============================================

function showAdminPanel() {
    document.getElementById('adminModal').style.display = 'flex';
    loadAdminContent('chapters');
}

function closeAdminPanel() {
    document.getElementById('adminModal').style.display = 'none';
}

function loadAdminContent(tab) {
    const adminContent = document.querySelector('.admin-content');
    const isSuperAdmin = currentUser.isSuperAdmin;
    
    let filteredChapters = isSuperAdmin ? chapters : chapters.filter(ch => ch.class === currentUser.class);
    
    if (tab === 'chapters') {
        adminContent.innerHTML = `
            <div class="admin-tabs">
                <button class="admin-tab active" onclick="loadAdminContent('chapters')">📚 Chapters</button>
                <button class="admin-tab" onclick="loadAdminContent('videos')">🎥 Videos</button>
                <button class="admin-tab" onclick="loadAdminContent('subjects')">📖 Subjects</button>
                <button class="admin-tab" onclick="loadAdminContent('quiz')">🧠 Quiz</button>
                <button class="admin-tab" onclick="loadAdminContent('notes')">📝 Notes</button>
                <button class="admin-tab" onclick="loadAdminContent('live')">🎥 Live</button>
            </div>
            
            <div class="admin-header">
                <h3>${isSuperAdmin ? 'All Classes' : currentUser.class} - Chapters</h3>
                <button class="add-btn" onclick="showAddChapterForm()">➕ Add Chapter</button>
            </div>
            
            <div id="addChapterForm" class="admin-form" style="display: none;">
                <input type="text" id="chapterTitle" placeholder="Chapter Title">
                <textarea id="chapterDesc" placeholder="Description"></textarea>
                <select id="chapterSubject">
                    <option value="">Select Subject</option>
                    ${subjects.map(sub => `<option value="${sub.id}">${sub.name}</option>`).join('')}
                </select>
                <select id="chapterDifficulty">
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                </select>
                <input type="number" id="chapterQuestions" placeholder="Questions" value="5">
                <input type="number" id="chapterDuration" placeholder="Duration (min)" value="45">
                <select id="chapterClass">
                    <option value="">Select Class</option>
                    ${appClasses.map(cls => `
                        <option value="${cls}" ${cls === currentUser.class && !isSuperAdmin ? 'selected' : ''}>
                            ${cls} ${cls === currentUser.class && !isSuperAdmin ? '(Your Class)' : ''}
                        </option>
                    `).join('')}
                </select>
                <div class="sync-option">
                    <label>
                        <input type="checkbox" id="syncToBackend" checked>
                        Sync to Backend (All users will see this)
                    </label>
                </div>
                <button class="streak-btn" onclick="addChapterAdmin()">Add Chapter</button>
                <button class="secondary-btn" onclick="hideAddChapterForm()">Cancel</button>
            </div>
            
            <div class="content-list">
                ${filteredChapters.map(chapter => {
                    const subject = subjects.find(s => s.id === chapter.subjectId);
                    const isBackendChapter = chapter.source === 'backend';
                    return `
                        <div class="content-item">
                            <div>
                                <strong>${chapter.title} ${isBackendChapter ? '🔄' : ''}</strong>
                                <p>${chapter.description}</p>
                                <small>
                                    📚 ${subject?.name} • 
                                    ⏱️ ${chapter.duration} min • 
                                    📊 ${chapter.questions} questions • 
                                    🏫 ${chapter.class}
                                    ${isBackendChapter ? ' • <span style="color:#28a745;">Shared</span>' : ' • <span style="color:#6c757d;">Local</span>'}
                                </small>
                            </div>
                            <div class="item-actions">
                                <button class="delete-btn" onclick="deleteChapterAdmin('${chapter.id}')">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }
    // Other tabs remain the same...
}

function showAddChapterForm() {
    document.getElementById('addChapterForm').style.display = 'flex';
}

function hideAddChapterForm() {
    document.getElementById('addChapterForm').style.display = 'none';
}

async function addChapterAdmin() {
    const title = document.getElementById('chapterTitle').value;
    const description = document.getElementById('chapterDesc').value;
    const subjectId = document.getElementById('chapterSubject').value;
    const difficulty = document.getElementById('chapterDifficulty').value;
    const questionsCount = document.getElementById('chapterQuestions').value;
    const duration = document.getElementById('chapterDuration').value;
    const chapterClass = document.getElementById('chapterClass').value;
    const syncToBackend = document.getElementById('syncToBackend')?.checked || true;
    
    if (!title || !description || !subjectId || !chapterClass) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    if (!currentUser.isSuperAdmin && chapterClass !== currentUser.class) {
        showNotification('You can only add for your class', 'error');
        return;
    }
    
    // Create chapter object
    const newChapter = {
        id: Date.now().toString(),
        title,
        description,
        subjectId,
        difficulty,
        questions: parseInt(questionsCount) || 0,
        duration: parseInt(duration) || 0,
        class: chapterClass,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    
    // Add to local storage
    chapters.push(newChapter);
    saveAllData();
    
    // Try to sync to backend
    let backendSuccess = false;
    if (syncToBackend) {
        backendSuccess = await syncSingleChapterToBackend(newChapter);
    }
    
    if (syncToBackend && backendSuccess) {
        showNotification('✅ Chapter added and shared with all users!', 'success');
    } else if (syncToBackend) {
        showNotification('⚠️ Chapter added locally. Backend sync failed.', 'warning');
    } else {
        showNotification('Chapter added locally!', 'success');
    }
    
    // Update UI
    hideAddChapterForm();
    loadAdminContent('chapters');
    
    // Refresh home screen if needed
    if (currentUser.class === chapterClass) {
        setTimeout(() => {
            if (document.getElementById('app').innerHTML.includes('Welcome back')) {
                showHomeScreen();
            }
        }, 500);
    }
}

async function deleteChapterAdmin(chapterId) {
    const chapter = chapters.find(ch => ch.id === chapterId);
    if (!chapter) return;
    
    if (!currentUser.isSuperAdmin && chapter.class !== currentUser.class) {
        showNotification('Cannot delete this chapter', 'error');
        return;
    }
    
    if (confirm('Delete this chapter and all related questions/notes?')) {
        // Remove from local storage
        chapters = chapters.filter(ch => ch.id !== chapterId);
        questions = questions.filter(q => q.chapterId !== chapterId);
        notes = notes.filter(n => n.chapterId !== chapterId);
        saveAllData();
        
        // Note: We don't delete from backend as it might be used by others
        showNotification('Chapter deleted locally!', 'success');
        loadAdminContent('chapters');
    }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function showNotification(message, type = 'info') {
    // Remove existing notification
    const existing = document.querySelector('.sync-notification');
    if (existing) existing.remove();
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = `sync-notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;cursor:pointer;">×</button>
    `;
    
    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#dc3545' : type === 'success' ? '#28a745' : '#17a2b8'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        display: flex;
        align-items: center;
        gap: 15px;
        animation: slideInRight 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'fadeOut 0.5s ease';
            setTimeout(() => notification.remove(), 500);
        }
    }, 3000);
}

function calculateOverallAccuracy(progress) {
    const chaptersWithProgress = Object.values(progress).filter(p => p.score > 0);
    if (chaptersWithProgress.length === 0) return 0;
    
    const totalScore = chaptersWithProgress.reduce((sum, p) => sum + p.score, 0);
    return Math.round(totalScore / chaptersWithProgress.length);
}

function calculateChaptersCompleted(progress) {
    return Object.values(progress).filter(p => p.completed).length;
}

// ============================================
// INITIALIZE APP
// ============================================

function initApp() {
    console.log('🚀 Starting CataCuti App...');
    initializeData();
    
    const savedUser = localStorage.getItem('catacutiCurrentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showHomeScreen();
    } else {
        showLoginScreen();
    }
    
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; transform: translateY(-10px); }
        }
    `;
    document.head.appendChild(style);
}

// Start the app
window.onload = initApp;