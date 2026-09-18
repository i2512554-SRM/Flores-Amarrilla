/* Música local y detalles ambientales. Una sola pista, sin reiniciar al repetir. */
export function createSoundscape({
  volume = 0.18, source = '', musicVolume = 0.45,
  musicElement = document.getElementById('background-music'), onError = () => {}
} = {}) {
  const music = musicElement || new Audio();
  music.loop = true;
  music.preload = 'metadata';
  music.volume = Math.max(0, Math.min(1, musicVolume));
  if (source) music.src = source;
  let context, master, windSource;
  let enabled = false, suspended = document.hidden, disposed = false, revision = 0;

  function initializeEffects() {
    if (context) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = new AudioContextClass();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    const buffer = context.createBuffer(1, context.sampleRate * 6, context.sampleRate);
    const samples = buffer.getChannelData(0);
    let previous = 0;
    for (let i = 0; i < samples.length; i++) {
      previous = (previous + (Math.random() * 2 - 1) * 0.025) / 1.025;
      samples[i] = previous * 3.5;
    }
    windSource = context.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 480;
    const windGain = context.createGain();
    windGain.gain.value = 0.1;
    windSource.connect(filter).connect(windGain).connect(master);
    windSource.start();
  }

  function effectsVolume(value) {
    if (!context || !master || context.state === 'closed') return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(value, context.currentTime, 0.08);
  }

  function stopPlayback() {
    music.pause();
    effectsVolume(0);
  }

  function reportError(error) {
    if (disposed) return;
    revision++;
    enabled = false;
    stopPlayback();
    onError(error);
  }
  const mediaError = () => reportError(new Error('La música no pudo cargarse.'));
  music.addEventListener('error', mediaError);

  async function setEnabled(value) {
    if (disposed) return false;
    const request = ++revision;
    enabled = Boolean(value);
    if (!enabled) { stopPlayback(); return false; }
    if (suspended) return true;
    if (music.error) music.load();

    // play() se solicita dentro del gesto, antes de cualquier await.
    let playback;
    try { playback = Promise.resolve(music.play()); }
    catch (error) { playback = Promise.reject(error); }
    try {
      initializeEffects();
      context?.resume().catch(() => {});
    } catch { /* La pista funciona incluso si Web Audio no está disponible. */ }
    try {
      await playback;
    } catch (error) {
      if (disposed || request !== revision || suspended) return enabled;
      enabled = false;
      stopPlayback();
      throw error;
    }
    if (disposed || !enabled || suspended) { stopPlayback(); return enabled; }
    if (request === revision) effectsVolume(volume);
    return enabled;
  }

  function chime(index = 0) {
    if (!enabled || suspended || !context || context.state !== 'running') return;
    const notes = [261.63, 329.63, 392, 523.25];
    const now = context.currentTime;
    notes.slice(0, index === 3 ? 4 : 2).forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency * (index === 1 ? 1.12 : 1);
      gain.gain.setValueAtTime(0, now + i * 0.09);
      gain.gain.linearRampToValueAtTime(0.14, now + i * 0.09 + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 1.4);
      oscillator.connect(gain).connect(master);
      oscillator.start(now + i * 0.09);
      oscillator.stop(now + i * 0.09 + 1.45);
    });
  }

  async function suspend() {
    suspended = true;
    revision++;
    stopPlayback();
    if (context?.state === 'running') await context.suspend();
  }

  async function resume() {
    if (disposed) return false;
    if (document.hidden) { await suspend(); return enabled; }
    suspended = false;
    return enabled ? setEnabled(true) : false;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    enabled = false;
    revision++;
    stopPlayback();
    music.removeEventListener('error', mediaError);
    try { windSource?.stop(); } catch {}
    context?.close().catch(() => {});
  }

  return { setEnabled, chime, suspend, resume, dispose };
}
