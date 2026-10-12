import { MONTHS, addDays } from './dates.js';

/**
 * Datos de ejemplo para probar la app (Ajustes → Cargar datos de ejemplo).
 * Se guardan con `sample: true` para poder borrarlos después sin tocar lo tuyo.
 */
export function sampleData(today) {
  const month = MONTHS[Number(today.slice(5, 7)) - 1];
  return {
    tasks: [
      { title: 'Pegar la bajada en BASE (Reporte de Ventas)', area: 'ventas', time: '09:30' },
      { title: 'Llamar a 5 PDV en riesgo inactivo', area: 'pdv', time: '11:00' },
      { title: 'Pedir cotización del cartel 8×2 m', area: 'carteleria', time: '15:00' },
      { title: `Enviar base de ${month} a vendedores`, area: 'meta', time: '17:00' },
    ],
    followups: [
      { title: 'Cartel gomería · San José', area: 'carteleria', nextAction: 'Consultar a MTOP si aprueban la versión iluminada', dueDate: addDays(today, -3), owner: 'me' },
      { title: 'Orden E01-000055 sin cliente', area: 'ventas', nextAction: 'Pedir a sistemas que asigne el cliente', dueDate: today, owner: 'me' },
      { title: 'Relevamiento con código cruzado', area: 'relevamiento', nextAction: 'Revisar los códigos que no cruzan', dueDate: addDays(today, 2), owner: 'me' },
      { title: 'Permiso de cartel · Canelones', area: 'carteleria', nextAction: 'Esperar la firma del propietario', dueDate: addDays(today, 3), owner: 'other', waitingFor: 'propietario' },
      { title: 'Cotización de banners 70×110', area: 'carteleria', nextAction: 'Esperar el precio con instalación', dueDate: addDays(today, 4), owner: 'other', waitingFor: 'proveedor' },
    ],
  };
}

// Plantilla inicial de procesos: el cierre de mes real.
// Los ids de los pasos son fijos para que las marcas de cada mes sigan apuntando bien.

export const SEED_TEMPLATES = [
  {
    id: 'cierre-de-mes',
    name: 'Cierre de mes',
    frequency: 'monthly',
    periodOffset: -1, // en octubre se trabaja el cierre de septiembre
    groups: [
      {
        name: 'Reporte de Ventas',
        area: 'ventas',
        steps: [
          { id: 'rv-1', title: 'Pegar la bajada del sistema en BASE como valores', note: '' },
          { id: 'rv-2', title: 'Revisar que no se hayan movido columnas', note: 'Las hojas derivadas leen por nombre de columna (AxTable1).' },
          { id: 'rv-3', title: 'Actualizar las tablas dinámicas', note: '' },
        ],
      },
      {
        name: 'Meta Premiada',
        area: 'meta',
        steps: [
          { id: 'mp-1', title: 'Cerrar el mes en la hoja Seguimiento', note: '' },
          { id: 'mp-2', title: 'Guardar copia fija «BASE GENERAL {MES_CIERRE}»', note: '' },
          { id: 'mp-3', title: 'Mover el corte de +180 días un mes', note: 'Base de {MES_ACTUAL}: última compra {MES_CORTE} o antes.' },
          { id: 'mp-4', title: 'Enviar la base a los vendedores', note: 'Solo los 6 vendedores de campo.' },
        ],
      },
      {
        name: 'Avance de Relevamiento',
        area: 'relevamiento',
        steps: [
          { id: 'ar-1', title: 'Pegar la base descargada en BASE', note: 'Cruzar solo por código (viejo y E000xxxx), nunca por nombre.' },
          { id: 'ar-2', title: 'Revisar el % por vendedor en RESUMEN', note: '' },
        ],
      },
    ],
  },
];
