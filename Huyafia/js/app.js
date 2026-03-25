const DEFAULT_PLAYERS = [
    "Димон", "Вова", "Вадим", "Катя", "Влад", "Рома", "Маша", "Инна",
    "Рябчун", "Виталик", "Стас", "Мотвей", "Надя", "Полина", "Соня",
    "Оля", "Лена", "Тёма"
];

let ALL_PLAYERS = JSON.parse(localStorage.getItem('mafia_players')) || [...DEFAULT_PLAYERS];

// Restore selected players from localStorage
let selectedPlayers = new Set(JSON.parse(localStorage.getItem('mafia_selected_players')) || []);

// Button visibility settings (default all false)
let btnSettings = {
    jail: false,
    poison: false,
    sect: false,
    protect: false,
    alibi: false,
    block: false,
    ...(JSON.parse(localStorage.getItem('mafia_btn_settings')) || {})
};

// Enabled roles for role picker (default: all roles enabled)
const _storedEnabledRoles = JSON.parse(localStorage.getItem('mafia_enabled_roles'));
let enabledRoles = _storedEnabledRoles
    ? new Set(_storedEnabledRoles)
    : new Set(ROLES.map(r => r.id)); // По умолчанию все роли включены

// Show/hide the night actions panel
let showNightPanel = JSON.parse(localStorage.getItem('mafia_show_night_panel')) ?? true;

// Show/hide game clock
let showClock = JSON.parse(localStorage.getItem('mafia_show_clock')) ?? true;

// Show/hide status button rows on player cards
let showStatusRows = JSON.parse(localStorage.getItem('mafia_show_status_rows')) ?? false;

// ── UI settings ──────────────────────────────────────────
let enableAnimations = JSON.parse(localStorage.getItem('mafia_enable_animations')) ?? true;
let showRipple = JSON.parse(localStorage.getItem('mafia_show_ripple')) ?? true;
let enableHaptic = JSON.parse(localStorage.getItem('mafia_enable_haptic')) ?? true;
let showToasts = JSON.parse(localStorage.getItem('mafia_show_toasts')) ?? true;
let hideUnassignedTurnOrder = JSON.parse(localStorage.getItem('mafia_hide_unassigned_to')) ?? false;
let showStatusBadges = JSON.parse(localStorage.getItem('mafia_show_status_badges')) ?? true;
let confirmEliminate = JSON.parse(localStorage.getItem('mafia_confirm_eliminate')) ?? false;
let confirmEndGame = JSON.parse(localStorage.getItem('mafia_confirm_end_game')) ?? true;
let autoAdvanceStep = JSON.parse(localStorage.getItem('mafia_auto_advance_step')) ?? true;
let perfMode = JSON.parse(localStorage.getItem('mafia_perf_mode')) ?? false;

// Layout customization settings
let layoutSettings = {
    density: localStorage.getItem('mafia_layout_density') || 'normal',
    cardSize: localStorage.getItem('mafia_layout_card_size') || 'normal',
    roleDisplay: localStorage.getItem('mafia_layout_role_display') || 'both',
    gridColumns: localStorage.getItem('mafia_layout_grid_cols') || '2',
    roleImgSize: localStorage.getItem('mafia_layout_role_img') || 'normal'
};

// Discussion timer state
let discussionTimerActive = false;
let discussionTimerSeconds = 90; // Default 90 seconds
let discussionTimerInterval = null;
let discussionTimerRemaining = 0;

// ── Discussion Timer functions ──
function formatTimer(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startDiscussionTimer(seconds) {
    if (discussionTimerActive) {
        stopDiscussionTimer();
        return;
    }
    discussionTimerSeconds = seconds || discussionTimerSeconds;
    discussionTimerRemaining = discussionTimerSeconds;
    discussionTimerActive = true;
    updateTimerDisplay();
    discussionTimerInterval = setInterval(() => {
        discussionTimerRemaining--;
        updateTimerDisplay();
        if (discussionTimerRemaining <= 0) {
            stopDiscussionTimer();
            playTimerEndSound();
            haptic('error');
            showToast('Время обсуждения истекло!', '⏰');
            logAction('⏰ Время обсуждения истекло', '');
        }
    }, 1000);
    haptic('medium');
    showToast(`Таймер: ${formatTimer(discussionTimerSeconds)}`, '⏱️');
    logAction(`⏱️ Таймер обсуждения запущен: ${formatTimer(discussionTimerSeconds)}`, '');
}

function stopDiscussionTimer() {
    discussionTimerActive = false;
    if (discussionTimerInterval) {
        clearInterval(discussionTimerInterval);
        discussionTimerInterval = null;
    }
    discussionTimerRemaining = 0;
    updateTimerDisplay();
}

function playTimerEndSound() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.5);
        // Second beep
        setTimeout(() => {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(660, audioCtx.currentTime);
            gain2.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
            osc2.start(audioCtx.currentTime);
            osc2.stop(audioCtx.currentTime + 0.5);
        }, 200);
    } catch (e) { /* Audio not supported */ }
}

function copyActionLog() {
    if (actionLog.length === 0) {
        showToast('Лог пуст', '📋');
        return;
    }
    const text = actionLog.map(e => `[${e.time}] ${e.message.replace(/<[^>]*>/g, '')}`).join('\n');
    navigator.clipboard.writeText(text).then(() => {
        showToast('Лог скопирован!', '📋');
        haptic('success');
    }).catch(() => {
        showToast('Ошибка копирования', '❌');
    });
}

function resetDiscussionTimer() {
    stopDiscussionTimer();
    discussionTimerRemaining = discussionTimerSeconds;
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const timerEl = document.getElementById('discussion-timer');
    const timerBtn = document.getElementById('timer-toggle-btn');
    if (!timerEl || !timerBtn) return;

    if (discussionTimerActive) {
        timerEl.textContent = formatTimer(discussionTimerRemaining);
        timerEl.classList.toggle('timer-warning', discussionTimerRemaining <= 10);
        timerBtn.innerHTML = '<span class="btn-icon-label"><span class="material-symbols-rounded">stop</span><span>Стоп</span></span>';
        timerBtn.classList.remove('btn-dark');
        timerBtn.classList.add('btn-red');
    } else {
        timerEl.textContent = formatTimer(discussionTimerSeconds);
        timerEl.classList.remove('timer-warning');
        timerBtn.innerHTML = '<span class="btn-icon-label"><span class="material-symbols-rounded">timer</span><span>Таймер</span></span>';
        timerBtn.classList.remove('btn-red');
        timerBtn.classList.add('btn-dark');
    }
}

function setTimerPreset(seconds) {
    discussionTimerSeconds = seconds;
    discussionTimerRemaining = seconds;
    updateTimerDisplay();
    haptic('light');
}

function savePlayers() {
    localStorage.setItem('mafia_players', JSON.stringify(ALL_PLAYERS));
    localStorage.setItem('mafia_selected_players', JSON.stringify([...selectedPlayers]));
}

function saveBtnSettings() {
    localStorage.setItem('mafia_btn_settings', JSON.stringify(btnSettings));
}

function saveActionLog() {
    localStorage.setItem('mafia_action_log', JSON.stringify(actionLog));
}

// Save game state (players, night actions, settings)
function saveGameState() {
    localStorage.setItem('mafia_game_players', JSON.stringify(gamePlayers));
    localStorage.setItem('mafia_night_actions', JSON.stringify(nightActions));
    localStorage.setItem('mafia_game_started', gamePlayers.length > 0 ? 'true' : 'false');
    localStorage.setItem('mafia_night_count', nightCount.toString());
    if (gameStartTime) {
        localStorage.setItem('mafia_game_start_time', gameStartTime.toString());
    }
    saveStepModeState();
}

function saveEnabledRoles() {
    localStorage.setItem('mafia_enabled_roles', JSON.stringify([...enabledRoles]));
}

function isRoleEnabled(roleId) {
    return enabledRoles.size === 0 || enabledRoles.has(roleId);
}

function resetStepModeState({ clearStorage = true, preserveSelections = false } = {}) {
    stepModeActive = false;
    stepModeQueue = [];
    stepModeIndex = -1;
    if (!preserveSelections) {
        stepModeSelections = [];
    }
    stepBlockedPending = null;
    stepModeDismissedPromptRoles = new Set();
    stepRolePromptState = null;
    currentNightAction = null;
    document.querySelectorAll('.night-action-btn').forEach(btn => btn.classList.remove('active'));

    const blockedModal = document.getElementById('step-blocked-modal');
    if (blockedModal) blockedModal.classList.remove('active');
    const promptModal = document.getElementById('step-role-prompt-modal');
    if (promptModal) promptModal.classList.remove('active');

    if (clearStorage) {
        localStorage.removeItem(STEP_MODE_STORAGE_KEY);
    }
}

function saveStepModeState() {
    if (!stepModeActive) {
        localStorage.removeItem(STEP_MODE_STORAGE_KEY);
        return;
    }

    const currentStep = getCurrentStep();
    localStorage.setItem(STEP_MODE_STORAGE_KEY, JSON.stringify({
        active: stepModeActive,
        stepModeIndex,
        currentStepKey: currentStep ? currentStep.stepKey : null,
        stepModeSelections,
        stepModeDismissedPromptRoles: [...stepModeDismissedPromptRoles]
    }));
}

function logAction(message, className = '') {
    const now = new Date();
    const timeStr = now.getHours().toString().padStart(2, '0') + ':' +
        now.getMinutes().toString().padStart(2, '0') + ':' +
        now.getSeconds().toString().padStart(2, '0');
    actionLog.unshift({ time: timeStr, message, className });
    if (actionLog.length > 100) actionLog.pop();
    saveActionLog();
    renderActionLog();
}

const ROLES = [
    { id: 'peaceful', name: 'Мирный', team: 'citizen', turnOrder: null },
    { id: 'agent', name: 'Агент', team: 'citizen', turnOrder: 4 },
    { id: 'judge', name: 'Судья', team: 'citizen', turnOrder: 16 },
    { id: 'detective', name: 'Детектив', team: 'citizen', turnOrder: 11 },
    { id: 'journalist', name: 'Журналист', team: 'citizen', turnOrder: 12 },
    { id: 'doctor', name: 'Доктор', team: 'citizen', turnOrder: 2 },
    { id: 'bodyguard', name: 'Телохранитель', team: 'citizen', turnOrder: 3 },
    { id: 'patrol', name: 'Патрульный', team: 'citizen', turnOrder: 11 },
    { id: 'psychic', name: 'Экстрасенс', team: 'citizen', turnOrder: 13 },
    { id: 'fangirl', name: 'Поклонница', team: 'citizen', turnOrder: 17 },
    { id: 'sleuth', name: 'Сыщик', team: 'citizen', turnOrder: 15 },
    { id: 'lucky', name: 'Везунчик', team: 'citizen', turnOrder: null },
    { id: 'avenger', name: 'Мститель', team: 'citizen', turnOrder: null },
    { id: 'mafia', name: 'Мафия', team: 'criminal', turnOrder: 4 },
    { id: 'cartel', name: 'Картель', team: 'criminal', turnOrder: 5 },
    { id: 'lawyer', name: 'Адвокат', team: 'criminal', turnOrder: 1 },
    { id: 'mistress', name: 'Любовница', team: 'criminal', turnOrder: 10 },
    { id: 'tracker', name: 'Ищейка', team: 'criminal', turnOrder: 14 },
    { id: 'werewolf', name: 'Оборотень', team: 'criminal', turnOrder: 4 },
    { id: 'boss', name: 'Босс', team: 'criminal', turnOrder: 4 },
    { id: 'leader', name: 'Главарь', team: 'criminal', turnOrder: 5 },
    { id: 'maniac', name: 'Маньяк', team: 'outcast', turnOrder: 6 },
    { id: 'poisoner', name: 'Отравитель', team: 'outcast', turnOrder: 7 },
    { id: 'sectant', name: 'Сектант', team: 'outcast', turnOrder: 8 },
    { id: 'revolutionary', name: 'Революционер', team: 'outcast', turnOrder: 9 },
];

function getRoleImgPath(roleId) {
    return `Assets/RoleCards/${roleId}.webp`;
}

// ── Refactored: Build player card HTML (eliminates 4x duplication) ──
function buildPlayerCardHTML(player, idx) {
    let classes = 'game-player-card';
    if (player.eliminated) classes += ' eliminated';
    if (player.jailed && !player.eliminated) classes += ' jailed';
    if (player.role) classes += ' team-' + player.role.team;
    if (!player.eliminated) {
        if (player.poisoned) classes += ' poisoned';
        if (player.sected) classes += ' sected';
        if (player.protected) classes += ' protected';
        if (player.alibied) classes += ' alibied';
        if (player.blocked) classes += ' blocked';
    }

    let isSelectedForNight = false;
    if (canSelectPlayerAtNight(player)) {
        isSelectedForNight = isSelectedForNightByIndex(idx);
        if (isSelectedForNight) classes += ' night-selected';
    }

    const teamClass = player.role ? 'team-' + player.role.team : '';
    const roleImg = player.role
        ? `<div class="gp-role-img-wrap"><img src="${getRoleImgPath(player.role.id)}" class="gp-role-img" alt="" loading="lazy" onerror="this.parentElement.style.display='none'"></div>`
        : '';
    const roleText = player.role ? player.role.name : '❓ Назначить роль';

    const nightClickHandler = canSelectPlayerAtNight(player)
        ? `onclick="toggleNightPlayerSelection(${idx}); event.stopPropagation();"`
        : '';

    return {
        className: classes,
        html: `
    <div class="elim-overlay">✕</div>
    <div class="jail-overlay">${jailBarsSVG()}</div>
    <div class="poison-tint"></div>
    <div class="sect-tint"></div>
    <div class="protect-tint"></div>
    <div class="alibi-tint"></div>
    <div class="block-tint"></div>
    ${buildStatusMarkers(player)}
    ${roleImg}
    <div class="gp-content" ${nightClickHandler} style="${canSelectPlayerAtNight(player) ? 'cursor:pointer;' : ''}">
        <div class="gp-top">
            <span class="gp-name ${teamClass}">${player.name}</span>
            <div class="gp-actions">
                <button class="gp-action-btn gp-restore-btn" onclick="restorePlayer(${idx})" title="Воскресить">↩</button>
                <button class="gp-action-btn gp-elim-btn" onclick="eliminatePlayer(${idx})" title="Убить">✕</button>
            </div>
        </div>
        <div class="gp-role ${teamClass}" onclick="openRolePicker(${idx})">${roleText}</div>
        ${buildStatusButtons(idx, player)}
    </div>`
    };
}

// ── Refactored: FLIP animation helper ──
function animateFlip(container, gamePlayers, afterAnimation) {
    // Capture first positions
    const firstPositions = {};
    Array.from(container.querySelectorAll('.game-player-card')).forEach(card => {
        const nameEl = card.querySelector('.gp-name');
        if (nameEl) firstPositions[nameEl.textContent] = card.getBoundingClientRect();
    });

    // Update card content and reorder
    const sorted = [...gamePlayers].sort((a, b) => {
        if (a.eliminated && !b.eliminated) return 1;
        if (!a.eliminated && b.eliminated) return -1;
        return 0;
    });

    sorted.forEach(p => {
        const idxP = gamePlayers.indexOf(p);
        let card = Array.from(container.querySelectorAll('.game-player-card')).find(c => {
            const nameEl = c.querySelector('.gp-name');
            return nameEl && nameEl.textContent === p.name;
        });
        if (!card) { card = document.createElement('div'); container.appendChild(card); }
        const { className, html } = buildPlayerCardHTML(p, idxP);
        card.className = className;
        card.innerHTML = html;
    });

    // Remove extra cards
    const currentNames = sorted.map(p => p.name);
    Array.from(container.querySelectorAll('.game-player-card')).forEach(card => {
        const nameEl = card.querySelector('.gp-name');
        if (!nameEl || !currentNames.includes(nameEl.textContent)) card.remove();
    });

    // Reorder (move to end)
    sorted.forEach(p => {
        const card = Array.from(container.querySelectorAll('.game-player-card')).find(c => {
            const nameEl = c.querySelector('.gp-name');
            return nameEl && nameEl.textContent === p.name;
        });
        if (card) container.appendChild(card);
    });

    // Animate
    setTimeout(() => {
        Array.from(container.querySelectorAll('.game-player-card')).forEach(card => {
            const nameEl = card.querySelector('.gp-name');
            if (!nameEl) return;
            const playerName = nameEl.textContent;
            const playerObj = gamePlayers.find(p => p.name === playerName);
            const first = firstPositions[playerName];
            if (!first) return;
            const last = card.getBoundingClientRect();
            const deltaY = first.top - last.top;
            const deltaX = first.left - last.left;
            card.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
            card.style.transition = 'none';
            if (playerObj && playerObj.eliminated) card.style.opacity = '1';
            card.offsetHeight;
            card.style.transform = '';
            card.style.transition = 'transform 0.25s ease-in-out, opacity 0.25s ease-in';
            if (playerObj && playerObj.eliminated) card.style.opacity = '0.5';
            setTimeout(() => { card.style.transform = ''; card.style.opacity = ''; card.style.transition = ''; }, 250);
        });
        if (afterAnimation) setTimeout(afterAnimation, 250);
    }, 30);
}

let gamePlayers = [];
let currentPickerPlayer = null;
let activeRoleTab = localStorage.getItem('mafia_role_tab') || 'citizen';
let actionLog = JSON.parse(localStorage.getItem('mafia_action_log')) || [];

// Night actions state
let nightActions = {
    kill: [],
    protect: [],
    alibi: [],
    jail: [],
    poison: [],
    sect: [],
    block: []
};
let currentNightAction = null;
let nightCount = 1;
let stepModeActive = false;
let stepModeQueue = [];
let stepModeIndex = -1;
let stepModeSelections = [];
let stepBlockedPending = null;
let stepModeDismissedPromptRoles = new Set();
let stepRolePromptState = null;
let winConditionDismissed = false; // Флаг: окно победы больше не показывать в этой сессии
let gameStartTime = null; // Timestamp when game started
let undoStack = []; // Stack of game state snapshots for undo
const UNDO_MAX = 20;

function takeGameSnapshot(label) {
    undoStack.push({
        label,
        players: JSON.parse(JSON.stringify(gamePlayers)),
        nightCount
    });
    if (undoStack.length > UNDO_MAX) undoStack.shift();
}

function undoLastAction() {
    if (undoStack.length === 0) {
        showToast('Нечего отменять', '↩');
        return;
    }
    const snap = undoStack.pop();
    gamePlayers = snap.players;
    nightCount = snap.nightCount;
    saveGameState();
    renderGame();
    renderTurnOrder();
    renderStats();
    logAction(`↩ Отменено: ${snap.label}`, 'restored');
    showToast(`↩ Отменено: ${snap.label}`, '↩');
    haptic('success');
}
const STEP_MODE_STORAGE_KEY = 'mafia_step_mode_state';
const STEP_MULTI_ASSIGN_ROLE_IDS = new Set(['mafia', 'cartel']);

const ROLE_STEP_CONFIG = {
    doctor: { effectAction: 'protect', question: 'Кого лечит доктор?', targetCount: 1 },
    bodyguard: { effectAction: 'protect', question: 'Кого прикрывает телохранитель?', targetCount: 1 },
    mafia: { effectAction: 'kill', question: 'Кого убивает мафия?', targetCount: 1 },
    cartel: { effectAction: 'kill', question: 'Кого убивает картель?', targetCount: 1 },
    boss: { effectAction: 'kill', question: 'Кого приказывает убить босс?', targetCount: 1 },
    leader: { effectAction: 'kill', question: 'Кого приказывает убить главарь?', targetCount: 1 },
    werewolf: { effectAction: 'kill', question: 'Кого убивает оборотень?', targetCount: 1 },
    maniac: { effectAction: 'kill', question: 'Кого убивает маньяк?', targetCount: 1 },
    revolutionary: { effectAction: 'kill', question: 'Кого убивает революционер?', targetCount: 1 },
    sleuth: { effectAction: 'kill', question: 'Кого выбирает сыщик?', targetCount: 1 },
    judge: { effectAction: 'jail', question: 'Кого сажает в тюрьму судья?', targetCount: 1 },
    fangirl: { effectAction: 'alibi', question: 'Кому выдаёт алиби поклонница?', targetCount: 1 },
    lawyer: { effectAction: 'block', question: 'Кого блокирует адвокат?', targetCount: 1 },
    poisoner: { effectAction: 'poison', question: 'Кого отравляет отравитель?', targetCount: 1 },
    sectant: { effectAction: 'sect', question: 'Кого вербует сектант?', targetCount: 1 },
    detective: { effectAction: null, question: 'Кого проверяет детектив?', targetCount: 1 },
    patrol: { effectAction: null, question: 'Кого проверяет патрульный?', targetCount: 1 },
    journalist: { effectAction: null, question: 'Кого выбирает журналист (2 человека)?', targetCount: 2 },
    tracker: { effectAction: null, question: 'Кого проверяет ищейка?', targetCount: 1 },
    psychic: { effectAction: null, question: 'Кого проверяет экстрасенс?', targetCount: 1 },
    mistress: { effectAction: null, question: 'Кого выбирает любовница?', targetCount: 1 },
    agent: { effectAction: null, question: 'Кого выбирает агент?', targetCount: 1 }
};

const STEP_GROUPS = [
    {
        stepKey: 'group-mafia',
        roleIds: ['mafia', 'werewolf', 'agent', 'boss'],
        turnOrder: 4,
        roleName: 'Ход мафии',
        question: 'Кого убивает мафия?',
        effectAction: 'kill',
        targetCount: 1
    },
    {
        stepKey: 'group-cartel',
        roleIds: ['cartel', 'leader'],
        turnOrder: 5,
        roleName: 'Ход картеля',
        question: 'Кого убивает картель?',
        effectAction: 'kill',
        targetCount: 1
    }
];

// ── Settings modal ──────────────────────────────────────────────
let activeSettingsTab = 'roles';

function openSettingsModal() {
    applySettingsToggles();
    renderRolesSettingsTab();
    document.getElementById('settings-modal').classList.add('active');
    document.getElementById('settings-toggle-btn').classList.add('open');
}

function closeSettingsModal() {
    document.getElementById('settings-modal').classList.remove('active');
    document.getElementById('settings-toggle-btn').classList.remove('open');
}

function closeSettingsModalOutside(e) {
    if (e.target === document.getElementById('settings-modal')) closeSettingsModal();
}

function switchSettingsTab(tab) {
    activeSettingsTab = tab;
    document.querySelectorAll('.stab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    document.querySelectorAll('.stab-content').forEach(c => {
        c.classList.toggle('active', c.id === 'stab-' + tab);
    });
    if (tab === 'roles') renderRolesSettingsTab();
}

function renderRolesSettingsTab() {
    const containers = {
        citizen: document.getElementById('settings-roles-citizen'),
        criminal: document.getElementById('settings-roles-criminal'),
        outcast: document.getElementById('settings-roles-outcast'),
    };
    Object.values(containers).forEach(c => { if (c) c.innerHTML = ''; });
    ROLES.forEach(role => {
        const c = containers[role.team];
        if (!c) return;
        const enabled = enabledRoles.has(role.id);
        const enabledClass = enabled ? `enabled-${role.team}` : '';
        const checkMark = enabled ? '✓' : '';
        const item = document.createElement('div');
        item.className = `settings-role-item ${enabledClass}`;
        item.dataset.roleId = role.id;
        item.innerHTML = `
    <div class="settings-role-check">${checkMark}</div>
    <span class="settings-role-name">${role.name}</span>`;
        item.onclick = () => toggleRoleEnabled(role.id, role.team);
        c.appendChild(item);
    });
}

function toggleRoleEnabled(roleId, team) {
    if (enabledRoles.has(roleId)) {
        enabledRoles.delete(roleId);
    } else {
        enabledRoles.add(roleId);
    }
    saveEnabledRoles();
    renderRolesSettingsTab();
}

function enableAllRoles() {
    ROLES.forEach(r => enabledRoles.add(r.id));
    saveEnabledRoles();
    renderRolesSettingsTab();
}

function disableAllRoles() {
    enabledRoles.clear();
    saveEnabledRoles();
    renderRolesSettingsTab();
}

function updateShowNightPanel(value) {
    showNightPanel = value;
    localStorage.setItem('mafia_show_night_panel', JSON.stringify(value));
    const panel = document.querySelector('.night-actions-panel');
    if (panel) panel.style.display = value ? '' : 'none';
}

function updateShowClock(value) {
    showClock = value;
    localStorage.setItem('mafia_show_clock', JSON.stringify(value));
    const clock = document.getElementById('game-clock');
    if (clock) clock.style.display = value ? '' : 'none';
}

function updateBtnSetting(key, value) {
    btnSettings[key] = value;
    saveBtnSettings();
    if (gamePlayers.length > 0) renderGamePlayers();
}

function toggleStatusRows() {
    showStatusRows = !showStatusRows;
    localStorage.setItem('mafia_show_status_rows', JSON.stringify(showStatusRows));
    const btn = document.getElementById('status-rows-toggle-btn');
    if (btn) btn.classList.toggle('active', showStatusRows);
    renderGamePlayers();
}

// ── UI settings ──────────────────────────────────────────
const UI_SETTINGS_MAP = {
    enableAnimations: 'mafia_enable_animations',
    showRipple: 'mafia_show_ripple',
    enableHaptic: 'mafia_enable_haptic',
    showToasts: 'mafia_show_toasts',
    hideUnassignedTurnOrder: 'mafia_hide_unassigned_to',
    showStatusBadges: 'mafia_show_status_badges',
    confirmEliminate: 'mafia_confirm_eliminate',
    confirmEndGame: 'mafia_confirm_end_game',
    autoAdvanceStep: 'mafia_auto_advance_step',
    perfMode: 'mafia_perf_mode'
};

const UI_SETTINGS_DEFAULTS = {
    enableAnimations: true,
    showRipple: true,
    enableHaptic: true,
    showToasts: true,
    hideUnassignedTurnOrder: false,
    showStatusBadges: true,
    confirmEliminate: false,
    confirmEndGame: true,
    autoAdvanceStep: true,
    perfMode: false
};

function updateUiSetting(key, value) {
    if (!(key in UI_SETTINGS_MAP)) return;
    switch (key) {
        case 'enableAnimations':
            enableAnimations = value;
            document.body.classList.toggle('no-animations', !value);
            break;
        case 'showRipple': showRipple = value; break;
        case 'enableHaptic': enableHaptic = value; break;
        case 'showToasts': showToasts = value; break;
        case 'hideUnassignedTurnOrder':
            hideUnassignedTurnOrder = value;
            renderTurnOrder();
            break;
        case 'showStatusBadges':
            showStatusBadges = value;
            if (gamePlayers.length > 0) renderGamePlayers();
            break;
        case 'confirmEliminate': confirmEliminate = value; break;
        case 'confirmEndGame': confirmEndGame = value; break;
        case 'autoAdvanceStep': autoAdvanceStep = value; break;
        case 'perfMode': perfMode = value; document.body.classList.toggle('perf-mode', value); break;
    }
    localStorage.setItem(UI_SETTINGS_MAP[key], JSON.stringify(value));
}

function resetUiSettings() {
    Object.entries(UI_SETTINGS_DEFAULTS).forEach(([key, defaultValue]) => {
        updateUiSetting(key, defaultValue);
    });
    applySettingsToggles();
}

function applySettingsToggles() {
    Object.keys(btnSettings).forEach(key => {
        const el = document.getElementById('toggle-' + key);
        if (el) el.checked = btnSettings[key];
    });
    const nightPanelToggle = document.getElementById('toggle-show-night-panel');
    if (nightPanelToggle) nightPanelToggle.checked = showNightPanel;
    const clockToggle = document.getElementById('toggle-show-clock');
    if (clockToggle) clockToggle.checked = showClock;
    const statusToggleBtn = document.getElementById('status-rows-toggle-btn');
    if (statusToggleBtn) statusToggleBtn.classList.toggle('active', showStatusRows);
    renderUnifiedPanel();
    // Sync UI settings toggles
    const uiToggles = {
        'toggle-ui-animations': enableAnimations,
        'toggle-ui-ripple': showRipple,
        'toggle-ui-haptic': enableHaptic,
        'toggle-ui-toasts': showToasts,
        'toggle-ui-unassigned-to': !hideUnassignedTurnOrder,
        'toggle-ui-status-badges': showStatusBadges,
        'toggle-ui-confirm-elim': confirmEliminate,
        'toggle-ui-confirm-end': confirmEndGame,
        'toggle-ui-auto-step': autoAdvanceStep,
        'toggle-ui-perf-mode': perfMode
    };
    Object.entries(uiToggles).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.checked = value;
    });
    document.body.classList.toggle('no-animations', !enableAnimations);
    document.body.classList.toggle('perf-mode', perfMode);
    applyLayoutSettings();
}

// ── Layout settings ──────────────────────────────────────────
function updateLayoutSetting(key, value) {
    layoutSettings[key] = value;
    localStorage.setItem(`mafia_layout_${key === 'density' ? 'density' : key === 'cardSize' ? 'card_size' : key === 'roleDisplay' ? 'role_display' : key === 'gridColumns' ? 'grid_cols' : 'role_img'}`, value);
    applyLayoutSettings();
    haptic('light');
}

function applyLayoutSettings() {
    const body = document.body;

    // Remove all layout classes
    body.classList.remove('density-compact', 'density-relaxed');
    body.classList.remove('card-size-small', 'card-size-large');
    body.classList.remove('role-display-text');
    body.classList.remove('grid-columns-3', 'grid-columns-auto');
    body.classList.remove('role-img-size-small', 'role-img-size-large');

    // Apply density
    if (layoutSettings.density === 'compact') {
        body.classList.add('density-compact');
    } else if (layoutSettings.density === 'relaxed') {
        body.classList.add('density-relaxed');
    }

    // Apply card size
    if (layoutSettings.cardSize === 'small') {
        body.classList.add('card-size-small');
    } else if (layoutSettings.cardSize === 'large') {
        body.classList.add('card-size-large');
    }

    // Apply role display mode
    if (layoutSettings.roleDisplay === 'text') {
        body.classList.add('role-display-text');
    }

    // Apply grid columns
    if (layoutSettings.gridColumns === '3') {
        body.classList.add('grid-columns-3');
    } else if (layoutSettings.gridColumns === 'auto') {
        body.classList.add('grid-columns-auto');
    }

    // Apply role image size
    if (layoutSettings.roleImgSize === 'small') {
        body.classList.add('role-img-size-small');
    } else if (layoutSettings.roleImgSize === 'large') {
        body.classList.add('role-img-size-large');
    }

    // Update button states in settings
    updateLayoutButtons();
}

function updateLayoutButtons() {
    document.querySelectorAll('.layout-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Density buttons
    const densityBtn = document.querySelector(`[data-density="${layoutSettings.density}"]`);
    if (densityBtn) densityBtn.classList.add('active');

    // Card size buttons
    const cardSizeBtn = document.querySelector(`[data-card-size="${layoutSettings.cardSize}"]`);
    if (cardSizeBtn) cardSizeBtn.classList.add('active');

    // Role display buttons
    const roleDisplayBtn = document.querySelector(`[data-role-display="${layoutSettings.roleDisplay}"]`);
    if (roleDisplayBtn) roleDisplayBtn.classList.add('active');

    // Grid columns buttons
    const gridColsBtn = document.querySelector(`[data-grid-cols="${layoutSettings.gridColumns}"]`);
    if (gridColsBtn) gridColsBtn.classList.add('active');

    // Role image size buttons
    const roleImgBtn = document.querySelector(`[data-role-img="${layoutSettings.roleImgSize}"]`);
    if (roleImgBtn) roleImgBtn.classList.add('active');
}

function resetLayoutSettings() {
    layoutSettings = {
        density: 'normal',
        cardSize: 'normal',
        roleDisplay: 'both',
        gridColumns: '2',
        roleImgSize: 'normal'
    };

    localStorage.removeItem('mafia_layout_density');
    localStorage.removeItem('mafia_layout_card_size');
    localStorage.removeItem('mafia_layout_role_display');
    localStorage.removeItem('mafia_layout_grid_cols');
    localStorage.removeItem('mafia_layout_role_img');

    applyLayoutSettings();
    showToast('Настройки компоновки сброшены', '🔄');
}

// ── Player list (lobby) ─────────────────────────────────────────
function addNewPlayer() {
    const input = document.getElementById('new-player-input');
    const name = input.value.trim();
    if (!name) return;
    if (ALL_PLAYERS.includes(name)) {
        showConfirmModal('Игрок с таким именем уже есть!', 'Ошибка');
        return;
    }
    ALL_PLAYERS.push(name);
    savePlayers();
    input.value = '';
    renderLobby();
}

document.addEventListener('DOMContentLoaded', () => {
    const input = document.getElementById('new-player-input');
    if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addNewPlayer(); } });
    const searchInput = document.getElementById('lobby-search');
    if (searchInput) searchInput.addEventListener('input', filterLobbyPlayers);
    applySettingsToggles();
});

function removePlayerFromList(name) {
    const idx = ALL_PLAYERS.indexOf(name);
    if (idx !== -1) { ALL_PLAYERS.splice(idx, 1); selectedPlayers.delete(name); savePlayers(); renderLobby(); }
}

function renderActionLog() {
    const list = document.getElementById('action-log-list');
    if (!list) return;
    if (actionLog.length === 0) {
        list.innerHTML = '<div style="color:var(--text-dim);font-size:12px;padding:8px;">Нет записей</div>';
        return;
    }
    list.innerHTML = actionLog.map(entry =>
        `<div class="action-log-entry ${entry.className}">
    <span class="action-log-time">${entry.time}</span>
    <span class="action-log-message">${entry.message}</span>
</div>`
    ).join('');
}

function clearActionLog() {
    showConfirmModal('Очистить лог действий?', 'Подтверждение', () => {
        actionLog = [];
        saveActionLog();
        renderActionLog();
    });
}

function filterLobbyPlayers() {
    const query = document.getElementById('lobby-search')?.value.trim().toLowerCase() || '';
    document.querySelectorAll('#lobby-players .player-check').forEach(card => {
        const name = card.querySelector('.player-name-label').textContent.toLowerCase();
        card.classList.toggle('hidden', query && !name.includes(query));
    });
}

function renderLobby() {
    const c = document.getElementById('lobby-players');
    c.innerHTML = '';
    ALL_PLAYERS.forEach(name => {
        const div = document.createElement('div');
        div.className = 'player-check' + (selectedPlayers.has(name) ? ' checked' : '');
        const isCustom = !DEFAULT_PLAYERS.includes(name);
        div.innerHTML = `<div class="check-box"></div><span class="player-name-label">${name}</span>${isCustom ? `<button class="player-remove-btn" title="Удалить">✕</button>` : ''}`;
        div.onclick = (e) => {
            if (e.target.classList.contains('player-remove-btn')) return;
            if (selectedPlayers.has(name)) selectedPlayers.delete(name); else selectedPlayers.add(name);
            renderLobby();
        };
        if (isCustom) {
            div.querySelector('.player-remove-btn').onclick = (e) => { e.stopPropagation(); removePlayerFromList(name); };
        }
        c.appendChild(div);
    });
    filterLobbyPlayers();
}

function selectAll() { ALL_PLAYERS.forEach(n => selectedPlayers.add(n)); renderLobby(); }
function deselectAll() { selectedPlayers.clear(); renderLobby(); }

// ── SVG helpers ─────────────────────────────────────────────────
function jailBarsSVG() {
    return `<svg viewBox="0 0 100 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><line x1="20" y1="0" x2="20" y2="100" stroke="#aaa" stroke-width="3" opacity="0.6"/><line x1="40" y1="0" x2="40" y2="100" stroke="#aaa" stroke-width="3" opacity="0.6"/><line x1="60" y1="0" x2="60" y2="100" stroke="#aaa" stroke-width="3" opacity="0.6"/><line x1="80" y1="0" x2="80" y2="100" stroke="#aaa" stroke-width="3" opacity="0.6"/><line x1="0" y1="30" x2="100" y2="30" stroke="#aaa" stroke-width="2" opacity="0.4"/><line x1="0" y1="70" x2="100" y2="70" stroke="#aaa" stroke-width="2" opacity="0.4"/></svg>`;
}

function jailBarsMiniSVG() {
    return `<svg viewBox="0 0 60 40" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><line x1="12" y1="0" x2="12" y2="40" stroke="#aaa" stroke-width="2" opacity="0.6"/><line x1="24" y1="0" x2="24" y2="40" stroke="#aaa" stroke-width="2" opacity="0.6"/><line x1="36" y1="0" x2="36" y2="40" stroke="#aaa" stroke-width="2" opacity="0.6"/><line x1="48" y1="0" x2="48" y2="40" stroke="#aaa" stroke-width="2" opacity="0.6"/><line x1="0" y1="20" x2="60" y2="20" stroke="#aaa" stroke-width="1.5" opacity="0.4"/></svg>`;
}

// ── Game start ──────────────────────────────────────────────────
function startGame() {
    if (selectedPlayers.size < 2) {
        showConfirmModal('Выбери хотя бы 2 игроков!', 'Ошибка');
        return;
    }
    nightCount = 1;
    resetStepModeState();
    // Persist selected players so they survive page refresh
    localStorage.setItem('mafia_selected_players', JSON.stringify([...selectedPlayers]));
    gamePlayers = Array.from(selectedPlayers).map(name => ({
        name,
        role: null,
        eliminated: false,
        jailed: false,
        poisoned: false,
        sected: false,
        protected: false,
        alibied: false,
        blocked: false
    }));
    actionLog = [];
    saveActionLog();
    gameStartTime = Date.now();
    saveGameState();
    document.getElementById('screen-lobby').classList.remove('active');
    document.getElementById('screen-game').classList.add('active');
    document.getElementById('bottom-nav').classList.add('active');
    logAction('🎮 Игра начата!');
    renderGame();
    renderActionLog();
    renderUnifiedPanel();
}

// Restore game state from localStorage
function restoreGameState() {
    const savedGamePlayers = localStorage.getItem('mafia_game_players');
    const savedNightActions = localStorage.getItem('mafia_night_actions');
    const gameStarted = localStorage.getItem('mafia_game_started');
    const savedNightCount = localStorage.getItem('mafia_night_count');
    const savedStepModeState = localStorage.getItem(STEP_MODE_STORAGE_KEY);
    const savedGameStartTime = localStorage.getItem('mafia_game_start_time');

    if (gameStarted === 'true' && savedGamePlayers) {
        gamePlayers = JSON.parse(savedGamePlayers);
        if (savedNightActions) {
            nightActions = JSON.parse(savedNightActions);
        }
        if (savedNightCount) {
            nightCount = parseInt(savedNightCount, 10) || 1;
        }
        if (savedGameStartTime) {
            gameStartTime = parseInt(savedGameStartTime, 10);
        }
        // Switch to game screen
        document.getElementById('screen-lobby').classList.remove('active');
        document.getElementById('screen-game').classList.add('active');
        document.getElementById('bottom-nav').classList.add('active');

        if (savedStepModeState) {
            try {
                const parsed = JSON.parse(savedStepModeState);
                if (parsed && parsed.active) {
                    stepModeActive = true;
                    stepModeSelections = Array.isArray(parsed.stepModeSelections) ? parsed.stepModeSelections : [];
                    stepModeDismissedPromptRoles = new Set(parsed.stepModeDismissedPromptRoles || []);
                    stepModeQueue = getStepModeQueue();
                    if (stepModeQueue.length === 0) {
                        stepModeIndex = 0;
                    } else {
                        const savedKey = parsed.currentStepKey;
                        const matchedIndex = savedKey ? stepModeQueue.findIndex(step => step.stepKey === savedKey) : -1;
                        stepModeIndex = matchedIndex > -1
                            ? matchedIndex
                            : Math.min(Math.max(parsed.stepModeIndex || 0, 0), stepModeQueue.length - 1);
                    }
                } else {
                    resetStepModeState({ clearStorage: false });
                }
            } catch (error) {
                resetStepModeState();
            }
        }

        renderGame();
        renderActionLog();
        renderUnifiedPanel();
        updateNightActionCounts();
        updateNightCounter();
        if (stepModeActive) {
            syncNightActionsFromStepMode();
            focusCurrentStepModeStep();
        }
    } else {
        // Restore selected players for lobby
        const savedSelectedPlayers = localStorage.getItem('mafia_selected_players');
        if (savedSelectedPlayers) {
            selectedPlayers = new Set(JSON.parse(savedSelectedPlayers));
        }
        renderLobby();
    }
}

function renderGame() { renderTurnOrder(); renderStats(); renderGamePlayers(); updateNightCounter(); }

function renderStats() {
    const alive = gamePlayers.filter(p => !p.eliminated);
    const total = gamePlayers.length;
    const citizens = alive.filter(p => p.role && p.role.team === 'citizen').length;
    const criminals = alive.filter(p => p.role && p.role.team === 'criminal').length;
    const outcasts = alive.filter(p => p.role && p.role.team === 'outcast').length;
    const unassigned = alive.filter(p => !p.role).length;
    const jailed = gamePlayers.filter(p => !p.eliminated && p.jailed).length;
    const sected = gamePlayers.filter(p => !p.eliminated && p.sected).length;
    document.getElementById('stats-bar').innerHTML = `
<span class="stat-item">👥 ${alive.length}/${total}</span>
<span class="stat-item team-citizen">🔵 ${citizens}</span>
<span class="stat-item team-criminal">🔴 ${criminals}</span>
<span class="stat-item team-outcast">🟡 ${outcasts}</span>
${unassigned ? `<span class="stat-item">❓ ${unassigned}</span>` : ''}
${jailed ? `<span class="stat-item">🔒 ${jailed}</span>` : ''}
${sected ? `<span class="stat-item">🕯️ ${sected}</span>` : ''}`;
}

function getRoleShortName(roleName) {
    return roleName.slice(0, 3).toUpperCase().split('').map(l => `<span>${l}</span>`).join('');
}

function renderTurnOrder() {
    const bar = document.getElementById('turn-order');
    bar.innerHTML = '';

    // Get all roles with turn order
    const rolesWithTurnOrder = ROLES.filter(r => r.turnOrder !== null);

    // Check if there are players without roles
    const playersWithoutRoles = gamePlayers.filter(p => !p.eliminated && !p.role).length > 0;

    // Get assigned roles mapping (array of players per role to support multiple players with same role)
    const assignedRolesMap = {};
    gamePlayers.forEach(p => {
        if (p.role) {
            if (!assignedRolesMap[p.role.id]) {
                assignedRolesMap[p.role.id] = [];
            }
            assignedRolesMap[p.role.id].push(p);
        }
    });

    // Sort all roles by turn order
    const sortedRoles = [...rolesWithTurnOrder].sort((a, b) => a.turnOrder - b.turnOrder);

    // Render each role slot (assigned or empty)
    sortedRoles.forEach(role => {
        const players = assignedRolesMap[role.id] || [];

        // Skip if no player assigned and all players have roles
        if (players.length === 0 && !playersWithoutRoles) {
            return;
        }

        if (players.length > 0) {
            // Render each player with this role
            players.forEach(player => {
                if (player.eliminated) {
                    const marker = document.createElement('div');
                    marker.className = 'turn-dead-marker';
                    const teamClass = 'team-' + player.role.team;
                    marker.innerHTML = `<div class="turn-dead-bar ${teamClass}"></div><div class="turn-dead-letters ${teamClass}">${getRoleShortName(player.role.name)}</div>`;
                    marker.title = `${player.name} (${player.role.name}) — мёртв`;
                    bar.appendChild(marker);
                } else {
                    const chip = document.createElement('div');
                    const statusClasses = Object.entries(BTN_SETTING_MAP)
                        .filter(([, statusKey]) => player[statusKey])
                        .map(([, statusKey]) => statusKey)
                        .join(' ');
                    chip.className = 'turn-chip team-' + player.role.team +
                        (player.jailed ? ' jailed' : '') +
                        (statusClasses ? ' ' + statusClasses : '');

                    const statusIcons = Object.entries(BTN_SETTING_MAP)
                        .filter(([, statusKey]) => player[statusKey])
                        .map(([, statusKey]) => STATUS_DEFS[statusKey].icon)
                        .join('');
                    const statusRow = statusIcons
                        ? `<div class="turn-chip-statuses">${statusIcons}</div>`
                        : '';

                    chip.innerHTML = `
                <img src="${getRoleImgPath(player.role.id)}" class="turn-chip-role-img" alt="${player.role.name}" loading="lazy" onerror="this.style.display='none'">
                <span style="font-size:11px;font-weight:700;">${player.role.name}</span>
                <span style="font-size:9px;opacity:0.7;">${player.name}</span>
                ${statusRow}
                <div class="jail-bars-mini">${jailBarsMiniSVG()}</div>`;
                    bar.appendChild(chip);
                }
            });
        } else if (playersWithoutRoles && !hideUnassignedTurnOrder) {
            // Empty slot for unassigned role
            const marker = document.createElement('div');
            marker.className = 'turn-dead-marker';
            const teamClass = 'team-' + role.team;
            marker.innerHTML = `
        <div class="turn-dead-letters ${teamClass}" style="font-weight:700;"><span>?</span></div>
        <div class="turn-dead-bar ${teamClass}"></div>
        <div class="turn-dead-letters ${teamClass}" style="font-weight:700;">${getRoleShortNameLong(role.name)}</div>`;
            marker.title = `${role.name} — нет игрока`;
            bar.appendChild(marker);
        }
    });
}

function getRoleShortNameLong(roleName) {
    return roleName.slice(0, 4).toUpperCase().split('').map(l => `<span>${l}</span>`).join('');
}

// ── Status badge helpers ────────────────────────────────────────
const STATUS_DEFS = {
    poisoned: { icon: '🧪', btnClass: 'gp-poison-btn', cssClass: 'poisoned', label: 'Отравлен', logKey: 'poisoned-log', logOn: '🧪 Отравлен', logOff: '✅ Яд нейтрализован' },
    sected: { icon: '🕯️', btnClass: 'gp-sect-btn', cssClass: 'sected', label: 'В секте', logKey: 'sected-log', logOn: '🕯️ Взят в секту', logOff: '✅ Вышел из секты' },
    protected: { icon: '🛡️', btnClass: 'gp-protect-btn', cssClass: 'protected', label: 'Защищён', logKey: 'protected-log', logOn: '🛡️ Защищён на ночь', logOff: '✅ Защита снята' },
    alibied: { icon: '📋', btnClass: 'gp-alibi-btn', cssClass: 'alibied', label: 'Алиби', logKey: 'alibied-log', logOn: '📋 Получил алиби', logOff: '✅ Алиби снято' },
    blocked: { icon: '🚫', btnClass: 'gp-block-btn', cssClass: 'blocked', label: 'Заблокирован', logKey: 'blocked-log', logOn: '🚫 Заблокирован', logOff: '✅ Блок снят' },
};

// settingKey → status key map
const BTN_SETTING_MAP = {
    poison: 'poisoned',
    sect: 'sected',
    protect: 'protected',
    alibi: 'alibied',
    block: 'blocked',
};

function buildStatusButtons(idx, player) {
    if (!showStatusRows) return '';
    const classMap = { poisoned: 'poison-btn', sected: 'sect-btn', protected: 'protect-btn', alibied: 'alibi-btn', blocked: 'block-btn' };
    const btns = [];
    if (btnSettings.jail) {
        btns.push(`<button class="gp-status-btn gp-jail-mini${player.jailed ? ' active' : ''}" onclick="toggleJail(${idx})" title="Тюрьма">🔒</button>`);
    }
    Object.entries(BTN_SETTING_MAP).forEach(([settingKey, statusKey]) => {
        if (!btnSettings[settingKey]) return;
        const def = STATUS_DEFS[statusKey];
        const activeClass = player[statusKey] ? ' active' : '';
        btns.push(`<button class="gp-status-btn ${classMap[statusKey]}${activeClass}" onclick="toggleStatus(${idx},'${statusKey}')" title="${def.label}">${def.icon}</button>`);
    });
    if (!btns.length) return '';
    return `<div class="gp-status-row">${btns.join('')}</div>`;
}

function buildStatusMarkers(player) {
    if (!showStatusBadges) return '';
    let html = '';
    Object.entries(BTN_SETTING_MAP).forEach(([settingKey, statusKey]) => {
        if (player[statusKey]) {
            html += `<span class="status-badge">${STATUS_DEFS[statusKey].icon}</span>`;
        }
    });
    return html ? `<div class="status-markers">${html}</div>` : '';
}

function canSelectPlayerAtNight(player) {
    return !player.eliminated && (currentNightAction !== null || stepModeActive);
}

function isSelectedForNightByIndex(playerIdx) {
    if (stepModeActive) {
        return isPlayerSelectedInCurrentStep(playerIdx);
    }
    if (currentNightAction && nightActions[currentNightAction]) {
        return nightActions[currentNightAction].includes(playerIdx);
    }
    return false;
}

function renderGamePlayers() {
    const c = document.getElementById('game-players');
    const sorted = [...gamePlayers].sort((a, b) => {
        if (a.eliminated && !b.eliminated) return 1;
        if (!a.eliminated && b.eliminated) return -1;
        return 0;
    });
    const newCards = [];
    sorted.forEach((p) => {
        const idx = gamePlayers.indexOf(p);
        let card = Array.from(c.querySelectorAll('.game-player-card')).find(c => {
            const nameEl = c.querySelector('.gp-name');
            return nameEl && nameEl.textContent === p.name;
        });
        if (!card) { card = document.createElement('div'); c.appendChild(card); }
        newCards.push(card);
        const { className, html } = buildPlayerCardHTML(p, idx);
        card.className = className;
        card.innerHTML = html;
    });
    // Remove extra cards
    Array.from(c.querySelectorAll('.game-player-card')).forEach(card => {
        if (!newCards.includes(card)) card.remove();
    });
}

// ── Player actions ──────────────────────────────────────────────
function _doEliminatePlayer(idx, player) {
    player.eliminated = true;
    player.jailed = false;
    // Clear night statuses on death
    player.poisoned = player.sected = player.protected = player.alibied = player.blocked = false;

    saveGameState();

    const c = document.getElementById('game-players');
    animateFlip(c, gamePlayers, () => {
        renderStats();
        renderTurnOrder();

        // Check for jailed/sected players AFTER eliminating the current player
        const jailedPlayers = gamePlayers.filter(p => p.jailed && !p.eliminated);
        const sectedPlayers = gamePlayers.filter(p => p.sected && !p.eliminated);
        const isAvenger = player.role && player.role.id === 'avenger';

        // Show modal if judge dies and there are jailed players
        if (player.role && player.role.id === 'judge' && jailedPlayers.length > 0) {
            showDeathActionModal('judge', jailedPlayers.length);
            return;
        }

        // Show modal if sectant dies and there are sected players
        if (player.role && player.role.id === 'sectant' && sectedPlayers.length > 0) {
            showDeathActionModal('sectant', sectedPlayers.length);
            return;
        }

        // Show modal if avenger dies
        if (isAvenger) {
            showAvengerModal(player);
            return;
        }

        // Проверка условий победы после устранения игрока
        const winResult = checkWinConditions();
        if (winResult) {
            showWinModal(winResult);
        }
    });
}

function eliminatePlayer(idx) {
    const player = gamePlayers[idx];
    if (!player.eliminated) {
        takeGameSnapshot(`убийство ${player.name}`);
        if (confirmEliminate) {
            showConfirmModal(`Убить ${player.name}?`, 'Подтверждение', () => {
                _doEliminatePlayer(idx, player);
            });
            return;
        }
        logAction(`<span class="eliminated">💀 Убит:</span> <span class="player-name">${player.name}</span>${player.role ? ` (${player.role.name})` : ''}`, 'eliminated');
    }

    _doEliminatePlayer(idx, player);
}

function restorePlayer(idx) {
    const player = gamePlayers[idx];
    if (player.eliminated) {
        takeGameSnapshot(`воскрешение ${player.name}`);
        logAction(`<span class="restored">👼 Воскрешён:</span> <span class="player-name">${player.name}</span>${player.role ? ` (${player.role.name})` : ''}`, 'restored');
    }
    player.eliminated = false;
    saveGameState();
    const c = document.getElementById('game-players');
    animateFlip(c, gamePlayers, () => {
        renderStats();
        renderTurnOrder();
    });
}

function toggleJail(idx) {
    const player = gamePlayers[idx];
    takeGameSnapshot(player.jailed ? `освобождение ${player.name}` : `посадка ${player.name}`);
    player.jailed = !player.jailed;
    if (player.jailed) {
        logAction(`<span class="jailed">🔒 Посажен в тюрьму:</span> <span class="player-name">${player.name}</span>`, 'jailed');
    } else {
        logAction(`<span class="freed">✅ Освобождён из тюрьмы:</span> <span class="player-name">${player.name}</span>`, 'freed');
    }
    saveGameState();
    renderGame();
}

function toggleStatus(idx, statusKey) {
    const player = gamePlayers[idx];
    const def = STATUS_DEFS[statusKey];
    takeGameSnapshot(player[statusKey] ? `${def.logOff} ${player.name}` : `${def.logOn} ${player.name}`);
    player[statusKey] = !player[statusKey];

    if (player[statusKey]) {
        logAction(`<span class="${def.logKey}">${def.logOn}:</span> <span class="player-name">${player.name}</span>`, def.logKey);
    } else {
        logAction(`<span class="${def.logKey}">${def.logOff}:</span> <span class="player-name">${player.name}</span>`, def.logKey);
    }
    saveGameState();
    renderGame();
}

// ── Night actions ──────────────────────────────────────────────
function selectNightAction(action) {
    if (stepModeActive) {
        const currentStep = getCurrentStep();
        const expectedAction = currentStep ? currentStep.effectAction : null;
        if (action !== expectedAction) return;
        currentNightAction = expectedAction;
    } else {
        if (!action) {
            currentNightAction = null;
        } else if (currentNightAction === action) {
            currentNightAction = null;
        } else {
            currentNightAction = action;
        }
    }

    document.querySelectorAll('.night-action-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    if (currentNightAction) {
        const activeBtn = document.querySelector(`.night-action-btn.${currentNightAction}-btn`);
        if (activeBtn) activeBtn.classList.add('active');
    }

    updateNightActionCounts();
    renderStepModePanel();
    renderGamePlayers();
    saveStepModeState();
}

function getStepModeQueue() {
    const aliveWithRole = gamePlayers
        .map((player, idx) => ({ player, idx }))
        .filter(({ player }) => !player.eliminated && player.role && player.role.turnOrder !== null);
    const aliveUnassigned = gamePlayers
        .map((player, idx) => ({ player, idx }))
        .filter(({ player }) => !player.eliminated && !player.role);
    const assignedRoleIds = new Set(gamePlayers.filter(player => player.role).map(player => player.role.id));

    const groupedRoleIds = new Set(STEP_GROUPS.flatMap(g => g.roleIds));
    const steps = [];
    const hasAliveDetective = aliveWithRole.some(({ player }) => player.role.id === 'detective');

    if (aliveUnassigned.length > 0) {
        ROLES
            .filter(role => role.turnOrder !== null)
            .forEach(role => {
                if (!isRoleEnabled(role.id)) return;
                if (assignedRoleIds.has(role.id)) return;
                if (stepModeDismissedPromptRoles.has(role.id)) return;
                if (role.id === 'patrol' && hasAliveDetective) return;

                steps.push({
                    stepKey: `prompt-${role.id}`,
                    actorIdx: null,
                    roleId: role.id,
                    roleName: role.name,
                    actorName: 'Ведущий',
                    effectAction: null,
                    targetCount: 0,
                    turnOrder: role.turnOrder,
                    question: `Есть роль ${role.name}?`,
                    stepType: 'prompt',
                    allowMultiAssign: STEP_MULTI_ASSIGN_ROLE_IDS.has(role.id)
                });
            });
    }

    STEP_GROUPS.forEach(group => {
        const members = aliveWithRole.filter(({ player }) => group.roleIds.includes(player.role.id));
        if (!members.length) return;

        const criminalMembers = members.filter(({ player }) => player.role.team === 'criminal');
        if (!criminalMembers.length) return;

        const first = members[0];
        const actorNames = members.map(m => m.player.name).join(', ');
        steps.push({
            stepKey: group.stepKey,
            actorIdx: first.idx,
            roleId: group.stepKey,
            roleName: group.roleName,
            actorName: actorNames,
            effectAction: group.effectAction,
            targetCount: group.targetCount,
            turnOrder: group.turnOrder,
            question: group.question,
            stepType: 'action'
        });
    });

    aliveWithRole
        .filter(({ player }) => !groupedRoleIds.has(player.role.id))
        .forEach(({ player, idx }) => {
            if (player.role.id === 'patrol' && hasAliveDetective) return;
            const conf = ROLE_STEP_CONFIG[player.role.id] || {};
            steps.push({
                stepKey: `player-${idx}-${player.role.id}`,
                actorIdx: idx,
                roleId: player.role.id,
                roleName: player.role.name,
                actorName: player.name,
                effectAction: conf.effectAction || null,
                targetCount: conf.targetCount || 1,
                turnOrder: player.role.turnOrder,
                question: conf.question || `Кого выбирает ${player.role.name.toLowerCase()}?`,
                stepType: 'action'
            });
        });

    return steps.sort((a, b) => {
        const typeOrderA = a.stepType === 'prompt' ? 0 : 1;
        const typeOrderB = b.stepType === 'prompt' ? 0 : 1;
        return a.turnOrder - b.turnOrder ||
            typeOrderA - typeOrderB ||
            a.roleName.localeCompare(b.roleName, 'ru') ||
            a.actorName.localeCompare(b.actorName, 'ru');
    });
}

function getCurrentStep() {
    return stepModeQueue[stepModeIndex] || null;
}

function getCurrentStepSelection() {
    const step = getCurrentStep();
    if (!step) return null;
    return stepModeSelections.find(s => s.stepKey === step.stepKey) || null;
}

function syncNightActionsFromStepMode() {
    const keys = ['kill', 'protect', 'alibi', 'jail', 'poison', 'sect', 'block'];
    keys.forEach(k => { nightActions[k] = []; });

    stepModeSelections.forEach(sel => {
        if (!sel.effectAction || !nightActions[sel.effectAction]) return;
        sel.targetIndices.forEach(idx => {
            if (!gamePlayers[idx] || gamePlayers[idx].eliminated) return;
            nightActions[sel.effectAction].push(idx);
        });
    });
}

function resetNightActionsState({ clearStepSelections = false } = {}) {
    nightActions = {
        kill: [],
        protect: [],
        alibi: [],
        jail: [],
        poison: [],
        sect: [],
        block: []
    };
    currentNightAction = null;
    document.querySelectorAll('.night-action-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (clearStepSelections) {
        stepModeSelections = [];
    }
    updateNightActionCounts();
}

function isPlayerSelectedInCurrentStep(playerIdx) {
    if (!stepModeActive) return false;
    const selection = getCurrentStepSelection();
    return !!selection && selection.targetIndices.includes(playerIdx);
}

function renderUnifiedPanel() {
    const toggleBtn = document.getElementById('step-mode-toggle-btn');
    const statusEl = document.getElementById('step-mode-status');
    const questionEl = document.getElementById('step-mode-question');
    const controlsEl = document.getElementById('step-mode-controls');
    const backBtn = document.getElementById('step-mode-back-btn');
    const banner = document.getElementById('step-mode-banner');
    const bannerText = document.getElementById('step-mode-banner-text');
    if (!toggleBtn || !statusEl || !questionEl || !controlsEl || !backBtn) return;

    const setStepToggleContent = (icon, text) => {
        toggleBtn.innerHTML = `<span class="btn-icon-label"><span class="material-symbols-rounded">${icon}</span><span>${text}</span></span>`;
    };

    if (!stepModeActive) {
        setStepToggleContent('explore', 'Пошаговый');
        toggleBtn.classList.remove('btn-red');
        toggleBtn.classList.add('btn-dark');
        statusEl.textContent = 'Выключен';
        questionEl.style.display = 'none';
        controlsEl.style.display = 'none';
        backBtn.disabled = true;
        if (banner) banner.style.display = 'none';
        return;
    }

    const step = getCurrentStep();
    const selection = getCurrentStepSelection();
    const selectedCount = selection ? selection.targetIndices.length : 0;
    const neededCount = step ? step.targetCount : 1;
    const progress = `${stepModeIndex + 1}/${stepModeQueue.length}`;

    setStepToggleContent('close', 'Остановить');
    toggleBtn.classList.remove('btn-dark');
    toggleBtn.classList.add('btn-red');
    if (!step) {
        statusEl.textContent = 'Активен | нет ходов';
        questionEl.textContent = 'Нет ролей с ночным ходом. Сначала назначь роли игрокам.';
        questionEl.style.display = 'block';
        controlsEl.style.display = 'none';
        if (banner) banner.style.display = 'none';
        return;
    }

    const questionText = step.stepType === 'prompt'
        ? `${step.roleName}: ${step.question}`
        : `${step.actorName} (${step.roleName}): ${step.question} (${selectedCount}/${neededCount})`;

    statusEl.textContent = `Активен | Шаг ${progress}`;
    questionEl.textContent = questionText;
    questionEl.style.display = 'block';
    controlsEl.style.display = 'flex';
    backBtn.disabled = stepModeIndex <= 0;

    // Update sticky banner
    if (banner && bannerText) {
        bannerText.textContent = questionText;
        banner.classList.toggle('prompt-step', step.stepType === 'prompt');
        banner.style.display = '';
    }
}

const renderStepModePanel = renderUnifiedPanel;

function focusCurrentStepModeStep() {
    if (!stepModeActive) return;

    const blockedModal = document.getElementById('step-blocked-modal');
    if (blockedModal) blockedModal.classList.remove('active');
    stepBlockedPending = null;

    const step = getCurrentStep();
    if (!step) {
        currentNightAction = null;
        renderStepModePanel();
        renderGamePlayers();
        saveStepModeState();
        return;
    }

    if (step.stepType === 'prompt') {
        currentNightAction = null;
        renderStepModePanel();
        renderGamePlayers();
        openStepRolePrompt(step);
        saveStepModeState();
        return;
    }

    closeStepRolePromptModal();
    if (maybeShowBlockedStepModal(step)) {
        currentNightAction = null;
        renderStepModePanel();
        renderGamePlayers();
        saveStepModeState();
        return;
    }

    selectNightAction(step && step.effectAction ? step.effectAction : null);
    renderStepModePanel();
    renderGamePlayers();
    saveStepModeState();
}

function toggleStepMode() {
    if (stepModeActive) {
        resetStepModeState();
        renderStepModePanel();
        renderGamePlayers();
        return;
    }

    resetNightActionsState({ clearStepSelections: true });
    stepModeDismissedPromptRoles = new Set();
    stepRolePromptState = null;
    stepBlockedPending = null;
    stepModeActive = true;
    stepModeQueue = getStepModeQueue();
    stepModeIndex = stepModeQueue.length > 0 ? 0 : -1;

    if (stepModeQueue.length === 0) {
        stepModeIndex = 0;
        renderStepModePanel();
        renderGamePlayers();
        saveStepModeState();
        return;
    }

    focusCurrentStepModeStep();
}

function skipStepModeRole() {
    if (!stepModeActive) return;
    advanceStepMode();
}

function goToPreviousStepModeRole() {
    if (!stepModeActive || stepModeIndex <= 0) return;
    stepModeIndex--;
    focusCurrentStepModeStep();
}

function finishStepModeNow() {
    if (!stepModeActive) return;
    syncNightActionsFromStepMode();
    resetStepModeState({ preserveSelections: true });
    renderStepModePanel();
    renderGamePlayers();
    generateNightReport();
}

function advanceStepMode() {
    if (!stepModeActive) return;
    stepModeIndex++;
    if (stepModeIndex >= stepModeQueue.length) {
        finishStepModeNow();
        return;
    }
    focusCurrentStepModeStep();
}

function updateNightActionCounts() {
    Object.keys(nightActions).forEach(action => {
        const countEl = document.getElementById(`night-count-${action}`);
        const count = nightActions[action].length;
        if (countEl) {
            if (count > 0) {
                countEl.textContent = count;
                countEl.style.display = 'flex';
            } else {
                countEl.style.display = 'none';
            }
        }
    });
}

function updateNightCounter() {
    const counterEl = document.getElementById('night-counter');
    if (counterEl) {
        counterEl.textContent = nightCount;
    }
}

function getAliveUnassignedPlayers() {
    return gamePlayers
        .map((player, idx) => ({ player, idx }))
        .filter(({ player }) => !player.eliminated && !player.role);
}

function openStepRolePrompt(step) {
    const modal = document.getElementById('step-role-prompt-modal');
    const titleEl = document.getElementById('step-role-prompt-title');
    const textEl = document.getElementById('step-role-prompt-text');
    const hintEl = document.getElementById('step-role-prompt-hint');
    const playersEl = document.getElementById('step-role-prompt-players');
    if (!modal || !titleEl || !textEl || !hintEl || !playersEl) return;

    const availablePlayers = getAliveUnassignedPlayers();
    if (availablePlayers.length === 0) {
        stepModeDismissedPromptRoles.add(step.roleId);
        stepModeQueue = getStepModeQueue();
        if (stepModeQueue.length === 0) {
            stepModeIndex = 0;
        } else if (stepModeIndex >= stepModeQueue.length) {
            stepModeIndex = stepModeQueue.length - 1;
        }
        saveGameState();
        focusCurrentStepModeStep();
        return;
    }

    if (!stepRolePromptState || stepRolePromptState.stepKey !== step.stepKey) {
        stepRolePromptState = {
            stepKey: step.stepKey,
            roleId: step.roleId,
            selectedIndices: []
        };
    }

    titleEl.textContent = `❓ Есть ${step.roleName}?`;
    textEl.textContent = `Если роль есть, выбери ${step.allowMultiAssign ? 'игроков' : 'игрока'} для роли «${step.roleName}».`;
    hintEl.textContent = step.allowMultiAssign
        ? 'Можно выбрать нескольких игроков. Если роли точно нет — нажми «Нет».'
        : 'Выбери одного игрока. Если роли точно нет — нажми «Нет».';

    playersEl.innerHTML = '';
    availablePlayers.forEach(({ player, idx }) => {
        const item = document.createElement('div');
        const checked = stepRolePromptState.selectedIndices.includes(idx);
        item.className = `player-check${checked ? ' checked' : ''}`;
        item.innerHTML = `<div class="check-box"></div><span class="player-name-label">${player.name}</span>`;
        item.onclick = () => toggleStepRolePromptPlayer(idx, !!step.allowMultiAssign);
        playersEl.appendChild(item);
    });

    modal.classList.add('active');
}

function closeStepRolePromptModal() {
    const modal = document.getElementById('step-role-prompt-modal');
    if (modal) modal.classList.remove('active');
    stepRolePromptState = null;
}

function toggleStepRolePromptPlayer(playerIdx, allowMultiAssign) {
    if (!stepRolePromptState) return;
    const selected = stepRolePromptState.selectedIndices;
    const pos = selected.indexOf(playerIdx);
    if (pos > -1) {
        selected.splice(pos, 1);
    } else if (allowMultiAssign) {
        selected.push(playerIdx);
    } else {
        stepRolePromptState.selectedIndices = [playerIdx];
    }

    const step = getCurrentStep();
    if (step && step.stepType === 'prompt') {
        openStepRolePrompt(step);
    }
}

function rebuildStepModeQueueAtCurrentIndex() {
    const nextIndex = Math.max(stepModeIndex, 0);
    stepModeQueue = getStepModeQueue();
    if (stepModeQueue.length === 0) {
        stepModeIndex = 0;
    } else {
        stepModeIndex = Math.min(nextIndex, stepModeQueue.length - 1);
    }
}

function confirmStepRolePrompt() {
    const step = getCurrentStep();
    if (!step || step.stepType !== 'prompt' || !stepRolePromptState) return;
    if (stepRolePromptState.selectedIndices.length === 0) {
        showConfirmModal('Сначала выбери игрока для этой роли.', 'Ошибка');
        return;
    }

    const role = ROLES.find(item => item.id === step.roleId);
    if (!role) return;

    stepRolePromptState.selectedIndices.forEach(idx => assignRoleToPlayerByIndex(idx, role));
    closeStepRolePromptModal();
    rebuildStepModeQueueAtCurrentIndex();
    saveGameState();
    focusCurrentStepModeStep();
}

function rejectStepRolePrompt() {
    const step = getCurrentStep();
    if (!step || step.stepType !== 'prompt') return;
    stepModeDismissedPromptRoles.add(step.roleId);
    closeStepRolePromptModal();
    rebuildStepModeQueueAtCurrentIndex();
    saveGameState();
    focusCurrentStepModeStep();
}

function closeStepRolePromptOutside(event) {
    const modal = document.getElementById('step-role-prompt-modal');
    if (event.target === modal) {
        rejectStepRolePrompt();
    }
}

function toggleNightPlayerSelection(playerIdx) {
    const player = gamePlayers[playerIdx];
    if (!player || player.eliminated) return;

    if (stepModeActive) {
        const step = getCurrentStep();
        if (!step || step.stepType === 'prompt') return;

        let selection = getCurrentStepSelection();
        if (!selection) {
            selection = {
                stepKey: step.stepKey,
                actorIdx: step.actorIdx,
                roleId: step.roleId,
                actorName: step.actorName,
                roleName: step.roleName,
                effectAction: step.effectAction,
                targetIndices: []
            };
            stepModeSelections.push(selection);
        }

        const pos = selection.targetIndices.indexOf(playerIdx);
        if (pos > -1) {
            selection.targetIndices.splice(pos, 1);
        } else if (selection.targetIndices.length < step.targetCount) {
            selection.targetIndices.push(playerIdx);
        }

        syncNightActionsFromStepMode();
        updateNightActionCounts();
        saveGameState();
        renderStepModePanel();
        renderGamePlayers();

        if (selection.targetIndices.length >= step.targetCount && autoAdvanceStep) {
            advanceStepMode();
        }
        return;
    }

    if (!currentNightAction || !nightActions[currentNightAction]) return;

    const actionList = nightActions[currentNightAction];
    const playerIndex = actionList.indexOf(playerIdx);

    if (playerIndex > -1) {
        actionList.splice(playerIndex, 1);
    } else {
        actionList.push(playerIdx);
    }

    updateNightActionCounts();
    saveGameState();
    renderGamePlayers();
}

function clearNightSelection() {
    resetNightActionsState({ clearStepSelections: !stepModeActive });
    renderStepModePanel();
    saveGameState();
    renderGamePlayers();
}

function clearAllEffects() {
    // Clear all status effects from all players (poisoned, protected, alibied, blocked)
    gamePlayers.forEach(player => {
        player.poisoned = false;
        player.protected = false;
        player.alibied = false;
        player.blocked = false;
    });
    logAction('🧹 Все эффекты ночи очищены', '');
    saveGameState();
    renderGame();
}

function formatStepActor(sel) {
    if (!sel) return 'Неизвестно';
    if (sel.stepKey === 'group-mafia') return `Мафией (${sel.actorName})`;
    if (sel.stepKey === 'group-cartel') return `Картелем (${sel.actorName})`;
    return `${sel.roleName} (${sel.actorName})`;
}

function getStepSelectionForTarget(effectAction, targetIdx) {
    return stepModeSelections.find(sel =>
        sel.effectAction === effectAction &&
        Array.isArray(sel.targetIndices) &&
        sel.targetIndices.includes(targetIdx)
    ) || null;
}

function getBlockedActorIndices() {
    const blocked = new Set();
    stepModeSelections
        .filter(sel => sel.effectAction === 'block')
        .forEach(sel => sel.targetIndices.forEach(idx => blocked.add(idx)));
    return blocked;
}

function getAliveGroupMembers(step) {
    if (!step || !step.roleId.startsWith('group-')) return [];

    const group = STEP_GROUPS.find(item => item.stepKey === step.stepKey);
    if (!group) return [];

    return gamePlayers
        .map((player, idx) => ({ player, idx }))
        .filter(({ player }) =>
            !player.eliminated &&
            player.role &&
            player.role.team === 'criminal' &&
            group.roleIds.includes(player.role.id)
        );
}

function isGroupStepBlocked(step, blockedIndices) {
    const criminalMembers = getAliveGroupMembers(step);
    if (!criminalMembers.length) return true;

    return criminalMembers.every(({ idx }) => blockedIndices.has(idx));
}

function isGroupStepJailed(step) {
    const criminalMembers = getAliveGroupMembers(step);
    if (!criminalMembers.length) return true;

    return criminalMembers.every(({ player }) => player.jailed);
}

function showStepSkipModal(title, text, step) {
    stepBlockedPending = step;
    const titleEl = document.getElementById('step-blocked-title');
    const textEl = document.getElementById('step-blocked-text');
    if (titleEl) titleEl.textContent = title;
    if (textEl) textEl.textContent = text;
    const modal = document.getElementById('step-blocked-modal');
    if (modal) modal.classList.add('active');
    return true;
}

function maybeShowBlockedStepModal(step) {
    const blockedIndices = getBlockedActorIndices();
    if (!step || step.stepType === 'prompt') return false;

    const isJailed = step.roleId.startsWith('group-')
        ? isGroupStepJailed(step)
        : !!gamePlayers[step.actorIdx]?.jailed;

    if (isJailed) {
        return showStepSkipModal(
            '🔒 Роль в тюрьме',
            step.roleId.startsWith('group-')
                ? `${step.roleName} — все участники этой роли сейчас в тюрьме, ход пропускается.`
                : `${step.actorName} (${step.roleName}) сейчас в тюрьме, ход пропускается.`,
            step
        );
    }

    const isBlocked = step.roleId.startsWith('group-')
        ? isGroupStepBlocked(step, blockedIndices)
        : blockedIndices.has(step.actorIdx);

    if (!isBlocked) return false;

    return showStepSkipModal(
        '🚫 Ход заблокирован',
        step.roleId.startsWith('group-')
            ? `${step.roleName} — ход этой роли заблокирован адвокатом.`
            : `${step.actorName} (${step.roleName}) — ход этой роли заблокирован адвокатом.`,
        step
    );
}

function confirmStepBlockedModal() {
    const modal = document.getElementById('step-blocked-modal');
    if (modal) modal.classList.remove('active');
    stepBlockedPending = null;
    advanceStepMode();
}

function closeStepBlockedOutside(event) {
    const modal = document.getElementById('step-blocked-modal');
    if (event.target === modal) {
        confirmStepBlockedModal();
    }
}

function getStepInfoEntries() {
    return stepModeSelections
        .filter(sel => !sel.effectAction && sel.targetIndices.length > 0)
        .map(sel => {
            const actor = gamePlayers[sel.actorIdx];
            if (!actor) return null;
            const targets = sel.targetIndices
                .map(idx => gamePlayers[idx])
                .filter(Boolean)
                .map(p => `${p.name}${p.role ? ` (${p.role.name})` : ''}`);
            if (targets.length === 0) return null;

            let text;
            if (sel.roleId === 'journalist' && targets.length >= 2) {
                text = `${sel.actorName} (${sel.roleName}) сравнил: ${targets.join(' и ')}`;
            } else if (sel.roleId === 'mistress') {
                text = `${sel.actorName} (${sel.roleName}) выбрала цель для ложного ответа: ${targets[0]}`;
            } else {
                text = `${sel.actorName} (${sel.roleName}) проверил: ${targets.join(', ')}`;
            }

            return {
                icon: '🔎',
                text,
                class: 'night-report-block'
            };
        })
        .filter(Boolean);
}

function generateNightReport() {
    const reportBody = document.getElementById('night-report-body');
    const entries = [];

    const sourceFor = (action, idx) => {
        const sel = getStepSelectionForTarget(action, idx);
        return sel ? formatStepActor(sel) : null;
    };

    // Find players who are both killed and protected (they survive)
    const killedIndices = new Set(nightActions.kill.filter(idx => {
        const player = gamePlayers[idx];
        return player && !player.eliminated;
    }));
    const protectedIndices = new Set(nightActions.protect.filter(idx => {
        const player = gamePlayers[idx];
        return player && !player.eliminated;
    }));
    const savedIndices = new Set([...killedIndices].filter(idx => protectedIndices.has(idx)));
    const actuallyKilledIndices = [...killedIndices].filter(idx => !savedIndices.has(idx));
    const actuallyProtectedIndices = [...protectedIndices].filter(idx => !savedIndices.has(idx));

    // Find lucky players saved from kills
    const luckySavedFromKill = new Set();
    actuallyKilledIndices.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && player.role && player.role.id === 'lucky') {
            luckySavedFromKill.add(idx);
        }
    });

    // Find players saved from poison by protection or lucky
    const savedFromPoison = new Set();
    const poisonedNormally = new Set();
    nightActions.poison.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated) {
            if (protectedIndices.has(idx)) {
                savedFromPoison.add(idx);
            } else if (player.role && player.role.id === 'lucky') {
                savedFromPoison.add(idx);
            } else {
                poisonedNormally.add(idx);
            }
        }
    });

    const bodyguardSacrifices = new Map();
    stepModeSelections
        .filter(sel => sel.roleId === 'bodyguard' && sel.effectAction === 'protect')
        .forEach(sel => {
            const bodyguard = gamePlayers[sel.actorIdx];
            if (!bodyguard || bodyguard.eliminated) return;
            sel.targetIndices.forEach(targetIdx => {
                const target = gamePlayers[targetIdx];
                if (!target || target.eliminated) return;
                if (!bodyguardSacrifices.has(targetIdx)) bodyguardSacrifices.set(targetIdx, sel.actorIdx);
            });
        });

    // Players saved from death (killed AND protected)
    savedIndices.forEach(idx => {
        const player = gamePlayers[idx];
        if (player) {
            const killSource = sourceFor('kill', idx);
            const protectSource = sourceFor('protect', idx);
            entries.push({
                type: 'saved',
                icon: '⛑',
                text: `Пытались убить, но защитили: ${player.name}${player.role ? ` (${player.role.name})` : ''}${killSource ? ` | ${killSource}` : ''}${protectSource ? ` | защищал: ${protectSource}` : ''}`,
                class: 'night-report-protected'
            });

            const sacrificedIdx = bodyguardSacrifices.get(idx);
            if (sacrificedIdx !== undefined) {
                const bodyguard = gamePlayers[sacrificedIdx];
                if (bodyguard && !bodyguard.eliminated) {
                    if (protectedIndices.has(sacrificedIdx)) {
                        entries.push({
                            type: 'bodyguard-saved',
                            icon: '🛡️',
                            text: `Телохранитель прикрыл цель и выжил (был защищён): ${bodyguard.name}${bodyguard.role ? ` (${bodyguard.role.name})` : ''}`,
                            class: 'night-report-protected'
                        });
                    } else {
                        entries.push({
                            type: 'bodyguard-sacrifice',
                            icon: '🛡️💀',
                            text: `Телохранитель погиб, защищая: ${player.name}${player.role ? ` (${player.role.name})` : ''} — ${bodyguard.name}${bodyguard.role ? ` (${bodyguard.role.name})` : ''}`,
                            class: 'night-report-kill'
                        });
                    }
                }
            }
        }
    });

    // Lucky players saved from kills
    luckySavedFromKill.forEach(idx => {
        const player = gamePlayers[idx];
        if (player) {
            entries.push({
                type: 'lucky-kill',
                icon: '🍀',
                text: `Пытались убить, но повезло: ${player.name}${player.role ? ` (${player.role.name})` : ''}`,
                class: 'night-report-protected'
            });
        }
    });

    // Killed players (not protected, not lucky)
    const finalKilledIndices = actuallyKilledIndices.filter(idx => !luckySavedFromKill.has(idx));
    finalKilledIndices.forEach(idx => {
        const player = gamePlayers[idx];
        if (player) {
            entries.push({
                type: 'kill',
                icon: '💀',
                text: `Убит: ${player.name}${player.role ? ` (${player.role.name})` : ''}${getStepSelectionForTarget('kill', idx) ? ` | ${formatStepActor(getStepSelectionForTarget('kill', idx))}` : ''}`,
                class: 'night-report-kill'
            });
        }
    });

    // Protected players (not killed)
    actuallyProtectedIndices.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !luckySavedFromKill.has(idx)) {
            entries.push({
                type: 'protect',
                icon: '🛡️',
                text: `Защищён: ${player.name}${player.role ? ` (${player.role.name})` : ''}${getStepSelectionForTarget('protect', idx) ? ` | ${formatStepActor(getStepSelectionForTarget('protect', idx))}` : ''}`,
                class: 'night-report-protected'
            });
        }
    });

    // Players saved from poison
    savedFromPoison.forEach(idx => {
        const player = gamePlayers[idx];
        if (player) {
            const isLucky = player.role && player.role.id === 'lucky';
            const isProtected = protectedIndices.has(idx);
            if (isLucky && !isProtected) {
                entries.push({
                    type: 'lucky-poison',
                    icon: '🍀',
                    text: `Пытались отравить, но повезло: ${player.name}${player.role ? ` (${player.role.name})` : ''}`,
                    class: 'night-report-protected'
                });
            } else if (isProtected) {
                entries.push({
                    type: 'saved-poison',
                    icon: '🛡️',
                    text: `Пытались отравить, но защитили: ${player.name}${player.role ? ` (${player.role.name})` : ''}`,
                    class: 'night-report-protected'
                });
            }
        }
    });

    // Poisoned players (not saved)
    poisonedNormally.forEach(idx => {
        const player = gamePlayers[idx];
        if (player) {
            entries.push({
                type: 'poison',
                icon: '🧪',
                text: `Отравлен: ${player.name}${player.role ? ` (${player.role.name})` : ''}${getStepSelectionForTarget('poison', idx) ? ` | ${formatStepActor(getStepSelectionForTarget('poison', idx))}` : ''}`,
                class: 'night-report-poison'
            });
        }
    });

    // Alibi players
    nightActions.alibi.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated) {
            entries.push({
                type: 'alibi',
                icon: '📋',
                text: `Алиби: ${player.name}${player.role ? ` (${player.role.name})` : ''}${getStepSelectionForTarget('alibi', idx) ? ` | ${formatStepActor(getStepSelectionForTarget('alibi', idx))}` : ''}`,
                class: 'night-report-alibi'
            });
        }
    });

    // Jailed players
    nightActions.jail.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated) {
            entries.push({
                type: 'jail',
                icon: '🔒',
                text: `Тюрьма: ${player.name}${player.role ? ` (${player.role.name})` : ''}${getStepSelectionForTarget('jail', idx) ? ` | ${formatStepActor(getStepSelectionForTarget('jail', idx))}` : ''}`,
                class: 'night-report-jail'
            });
        }
    });

    // Sect players
    nightActions.sect.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated) {
            entries.push({
                type: 'sect',
                icon: '🕯️',
                text: `В секте: ${player.name}${player.role ? ` (${player.role.name})` : ''}${getStepSelectionForTarget('sect', idx) ? ` | ${formatStepActor(getStepSelectionForTarget('sect', idx))}` : ''}`,
                class: 'night-report-sect'
            });
        }
    });

    // Blocked players
    nightActions.block.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated) {
            entries.push({
                type: 'block',
                icon: '🚫',
                text: `Заблокирован: ${player.name}${player.role ? ` (${player.role.name})` : ''}${getStepSelectionForTarget('block', idx) ? ` | ${formatStepActor(getStepSelectionForTarget('block', idx))}` : ''}`,
                class: 'night-report-block'
            });
        }
    });

    // Informational checks selected in step mode
    entries.push(...getStepInfoEntries());

    if (entries.length === 0) {
        reportBody.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">Нет выбранных действий</div>';
    } else {
        reportBody.innerHTML = entries.map(entry =>
            `<div class="night-report-entry">
        <span class="night-report-icon">${entry.icon}</span>
        <span class="night-report-text ${entry.class}">${entry.text}</span>
    </div>`
        ).join('');
    }

    document.getElementById('night-report-modal').classList.add('active');
}

function closeNightReport() {
    document.getElementById('night-report-modal').classList.remove('active');
}

function closeNightReportOutside(e) {
    if (e.target === document.getElementById('night-report-modal')) {
        closeNightReport();
    }
}

function confirmNightReport() {
    takeGameSnapshot(`ночь ${nightCount}`);
    // Apply night actions

    // Find players who are both killed and protected (they survive)
    const killedSet = new Set(nightActions.kill);
    const protectedSet = new Set(nightActions.protect);
    const savedIndices = new Set([...killedSet].filter(idx => protectedSet.has(idx)));

    // Find lucky players who are targeted by kills or poison
    const luckySavedFromKill = new Set();
    const luckySavedFromPoison = new Set();

    const sourceFor = (action, idx) => {
        const sel = getStepSelectionForTarget(action, idx);
        return sel ? formatStepActor(sel) : null;
    };


    // Check for lucky players targeted by kills
    nightActions.kill.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated && player.role && player.role.id === 'lucky') {
            if (!savedIndices.has(idx)) {
                luckySavedFromKill.add(idx);
            }
        }
    });

    // Check for lucky players targeted by poison (also check if protected from poison)
    nightActions.poison.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated) {
            // Lucky ability: survives poison
            if (player.role && player.role.id === 'lucky') {
                luckySavedFromPoison.add(idx);
            }
            // Protection still blocks poison
            if (protectedSet.has(idx)) {
                // Player is protected, so poison doesn't work - don't add to poison list
                const poisonIndex = nightActions.poison.indexOf(idx);
                if (poisonIndex > -1) {
                    // Mark this poison as blocked by protection (we'll skip it later)
                }
            }
        }
    });

    const bodyguardSacrifices = new Map();
    stepModeSelections
        .filter(sel => sel.roleId === 'bodyguard' && sel.effectAction === 'protect')
        .forEach(sel => {
            const bodyguard = gamePlayers[sel.actorIdx];
            if (!bodyguard || bodyguard.eliminated) return;
            sel.targetIndices.forEach(targetIdx => {
                const target = gamePlayers[targetIdx];
                if (!target || target.eliminated) return;
                if (!bodyguardSacrifices.has(targetIdx)) {
                    bodyguardSacrifices.set(targetIdx, sel.actorIdx);
                }
            });
        });

    const sacrificedBodyguards = new Set();

    // First, handle kills (eliminate players) - skip those who are protected or lucky
    // Collect dead judge/sectant/avenger for post-processing
    const deadJudgeOrSectant = [];
    let deadAvenger = null;

    nightActions.kill.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated) {
            if (savedIndices.has(idx)) {
                // Player was protected, they survive
                const killSource = sourceFor('kill', idx);
                const protectSource = sourceFor('protect', idx);
                logAction(`<span class="night-report-protected">⛑ Пытались убить, но защитили:</span> <span class="player-name">${player.name}</span>${player.role ? ` (${player.role.name})` : ''}${killSource ? ` | ${killSource}` : ''}${protectSource ? ` | защищал: ${protectSource}` : ''}`, 'protected-log');

                const sacrificedIdx = bodyguardSacrifices.get(idx);
                if (sacrificedIdx !== undefined && !sacrificedBodyguards.has(sacrificedIdx)) {
                    const bodyguard = gamePlayers[sacrificedIdx];
                    if (bodyguard && !bodyguard.eliminated) {
                        const bodyguardSavedByDoctor = protectedSet.has(sacrificedIdx);
                        if (bodyguardSavedByDoctor) {
                            const bgProtectSource = sourceFor('protect', sacrificedIdx);
                            logAction(`<span class="night-report-protected">🛡️ Телохранитель прикрыл цель и выжил:</span> <span class="player-name">${bodyguard.name}</span>${bodyguard.role ? ` (${bodyguard.role.name})` : ''}${bgProtectSource ? ` | защищал: ${bgProtectSource}` : ''}`, 'protected-log');
                        } else {
                            bodyguard.eliminated = true;
                            sacrificedBodyguards.add(sacrificedIdx);
                            logAction(`<span class="eliminated">🛡️💀 Телохранитель погиб, защищая:</span> <span class="player-name">${player.name}</span> — <span class="player-name">${bodyguard.name}</span>${bodyguard.role ? ` (${bodyguard.role.name})` : ''}`, 'eliminated');
                            if (bodyguard.role && (bodyguard.role.id === 'judge' || bodyguard.role.id === 'sectant')) {
                                deadJudgeOrSectant.push(bodyguard);
                            }
                            if (bodyguard.role && bodyguard.role.id === 'avenger') {
                                deadAvenger = bodyguard;
                            }
                        }
                    }
                }
            } else if (luckySavedFromKill.has(idx)) {
                // Lucky player survives the kill
                logAction(`<span class="night-report-protected">🍀 Пытались убить, но повезло:</span> <span class="player-name">${player.name}</span>${player.role ? ` (${player.role.name})` : ''}`, 'protected-log');
            } else {
                // Player dies - mark as eliminated but don't clear statuses yet
                player.eliminated = true;
                const killSource = sourceFor('kill', idx);
                logAction(`<span class="eliminated">💀 Убит:</span> <span class="player-name">${player.name}</span>${player.role ? ` (${player.role.name})` : ''}${killSource ? ` | ${killSource}` : ''}`, 'eliminated');

                // Check if dead player is judge, sectant, or avenger
                if (player.role && (player.role.id === 'judge' || player.role.id === 'sectant')) {
                    deadJudgeOrSectant.push(player);
                }
                if (player.role && player.role.id === 'avenger') {
                    deadAvenger = player;
                }
            }
        }
    });

    // Apply protect status ONLY for logging (no visual effect remains after night)
    // Protection still works against kills, but doesn't leave a status
    nightActions.protect.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated) {
            if (!savedIndices.has(idx) && !luckySavedFromKill.has(idx)) {
                const def = STATUS_DEFS['protected'];
                const protectSource = sourceFor('protect', idx);
                logAction(`<span class="${def.logKey}">${def.logOn}:</span> <span class="player-name">${player.name}</span>${protectSource ? ` | ${protectSource}` : ''}`, def.logKey);
            }
        }
    });

    // Apply alibi status
    nightActions.alibi.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated && !player.alibied) {
            player.alibied = true;
            const def = STATUS_DEFS['alibied'];
            const alibiSource = sourceFor('alibi', idx);
            logAction(`<span class="${def.logKey}">${def.logOn}:</span> <span class="player-name">${player.name}</span>${alibiSource ? ` | ${alibiSource}` : ''}`, def.logKey);
        }
    });

    // Apply jail
    nightActions.jail.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated && !player.jailed) {
            player.jailed = true;
            const jailSource = sourceFor('jail', idx);
            logAction(`<span class="jailed">🔒 Посажен в тюрьму:</span> <span class="player-name">${player.name}</span>${jailSource ? ` | ${jailSource}` : ''}`, 'jailed');
        }
    });

    // Apply poison status (skip if player is lucky or protected)
    nightActions.poison.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated && !player.poisoned) {
            if (protectedSet.has(idx)) {
                logAction(`<span class="night-report-protected">🛡️ Пытались отравить, но защитили:</span> <span class="player-name">${player.name}</span>${player.role ? ` (${player.role.name})` : ''}`, 'protected-log');
            } else if (luckySavedFromPoison.has(idx)) {
                logAction(`<span class="night-report-protected">🍀 Пытались отравить, но повезло:</span> <span class="player-name">${player.name}</span>${player.role ? ` (${player.role.name})` : ''}`, 'protected-log');
            } else {
                player.poisoned = true;
                const def = STATUS_DEFS['poisoned'];
                const poisonSource = sourceFor('poison', idx);
                logAction(`<span class="${def.logKey}">${def.logOn}:</span> <span class="player-name">${player.name}</span>${poisonSource ? ` | ${poisonSource}` : ''}`, def.logKey);
            }
        }
    });

    // Apply sect status
    nightActions.sect.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated && !player.sected) {
            player.sected = true;
            const def = STATUS_DEFS['sected'];
            const sectSource = sourceFor('sect', idx);
            logAction(`<span class="${def.logKey}">${def.logOn}:</span> <span class="player-name">${player.name}</span>${sectSource ? ` | ${sectSource}` : ''}`, def.logKey);
        }
    });

    // Apply block status
    nightActions.block.forEach(idx => {
        const player = gamePlayers[idx];
        if (player && !player.eliminated && !player.blocked) {
            player.blocked = true;
            const def = STATUS_DEFS['blocked'];
            const blockSource = sourceFor('block', idx);
            logAction(`<span class="${def.logKey}">${def.logOn}:</span> <span class="player-name">${player.name}</span>${blockSource ? ` | ${blockSource}` : ''}`, def.logKey);
        }
    });

    // Log informational checks from step mode
    getStepInfoEntries().forEach(entry => {
        logAction(`<span class="night-report-block">${entry.icon} ${entry.text}</span>`, 'night-report-block');
    });

    // Log night completion with night number
    logAction(`🌙 Ночь ${nightCount} завершена`, '');
    nightCount++;
    updateNightCounter();

    // Clear night actions
    stepModeSelections = [];
    clearNightSelection();

    // Clear statuses of dead players (after all actions are applied)
    gamePlayers.forEach(p => {
        if (p.eliminated) {
            p.jailed = false;
            p.poisoned = p.sected = p.protected = p.alibied = p.blocked = false;
        }
    });

    // Close modal
    closeNightReport();
    saveGameState();

    // Small delay to ensure modal is fully closed
    setTimeout(() => {
        const c = document.getElementById('game-players');
        animateFlip(c, gamePlayers, () => {
            renderStats();
            renderTurnOrder();

            // Show avenger modal if avenger died
            if (deadAvenger) {
                showAvengerModal(deadAvenger);
                return;
            }

            // Check for dead judge/sectant and show modal if needed
            checkDeadJudgeOrSectant(deadJudgeOrSectant);

            // Проверка условий победы
            const winResult = checkWinConditions();
            if (winResult) {
                showWinModal(winResult);
            }
        });
    }, 50);
}

// ── Judge/Sectant death action modal ───────────────────────────
let deathActionCallback = null;

// ── Avenger death modal ────────────────────────────────────────
let avengerTargetIndex = null;
let deadAvengerPlayer = null;

function showDeathActionModal(roleType, count) {
    const modal = document.getElementById('death-action-modal');
    const title = document.getElementById('death-action-title');
    const text = document.getElementById('death-action-text');
    const confirmBtn = document.getElementById('death-action-confirm');

    if (roleType === 'judge') {
        title.textContent = '👨‍⚖️ Судья убит';
        text.textContent = `Судья (${getDeadJudgeName()}) мёртв. В тюрьме находится ${count} игрок(ов).`;
        confirmBtn.textContent = '✓ Освободить всех';
        deathActionCallback = () => releaseAllJailed();
    } else if (roleType === 'sectant') {
        title.textContent = '🕯️ Сектант убит';
        text.textContent = `Сектант (${getDeadSectantName()}) мёртв. В секте находится ${count} игрок(ов).`;
        confirmBtn.textContent = '✓ Распустить секту';
        deathActionCallback = () => releaseAllSected();
    }

    confirmBtn.onclick = () => {
        if (deathActionCallback) deathActionCallback();
        closeDeathAction();
    };

    modal.classList.add('active');
}

function getDeadJudgeName() {
    const judge = gamePlayers.find(p => p.role && p.role.id === 'judge' && p.eliminated);
    return judge ? judge.name : 'Судья';
}

function getDeadSectantName() {
    const sectant = gamePlayers.find(p => p.role && p.role.id === 'sectant' && p.eliminated);
    return sectant ? sectant.name : 'Сектант';
}

function releaseAllJailed() {
    let count = 0;
    gamePlayers.forEach(p => {
        if (p.jailed && !p.eliminated) {
            p.jailed = false;
            count++;
        }
    });
    logAction(`✅ Освобождено из тюрьмы: ${count} иг. (смерть судьи)`, 'freed');
    saveGameState();
    renderGame();
}

function releaseAllSected() {
    let count = 0;
    gamePlayers.forEach(p => {
        if (p.sected && !p.eliminated) {
            p.sected = false;
            count++;
        }
    });
    logAction(`✅ Распущена секта: ${count} иг. (смерть сектанта)`, 'sected-log');
    saveGameState();
    renderGame();
}

function closeDeathAction() {
    document.getElementById('death-action-modal').classList.remove('active');
}

function closeDeathActionOutside(e) {
    if (e.target === document.getElementById('death-action-modal')) {
        closeDeathAction();
    }
}

// ── Avenger modal functions ─────────────────────────────────────
function showAvengerModal(deadPlayer) {
    deadAvengerPlayer = deadPlayer;
    avengerTargetIndex = null;

    const modal = document.getElementById('avenger-modal');
    const text = document.getElementById('avenger-text');
    const targetsDiv = document.getElementById('avenger-targets');
    const confirmBtn = document.getElementById('avenger-confirm');

    text.textContent = `${deadPlayer.name} (Мститель) убит. Кто должен умереть?`;
    confirmBtn.style.display = 'none';

    // Build list of alive players (excluding the dead avenger)
    const alivePlayers = gamePlayers.filter(p => !p.eliminated && p !== deadPlayer);

    if (alivePlayers.length === 0) {
        targetsDiv.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">Нет живых игроков</div>';
    } else {
        targetsDiv.innerHTML = alivePlayers.map((p, idx) => {
            const originalIdx = gamePlayers.indexOf(p);
            return `
        <div class="night-report-entry" style="cursor:pointer;border-radius:6px;" 
             onclick="selectAvengerTarget(${originalIdx}, this)">
            <span class="night-report-icon">🎯</span>
            <span class="night-report-text">${p.name}${p.role ? ` (${p.role.name})` : ''}</span>
        </div>
    `;
        }).join('');
    }

    confirmBtn.onclick = () => {
        if (avengerTargetIndex !== null) {
            const target = gamePlayers[avengerTargetIndex];
            if (target) {
                target.eliminated = true;
                target.jailed = false;
                target.poisoned = target.sected = target.protected = target.alibied = target.blocked = false;
                logAction(`<span class="eliminated">🎯 Мститель убил:</span> <span class="player-name">${target.name}</span>${target.role ? ` (${target.role.name})` : ''}`, 'eliminated');
                saveGameState();
                renderGame();
            }
        }
        closeAvenger();
    };

    modal.classList.add('active');
}

function selectAvengerTarget(idx, targetEl) {
    avengerTargetIndex = idx;
    const confirmBtn = document.getElementById('avenger-confirm');
    const targetsDiv = document.getElementById('avenger-targets');

    // Update visual selection
    targetsDiv.querySelectorAll('.night-report-entry').forEach(el => {
        el.style.background = '';
    });
    if (targetEl) {
        targetEl.style.background = 'rgba(229, 57, 53, 0.2)';
    }

    confirmBtn.style.display = 'flex';
}

function closeAvenger() {
    document.getElementById('avenger-modal').classList.remove('active');
    deadAvengerPlayer = null;
    avengerTargetIndex = null;
}

function closeAvengerOutside(e) {
    if (e.target === document.getElementById('avenger-modal')) {
        closeAvenger();
    }
}

function openRulesModal() {
    document.getElementById('rules-modal').classList.add('active');
}

function closeRulesModal() {
    document.getElementById('rules-modal').classList.remove('active');
}

function closeRulesModalOutside(e) {
    if (e.target === document.getElementById('rules-modal')) {
        closeRulesModal();
    }
}

// ── Universal confirm modal ──────────────────────────────────────
let _confirmModalCallback = null;

function showConfirmModal(message, title = 'Подтверждение', onConfirm = null) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-message').textContent = message;
    document.getElementById('confirm-modal').classList.add('active');

    const okBtn = document.getElementById('confirm-modal-ok-btn');
    const cancelBtn = document.getElementById('confirm-modal-cancel-btn');

    // Remove old listeners
    okBtn.replaceWith(okBtn.cloneNode(true));
    cancelBtn.replaceWith(cancelBtn.cloneNode(true));

    // Add new listeners
    const newOkBtn = document.getElementById('confirm-modal-ok-btn');
    const newCancelBtn = document.getElementById('confirm-modal-cancel-btn');

    newOkBtn.onclick = () => {
        closeConfirmModal();
        if (onConfirm) onConfirm();
    };

    newCancelBtn.onclick = () => {
        closeConfirmModal();
    };

    haptic('light');
}

function closeConfirmModal() {
    document.getElementById('confirm-modal').classList.remove('active');
}

function closeConfirmModalOutside(e) {
    if (e.target === document.getElementById('confirm-modal')) {
        closeConfirmModal();
    }
}

// ═══ Win Condition Check ═══════════════════════════════════════════

function checkWinConditions() {
    // Не показываем победу, если уже отклонили в этой сессии
    if (winConditionDismissed) return null;

    const alive = gamePlayers.filter(p => !p.eliminated);
    const totalAlive = alive.length;

    // Влиятельные преступники (не адвокат, не любовница)
    const influentialCriminals = alive.filter(p =>
        p.role && p.role.team === 'criminal' &&
        !['lawyer', 'mistress'].includes(p.role.id)
    );

    // Все отщепенцы
    const outcasts = alive.filter(p =>
        p.role && p.role.team === 'outcast'
    );

    // Живые горожане
    const citizens = alive.filter(p =>
        p.role && p.role.team === 'citizen'
    );

    // Все преступники (включая адвоката/любовницу)
    const allCriminals = alive.filter(p =>
        p.role && p.role.team === 'criminal'
    );

    // 1. Проверка сектанта
    const sectant = alive.find(p => p.role?.id === 'sectant');
    if (sectant) {
        const allSected = alive.every(p => p.sected || p.role?.id === 'sectant');
        if (allSected && totalAlive > 1) {
            return { winner: 'outcast', message: '🕯️ Все живые в секте — победа сектанта!' };
        }
    }

    // 2. Проверка маньяка (1 на 1), такая же для отравителя
    const maniac = alive.find(p => p.role?.id === 'maniac');
    const poisoner = alive.find(p => p.role?.id === 'poisoner');
    if ((maniac || poisoner) && totalAlive === 2) {
        const loneWolf = maniac || poisoner;
        return { winner: 'outcast', message: `🔪 ${loneWolf.role.name} один на один — победа ${loneWolf.role.name.toLowerCase()}!` };
    }

    // 3. Проверка победы горожан
    //    Нет влиятельных преступников И нет отщепенцев
    if (influentialCriminals.length === 0 && outcasts.length === 0) {
        return { winner: 'citizen', message: '🔵 Все преступники и отщепенцы устранены — победа горожан!' };
    }

    // 4. Проверка победы мафии
    //    Нет отщепенцев И криминалов >= мирных И среди мирных нет защитных ролей (доктор, везунчик, телохранитель)
    const protectiveRoles = ['doctor', 'lucky', 'bodyguard'];
    const hasProtector = citizens.some(p =>
        p.role && protectiveRoles.includes(p.role.id)
    );

    if (outcasts.length === 0 &&
        allCriminals.length >= citizens.length &&
        allCriminals.length > 0 &&
        citizens.length > 0 &&
        !hasProtector) {
        return { winner: 'criminal', message: '🔴 Мафия поровну с мирными без защиты — победа мафии!' };
    }

    // 5. Игра продолжается
    return null;
}

function showWinModal(result) {
    if (!result || winConditionDismissed) return;

    const modal = document.getElementById('win-modal');
    const title = document.getElementById('win-modal-title');
    const message = document.getElementById('win-modal-message');

    // Определяем иконку и заголовок по победителю
    let icon = '🏆';
    let winnerTitle = 'Победа!';
    if (result.winner === 'citizen') {
        icon = '🔵';
        winnerTitle = 'Победа горожан!';
    } else if (result.winner === 'criminal') {
        icon = '🔴';
        winnerTitle = 'Победа мафии!';
    } else if (result.winner === 'outcast') {
        icon = '🟡';
        winnerTitle = 'Победа отщепенца!';
    }

    title.textContent = `${icon} ${winnerTitle}`;
    message.textContent = result.message;

    // Кнопка "Отклонить" — скрыть окно, но не завершать игру
    const dismissBtn = document.getElementById('win-modal-dismiss-btn');
    dismissBtn.onclick = () => {
        winConditionDismissed = true;
        closeWinModal();
        showToast('Окно победы скрыто', '🚫');
        logAction('🚫 Окно победы отклонено ведущим', '');
    };

    // Кнопка "Завершить игру"
    const endBtn = document.getElementById('win-modal-end-btn');
    endBtn.onclick = () => {
        closeWinModal();
        _doEndGame();
    };

    modal.classList.add('active');
    haptic('success');
    logAction(result.message, 'win-log');
}

function closeWinModal() {
    document.getElementById('win-modal').classList.remove('active');
}

function closeWinModalOutside(e) {
    if (e.target === document.getElementById('win-modal')) {
        closeWinModal();
    }
}

function checkDeadJudgeOrSectant(deadPlayers) {
    // Delay to ensure animation and render are complete
    setTimeout(() => {
        // Check if avenger modal is already open
        if (document.getElementById('avenger-modal').classList.contains('active')) {
            return;
        }

        // Check if any dead player is judge or sectant and there are jailed/sected players
        const jailedPlayers = gamePlayers.filter(p => p.jailed && !p.eliminated);
        const sectedPlayers = gamePlayers.filter(p => p.sected && !p.eliminated);

        for (const player of deadPlayers) {
            if (player.role && player.role.id === 'judge' && jailedPlayers.length > 0) {
                showDeathActionModal('judge', jailedPlayers.length);
                return;
            }
            if (player.role && player.role.id === 'sectant' && sectedPlayers.length > 0) {
                showDeathActionModal('sectant', sectedPlayers.length);
                return;
            }
        }
    }, 300);
}

// ── Role picker ─────────────────────────────────────────────────
function openRolePicker(idx) {
    currentPickerPlayer = idx;
    document.getElementById('modal-title').textContent = `Роль для: ${gamePlayers[idx].name}`;
    document.getElementById('role-modal').classList.add('active');
    switchRoleTab(activeRoleTab, false);
    renderRoleButtons();
}

function switchRoleTab(team, save = true) {
    activeRoleTab = team;
    if (save) localStorage.setItem('mafia_role_tab', team);
    document.querySelectorAll('.role-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.team === team);
    });
    document.getElementById('roles-citizen').style.display = team === 'citizen' ? 'grid' : 'none';
    document.getElementById('roles-criminal').style.display = team === 'criminal' ? 'grid' : 'none';
    document.getElementById('roles-outcast').style.display = team === 'outcast' ? 'grid' : 'none';
}

function renderRoleButtons() {
    const containers = {
        citizen: document.getElementById('roles-citizen'),
        criminal: document.getElementById('roles-criminal'),
        outcast: document.getElementById('roles-outcast')
    };
    Object.values(containers).forEach(c => c.innerHTML = '');
    const visibleRoles = (enabledRoles && enabledRoles.size > 0)
        ? ROLES.filter(r => enabledRoles.has(r.id))
        : ROLES;
    visibleRoles.forEach(role => {
        const btn = document.createElement('button');
        btn.className = `role-btn team-${role.team}-bg`;
        btn.innerHTML = `<img src="${getRoleImgPath(role.id)}" class="role-btn-img" alt="${role.name}" loading="lazy" onerror="this.style.display='none'"><span class="role-label team-${role.team}">${role.name}</span>`;
        btn.onclick = () => pickRole(role);
        containers[role.team].appendChild(btn);
    });
    switchRoleTab(activeRoleTab, false);
}

function assignRoleToPlayerByIndex(idx, role) {
    const player = gamePlayers[idx];
    if (!player) return;

    const oldRole = player.role ? player.role.name : null;
    const newRole = role ? role.name : null;
    if (oldRole !== newRole) {
        if (oldRole === null && newRole !== null) {
            logAction(`<span class="role-assigned">🎭 Роль назначена:</span> <span class="player-name">${player.name}</span>: <span class="role-assigned">${newRole}</span>`, 'role-assigned');
        } else if (oldRole !== null && newRole === null) {
            logAction(`<span class="role-removed">❌ Роль снята:</span> <span class="player-name">${player.name}</span>: <span class="role-removed">${oldRole}</span>`, 'role-removed');
        } else {
            logAction(`<span class="role-changed">🔄 Роль изменена:</span> <span class="player-name">${player.name}</span>: <span class="role-changed">${oldRole}</span> → <span class="role-changed">${newRole}</span>`, 'role-changed');
        }
    }
    player.role = role;
}

function pickRole(role) {
    if (currentPickerPlayer !== null) {
        assignRoleToPlayerByIndex(currentPickerPlayer, role);
        if (stepModeActive) {
            stepModeQueue = getStepModeQueue();
            if (stepModeQueue.length === 0) {
                stepModeIndex = 0;
            } else if (stepModeIndex >= stepModeQueue.length) {
                stepModeIndex = stepModeQueue.length - 1;
            }
        }
    }
    saveGameState();
    closeModal();
    renderGame();
    if (stepModeActive) {
        focusCurrentStepModeStep();
    }
}

function closeModal() { document.getElementById('role-modal').classList.remove('active'); currentPickerPlayer = null; }
function closeModalOutside(e) { if (e.target === document.getElementById('role-modal')) closeModal(); }

// ── Navigation ──────────────────────────────────────────────────
function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-' + name).classList.add('active');
    document.querySelectorAll('.nav-btn').forEach((b, i) => {
        b.classList.toggle('active', (name === 'game' && i === 0) || (name === 'notes' && i === 1));
    });
    if (name === 'notes') {
        renderActionLog();
    }
}

function endGame() {
    if (confirmEndGame) {
        showConfirmModal('Завершить игру?', 'Подтверждение', () => {
            _doEndGame();
        });
        return;
    }
    _doEndGame();
}

function _doEndGame() {
    resetStepModeState();
    document.getElementById('bottom-nav').classList.remove('active');
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('screen-lobby').classList.add('active');
    // Restore selectedPlayers from the game's player list so the same selection is preserved
    selectedPlayers = new Set(gamePlayers.map(p => p.name));
    localStorage.setItem('mafia_selected_players', JSON.stringify([...selectedPlayers]));
    gamePlayers = [];
    actionLog = [];
    nightCount = 1;
    gameStartTime = null;
    saveActionLog();
    // Clear saved game state
    localStorage.removeItem('mafia_game_players');
    localStorage.removeItem('mafia_night_actions');
    localStorage.removeItem('mafia_game_started');
    localStorage.removeItem('mafia_night_count');
    localStorage.removeItem('mafia_notepad');
    document.getElementById('notepad').value = '';
    renderLobby();
}

// ═══ Animations & Micro-interactions ═══════════════════════════════

// ── Toast notifications ──────────────────────────────────
(function initToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
})();

function showToast(message, icon = '✓', duration = 2200) {
    if (typeof showToasts !== 'undefined' && !showToasts) return;
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);
    const timeout = setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, duration);
    toast.addEventListener('click', () => {
        clearTimeout(timeout);
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, { once: true });
}

// ── Haptic feedback ──────────────────────────────────────
function haptic(pattern = 'light') {
    if (typeof enableHaptic !== 'undefined' && !enableHaptic) return;
    if (!navigator.vibrate) return;
    switch (pattern) {
        case 'light': navigator.vibrate(12); break;
        case 'medium': navigator.vibrate(25); break;
        case 'heavy': navigator.vibrate([30, 20, 30]); break;
        case 'success': navigator.vibrate([15, 50, 15]); break;
        case 'error': navigator.vibrate([40, 30, 40, 30, 40]); break;
    }
}

// ── Ripple effect ────────────────────────────────────────
document.addEventListener('pointerdown', function (e) {
    if (typeof showRipple !== 'undefined' && !showRipple) return;
    const target = e.target.closest(
        '.btn, .night-action-btn, .nav-btn, .stab-btn, .role-btn, .role-tab-btn, ' +
        '.player-check, .settings-role-item, .clear-role-btn, .modal-close-btn, ' +
        '.notes-settings-btn, .settings-modal-close, .status-rows-toggle-btn, ' +
        '.night-effects-toggle, .gp-status-btn, .gp-action-btn'
    );
    if (!target) return;

    const rect = target.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'ripple-effect';
    const size = Math.max(rect.width, rect.height) * 2;
    ripple.style.width = ripple.style.height = size + 'px';
    ripple.style.left = (e.clientX - rect.left) + 'px';
    ripple.style.top = (e.clientY - rect.top) + 'px';
    target.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
});

// ── Stagger index helpers ────────────────────────────────
function applyStaggerIndices(container, selector, prop) {
    if (!container) return;
    const items = container.querySelectorAll(selector);
    items.forEach((el, i) => el.style.setProperty(prop, i));
}

// Patch renderLobby to add stagger
const _origRenderLobby = renderLobby;
renderLobby = function () {
    _origRenderLobby();
    applyStaggerIndices(document.getElementById('lobby-players'), '.player-check', '--card-index');
};

// Patch renderGamePlayers to add stagger
const _origRenderGamePlayers = renderGamePlayers;
renderGamePlayers = function () {
    _origRenderGamePlayers();
    applyStaggerIndices(document.getElementById('game-players'), '.game-player-card', '--card-index');
};

// Patch renderTurnOrder to add stagger
const _origRenderTurnOrder = renderTurnOrder;
renderTurnOrder = function () {
    _origRenderTurnOrder();
    applyStaggerIndices(document.getElementById('turn-order'), '.turn-chip, .turn-dead-marker', '--chip-index');
};

// Patch renderRoleButtons to add stagger
const _origRenderRoleButtons = renderRoleButtons;
renderRoleButtons = function () {
    _origRenderRoleButtons();
    document.querySelectorAll('.role-grid').forEach(grid => {
        applyStaggerIndices(grid, '.role-btn', '--role-index');
    });
};

// Patch generateNightReport to add stagger
const _origGenerateNightReport = generateNightReport;
generateNightReport = function () {
    _origGenerateNightReport();
    const body = document.getElementById('night-report-body');
    applyStaggerIndices(body, '.night-report-entry', '--entry-index');
};

// Patch showScreen for smooth transitions
const _origShowScreen = showScreen;
showScreen = function (name) {
    _origShowScreen(name);
    haptic('light');
};

// Patch startGame with toast + haptic
const _origStartGame = startGame;
startGame = function () {
    _origStartGame();
    haptic('success');
    showToast('Игра начата!', '🎮');
};

// Patch eliminatePlayer with haptic + toast
const _origDoEliminatePlayer = _doEliminatePlayer;
_doEliminatePlayer = function (idx, player) {
    if (!player.eliminated) {
        haptic('heavy');
        showToast(`${player.name} выбыл`, '💀');
    }
    _origDoEliminatePlayer(idx, player);
};

// Patch restorePlayer with haptic + toast
const _origRestorePlayer = restorePlayer;
restorePlayer = function (idx) {
    const player = gamePlayers[idx];
    haptic('success');
    showToast(`${player.name} воскрешён`, '👼');
    _origRestorePlayer(idx);
};

// Patch selectNightAction with haptic
const _origSelectNightAction = selectNightAction;
selectNightAction = function (action) {
    haptic('light');
    _origSelectNightAction(action);
};

// Patch confirmNightReport with haptic + toast
const _origConfirmNightReport = confirmNightReport;
confirmNightReport = function () {
    haptic('medium');
    showToast(`Ночь ${nightCount} завершена`, '🌙');
    _origConfirmNightReport();
};

// Patch pickRole with haptic + toast
const _origPickRole = pickRole;
pickRole = function (role) {
    if (role) {
        haptic('medium');
        showToast(`Роль: ${role.name}`, '🎭');
    } else {
        haptic('light');
        showToast('Роль снята', '❌');
    }
    _origPickRole(role);
};

// Patch addNewPlayer with toast
const _origAddNewPlayer = addNewPlayer;
addNewPlayer = function () {
    const input = document.getElementById('new-player-input');
    const name = input.value.trim();
    if (!name) return;
    _origAddNewPlayer();
    haptic('light');
    showToast(`${name} добавлен`, '➕');
};

// Patch toggleJail with haptic
const _origToggleJail = toggleJail;
toggleJail = function (idx) {
    const player = gamePlayers[idx];
    haptic('medium');
    _origToggleJail(idx);
    showToast(player.jailed ? `${player.name} в тюрьме` : `${player.name} свободен`, player.jailed ? '🔒' : '🔓');
};

// Patch toggleStatus with haptic
const _origToggleStatus = toggleStatus;
toggleStatus = function (idx, statusKey) {
    const player = gamePlayers[idx];
    haptic('light');
    _origToggleStatus(idx, statusKey);
    const def = STATUS_DEFS[statusKey];
    showToast(player[statusKey] ? `${def.label}: ${player.name}` : `${def.label} снят: ${player.name}`, def.icon);
};

// Patch endGame with haptic
const _origDoEndGame = _doEndGame;
_doEndGame = function () {
    haptic('heavy');
    showToast('Игра завершена', '🏁');
    _origDoEndGame();
};

// Patch addNewPlayer Enter key to also trigger haptic
document.getElementById('new-player-input')?.addEventListener('focus', () => haptic('light'));

// ── Notepad persistence ──────────────────────────────────────────
function saveNotepad() {
    const notepad = document.getElementById('notepad');
    if (notepad) {
        localStorage.setItem('mafia_notepad', notepad.value);
    }
}

function restoreNotepad() {
    const notepad = document.getElementById('notepad');
    const saved = localStorage.getItem('mafia_notepad');
    if (notepad && saved) {
        notepad.value = saved;
    }
}

// ── Init ────────────────────────────────────────────────────────
applySettingsToggles();
restoreGameState(); // Restore game state if page was refreshed
restoreNotepad(); // Restore notepad content

// Register Service Worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { });
}

// Auto-save notepad on input
document.getElementById('notepad')?.addEventListener('input', () => saveNotepad());

// ── Clock ──────────────────────────────────────────────────────
function formatGameDuration() {
    if (!gameStartTime) return '';
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = elapsed % 60;

    if (hours > 0) {
        return `${hours}ч ${minutes.toString().padStart(2, '0')}м`;
    }
    return `${minutes}м ${seconds.toString().padStart(2, '0')}с`;
}

function updateClock() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const clockEl = document.getElementById('game-clock');
    if (clockEl) {
        clockEl.textContent = `${hours}:${minutes}:${seconds}`;
    }

    // Update game duration
    const durationEl = document.getElementById('game-duration');
    if (durationEl && gameStartTime) {
        durationEl.textContent = '⏱ ' + formatGameDuration();
    }
}
setInterval(updateClock, 1000);
updateClock();

// ═══ Swipe Navigation ═══════════════════════════════════════════
(function initSwipeNavigation() {
    const screens = ['game', 'notes'];
    let swipeStartX = 0;
    let swipeStartY = 0;
    let swipeStartTime = 0;
    const SWIPE_THRESHOLD = 50;
    const SWIPE_VELOCITY = 0.3;

    document.addEventListener('touchstart', (e) => {
        // Не свайпаем если модалка открыта
        if (document.querySelector('.modal-overlay.active')) return;
        // Не свайпаем если таргет — input/textarea
        if (e.target.closest('input, textarea')) return;

        swipeStartX = e.touches[0].clientX;
        swipeStartY = e.touches[0].clientY;
        swipeStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
        if (!swipeStartX) return;

        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = endX - swipeStartX;
        const deltaY = endY - swipeStartY;
        const deltaTime = Date.now() - swipeStartTime;

        swipeStartX = 0;

        // Только горизонтальные свайпы
        if (Math.abs(deltaX) < Math.abs(deltaY)) return;
        if (Math.abs(deltaX) < SWIPE_THRESHOLD) return;
        if (deltaTime > 500) return; // слишком медленно

        // Определяем текущий экран
        const activeScreen = document.querySelector('.screen.active');
        if (!activeScreen) return;

        const currentIdx = screens.indexOf(activeScreen.id.replace('screen-', ''));
        if (currentIdx === -1) return;

        if (deltaX < 0 && currentIdx < screens.length - 1) {
            // Свайп влево — следующий экран
            showScreen(screens[currentIdx + 1]);
        } else if (deltaX > 0 && currentIdx > 0) {
            // Свайп вправо — предыдущий экран
            showScreen(screens[currentIdx - 1]);
        }
    }, { passive: true });
})();
