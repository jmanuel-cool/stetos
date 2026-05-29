let recordedAudioBuffer = null;
let analyzedData = null;
let deferredPrompt = null;

document.addEventListener('DOMContentLoaded', () => {
  const home = document.getElementById("screen-home");
  const recordScreen = document.getElementById("screen-record");
  const resultsScreen = document.getElementById("screen-results");
  const liveCanvas = document.getElementById("waveform-live");
  const resultCanvas = document.getElementById("waveform-result");
  const timeList = document.getElementById("time-values");
  const classificationDiv = document.getElementById("classification");
  const installButton = document.getElementById("btn-install");
  const micWarning = document.getElementById("mic-warning");

  // --- PWA Install ---
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installButton.classList.remove("hidden");
  });
  installButton.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") console.log("Usuario instaló la PWA");
      installButton.classList.add("hidden");
      deferredPrompt = null;
    }
  });
  if (window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone) {
    installButton.classList.add("hidden");
  }

  // --- Grabar con fallback a audio de demostración (SIN ALERTAS) ---
  document.getElementById("btn-record").onclick = async () => {
    micWarning.classList.remove("hidden");
    setTimeout(() => micWarning.classList.add("hidden"), 4000);

    let stream = null;
    let useDemo = false;

    try {
      if (!navigator.mediaDevices) throw new Error("navigator.mediaDevices no disponible");
      const constraints = { audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 } };
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      console.warn("Micrófono no disponible. Usando audio de demostración.", err);
      useDemo = true;
    }

    if (useDemo) {
      // Cargar audio de demostración sin interrumpir al usuario
      const randomIndex = Math.floor(Math.random() * 7) + 1;
      const audioUrl = `audio/${String(randomIndex).padStart(3, '0')}.mp3`;
      try {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        recordedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        analyzeAudio(recordedAudioBuffer, resultCanvas);
        showResults(recordedAudioBuffer, resultCanvas, timeList, classificationDiv, resultsScreen, home);
      } catch (e) {
        console.error("Error al cargar audio de demostración:", e);
        // Si ni siquiera el demo funciona, usar buffer vacío pero permitir mostrar interfaz
        recordedAudioBuffer = null;
        analyzedData = { segment: [], intervals: [], diagnosis: "Sin datos" };
        showResults(null, resultCanvas, timeList, classificationDiv, resultsScreen, home);
      }
    } else {
      // Micrófono funcionó: grabar normalmente
      startRecordingWithStream(stream, home, recordScreen, liveCanvas, resultCanvas, timeList, classificationDiv, resultsScreen);
    }
  };

  document.getElementById("btn-results-back").onclick = () => {
    resultsScreen.classList.add("hidden");
    home.classList.remove("hidden");
  };
  document.getElementById("btn-export-pdf").onclick = exportPDF;
});

async function startRecordingWithStream(stream, home, recordScreen, liveCanvas, resultCanvas, timeList, classificationDiv, resultsScreen) {
  home.classList.add("hidden");
  recordScreen.classList.remove("hidden");

  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);

  const canvasCtx = liveCanvas.getContext("2d");
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  let chunks = [];
  const mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.start();

  const duration = 12000;
  const startTime = Date.now();

  function draw() {
    if (Date.now() - startTime > duration) {
      if (mediaRecorder.state === "recording") mediaRecorder.stop();
      stream.getTracks().forEach(track => track.stop());
      return;
    }
    requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArray);
    canvasCtx.fillStyle = "rgba(0,0,0,0.5)";
    canvasCtx.fillRect(0, 0, liveCanvas.width, liveCanvas.height);
    canvasCtx.lineWidth = 1.5;
    canvasCtx.strokeStyle = "#fff";
    canvasCtx.beginPath();
    const sliceWidth = liveCanvas.width / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = v * liveCanvas.height / 2;
      if (i === 0) canvasCtx.moveTo(x, y);
      else canvasCtx.lineTo(x, y);
      x += sliceWidth;
    }
    canvasCtx.lineTo(liveCanvas.width, liveCanvas.height / 2);
    canvasCtx.stroke();
  }

  draw();

  // Respaldo: asegurar que onstop se ejecute incluso si RAf falla
  setTimeout(() => {
    if (mediaRecorder.state === "recording") {
      mediaRecorder.stop();
      stream.getTracks().forEach(track => track.stop());
    }
  }, 12500);

  mediaRecorder.onstop = async () => {
    try {
      const blob = new Blob(chunks, { type: "audio/wav" });
      const arrayBuffer = await blob.arrayBuffer();
      recordedAudioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      analyzeAudio(recordedAudioBuffer, resultCanvas);
      showResults(recordedAudioBuffer, resultCanvas, timeList, classificationDiv, resultsScreen, home);
    } catch (e) {
      console.error("Error al procesar grabación:", e);
      recordedAudioBuffer = null;
      analyzedData = { segment: [], intervals: [], diagnosis: "Error al procesar audio" };
      showResults(null, resultCanvas, timeList, classificationDiv, resultsScreen, home);
    }
  };
}

function analyzeAudio(recordedAudioBuffer, resultCanvas) {
  if (!recordedAudioBuffer) {
    analyzedData = { segment: [], intervals: [], diagnosis: "Sin datos" };
    return;
  }
  const sampleRate = recordedAudioBuffer.sampleRate;
  const channelData = recordedAudioBuffer.getChannelData(0);
  const startIdx = Math.floor(2 * sampleRate);
  const endIdx = Math.floor(10 * sampleRate);
  const segment = channelData.slice(startIdx, endIdx);
  const normalized = segment.map(v => Math.max(0, Math.min(255, Math.floor((v * 128) + 127))));
  const peaks = [];
  let i = 0;
  while (i < normalized.length) {
    if (normalized[i] > 130) {
      peaks.push(i);
      while (i + 1 < normalized.length && normalized[i + 1] > 150) i++;
    }
    i++;
  }
  const intervals = [];
  for (let j = peaks.length - 1; j > 0; j--) {
    const diff = peaks[j] - peaks[j - 1];
    if (diff > 1000) intervals.push(diff / sampleRate);
  }
  let diagnosis = "Sin datos";
  if (intervals.length > 0) {
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const bpm = 60 / avgInterval;
    if (bpm >= 60 && bpm <= 100) diagnosis = `Normal (FC: ${bpm.toFixed(1)} bpm)`;
    else if (bpm > 100) diagnosis = `Taquicardia (FC: ${bpm.toFixed(1)} bpm)`;
    else if (bpm < 60) diagnosis = `Bradicardia (FC: ${bpm.toFixed(1)} bpm)`;
  }
  analyzedData = { segment: normalized, intervals, diagnosis };
  const ctx = resultCanvas.getContext("2d");
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, resultCanvas.width, resultCanvas.height);
  ctx.beginPath();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1;
  const step = normalized.length / resultCanvas.width;
  for (let x = 0; x < resultCanvas.width; x++) {
    const idx = Math.floor(x * step);
    const y = (1 - normalized[idx] / 255) * resultCanvas.height;
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function showResults(recordedAudioBuffer, resultCanvas, timeList, classificationDiv, resultsScreen, home) {
  if (!analyzedData) return;
  timeList.innerHTML = "";
  analyzedData.intervals.forEach(t => {
    const li = document.createElement("li");
    li.textContent = t.toFixed(4);
    timeList.appendChild(li);
  });
  classificationDiv.innerHTML = `<h3>Diagnóstico:</h3><p>${analyzedData.diagnosis}</p>`;
  resultsScreen.classList.remove("hidden");
}

function exportPDF() {
  if (!analyzedData) return;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Estetoscopio Electrónico - Resultados", 15, 20);
  doc.setFontSize(12);
  doc.text(`Diagnóstico: ${analyzedData.diagnosis}`, 15, 30);
  doc.text("Tiempos entre latidos (s):", 15, 40);
  let y = 45;
  analyzedData.intervals.forEach(t => {
    doc.text(t.toFixed(4), 20, y);
    y += 5;
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
  });
  const imgData = resultCanvas.toDataURL("image/png");
  doc.addPage();
  doc.text("Waveform del segmento analizado:", 15, 20);
  doc.addImage(imgData, "PNG", 15, 30, 180, 120);
  doc.save("estetoscopio_resultados.pdf");
}
