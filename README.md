3. Haz clic en **"Instalar App"** (si aparece) para instalarla como PWA.
4. Usa los botones:
- **Grabar**: Inicia la grabación de 12 s.
- **Analizar**: Procesa el audio y detecta latidos.
- **Resultados**: Muestra tiempos y diagnóstico.
- **Exportar PDF**: Guarda un informe clínico básico.

---

## 🛠️ Cómo desplegar

1. Sube todos los archivos a un repositorio público en GitHub.
2. Activa **GitHub Pages** en `Settings → Pages` (rama `main`, carpeta raíz).
3. Accede a la URL generada y ¡listo!

> 📦 ¿Necesitas el ZIP listo? Ejecuta el script [`crear_stetos_pwa_zip.py`](#) (incluido en la documentación técnica).

---

## 📎 Tecnologías usadas

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Audio**: Web Audio API + MediaRecorder API
- **Procesamiento**: Algoritmo replicado 1:1 del código Python
- **ML ligero**: Clasificación basada en frecuencia cardíaca (sin modelo externo)
- **PDF**: jsPDF
- **Offline**: Service Worker + Cache API
- **Empaquetado**: Compatible con Capacitor (para APK nativa)

---

## ⚠️ Notas importantes

- **Solo funciona en navegadores que soportan PWA** (Chrome, Edge, etc.).
- **No compatible con iOS Safari** (limitaciones de PWA en iOS).
- **El micrófono debe estar conectado antes de abrir la app**.
- **No se almacenan ni envían datos**: todo permanece en el dispositivo.

---

## 📄 Licencia

Este proyecto es de uso educativo y clínico básico.  
**No incluye imágenes con copyright**: todos los recursos son generados o neutros.

---

**© 2025 – ETIR Pedro León Torres • 4to Electromedicina**
