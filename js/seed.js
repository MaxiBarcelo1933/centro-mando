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
