// 音轨管理相关代码
let tracks = [{
    id: 1,
    name: '音轨 1',
    notes: [],
    curves: [],
    instrument: 'guzheng'
}];

function addTrack() {
    const newTrack = {
        id: tracks.length + 1,
        name: `音轨 ${tracks.length + 1}`,
        notes: [],
        curves: [],
        instrument: 'dizi'
    };
    tracks.push(newTrack);
    updateTracksDisplay();
    updateTrackSelector();
}

function updateTracksDisplay() {
    const container = document.getElementById('tracks-container');
    container.innerHTML = tracks.map((track, index) => `
        <div class="track" data-track-id="${track.id}">
            <div class="track-header">
                <span class="track-title">${track.name}</span>
                <div class="track-controls">
                    <select onchange="changeTrackInstrument(${track.id}, this.value)">
                        <option value="guzheng" ${track.instrument === 'guzheng' ? 'selected' : ''}>古筝</option>
                        <option value="dizi" ${track.instrument === 'dizi' ? 'selected' : ''}>笛子</option>
                    </select>
                    <button onclick="playTrack(${track.id})">播放</button>
                    <button onclick="clearTrack(${track.id})">清除</button>
                    ${index > 0 ? `<button onclick="removeTrack(${track.id})">删除</button>` : ''}
                </div>
            </div>
            <div class="track-notes" id="track-notes-${track.id}">
                ${renderTrackNotes(track)}
            </div>
        </div>
    `).join('');
}

function renderTrackNotes(track) {
    let notesHtml = '';
    
    // 添加音符编辑网格
    notesHtml += `
        <div class="note-grid-container">
            <div class="note-grid">
                ${renderNoteGrid(track)}
            </div>
            <div class="piano-roll">
                ${renderPianoRoll()}
            </div>
        </div>
    `;
    
    // 添加音符编辑控制器
    notesHtml += `
        <div class="note-controls">
            <button onclick="addNote(${track.id})">添加音符</button>
            <button onclick="convertToCurve(${track.id})">转换为曲线</button>
        </div>
    `;
    
    return notesHtml;
}

// 添加音符网格渲染函数
function renderNoteGrid(track) {
    const measureWidth = 200; // 每小节的宽度
    const noteHeight = 20;    // 每个音符格子的高度
    const notes = ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'];
    let gridHtml = '';
    
    // 渲染网格背景
    gridHtml += `<div class="grid-background">`;
    for (let measure = 0; measure < musicSettings.measureCount; measure++) {
        for (let beat = 0; beat < musicSettings.timeSignature.numerator; beat++) {
            gridHtml += `<div class="grid-beat"></div>`;
        }
    }
    gridHtml += `</div>`;
    
    // 渲染已有的音符
    track.notes.forEach(note => {
        const noteX = (note.time / curveSettings.duration) * (measureWidth * musicSettings.measureCount);
        const noteY = notes.indexOf(note.note) * noteHeight;
        const noteWidth = (note.duration / curveSettings.duration) * (measureWidth * musicSettings.measureCount);
        
        gridHtml += `
            <div class="note-block" 
                 style="left: ${noteX}px; top: ${noteY}px; width: ${noteWidth}px;"
                 data-note="${note.note}"
                 data-time="${note.time}"
                 data-duration="${note.duration}"
                 onclick="editNote(${track.id}, '${note.note}', ${note.time}, ${note.duration})">
                ${note.note}
            </div>
        `;
    });
    
    return gridHtml;
}

// 添加钢琴卷帘渲染函数
function renderPianoRoll() {
    const notes = ['C5', 'B4', 'A4', 'G4', 'F4', 'E4', 'D4', 'C4'];
    return notes.map(note => `
        <div class="piano-key" data-note="${note}">
            ${note}
        </div>
    `).join('');
}

// 添加音符编辑函数
function editNote(trackId, note, time, duration) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    showNoteEditPanel(trackId, note, time, duration);
}

// 添加音符编辑面板
function showNoteEditPanel(trackId, note, time, duration) {
    const panel = document.createElement('div');
    panel.className = 'note-edit-panel';
    panel.innerHTML = `
        <h4>编辑音符</h4>
        <div class="note-properties">
            <div class="control-group">
                <label>音高：</label>
                <select id="noteValue">
                    ${Object.keys(noteToFreq).map(n => 
                        `<option value="${n}" ${n === note ? 'selected' : ''}>${n}</option>`
                    ).join('')}
                </select>
            </div>
            <div class="control-group">
                <label>时间(拍)：</label>
                <input type="number" id="noteTime" value="${time}" step="0.25">
            </div>
            <div class="control-group">
                <label>时值(拍)：</label>
                <input type="number" id="noteDuration" value="${duration}" step="0.25">
            </div>
        </div>
        <div class="note-edit-controls">
            <button onclick="updateNote(${trackId})">确定</button>
            <button onclick="closeNoteEditPanel()">取消</button>
        </div>
    `;
    
    document.body.appendChild(panel);
}

// 更新音符
function updateNote(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    const note = document.getElementById('noteValue').value;
    const time = parseFloat(document.getElementById('noteTime').value);
    const duration = parseFloat(document.getElementById('noteDuration').value);
    
    // 更新音符
    const noteIndex = track.notes.findIndex(n => 
        n.note === note && Math.abs(n.time - time) < 0.01
    );
    
    if (noteIndex >= 0) {
        track.notes[noteIndex] = { note, time, duration };
    }
    
    // 更新对应的曲线
    updateCurveFromNotes(track);
    
    // 关闭编辑面板
    closeNoteEditPanel();
    
    // 更新显示
    updateTracksDisplay();
}

// 从音符更新曲线
function updateCurveFromNotes(track) {
    if (!track.notes.length) return;
    
    // 创建新的曲线点
    const points = [];
    const totalDuration = curveSettings.duration;
    
    track.notes.forEach(note => {
        const x = (note.time / totalDuration) * canvas.width;
        const y = noteToCanvasY(note.note);
        
        // 添加音符起始点
        points.push({ x, y });
        
        // 添加音符结束点
        const endX = ((note.time + note.duration) / totalDuration) * canvas.width;
        points.push({ x: endX, y });
    });
    
    // 更新或创建曲线
    if (!track.curves.length) {
        track.curves.push({
            points,
            trackId: track.id,
            instrument: track.instrument
        });
    } else {
        track.curves[0].points = points;
    }
    
    drawAllCurves();
}

function getCurrentTrackId() {
    const selector = document.getElementById('currentTrackSelector');
    return selector ? parseInt(selector.value) || 1 : 1;
}

function changeTrackInstrument(trackId, instrument) {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
        track.instrument = instrument;
        updateTracksDisplay();
    }
}

function playTrack(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    initAudioContext().then(() => {
        const now = Tone.now();
        
        // 播放音轨中的所有音符
        track.notes.forEach(note => {
            const time = now + note.time;
            synths[track.instrument].triggerAttackRelease(note.note, '8n', time);
        });
        
        // 播放音轨中的所有曲线
        track.curves.forEach(curve => {
            if (curve.points && curve.points.length > 0) {
                const sampledPoints = sampleCurvePoints(curve.points, curveSettings.density);
                playCurvePoints(sampledPoints, track.instrument, now);
            }
        });
    });
}

function clearTrack(trackId) {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
        track.notes = [];
        track.curves = [];
        updateTracksDisplay();
    }
}

function removeTrack(trackId) {
    const index = tracks.findIndex(t => t.id === trackId);
    if (index > 0) {
        tracks.splice(index, 1);
        updateTracksDisplay();
        updateTrackSelector();
    }
}

function playAllTracks() {
    tracks.forEach(track => playTrack(track.id));
}

function clearAllTracks() {
    tracks.forEach(track => {
        track.notes = [];
        track.curves = [];
    });
    updateTracksDisplay();
}

// 添加音符编辑面板的HTML
function renderNoteEditor(track, noteIndex) {
    return `
        <div class="note-editor">
            <div class="note-properties">
                <div class="control-group">
                    <label>音高：</label>
                    <select class="note-pitch" onchange="updateNote(${track.id}, ${noteIndex}, 'note', this.value)">
                        ${Object.keys(noteToFreq).map(note => 
                            `<option value="${note}" ${note === track.notes[noteIndex].note ? 'selected' : ''}>
                                ${note}
                            </option>`
                        ).join('')}
                    </select>
                </div>
                <div class="control-group">
                    <label>时间(秒)：</label>
                    <input type="number" 
                           step="0.1" 
                           value="${track.notes[noteIndex].time}"
                           onchange="updateNote(${track.id}, ${noteIndex}, 'time', this.value)">
                </div>
                <div class="control-group">
                    <label>持续时间：</label>
                    <input type="number" 
                           step="0.1" 
                           value="${track.notes[noteIndex].duration || 0.1}"
                           onchange="updateNote(${track.id}, ${noteIndex}, 'duration', this.value)">
                </div>
            </div>
            <div class="note-controls">
                <button onclick="previewNote(${track.id}, ${noteIndex})">预览</button>
                <button onclick="deleteNote(${track.id}, ${noteIndex})">删除</button>
            </div>
        </div>
    `;
}

// 更新音符属性
function updateNote(trackId, noteIndex, property, value) {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.notes[noteIndex]) return;
    
    track.notes[noteIndex][property] = property === 'time' || property === 'duration' 
        ? parseFloat(value) 
        : value;
    
    // 重新排序音符
    if (property === 'time') {
        track.notes.sort((a, b) => a.time - b.time);
    }
    
    updateTracksDisplay();
}

// 预览单个音符
function previewNote(trackId, noteIndex) {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.notes[noteIndex]) return;
    
    const note = track.notes[noteIndex];
    initAudioContext().then(() => {
        synths[track.instrument].triggerAttackRelease(
            note.note,
            note.duration || 0.1,
            Tone.now()
        );
    });
}

// 删除音符
function deleteNote(trackId, noteIndex) {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.notes[noteIndex]) return;
    
    track.notes.splice(noteIndex, 1);
    updateTracksDisplay();
}