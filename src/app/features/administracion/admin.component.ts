import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { UsuarioSistema } from '../../core/models/models';
import { RolSistema, etiquetaRoles, nombreRol } from '../../core/models/roles';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';

interface RolInfo { rol: string; unidad: string; permisos: string[]; }

@Component({
  selector: 'app-admin',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, ModalComponent],
  styles: `
    .rol-card { border: 1px solid var(--line); border-radius: var(--r-md); padding: 16px 18px; background: var(--surface); }
    .rol-card h3 { font-size: 14px; }
    .rol-card .r-unidad { font-size: 11.5px; color: var(--gold-600); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; }
    .rol-card ul { margin: 10px 0 0; padding-left: 18px; font-size: 12.5px; color: var(--tx-2); display: grid; gap: 4px; }
    .avatar-sm { width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; background: var(--navy-800); color: var(--gold-500); font-size: 11px; font-weight: 700; }
    .roles-chips { display: flex; flex-wrap: wrap; gap: 4px; }
    .rol-chip {
      display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600;
      background: var(--surface-2); border: 1px solid var(--line); color: var(--navy-800); white-space: nowrap;
    }
    .rol-chip.activo { background: var(--navy-800); border-color: var(--navy-800); color: #fff; }
    .rol-opciones { display: grid; gap: 10px; margin: 4px 0 2px; }
    .rol-op {
      display: grid; grid-template-columns: 20px 1fr; gap: 10px; align-items: start;
      border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; cursor: pointer;
    }
    .rol-op:hover { border-color: var(--line-strong); }
    .rol-op.puesto { border-color: var(--gold-500); background: #fdfaf2; }
    .rol-op input { margin-top: 3px; }
    .rol-op b { font-size: 13px; }
    .rol-op .d { font-size: 11.5px; color: var(--tx-2); line-height: 1.45; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Sistema</div>
          <h1>
            Administración
            <ui-help texto="Un usuario puede tener varios roles. Departamento, Dirección/Registro y Usuario Final no aparecen aquí: no son roles del sistema." />
          </h1>
          <p class="page-sub">Usuarios internos y roles operativos del sistema. <b>Un usuario puede tener uno o varios roles.</b></p>
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
          <thead>
            <tr>
              <th></th><th>Usuario</th><th>Nombre</th><th>Roles asignados</th><th>Unidad</th><th>Estado</th>
              @if (puedeEditar()) { <th style="text-align: right;">Acciones</th> }
            </tr>
          </thead>
          <tbody>
            @for (u of data.usuarios(); track u.usuario) {
              <tr>
                <td><span class="avatar-sm">{{ u.iniciales }}</span></td>
                <td class="mono">{{ u.usuario }}</td>
                <td class="main-cell">{{ u.nombre }}</td>
                <td>
                  <div class="roles-chips">
                    @for (r of u.roles; track r) {
                      <span class="rol-chip" [class.activo]="esActivo(u, r)">{{ nombreDe(r) }}</span>
                    }
                    @if (!u.roles.length) { <span class="badge danger">Sin rol</span> }
                  </div>
                </td>
                <td>{{ u.unidad }}</td>
                <td><ui-badge [estado]="u.estado" /></td>
                @if (puedeEditar()) {
                  <td style="text-align: right;">
                    <button class="btn btn-ghost btn-sm" type="button" (click)="abrir(u)">Editar roles</button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>

      @if (editando(); as u) {
        <ui-modal [titulo]="'Roles de ' + u.nombre"
          sub="Un usuario puede tener uno o varios roles. Marque los que le correspondan."
          (cerrar)="cerrar()">
          <div class="rol-opciones">
            @for (r of data.rolesDisponibles; track r.rol) {
              <label class="rol-op" [class.puesto]="marcados().includes(r.rol)">
                <input type="checkbox" [checked]="marcados().includes(r.rol)" (change)="alternar(r.rol)" />
                <span>
                  <b>{{ r.nombre }}</b>
                  <div class="d">{{ r.descripcion }}</div>
                </span>
              </label>
            }
          </div>

          <label class="lbl" for="obs-roles">Observación</label>
          <textarea id="obs-roles" class="control" rows="2" [(ngModel)]="observacion"
            placeholder="Por qué cambia la asignación de roles (queda en la trazabilidad)."></textarea>

          @if (error()) { <div class="alert warn" style="margin-top: 12px;"><span class="alert-ico">!</span><span>{{ error() }}</span></div> }

          <div class="alert" style="margin-top: 12px;">
            <span class="alert-ico">i</span>
            <span>
              Al guardar, los permisos se recalculan solos: no hay ningún botón de sincronizar.
              @if (marcados().length > 1) {
                {{ u.nombre }} podrá elegir su rol activo entre {{ etiqueta(marcados()) }}.
              }
            </span>
          </div>

          <div class="row" style="justify-content: space-between; margin-top: 16px;">
            <button class="btn btn-outline" type="button" (click)="alternarEstado(u)">
              {{ u.estado === 'Activo' ? 'Desactivar usuario' : 'Activar usuario' }}
            </button>
            <span class="row">
              <button class="btn btn-outline" type="button" (click)="cerrar()">Cancelar</button>
              <button class="btn btn-primary" type="button" (click)="guardar(u)">Guardar cambios</button>
            </span>
          </div>
        </ui-modal>
      }

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
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Usuario cuyos roles se están editando; null = ningún modal abierto. */
  protected readonly editando = signal<UsuarioSistema | null>(null);
  protected readonly marcados = signal<RolSistema[]>([]);
  protected observacion = '';
  protected readonly error = signal('');

  /** Solo el Administrador edita roles; los demás ven el directorio sin acciones. */
  protected readonly puedeEditar = computed(() => this.data.puedeAdministrarUsuarios());

  protected nombreDe(rol: RolSistema): string { return nombreRol(rol); }
  protected etiqueta(roles: RolSistema[]): string { return etiquetaRoles(roles); }

  /** Marca el rol activo del usuario conectado, para que se distinga de los demás que tiene. */
  protected esActivo(u: UsuarioSistema, rol: RolSistema): boolean {
    return u.usuario === this.auth.usuario()?.usuario && rol === this.auth.rolActivo();
  }

  protected abrir(u: UsuarioSistema): void {
    this.editando.set(u);
    this.marcados.set([...(u.roles ?? [])]);
    this.observacion = '';
    this.error.set('');
  }

  protected cerrar(): void { this.editando.set(null); this.error.set(''); }

  protected alternar(rol: RolSistema): void {
    this.marcados.update((l) => (l.includes(rol) ? l.filter((r) => r !== rol) : [...l, rol]));
    this.error.set('');
  }

  protected guardar(u: UsuarioSistema): void {
    const fallo = this.data.actualizarRoles(u.usuario, this.marcados(), this.observacion);
    if (fallo) { this.error.set(fallo); return; }
    const actualizado = this.data.usuarioPorId(u.usuario);
    // Si el Administrador se cambió los roles a sí mismo, la sesión adopta la ficha nueva en el
    // acto: nadie se queda operando con permisos que ya no tiene.
    if (actualizado) this.auth.refrescar(actualizado);
    this.toast.ok('Roles actualizados',
      `${u.nombre} queda con los roles: ${etiquetaRoles(this.marcados())}. Los permisos se recalcularon automáticamente.`);
    this.cerrar();
  }

  protected alternarEstado(u: UsuarioSistema): void {
    const nuevo = u.estado === 'Activo' ? 'Inactivo' : 'Activo';
    const fallo = this.data.cambiarEstadoUsuario(u.usuario, nuevo, this.observacion);
    if (fallo) { this.error.set(fallo); return; }
    this.toast.ok('Usuario actualizado', `${u.nombre} quedó ${nuevo.toLowerCase()}.`);
    this.cerrar();
  }

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
      rol: 'Coordinador', unidad: 'Soporte',
      permisos: [
        'Consulta y seguimiento; no opera ni administra',
        'No puede quedar como responsable de soporte de ningún Departamento ni Dirección/Registro'
      ]
    },
    {
      rol: 'Administrador del sistema', unidad: 'DTI',
      permisos: [
        'Gestiona usuarios internos y sus roles (el rol es un arreglo: puede agregar y quitar varios)',
        'Activa y desactiva usuarios',
        'Consulta la trazabilidad completa',
        'Supervisa documentos y reportes finales'
      ]
    }
  ]);
}
