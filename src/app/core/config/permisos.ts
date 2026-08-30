import { RolClave } from '../models/models';

/** Sin `roles`, el módulo es visible/accesible para cualquier usuario con sesión iniciada. */
export interface NavItem { ruta: string; icono: string; titulo: string; roles?: RolClave[]; }
export interface NavGrupo { titulo: string; items: NavItem[]; }

/**
 * Fuente única de verdad de los permisos por módulo: el menú lateral (shell.component.ts) y
 * el guard de rutas (role.guard.ts) leen esta misma estructura, así nunca quedan desalineados
 * el módulo que se oculta en el menú y el módulo que se bloquea por URL directa.
 *
 * Encargados: catálogos globales dentro de los módulos que les corresponden (Hardware, solo
 * su área). Técnicos: nunca catálogos globales, solo lo que tienen asignado o donde
 * participaron. Administración: exclusiva del rol Administrador.
 *
 * Agrupación en 4 etapas del proceso (en vez de una taxonomía técnica): así el menú narra la
 * misma historia que el flujo aprobado, de la disponibilidad de solicitudes/equipos al cierre
 * de auditoría. El «Reporte final» ya no es una entrada de menú aparte: su resumen y el botón
 * «Generar reporte final» viven dentro de Expediente único (ver expediente-unico.component.ts).
 */
export const NAVEGACION: NavGrupo[] = [
  {
    titulo: 'Entrada y disponibilidad',
    items: [
      { ruta: '/dashboard', icono: 'panel', titulo: 'Panel ejecutivo' },
      // Guía del proceso: apoyo para la demostración del flujo completo; cada rol ve solo sus accesos.
      { ruta: '/guia-proceso', icono: 'map', titulo: 'Guía del proceso' },
      { ruta: '/solicitudes', icono: 'inbox', titulo: 'Solicitudes', roles: ['enc-soporte', 'enc-hardware', 'admin'] },
      { ruta: '/inventario-hardware', icono: 'box', titulo: 'Inventario de Hardware', roles: ['enc-soporte', 'enc-hardware', 'admin'] },
      // Catálogo de software: mismos permisos que Inventario de Hardware (catálogo global administrado por Encargados/Administrador).
      { ruta: '/catalogo-software', icono: 'layers', titulo: 'Catálogo de software', roles: ['enc-soporte', 'enc-hardware', 'admin'] }
    ]
  },
  {
    titulo: 'Preparación técnica',
    items: [
      { ruta: '/expediente-tecnico', icono: 'folder', titulo: 'Expediente técnico' },
      { ruta: '/preparacion-tecnica', icono: 'tool', titulo: 'Preparación · F0288' },
      // Reprocesos F0288: el rollback de Hardware por fallas detectadas en F0302. Lo trabaja
      // Hardware; Soporte entra solo a consultar el reproceso de los procesos que reportó.
      { ruta: '/reprocesos-f0288', icono: 'undo', titulo: 'Reprocesos · F0288' }
    ]
  },
  {
    titulo: 'Asignación y configuración',
    items: [
      { ruta: '/asignacion', icono: 'assign', titulo: 'Asignación de equipo', roles: ['enc-soporte', 'enc-hardware', 'admin'] },
      // Expediente único: exclusivo de Soporte. Hardware (Encargado y Técnico) no lo gestiona ni lo visualiza.
      // Incluye el resumen y la generación del Reporte final de auditoría.
      { ruta: '/expediente-unico', icono: 'archive', titulo: 'Expediente único', roles: ['enc-soporte', 'tec-soporte', 'admin'] },
      { ruta: '/configuracion', icono: 'settings', titulo: 'Configuración · F0302', roles: ['enc-soporte', 'tec-soporte', 'admin'] }
    ]
  },
  {
    titulo: 'Cierre y auditoría',
    items: [
      { ruta: '/entrega-aceptacion', icono: 'truck', titulo: 'Entrega y aceptación', roles: ['enc-soporte', 'tec-soporte', 'admin'] },
      // Garantía: el Técnico de Hardware también entra, pero solo ve los casos de equipos que preparó (F0288)
      // y únicamente puede consultarlos y comentarlos; no abre ni cierra casos.
      { ruta: '/garantia', icono: 'shield', titulo: 'Servicio de garantía', roles: ['enc-soporte', 'tec-soporte', 'tec-hardware', 'admin'] },
      // Descargo: lo registra el Técnico de Soporte asignado (Encargado de Soporte solo supervisa/consulta);
      // cierra la asignación vigente del equipo y, si aplica, origina un reingreso a Hardware.
      { ruta: '/descargo', icono: 'undo', titulo: 'Descargo de equipo', roles: ['tec-soporte', 'enc-soporte', 'admin'] },
      // Inventario operativo de Controles: reflejo de los equipos que YA pertenecen a una
      // Dirección/Registro (solo entran con la aceptación del usuario final). Es de consulta:
      // ningún rol captura aquí, el dato llega de la aceptación y del descargo.
      { ruta: '/inventario-controles', icono: 'box', titulo: 'Inventario de Controles', roles: ['enc-soporte', 'tec-soporte', 'admin'] },
      // Generador de documentos: visible también para Hardware, con opciones limitadas a F0288.
      { ruta: '/generador-documentos', icono: 'file', titulo: 'Generador de documentos', roles: ['enc-soporte', 'enc-hardware', 'tec-soporte', 'tec-hardware', 'admin'] },
      { ruta: '/trazabilidad', icono: 'clock', titulo: 'Trazabilidad' }
    ]
  },
  {
    titulo: 'Sistema',
    items: [
      // Distribución de soportes: la gestionan Encargado de Soporte y Administrador (§6); el
      // Técnico de Soporte la consulta para saber qué Direcciones/Registros atiende.
      { ruta: '/distribucion-soportes', icono: 'users', titulo: 'Distribución de soportes', roles: ['enc-soporte', 'tec-soporte', 'admin'] },
      // Administración: únicamente el rol Administrador. Se oculta por completo para el resto (no se muestra deshabilitada).
      { ruta: '/administracion', icono: 'users', titulo: 'Administración', roles: ['admin'] }
    ]
  }
];

/** Roles permitidos para una ruta dada (por prefijo). `undefined` = cualquier usuario con sesión. */
export function rolesDeRuta(ruta: string): RolClave[] | undefined {
  for (const g of NAVEGACION) {
    const item = g.items.find((i) => ruta === i.ruta || ruta.startsWith(i.ruta + '/'));
    if (item) return item.roles;
  }
  return undefined;
}
