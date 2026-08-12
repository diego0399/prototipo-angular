import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../core/services/auth.service';
import { DataService } from '../core/services/data.service';
import { CargaHardware, UsuarioSistema } from '../core/models/models';
import { BadgeComponent, ModalComponent } from './ui';

/**
 * Buscador dinámico de técnicos con aviso de carga laboral. El tooltip/popover al pasar el mouse
 * (o «Ver pendientes» en pantallas táctiles) da una vista rápida; «Ver detalle» abre un modal con
 * la ficha completa del técnico para una consulta más completa, sin ocupar espacio en la
 * pantalla principal mientras no se consulta.
 */
@Component({
  selector: 'app-tecnico-buscador',
  imports: [FormsModule, BadgeComponent, ModalComponent],
  styles: `
    .lista { border: 1px solid var(--line-strong); border-radius: 10px; max-height: 260px; overflow-y: auto; background: var(--surface); }
    .fila-tec {
      display: flex; align-items: center; gap: 10px; padding: 9px 12px; cursor: pointer;
      border-bottom: 1px solid var(--line); transition: background .1s;
    }
    .fila-tec:last-child { border-bottom: none; }
    .fila-tec:hover { background: var(--blue-050); }
    .fila-tec.on { background: var(--blue-050); box-shadow: inset 3px 0 0 var(--blue-600); }
    .fila-tec .nombre-tec { font-weight: 500; color: var(--navy-900); flex: 1; min-width: 0; }
    .popo-anchor { position: relative; display: inline-flex; align-items: center; gap: 6px; }
    .btn-pendientes, .btn-detalle {
      border: 1px solid var(--line-strong); background: var(--surface); color: var(--tx-2);
      font-size: 10.5px; border-radius: 999px; padding: 2px 8px; cursor: pointer;
    }
    .popover {
      display: none; position: absolute; z-index: 70; left: 0; top: calc(100% + 6px); width: 320px;
      background: var(--navy-900); color: var(--tx-inv); border-radius: 10px; padding: 12px 14px;
      box-shadow: var(--shadow-2); font-size: 12px; line-height: 1.5;
    }
    .popo-anchor:hover .popover, .popover.abierta { display: block; }
    .popover b { color: #fff; }
    .popover .pend-item { border-top: 1px solid rgba(255,255,255,.14); padding-top: 6px; margin-top: 6px; font-size: 11.5px; color: #d7e2f2; }
    .seleccionado-resumen { border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; background: var(--surface-2); margin-top: 8px; }
  `,
  template: `
    <div class="field">
      <label>Buscar técnico <span class="req">*</span></label>
      <input class="control" placeholder="Buscar por nombre, apellido, unidad, rol, carga laboral o disponibilidad…" [(ngModel)]="q" (focus)="abierta.set(true)" />
    </div>

    @if (abierta()) {
      <div class="lista mt-1">
        @for (t of resultados(); track t.usuario) {
          <div class="fila-tec" [class.on]="esSeleccionado(t)" (click)="elegir(t)">
            <span class="popo-anchor" (click)="$event.stopPropagation()">
              <span class="nombre-tec">{{ t.nombre }}</span>
              <button type="button" class="btn-pendientes" (click)="togglePopover(t.usuario); $event.stopPropagation()">Ver pendientes</button>
              <button type="button" class="btn-detalle" (click)="abrirDetalle(t); $event.stopPropagation()">Ver detalle</button>
              <div class="popover" [class.abierta]="popoverAbierto() === t.usuario">
                <b>{{ t.nombre }}</b><br />
                Unidad: {{ t.unidad }}<br />
                @if (carga(t); as c) {
                  Carga laboral: <b>{{ c.nivel }}</b> · {{ c.total }} procesos activos<br />
                  Expedientes técnicos activos: {{ c.expedientes }}<br />
                  Preparaciones F0288 sin finalizar: {{ c.preparaciones }}<br />
                  Reprocesos F0288 asignados: {{ c.reprocesos }}<br />
                  Revisiones técnicas de garantía: {{ c.revisionesGarantia }}<br />
                }
                Pendientes por preparar: {{ data.expedientesPendientesPorPreparar(t.nombre).length }}
                @for (p of data.expedientesPendientesPorPreparar(t.nombre); track p.codigo) {
                  <div class="pend-item">
                    <span class="mono">{{ p.codigo }}</span> · {{ p.inventario }} · {{ p.tipoEquipo === 'Desktop' ? 'CPU' : 'Laptop' }} · {{ p.estado }}
                  </div>
                } @empty {
                  <div class="pend-item">Sin expedientes pendientes por preparar.</div>
                }
              </div>
            </span>
            <ui-badge [estado]="'Carga ' + data.cargaLaboral(t.nombre)" />
          </div>
        } @empty {
          <div class="small muted" style="padding: 12px;">No hay técnicos que coincidan con la búsqueda.</div>
        }
      </div>
    }

    @if (seleccionado(); as t) {
      <div class="seleccionado-resumen">
        <div class="row-between">
          <span><b>Técnico seleccionado:</b> {{ t.nombre }} — {{ t.rol }}</span>
          <ui-badge [estado]="'Carga ' + data.cargaLaboral(t.nombre)" />
        </div>
        @if (carga(t); as c) {
          <div class="small muted mt-1">
            {{ c.total }} procesos activos · {{ data.resumenCargaHardware(c) }} ·
            Pendientes por preparar: {{ data.expedientesPendientesPorPreparar(t.nombre).length }}
          </div>
          @if (c.nivel === 'Alta') {
            <div class="alert warn mt-1">
              <span class="alert-ico">!</span>
              <span>{{ data.MSG_CARGA_ALTA }}</span>
            </div>
          } @else {
            <p class="small mt-1">{{ data.avisoCarga(c.nivel) }}</p>
          }
        }
      </div>
    }

    @if (detalle(); as t) {
      <ui-modal [titulo]="t.nombre" [sub]="t.rol + ' · ' + t.unidad" (cerrar)="detalle.set(null)">
        <dl class="dl">
          <dt>Nombre completo</dt><dd>{{ t.nombre }}</dd>
          <dt>Unidad</dt><dd>{{ t.unidad }}</dd>
          <dt>Rol</dt><dd>{{ t.rol }}</dd>
          <dt>Estado</dt><dd><ui-badge [estado]="t.estado" /></dd>
          @if (carga(t); as c) {
            <dt>Carga laboral</dt><dd><ui-badge [estado]="c.carga" /> · {{ c.total }} procesos activos</dd>
            <dt>Expedientes técnicos activos</dt><dd>{{ c.expedientes }}</dd>
            <dt>Preparaciones F0288 sin finalizar</dt><dd>{{ c.preparaciones }}</dd>
            <dt>Reprocesos F0288 asignados</dt><dd>{{ c.reprocesos }}</dd>
            <dt>Revisiones técnicas de garantía</dt><dd>{{ c.revisionesGarantia }}</dd>
            <dt>Disponibilidad</dt><dd>{{ c.disponibilidad }}</dd>
          }
          <dt>Pendientes por preparar</dt><dd>{{ data.expedientesPendientesPorPreparar(t.nombre).length }}</dd>
          <dt>Expedientes finalizados</dt><dd>{{ data.expedientesFinalizadosDeTecnico(t.nombre).length }}</dd>
          <dt>Última asignación</dt><dd>{{ data.ultimaAsignacionTecnico(t.nombre) || '—' }}</dd>
        </dl>

        @if (data.cargaLaboral(t.nombre) === 'Alta') {
          <div class="alert warn mt-2">
            <span class="alert-ico">!</span>
            <span>{{ data.MSG_CARGA_ALTA }}</span>
          </div>
        }

        <div class="sec-title mt-2">Expedientes pendientes por preparar</div>
        <div class="table-wrap">
          <table class="tbl tbl-compacta">
            <thead><tr><th>Código expediente</th><th>Inventario</th><th>Tipo de equipo</th><th>Estado</th><th>Fecha asignación</th><th>Prioridad</th></tr></thead>
            <tbody>
              @for (p of data.expedientesPendientesPorPreparar(t.nombre); track p.codigo) {
                <tr>
                  <td class="mono main-cell">{{ p.codigo }}</td>
                  <td class="mono">{{ p.inventario }}</td>
                  <td>{{ p.tipoEquipo === 'Desktop' ? 'CPU' : 'Laptop' }}</td>
                  <td><ui-badge [estado]="p.estado" /></td>
                  <td class="mono">{{ p.fecha }}</td>
                  <td>{{ p.prioridad || 'Normal' }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="muted" style="text-align:center; padding: 16px;">Sin expedientes pendientes por preparar.</td></tr>
              }
            </tbody>
          </table>
        </div>

        <div class="row mt-2" style="justify-content: flex-end;">
          <button class="btn btn-ghost" (click)="detalle.set(null)">Cerrar</button>
          <button class="btn btn-primary" (click)="elegir(t); detalle.set(null)">Seleccionar este técnico</button>
        </div>
      </ui-modal>
    }
  `
})
export class TecnicoBuscadorComponent {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);

  readonly unidad = input.required<'Soporte' | 'Hardware' | ''>();
  readonly nombreSeleccionado = input<string>('');
  readonly seleccion = output<UsuarioSistema>();

  protected q = signal('');
  protected abierta = signal(false);
  protected popoverAbierto = signal<string | null>(null);
  protected detalle = signal<UsuarioSistema | null>(null);

  protected readonly clave = computed<'tec-hardware' | 'tec-soporte' | null>(() =>
    this.unidad() === 'Hardware' ? 'tec-hardware' : this.unidad() === 'Soporte' ? 'tec-soporte' : null
  );

  protected readonly resultados = computed(() => {
    const clave = this.clave();
    const q = this.q().toLowerCase().trim();
    return this.data.usuarios().filter((u) => {
      if (clave && u.clave !== clave) return false;
      if (!q) return true;
      return `${u.nombre} ${u.unidad} ${u.rol} ${u.estado} ${this.data.cargaLaboral(u.nombre)}`.toLowerCase().includes(q);
    });
  });

  protected readonly seleccionado = computed(() =>
    this.data.usuarios().find((u) => `${u.nombre} — ${u.rol}` === this.nombreSeleccionado())
  );

  /**
   * Carga de Hardware del técnico. Se resuelve aquí y no en el servicio dentro de la plantilla
   * para no recalcularla una vez por cada dato del popover y del detalle.
   */
  protected carga(t: UsuarioSistema): CargaHardware {
    return this.data.cargaHardwareDe(t.nombre);
  }

  protected esSeleccionado(t: UsuarioSistema): boolean {
    return `${t.nombre} — ${t.rol}` === this.nombreSeleccionado();
  }

  protected togglePopover(usuario: string): void {
    this.popoverAbierto.set(this.popoverAbierto() === usuario ? null : usuario);
  }

  protected abrirDetalle(t: UsuarioSistema): void {
    const usuarioActual = this.auth.usuario();
    if (usuarioActual) this.data.registrarConsultaTecnico(t, usuarioActual);
    this.detalle.set(t);
  }

  protected elegir(t: UsuarioSistema): void {
    this.q.set(t.nombre);
    this.abierta.set(false);
    this.seleccion.emit(t);
  }
}
