import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import {
  AccesorioVerificado, ChecklistItem, Conformidad, ConfiguracionF0302, DocumentoGenerado, Equipo,
  EventoTrazabilidad, ExpedienteTecnico, ExpedienteUnico, Garantia, IngresoHardware, PreparacionF0288,
  SoftwareF0302, SoftwareHeredadoF0288
} from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';

/** Fila de la vista resumen: el eje principal de la trazabilidad es el equipo. */
interface FilaTraza {
  equipo: Equipo;
  tec?: ExpedienteTecnico;
  unico?: ExpedienteUnico;
  solicitudId: string;
  garantia?: Garantia;
  usuarioFinal: string;
  ultimo?: EventoTrazabilidad;
  fase: string;
  estado: string;
  texto: string;
}

/**
 * Trazabilidad con eje principal por equipo / número de inventario: el recorrido inicia
 * desde el ingreso al Inventario de Hardware (puede existir antes que cualquier solicitud).
 * Encargados y Administrador ven la vista resumen por equipo con buscador y filtros; la
 * vista por solicitud queda como consulta secundaria. Los técnicos solo ven los eventos
 * de sus procesos.
 */
@Component({
  selector: 'app-trazabilidad',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent],
  styles: `
    .tl-estado { margin-left: 10px; }
    .tl-ico { margin-right: 6px; }
    .tl-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 5px; }
    .m-chip {
      display: inline-flex; align-items: center; gap: 4px; font-size: 11px; color: var(--tx-2);
      border: 1px solid var(--line); background: var(--surface-2); border-radius: 999px; padding: 2px 9px;
    }
    .m-chip b { color: var(--navy-900); font-weight: 600; }
    .m-chip.cambio { color: var(--gold-600); border-color: var(--gold-500); background: transparent; }

    .tl-acciones {
      display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
      margin: 2px 0 16px; padding: 10px 12px; border: 1px solid var(--line);
      border-radius: var(--r-md); background: var(--surface-2);
    }
    .tl-acciones .d-k { margin-right: 2px; }

    .busqueda { display: grid; gap: 10px; margin-bottom: 14px; }
    .busq-main { display: flex; gap: 10px; align-items: center; }
    .busq-main input { flex: 1; font-size: 13.5px; padding: 11px 14px; }
    .filtros { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
    .filtros select { max-width: 210px; }
    .n-result { font-size: 12px; color: var(--tx-3); }

    .mini-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
    .mini-col h4 { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 6px; }
    .mini-item {
      display: block; width: 100%; text-align: left; border: 0; background: transparent; cursor: pointer;
      padding: 6px 4px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--tx-2);
    }
    .mini-item:hover { background: var(--surface-2); }
    .mini-item b { color: var(--navy-900); display: block; }
    .mini-item:last-child { border-bottom: 0; }

    .det-head { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 8px 18px; margin-bottom: 12px; }
    .det-head .d-k { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .det-head .d-v { font-size: 13px; color: var(--navy-900); margin-top: 1px; }

    .tabs { display: flex; gap: 4px; flex-wrap: wrap; border-bottom: 2px solid var(--line); margin-bottom: 14px; }
    .tab {
      border: 0; background: transparent; cursor: pointer; font-family: var(--font);
      font-size: 12.5px; font-weight: 600; color: var(--tx-2); padding: 8px 12px;
      border-bottom: 2px solid transparent; margin-bottom: -2px; white-space: nowrap;
    }
    .tab:hover { color: var(--blue-600); }
    .tab.on { color: var(--navy-900); border-bottom-color: var(--gold-500); }
    .res-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 8px 20px; }
    .res-grid .d-k { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .res-grid .d-v { font-size: 13.5px; color: var(--navy-900); margin: 2px 0 8px; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Auditoría</div>
          <h1>
            Trazabilidad
            <ui-help texto="El eje principal de la trazabilidad es el equipo (número de inventario): su recorrido inicia desde el ingreso al Inventario de Hardware, antes incluso de que exista una solicitud. También puede consultarse por solicitud, expediente técnico, expediente único, usuario final, técnico o garantía." />
          </h1>
          <p class="page-sub">Recorrido completo de cada equipo, desde el ingreso al inventario hasta la garantía.</p>
        </div>
      </div>

      @if (!auth.esTecnico()) {
        <!-- Buscador principal + filtros -->
        <div class="busqueda">
          <div class="busq-main">
            <input class="control" type="search"
              placeholder="Buscar por inventario, nombre del equipo, IP reservada, expediente, solicitud, usuario final, técnico o garantía…"
              [(ngModel)]="q" (ngModelChange)="mostrar.set(8)" />
          </div>
          <div class="filtros">
            <select class="control" [(ngModel)]="fAnio" (ngModelChange)="mostrar.set(8)">
              <option value="">Año: todos</option>
              @for (a of anios(); track a) { <option [value]="a">{{ a }}</option> }
            </select>
            <select class="control" [(ngModel)]="fTipo" (ngModelChange)="mostrar.set(8)">
              <option value="">Tipo de equipo: todos</option>
              <option value="Laptop">Laptop</option>
              <option value="Desktop">CPU / Desktop</option>
            </select>
            <select class="control" [(ngModel)]="fFase" (ngModelChange)="mostrar.set(8)">
              <option value="">Fase actual: todas</option>
              @for (f of fasesDisponibles(); track f) { <option [value]="f">{{ f }}</option> }
            </select>
            <select class="control" [(ngModel)]="fGarantia" (ngModelChange)="mostrar.set(8)">
              <option value="">Garantía: todas</option>
              <option value="con">Con garantía</option>
              <option value="sin">Sin garantía</option>
              <option value="caso">Con caso abierto</option>
            </select>
            @if (q() || fAnio() || fTipo() || fFase() || fGarantia()) {
              <button class="btn btn-ghost btn-sm" (click)="limpiarFiltros()">Limpiar filtros</button>
            }
            <span class="n-result" style="margin-left:auto;">
              Se encontraron {{ filtradas().length }} equipos con trazabilidad. Mostrando {{ visibles().length }}.
            </span>
          </div>
        </div>

        <!-- Vista resumen: eje por equipo -->
        <div class="card table-wrap mb-2">
          <table class="tbl">
            <thead>
              <tr>
                <th>Inventario</th>
                <th>Equipo</th>
                <th>Exp. técnico</th>
                <th>Exp. único</th>
                <th>Última fase</th>
                <th>Estado actual</th>
                <th>Último evento</th>
                <th style="text-align:right;">Acción</th>
              </tr>
            </thead>
            <tbody>
              @for (f of visibles(); track f.equipo.inventario) {
                <tr>
                  <td class="mono main-cell">{{ f.equipo.inventario }}</td>
                  <td>
                    <div class="main-cell">{{ f.equipo.marca }} {{ f.equipo.modelo }}</div>
                    <div class="sub-cell">{{ f.equipo.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }} · {{ f.equipo.condicion.toLowerCase() }}</div>
                  </td>
                  <td class="mono">{{ f.tec?.codigo || '—' }}</td>
                  <td class="mono">{{ f.unico?.codigoUnico || '—' }}</td>
                  <td>{{ f.fase }}</td>
                  <td><ui-badge [estado]="f.estado" /></td>
                  <td>
                    <div class="sub-cell" style="max-width: 260px;">{{ f.ultimo?.accion || 'Ingreso al Inventario de Hardware' }}</div>
                    <div class="sub-cell mono">{{ f.ultimo?.fecha || f.equipo.fechaIngreso || '—' }}</div>
                  </td>
                  <td>
                    <div class="row" style="justify-content: flex-end;">
                      <button class="btn btn-primary btn-sm" (click)="abrirTraza(f.equipo.inventario)">Ver historial</button>
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="muted" style="text-align:center; padding: 26px;">
                    Ningún equipo coincide con la búsqueda o los filtros aplicados.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (filtradas().length > visibles().length) {
          <div class="row mb-2" style="justify-content: center;">
            <button class="btn btn-outline" (click)="mostrar.set(mostrar() + 8)">Cargar más ({{ filtradas().length - visibles().length }} restantes)</button>
          </div>
        }

        <!-- Últimos registros: accesos rápidos -->
        <div class="card card-pad mb-2">
          <div class="mini-cols">
            <div class="mini-col">
              <h4>Últimos equipos ingresados</h4>
              @for (f of ultimosIngresados(); track f.equipo.inventario) {
                <button class="mini-item" (click)="abrirTraza(f.equipo.inventario)"><b class="mono">{{ f.equipo.inventario }}</b>{{ f.equipo.fechaIngreso }}</button>
              } @empty { <p class="muted small">Sin registros.</p> }
            </div>
            <div class="mini-col">
              <h4>Últimos expedientes técnicos</h4>
              @for (f of ultimosTec(); track f.equipo.inventario) {
                <button class="mini-item" (click)="abrirTraza(f.equipo.inventario)"><b class="mono">{{ f.tec?.codigo }}</b>{{ f.tec?.fecha }}</button>
              } @empty { <p class="muted small">Sin registros.</p> }
            </div>
            <div class="mini-col">
              <h4>Últimos equipos preparados</h4>
              @for (f of ultimosPreparados(); track f.equipo.inventario) {
                <button class="mini-item" (click)="abrirTraza(f.equipo.inventario)"><b class="mono">{{ f.equipo.inventario }}</b>{{ f.tec?.codigo }}</button>
              } @empty { <p class="muted small">Sin registros.</p> }
            </div>
            <div class="mini-col">
              <h4>Últimos expedientes únicos</h4>
              @for (f of ultimosUnicos(); track f.equipo.inventario) {
                <button class="mini-item" (click)="abrirTraza(f.equipo.inventario)"><b class="mono">{{ f.unico?.codigoUnico }}</b>{{ f.usuarioFinal || f.solicitudId }}</button>
              } @empty { <p class="muted small">Sin registros.</p> }
            </div>
            <div class="mini-col">
              <h4>Últimos casos de garantía</h4>
              @for (c of ultimosCasos(); track c.caso.codigo) {
                <button class="mini-item" (click)="abrirTraza(c.inventario)"><b class="mono">{{ c.caso.codigo }}</b>{{ c.caso.motivo }} · {{ c.caso.estado }}</button>
              } @empty { <p class="muted small">Sin casos registrados.</p> }
            </div>
          </div>
        </div>
      }

      <!-- Vista secundaria (Encargados) o vista principal de los técnicos: por solicitud -->
      <div class="card">
        <div class="card-head">
          <div>
            <h2>{{ auth.esTecnico() ? 'Trazabilidad de sus procesos' : 'Vista secundaria: por solicitud / requerimiento' }}</h2>
            <p class="sub">
              @if (auth.esTecnico()) { Solo se muestran eventos de procesos donde usted participó. }
              @else { La vista por solicitud es complementaria: el equipo puede tener historia previa a la solicitud. }
            </p>
          </div>
          <div class="field" style="min-width: 260px;">
            <select class="control" [(ngModel)]="seleccion">
              <option value="">{{ auth.esTecnico() ? 'Todos mis procesos' : 'Todas las solicitudes' }}</option>
              @for (s of conEventos(); track s) { <option [value]="s">{{ s }}</option> }
            </select>
          </div>
        </div>
        <div class="card-body">
          <div class="timeline">
            @for (e of eventos(); track $index) {
              <div class="tl-item" [class.hito]="e.hito">
                <div class="tl-when">{{ e.fecha }} · {{ e.hora }} <span class="muted">· {{ e.expediente }}</span></div>
                <div class="tl-what">
                  <span class="tl-ico">{{ icono(e) }}</span>{{ e.accion }}
                  <span class="tl-estado"><ui-badge [estado]="e.estado" /></span>
                </div>
                <div class="tl-who">{{ e.usuario }}</div>
                @if (e.observacion) { <div class="tl-note">{{ e.observacion }}</div> }
                @if (tieneDetalle(e)) {
                  <div class="tl-meta">
                    @if (e.modulo) { <span class="m-chip">Módulo: <b>{{ e.modulo }}</b></span> }
                    @if (e.estadoAnterior) { <span class="m-chip cambio">{{ e.estadoAnterior }} → <b>{{ e.estado }}</b></span> }
                    @if (e.tiempo) { <span class="m-chip">Tiempo: <b>{{ e.tiempo }}</b></span> }
                    @if (e.complejidad) { <span class="m-chip">Complejidad: <b>{{ e.complejidad }}</b></span> }
                    @if (e.inventario) { <span class="m-chip">Inventario: <b class="mono">{{ e.inventario }}</b></span> }
                    @if (e.nombreEquipo) { <span class="m-chip">Nombre del equipo: <b class="mono">{{ e.nombreEquipo }}</b></span> }
                    @if (e.ipReservada) { <span class="m-chip">IP reservada: <b class="mono">{{ e.ipReservada }}</b></span> }
                    @if (e.mac) { <span class="m-chip">MAC: <b class="mono">{{ e.mac }}</b></span> }
                    @if (e.estadoSolicitudIP) { <span class="m-chip">Solicitud de reserva de IP: <b>{{ e.estadoSolicitudIP }}</b></span> }
                    @if (e.justificacion) { <span class="m-chip">Justificación: <b>{{ e.justificacion }}</b></span> }
                    @if (e.expedienteTecnico) { <span class="m-chip">Exp. técnico: <b class="mono">{{ e.expedienteTecnico }}</b></span> }
                    @if (e.expedienteUnico) { <span class="m-chip">Exp. único: <b class="mono">{{ e.expedienteUnico }}</b></span> }
                    @if (e.usuarioFinal) { <span class="m-chip">Usuario final: <b>{{ e.usuarioFinal }}</b></span> }
                  </div>
                }
              </div>
            } @empty {
              <p class="muted">No hay eventos registrados para esta consulta.</p>
            }
          </div>
        </div>
      </div>

      <!-- Historial técnico del equipo (modal con pestañas) -->
      @if (detalle(); as d) {
        <ui-modal titulo="Historial técnico del equipo" [sub]="d.equipo.inventario + ' · ' + d.equipo.marca + ' ' + d.equipo.modelo" (cerrar)="detalle.set(null)">
          <div class="det-head">
            <div><div class="d-k">Inventario</div><div class="d-v mono">{{ d.equipo.inventario }}</div></div>
            <div><div class="d-k">Marca y modelo</div><div class="d-v">{{ d.equipo.marca }} {{ d.equipo.modelo }}</div></div>
            <div><div class="d-k">Exp. técnico</div><div class="d-v mono">{{ d.tec?.codigo || '—' }}</div></div>
            <div><div class="d-k">Exp. único</div><div class="d-v mono">{{ d.unico?.codigoUnico || '—' }}</div></div>
            <div><div class="d-k">Usuario final</div><div class="d-v">{{ d.usuarioFinal || '—' }}</div></div>
            <div><div class="d-k">Estado actual</div><div class="d-v"><ui-badge [estado]="d.estado" /></div></div>
          </div>

          @if (accionesDisponibles().length) {
            <div class="tl-acciones">
              <span class="d-k">Acciones disponibles</span>
              @for (a of accionesDisponibles(); track a.texto) {
                <a class="btn btn-primary btn-sm" [routerLink]="a.ruta" [queryParams]="a.params ?? null">{{ a.texto }}</a>
              }
            </div>
          }

          <div class="tabs">
            @for (t of pestanas; track t.id) {
              <button class="tab" [class.on]="tab() === t.id" (click)="tab.set(t.id)">{{ t.nombre }}</button>
            }
          </div>

          @switch (tab()) {
            <!-- ── Resumen ── -->
            @case ('resumen') {
              <div class="res-grid">
                <div>
                  <div class="d-k">Inventario</div><div class="d-v mono">{{ d.equipo.inventario }}</div>
                  <div class="d-k">Nombre actual del equipo</div><div class="d-v mono">{{ data.nombreEquipoActual(d.equipo.inventario) || '—' }}</div>
                  <div class="d-k">Reserva de IP</div><div class="d-v">{{ data.reservaIPEquipo(d.equipo.inventario).requiere || '—' }}</div>
                  <div class="d-k">IP reservada</div><div class="d-v mono">{{ data.textoIPReservada(ultimaConfEq()) }}</div>
                  <div class="d-k">MAC del equipo</div><div class="d-v mono">{{ macEquipo() || 'Sin registrar' }}</div>
                  <div class="d-k">Solicitud de reserva de IP</div><div class="d-v">{{ data.textoEstadoSolicitudIP(ultimaConfEq()) }}</div>
                  <div class="d-k">Equipo</div><div class="d-v">{{ d.equipo.marca }} {{ d.equipo.modelo }} · {{ d.equipo.tipo === 'Desktop' ? 'CPU / Desktop' : 'Laptop' }} {{ d.equipo.condicion.toLowerCase() }}</div>
                  <div class="d-k">Serie</div><div class="d-v mono">{{ d.equipo.serie || '—' }}</div>
                </div>
                <div>
                  <div class="d-k">Estado actual</div><div class="d-v"><ui-badge [estado]="d.estado" /></div>
                  <div class="d-k">Ubicación actual dentro del flujo</div><div class="d-v">{{ d.fase }}</div>
                  <div class="d-k">Usuario final actual</div><div class="d-v">{{ d.usuarioFinal || '—' }}</div>
                  <div class="d-k">Garantía</div>
                  <div class="d-v">@if (d.garantia; as g) { <ui-badge [estado]="g.estado" /> <span class="small muted">vence {{ g.fechaVencimiento }}</span> } @else { No aplica }</div>
                </div>
                <div>
                  <div class="d-k">Veces ingresado a Hardware</div><div class="d-v">{{ resumenEq()?.vecesIngresado ?? ingresosEq().length }}</div>
                  <div class="d-k">Veces preparado</div><div class="d-v">{{ vecesPreparado() }}</div>
                  <div class="d-k">Veces configurado</div><div class="d-v">{{ vecesConfigurado() }}</div>
                  <div class="d-k">Intentos F0302 <span class="small muted">(incluye con falla)</span></div><div class="d-v">{{ intentosF0302() }}</div>
                  <div class="d-k">Veces asignado</div><div class="d-v">{{ asignacionesEq().length }}</div>
                  <div class="d-k">Veces descargado</div><div class="d-v">{{ resumenEq()?.vecesDescargado ?? descargosEq().length }}</div>
                </div>
                <div>
                  <div class="d-k">Última preparación</div>
                  <div class="d-v">
                    @if (ultimaPrep(); as p) {
                      {{ p.firma.fecha || p.fecha }} · {{ p.tecnico.split('—')[0].trim() }}
                      @if (p.cronometro?.duracionMinutos !== null && p.cronometro) { <span class="small muted">· {{ data.formatoDuracion(p.cronometro.duracionMinutos) }} · {{ p.cierre?.nivel || '—' }}</span> }
                    } @else { — }
                  </div>
                  <div class="d-k">Última configuración</div>
                  <div class="d-v">
                    @if (ultimaConf(); as c) {
                      {{ c.fecha || 'En curso' }} · {{ c.tecnico.split('—')[0].trim() }}
                      @if (c.cronometro?.duracionMinutos !== null && c.cronometro) { <span class="small muted">· {{ data.formatoDuracion(c.cronometro.duracionMinutos) }} · {{ c.cierre?.nivel || '—' }}</span> }
                    } @else { — }
                  </div>
                  <div class="d-k">Última asignación</div>
                  <div class="d-v">@if (asignacionesEq()[0]; as a) { {{ a.fecha }} · {{ a.usuarioFinal }} } @else { — }</div>
                  <div class="d-k">Último descargo</div>
                  <div class="d-v">@if (descargosEq()[0]; as ds) { {{ ds.fechaDescargo }} · {{ ds.motivoDescargo }} } @else { — }</div>
                </div>
              </div>
            }

            <!-- ── Ingresos a Hardware ── -->
            @case ('ingresos') {
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr><th>N.º ingreso</th><th>Fecha ingreso</th><th>Motivo</th><th>Estado</th><th>Expediente técnico</th><th>F0288</th><th style="text-align:right;">Acción</th></tr>
                  </thead>
                  <tbody>
                    @for (i of ingresosEq(); track i.idIngresoHardware) {
                      <tr>
                        <td class="mono main-cell">{{ i.numeroIngreso }}</td>
                        <td>
                          <div class="main-cell mono">{{ i.fechaIngreso }}</div>
                          <div class="sub-cell mono">{{ i.horaIngreso }}</div>
                        </td>
                        <td>
                          {{ i.motivoIngreso }}
                          <div class="sub-cell">{{ i.ingresadoPor.split('—')[0].trim() }}</div>
                        </td>
                        <td><ui-badge [estado]="estadoIngreso(i)" /></td>
                        <td class="mono">{{ i.expedienteTecnicoAsociado || '—' }}</td>
                        <td>{{ f0288DeIngreso(i) }}</td>
                        <td style="text-align:right;">
                          @if (estadoIngreso(i) === 'Pendiente') {
                            <a class="btn btn-primary btn-sm" routerLink="/expediente-tecnico" [queryParams]="{ inventario: i.inventario }">Crear expediente</a>
                          } @else {
                            <button class="btn btn-ghost btn-sm" (click)="tab.set('f0288')">{{ estadoIngreso(i) === 'Histórico' ? 'Ver ciclo' : 'Ver progreso' }}</button>
                          }
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="7" class="muted" style="text-align:center; padding: 22px;">Este equipo aún no tiene ingresos a Hardware registrados en la bitácora.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <span class="hint">El primer ingreso (inicial) se registra al dar de alta el equipo en el Inventario de Hardware; los siguientes son reingresos, casi siempre originados por un Descargo.</span>
            }

            <!-- ── Preparaciones F0288 ── -->
            @case ('f0288') {
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr><th>Fecha</th><th>Exp. técnico</th><th>Técnico preparó</th><th>Motivo</th><th>Tiempo</th><th>Complejidad</th><th>F0288</th><th>Estado</th><th style="text-align:right;">Acción</th></tr>
                  </thead>
                  <tbody>
                    @for (p of preparacionesEq(); track p.expedienteTecnico) {
                      <tr>
                        <td>
                          <div class="main-cell mono">{{ p.cronometro?.fechaInicio || p.fecha }}</div>
                          @if (p.cronometro; as cr) { <div class="sub-cell mono">{{ cr.horaInicio.slice(0, 5) }}@if (cr.horaFin) { → {{ cr.fechaFin }} · {{ cr.horaFin.slice(0, 5) }} }</div> }
                        </td>
                        <td class="mono">{{ p.expedienteTecnico }}</td>
                        <td>
                          <div class="main-cell">{{ p.tecnico.split('—')[0].trim() }}</div>
                          <div class="sub-cell">{{ p.tecnico.split('—')[1] || '' }}</div>
                        </td>
                        <td><div class="sub-cell" style="max-width: 180px;">{{ p.datosGenerales.referencia }}</div></td>
                        <td class="mono">{{ p.cronometro ? (data.formatoDuracion(p.cronometro.duracionMinutos) || 'En curso') : '—' }}</td>
                        <td>
                          {{ p.cierre?.nivel || '—' }}
                          @if (p.cierre?.detalle) { <div class="sub-cell" style="max-width: 200px;">{{ p.cierre?.detalle }}</div> }
                          @else if (p.cierre?.observacion) { <div class="sub-cell" style="max-width: 200px;">{{ p.cierre?.observacion }}</div> }
                        </td>
                        <td>
                          @if (p.estado === 'Completada') { <span class="m-chip">Generado · firma {{ p.firma.estado === 'Firmado' ? 'capturada' : 'pendiente' }}</span> }
                          @else { <span class="muted small">Pendiente</span> }
                          @for (s of softwareInstalado(p); track s.nombre) {
                            <div class="sub-cell">{{ s.nombre }}@if (s.versionSeleccionada) { · versión {{ s.versionSeleccionada }} }</div>
                          }
                          @if (accesoriosResumen(p); as ar) { <div class="sub-cell">{{ ar }}</div> }
                          @for (a of accesoriosAsociados(p); track a.numeroInventario) {
                            <div class="sub-cell mono" style="max-width: 260px;">{{ a.nombre }} · {{ a.numeroInventario }} — {{ a.marca }} {{ a.modelo }} · {{ a.estadoFisico }}</div>
                          }
                        </td>
                        <td><ui-badge [estado]="p.estado" /></td>
                        <td style="text-align:right;"><button class="btn btn-ghost btn-sm" (click)="tab.set('traza')">Ver trazabilidad</button></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="9" class="muted" style="text-align:center; padding: 22px;">Este equipo aún no tiene preparaciones F0288 registradas.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <span class="hint">Cada preparación conserva su propio F0288: las preparaciones anteriores nunca se sobrescriben.</span>
            }

            <!-- ── Configuraciones F0302 ── -->
            @case ('f0302') {
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr><th>Fecha</th><th>Exp. único</th><th>Técnico configuró</th><th>Nombre del equipo</th><th>Reserva de IP</th><th>Usuario destino</th><th>Tiempo</th><th>Resultado</th><th>Falla</th><th>Complejidad</th><th>F0302</th><th>Estado</th></tr>
                  </thead>
                  <tbody>
                    @for (c of configuracionesEq(); track $index) {
                      <tr>
                        <td>
                          <div class="main-cell mono">{{ c.cronometro?.fechaInicio || c.fecha || '—' }}</div>
                          @if (c.cronometro; as cr) { <div class="sub-cell mono">{{ cr.horaInicio.slice(0, 5) }}@if (cr.horaFin) { → {{ cr.fechaFin }} · {{ cr.horaFin.slice(0, 5) }} }</div> }
                        </td>
                        <td class="mono">{{ data.expedienteUnicoDe(c.expediente)?.codigoUnico || c.expediente }}</td>
                        <td>
                          <div class="main-cell">{{ c.tecnico.split('—')[0].trim() }}</div>
                          <div class="sub-cell">{{ c.tecnico.split('—')[1] || '' }}</div>
                        </td>
                        <td class="mono">{{ c.datos.nombrePC }}</td>
                        <td>
                          {{ c.datos.requiereReservaIP || '—' }}
                          <div class="sub-cell mono">{{ data.textoIPReservada(c) }}</div>
                          @if (c.datos.requiereReservaIP === 'Sí') {
                            <div class="sub-cell mono">MAC: {{ c.datos.macEquipo || 'Sin registrar' }}</div>
                            <div class="sub-cell">Solicitud: {{ data.textoEstadoSolicitudIP(c) }}</div>
                          } @else if (c.datos.requiereReservaIP === 'No') {
                            <div class="sub-cell">{{ c.datos.justificacionSinReservaIP || 'Sin justificación registrada' }}</div>
                          }
                        </td>
                        <td>{{ c.datos.asignadoA }}</td>
                        <td class="mono">{{ c.cronometro ? (data.formatoDuracion(c.cronometro.duracionMinutos) || 'En curso') : '—' }}</td>
                        <td>{{ resultadoF0302(c) }}</td>
                        <td>
                          @if (c.falla; as f) {
                            {{ f.tipo }}
                            <div class="sub-cell" style="max-width: 200px;">Devuelto a F0288</div>
                          } @else { <span class="muted">—</span> }
                        </td>
                        <td>
                          {{ c.cierre?.nivel || '—' }}
                          @if (c.cierre?.detalle) { <div class="sub-cell" style="max-width: 200px;">{{ c.cierre?.detalle }}</div> }
                          @else if (c.cierre?.observacion) { <div class="sub-cell" style="max-width: 200px;">{{ c.cierre?.observacion }}</div> }
                        </td>
                        <td>
                          @if (c.estado === 'Completada') { <span class="m-chip">Generado · firma {{ c.firmas.configuro.estado === 'Firmado' ? 'capturada' : 'pendiente' }}</span> }
                          @else if (c.estado === 'Con falla') { <span class="m-chip cambio">Intento con falla</span> }
                          @else { <span class="muted small">Pendiente</span> }
                          @for (x of capturasF0302(c); track x.nombre) {
                            <div class="sub-cell" style="max-width: 260px;">
                              {{ x.nombre }}: {{ x.estado }}@if (x.archivo) { · {{ x.archivo }} · {{ x.cargadaPor }} · {{ x.fecha }} }
                            </div>
                          }
                          @for (s of softwareHeredado(c); track s.codigoSoftware) {
                            <div class="sub-cell" style="max-width: 260px;">Heredado F0288: {{ s.nombre }} · versión {{ s.version }}@if (s.evidencia) { · {{ s.evidencia }} }</div>
                          }
                          @for (s of softwareAgregado(c); track s.nombre) {
                            <div class="sub-cell" style="max-width: 260px;">
                              Agregado F0302: {{ s.nombre }} · {{ s.version }} · {{ s.motivo || 'sin motivo registrado' }}
                              @if (s.observacion) { · {{ s.observacion }} }
                              @if (s.agregadoPor) { · {{ s.agregadoPor }}@if (s.fechaAgregado) { · {{ s.fechaAgregado }} } }
                            </div>
                          }
                        </td>
                        <td><ui-badge [estado]="c.estado" /></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="12" class="muted" style="text-align:center; padding: 22px;">Este equipo aún no tiene configuraciones F0302 registradas.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <span class="hint">Cada configuración conserva su propio F0302 —incluidos los intentos «Con falla»—: las configuraciones anteriores nunca se sobrescriben.</span>
            }

            <!-- ── Asignaciones ── -->
            @case ('asig') {
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr><th>Fecha asignación</th><th>Usuario final</th><th>Responsable</th><th>Técnico configuró</th><th>Exp. único</th><th>Conformidad</th><th>Garantía</th></tr>
                  </thead>
                  <tbody>
                    @for (a of asignacionesEq(); track a.expediente) {
                      <tr>
                        <td class="mono">{{ a.fecha }}</td>
                        <td>
                          <div class="main-cell">{{ a.usuarioFinal }}</div>
                          @if (conformidadDe(a.expediente)?.firmaUsuarioFinal; as f) { <div class="sub-cell">Firma: {{ f }}</div> }
                        </td>
                        <td>{{ a.responsableAsignacion.split('—')[0].trim() }}</td>
                        <td>
                          {{ a.responsablesFase.tecnicoConfiguracion.split('—')[0].trim() }}
                          @if (data.direccionDe(a.responsablesFase.tecnicoConfiguracion); as dir) { <div class="sub-cell">Dirección: {{ dir }}</div> }
                        </td>
                        <td class="mono">{{ data.expedienteUnicoDe(a.expediente)?.codigoUnico || '—' }}</td>
                        <td>
                          @if (conformidadDe(a.expediente); as cf) { <ui-badge [estado]="cf.estado" /> }
                          @else { <span class="muted small">Pendiente</span> }
                        </td>
                        <td>
                          @if (data.garantiaDe(a.expediente); as g) { <ui-badge [estado]="g.estado" /> }
                          @else { <span class="muted small">—</span> }
                        </td>
                      </tr>
                    } @empty {
                      <tr><td colspan="7" class="muted" style="text-align:center; padding: 22px;">Este equipo aún no ha sido asignado a un usuario final.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <span class="hint">El historial conserva cada usuario final que tuvo asignado el equipo, con su Expediente único, conformidad y garantía.</span>
            }

            <!-- ── Garantía ── -->
            @case ('gar') {
              @for (g of garantiasEq(); track g.expediente) {
                <div class="det-head" style="grid-template-columns: 1fr;">
                  <div>
                    <div class="d-k">Garantía del expediente {{ data.expedienteUnicoDe(g.expediente)?.codigoUnico || g.expediente }}</div>
                    <div class="d-v">
                      <ui-badge [estado]="g.estado" />
                      <span class="small muted">{{ g.fechaInicio }} → {{ g.fechaVencimiento }} · {{ g.usuarioFinal }}</span>
                      @if (tecnicoHardwarePreparo(); as t) { <span class="m-chip" style="margin-left:6px;">Técnico de Hardware que preparó: <b>{{ t }}</b></span> }
                    </div>
                  </div>
                </div>
                <div class="table-wrap mb-2">
                  <table class="tbl">
                    <thead><tr><th>Código del caso</th><th>Apertura</th><th>Cierre</th><th>Estado</th><th>Responsable</th><th>Comentarios</th></tr></thead>
                    <tbody>
                      @for (c of g.casos; track c.codigo) {
                        <tr>
                          <td class="mono main-cell">{{ c.codigo }}</td>
                          <td class="mono">{{ c.fechaApertura }}</td>
                          <td class="mono">{{ c.fechaCierre || '—' }}</td>
                          <td><ui-badge [estado]="c.estado" /></td>
                          <td>{{ c.responsableAtencion.split('—')[0].trim() }}</td>
                          <td>{{ c.comentarios?.length || 0 }}</td>
                        </tr>
                      } @empty {
                        <tr><td colspan="6" class="muted" style="text-align:center; padding: 18px;">Sin casos de garantía registrados para este expediente.</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
                <div class="alert mb-2">
                  <span class="alert-ico">i</span>
                  <span>
                    Con el caso <b>cerrado</b> no se pueden agregar comentarios; con la garantía <b>vencida</b> no se pueden
                    abrir casos ni comentar. La gestión de los casos se realiza en el módulo <b>Servicio de garantía</b>.
                  </span>
                </div>
              } @empty {
                <p class="muted">Este equipo aún no tiene garantía: inicia cuando el usuario final acepta la entrega.</p>
              }
            }

            <!-- ── Documentos ── -->
            @case ('docs') {
              <div class="table-wrap">
                <table class="tbl">
                  <thead><tr><th>Fecha</th><th>Tipo de documento</th><th>Expediente asociado</th><th>Generado por</th><th>Huella</th></tr></thead>
                  <tbody>
                    @for (doc of documentosEq(); track doc.tipo + doc.expediente + doc.fecha) {
                      <tr>
                        <td class="mono">{{ doc.fecha }}</td>
                        <td class="main-cell">{{ doc.tipo }}</td>
                        <td class="mono">{{ doc.expediente }}</td>
                        <td>{{ doc.generadoPor.split('—')[0].trim() }}</td>
                        <td class="mono">{{ doc.hash }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="5" class="muted" style="text-align:center; padding: 22px;">Este equipo aún no tiene documentos generados.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <span class="hint">Se muestran todos los documentos históricos del equipo (cada F0288, cada F0302, constancias y reportes). La vista previa, las firmas y la descarga están en el Generador de documentos.</span>
            }

            <!-- ── Trazabilidad ── -->
            @case ('traza') {
              <div class="field mb-2" style="max-width: 320px;">
                <label>Tipo de evento</label>
                <select class="control" [(ngModel)]="fEvento">
                  <option value="">Todos los eventos</option>
                  @for (m of modulosDeLinea(); track m) { <option [value]="m">{{ m }}</option> }
                </select>
              </div>

              <div class="alert mb-2">
                <span class="alert-ico">i</span>
                <span>
                  Recorrido en orden cronológico: ingreso al inventario → expediente técnico → cronómetro y
                  preparación F0288 → equipo preparado → asignación → expediente único → cronómetro y
                  configuración F0302 → entrega y aceptación → garantía y sus casos.
                </span>
              </div>

              <div class="timeline">
                @for (e of lineaFiltrada(); track $index) {
                  <div class="tl-item" [class.hito]="e.hito">
                    <div class="tl-when">{{ e.fecha }} · {{ e.hora }}</div>
                    <div class="tl-what">
                      <span class="tl-ico">{{ icono(e) }}</span>{{ e.accion }}
                      <span class="tl-estado"><ui-badge [estado]="e.estado" /></span>
                    </div>
                    <div class="tl-who">{{ e.usuario }}</div>
                    @if (e.observacion) { <div class="tl-note">{{ e.observacion }}</div> }
                    @if (tieneDetalle(e)) {
                      <div class="tl-meta">
                        @if (e.modulo) { <span class="m-chip">Módulo: <b>{{ e.modulo }}</b></span> }
                        @if (e.estadoAnterior) { <span class="m-chip cambio">{{ e.estadoAnterior }} → <b>{{ e.estado }}</b></span> }
                        @if (e.tiempo) { <span class="m-chip">Tiempo: <b>{{ e.tiempo }}</b></span> }
                        @if (e.complejidad) { <span class="m-chip">Complejidad: <b>{{ e.complejidad }}</b></span> }
                        @if (e.nombreEquipo) { <span class="m-chip">Nombre del equipo: <b class="mono">{{ e.nombreEquipo }}</b></span> }
                        @if (e.ipReservada) { <span class="m-chip">IP reservada: <b class="mono">{{ e.ipReservada }}</b></span> }
                    @if (e.mac) { <span class="m-chip">MAC: <b class="mono">{{ e.mac }}</b></span> }
                    @if (e.estadoSolicitudIP) { <span class="m-chip">Solicitud de reserva de IP: <b>{{ e.estadoSolicitudIP }}</b></span> }
                    @if (e.justificacion) { <span class="m-chip">Justificación: <b>{{ e.justificacion }}</b></span> }
                        @if (e.expedienteTecnico) { <span class="m-chip">Exp. técnico: <b class="mono">{{ e.expedienteTecnico }}</b></span> }
                        @if (e.expedienteUnico) { <span class="m-chip">Exp. único: <b class="mono">{{ e.expedienteUnico }}</b></span> }
                        @if (e.usuarioFinal) { <span class="m-chip">Usuario final: <b>{{ e.usuarioFinal }}</b></span> }
                      </div>
                    }
                  </div>
                } @empty {
                  <p class="muted small">No hay eventos del tipo seleccionado para este equipo.</p>
                }
              </div>
            }

            <!-- ── Descargos ── -->
            @case ('descargos') {
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr><th>Fecha descargo</th><th>Usuario final</th><th>Técnico de Soporte</th><th>Motivo</th><th>Expediente anterior</th><th>Acción posterior</th><th>Estado</th><th style="text-align:right;">Acción</th></tr>
                  </thead>
                  <tbody>
                    @for (ds of descargosEq(); track ds.idDescargo) {
                      <tr>
                        <td class="mono main-cell">{{ ds.fechaDescargo }}</td>
                        <td>{{ ds.usuarioFinalEntrega }}</td>
                        <td>{{ ds.responsableRegistro.split('—')[0].trim() }}</td>
                        <td>{{ ds.motivoDescargo }}</td>
                        <td class="mono">{{ ds.expedienteUnicoAnterior || '—' }}</td>
                        <td>
                          {{ ds.accionPosterior }}
                          <div class="sub-cell">Destino: {{ ds.encargadoDestino }}</div>
                        </td>
                        <td><ui-badge [estado]="ds.estado" /></td>
                        <td style="text-align:right;"><button class="btn btn-ghost btn-sm" (click)="tab.set('traza')">Ver trazabilidad</button></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="8" class="muted" style="text-align:center; padding: 22px;">Este equipo aún no tiene descargos registrados.</td></tr>
                    }
                  </tbody>
                </table>
              </div>
              <span class="hint">El descargo lo registra el Técnico de Soporte asignado; cierra la asignación vigente y el ciclo anterior del equipo (histórico, nunca se reutiliza). Según la acción posterior, puede originar un nuevo ingreso a Hardware.</span>
            }
          }
        </ui-modal>
      }
    </div>
  `
})
export class TrazabilidadComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);

  /** Permite llegar con /trazabilidad?inventario=… (p. ej. desde Expediente único). */
  readonly inventario = input<string>();

  protected seleccion = signal('');
  protected q = signal('');
  protected fAnio = signal('');
  protected fTipo = signal('');
  protected fFase = signal('');
  protected fGarantia = signal('');
  protected fEvento = signal('');
  protected mostrar = signal(8);
  protected detalle = signal<FilaTraza | null>(null);

  constructor() {
    effect(() => {
      const inv = this.inventario();
      if (inv && !this.auth.esTecnico()) this.abrirTraza(inv);
    });
  }

  // ---------- Vista resumen por equipo (Encargados y Administrador) ----------
  protected readonly filas = computed<FilaTraza[]>(() =>
    this.data.equiposConRecorrido().map((equipo) => {
      const tec = this.data.expTecnicoDeEquipo(equipo.inventario);
      const asig = this.data.asignacionDeEquipo(equipo.inventario);
      const solicitudId = asig?.expediente ?? equipo.expediente ?? '';
      const unico = solicitudId ? this.data.expedienteUnicoDe(solicitudId) : undefined;
      const garantia = this.data.garantias().find((g) => g.inventario === equipo.inventario);
      const linea = this.data.lineaTiempoEquipo(equipo.inventario);
      const ultimo = linea[linea.length - 1];
      const fase = ultimo?.modulo ?? 'Inventario de Hardware';
      const estado = ultimo?.estado ?? this.data.estadoPreparacionEquipo(equipo.inventario);
      const usuarioFinal = asig?.usuarioFinal ?? garantia?.usuarioFinal ?? '';
      const reservaIP = this.data.reservaIPEquipo(equipo.inventario);
      const texto = [
        equipo.inventario, equipo.marca, equipo.modelo, equipo.tipo, equipo.serie,
        tec?.codigo, tec?.tecnicoPreparacion, unico?.codigoUnico, solicitudId, usuarioFinal,
        garantia?.estado, ...(garantia?.casos.map((c) => `${c.codigo} ${c.responsableAtencion}`) ?? []),
        // El equipo también se busca por su nombre (hostname) y por la IP reservada.
        this.data.nombreEquipoActual(equipo.inventario), reservaIP.ip,
        fase, estado
      ].filter(Boolean).join(' ').toLowerCase();
      return { equipo, tec, unico, solicitudId, garantia, usuarioFinal, ultimo, fase, estado, texto };
    }).sort((a, b) =>
      ((b.ultimo?.fecha ?? b.equipo.fechaIngreso ?? '') + (b.ultimo?.hora ?? ''))
        .localeCompare((a.ultimo?.fecha ?? a.equipo.fechaIngreso ?? '') + (a.ultimo?.hora ?? ''))
    )
  );

  protected readonly anios = computed(() =>
    [...new Set(this.filas().flatMap((f) =>
      [f.ultimo?.fecha, f.equipo.fechaIngreso].filter((x): x is string => !!x).map((x) => x.slice(0, 4))
    ))].sort().reverse()
  );

  protected readonly fasesDisponibles = computed(() =>
    [...new Set(this.filas().map((f) => f.fase))].sort()
  );

  protected readonly filtradas = computed(() => {
    const q = this.q().toLowerCase().trim();
    return this.filas().filter((f) => {
      if (this.fAnio() && !(f.ultimo?.fecha ?? f.equipo.fechaIngreso ?? '').startsWith(this.fAnio())) return false;
      if (this.fTipo() && f.equipo.tipo !== this.fTipo()) return false;
      if (this.fFase() && f.fase !== this.fFase()) return false;
      if (this.fGarantia() === 'con' && !f.garantia) return false;
      if (this.fGarantia() === 'sin' && f.garantia) return false;
      if (this.fGarantia() === 'caso' && f.garantia?.estado !== 'Caso abierto') return false;
      return !q || f.texto.includes(q);
    });
  });

  protected readonly visibles = computed(() => this.filtradas().slice(0, this.mostrar()));

  protected limpiarFiltros(): void {
    this.q.set('');
    this.fAnio.set('');
    this.fTipo.set('');
    this.fFase.set('');
    this.fGarantia.set('');
    this.mostrar.set(8);
  }

  // ---------- Últimos registros (respetan la visibilidad por rol de `filas`) ----------
  protected readonly ultimosIngresados = computed(() =>
    [...this.filas()].filter((f) => !!f.equipo.fechaIngreso)
      .sort((a, b) => b.equipo.fechaIngreso!.localeCompare(a.equipo.fechaIngreso!)).slice(0, 3)
  );
  protected readonly ultimosTec = computed(() =>
    [...this.filas()].filter((f) => !!f.tec)
      .sort((a, b) => b.tec!.fecha.localeCompare(a.tec!.fecha)).slice(0, 3)
  );
  protected readonly ultimosPreparados = computed(() =>
    [...this.filas()].filter((f) => f.tec?.estado === 'Preparado')
      .sort((a, b) => b.tec!.fecha.localeCompare(a.tec!.fecha)).slice(0, 3)
  );
  protected readonly ultimosUnicos = computed(() =>
    [...this.filas()].filter((f) => !!f.unico).slice(0, 3)
  );
  protected readonly ultimosCasos = computed(() =>
    this.filas().flatMap((f) =>
      (f.garantia?.casos ?? []).map((caso) => ({ caso, inventario: f.equipo.inventario })))
      .sort((a, b) => b.caso.fechaApertura.localeCompare(a.caso.fechaApertura)).slice(0, 3)
  );

  // ---------- Historial técnico del equipo (modal con pestañas) ----------
  protected readonly pestanas = [
    { id: 'resumen', nombre: 'Resumen' },
    { id: 'ingresos', nombre: 'Ingresos a Hardware' },
    { id: 'f0288', nombre: 'Preparaciones F0288' },
    { id: 'f0302', nombre: 'Configuraciones F0302' },
    { id: 'asig', nombre: 'Asignaciones' },
    { id: 'gar', nombre: 'Garantía' },
    { id: 'docs', nombre: 'Documentos' },
    { id: 'traza', nombre: 'Trazabilidad' },
    { id: 'descargos', nombre: 'Descargos' }
  ] as const;
  protected tab = signal<(typeof this.pestanas)[number]['id']>('resumen');

  protected abrirTraza(inventario: string): void {
    const fila = this.filas().find((f) => f.equipo.inventario === inventario);
    if (fila) {
      this.fEvento.set('');
      this.tab.set('resumen');
      this.detalle.set(fila);
    }
  }

  // Consultas del historial del equipo abierto: nunca sobrescriben registros anteriores.
  protected readonly preparacionesEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.preparacionesDeEquipo(d.equipo.inventario) : [];
  });
  protected readonly configuracionesEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.configuracionesDeEquipo(d.equipo.inventario) : [];
  });
  protected readonly asignacionesEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.asignacionesDeEquipo(d.equipo.inventario) : [];
  });
  protected readonly garantiasEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.garantiasDeEquipo(d.equipo.inventario) : [];
  });
  protected readonly documentosEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.documentosDeEquipo(d.equipo.inventario) : [];
  });
  protected readonly ingresosEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.ingresosDeEquipo(d.equipo.inventario) : [];
  });

  /**
   * Acciones sugeridas según el estado actual del equipo (§29): una sola fuente de verdad que
   * recorre la cadena Expediente técnico → F0288 → Asignación → Expediente único → F0302 →
   * aceptación → garantía/descargo, y ofrece únicamente el siguiente paso pendiente.
   */
  protected readonly accionesDisponibles = computed<
    { texto: string; ruta: string; params?: Record<string, string> }[]
  >(() => {
    const d = this.detalle();
    if (!d) return [];
    const inv = d.equipo.inventario;
    const acciones: { texto: string; ruta: string; params?: Record<string, string> }[] = [];

    const tec = this.data.expTecnicoDeEquipo(inv);
    const prep = this.preparacionesEq()[0];
    const asigVigente = this.data.asignacionDeEquipo(inv);
    const unico = d.unico;
    const conf = unico ? this.data.configuracionDe(unico.expediente) : undefined;

    if (this.data.puedeCrearNuevoExpedienteTecnico(inv)) {
      acciones.push({ texto: 'Crear Expediente técnico', ruta: '/expediente-tecnico', params: { inventario: inv } });
    } else if (tec && tec.estado !== 'Preparado' && tec.estado !== 'Cerrado') {
      const enCurso = !!prep?.cronometro && prep.cronometro.duracionMinutos === null && prep.estado !== 'Completada';
      acciones.push({ texto: enCurso ? 'Finalizar preparación F0288' : 'Iniciar preparación F0288', ruta: '/preparacion-tecnica' });
    }

    if (tec?.estado === 'Preparado' && !asigVigente) {
      acciones.push({ texto: 'Asignar equipo', ruta: '/asignacion' });
    }

    if (asigVigente && !unico) {
      acciones.push({ texto: 'Crear Expediente único', ruta: '/expediente-unico' });
    }

    if (unico && conf) {
      if (conf.estado === 'Con falla') {
        // F0302 con falla: el equipo debe volver a F0288; no hay aceptación ni garantía hasta reconfigurar bien.
        acciones.push({ texto: 'Ver detalle de falla F0302', ruta: '/configuracion' });
        if (this.data.estadoPreparacionEquipo(inv) === 'Preparado' && !this.data.reingresoHardwarePendiente(inv)) {
          acciones.push({ texto: 'Iniciar nueva configuración F0302', ruta: '/configuracion' });
        }
      } else if (conf.estado !== 'Completada') {
        const enCurso = !!conf.cronometro && conf.cronometro.duracionMinutos === null;
        acciones.push({ texto: enCurso ? 'Finalizar configuración F0302' : 'Iniciar configuración F0302', ruta: '/configuracion' });
      }
    }

    const estadoAcept = d.solicitudId ? this.data.estadoAceptacion(d.solicitudId) : 'Sin enviar';

    if (conf?.estado === 'Completada' && estadoAcept === 'No conforme') {
      // No conformidad vigente: atender y reenviar; NO se muestra garantía ni descargo hasta aceptar.
      acciones.push({ texto: 'Atender no conformidad', ruta: '/entrega-aceptacion' });
      acciones.push({ texto: 'Ver historial de intentos', ruta: '/entrega-aceptacion' });
    } else if (conf?.estado === 'Completada' && (estadoAcept === 'Sin enviar' || estadoAcept === 'Pendiente de firma')) {
      acciones.push({ texto: 'Ver formulario de aceptación', ruta: '/entrega-aceptacion' });
    }

    if (estadoAcept === 'Aceptado') {
      acciones.push({ texto: 'Abrir garantía', ruta: '/garantia' });
      acciones.push({ texto: 'Registrar descargo', ruta: '/descargo', params: { inventario: inv } });
    }

    return acciones;
  });

  /** Estado del ciclo originado por ese ingreso, según su Expediente técnico asociado. */
  protected estadoIngreso(i: IngresoHardware): string {
    if (!i.expedienteTecnicoAsociado) return 'Pendiente';
    const et = this.data.expedientesTecnicos().find((x) => x.codigo === i.expedienteTecnicoAsociado);
    if (!et) return 'Pendiente';
    if (et.estado === 'Cerrado') return 'Histórico';
    if (et.estado === 'Preparado') return 'Preparado';
    return 'En proceso';
  }

  /**
   * Software del catálogo que quedó instalado en una preparación F0288 (Windows, .NET Framework,
   * Antivirus, OCS Inventory…), con la versión elegida desde el catálogo.
   */
  protected softwareInstalado(p: PreparacionF0288): ChecklistItem[] {
    return p.secciones.flatMap((s) => s.items).filter((i) => i.codigoSoftware && i.estado === 'Realizado');
  }

  /**
   * Software que la Configuración F0302 heredó de la Preparación F0288: se muestra en el historial
   * como información del formulario anterior, nunca como algo configurado por Soporte.
   */
  protected softwareHeredado(c: ConfiguracionF0302): SoftwareHeredadoF0288[] {
    return this.data.softwareHeredadoF0288(c.expediente);
  }

  /**
   * Actividades del F0302 con captura obligatoria (Agente DLP) y la evidencia que las respalda:
   * el historial del equipo debe mostrar el control de seguridad y su archivo, no solo el estado.
   */
  protected capturasF0302(c: ConfiguracionF0302) {
    return this.data.softwareChecklistF0302(c)
      .filter((s) => s.requiereEvidencia)
      .map((s) => {
        const ev = c.evidencias.find((e) => e.item === s.nombre && e.archivo);
        return {
          nombre: s.nombre,
          estado: s.estado === 'Realizado' ? 'Configurado' : s.estado,
          archivo: ev?.archivo ?? s.evidencia ?? '',
          cargadaPor: ev?.cargadaPor ?? '',
          fecha: ev?.fecha ?? ''
        };
      });
  }

  /** Software que el Técnico de Soporte agregó en la Configuración F0302 según el requerimiento. */
  protected softwareAgregado(c: ConfiguracionF0302): SoftwareF0302[] {
    return this.data.softwareAdicionalF0302(c).filter((s) => s.codigoSoftware);
  }

  /** Resumen de accesorios verificados de una preparación F0288 (equipo usado), o '' si no aplica. */
  protected accesoriosResumen(p: PreparacionF0288): string {
    const va = p.verificacionAccesorios;
    if (!va || va.respuesta !== 'Sí') return '';
    const total = va.accesorios.length;
    const verificados = va.accesorios.filter((a) => a.seleccionado).length;
    return `${verificados} de ${total} accesorio(s) verificado(s)`;
  }

  /**
   * Accesorios efectivamente asociados a una preparación F0288: los marcados y encontrados en la
   * base institucional simulada. Cada uno lleva su propio número de inventario, distinto al del
   * equipo principal.
   */
  protected accesoriosAsociados(p: PreparacionF0288): AccesorioVerificado[] {
    const va = p.verificacionAccesorios;
    if (!va || va.respuesta !== 'Sí') return [];
    return va.accesorios.filter((a) => a.seleccionado && a.resultadoBusqueda === 'Encontrado');
  }

  /** Estado del F0288 de ese ciclo: Generado si la preparación ya finalizó (o quedó cerrada), Pendiente si sigue en curso. */
  protected f0288DeIngreso(i: IngresoHardware): string {
    if (!i.expedienteTecnicoAsociado) return '—';
    const prep = this.data.preparacionPorCodigo(i.expedienteTecnicoAsociado);
    if (!prep) return '—';
    return prep.estado === 'Completada' || prep.estado === 'Cerrada' ? 'Generado' : 'Pendiente';
  }
  protected readonly descargosEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.descargosDeEquipo(d.equipo.inventario) : [];
  });
  protected readonly resumenEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.resumenEquipo(d.equipo.inventario) : undefined;
  });

  // Contadores históricos: cuentan las preparaciones/configuraciones que llegaron a realizarse
  // (Completada o Cerrada por un descargo posterior). Nunca se reinician al descargar/reingresar.
  protected readonly vecesPreparado = computed(() =>
    this.preparacionesEq().filter((p) => this.data.preparacionFinalizada(p)).length
  );
  protected readonly vecesConfigurado = computed(() =>
    this.configuracionesEq().filter((c) => this.data.configuracionFinalizada(c)).length
  );
  /** Intentos F0302 = configuraciones finalizadas correctamente + configuraciones con falla. */
  protected readonly intentosF0302 = computed(() =>
    this.configuracionesEq().filter((c) => this.data.configuracionEsIntento(c)).length
  );

  /** Resultado legible de un F0302 para la pestaña de configuraciones. */
  protected resultadoF0302(c: ConfiguracionF0302): string {
    if (c.estado === 'Con falla') return 'Con falla';
    if (c.estado === 'Completada') return 'Generado';
    if (c.estado === 'Cerrada') return 'Cerrada';
    return 'En curso';
  }
  protected readonly ultimaPrep = computed(() =>
    this.preparacionesEq().find((p) => this.data.preparacionFinalizada(p))
  );
  protected readonly ultimaConf = computed(() =>
    this.configuracionesEq().find((c) => this.data.configuracionFinalizada(c))
  );
  /** Configuración F0302 más reciente del equipo, finalizada o no: de ahí sale la reserva de IP vigente. */
  protected readonly ultimaConfEq = computed(() => this.configuracionesEq()[0]);
  /** MAC vigente del equipo: la registrada al solicitar la reserva o, si no hay, la del inventario. */
  protected readonly macEquipo = computed(() => {
    const c = this.ultimaConfEq();
    return (c?.datos.macEquipo ?? '').trim() || (this.detalle()?.equipo.mac ?? '');
  });

  protected conformidadDe(id: string): Conformidad | undefined {
    return this.data.conformidades().find((c) => c.expediente === id);
  }

  /** Nombre del Técnico de Hardware que preparó el equipo abierto, si la preparación fue de Hardware. */
  protected tecnicoHardwarePreparo(): string {
    const tec = this.detalle()?.tec;
    return tec && tec.unidadResponsable === 'Hardware' ? tec.tecnicoPreparacion.split('—')[0].trim() : '';
  }

  protected readonly lineaCompleta = computed(() => {
    const d = this.detalle();
    return d ? this.data.lineaTiempoEquipo(d.equipo.inventario) : [];
  });

  protected readonly modulosDeLinea = computed(() =>
    [...new Set(this.lineaCompleta().map((e) => e.modulo).filter((m): m is string => !!m))]
  );

  protected readonly lineaFiltrada = computed(() => {
    const m = this.fEvento();
    return m ? this.lineaCompleta().filter((e) => e.modulo === m) : this.lineaCompleta();
  });

  protected documentosDeFila(d: FilaTraza): DocumentoGenerado[] {
    const ids = new Set([d.solicitudId, d.tec?.codigo].filter(Boolean));
    return this.data.documentos().filter((doc) => ids.has(doc.expediente));
  }

  // ---------- Vista por solicitud (secundaria; principal para técnicos) ----------
  protected readonly conEventos = computed(() =>
    [...new Set(this.data.eventosVisibles().map((e) => e.expediente))].sort().reverse()
  );

  protected readonly eventos = computed(() => {
    const sel = this.seleccion();
    const todos = this.data.eventosVisibles();
    const filtrados = sel ? todos.filter((e) => e.expediente === sel) : todos;
    return [...filtrados].sort((a, b) => (b.fecha + b.hora).localeCompare(a.fecha + a.hora));
  });

  protected tieneDetalle(e: EventoTrazabilidad): boolean {
    return !!(e.modulo || e.estadoAnterior || e.inventario || e.expedienteTecnico || e.expedienteUnico ||
      e.usuarioFinal || e.tiempo || e.complejidad || e.nombreEquipo || e.ipReservada ||
      e.mac || e.estadoSolicitudIP || e.justificacion);
  }

  private readonly iconos: Record<string, string> = {
    'Inventario de Hardware': '📦',
    'Ingreso a Hardware': '📥',
    'Descargo': '📤',
    'Expediente técnico': '📁',
    'Preparación técnica F0288': '🛠️',
    'Asignación de equipo': '👤',
    'Expediente único': '🗂️',
    'Configuración F0302': '💻',
    'Entrega y aceptación': '🤝',
    'Servicio de garantía': '🛡️',
    'Reporte final de auditoría': '📄',
    'Generador de documentos': '⬇️',
    'Solicitudes': '📨'
  };

  protected icono(e: EventoTrazabilidad): string {
    return this.iconos[e.modulo ?? ''] ?? '•';
  }
}
