import { Component, computed, input, signal } from '@angular/core';
import { EventoTrazabilidad } from '../core/models/models';
import { BadgeComponent } from './ui';
import { IconComponent } from './icon';

/** Etapa del proceso a la que pertenece cada módulo, para los filtros por etapa. */
const ETAPAS: Record<string, string> = {
  'Inventario de Hardware': 'Inventario',
  'Ingreso a Hardware': 'Inventario',
  'Solicitudes': 'Inventario',
  'Expediente técnico': 'Expediente técnico',
  'Preparación técnica F0288': 'F0288',
  'Asignación de equipo': 'Asignación',
  'Expediente único': 'Expediente único',
  'Configuración F0302': 'F0302',
  'Entrega y aceptación': 'Conformidad',
  'Servicio de garantía': 'Garantía',
  'Descargo': 'Descargo',
  'Reprocesos F0288': 'Reproceso',
  'Generador de documentos': 'Documentos',
  'Reporte final de auditoría': 'Documentos'
};

/**
 * Hitos del proceso: lo que la vista resumida muestra como evento propio. No basta con el campo
 * `hito` de cada evento —hay pasos clave guardados sin él, como la asignación del equipo o el
 * cierre del F0288— así que el título también se reconoce por lo que dice.
 */
const PRINCIPALES = [
  /ingresad[oa] al inventario/i, /expediente técnico .*cread/i, /preparación f0288 (iniciada|finalizada)/i,
  /documento f0288/i, /equipo preparado/i, /asignad[oa] al usuario final/i, /asignación modificada/i,
  /expediente único .*cread/i, /configuración f0302 (iniciada|finalizada)/i, /documento f0302/i,
  /formulario de conformidad (enviado|reenviado|aceptado)/i, /aceptó la recepción/i,
  // «de un mes iniciada» se conserva: son eventos ya registrados en la trazabilidad, y dejarlos
  // fuera de los hitos escondería parte de la historia del equipo por haber cambiado la regla.
  /garantía (habilitada|de un mes iniciada)/i, /descargo registrado/i, /reingreso a hardware/i,
  /reproceso f0288 (generado|finalizado|firmado)/i, /firma de técnico/i,
  // Un cierre bloqueado por falta de evidencia es parte de la historia: no se esconde en el detalle.
  /intentó finalizar sin evidencia/i, /intento de finalizar sin evidencia/i,
  /corrección f0302 (iniciada|finalizada|firmada)/i, /marcado como no conforme/i,
  // Garantía con revisión técnica: la decisión de mandar el equipo a Hardware y su desenlace.
  /garantía requiere revisión de hardware/i, /revisión técnica de garantía (generada|finalizada)/i,
  /garantía (validada por soporte|requiere sustitución)/i, /caso devuelto a soporte/i,
  // Pertenencia a Dirección/Unidad: cuándo el equipo pasó a ser de una y cuándo dejó de serlo.
  /asociado a /i, /retirado del inventario activo/i,
  // Vigencia de la garantía: de qué responde el equipo, desde cuándo, y cada vez que se movió.
  /garantía de proveedor (asignada|pendiente|vencida|calculada)/i, /responsabilidad interna de soporte asignada/i,
  /fecha de garantía modificada/i, /tipo de garantía modificado/i,
  /fecha de adquisición obtenida/i,
  // Un control de seguridad que se salta pertenece a la historia del equipo tanto como uno que se
  // aplica: el «No aplica» y su justificación no se esconden en el detalle.
  /marcado como no aplica/i, /ítem\(s\) no aplica justificados/i,
  /intento de finalizar f0302 sin justificación/i
];

/**
 * Eventos de apoyo: consultas, validaciones, autocompletados y selecciones. Nunca encabezan un
 * grupo; explican, dentro del detalle, cómo se llegó al hito.
 */
const APOYO = [
  /consult/i, /autocompletad/i, /catálogo/i, /modal/i, /mostrad/i, /bloquead/i, /duplicad/i,
  /seleccionad/i, /checklist/i, /descargad/i, /encontrado en/i, /registrada:/i, /marcada como/i
];

/** Un hito con los eventos técnicos que lo produjeron. */
interface Grupo {
  principal: EventoTrazabilidad;
  pasos: EventoTrazabilidad[];
}

/**
 * Línea de tiempo de la trazabilidad, con dos niveles de lectura. La **vista resumida** —la de
 * entrada— muestra un renglón por hito; las consultas, validaciones y autocompletados que llevaron
 * hasta él quedan **dentro de su detalle**, no como eventos sueltos. La **vista detallada** los
 * muestra todos, uno por uno, para auditoría.
 *
 * Nada se descarta: los dos niveles leen exactamente los mismos eventos, solo cambia cómo se
 * agrupan. Vive en `shared` porque la pantalla la usa en dos lugares —la vista por proceso y el
 * historial técnico del equipo— y una sola implementación evita que se separen con el tiempo.
 */
@Component({
  selector: 'ui-linea-tiempo',
  imports: [BadgeComponent, IconComponent],
  styles: `
    .cabecera { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .vistas { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 999px; overflow: hidden; }
    .vistas button {
      border: 0; background: transparent; cursor: pointer; padding: 6px 14px; font-size: 12.5px; color: var(--tx-2);
    }
    .vistas button.on { background: var(--navy-900); color: #fff; }
    .etapas { display: flex; gap: 7px; flex-wrap: wrap; }
    .etapa {
      border: 1px solid var(--line-strong); background: var(--surface); color: var(--tx-2);
      border-radius: 999px; padding: 4px 12px; font-size: 11.5px; cursor: pointer;
    }
    .etapa:hover { border-color: var(--blue-500); }
    .etapa.on { background: var(--navy-900); border-color: var(--navy-900); color: #fff; }

    .ev { border-bottom: 1px solid var(--line); padding: 11px 0; }
    .ev:last-child { border-bottom: 0; }
    .ev-when { font-size: 11.5px; color: var(--tx-3); font-variant-numeric: tabular-nums; }
    .ev-tit { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: var(--navy-900); margin-top: 2px; }
    .ev-tit.hito { font-weight: 700; }
    .ev-who { font-size: 12px; color: var(--tx-2); margin-top: 1px; }
    .ev-pie { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 6px; }
    .ev-mod { font-size: 11px; color: var(--tx-3); }
    .ev-mas { font-size: 11.5px; color: var(--tx-3); }

    .detalle { background: var(--surface-2); border-radius: var(--r-md); padding: 12px 14px; margin-top: 8px; }
    .detalle .dl-t { font-size: 10.5px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 5px; }
    .campos { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 5px 18px; }
    .campos span { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .campos b { font-size: 12.5px; font-weight: 500; color: var(--navy-900); }
    .pasos { list-style: none; padding: 0; margin: 8px 0 0; display: grid; gap: 4px; }
    .pasos li { font-size: 12px; color: var(--tx-2); display: flex; gap: 7px; align-items: baseline; }
    .pasos li .p-h { color: var(--tx-3); font-variant-numeric: tabular-nums; white-space: nowrap; }
  `,
  template: `
    <div class="cabecera">
      <div class="vistas">
        <button [class.on]="vista() === 'resumida'" (click)="vista.set('resumida')">Vista resumida</button>
        <button [class.on]="vista() === 'detallada'" (click)="vista.set('detallada')">Vista detallada</button>
      </div>
      <span class="ev-mas">
        @if (vista() === 'resumida') { {{ grupos().length }} hitos · {{ visibles().length }} eventos en total }
        @else { {{ visibles().length }} eventos de auditoría }
      </span>
    </div>

    @if (etapas().length > 1) {
      <div class="etapas mb-2">
        <button class="etapa" [class.on]="!etapa()" (click)="etapa.set('')">Todas las etapas</button>
        @for (et of etapas(); track et) {
          <button class="etapa" [class.on]="etapa() === et" (click)="etapa.set(et)">{{ et }}</button>
        }
      </div>
    }

    @if (vista() === 'resumida') {
      @for (g of grupos(); track $index) {
        <div class="ev">
          <div class="ev-when">{{ g.principal.fecha }} · {{ g.principal.hora }}
            @if (mostrarExpediente() && g.principal.expediente) { <span class="muted">· {{ g.principal.expediente }}</span> }
          </div>
          <div class="ev-tit hito">
            <ui-icon [name]="icono(g.principal)" [size]="14" /> {{ g.principal.accion }}
          </div>
          <div class="ev-who">{{ g.principal.usuario }}</div>
          <div class="ev-pie">
            @if (g.principal.modulo) { <span class="ev-mod">{{ g.principal.modulo }}</span> }
            <ui-badge [estado]="g.principal.estado" />
            <button class="btn btn-ghost btn-sm" (click)="alternar(clave(g.principal))">
              <ui-icon name="eye" [size]="13" /> {{ abierto() === clave(g.principal) ? 'Ocultar detalle' : 'Ver detalle' }}
            </button>
            @if (g.pasos.length) { <span class="ev-mas">{{ g.pasos.length }} paso(s) registrados</span> }
          </div>
          @if (abierto() === clave(g.principal)) {
            <div class="detalle">
              <div class="dl-t">Detalle del evento</div>
              <div class="campos">
                @for (c of campos(g.principal); track c.k) { <div><span>{{ c.k }}</span><b>{{ c.v }}</b></div> }
              </div>
              @if (g.principal.observacion) {
                <div class="campos" style="margin-top: 6px;"><div><span>Observaciones</span><b>{{ g.principal.observacion }}</b></div></div>
              }
              @if (g.pasos.length) {
                <div class="dl-t" style="margin-top: 10px;">Pasos registrados</div>
                <ul class="pasos">
                  @for (p of g.pasos; track $index) {
                    <li><span class="p-h">{{ p.hora }}</span> <span>{{ p.accion }}@if (p.observacion) { — {{ p.observacion }} }</span></li>
                  }
                </ul>
              }
            </div>
          }
        </div>
      } @empty {
        <p class="muted">No hay eventos registrados para esta consulta.</p>
      }
    } @else {
      @for (e of visibles(); track $index) {
        <div class="ev">
          <div class="ev-when">{{ e.fecha }} · {{ e.hora }}
            @if (mostrarExpediente() && e.expediente) { <span class="muted">· {{ e.expediente }}</span> }
          </div>
          <div class="ev-tit" [class.hito]="e.hito">
            <ui-icon [name]="icono(e)" [size]="14" /> {{ e.accion }}
          </div>
          <div class="ev-who">{{ e.usuario }}</div>
          <div class="ev-pie">
            @if (e.modulo) { <span class="ev-mod">{{ e.modulo }}</span> }
            <ui-badge [estado]="e.estado" />
            <button class="btn btn-ghost btn-sm" (click)="alternar(clave(e))">
              <ui-icon name="eye" [size]="13" /> {{ abierto() === clave(e) ? 'Ocultar detalle' : 'Ver detalle' }}
            </button>
          </div>
          @if (abierto() === clave(e)) {
            <div class="detalle">
              <div class="dl-t">Detalle del evento</div>
              <div class="campos">
                @for (c of campos(e); track c.k) { <div><span>{{ c.k }}</span><b>{{ c.v }}</b></div> }
              </div>
              @if (e.observacion) {
                <div class="campos" style="margin-top: 6px;"><div><span>Observaciones</span><b>{{ e.observacion }}</b></div></div>
              }
            </div>
          }
        </div>
      } @empty {
        <p class="muted">No hay eventos registrados para esta consulta.</p>
      }
    }
  `
})
export class LineaTiempoComponent {
  readonly eventos = input<EventoTrazabilidad[]>([]);
  /** 'desc' cuando la lista llega del más reciente al más antiguo (vista por proceso). */
  readonly orden = input<'asc' | 'desc'>('asc');
  readonly mostrarExpediente = input(false);

  protected vista = signal<'resumida' | 'detallada'>('resumida');
  protected etapa = signal('');
  protected abierto = signal('');

  /** Etapas presentes en estos eventos: no se ofrecen filtros que no filtrarían nada. */
  protected readonly etapas = computed(() =>
    [...new Set(this.eventos().map((e) => ETAPAS[e.modulo ?? ''] ?? '').filter(Boolean))]
  );

  protected readonly visibles = computed(() => {
    const et = this.etapa();
    return et ? this.eventos().filter((e) => ETAPAS[e.modulo ?? ''] === et) : this.eventos();
  });

  /**
   * Agrupa cada hito con los eventos técnicos que lo precedieron. Se recorre en orden cronológico
   * —da igual cómo llegue la lista— porque un hito resume lo que pasó **antes** de él: la consulta
   * al inventario y el autocompletado explican el ingreso, no al revés.
   *
   * Si al final quedan eventos sin hito posterior, el más reciente encabeza su propio grupo: son
   * actividad en curso y esconderlos sería perder lo último que ocurrió.
   */
  protected readonly grupos = computed<Grupo[]>(() => {
    const cronologico = this.orden() === 'desc' ? [...this.visibles()].reverse() : this.visibles();
    const grupos: Grupo[] = [];
    let buffer: EventoTrazabilidad[] = [];
    for (const e of cronologico) {
      if (this.esPrincipal(e)) { grupos.push({ principal: e, pasos: buffer }); buffer = []; }
      else buffer.push(e);
    }
    if (buffer.length) grupos.push({ principal: buffer[buffer.length - 1], pasos: buffer.slice(0, -1) });
    return this.orden() === 'desc' ? grupos.reverse() : grupos;
  });

  /**
   * ¿Este evento encabeza un grupo? Primero por lo que dice —hay hitos guardados sin la marca—,
   * después descartando los de apoyo, y solo al final por la marca `hito` del propio evento.
   */
  esPrincipal(e: EventoTrazabilidad): boolean {
    if (PRINCIPALES.some((r) => r.test(e.accion))) return true;
    if (APOYO.some((r) => r.test(e.accion))) return false;
    return !!e.hito;
  }

  protected clave(e: EventoTrazabilidad): string {
    return `${e.expediente}·${e.fecha}·${e.hora}·${e.accion}`;
  }
  protected alternar(clave: string): void {
    this.abierto.set(this.abierto() === clave ? '' : clave);
  }

  /** Rol de quien ejecutó la acción: del campo propio o de la parte «— Rol» del usuario. */
  private rol(e: EventoTrazabilidad): string {
    return e.rol || e.usuario.split('—')[1]?.trim() || '—';
  }

  /** Campos del detalle: los del pedido primero, y después los datos técnicos que traiga el evento. */
  protected campos(e: EventoTrazabilidad): { k: string; v: string }[] {
    const base: [string, string | number | undefined][] = [
      ['Fecha', e.fecha], ['Hora', e.hora], ['Usuario', e.usuario.split('—')[0].trim()],
      ['Rol', this.rol(e)], ['Módulo', e.modulo], ['Acción realizada', e.accion],
      ['Estado anterior', e.estadoAnterior], ['Estado nuevo', e.estado],
      ['Inventario', e.inventario], ['Expediente técnico', e.expedienteTecnico],
      ['Expediente único', e.expedienteUnico], ['Usuario final', e.usuarioFinal],
      ['Tiempo trabajado', e.tiempo], ['Complejidad', e.complejidad],
      ['Nombre del equipo', e.nombreEquipo], ['IP reservada', e.ipReservada], ['MAC', e.mac],
      ['Solicitud de reserva de IP', e.estadoSolicitudIP], ['Justificación', e.justificacion],
      ['Tipo de falla', e.tipoFalla], ['Requiere reproceso F0288', e.requiereReproceso],
      ['Tipo de problema', e.tipoProblema], ['Resolución', e.resolucion],
      ['Corrección', e.correccion], ['Intento de conformidad', e.intentoConformidad],
      ['Reproceso', e.reproceso], ['Origen del reproceso', e.origenReproceso],
      ['Caso de garantía', e.garantia],
      ['Dirección', e.direccion], ['Unidad', e.unidad],
      ['Soporte responsable', e.soporteResponsable],
      ['Técnico de configuración', e.tecnicoConfiguracion],
      ['Técnico de Soporte', e.tecnicoSoporte],
      ['Carga laboral', e.cargaLaboral], ['Procesos activos', e.procesosActivos],
      ['Desglose de la carga', e.detalleCarga],
      ['Estado en Controles', e.estadoControles],
      ['Descargo', e.descargo], ['Acción posterior', e.accionPosterior],
      ['Ítem del checklist', e.itemChecklist], ['Estado del ítem', e.estadoItem],
      ['Tipo de garantía', e.tipoGarantia], ['Fecha de adquisición', e.fechaAdquisicion],
      ['Fecha de aceptación', e.fechaAceptacion],
      ['Inicio anterior', e.inicioAnterior], ['Vencimiento anterior', e.vencimientoAnterior],
      ['Inicio nuevo', e.inicioNuevo], ['Vencimiento nuevo', e.vencimientoNuevo],
      ['Reportó (Soporte)', e.tecnicoReporta], ['Técnico de Hardware', e.tecnicoHardware],
      ['Encargado que asignó', e.encargadoAsigno], ['Resultado del reproceso', e.resultadoReproceso],
      ['Firma registrada', e.firmaRegistrada], ['Acción tomada', e.accionTomada],
      ['Equipo anterior', e.equipoAnterior], ['Equipo nuevo', e.equipoNuevo], ['Motivo', e.motivo],
      ['Evidencia', e.evidencia], ['Tipo de evidencia', e.tipoEvidencia],
      ['Estado de validación', e.estadoValidacion],
      ['Documento', e.documento], ['Estado del documento', e.estadoDocumento]
    ];
    return base.filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => ({ k, v: String(v) }));
  }

  /** Icono del módulo; el mismo criterio que usa el resto de la pantalla. */
  protected icono(e: EventoTrazabilidad): string {
    const iconos: Record<string, string> = {
      'Inventario de Hardware': 'box', 'Ingreso a Hardware': 'arrow-down', 'Descargo': 'arrow-up',
      'Expediente técnico': 'folder', 'Preparación técnica F0288': 'tool',
      'Asignación de equipo': 'user', 'Expediente único': 'archive', 'Configuración F0302': 'monitor',
      'Entrega y aceptación': 'handshake', 'Servicio de garantía': 'shield',
      'Reporte final de auditoría': 'file', 'Generador de documentos': 'download',
      'Reprocesos F0288': 'undo', 'Solicitudes': 'mail'
    };
    return iconos[e.modulo ?? ''] ?? 'circle';
  }
}
