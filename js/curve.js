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
    density: 10,
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
        numerator: 4,    // 分子（每小节的拍数）
        denominator: 4    // 分母（以几分音符为一拍）
    },
    quantize: 4,         // 量化单位（4表示四分音符）
    measureDuration: 0,  // 一小节的持续时间（秒）
    gridDivisions: 16    // 网格细分数量
};

function initCanvas() {
    canvas = document.getElementById('curveCanvas');
    ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawGrid();
}

// 更新音乐设置
function updateMusicSettings() {
    const bpm = parseInt(document.getElementById('bpmControl').value);
    const timeSignature = document.getElementById('timeSignature').value.split('/');
    const quantize = parseInt(document.getElementById('quantizeValue').value);
    
    musicSettings.bpm = bpm;
    musicSettings.timeSignature.numerator = parseInt(timeSignature[0]);
    musicSettings.timeSignature.denominator = parseInt(timeSignature[1]);
    musicSettings.quantize = quantize;
    
    // 计算一小节的持续时间（秒）
    musicSettings.measureDuration = (240 / bpm) * (musicSettings.timeSignature.numerator / musicSettings.timeSignature.denominator);
    
    // 更新曲线设置
    curveSettings.duration = musicSettings.measureDuration * 4; // 默认显示4小节
    
    // 重绘网格
    drawGrid();
}

// 修改 drawGrid 函数以支持音乐网格
function drawGrid() {
    if (!canvas || !ctx) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // 绘制水平线（音高线）
    const octaveHeight = canvas.height / curveSettings.octaveRange;
    for(let i = 0; i <= curveSettings.octaveRange; i++) {
        const y = i * octaveHeight;
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        
        ctx.fillStyle = '#999';
        ctx.font = '12px Arial';
        const octave = Math.floor((curveSettings.octaveRange + 3) - i);
        ctx.fillText(`C${octave}`, 5, y - 5);
    }

    // 绘制垂直线（拍子线）
    const measureWidth = canvas.width / 4; // 4小节
    const beatWidth = measureWidth / musicSettings.timeSignature.numerator;
    const subdivisionWidth = beatWidth / (musicSettings.gridDivisions / 4);
    
    // 绘制小节线（粗线）
    for(let i = 0; i <= 4; i++) {
        const x = i * measureWidth;
        ctx.beginPath();
        ctx.strokeStyle = '#666';
        ctx.lineWidth = i === 0 ? 2 : 1;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
        
        // 添加小节数标记
        if (i < 4) {
            ctx.fillText(`${i + 1}`, x + 5, canvas.height - 5);
        }
    }
    
    // 绘制拍子线（中等粗细）
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 0.5;
    for(let measure = 0; measure < 4; measure++) {
        for(let beat = 1; beat < musicSettings.timeSignature.numerator; beat++) {
            const x = measure * measureWidth + beat * beatWidth;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    }
    
    // 绘制细分线（细线）
    ctx.strokeStyle = '#f5f5f5';
    ctx.lineWidth = 0.5;
    for(let i = 1; i < musicSettings.gridDivisions * 4; i++) {
        const x = i * subdivisionWidth;
        if (x % beatWidth !== 0) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }
    }
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
    
    // 确保平滑后的点保持在画布范围内
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

        // 计算当前点到前后点构成的线段的距离
        const distance = pointToLineDistance(
            point,
            lastPoint,
            nextPoint
        );

        // 如果距离大于容差，或者是关键点，则保留该点
        if (distance > tolerance || 
            i % 10 === 0 || // 每隔一定数量的点保留一个
            i === 1 || i === points.length - 2) { // 保留起始和结束附近的点
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

function sampleCurvePoints(points, density) {
    if (points.length <= density) return points;
    
    const sampledPoints = [];
    const step = points.length / density;
    
    for (let i = 0; i < density; i++) {
        const index = Math.floor(i * step);
        sampledPoints.push(points[index]);
    }
    
    return sampledPoints;
}

function playCurvePoints(points, instrument, startTime) {
    if (!canvas) return;
    
    points.forEach((point, index) => {
        const delay = (point.x / canvas.width) * curveSettings.duration;
        const baseFreq = noteToFreq['C2'];
        const maxFreq = baseFreq * Math.pow(2, curveSettings.octaveRange);
        const frequency = maxFreq - (point.y / canvas.height) * (maxFreq - baseFreq);
        
        if (isFinite(frequency)) {
            try {
                const note = Tone.Frequency(frequency).toNote();
                synths[instrument].triggerAttackRelease(note, 0.1, startTime + delay);
            } catch (error) {
                console.error('Error playing note:', error);
            }
        }
    });
}

// 添加绘制相关的函数
function startDrawing(e) {
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 检查是否点击到控制点
    const nearest = findNearestPoint(x, y);
    if (nearest) {
        dragState = {
            isDragging: true,
            trackId: nearest.trackId,
            curveIndex: nearest.curveIndex,
            pointIndex: nearest.pointIndex,
            startX: x,
            startY: y
        };
        return;
    }
    
    // 开始新的绘制
    isDrawing = true;
    currentStroke = {
        points: [{x, y}],
        isComplete: false
    };
    drawAllCurves();
}

function draw(e) {
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (dragState.isDragging) {
        // 处理拖拽
        const track = tracks.find(t => t.id === dragState.trackId);
        if (track && track.curves[dragState.curveIndex]) {
            const curve = track.curves[dragState.curveIndex];
            const point = curve.points[dragState.pointIndex];
            
            // 计算移动距离
            const dx = x - dragState.startX;
            const dy = y - dragState.startY;
            
            // 更新点的位置
            point.x += dx;
            point.y += dy;
            
            // 限制在画布范围内
            point.x = Math.max(0, Math.min(canvas.width, point.x));
            point.y = Math.max(0, Math.min(canvas.height, point.y));
            
            // 更新拖拽起始位置
            dragState.startX = x;
            dragState.startY = y;
            
            drawAllCurves();
        }
        return;
    }
    
    if (isDrawing) {
        currentStroke.points.push({x, y});
        drawAllCurves();
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
        // 获取当前音轨
        const trackId = getCurrentTrackId();
        const track = tracks.find(t => t.id === trackId);
        if (track) {
            // 添加新曲线到音轨
            track.curves.push({
                points: [...currentStroke.points],
                trackId: trackId,
                instrument: document.getElementById('curveInstrument').value
            });
            updateTracksDisplay();
        }
    }
    
    // 重置当前笔画
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
                // 确定曲线颜色
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
            
            // 显示音���信息
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
    const sampledPoints = sampleCurvePoints(curve.points, curveSettings.density);
    
    initAudioContext().then(() => {
        const now = Tone.now();
        playCurvePoints(sampledPoints, track.instrument, now);
    });
}

// 添加曲线形状生成函数
function generateCurveShape(shape, startNote, endNote, duration, density) {
    const points = [];
    const startFreq = noteToFreq[startNote];
    const endFreq = noteToFreq[endNote];
    
    for (let i = 0; i < density; i++) {
        const t = i / (density - 1);
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
    
    // 设置编辑状态
    editingCurveState = {
        trackId,
        curveIndex,
        originalPoints: [...track.curves[curveIndex].points],
        isEditing: true
    };
    
    // 显示编辑面板
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
        // 填充音符选项
        const noteOptions = Object.keys(noteToFreq).map(note => 
            `<option value="${note}">${note}</option>`
        ).join('');
        
        startNoteSelect.innerHTML = noteOptions;
        endNoteSelect.innerHTML = noteOptions;
        
        // 设置当前值
        startNoteSelect.value = startNote;
        endNoteSelect.value = endNote;
    }
    
    // 更新其他控制器
    const densityInput = document.querySelector('.curve-density');
    if (densityInput) {
        densityInput.value = curveSettings.density;
    }
    
    // 更新形状选择器
    const shapeSelect = document.querySelector('.curve-shape');
    if (shapeSelect) {
        shapeSelect.value = 'custom'; // 默认使用自定义形状
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
    const density = parseInt(document.querySelector('.curve-density').value);
    
    const newPoints = generateCurveShape(
        shape,
        startNote,
        endNote,
        curveSettings.duration,
        density
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
    const density = parseInt(document.querySelector('.curve-density').value);
    
    const previewPoints = generateCurveShape(
        shape,
        startNote,
        endNote,
        curveSettings.duration,
        density
    );
    
    // 临时显示预览曲线
    drawAllCurves();
    drawSingleCurve(previewPoints, 'rgba(74, 144, 226, 0.5)');
}

// 取消编辑
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
    
    // 获取当前音轨
    const trackId = getCurrentTrackId();
    const track = tracks.find(t => t.id === trackId);
    if (!track) return;
    
    initAudioContext().then(() => {
        const now = Tone.now();
        
        // 播放当前音轨的所有曲
        track.curves.forEach(curve => {
            if (curve.points && curve.points.length > 0) {
                const sampledPoints = sampleCurvePoints(curve.points, curveSettings.density);
                playCurvePoints(sampledPoints, curve.instrument || track.instrument, now);
            }
        });
        
        // 如果有正在编辑的曲线，也播放它
        if (currentStroke.points.length > 0) {
            const sampledPoints = sampleCurvePoints(currentStroke.points, curveSettings.density);
            playCurvePoints(sampledPoints, track.instrument, now);
        }
    });
}

// 添加播放所有曲线的函数
function playAllCurves() {
    initAudioContext().then(() => {
        const now = Tone.now();
        
        // 遍历所有音轨
        tracks.forEach(track => {
            // 播放该音轨的所有曲线
            track.curves.forEach(curve => {
                if (curve.points && curve.points.length > 0) {
                    const sampledPoints = sampleCurvePoints(curve.points, curveSettings.density);
                    playCurvePoints(sampledPoints, curve.instrument || track.instrument, now);
                }
            });
        });
    });
}

// 修改 convertToNotes 函数以支持音符量化
function convertToNotes(curve) {
    if (!curve.points || curve.points.length === 0) return [];
    
    const sampledPoints = sampleCurvePoints(curve.points, curveSettings.density);
    const notes = [];
    
    sampledPoints.forEach((point, index) => {
        const rawTime = (point.x / canvas.width) * curveSettings.duration;
        // 量化时间
        const quantizedTime = quantizeTime(rawTime);
        const freq = canvasYToFrequency(point.y);
        const note = getClosestNote(freq);
        
        // 计算音符持续时间（基于下一个点或默认值）
        let duration;
        if (index < sampledPoints.length - 1) {
            const nextTime = (sampledPoints[index + 1].x / canvas.width) * curveSettings.duration;
            duration = quantizeTime(nextTime) - quantizedTime;
        } else {
            duration = 60 / musicSettings.bpm; // 默认一拍的时长
        }
        
        notes.push({
            note,
            time: quantizedTime,
            duration: Math.max(duration, 60 / (musicSettings.bpm * 4)), // 最小持续时间为十六分音符
            instrument: curve.instrument
        });
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
    
    // 将当前音轨的所有曲线换为音符
    track.curves.forEach(curve => {
        const notes = convertToNotes(curve);
        track.notes = track.notes.concat(notes);
    });
    
    // 按时间排序音符
    track.notes.sort((a, b) => a.time - b.time);
    
    // 更新显示
    updateTracksDisplay();
}

// 添加删除曲的函数
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
            // 计算滑后的点
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