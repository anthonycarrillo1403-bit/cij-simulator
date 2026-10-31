# CIJ Trainer — Simulador Markem-Imaje S8 Classic / S8 Contrast / 9040

PWA instalable (React 19 + Tailwind 3 + Vite 8 + vite-plugin-pwa) que simula la interfaz
operador de impresoras de chorro de tinta continuo (CIJ), pensada para smartphone en horizontal.
Funciona sin conexión una vez instalada.

## Instalar en el teléfono

1. Abrir la URL publicada (HTTPS) en **Chrome (Android)** o **Safari (iPhone)**.
2. Android: botón **⤓ Instalar** de la barra superior o menú ⋮ › *Instalar aplicación*.
   iPhone: botón Compartir › *Añadir a pantalla de inicio*.
3. Se abre a pantalla completa y en horizontal. Si el teléfono está en vertical, la interfaz
   se gira sola 90°.

## Uso local

```bash
npm install
npm run dev        # desarrollo (accesible en la red local con --host)
npm test           # 37 pruebas: motor, códigos de barras y las 15 misiones
npm run build      # genera dist/ (PWA con service worker)
BASE=/cij-simulator/ npm run build   # para publicar en una subcarpeta (GitHub Pages)
```

## Estructura

```
src/
  engine/            Motor de simulación (sin React, probado con Vitest)
    sim.js           Marcha/paro, chorro, defectos, línea de producción, impresión
    jet.js           Modelo físico: punto de quiebra, fase, canal, THT, kit aire
    rtc.js           RTC con OFFSET, formatos de fecha, turnos
    render.js        Mensaje (campos) -> matriz de gotas WYSIWYG
    barcodes.js      Code 128 y DataMatrix ECC200 (verificados contra bwip-js)
    font5x7.js       Fuente matricial y escalado de fuentes
    faults.js        Catálogo de defectos y alarmas
    missions.js      15 misiones: escenario + pasos validados automáticamente
    defaults.js      Mensajes de ejemplo, E/S, modelos
  state/
    reducer.js       Acciones del operador -> eventos -> evaluación de misión
    store.jsx        Contexto, bucle de simulación 4 Hz, persistencia, bus de teclas
  components/        Chasis (teclas/LEDs), zonas de pantalla, teclados simulados,
                     DotMatrix, JetView, Conveyor, panel de misiones
  screens/           Producción, Edición, Preparación, Variables operador / V24
```

## Fuentes técnicas

Menús, parámetros y procedimientos tomados de los manuales locales: *S8 Contrast Instrucciones*
(árbol de menús, zonas de pantalla, parámetros de mensaje, turno, caducidad, kit aire),
*S8 Classic Printer Manual* (control de gotas `00111100`, diagnóstico de arranque),
*9040 Book for Service Engineers* (variables de operador, Code 128, tablas de defectos,
THT 3600-8100 V, presión 2,4-3,6 bar, fuga > 10 µA).

Simplificaciones: el modelo físico es didáctico (no reproduce valores exactos de fábrica);
los números de defecto son índices del simulador; la división tacométrica de referencia (1500)
y la distancia entre boquillas del bichorro (24 mm) son valores de la línea simulada.
