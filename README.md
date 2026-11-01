# CIJ Trainer — Simulador Imaje S8 Classic / Markem-Imaje 9040

PWA instalable (React 19 + Tailwind 3 + Vite 8 + vite-plugin-pwa) para aprender a manejar dos
codificadoras de chorro de tinta continuo con sus paneles reproducidos a escala:

| | Equipo A | Equipo B |
|---|---|---|
| Máquina | **Imaje S8 Classic** | **Markem-Imaje 9040** |
| Chorros | 1 (chorro simple) | 2 (bichorro, 1 cabezal) |
| Pantalla | LCD de 1 línea × 40 caracteres | LCD gráfico 640 × 200 con menús |
| Teclado | membrana negra, teclas grises, ON/OFF, POWER/READY/FAULT/ALARM | banda morada, ON/OFF naranja, F1–F8, cruceta, teclado blanco con leyendas moradas |

## Cómo se usa

- **Menú principal**: elegir equipo → *Entrenamiento guiado* → *Misiones de planta* → *Práctica libre*.
- **Entrenamiento guiado** (15 lecciones S8 / 16 lecciones 9040): cada paso señala la tecla con un
  anillo amarillo, acerca la vista y dice qué escribir; avanza solo al hacerlo bien.
- **Misiones** (15 por equipo, mismo objetivo con los pasos de cada máquina): se desbloquean al
  terminar el entrenamiento. «💡 Pista» explica y señala la tecla siguiente.
- **Zoom**: pellizco, arrastre, doble toque y botones ⤢ Todo / 🖵 Pantalla / ⌨ Teclado. Con el
  teclado ampliado aparece una copia de la pantalla («espejo»).
- **▤ Línea**: producto marcado, cabezal con lupa, potenciómetro de quiebra, levas/excéntricas,
  limpieza y secado de placas, tinta, tapa y terminal V24.

## Desarrollo

```bash
npm install
npm run dev        # desarrollo
npm test           # 82 pruebas: motor + «piloto automático» que completa las 31 lecciones y las
                   # 30 misiones pulsando sólo las teclas que indica el tutor
npm run build      # dist/ (PWA)
```

## Estructura

```
src/
  engine/            Motor (sin React): sim, chorro, RTC, render, códigos de barras (128, 39, 2/5,
                     DataMatrix), misiones, entrenamiento, escenarios
  machines/
    s8classic/       firmware.js (funciones I1–I10, M9–M30, E1–E13), Panel.jsx, lessons.js
    m9040/           firmware.js (menús, diálogos, estado), Screen9040.jsx (LCD 640×200), Panel.jsx, lessons.js
    guide.js         qué tecla señalar en cada paso
    registry.jsx     equipos disponibles
  ui/                Menú, listas, vista de máquina con zoom, tutor, tarjeta de misión, cajón Línea
  state/             reducer y store (persistencia local)
```

## Fuentes

Manuales locales: *Imaje S8 Classic Printer Manual* (A20733), *Markem-Imaje 9040 Manual del Usuario*
(A36952), *9040 Book for Service Engineers*, *S8 Contrast Instrucciones*. Geometría de los paneles
medida en las figuras de los manuales; textos de pantalla tal como aparecen en ellos (el S8 Classic
en inglés, como en su manual). Simplificaciones: el modelo físico del chorro es didáctico; los ajustes
mecánicos (potenciómetro, levas/excéntricas, limpieza de placas) se hacen en el cajón «Línea»; las
funciones de técnico no incluidas muestran un aviso.
