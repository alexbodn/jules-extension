(function () {
    const vscode = acquireVsCodeApi();
    const sidebar = document.getElementById('sidebar');
    const mainChat = document.getElementById('main-chat');
    const messagesContainer = document.getElementById('messages');
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const checkoutBtn = document.getElementById('checkout-btn');
    const closeBtn = document.getElementById('close-btn');
    const header = document.getElementById('header');
    const sessionTitle = document.getElementById('session-title');

    // State management
    // sessions: Map<string, { session: object, activities: array }>
    let sessions = new Map();
    let currentSessionId = null;

    // Initialize from persisted state if available
    const previousState = vscode.getState();
    if (previousState && previousState.sessions) {
        sessions = new Map(previousState.sessions);
        currentSessionId = previousState.currentSessionId;
        renderSidebar();
        if (currentSessionId) {
            renderSession(currentSessionId);
        }
    }

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'updateSession':
                handleUpdateSession(message.session, message.activities);
                break;
            case 'clearSession':
                handleClearSession();
                break;
            case 'reset':
                handleReset();
                break;
            case 'appendActivity':
                if (currentSessionId) {
                    const sessionData = sessions.get(currentSessionId);
                    if (sessionData) {
                        sessionData.activities.push(message.activity);
                        saveState();
                        // Only append if currently viewing
                        appendActivity(message.activity);
                        scrollToBottom();
                    }
                }
                break;
        }
    });

    sendBtn.addEventListener('click', () => {
        sendMessage();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    checkoutBtn.addEventListener('click', () => {
        vscode.postMessage({ type: 'checkoutBranch' });
    });

    closeBtn.addEventListener('click', () => {
        if (currentSessionId) {
            sessions.delete(currentSessionId);
            currentSessionId = null;
            saveState();
            renderSidebar();
            renderEmptyState();
            vscode.postMessage({ type: 'closeSession' });
        }
    });

    function sendMessage() {
        const text = input.value;
        if (text.trim()) {
            vscode.postMessage({ type: 'sendMessage', text: text });
            input.value = '';
        }
    }

    function handleUpdateSession(session, activities) {
        // Update or add session
        sessions.set(session.name, {
            session: session,
            activities: activities || []
        });

        // Switch to it
        currentSessionId = session.name;

        saveState();
        renderSidebar();
        renderSession(currentSessionId);
    }

    function handleClearSession() {
        currentSessionId = null;
        saveState();
        renderSidebar();
        renderEmptyState();
    }

    function handleReset() {
        sessions.clear();
        currentSessionId = null;
        saveState();
        renderSidebar();
        renderEmptyState();
    }

    function saveState() {
        vscode.setState({
            sessions: Array.from(sessions.entries()),
            currentSessionId: currentSessionId
        });
    }

    function generateColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        const c = (hash & 0x00FFFFFF).toString(16).toUpperCase();
        return '#' + '00000'.substring(0, 6 - c.length) + c;
    }

    function renderSidebar() {
        sidebar.innerHTML = '';

        sessions.forEach((data, id) => {
            const icon = document.createElement('div');
            icon.className = 'session-icon';
            if (id === currentSessionId) {
                icon.classList.add('active');
            }

            icon.style.backgroundColor = generateColor(id);
            icon.title = data.session.title || id;
            icon.innerText = '🤖';

            icon.onclick = () => {
                currentSessionId = id;
                saveState();
                renderSidebar();
                renderSession(id);
            };

            sidebar.appendChild(icon);
        });
    }

    function renderSession(sessionId) {
        const data = sessions.get(sessionId);
        if (!data) return;

        header.classList.remove('hidden');
        sessionTitle.innerText = data.session.title || data.session.name;

        messagesContainer.innerHTML = ''; // Clear existing

        if (data.activities && data.activities.length > 0) {
            data.activities.forEach(activity => appendActivity(activity));
        } else {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerText = 'No activities yet.';
            messagesContainer.appendChild(empty);
        }

        scrollToBottom();
    }

    function renderEmptyState() {
        header.classList.add('hidden');
        messagesContainer.innerHTML = '<div class="welcome-message">Select a session from the side bar or the "Jules Sessions" view to start chatting.</div>';
    }

    function appendActivity(activity) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${activity.originator || 'unknown'}`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'message-header';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'message-icon';
        iconSpan.innerText = activity.icon || 'ℹ️';

        const timeSpan = document.createElement('span');
        timeSpan.className = 'message-time';
        if (activity.createTime) {
             timeSpan.innerText = new Date(activity.createTime).toLocaleTimeString();
        }

        headerDiv.appendChild(iconSpan);
        headerDiv.appendChild(timeSpan);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content markdown-body';
        contentDiv.innerHTML = activity.renderedContent || '';

        if (activity.displayType === 'progress' || activity.displayType === 'info') {
             msgDiv.classList.add('info-message');
             headerDiv.style.cursor = 'pointer';
             headerDiv.onclick = () => {
                 contentDiv.classList.toggle('collapsed');
             };
        }

        // Compress multiple progress rows
        if (activity.displayType === 'progress') {
            const lastChild = messagesContainer.lastElementChild;
            if (lastChild && lastChild.classList.contains('progress-message')) {
                // Update the existing progress message instead of appending a new one
                const lastContent = lastChild.querySelector('.message-content');
                if (lastContent) {
                    lastContent.innerHTML = activity.renderedContent || '';
                }
                const lastTime = lastChild.querySelector('.message-time');
                if (lastTime && activity.createTime) {
                    lastTime.innerText = new Date(activity.createTime).toLocaleTimeString();
                }
                return; // Skip appending the new div
            }
            msgDiv.classList.add('progress-message'); // Mark for future compression
        }

        msgDiv.appendChild(headerDiv);
        msgDiv.appendChild(contentDiv);

        messagesContainer.appendChild(msgDiv);
    }

    function scrollToBottom() {
        // Use requestAnimationFrame to ensure DOM is updated before scrolling
        requestAnimationFrame(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        });
    }

    if (currentSessionId) {
        renderSidebar();
        renderSession(currentSessionId);
    } else {
        renderEmptyState();
    }
}());
