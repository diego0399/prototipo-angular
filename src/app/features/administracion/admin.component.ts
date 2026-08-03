import { Component, computed, inject } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { BadgeComponent, HelpTipComponent } from '../../shared/ui';

interface RolInfo { rol: string; unidad: string; permisos: string[]; }

@Component({
  selector: 'app-admin',
  imports: [BadgeComponent, HelpTipComponent],
  styles: `
    .rol-card { border: 1px solid var(--line); border-radius: var(--r-md); padding: 16px 18px; background: var(--surface); }
    .rol-card h3 { font-size: 14px; }
    .rol-card .r-unidad { font-size: 11.5px; color: var(--gold-600); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .rol-card ul { margin: 10px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--tx-2); display: grid; gap: 4px; }
    .avatar-sm { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--navy-800); color: var(--gold-500); font-size: 11px; font-weight: 700; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Sistema</div>
          <h1>
            Administración
            <ui-help texto="Dirección y Usuario Final no aparecen aquí: no son roles del sistema. Dirección solo decide asignaciones (dato del proceso) y el usuario final responde el formulario externo de conformidad." />
          </h1>
          <p class="page-sub">Usuarios internos y roles operativos del sistema.</p>
        </div>
      </div>

      <div class="card table-wrap mb-3">
        <div class="card-head">
          <div>
            <h2>Usuarios del sistema</h2>
            <p class="sub">Solo personal técnico autorizado</p>
          </div>
        </div>
        <table class="tbl">
          <thead><tr><th></th><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Unidad</th><th>Estado</th></tr></thead>
          <tbody>
            @for (u of data.usuarios(); track u.usuario) {
              <tr>
                <td><span class="avatar-sm">{{ u.iniciales }}</span></td>
                <td class="mono">{{ u.usuario }}</td>
                <td class="main-cell">{{ u.nombre }}</td>
                <td>{{ u.rol }}</td>
                <td>{{ u.unidad }}</td>
                <td><ui-badge [estado]="u.estado" /></td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="mb-2 sec-title" style="max-width: 1340px;">Roles operativos y permisos</div>
      <div class="grid grid-3 mb-3">
        @for (r of roles(); track r.rol) {
          <div class="rol-card">
            <div class="r-unidad">{{ r.unidad }}</div>
            <h3>{{ r.rol }}</h3>
            <ul>
              @for (p of r.permisos; track p) { <li>{{ p }}</li> }
            </ul>
          </div>
        }
      </div>

      <div class="alert">
        <span class="alert-ico">i</span>
        <span>
          <b>Dirección</b> participa solo como fuente de decisión (p. ej., decide a quién se asignan las laptops) y
          <b>Usuario Final</b> solo como destinatario del equipo: responde el formulario externo de conformidad desde su correo
          institucional. Ninguno de los dos inicia sesión, firma dentro del sistema ni posee rol interno.
        </span>
      </div>

      <div class="card mt-3" style="max-width: 640px;">
        <div class="card-head">
          <div>
            <h2>Datos de demostración</h2>
            <p class="sub">Este prototipo guarda todos los cambios en el navegador (localStorage) para que no se pierdan al navegar o recargar.</p>
          </div>
        </div>
        <p class="small muted" style="margin: 0 0 12px;">
          Úselo solo si el estado de la demo quedó inconsistente y quiere volver al set de datos original.
        </p>
        <button class="btn btn-ghost btn-sm" (click)="restablecer()">Restablecer datos de demostración</button>
      </div>
    </div>
  `
})
export class AdminComponent {
  protected readonly data = inject(DataService);

  protected restablecer(): void {
    if (confirm('¿Restablecer todos los datos de la demo a su estado original? Se perderán los cambios guardados en este navegador.')) {
      this.data.reiniciarDatosDemo();
    }
  }

  protected readonly roles = computed<RolInfo[]>(() => [
    {
      rol: 'Encargado de Soporte', unidad: 'Soporte',
      permisos: [
        'Ve catálogos globales: solicitudes, equipos preparados, expedientes técnicos y únicos, garantías y reportes',
        'Consulta el recorrido completo del equipo en Trazabilidad (del ingreso al inventario hasta la garantía)',
        'Ingresa equipos al Inventario de Hardware',
        'Asigna CPUs nuevos, laptops nuevas y laptops usadas (Dirección decide, Soporte ejecuta)',
        'Puede crear el expediente técnico para la Unidad de Soporte, como excepción con justificación obligatoria (Hardware es la unidad por defecto)',
        'Selecciona el técnico de configuración',
        'Crea el expediente único y lo envía a configuración'
      ]
    },
    {
      rol: 'Técnico de Soporte', unidad: 'Soporte',
      permisos: [
        'Sin catálogos globales: solo ve sus F0302, sus entregas y los expedientes donde participa',
        'No ingresa equipos al inventario; ve el F0288 solo si participó en la preparación',
        'Completa el F0288 solo si el expediente se asignó excepcionalmente a la Unidad de Soporte',
        'Realiza la configuración y completa el F0302',
        'Ejecuta la entrega y envía el formulario de conformidad',
        'Atiende casos de garantía'
      ]
    },
    {
      rol: 'Encargado de Hardware', unidad: 'Hardware',
      permisos: [
        'Ve catálogos globales de su área: Inventario de Hardware, expedientes técnicos y F0288 de Hardware',
        'Consulta el recorrido completo del equipo en Trazabilidad, dentro de los procesos de Hardware',
        'Ingresa equipos al Inventario de Hardware',
        'Asigna CPUs usados',
        'Asigna CPUs nuevos solo con autorización y observación obligatoria',
        'Crea el expediente técnico cuando corresponde a Hardware',
        'No gestiona el Expediente único ni el Reporte final'
      ]
    },
    {
      rol: 'Técnico de Hardware', unidad: 'Hardware',
      permisos: [
        'Sin catálogos globales: solo ve sus preparaciones F0288 y los expedientes donde participó',
        'Ejecuta la preparación técnica',
        'Completa el F0288 de laptop usada, CPU nuevo y CPU usado',
        'Carga evidencias técnicas complementarias',
        'No visualiza F0302, Entrega, Expediente único ni Reporte final'
      ]
    },
    {
      rol: 'Administrador del sistema', unidad: 'DTI',
      permisos: [
        'Gestiona usuarios internos y roles',
        'Consulta la trazabilidad completa',
        'Supervisa documentos y reportes finales'
      ]
    }
  ]);
}
