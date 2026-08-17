/**
 * Módulos del ecosistema SISGOST vistos desde Gestión de Equipos.
 *
 * Los dos prototipos son aplicaciones Angular independientes que comparten los datos base
 * (usuarios, Direcciones/Unidades, distribución de soportes y equipos). En desarrollo,
 * Gestión de Equipos corre en el 4200 y Controles Mensuales en el 4300 (`ng serve` de cada
 * proyecto), así que la navegación entre módulos es un enlace directo.
 *
 * `URL_CONTROLES_MENSUALES` es lo único que hay que cambiar para apuntar a otro despliegue.
 */
export const URL_CONTROLES_MENSUALES = 'http://localhost:4300/';
