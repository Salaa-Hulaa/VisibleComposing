// 合成器相关代码
let audioContext = null;
let synths = {
    guzheng: null,
    dizi: null
};

// 音色预设
const presets = {
    guzheng: {
        pentatonic: ['C4', 'D4', 'E4', 'G4', 'A4'],
        traditional: ['D4', 'E4', 'G4', 'A4', 'C5']
    },
    dizi: {
        pentatonic: ['G4', 'A4', 'C5', 'D5', 'E5'],
        traditional: ['D5', 'E5', 'G5', 'A5', 'C6']
    }
};

async function initAudioContext() {
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (Tone.context.state !== 'running') {
            await Tone.start();
        }
        
        if (!synths.guzheng || !synths.dizi) {
            initSynths();
        }
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
        }
    } catch (error) {
        console.error('AudioContext initialization error:', error);
    }
}

function initSynths() {
    // 古筝音色
    synths.guzheng = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
            type: "triangle",
            partials: [1, 0.5, 0.3, 0.2]
        },
        envelope: {
            attack: 0.02,
            decay: 1.2,
            sustain: 0.3,
            release: 1.8
        },
        portamento: 0.02,
        volume: -8
    }).toDestination();

    // 笛子音色
    synths.dizi = new Tone.PolySynth(Tone.Synth, {
        oscillator: {
            type: "sine",
            partials: [1, 0.3, 0.2],
            phase: 0,
            harmonicity: 0.5
        },
        envelope: {
            attack: 0.1,
            decay: 0.2,
            sustain: 0.4,
            release: 1.4
        },
        volume: -10
    }).toDestination();

    // 添加效果器
    const reverb = new Tone.Reverb({
        decay: 2.5,
        preDelay: 0.1
    }).toDestination();

    synths.guzheng.connect(reverb);
    synths.dizi.connect(reverb);
} 