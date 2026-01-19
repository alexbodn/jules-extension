(function () {
    const vscode = acquireVsCodeApi();
    const messagesContainer = document.getElementById('messages');
    const input = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const checkoutBtn = document.getElementById('checkout-btn');
    const closeBtn = document.getElementById('close-btn');
    const header = document.getElementById('header');
    const sessionTitle = document.getElementById('session-title');

    let currentSession = null;

    window.addEventListener('message', event => {
        const message = event.data;
        switch (message.type) {
            case 'updateSession':
                updateSession(message.session, message.activities);
                break;
            case 'clearSession':
                clearSession();
                break;
            case 'appendActivity':
                appendActivity(message.activity);
                scrollToBottom();
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
        vscode.postMessage({ type: 'closeSession' });
    });

    function sendMessage() {
        const text = input.value;
        if (text.trim()) {
            vscode.postMessage({ type: 'sendMessage', text: text });
            input.value = '';
        }
    }

    function updateSession(session, activities) {
        currentSession = session;
        header.classList.remove('hidden');
        sessionTitle.innerText = session.title || session.name;

        messagesContainer.innerHTML = ''; // Clear existing

        if (activities && activities.length > 0) {
            activities.forEach(activity => appendActivity(activity));
        } else {
            const empty = document.createElement('div');
            empty.className = 'empty-state';
            empty.innerText = 'No activities yet.';
            messagesContainer.appendChild(empty);
        }

        scrollToBottom();
    }

    function clearSession() {
        currentSession = null;
        header.classList.add('hidden');
        messagesContainer.innerHTML = '<div class="welcome-message">Select a session from the "Jules Sessions" view to start chatting.</div>';
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

        // If it's a "progress" or "info" type, maybe collapse it?
        // For now, let's make progress details collapsible if they are long?
        // Or just keep them as is. The prompt asked to "expand / collapse little info messages".
        if (activity.displayType === 'progress' || activity.displayType === 'info') {
             msgDiv.classList.add('info-message');
             // Add a toggle?
             headerDiv.style.cursor = 'pointer';
             headerDiv.onclick = () => {
                 contentDiv.classList.toggle('collapsed');
             };
        }

        msgDiv.appendChild(headerDiv);
        msgDiv.appendChild(contentDiv);

        messagesContainer.appendChild(msgDiv);
    }

    function scrollToBottom() {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}());
