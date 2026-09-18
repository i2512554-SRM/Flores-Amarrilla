// Ambiente generado localmente: no requiere música ni descargas adicionales.
export function createSoundscape({ volume = 0.18 } = {}) {
  let context, master, source;
  let enabled = false;
  let disposed = false;
  async function start() {
    if (disposed) return false;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    if (!context) {
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = 0;
      master.connect(context.destination);
      const buffer = context.createBuffer(1, context.sampleRate * 6, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 480;
      const wind = context.createGain();
      wind.gain.value = 0.35;
      source.connect(filter);
      filter.connect(wind);
      wind.connect(master);
      source.start();
    }
    await context.resume();
    return true;
  }
  async function setEnabled(value) {
    enabled = value;
    if (value && !await start()) { enabled = false; return false; }
    if (master) {
      const now = context.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(master.gain.value, now);
      master.gain.linearRampToValueAtTime(enabled ? volume : 0, now + 0.35);
    }
    return enabled;
  }
  function chime(index = 0) {
    if (!enabled || !context || context.state !== 'running') return;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = [392, 440, 523.25, 659.25][index % 4];
    envelope.gain.setValueAtTime(0, now);
    envelope.gain.linearRampToValueAtTime(0.3, now + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.001, now + 1.1);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(now);
    oscillator.stop(now + 1.15);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); };
  }
  return {
    setEnabled, chime,
    async suspend() { if (context?.state === 'running') await context.suspend(); },
    async resume() { if (enabled && context && !disposed) await context.resume(); },
    dispose() {
      disposed = true;
      source?.stop();
      if (context && context.state !== 'closed') context.close().catch(() => {});
    }
  };
}
