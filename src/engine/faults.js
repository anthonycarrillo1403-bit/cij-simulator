// Catálogo de defectos y alarmas simulados (textos basados en las tablas de
// diagnóstico de los manuales S8 / 9040). El índice numérico es propio del simulador.
export const FAULTS = {
  EHT: {
    n: 2,
    severity: 'DEFECTO',
    title: 'THT / EHT: Alta tensión desarmada',
    detail: 'Fuga de corriente > 10 µA en las líneas de alta tensión. Placas de deflexión sucias o húmedas.',
    remedy: 'Parar chorro → Mantenimiento › Diagnóstico THT: limpiar placas con disolvente, secar con bomba de secado, test de aislamiento, anular defecto y arrancar chorro.',
  },
  RECUP: {
    n: 3,
    severity: 'DEFECTO',
    title: 'Defecto recuperación (canal)',
    detail: 'El chorro no entra correctamente en el canal de recuperación.',
    remedy: 'Estado/Cabezal › Estado chorros › AJUSTE: centrar el chorro con los tornillos de alineación y verificar la presión.',
  },
  PRESSURE: {
    n: 4,
    severity: 'DEFECTO',
    title: 'Presión incorrecta',
    detail: 'Presión de trabajo fuera de 2,4 – 3,6 bar.',
    remedy: 'Ajustar la consigna de presión. Esperar 15 s entre paro y arranque.',
  },
  COVER: {
    n: 1,
    severity: 'DEFECTO',
    title: 'Tapa cabezal ausente',
    detail: 'El detector de tapa no detecta la tapa del cabezal.',
    remedy: 'Cerrar la tapa del cabezal y anular el defecto.',
  },
  PHASE: {
    n: 5,
    severity: 'ALARMA',
    title: 'Chorro 1: Detección de fase',
    detail: 'El punto de quiebra no se sitúa en el electrodo de carga (fase incorrecta).',
    remedy: 'Preparación › Chorro: ajustar modulación / frecuencia piezo hasta 8-10 gotas y patrón 00111100.',
  },
  INK_LOW: {
    n: 6,
    severity: 'ALARMA',
    title: 'Nivel bajo de tinta',
    detail: 'Cartucho / depósito de tinta en reserva.',
    remedy: 'Rellenar tinta (Mantenimiento › Consumibles).',
  },
  SEDIMENT: {
    n: 7,
    severity: 'ALARMA',
    title: 'Tinta pigmentada: sedimentación',
    detail: 'Agitador detenido: el pigmento sedimenta en el depósito.',
    remedy: 'Preparación › Equipo: activar el agitador.',
  },
  AIR: {
    n: 8,
    severity: 'ALARMA',
    title: 'Sobrepresión cabezal insuficiente',
    detail: 'Ambiente con polvo y sin presión positiva de aire en el cabezal.',
    remedy: 'Preparación › Equipo: activar kit aire y regular a P.trabajo + 0,7 bar (-0,1/+0,3).',
  },
}

export const isBlocking = (code) => FAULTS[code]?.severity === 'DEFECTO'
