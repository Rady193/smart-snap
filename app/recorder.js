'use strict';
// Smart Snap's recorder, in a window that is never shown (see "Recording a
// video" in main.js). It records the display main.js chose, keeps the chosen
// area of each frame, mixes the sounds asked for, and encodes the video as MP4
// (H.264 and AAC sound); as WebM (VP9 and Opus) when the area is too large for
// H.264 or MP4 cannot be made. The video goes to main.js a second at a time.
const api = window.recorder;

let mediaRecorder = null;
let stream = null;
let others = [];          // more to stop at the end: the microphone, the sound mixer
let sending = Promise.resolve();
let activeMs = 0;         // the time recorded, pauses left out
let runningSince = 0;
let size = { width: 0, height: 0 };
let mime = '';
let stopping = false;

const even = (v) => Math.max(2, Math.floor(v / 2) * 2);
const nearestEven = (v) => Math.round(v / 2) * 2;

// The area to keep of a frame whose picture is `frame` (its visible rectangle),
// from `crop`, the area as fractions of the display. Even numbers throughout:
// the frames' colour is stored at half size, and the encoder needs them.
function cut(crop, frame) {
  const x = Math.max(0, Math.min(nearestEven(crop.x * frame.width), frame.width - 2));
  const y = Math.max(0, Math.min(nearestEven(crop.y * frame.height), frame.height - 2));
  const width = even(Math.min(Math.round(crop.w * frame.width), frame.width - x));
  const height = even(Math.min(Math.round(crop.h * frame.height), frame.height - y));
  return { x: frame.x + x, y: frame.y + y, width, height };
}

// The display, with the computer's sound if asked for; without it, if that fails.
async function getScreen(setup) {
  const video = { frameRate: { ideal: setup.fps, max: setup.fps } };
  if (setup.system) {
    try {
      const withSound = await navigator.mediaDevices.getDisplayMedia({
        video,
        // The sound as the computer plays it: nothing cancelled, evened out or filtered.
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      return { stream: withSound, systemMissing: !withSound.getAudioTracks().length };
    } catch { /* tried again without the sound */ }
  }
  return { stream: await navigator.mediaDevices.getDisplayMedia({ video, audio: false }), systemMissing: !!setup.system };
}

async function getMicrophone() {
  try {
    return await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch {
    return null;   // none, or Windows keeps it from desktop apps
  }
}

// Two sounds become one track; one stays as it is.
function mix(tracks) {
  if (tracks.length <= 1) return tracks;
  const context = new AudioContext({ sampleRate: 48000 });
  const out = context.createMediaStreamDestination();
  for (const track of tracks) context.createMediaStreamSource(new MediaStream([track])).connect(out);
  if (context.state === 'suspended') context.resume();
  others.push({ stop: () => context.close() });
  return out.stream.getAudioTracks();
}

function chooseMime(width, height, withSound) {
  const mp4 = withSound ? 'video/mp4;codecs=avc1,mp4a.40.2' : 'video/mp4;codecs=avc1';
  const webm = withSound ? 'video/webm;codecs=vp9,opus' : 'video/webm;codecs=vp9';
  // H.264 as made here goes up to 4096 × 2304 pixels; a larger area is recorded as WebM.
  if (width * height <= 4096 * 2304 && MediaRecorder.isTypeSupported(mp4)) return mp4;
  return MediaRecorder.isTypeSupported(webm) ? webm : 'video/webm';
}

function stopAll() {
  stopping = true;
  for (const track of stream ? stream.getTracks() : []) track.stop();
  for (const other of others) { try { other.stop(); } catch { /* already stopped */ } }
  others = [];
}

api.onSetup(async (setup) => {
  try {
    const screen = await getScreen(setup);
    stream = screen.stream;
    const video = stream.getVideoTracks()[0];
    if (!video) throw new Error('Windows gave no picture of the screen.');
    video.addEventListener('ended', () => { if (!stopping) api.ended(); });
    size = { width: even(setup.size.width), height: even(setup.size.height) };

    // Each frame of the display, cut to the area. The frame is not copied:
    // the new one shows only part of it.
    const processor = new MediaStreamTrackProcessor({ track: video });
    const generator = new MediaStreamTrackGenerator({ kind: 'video' });
    let rect = null;
    let rectFor = '';
    processor.readable.pipeThrough(new TransformStream({
      transform(frame, out) {
        try {
          const v = frame.visibleRect;
          const key = `${v.x},${v.y},${v.width},${v.height}`;
          if (key !== rectFor) {
            rectFor = key;
            rect = cut(setup.crop, v);
            size = { width: rect.width, height: rect.height };
          }
          out.enqueue(new VideoFrame(frame, { visibleRect: rect, displayWidth: rect.width, displayHeight: rect.height }));
        } catch { /* a frame that cannot be cut is left out */ }
        frame.close();
      },
    })).pipeTo(generator.writable).catch(() => {});

    const sounds = [...stream.getAudioTracks()];
    let micMissing = false;
    if (setup.mic) {
      const mic = await getMicrophone();
      if (mic && mic.getAudioTracks().length) {
        others.push(...mic.getTracks());
        sounds.push(...mic.getAudioTracks());
      } else micMissing = true;
    }
    const sound = mix(sounds);

    mime = chooseMime(size.width, size.height, sound.length > 0);
    // About 0.08 bit a pixel at 30 frames a second (a full-HD area about 5 Mbit/s): screen text stays sharp.
    const videoBitsPerSecond = Math.round(Math.min(12e6, Math.max(2.5e6, size.width * size.height * setup.fps * 0.08)));
    mediaRecorder = new MediaRecorder(new MediaStream([generator, ...sound]), { mimeType: mime, videoBitsPerSecond, audioBitsPerSecond: 128000 });
    mediaRecorder.ondataavailable = (e) => {
      if (!e.data || !e.data.size) return;
      const blob = e.data;
      sending = sending.then(async () => api.chunk(new Uint8Array(await blob.arrayBuffer())));
    };
    mediaRecorder.onerror = (e) => api.failed((e && e.error && e.error.message) || 'The video could not be encoded.');
    // Timed from when the recorder really starts and resumes, as the video's own length is.
    mediaRecorder.onstart = () => { runningSince = performance.now(); };
    mediaRecorder.onresume = () => { runningSince = performance.now(); };
    // The last piece is sent before the end is.
    mediaRecorder.onstop = () => {
      sending.then(() => {
        api.done({ duration: activeMs / 1000, width: size.width, height: size.height, mime });
        stopAll();
      });
    };
    api.ready({
      sound: {
        system: stream.getAudioTracks().length > 0,
        mic: !!setup.mic && !micMissing,
        systemMissing: screen.systemMissing,
        micMissing,
      },
      mime,
    });
  } catch (err) {
    stopAll();
    api.failed(`${err && err.name ? err.name + ': ' : ''}${(err && err.message) || err}`);
  }
});

api.onCommand((command) => {
  if (!mediaRecorder) return;
  const now = performance.now();
  if (command === 'start' && mediaRecorder.state === 'inactive' && !stopping) {
    mediaRecorder.start(1000);
  } else if (command === 'pause' && mediaRecorder.state === 'recording') {
    mediaRecorder.pause();
    if (runningSince) activeMs += now - runningSince;
    runningSince = 0;
  } else if (command === 'resume' && mediaRecorder.state === 'paused') {
    mediaRecorder.resume();
  } else if (command === 'stop') {
    if (runningSince) { activeMs += now - runningSince; runningSince = 0; }
    if (mediaRecorder.state !== 'inactive') { stopping = true; mediaRecorder.stop(); }
    else { api.done({ duration: 0, width: size.width, height: size.height, mime }); stopAll(); }
  }
});
