// 主应用逻辑
document.addEventListener('DOMContentLoaded', function() {
    initCanvas();
    generateNotes('guzheng');
    generateNotes('dizi');
    updateTracksDisplay();
    updateTrackSelector();

    // 初始化事件监听器
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', async () => {
            await initAudioContext();
        });
    });

    // 添加曲线编辑器的事件监听
    const canvas = document.getElementById('curveCanvas');
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', stopDrawing);
    canvas.addEventListener('mouseout', stopDrawing);

    // 添加控制器的事件监听
    document.getElementById('durationControl').addEventListener('input', function(e) {
        curveSettings.duration = parseFloat(e.target.value);
        document.getElementById('durationValue').textContent = curveSettings.duration + 's';
        drawGrid();
    });

    document.getElementById('densityControl').addEventListener('input', function(e) {
        curveSettings.density = parseInt(e.target.value);
        document.getElementById('densityValue').textContent = curveSettings.density;
    });

    document.getElementById('octaveRange').addEventListener('change', function(e) {
        curveSettings.octaveRange = parseFloat(e.target.value);
        drawGrid();
    });

    // 添加音轨变化的监听
    document.getElementById('currentTrackSelector').addEventListener('change', function(e) {
        drawAllCurves();
    });

    document.getElementById('bpmControl').addEventListener('input', updateMusicSettings);
    document.getElementById('timeSignature').addEventListener('change', updateMusicSettings);
    document.getElementById('quantizeValue').addEventListener('change', updateMusicSettings);

    // 初始化音乐设置
    updateMusicSettings();
});

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