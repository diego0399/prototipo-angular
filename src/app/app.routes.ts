import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { ShellComponent } from './core/layout/shell.component';

export const routes: Routes = [
  // Vistas sin layout interno: login y formulario EXTERNO de conformidad
  // (el usuario final no inicia sesión; responde desde el enlace de su correo institucional).
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent)
  },
  {
    path: 'formulario-conformidad/:token',
    loadComponent: () => import('./features/formulario-conformidad/conformidad.component').then((m) => m.ConformidadComponent)
  },
  // Pantallas internas de SISGOST (Soporte, Hardware, Administrador)
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent) },
      // Guía del proceso: modo demostración del flujo completo, con estados y accesos por rol.
      { path: 'guia-proceso', loadComponent: () => import('./features/guia-proceso/guia.component').then((m) => m.GuiaProcesoComponent) },
      // Pantalla de bloqueo por rol al intentar una URL directa a un módulo restringido.
      { path: 'acceso-restringido', loadComponent: () => import('./features/acceso-restringido/acceso-restringido.component').then((m) => m.AccesoRestringidoComponent) },
      { path: 'solicitudes', canActivate: [roleGuard], loadComponent: () => import('./features/solicitudes/solicitudes.component').then((m) => m.SolicitudesComponent) },
      { path: 'inventario-hardware', canActivate: [roleGuard], loadComponent: () => import('./features/inventario-hardware/inventario.component').then((m) => m.InventarioHardwareComponent) },
      { path: 'catalogo-software', canActivate: [roleGuard], loadComponent: () => import('./features/catalogo-software/catalogo-software.component').then((m) => m.CatalogoSoftwareComponent) },
      { path: 'asignacion', canActivate: [roleGuard], loadComponent: () => import('./features/asignacion/asignacion.component').then((m) => m.AsignacionComponent) },
      { path: 'expediente-tecnico', loadComponent: () => import('./features/expediente-tecnico/expediente-tecnico.component').then((m) => m.ExpedienteTecnicoComponent) },
      { path: 'expediente-unico', canActivate: [roleGuard], loadComponent: () => import('./features/expediente-unico/expediente-unico.component').then((m) => m.ExpedienteUnicoComponent) },
      { path: 'preparacion-tecnica', loadComponent: () => import('./features/preparacion-tecnica/preparacion.component').then((m) => m.PreparacionComponent) },
      { path: 'reprocesos-f0288', loadComponent: () => import('./features/reprocesos-f0288/reprocesos.component').then((m) => m.ReprocesosComponent) },
      { path: 'configuracion', canActivate: [roleGuard], loadComponent: () => import('./features/configuracion/configuracion.component').then((m) => m.ConfiguracionComponent) },
      { path: 'entrega-aceptacion', canActivate: [roleGuard], loadComponent: () => import('./features/entrega-aceptacion/entrega.component').then((m) => m.EntregaComponent) },
      { path: 'garantia', canActivate: [roleGuard], loadComponent: () => import('./features/garantia/garantia.component').then((m) => m.GarantiaComponent) },
      { path: 'descargo', canActivate: [roleGuard], loadComponent: () => import('./features/descargo/descargo.component').then((m) => m.DescargoComponent) },
      { path: 'generador-documentos', canActivate: [roleGuard], loadComponent: () => import('./features/generador-documentos/documentos.component').then((m) => m.DocumentosComponent) },
      // El Reporte final ya no es un módulo aparte: su resumen y generación viven en Expediente único.
      { path: 'reporte-final', redirectTo: 'expediente-unico' },
      { path: 'trazabilidad', loadComponent: () => import('./features/trazabilidad/trazabilidad.component').then((m) => m.TrazabilidadComponent) },
      { path: 'inventario-controles', canActivate: [roleGuard], loadComponent: () => import('./features/administracion/inventario-controles.component').then((m) => m.InventarioControlesComponent) },
      { path: 'distribucion-soportes', canActivate: [roleGuard], loadComponent: () => import('./features/administracion/distribucion-soportes.component').then((m) => m.DistribucionSoportesComponent) },
      { path: 'administracion', canActivate: [roleGuard], loadComponent: () => import('./features/administracion/admin.component').then((m) => m.AdminComponent) }
    ]
  },
  { path: '**', redirectTo: 'dashboard' }
];
