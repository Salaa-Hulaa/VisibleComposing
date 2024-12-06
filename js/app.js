document.addEventListener('DOMContentLoaded', function() {
    try {
        // 首先初始化音轨
        updateTracksDisplay();
        updateTrackSelector();
        
        // 然后初始化画布
        initCanvas();
        
        // 初始化音乐设置
        updateMusicSettings();
        
        // 初始化其他内容
        generateNotes('guzheng');
        generateNotes('dizi');
        
        // 添加事件监听器
        initializeEventListeners();
        
    } catch (error) {
        console.error('Initialization error:', error);
    }
});

// 分离事件监听器初始化
function initializeEventListeners() {
    // 音乐设置控制器
    document.getElementById('bpmControl').addEventListener('input', updateMusicSettings);
    document.getElementById('timeSignature').addEventListener('change', updateMusicSettings);
    document.getElementById('quantizeValue').addEventListener('change', updateMusicSettings);
    document.getElementById('measureCount').addEventListener('change', function(e) {
        updateMeasureCount(e.target.value);
    });

    // 画布事件
    const canvas = document.getElementById('curveCanvas');
    if (canvas) {
        canvas.addEventListener('mousedown', startDrawing);
        canvas.addEventListener('mousemove', draw);
        canvas.addEventListener('mouseup', stopDrawing);
        canvas.addEventListener('mouseout', stopDrawing);
    }

    // 其他按钮事件
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async () => {
            await initAudioContext();
        });
    });
}

function generateNotes(instrumentId) {
    const notesDiv = document.querySelector(`#${instrumentId} .notes`);
    const notes = ['do', 're', 'mi', 'fa', 'sol', 'la', 'si'];
    
    notesDiv.innerHTML = '';
    notes.forEach((note, index) => {
        const noteElement = document.createElement('div');
        noteElement.className = 'note';
        noteElement.textContent = note;
        noteElement.onclick = async () => {
            try {
                await initAudioContext();
                playNote(440 * Math.pow(2, index/12), instrumentId);
            } catch (error) {
                console.error('Error playing note:', error);
            }
        };
        notesDiv.appendChild(noteElement);
    });
}

function playNote(frequency, instrument) {
    const note = getClosestNote(frequency);
    synths[instrument].triggerAttackRelease(note, '8n');
}

// 添加更新音轨选择器的函数
function updateTrackSelector() {
    const selector = document.getElementById('currentTrackSelector');
    if (!selector) return;
    
    // 保存当前选中的值
    const currentValue = selector.value;
    
    // 更新选项
    selector.innerHTML = tracks.map(track => `
        <option value="${track.id}" ${track.id === parseInt(currentValue) ? 'selected' : ''}>
            ${track.name}
        </option>
    `).join('');
    
    // 如果没有选中值，默认选择第一个音轨
    if (!currentValue) {
        selector.value = tracks[0].id;
    }
}

// 其他全局函数定义... 