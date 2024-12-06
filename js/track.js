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
    
    // 渲染音符
    if (track.notes.length > 0) {
        notesHtml += '<div class="track-note-group">';
        track.notes.forEach((note, index) => {
            notesHtml += `
                <span class="note" draggable="true" data-note-index="${index}">
                    <span class="note-pitch">${note.note}</span>
                    <span class="note-time">${(note.time).toFixed(1)}s</span>
                </span>
            `;
        });
        notesHtml += '</div>';
    }
    
    // 渲染曲线信息
    if (track.curves.length > 0) {
        notesHtml += '<div class="track-curves">';
        track.curves.forEach((curve, index) => {
            const noteCount = curve.points.length;
            notesHtml += `
                <div class="curve-info">
                    曲线 ${index + 1} 
                    <span class="curve-details">
                        (${noteCount}个点)
                        <button onclick="playCurvePart(${track.id}, ${index})">播放</button>
                        <button onclick="editCurve(${track.id}, ${index})">编辑</button>
                        <button onclick="deleteCurve(${track.id}, ${index})">删除</button>
                    </span>
                </div>
            `;
        });
        notesHtml += '</div>';
    }
    
    return notesHtml || '<div class="empty-track">空音轨</div>';
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