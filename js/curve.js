function smoothPoint(prev, curr, next) {
    const tension = 0.3;
    return {
        x: curr.x + (next.x - prev.x) * tension * 0.5,
        y: curr.y + (next.y - prev.y) * tension * 0.5
    };
}

function lerp(start, end, t) {
    return start + (end - start) * t;
}

function optimizePoints(points, tolerance = 5) {
    if (points.length < 3) return points;
    
    const result = [points[0]];
    let lastPoint = points[0];
    
    for (let i = 1; i < points.length - 1; i++) {
        const point = points[i];
        const distance = Math.sqrt(
            Math.pow(point.x - lastPoint.x, 2) + 
            Math.pow(point.y - lastPoint.y, 2)
        );
        
        // 只有当点之间的距离大于容差时才保存
        if (distance > tolerance) {
            // 使用贝塞尔曲线平滑处理
            const prevPoint = result[result.length - 1];
            const nextPoint = points[i + 1];
            const smoothedPoint = smoothPoint(prevPoint, point, nextPoint);
            result.push(smoothedPoint);
            lastPoint = smoothedPoint;
        }
    }
    
    result.push(points[points.length - 1]);
    return result;
}

// 频率转换函数
function frequencyToCanvasY(freq) {
    const baseFreq = noteToFreq['C2'];
    const maxFreq = baseFreq * Math.pow(2, curveSettings.octaveRange);
    return canvas.height * (1 - (freq - baseFreq) / (maxFreq - baseFreq));
}

function canvasYToFrequency(y) {
    const baseFreq = noteToFreq['C2'];
    const maxFreq = baseFreq * Math.pow(2, curveSettings.octaveRange);
    return maxFreq - (y / canvas.height) * (maxFreq - baseFreq);
}

// 控制点检测函数
function findNearestPoint(x, y) {
    const threshold = 10;
    let nearest = null;
    let minDistance = threshold;

    tracks.forEach(track => {
        track.curves.forEach((curve, curveIndex) => {
            curve.points.forEach((point, pointIndex) => {
                const distance = Math.sqrt(
                    Math.pow(point.x - x, 2) + 
                    Math.pow(point.y - y, 2)
                );
                if (distance < minDistance) {
                    minDistance = distance;
                    nearest = {
                        trackId: track.id,
                        curveIndex: curveIndex,
                        pointIndex: pointIndex
                    };
                }
            });
        });
    });
    return nearest;
}

// 内管理函数
function cleanupUnusedCurves() {
    tracks.forEach(track => {
        track.curves = track.curves.filter(curve => 
            curve && curve.points && curve.points.length > 1
        );
        
        track.curves.forEach(curve => {
            curve.points = optimizePoints(curve.points);
        });
    });
    
    if (window.gc) window.gc();
}

// 曲线编辑相关代码
let curveSettings = {
    duration: 3,
    octaveRange: 3
};

let currentCurve = {
    points: [],
    trackId: null,
    instrument: null
};

let isDrawing = false;
let lastPoint = null;
let currentPath = [];
let drawingSpeed = 0;
const minWidth = 2;
const maxWidth = 6;
const speedFactor = 0.3;
let dragState = {
    isDragging: false,
    trackId: null,
    curveIndex: -1,
    pointIndex: -1,
    startX: 0,
    startY: 0
};

// 在文件开头添加 canvas 变量
let canvas = null;
let ctx = null;

// 添加新的变量来跟踪当前绘制状态
let currentStroke = {
    points: [],
    isComplete: false
};

// 添加曲线编辑状态
let editingCurveState = {
    trackId: null,
    curveIndex: null,
    originalPoints: null,
    isEditing: false
};

// 添加音乐时间控制相关变量
let musicSettings = {
    bpm: 120,
    timeSignature: {
        numerator: 4,    // 每小节的拍数
        denominator: 4    // 以几分音符为一拍
    },
    quantize: '8',       // 量化单位（8表示八分音符）
    measureCount: 4      // 显示的小节数
};

function initCanvas() {
    canvas = document.getElementById('curveCanvas');
    ctx = canvas.getContext('2d');
    
    // 根据小节数设置画布宽度
    updateCanvasWidth();
    
    // 初始化网格
    drawGrid();
}

// 添加画布宽度更新函数
function updateCanvasWidth() {
    const container = document.querySelector('.canvas-scroll-container');
    const minWidth = container.clientWidth;
    const measureWidth = 200; // 每小节的基础宽度
    const totalWidth = Math.max(minWidth, measureWidth * musicSettings.measureCount);
    const extraSpace = 200;
    
    // 设置画布的实际尺寸
    canvas.width = totalWidth + extraSpace;
    canvas.style.width = (totalWidth + extraSpace) + 'px';
    canvas.parentElement.style.width = (totalWidth + extraSpace) + 'px';
    
    // 保持画布高度不变
    canvas.style.height = canvas.height + 'px';
}

// 添加小节数更新函数
function updateMeasureCount(count) {
    musicSettings.measureCount = parseInt(count);
    updateCanvasWidth();
    updateMusicSettings();
    drawAllCurves();
}

// 添加滚动控制函数
function scrollToStart() {
    const container = document.querySelector('.canvas-scroll-container');
    container.scrollTo({ left: 0, behavior: 'smooth' });
}

function scrollToEnd() {
    const container = document.querySelector('.canvas-scroll-container');
    container.scrollTo({ 
        left: container.scrollWidth - container.clientWidth,
        behavior: 'smooth'
    });
}

function scrollLeft() {
    const container = document.querySelector('.canvas-scroll-container');
    container.scrollBy({ left: -200, behavior: 'smooth' });
}

function scrollRight() {
    const container = document.querySelector('.canvas-scroll-container');
    container.scrollBy({ left: 200, behavior: 'smooth' });
}

// 修改 drawGrid 函数
function drawGrid() {
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 计算网格尺寸
    const measureWidth = canvas.width / musicSettings.measureCount;
    const beatWidth = measureWidth / musicSettings.timeSignature.numerator;
    const subdivisionWidth = beatWidth / (parseInt(musicSettings.quantize) / 4);
    
    // 绘制小节线
    for (let i = 0; i <= musicSettings.measureCount; i++) {
        const x = i * measureWidth;
        ctx.beginPath();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = i === 0 ? 2 : 1;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        
        // 添���记
        if (i < musicSettings.measureCount) {
            ctx.fillStyle = '#666';
            ctx.font = '12px Arial';
            ctx.fillText(`${i + 1}`, x + 5, canvas.height - 5);
        }
    }
    
    // 绘拍子线和细分线
    for (let measure = 0; measure < musicSettings.measureCount; measure++) {
        // 拍子线
        for (let beat = 1; beat < musicSettings.timeSignature.numerator; beat++) {
            const x = measure * measureWidth + beat * beatWidth;
            ctx.beginPath();
            ctx.strokeStyle = '#999';
            ctx.lineWidth = 1;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
        
        // 细分线
        for (let subdivision = 1; subdivision < musicSettings.timeSignature.numerator * (parseInt(musicSettings.quantize) / 4); subdivision++) {
            const x = measure * measureWidth + subdivision * subdivisionWidth;
            if (x % beatWidth !== 0) {
                ctx.beginPath();
                ctx.strokeStyle = '#eee';
                ctx.lineWidth = 0.5;
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }
        }
    }
    
    // 绘音高网格
    drawPitchGrid();
}

// 修改坐标计算函数
function getCanvasCoordinates(e) {
    const rect = canvas.getBoundingClientRect();
    const container = document.querySelector('.canvas-scroll-container');
    const containerRect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    
    // 计算相对于容器的坐标，而不是相对于画布
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;
    
    return {
        x: x + scrollLeft,
        y: Math.max(0, Math.min(canvas.height, y))
    };
}

function startNewCurve() {
    currentCurve = {
        points: [], // 存储所有笔画
        trackId: getCurrentTrackId(),
        instrument: document.getElementById('curveInstrument').value
    };
    currentStroke = {
        points: [],
        isComplete: false
    };
    drawGrid();
}

function clearCurve() {
    // 清除当前音轨的所有曲线
    const trackId = getCurrentTrackId();
    const track = tracks.find(t => t.id === trackId);
    if (track) {
        track.curves = [];
    }
    
    // 重置当前状态
    currentCurve = {
        points: [],
        trackId: null,
        instrument: null
    };
    currentStroke = {
        points: [],
        isComplete: false
    };
    
    // 重置编辑状态
    editingCurveState = {
        trackId: null,
        curveIndex: null,
        originalPoints: null,
        isEditing: false
    };
    
    // 隐藏编辑面板
    const editPanel = document.querySelector('.curve-edit-panel');
    if (editPanel) {
        editPanel.style.display = 'none';
    }
    
    // 重绘画布
    drawGrid();
    updateTracksDisplay();
}

function smoothCurve() {
    tracks.forEach(track => {
        track.curves.forEach(curve => {
            if (curve.points && curve.points.length > 2) {
                // 使用改进的平滑算法
                curve.points = smoothCurvePoints(curve.points);
            }
        });
    });
    drawAllCurves();
}

// 新的平滑算法
function smoothCurvePoints(points) {
    if (points.length < 3) return points;

    const smoothedPoints = [];
    const windowSize = 5; // 平滑窗口大小
    
    // 保持第一个点不变
    smoothedPoints.push(points[0]);
    
    // 对中间的点进行平滑
    for (let i = 0; i < points.length; i++) {
        // 如果是第一个或最后一个点，直接保持不变
        if (i === 0 || i === points.length - 1) {
            continue;
        }
        
        // 获取窗口内的点
        const windowStart = Math.max(0, i - Math.floor(windowSize / 2));
        const windowEnd = Math.min(points.length - 1, i + Math.floor(windowSize / 2));
        let sumX = 0;
        let sumY = 0;
        let count = 0;
        
        // 计算加权平均
        for (let j = windowStart; j <= windowEnd; j++) {
            // 距离中心点越近权重越大
            const weight = 1 - Math.abs(i - j) / windowSize;
            sumX += points[j].x * weight;
            sumY += points[j].y * weight;
            count += weight;
        }
        
        // 添加平滑后的点
        smoothedPoints.push({
            x: sumX / count,
            y: sumY / count,
            width: points[i].width // 保持原有的宽度属性
        });
    }
    
    // 保持最后一个点不变
    smoothedPoints.push(points[points.length - 1]);
    
    // 确保平滑后点保持在画布范围内
    smoothedPoints.forEach(point => {
        point.x = Math.max(0, Math.min(canvas.width, point.x));
        point.y = Math.max(0, Math.min(canvas.height, point.y));
    });
    
    return smoothedPoints;
}

function reducePoints(points, tolerance = 2) {
    if (points.length < 3) return points;

    const result = [points[0]];
    let lastPoint = points[0];

    for (let i = 1; i < points.length - 1; i++) {
        const point = points[i];
        const nextPoint = points[i + 1];

        // 算当前点到前后点构成的线段的距离
        const distance = pointToLineDistance(
            point,
            lastPoint,
            nextPoint
        );

        // 如果距离大于容差，或者是关键点，则保留该点
        if (distance > tolerance || 
            i % 10 === 0 || // 每隔一定数量的点保一
            i === 1 || i === points.length - 2) { // 保留始和结束附近的点
            result.push(point);
            lastPoint = point;
        }
    }

    result.push(points[points.length - 1]);
    return result;
}

function pointToLineDistance(point, lineStart, lineEnd) {
    const A = point.x - lineStart.x;
    const B = point.y - lineStart.y;
    const C = lineEnd.x - lineStart.x;
    const D = lineEnd.y - lineStart.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
        xx = lineStart.x;
        yy = lineStart.y;
    } else if (param > 1) {
        xx = lineEnd.x;
        yy = lineEnd.y;
    } else {
        xx = lineStart.x + param * C;
        yy = lineStart.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;

    return Math.sqrt(dx * dx + dy * dy);
}

// 在 curve.js 的末尾添加这些函数

function sampleCurvePoints(points) {
    const beatsPerMeasure = musicSettings.timeSignature.numerator;
    const totalBeats = beatsPerMeasure * musicSettings.measureCount;
    const notesPerBeat = parseInt(musicSettings.quantize) / 4; // 将量化值转换为每拍的音符数
    const totalNotes = totalBeats * notesPerBeat;
    
    const sampledPoints = [];
    for (let i = 0; i < totalNotes; i++) {
        const t = i / (totalNotes - 1);
        const index = Math.floor(t * (points.length - 1));
        sampledPoints.push(points[index]);
    }
    
    return sampledPoints;
}

function playCurvePoints(points, instrument, startTime) {
    if (!canvas || !points.length) return;
    
    const beatDuration = 60 / musicSettings.bpm;
    const noteDuration = beatDuration * (4 / parseInt(musicSettings.quantize)); // 使用量化值确定音符时值
    
    points.forEach((point, index) => {
        const delay = (point.x / canvas.width) * curveSettings.duration;
        const baseFreq = noteToFreq['C2'];
        const maxFreq = baseFreq * Math.pow(2, curveSettings.octaveRange);
        const frequency = maxFreq - (point.y / canvas.height) * (maxFreq - baseFreq);
        
        if (isFinite(frequency) && frequency > 0) {
            try {
                const note = Tone.Frequency(frequency).toNote();
                if (note && typeof note === 'string') {
                    synths[instrument].triggerAttackRelease(
                        note,
                        noteDuration,
                        startTime + delay
                    );
                }
            } catch (error) {
                console.error('Error playing note:', error);
            }
        }
    });
}

// 修改 startDrawing 函数
function startDrawing(e) {
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(e);
    
    // 检查是否点击到控制点
    const nearest = findNearestPoint(coords.x, coords.y);
    if (nearest) {
        dragState = {
            isDragging: true,
            trackId: nearest.trackId,
            curveIndex: nearest.curveIndex,
            pointIndex: nearest.pointIndex,
            startX: coords.x,
            startY: coords.y
        };
        return;
    }
    
    // 开始新的绘制
    isDrawing = true;
    currentStroke = {
        points: [{x: coords.x, y: coords.y}],
        isComplete: false
    };
    drawAllCurves();
}

// 修改 draw 函数
function draw(e) {
    if (!canvas) return;
    
    const coords = getCanvasCoordinates(e);
    
    if (dragState.isDragging) {
        const track = tracks.find(t => t.id === dragState.trackId);
        if (track && track.curves[dragState.curveIndex]) {
            const point = track.curves[dragState.curveIndex].points[dragState.pointIndex];
            if (point) {
                point.x = coords.x;
                point.y = coords.y;
                drawAllCurves();
            }
        }
        
        autoScroll(e.clientX);
        return;
    }
    
    if (isDrawing) {
        // 添加新点前检查与上一个点的距离
        const lastPoint = currentStroke.points[currentStroke.points.length - 1];
        if (lastPoint) {
            const dx = coords.x - lastPoint.x;
            const dy = coords.y - lastPoint.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            // 如果点之间距离太大，添加中间点以保持平滑
            if (distance > 10) {
                const steps = Math.ceil(distance / 10);
                for (let i = 1; i < steps; i++) {
                    const t = i / steps;
                    currentStroke.points.push({
                        x: lastPoint.x + dx * t,
                        y: lastPoint.y + dy * t
                    });
                }
            }
        }
        
        // 添加当前点
        currentStroke.points.push({
            x: coords.x,
            y: coords.y
        });
        
        // 立即重绘以显示实时反馈
        drawAllCurves();
        
        // 检查是否需要滚动
        autoScroll(e.clientX);
    }
}

function stopDrawing() {
    if (dragState.isDragging) {
        dragState.isDragging = false;
        updateTracksDisplay();
        return;
    }
    
    if (!isDrawing) return;
    isDrawing = false;
    
    if (currentStroke.points.length > 1) {
        const trackId = getCurrentTrackId();
        const track = tracks.find(t => t.id === trackId);
        if (track) {
            // 添加新曲线到音轨
            const newCurve = {
                points: [...currentStroke.points],
                trackId: trackId,
                instrument: document.getElementById('curveInstrument').value
            };
            track.curves.push(newCurve);
            
            // 将曲线转换为音符
            const notes = convertToNotes(newCurve);
            track.notes = track.notes.concat(notes);
            
            // 按时间排序音符
            track.notes.sort((a, b) => a.time - b.time);
            
            updateTracksDisplay();
        }
    }
    
    currentStroke = {
        points: [],
        isComplete: false
    };
    
    drawAllCurves();
}

function drawAllCurves() {
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    
    // 绘制所有音轨的曲线
    tracks.forEach(track => {
        track.curves.forEach((curve, curveIndex) => {
            if (curve && curve.points && curve.points.length > 0) {
                // 定曲线颜色
                let color;
                if (editingCurveState.isEditing && 
                    editingCurveState.trackId === track.id && 
                    editingCurveState.curveIndex === curveIndex) {
                    color = '#ff4444';
                } else {
                    color = `hsl(${track.id * 360 / tracks.length}, 70%, 50%)`;
                }
                
                drawSingleCurve(curve.points, color, true);
            }
        });
    });
    
    // 绘制当前正在绘制的笔画
    if (currentStroke.points.length > 0) {
        drawSingleCurve(currentStroke.points, '#4a90e2', false);
    }
}

function drawSingleCurve(points, color, showControls = true) {
    if (!canvas || !ctx || points.length < 2) return;
    
    // 绘制曲线
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    
    // 绘制控制点
    if (showControls) {
        points.forEach((point, index) => {
            // 绘制控制点
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.fill();
            
            // 绘制控制点边框
            ctx.beginPath();
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 1;
            ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
            ctx.stroke();
            
            // 显示音信息
            if (index % 5 === 0 || index === 0 || index === points.length - 1) {
                const freq = canvasYToFrequency(point.y);
                const note = getClosestNote(freq);
                ctx.fillStyle = '#666';
                ctx.font = '10px Arial';
                ctx.fillText(note, point.x + 7, point.y - 7);
            }
        });
    }
}

// 修改 playCurvePoints 函数以支持播放单个笔画
function playCurvePart(trackId, curveIndex) {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.curves[curveIndex]) return;
    
    const curve = track.curves[curveIndex];
    const sampledPoints = sampleCurvePoints(curve.points);
    
    initAudioContext().then(() => {
        const now = Tone.now();
        playCurvePoints(sampledPoints, track.instrument, now);
    });
}

// 添加曲形状生成函数
function generateCurveShape(shape, startNote, endNote, duration) {
    const points = [];
    const startFreq = noteToFreq[startNote];
    const endFreq = noteToFreq[endNote];
    
    for (let i = 0; i < duration; i++) {
        const t = i / (duration - 1);
        const x = t * canvas.width;
        let y;
        
        switch (shape) {
            case 'linear':
                y = lerp(startFreq, endFreq, t);
                break;
            case 'sine':
                y = startFreq + (endFreq - startFreq) * (Math.sin(t * Math.PI) + 1) / 2;
                break;
            case 'custom':
                // 保持原有点的y值
                if (editingCurveState.originalPoints) {
                    const index = Math.floor(t * (editingCurveState.originalPoints.length - 1));
                    y = editingCurveState.originalPoints[index].y;
                }
                break;
        }
        
        // 将频率转换为画布坐标
        const canvasY = frequencyToCanvasY(y);
        points.push({x, y: canvasY});
    }
    
    return points;
}

// 开始编辑曲线
function editCurve(trackId, curveIndex) {
    const track = tracks.find(t => t.id === trackId);
    if (!track || !track.curves[curveIndex]) return;
    
    // 设编辑状态
    editingCurveState = {
        trackId,
        curveIndex,
        originalPoints: [...track.curves[curveIndex].points],
        isEditing: true
    };
    
    // 显编辑面板
    const editPanel = document.querySelector('.curve-edit-panel');
    editPanel.style.display = 'block';
    
    // 初始化编辑面板的值
    const curve = track.curves[curveIndex];
    initializeEditPanel(curve);
    
    // 高亮显示当前编辑的曲线
    drawAllCurves();
}

// 初始化编辑面板
function initializeEditPanel(curve) {
    if (!curve || !curve.points || curve.points.length === 0) return;
    
    // 获取曲线的起始和结束音高
    const startNote = getClosestNote(canvasYToFrequency(curve.points[0].y));
    const endNote = getClosestNote(canvasYToFrequency(curve.points[curve.points.length - 1].y));
    
    // 更新音符选择器
    const startNoteSelect = document.querySelector('.curve-start-note');
    const endNoteSelect = document.querySelector('.curve-end-note');
    
    if (startNoteSelect && endNoteSelect) {
        // 填音符选项
        const noteOptions = Object.keys(noteToFreq).map(note => 
            `<option value="${note}">${note}</option>`
        ).join('');
        
        startNoteSelect.innerHTML = noteOptions;
        endNoteSelect.innerHTML = noteOptions;
        
        // 设置当前值
        startNoteSelect.value = startNote;
        endNoteSelect.value = endNote;
    }
    
    // 更新形状选择器
    const shapeSelect = document.querySelector('.curve-shape');
    if (shapeSelect) {
        shapeSelect.value = 'custom'; // 默认用自定义形状
    }
}

// 应用曲线更改
function applyCurveChanges() {
    if (!editingCurveState.isEditing) return;
    
    const track = tracks.find(t => t.id === editingCurveState.trackId);
    if (!track) return;
    
    const startNote = document.querySelector('.curve-start-note').value;
    const endNote = document.querySelector('.curve-end-note').value;
    const shape = document.querySelector('.curve-shape').value;
    
    const newPoints = generateCurveShape(
        shape,
        startNote,
        endNote,
        curveSettings.duration
    );
    
    track.curves[editingCurveState.curveIndex].points = newPoints;
    updateTracksDisplay();
    drawAllCurves();
    
    // 闭编辑面板
    cancelCurveEdit();
}

// 预览曲线变化
function previewCurve() {
    const startNote = document.querySelector('.curve-start-note').value;
    const endNote = document.querySelector('.curve-end-note').value;
    const shape = document.querySelector('.curve-shape').value;
    
    const previewPoints = generateCurveShape(
        shape,
        startNote,
        endNote,
        curveSettings.duration
    );
    
    // 临时显示预览曲线
    drawAllCurves();
    drawSingleCurve(previewPoints, 'rgba(74, 144, 226, 0.5)');
}

// 编辑
function cancelCurveEdit() {
    const editPanel = document.querySelector('.curve-edit-panel');
    editPanel.style.display = 'none';
    
    editingCurveState = {
        trackId: null,
        curveIndex: null,
        originalPoints: null,
        isEditing: false
    };
    
    drawAllCurves();
}

// 添加播放曲线函数
function playCurve() {
    if (!canvas) return;
    
    // 获取当前轨
    const trackId = getCurrentTrackId();
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    initAudioContext().then(() => {
        const now = Tone.now();
        
        // 播放当前音轨的所有曲
        track.curves.forEach(curve => {
            if (curve.points && curve.points.length > 0) {
                const sampledPoints = sampleCurvePoints(curve.points);
                playCurvePoints(sampledPoints, curve.instrument || track.instrument, now);
            }
        });
        
        // 如果有正在编辑的曲线，也播放它
        if (currentStroke.points.length > 0) {
            const sampledPoints = sampleCurvePoints(currentStroke.points);
            playCurvePoints(sampledPoints, track.instrument, now);
        }
    });
}

// 添加播放所有曲线的函数
function playAllCurves() {
    initAudioContext().then(() => {
        const now = Tone.now();
        
        // 遍历所有轨
        tracks.forEach(track => {
            // 播放该音轨的所有曲线
            track.curves.forEach(curve => {
                if (curve.points && curve.points.length > 0) {
                    const sampledPoints = sampleCurvePoints(curve.points);
                    playCurvePoints(sampledPoints, curve.instrument || track.instrument, now);
                }
            });
        });
    });
}

// 修改 convertToNotes 函数，优化音符生成
function convertToNotes(curve) {
    if (!curve.points || curve.points.length === 0) return [];
    
    const notes = [];
    let currentNote = null;
    const tolerance = 0.1; // 音高变化检测的容差
    const beatDuration = 60 / musicSettings.bpm;
    
    curve.points.forEach((point, index) => {
        const time = (point.x / canvas.width) * curveSettings.duration;
        const freq = canvasYToFrequency(point.y);
        const note = getClosestNote(freq);
        const velocity = Math.round((point.width || minWidth) / maxWidth * 127);
        
        if (!currentNote) {
            // 开始新音符
            currentNote = {
                note: note,
                time: quantizeTime(time),
                duration: 0,
                velocity: velocity,
                instrument: curve.instrument
            };
        } else if (currentNote.note !== note || 
                   Math.abs(canvasYToFrequency(point.y) - canvasYToFrequency(curve.points[index - 1].y)) > tolerance ||
                   index === curve.points.length - 1) {
            // 结束当前音符并开始新音符
            currentNote.duration = Math.max(
                quantizeTime(time - currentNote.time),
                beatDuration / 4 // 最小持续时间为十六分音符
            );
            
            if (currentNote.duration > 0) {
                notes.push({...currentNote});
            }
            
            currentNote = {
                note: note,
                time: quantizeTime(time),
                duration: 0,
                velocity: velocity,
                instrument: curve.instrument
            };
        }
    });
    
    return notes;
}

// 添加时间量化函数
function quantizeTime(time) {
    const beatDuration = 60 / musicSettings.bpm;
    const quantizeDuration = beatDuration * (4 / musicSettings.quantize);
    return Math.round(time / quantizeDuration) * quantizeDuration;
}

// 添加将曲线转换为音轨的函数
function convertToLine() {
    const trackId = getCurrentTrackId();
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    // 将当前音轨的所有曲线换为音
    track.curves.forEach(curve => {
        const notes = convertToNotes(curve);
        track.notes = track.notes.concat(notes);
    });
    
    // 按时间排序音符
    track.notes.sort((a, b) => a.time - b.time);
    
    // 更新显示
    updateTracksDisplay();
}

// 加删除曲的函数
function deleteCurve(trackId, curveIndex) {
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    track.curves.splice(curveIndex, 1);
    updateTracksDisplay();
    drawAllCurves();
}

// 添加平滑曲线绘制函数
function drawSmoothLine(from, to, width) {
    ctx.beginPath();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#4a90e2';
    ctx.lineWidth = width;
    
    // 使用二次贝塞尔曲线实现平滑
    const cp = {
        x: (from.x + to.x) / 2,
        y: (from.y + to.y) / 2
    };
    
    ctx.quadraticCurveTo(from.x, from.y, cp.x, cp.y);
    ctx.stroke();
}

// 优化路径点
function optimizePath(path) {
    if (path.length < 3) return path;
    
    const result = [path[0]];
    let lastPoint = path[0];
    const tolerance = 5; // 容差值
    
    for (let i = 1; i < path.length - 1; i++) {
        const point = path[i];
        const nextPoint = path[i + 1];
        
        // 计算当前点与上一保留点的距离
        const distance = Math.sqrt(
            Math.pow(point.x - lastPoint.x, 2) + 
            Math.pow(point.y - lastPoint.y, 2)
        );
        
        // 如果距离大于容差，保留该点
        if (distance > tolerance) {
            // 计算后的点
            const smoothedPoint = {
                x: point.x + (nextPoint.x - lastPoint.x) * 0.1,
                y: point.y + (nextPoint.y - lastPoint.y) * 0.1,
                width: point.width
            };
            
            result.push(smoothedPoint);
            lastPoint = smoothedPoint;
        }
    }
    
    result.push(path[path.length - 1]);
    return result;
}

// 添加音高网格绘制函数
function drawPitchGrid() {
    if (!canvas || !ctx) return;
    
    // 绘制水平线（音高线）
    const octaveHeight = canvas.height / curveSettings.octaveRange;
    for (let i = 0; i <= curveSettings.octaveRange; i++) {
        const y = i * octaveHeight;
        
        // 绘制主要音高线
        ctx.beginPath();
        ctx.strokeStyle = i === 0 ? '#666' : '#eee';
        ctx.lineWidth = i === 0 ? 2 : 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
        
        // 添加音高标记
        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        const octave = Math.floor((curveSettings.octaveRange + 3) - i);
        ctx.fillText(`C${octave}`, 5, y - 5);
    }
    
    // 绘制中间的半音线（可选）
    ctx.strokeStyle = '#f8f8f8';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < curveSettings.octaveRange; i++) {
        const baseY = i * octaveHeight;
        const semitoneHeight = octaveHeight / 12; // 12个半音
        
        for (let j = 1; j < 12; j++) {
            const y = baseY + j * semitoneHeight;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    }
}

// 添加 updateMusicSettings 函数
function updateMusicSettings() {
    const bpm = parseInt(document.getElementById('bpmControl').value);
    const timeSignature = document.getElementById('timeSignature').value.split('/');
    const quantize = document.getElementById('quantizeValue').value;
    
    musicSettings.bpm = bpm;
    musicSettings.timeSignature.numerator = parseInt(timeSignature[0]);
    musicSettings.timeSignature.denominator = parseInt(timeSignature[1]);
    musicSettings.quantize = quantize;
    
    // 计算一小节的持续时间（秒）
    const beatDuration = 60 / bpm;
    const measureDuration = beatDuration * musicSettings.timeSignature.numerator;
    
    // 更新曲线设置
    curveSettings.duration = measureDuration * musicSettings.measureCount;
    
    // 更新画布宽度和重绘
    updateCanvasWidth();
    drawGrid();
    drawAllCurves();
}

// 修改自动滚动函数
function autoScroll(x) {
    const container = document.querySelector('.canvas-scroll-container');
    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    
    // 计算相对于容器的 x 坐标
    const relativeX = x - rect.left;
    
    // 定义触发区域（右侧三分之一）
    const triggerZone = clientWidth * (2/3);
    const scrollStep = 5; // 增加基础滚动步长
    
    // 如果鼠标在右侧三分之区域
    if (relativeX > triggerZone) {
        // 计算滚动速度，距离边缘越近滚动越快
        const distanceToEdge = relativeX - triggerZone;
        const maxDistance = clientWidth - triggerZone;
        const speedFactor = Math.pow(distanceToEdge / maxDistance, 2) * 0.5; // 增加速度因子
        
        // 计算本次滚动距离
        const currentScrollStep = scrollStep * speedFactor;
        
        // 确保不会滚动超出范围
        const newScrollLeft = Math.min(
            scrollLeft + currentScrollStep,
            scrollWidth - clientWidth
        );
        
        // 执行滚动
        if (newScrollLeft > scrollLeft) {
            container.scrollLeft = newScrollLeft;
            return true;
        }
    }
    
    return false;
}