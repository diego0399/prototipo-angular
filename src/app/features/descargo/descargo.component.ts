import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { AccionPosteriorDescargo, Equipo, MotivoDescargo } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, MarcaModeloPipe } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';
import { BuscarEquipoAsignadoModalComponent, FilaEquipoAsignado, filaEquipoAsignado } from '../../shared/buscar-expediente';
import { EvidenciasComponent } from '../../shared/evidencias';

const MOTIVOS: MotivoDescargo[] = [
  'Cambio de usuario', 'Cambio de equipo', 'Devolución', 'Reasignación', 'Falla', 'Garantía', 'Finalización de uso', 'Otro'
];
const ACCIONES: AccionPosteriorDescargo[] = [
  'Reingresar a Hardware', 'Enviar a nueva preparación', 'Dejar pendiente de revisión',
  'Marcar como no disponible', 'Preparar para reasignación', 'Enviar a garantía', 'Otro'
];

/**
 * Descargo: lo registra el Técnico de Soporte asignado al equipo (el Encargado de Soporte solo
 * supervisa/consulta). El equipo deja de estar asignado a un usuario final y vuelve al flujo
 * interno (Gestión de Equipos). Cierra la asignación vigente y todo el ciclo anterior
 * (Expediente técnico, F0288, Expediente único, F0302, Garantía) como histórico — ver
 * `DataService.registrarDescargo`.
 */
@Component({
  selector: 'app-descargo',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, MarcaModeloPipe, BuscarEquipoAsignadoModalComponent, IconComponent, EvidenciasComponent],
  styles: `
    .resumen-eq { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px 16px; }
    .resumen-eq .eq-nombre { font-size: 17px; font-weight: 700; color: var(--navy-900); }
    .resumen-eq .eq-datos { font-size: 12.5px; color: var(--tx-2); margin-top: 3px; }
    .valida-desc { display: grid; gap: 4px; margin: 14px 0 0; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Cierre y auditoría</div>
          <h1>
            Descargo de equipo
            <ui-help texto="Registra cuando un equipo deja de estar asignado a un usuario final y vuelve al flujo interno para revisión, preparación o reasignación. Cierra la asignación vigente sin borrar el historial." />
          </h1>
          <p class="page-sub">Cierre de la asignación vigente y, si aplica, reingreso a Hardware.</p>
        </div>
      </div>

      @if (!puedeRegistrar()) {
        <div class="alert warn mb-2">
          <span class="alert-ico">!</span>
          <span>
            <b>No tiene permisos para registrar descargos.</b> Esta acción corresponde al
            <b>Técnico de Soporte responsable de la Dirección/Unidad</b> donde el equipo está activo,
            al Encargado de Soporte o al Administrador.
            La pantalla se muestra en modo consulta.
          </span>
        </div>
      }

      <!-- El equipo pertenece a una Dirección/Unidad: el descargo lo saca de su inventario activo -->
      @if (equipoSel(); as inv) {
        @if (bloqueo(); as b) {
          <div class="alert warn mb-2">
            <span class="alert-ico">!</span>
            <span>
              <b>{{ b }}</b>
              @if (soporteResponsable()) {
                <div>Soporte responsable de este equipo: <b>{{ soporteResponsable().split('—')[0].trim() }}</b>.</div>
              }
            </span>
          </div>
        }
      }

      <div class="card mb-3">
        <div class="card-head">
          <div>
            <h2>Nuevo descargo</h2>
            <p class="sub">Busque un equipo con asignación vigente y registre el descargo</p>
          </div>
        </div>
        <div class="card-body">
          <div class="form-grid">
            <div class="field full">
              <label>
                Equipo asignado <span class="req">*</span>
                <ui-help texto="Solo se muestran equipos con una asignación vigente a un usuario final." />
              </label>
              @if (equipo(); as e) {
                <div class="resumen-eq">
                  <div class="row-between">
                    <div>
                      <div class="eq-nombre">{{ e | marcaModelo }}</div>
                      <div class="eq-datos">
                        {{ e.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }} · inventario {{ e.inventario }} · {{ e.condicion.toLowerCase() }}
                      </div>
                      <div class="eq-datos">Usuario final: <b>{{ usuarioFinal() }}</b></div>
                      @if (control(); as c) {
                        <div class="eq-datos">
                          Activo en <b>{{ c.direccion }} / {{ c.unidad }}</b> desde el {{ c.fechaAceptacion }}
                        </div>
                        <div class="eq-datos">
                          Soporte responsable:
                          <b>{{ c.soporteResponsable ? c.soporteResponsable.split('—')[0].trim() : 'sin asignar' }}</b>
                        </div>
                      }
                    </div>
                    <button class="btn btn-outline btn-sm" (click)="abrirBusqueda()" [disabled]="!puedeRegistrar()">Cambiar equipo</button>
                  </div>
                </div>
              } @else {
                <div class="row">
                  <button class="btn btn-outline" (click)="abrirBusqueda()" [disabled]="!puedeRegistrar()"><ui-icon name="search" [size]="14" /> Buscar equipo asignado</button>
                  <span class="hint">Solo aparecen equipos con asignación vigente.</span>
                </div>
              }
            </div>

            <div class="field">
              <label>Usuario final que entrega el equipo</label>
              <input class="control" readonly [value]="usuarioFinal() || '—'" />
            </div>

            <div class="field">
              <label>Encargado destino</label>
              <input class="control" readonly [value]="encargadoDestino() || '—'" />
              <span class="hint">Se calcula automáticamente: CPU/Desktop → Encargado de Hardware, Laptop → Encargado de Soporte.</span>
            </div>

            <div class="field">
              <label>Motivo del descargo <span class="req">*</span></label>
              <select class="control" [(ngModel)]="motivo" [disabled]="!puedeRegistrar()">
                @for (m of motivos; track m) { <option [value]="m">{{ m }}</option> }
              </select>
            </div>

            <div class="field">
              <label>Acción posterior <span class="req">*</span></label>
              <select class="control" [(ngModel)]="accionPosterior" [disabled]="!puedeRegistrar()">
                @for (a of acciones; track a) { <option [value]="a">{{ a }}</option> }
              </select>
              <span class="hint">
                «Reingresar a Hardware» y «Enviar a nueva preparación» registran automáticamente un nuevo ingreso a Hardware.
                El equipo quedará como <b>{{ estadoTras().gestion }}</b> en Gestión de Equipos y
                <b>{{ estadoTras().controles }}</b> en Controles.
              </span>
            </div>

            <div class="field">
              <label>Estado físico del equipo</label>
              <input class="control" [(ngModel)]="estadoFisico" placeholder="Buen estado, sin daños visibles…" [disabled]="!puedeRegistrar()" />
            </div>

            <div class="field">
              <label>Técnico de Soporte que registra</label>
              <input class="control" readonly [value]="responsableTxt()" />
            </div>

            <!-- El descargo administrativo no lo hace quien tenía el equipo a cargo: exige motivo -->
            @if (esAdministrativo()) {
              <div class="field full">
                <label>Motivo administrativo del descargo <span class="req">*</span></label>
                <textarea class="control" rows="2" [(ngModel)]="motivoAdministrativo"
                  placeholder="Por qué lo registra el Encargado de Soporte o el Administrador y no el soporte responsable…"
                  [disabled]="!puedeRegistrar()"></textarea>
                <span class="hint">Queda en la trazabilidad como acción realizada por {{ rolTxt() }}.</span>
              </div>
            }

            <div class="field full">
              <label>Observaciones</label>
              <textarea class="control" rows="2" placeholder="Motivo detallado, condiciones de la devolución…" [(ngModel)]="observaciones" [disabled]="!puedeRegistrar()"></textarea>
            </div>
          </div>

          <!-- Las cinco comprobaciones del inicio del descargo, con su estado -->
          @if (equipoSel()) {
            <div class="valida-desc">
              @for (v of validaciones(); track v.texto) {
                <p class="chk" [class.ok]="v.ok" [class.pend]="!v.ok">
                  <ui-icon [name]="v.ok ? 'check' : 'clock'" [size]="14" /> {{ v.texto }}
                </p>
              }
            </div>
          }

          <!-- Imagen del estado físico: sin ella el descargo no se registra -->
          @if (equipoSel(); as inv) {
            <ui-evidencias titulo="Imágenes del estado físico del equipo"
              [lista]="data.evid.de('Descargo', inv)"
              [editable]="puedeRegistrar()"
              [obligatoria]="true"
              [mensajeFalta]="data.evid.mensajeFalta('Descargo')"
              [contextos]="data.evid.contextosDe('Descargo')"
              [sugeridas]="sugeridasDescargo"
              (adjuntar)="adjuntarEvidencia(inv, $event)"
              (eliminar)="quitarEvidencia(inv, $event)"
              (visualizar)="verEvidencia(inv, $event)"
              (error)="toast.error('No se pudo adjuntar la imagen', $event)" />
          } @else {
            <p class="hint">Seleccione el equipo para adjuntar la imagen de su estado físico.</p>
          }
        </div>
        <div class="card-foot">
          <span class="small muted" style="margin-right: auto;">El descargo cierra la asignación vigente sin borrar el historial del equipo.</span>
          <button class="btn btn-primary btn-lg" (click)="registrar()" [disabled]="!puedeRegistrar() || !equipoSel() || !!bloqueo()">Registrar descargo</button>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h2>Descargos registrados</h2>
            <p class="sub">Historial de equipos descargados de su usuario final</p>
          </div>
        </div>
        <div class="card-body table-wrap">
          <table class="tbl">
            <thead>
              <tr><th>Fecha</th><th>Inventario</th><th>Usuario final entregó</th><th>Técnico de Soporte</th><th>Motivo</th><th>Acción posterior</th><th>Encargado destino</th></tr>
            </thead>
            <tbody>
              @for (d of descargos(); track d.idDescargo) {
                <tr>
                  <td class="mono">{{ d.fechaDescargo }}</td>
                  <td class="mono main-cell">{{ d.inventario }}</td>
                  <td>{{ d.usuarioFinalEntrega }}</td>
                  <td>{{ d.responsableRegistro.split('—')[0].trim() }}</td>
                  <td>{{ d.motivoDescargo }}</td>
                  <td>{{ d.accionPosterior }}</td>
                  <td><ui-badge [estado]="d.encargadoDestino" /></td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="muted" style="text-align:center; padding: 22px;">Aún no hay descargos registrados.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      @if (buscarAbierto()) {
        <app-buscar-equipo-asignado
          [filas]="opciones()"
          (seleccionar)="seleccionarEquipo($event)"
          (cerrar)="buscarAbierto.set(false)" />
      }
    </div>
  `
})
export class DescargoComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  protected readonly toast = inject(ToastService);

  protected readonly motivos = MOTIVOS;
  protected readonly acciones = ACCIONES;

  protected equipoSel = signal('');
  protected motivo = signal<MotivoDescargo>('Cambio de usuario');
  protected accionPosterior = signal<AccionPosteriorDescargo>('Reingresar a Hardware');
  protected estadoFisico = signal('');
  protected observaciones = signal('');
  protected motivoAdministrativo = signal('');

  protected buscarAbierto = signal(false);

  protected readonly rol = computed(() => this.auth.usuario()?.clave ?? '');
  /**
   * Registran descargos el Técnico de Soporte responsable de la Dirección/Unidad, el Encargado de
   * Soporte y el Administrador (§19). El Encargado de Soporte ya no solo supervisa: puede
   * descargar, pero con motivo administrativo obligatorio.
   */
  protected readonly puedeRegistrar = computed(() =>
    this.rol() === 'tec-soporte' || this.rol() === 'enc-soporte' || this.auth.esAdmin());
  /** El descargo lo registra alguien distinto del soporte responsable: exige motivo. */
  protected readonly esAdministrativo = computed(() => this.rol() === 'enc-soporte' || this.auth.esAdmin());
  protected readonly rolTxt = computed(() => this.auth.usuario()?.rol ?? '');
  protected readonly responsableTxt = computed(() => {
    const u = this.auth.usuario();
    return u ? `${u.nombre} — ${u.rol}` : '—';
  });

  /** Ficha del equipo en Controles: dice a qué Dirección/Unidad pertenece y quién le da soporte. */
  protected readonly control = computed(() =>
    this.equipoSel() ? this.data.controlActivoDe(this.equipoSel()) : undefined);
  protected readonly soporteResponsable = computed(() =>
    this.equipoSel() ? this.data.soporteResponsableDeEquipo(this.equipoSel()) : '');
  /** Motivo por el que este usuario no puede descargar este equipo; '' si puede. */
  protected readonly bloqueo = computed(() =>
    this.equipoSel() ? this.data.bloqueoDescargo(this.equipoSel()) : '');
  protected readonly validaciones = computed(() =>
    this.equipoSel() ? this.data.validacionesDescargo(this.equipoSel()) : []);
  /** Cómo quedará el equipo según la acción posterior elegida. */
  protected readonly estadoTras = computed(() => this.data.estadoTrasDescargo(this.accionPosterior()));

  protected readonly equipo = computed<Equipo | undefined>(() =>
    this.equipoSel() ? this.data.equipoDe(this.equipoSel()) : undefined
  );
  protected readonly usuarioFinal = computed(() =>
    this.equipoSel() ? this.data.asignacionDeEquipo(this.equipoSel())?.usuarioFinal ?? '' : ''
  );
  protected readonly encargadoDestino = computed(() => {
    const e = this.equipo();
    return e ? this.data.responsableOperativo(e) : '';
  });

  /**
   * Equipos con asignación vigente: candidatos a descargo. El Técnico de Soporte solo ve los de
   * las Direcciones/Unidades que atiende —que es exactamente lo que puede descargar—; Encargado de
   * Soporte y Administrador ven todos. Se conserva la participación en el proceso como alternativa
   * para los equipos que aún no tienen ficha en Controles ni Dirección/Unidad reconocible.
   */
  protected readonly opciones = computed<FilaEquipoAsignado[]>(() => {
    const lista = this.data.equipos()
      .map((e) => filaEquipoAsignado(this.data, e))
      .filter((f): f is FilaEquipoAsignado => !!f);
    if (this.rol() !== 'tec-soporte') return lista;
    const nombre = this.auth.usuario()?.nombre ?? '';
    return lista.filter((f) => {
      const asig = this.data.asignacionDeEquipo(f.inventario);
      if (!asig) return false;
      const { direccion, unidad } = this.data.dirUnidadDeSolicitud(asig.expediente);
      if (direccion && unidad) return this.data.atiendeDireccionUnidad(this.responsableTxt(), direccion, unidad);
      return this.data.participaEnProceso(asig.expediente, nombre);
    });
  });

  /** Descargos visibles para el rol conectado (el Técnico de Soporte solo ve los suyos). */
  protected readonly descargos = computed(() =>
    [...this.data.descargosVisibles()].sort((a, b) => b.fechaDescargo.localeCompare(a.fechaDescargo))
  );

  protected abrirBusqueda(): void {
    this.buscarAbierto.set(true);
  }

  protected seleccionarEquipo(inventario: string): void {
    this.equipoSel.set(inventario);
    this.buscarAbierto.set(false);
  }

  /** Qué imágenes se esperan al recibir el equipo de vuelta. */
  protected readonly sugeridasDescargo = [
    'Fotografía general del equipo recibido', 'Fotografía de los daños o faltantes, si los hay',
    'Fotografía de los accesorios devueltos'
  ];

  /** Expediente de la asignación vigente del equipo, al que se asocian sus imágenes. */
  private expedienteDe(inventario: string): string {
    return this.data.asignacionDeEquipo(inventario)?.expediente ?? inventario;
  }

  protected adjuntarEvidencia(inventario: string, ev: { archivo: string; tipo: string; imagen: string; item: string }): void {
    const error = this.data.adjuntarEvidencia({
      modulo: 'Descargo', proceso: inventario, expediente: this.expedienteDe(inventario),
      inventario, archivo: ev.archivo, tipo: ev.tipo, usuario: this.responsableTxt(),
      imagen: ev.imagen, item: ev.item
    });
    if (error) { this.toast.error('No se pudo adjuntar la imagen', error); return; }
    this.toast.ok('Imagen de evidencia adjuntada', `Queda como respaldo del estado físico de ${inventario}.`);
  }

  protected quitarEvidencia(inventario: string, archivo: string): void {
    const error = this.data.eliminarEvidencia('Descargo', inventario, this.expedienteDe(inventario),
      archivo, this.responsableTxt());
    if (error) { this.toast.error('No se pudo eliminar la imagen', error); return; }
    this.toast.ok('Imagen de evidencia eliminada', `${archivo} ya no respalda este descargo.`);
  }

  protected verEvidencia(inventario: string, archivo: string): void {
    this.data.registrarConsultaEvidenciaTecnica('Descargo', inventario, this.expedienteDe(inventario),
      archivo, this.responsableTxt());
  }

  protected registrar(): void {
    if (!this.puedeRegistrar()) {
      this.toast.error('Acción no permitida',
        'No tiene permisos para registrar descargos. Corresponde al Técnico de Soporte responsable de la Dirección/Unidad, al Encargado de Soporte o al Administrador.');
      return;
    }
    if (!this.equipoSel()) {
      this.toast.warn('Seleccione el equipo', 'Busque y seleccione un equipo con asignación vigente.');
      return;
    }
    const dirUnidad = this.control();
    const resultado = this.data.registrarDescargo({
      inventario: this.equipoSel(),
      motivoDescargo: this.motivo(),
      responsableRegistro: this.responsableTxt(),
      estadoFisico: this.estadoFisico().trim(),
      observaciones: this.observaciones().trim(),
      accionPosterior: this.accionPosterior(),
      motivoAdministrativo: this.motivoAdministrativo().trim()
    });
    if (typeof resultado === 'string') {
      this.toast.error('No se puede registrar el descargo', resultado);
      return;
    }
    this.toast.ok('Descargo registrado',
      dirUnidad
        ? `El equipo ${resultado.inventario} salió del inventario activo de ${dirUnidad.direccion} / ${dirUnidad.unidad} (${resultado.accionPosterior}).`
        : `El equipo ${resultado.inventario} quedó descargado (${resultado.accionPosterior}).`);
    this.equipoSel.set('');
    this.motivo.set('Cambio de usuario');
    this.accionPosterior.set('Reingresar a Hardware');
    this.estadoFisico.set('');
    this.observaciones.set('');
    this.motivoAdministrativo.set('');
  }
}
