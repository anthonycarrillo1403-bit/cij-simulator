# CIJ Trainer — Simulador Markem-Imaje 9040 (monochorro y bichorro)

PWA instalable (React 19 + Tailwind 3 + Vite 8 + vite-plugin-pwa) para aprender a manejar las dos
codificadoras de chorro de tinta continuo de la planta, con su panel reproducido a escala:

| | Equipo A | Equipo B |
|---|---|---|
| Máquina | **Markem-Imaje 9040** (config. 9040 1.1) | **Markem-Imaje 9040** |
| Chorros | 1 (monochorro) | 2 (bichorro, 1 cabezal) |
| Panel | banda morada, ON/OFF naranja, F1–F8, cruceta, teclado blanco con leyendas moradas | idem |
| Pantalla | LCD gráfico 640 × 200 con menús (Producción, Edición, Preparación) | idem, con 2 zonas de chorro |

## Cómo se usa

- **Menú principal**: elegir equipo → *Entrenamiento guiado* → *Misiones de planta* → *Práctica libre*.
- **Entrenamiento guiado** (15 lecciones monochorro / 16 bichorro, con alineación de chorros): cada paso señala la tecla con un
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
npm test           # 81 pruebas: motor + «piloto automático» que completa las 31 lecciones y las
                   # 30 misiones pulsando sólo las teclas que indica el tutor
npm run build      # dist/ (PWA)
```

## Estructura

```
src/
  engine/            Motor (sin React): sim, chorro, RTC, render, códigos de barras (128, 39, 2/5,
                     DataMatrix), misiones, entrenamiento, escenarios
  machines/
    m9040/           firmware.js (menús, diálogos, estado), Screen9040.jsx (LCD 640×200), Panel.jsx, lessons.js
    guide.js         qué tecla señalar en cada paso
    registry.jsx     equipos disponibles
  ui/                Menú, listas, vista de máquina con zoom, tutor, tarjeta de misión, cajón Línea
  state/             reducer y store (persistencia local)
```

## Fuentes

Manuales locales: *Markem-Imaje 9040 Manual del Usuario* (A36952) y *9040 Book for Service
Engineers*. Geometría del panel medida en la foto del manual; textos de pantalla tal como aparecen en él. Simplificaciones: el modelo físico del chorro es didáctico; los ajustes
mecánicos (potenciómetro, levas/excéntricas, limpieza de placas) se hacen en el cajón «Línea»; las
funciones de técnico no incluidas muestran un aviso.
