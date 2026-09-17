import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import {
  AccesorioVerificado, ChecklistItem, Conformidad, ConfiguracionF0302, DocumentoGenerado, Equipo,
  CasoGarantia, EventoTrazabilidad, ExpedienteTecnico, ExpedienteUnico, Garantia, IngresoHardware, ModuloEvidencia,
  PreparacionF0288, SoftwareF0302, SoftwareHeredadoF0288
} from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { ConstanciaReprocesoComponent } from '../../shared/constancia-reproceso';
import { ConstanciaCorreccionComponent } from '../../shared/constancia-correccion';
import { IconComponent } from '../../shared/icon';
import { LineaTiempoComponent } from '../../shared/linea-tiempo';
import { EvidenciasComponent } from '../../shared/evidencias';

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
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent, ConstanciaReprocesoComponent,
    ConstanciaCorreccionComponent, LineaTiempoComponent, EvidenciasComponent],
  styles: `
    /* Ciclos de vida del equipo: cada ciclo es una tarjeta cerrada sobre sí misma. */
    .ciclo { border: 1px solid var(--line); border-radius: var(--r-md); background: var(--surface); margin-bottom: 12px; overflow: hidden; }
    .ciclo.abierto { border-color: var(--navy-900); }
    .ciclo > header { display: flex; flex-wrap: wrap; align-items: center; gap: 10px;
      padding: 9px 13px; background: var(--surface-2); border-bottom: 1px solid var(--line); }
    .ciclo > header .n { font-size: 13px; font-weight: 800; color: var(--navy-900); }
    .ciclo > header .fechas { margin-left: auto; font-size: 11.5px; color: var(--tx-2); }
    .ciclo .cuerpo { padding: 11px 13px; }
    .ciclo .fk { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 9px 16px; margin-bottom: 10px; }
    .ciclo .fk > div { font-size: 12.5px; }
    .ciclo .fk span { display: block; color: var(--tx-2); font-size: 10.5px; text-transform: uppercase; letter-spacing: .04em; }
    .ciclo .etapas { display: flex; flex-wrap: wrap; gap: 5px; }
    .ciclo .etapa { border: 1px solid var(--line); border-radius: 999px; padding: 3px 10px; font-size: 11.5px; background: var(--surface); }
    .ciclo .etapa.no { color: var(--tx-3); border-style: dashed; }
    .mov-tipo { font-size: 11px; font-weight: 700; letter-spacing: .03em; }
    /* Encargo → ejecución → documento: las tres entidades del DER, una bajo otra. */
    .encargos { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; margin-top: 10px; }
    .encargos .e-t { display: block; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: var(--tx-2); font-weight: 700; margin-bottom: 4px; }
    .encargos .e-l { font-size: 12px; padding: 2px 0; }
    .encargos .e-l.sub { color: var(--tx-2); font-size: 11.5px; }
    .encargos .e-l.cancel { text-decoration: line-through; color: var(--tx-3); }
    .encargos .e-m { display: block; font-size: 11px; color: var(--tx-2); }
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
          <p class="page-sub">Recorrido cronológico del equipo desde su ingreso hasta entrega, garantía o reproceso.</p>
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
                <th>Ciclo</th>
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
                  <!-- Ciclo de vida: cuántos ha tenido el equipo y en cuál está. Un equipo con
                       más de uno arrastra todo su histórico, que se lee en «Ciclos de vida». -->
                  <td class="mono">
                    @if (f.tec) {
                      {{ f.tec.ciclo }}
                      @if (ciclosDe(f.equipo.inventario) > 1) {
                        <div class="sub-cell">de {{ ciclosDe(f.equipo.inventario) }}</div>
                      }
                    } @else { — }
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
                  <td colspan="9" class="muted" style="text-align:center; padding: 26px;">
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
          <ui-linea-tiempo [eventos]="eventos()" orden="desc" [mostrarExpediente]="true" />
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
                  <div class="d-k">Preparaciones iniciales</div><div class="d-v">{{ vecesPreparado() }}</div>
                  <div class="d-k">Reprocesos F0288 <span class="small muted">(no suman preparaciones ni expedientes)</span></div><div class="d-v">{{ reprocesosEq().length }}</div>
                  <div class="d-k">Intentos F0302 <span class="small muted">(incluye con falla)</span></div><div class="d-v">{{ intentosF0302() }}</div>
                  <div class="d-k">F0302 exitosos</div><div class="d-v">{{ vecesConfigurado() }}</div>
                  <div class="d-k">Fallas F0302</div><div class="d-v">{{ fallasF0302() }}</div>
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

            <!-- ── Ciclos de vida (DER) ── -->
            @case ('ciclos') {
              <p class="hint mb-2">
                Un equipo acumula <b>varios ciclos</b> a lo largo de su vida útil: cada reingreso a Hardware
                abre un Expediente técnico nuevo y, con él, un Expediente único nuevo. Los anteriores quedan
                cerrados como histórico y <b>nunca se sobrescriben</b>. Cada ciclo muestra el ET y el EU que
                tiene <b>guardados</b>, no el más reciente del equipo.
              </p>
              @if (garantiaProveedorEq(); as gp) {
                <div class="ciclo">
                  <header>
                    <span class="n">Garantía de proveedor</span>
                    <ui-badge [estado]="gp.estado" />
                    <span class="fechas">{{ gp.fechaInicio || '—' }} → {{ gp.fechaVencimiento || '—' }}</span>
                  </header>
                  <div class="cuerpo">
                    <p class="hint" style="margin:0;">
                      Pertenece al <b>equipo</b>, no a un ciclo: corre desde la fecha de adquisición
                      ({{ gp.fechaAdquisicion || 'sin registrar' }}) y existe aunque el equipo nunca se haya entregado.
                      @if (gp.proveedor) { Proveedor: {{ gp.proveedor }}. }
                    </p>
                  </div>
                </div>
              }
              @for (c of ciclosEq(); track c.ciclo) {
                <div class="ciclo" [class.abierto]="c.abierto">
                  <header>
                    <span class="n">Ciclo {{ c.ciclo }}</span>
                    <ui-badge [estado]="c.abierto ? 'En curso' : 'Histórico'" />
                    @if (c.descargo) { <ui-badge estado="Cerrado por descargo" /> }
                    <span class="fechas">
                      Apertura {{ c.expedienteTecnico.fechaApertura || c.expedienteTecnico.fecha }}
                      @if (c.expedienteTecnico.fechaCierre) { · Cierre {{ c.expedienteTecnico.fechaCierre }} }
                    </span>
                  </header>
                  <div class="cuerpo">
                    <div class="fk">
                      <div><span>Expediente técnico</span><b class="mono">{{ c.expedienteTecnico.codigo }}</b></div>
                      <div><span>Expediente único</span><b class="mono">{{ c.expedienteUnico?.codigoUnico || 'No llegó a crearse' }}</b></div>
                      <div><span>Solicitud</span><b class="mono">{{ c.solicitud?.expediente || '—' }}</b></div>
                      <div><span>Usuario final</span><b>{{ c.asignacion?.usuarioFinal || '—' }}</b></div>
                      <div><span>Técnico de preparación</span><b>{{ c.expedienteTecnico.tecnicoPreparacion.split('—')[0].trim() }}</b></div>
                      <div><span>Descargo</span><b class="mono">{{ c.descargo?.idDescargo || '—' }}</b></div>
                    </div>
                    <div class="etapas">
                      <span class="etapa" [class.no]="!c.preparacion">F0288 {{ c.preparacion?.estado || 'sin registrar' }}</span>
                      <span class="etapa" [class.no]="!c.expedienteUnico">EU {{ c.expedienteUnico?.estado || 'no creado' }}</span>
                      <span class="etapa" [class.no]="!c.configuracion">F0302 {{ c.configuracion?.estado || 'sin registrar' }}</span>
                      <span class="etapa" [class.no]="!c.entrega">Entrega {{ c.entrega?.estado || 'sin registrar' }}</span>
                      <span class="etapa" [class.no]="!c.conformidad">Conformidad {{ c.conformidad?.estado || 'sin registrar' }}</span>
                      <span class="etapa" [class.no]="!c.garantias.length">Garantía interna: {{ c.garantias.length || 'ninguna' }}</span>
                      <span class="etapa" [class.no]="!c.reprocesos.length">Reprocesos: {{ c.reprocesos.length }}</span>
                      <span class="etapa" [class.no]="!c.movimientos.length">Movimientos: {{ c.movimientos.length }}</span>
                    </div>
                    <!-- El DER separa el encargo del trabajo, su ejecución y el documento. Se muestran
                         los tres para que una reasignación quede visible en vez de desaparecer. -->
                    @if (c.asignacionesPreparacion.length || c.asignacionesConfiguracion.length) {
                      <div class="encargos">
                        @if (c.asignacionesPreparacion.length) {
                          <div>
                            <span class="e-t">Preparación · encargos</span>
                            @for (a of c.asignacionesPreparacion; track a.id) {
                              <div class="e-l" [class.cancel]="a.estado === 'Cancelada'">
                                <b class="mono">{{ a.id }}</b> {{ a.tecnico.split('—')[0].trim() }}
                                <ui-badge [estado]="a.estado" />
                                @if (a.motivo) { <span class="e-m">{{ a.motivo }}</span> }
                              </div>
                            }
                            @for (f of c.formsPreparacion; track f.id) {
                              <div class="e-l sub"><b class="mono">{{ f.id }}</b> ejecución v{{ f.version }} · {{ f.estado }}</div>
                            }
                          </div>
                        }
                        @if (c.asignacionesConfiguracion.length) {
                          <div>
                            <span class="e-t">Configuración · encargos</span>
                            @for (a of c.asignacionesConfiguracion; track a.id) {
                              <div class="e-l" [class.cancel]="a.estado === 'Cancelada'">
                                <b class="mono">{{ a.id }}</b> {{ a.tecnico.split('—')[0].trim() }}
                                <ui-badge [estado]="a.estado" />
                                @if (a.motivo) { <span class="e-m">{{ a.motivo }}</span> }
                              </div>
                            }
                            @for (f of c.formsConfiguracion; track f.id) {
                              <div class="e-l sub"><b class="mono">{{ f.id }}</b> ejecución v{{ f.version }} · {{ f.estado }}</div>
                            }
                          </div>
                        }
                      </div>
                    }
                    @if (c.reprocesos.length) {
                      <p class="hint" style="margin:9px 0 0;">
                        Los {{ c.reprocesos.length }} reproceso(s) de este ciclo corrigen <b>este mismo</b> Expediente
                        técnico: un reproceso nunca abre un ciclo nuevo.
                      </p>
                    }
                  </div>
                </div>
              } @empty {
                <p class="muted">Este equipo todavía no tiene ningún Expediente técnico: no ha iniciado su primer ciclo.</p>
              }
            }

            <!-- ── Movimientos físicos del equipo ── -->
            @case ('mov') {
              <p class="hint mb-2">
                Dónde ha estado el equipo y por qué se movió. La <b>descarga</b> genera un movimiento de tipo
                DESCARGA y el <b>reingreso a Hardware</b> genera uno de tipo REINGRESO_HARDWARE, que
                <b>no</b> abre por sí solo un Expediente técnico nuevo.
              </p>
              <div class="table-wrap">
                <table class="tbl">
                  <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>Origen</th><th>Destino</th><th>Ciclo</th><th>Motivo</th><th>Registró</th></tr>
                  </thead>
                  <tbody>
                    @for (m of movimientosEq(); track m.id) {
                      <tr>
                        <td class="mono main-cell">{{ m.fecha }}@if (m.hora) { <div class="sub-cell">{{ m.hora }}</div> }</td>
                        <td><span class="mov-tipo">{{ m.tipoMovimiento }}</span></td>
                        <td>{{ data.extremoMovimiento(m.direccionOrigenId, m.ubicacionOrigenId) }}</td>
                        <td>{{ data.extremoMovimiento(m.direccionDestinoId, m.ubicacionDestinoId) }}</td>
                        <td class="mono">{{ m.ciclo || '—' }}</td>
                        <td>
                          {{ m.motivo }}
                          @if (m.observaciones) { <div class="sub-cell">{{ m.observaciones }}</div> }
                        </td>
                        <td class="sub-cell">{{ m.usuarioRegistra.split('—')[0].trim() }}</td>
                      </tr>
                    } @empty {
                      <tr><td colspan="7" class="muted">Sin movimientos registrados para este equipo.</td></tr>
                    }
                  </tbody>
                </table>
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

              <!-- Reprocesos: correcciones dentro del mismo Expediente técnico, no preparaciones nuevas -->
              @if (reprocesosEq().length) {
                <div class="sec-title mt-3">Reprocesos de Preparación F0288</div>
                <div class="table-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th>Reproceso</th><th>Exp. técnico</th><th>Origen</th><th>Técnico de Hardware</th><th>Tiempo</th><th>Corrección y evidencias</th><th>Firma y resultado</th><th>Constancia</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      @for (r of reprocesosEq(); track r.id) {
                        <tr>
                          <td class="mono">{{ r.id }}<div class="sub-cell">Reproceso #{{ r.numero }} · prioridad {{ r.prioridad }}</div></td>
                          <td class="mono">{{ r.expedienteTecnico }}<div class="sub-cell">El mismo expediente</div></td>
                          <td>{{ r.tipoFalla }}
                            <div class="sub-cell">
                              @switch (r.origen) {
                                @case ('Inconformidad del usuario final') { Inconformidad del usuario final }
                                @case ('Garantía') { Garantía · caso {{ r.casoGarantia }} }
                                @default { Falla detectada en F0302 }
                              }
                            </div>
                            <div class="sub-cell" style="max-width: 220px;">{{ r.motivo }}</div>
                          </td>
                          <td>{{ (r.tecnicoAsignado || 'Sin asignar').split('—')[0].trim() }}
                            <div class="sub-cell">Reportó: {{ r.solicitadoPor.split('—')[0].trim() }} · {{ r.fechaSolicitud }}</div>
                            @if (r.justificacionUnidad) { <div class="sub-cell">Excepción: {{ r.justificacionUnidad }}</div> }
                          </td>
                          <td class="mono">{{ data.formatoDuracion(r.cronometro?.duracionMinutos ?? null) || '—' }}</td>
                          <td>
                            <div class="sub-cell" style="max-width: 240px;">{{ r.correccionTecnica || '—' }}</div>
                            @for (e of r.evidencias; track e.archivo) {
                              <div class="sub-cell" style="max-width: 240px;">{{ e.archivo }} · {{ e.tipo }} · {{ e.cargadaPor }}</div>
                            }
                          </td>
                          <td>
                            @if (r.firma; as fr) {
                              {{ r.resultado }}
                              <div class="sub-cell">{{ fr.nombre }} — {{ fr.cargo }} · {{ fr.fecha }} {{ fr.hora }}</div>
                            } @else { <span class="muted small">Sin firma</span> }
                          </td>
                          <td>
                            @if (data.constanciaDeReproceso(r.id); as d) {
                              <div class="mono">{{ d.codigo }}</div>
                              <div class="sub-cell">{{ d.estado }}</div>
                              <button class="btn btn-ghost btn-sm" (click)="verConstancia.set(r.id)">Ver documento</button>
                            } @else { <span class="muted small">Pendiente de firma</span> }
                          </td>
                          <td><ui-badge [estado]="r.estado" /></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <span class="hint">
                  Un reproceso corrige la preparación por una falla detectada en F0302, por una inconformidad del
                  usuario final o por una garantía, y se registra <b>dentro del mismo Expediente técnico</b>: no crea
                  uno nuevo, no repite el F0288 original y no cuenta como «vez preparado».
                </span>
              }

              <!-- Garantías del equipo y su revisión técnica de Hardware, cuando la hubo -->
              @if (casosGarantiaEq().length) {
                <div class="sec-title mt-3">Garantías y revisiones técnicas</div>
                <div class="table-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th>Caso</th><th>Problema reportado</th><th>Revisión técnica</th><th>Técnico de Hardware</th><th>Resultado</th><th>Documento</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      @for (x of casosGarantiaEq(); track x.caso.codigo) {
                        <tr>
                          <td class="mono">{{ x.caso.codigo }}
                            <div class="sub-cell">{{ x.caso.motivo }} · {{ x.caso.fechaApertura }}</div>
                          </td>
                          <td>{{ x.caso.tipoProblema || '—' }}
                            <div class="sub-cell" style="max-width: 220px;">{{ x.caso.descripcion }}</div>
                          </td>
                          <td class="mono">
                            @if (revisionGarantia(x.caso); as r) {
                              {{ r.id }}<div class="sub-cell">{{ r.estado }}</div>
                            } @else { <span class="muted small">Sin revisión de Hardware</span> }
                          </td>
                          <td>
                            @if (revisionGarantia(x.caso); as r) {
                              {{ (r.tecnicoAsignado || 'Sin asignar').split('—')[0].trim() }}
                              @if (!r.tecnicoAsignado && r.tecnicoSugerido) {
                                <div class="sub-cell">Sugerido: {{ r.tecnicoSugerido }}</div>
                              }
                            } @else { <span class="muted small">—</span> }
                          </td>
                          <td>
                            @if (revisionGarantia(x.caso); as r) { {{ r.resultado || 'Pendiente' }} }
                            @if (x.caso.validacionSoporte; as v) {
                              <div class="sub-cell">Validado por Soporte: {{ v.validadoPor.split('—')[0].trim() }} · {{ v.fecha }}</div>
                            }
                          </td>
                          <td>
                            @if (revisionGarantia(x.caso); as r) {
                              @if (data.constanciaDeReproceso(r.id); as d) {
                                <div class="mono">{{ d.codigo }}</div>
                                <div class="sub-cell">{{ d.tipo }}</div>
                                <button class="btn btn-ghost btn-sm" (click)="verConstancia.set(r.id)">Ver documento</button>
                              } @else { <span class="muted small">Pendiente de firma</span> }
                            } @else { <span class="muted small">—</span> }
                          </td>
                          <td>
                            <ui-badge [estado]="x.caso.estado" />
                            @if (x.caso.estadoRevision) { <div class="sub-cell mono">{{ x.caso.estadoRevision }}</div> }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <span class="hint">
                  No todo caso de garantía va a Hardware: Soporte clasifica el problema y solo los que exigen revisión
                  física generan una revisión técnica, con código <b>…-G1</b> dentro del mismo Expediente técnico.
                </span>
              }

              <!-- Ítems del F0302 que quedaron fuera: qué no se configuró en este equipo y por qué -->
              @if (noAplicaEq().length) {
                <div class="sec-title mt-3">Ítems de la Configuración F0302 marcados como No aplica</div>
                <div class="table-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th>Expediente único</th><th>Ítem</th><th>Estado</th><th>Justificación</th><th>Técnico de configuración</th><th>Fecha y hora</th></tr>
                    </thead>
                    <tbody>
                      @for (x of noAplicaEq(); track x.expediente + x.item.nombre) {
                        <tr>
                          <td class="mono">{{ x.expedienteUnico || x.expediente }}
                            <div class="sub-cell">Configuración F0302</div>
                          </td>
                          <td class="main-cell">{{ x.item.nombre }}</td>
                          <td><ui-badge estado="No aplica" /></td>
                          <td>{{ x.item.justificacionNoAplica || 'Sin justificar' }}</td>
                          <td>{{ (x.item.noAplicaPor || x.tecnico).split('—')[0].trim() }}</td>
                          <td class="mono">{{ x.item.fechaNoAplica || '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <span class="hint">
                  Un ítem marcado <b>No aplica</b> no exige imagen de evidencia, pero sí motivo escrito: sin él, la
                  Configuración F0302 no se finaliza.
                </span>
              }

              <!-- Garantía del equipo: de qué responde, desde cuándo y quién movió las fechas -->
              @if (garantiaEq(); as g) {
                <div class="sec-title mt-3">Garantía del equipo</div>
                <div class="datos">
                  <div><span>Tipo de equipo</span><b>{{ detalle()?.equipo?.condicion || '—' }}</b></div>
                  <div><span>Tipo de garantía</span><b>{{ g.tipoGarantia || '—' }}</b></div>
                  <div><span>Fecha de adquisición</span><b class="mono">{{ g.fechaAdquisicion || 'Sin registrar' }}</b></div>
                  <div><span>Proveedor</span><b>{{ g.proveedor || 'No consta' }}</b></div>
                  <div><span>Fecha de aceptación</span><b class="mono">{{ g.fechaAceptacion }}</b></div>
                  @if (g.inicioProveedor) {
                    <div>
                      <span>Garantía del proveedor</span>
                      <b class="mono">{{ g.inicioProveedor }} → {{ g.vencimientoProveedor }}</b>
                    </div>
                  }
                  <div><span>Inicio de garantía</span><b class="mono">{{ g.fechaInicio || '—' }}</b></div>
                  <div><span>Vencimiento</span><b class="mono">{{ g.fechaVencimiento || '—' }}</b></div>
                  <div><span>Estado</span><b>{{ data.estadoDetalleGarantia(g) }}</b></div>
                  <div><span>Responsable</span><b>{{ data.responsableGarantia(g) }}</b></div>
                  <div><span>Modificaciones</span><b>{{ (g.modificaciones || []).length }}</b></div>
                  <div><span>Casos de garantía</span><b>{{ g.casos.length }}</b></div>
                </div>
                @if (g.tipoGarantia === 'Garantía de proveedor' && g.fechaAdquisicion) {
                  <span class="hint">
                    Equipo ingresado desde la base institucional con fecha de adquisición
                    <b>{{ g.fechaAdquisicion }}</b>. La garantía del proveedor se calculó desde ahí
                    ({{ g.inicioProveedor }} → {{ g.vencimientoProveedor }}), no desde la aceptación del usuario
                    final ({{ g.fechaAceptacion }}).
                  </span>
                } @else if (g.tipoGarantia === 'Sin garantía de proveedor') {
                  <span class="hint">
                    La garantía del proveedor cubrió del <b>{{ g.inicioProveedor }}</b> al
                    <b>{{ g.vencimientoProveedor }}</b> y ya venció. El Encargado de Soporte debe establecer la
                    responsabilidad interna de Soporte.
                  </span>
                } @else if (g.tipoGarantia === 'Responsabilidad interna de Soporte') {
                  <span class="hint">
                    Lo que corre es la <b>responsabilidad interna de Soporte</b>, que sí puede iniciar con la
                    aceptación del usuario final.
                    @if (g.inicioProveedor) {
                      La garantía del proveedor de este equipo cubrió del {{ g.inicioProveedor }} al {{ g.vencimientoProveedor }}.
                    }
                  </span>
                }
                @if (g.modificaciones?.length) {
                  <div class="table-wrap mt-2">
                    <table class="tbl">
                      <thead>
                        <tr><th>Fecha</th><th>Usuario</th><th>Rol</th><th>Vigencia anterior</th><th>Vigencia nueva</th><th>Motivo</th></tr>
                      </thead>
                      <tbody>
                        @for (m of g.modificaciones; track m.fecha + m.hora) {
                          <tr>
                            <td class="mono">{{ m.fecha }} {{ m.hora }}</td>
                            <td>{{ m.usuario.split('—')[0].trim() }}</td>
                            <td>{{ m.rol }}</td>
                            <td class="mono">{{ m.inicioAnterior || '—' }} → {{ m.vencimientoAnterior || '—' }}</td>
                            <td class="mono">{{ m.inicioNuevo }} → {{ m.vencimientoNuevo }}</td>
                            <td>{{ m.motivo }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              }

              <!-- Pertenencia del equipo: a qué Dirección/Registro pasó al aceptarlo y cuándo salió -->
              @if (controlesEq().length) {
                <div class="sec-title mt-3">Pertenencia a Dirección/Registro e inventario de Controles</div>
                <div class="table-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th>Aceptación</th><th>Dirección</th><th>Unidad</th><th>Usuario final</th><th>Técnico de configuración</th><th>Soporte responsable</th><th>Descargo</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      @for (c of controlesEq(); track c.expediente + c.fechaAceptacion) {
                        <tr>
                          <td class="mono">{{ c.fechaAceptacion }}
                            <div class="sub-cell">{{ c.expedienteUnico || c.expediente }}</div>
                          </td>
                          <td>{{ c.direccionAnterior || c.direccion }}</td>
                          <td>{{ c.unidadAnterior || c.unidad }}</td>
                          <td>{{ c.usuarioFinalAnterior || c.usuarioFinal }}</td>
                          <td>{{ c.tecnicoConfiguracion.split('—')[0].trim() || '—' }}</td>
                          <td>{{ c.soporteResponsable ? c.soporteResponsable.split('—')[0].trim() : '—' }}</td>
                          <td>
                            @if (c.fechaDescargo) {
                              <div class="mono">{{ c.fechaDescargo }}</div>
                              <div class="sub-cell">{{ c.motivoDescargo }} · {{ c.accionPosterior }}</div>
                              <div class="sub-cell">Registrado por {{ (c.descargadoPor || '').split('—')[0].trim() }}</div>
                            } @else { <span class="muted small">Sin descargo</span> }
                          </td>
                          <td>
                            <ui-badge [estado]="c.estado" />
                            <div class="sub-cell">{{ c.estadoControlMensual }}</div>
                            @if (c.fechaDescargo) { <div class="sub-cell">{{ c.estadoGestion }}</div> }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <span class="hint">
                  El equipo pertenece a la Dirección/Registro <b>solo desde la aceptación del usuario final</b>, y sale del
                  inventario activo con el descargo. La relación histórica con la Dirección/Registro anterior se conserva.
                </span>
              }

              <!-- Inconformidades del usuario final: cómo se resolvió cada una (spec §17) -->
              @if (inconformidadesEq().length) {
                <div class="sec-title mt-3">Inconformidades del usuario final</div>
                <div class="table-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th>Corrección</th><th>Intento</th><th>Tipo de problema</th><th>Resolución</th><th>Técnico de Soporte</th><th>Resultado</th><th>Constancia</th><th>Estado</th></tr>
                    </thead>
                    <tbody>
                      @for (c of inconformidadesEq(); track c.id) {
                        <tr>
                          <td class="mono">{{ c.id }}<div class="sub-cell" style="max-width: 220px;">{{ c.observacionUsuario }}</div></td>
                          <td>#{{ c.intentoNumero }}<div class="sub-cell">{{ c.usuarioFinal }}</div></td>
                          <td>{{ c.tipoProblema }}</td>
                          <td>{{ c.resolucion }}
                            @if (c.reprocesoId) { <div class="sub-cell mono">{{ c.reprocesoId }}</div> }
                            @if (c.justificacionResolucion) { <div class="sub-cell">Excepción: {{ c.justificacionResolucion }}</div> }
                          </td>
                          <td>{{ c.tecnico.split('—')[0].trim() }}
                            @if (c.firma; as f) { <div class="sub-cell">Firmó {{ f.fecha }} {{ f.hora }}</div> }
                          </td>
                          <td>{{ c.resultado || '—' }}</td>
                          <td>
                            @if (data.constanciaDeCorreccion(c.id); as d) {
                              <div class="mono">{{ d.codigo }}</div>
                              <div class="sub-cell">{{ d.estado }}</div>
                              <button class="btn btn-ghost btn-sm" (click)="verConstanciaCor.set(c.id)">Ver documento</button>
                            } @else if (c.reprocesoId && data.constanciaDeReproceso(c.reprocesoId)) {
                              <div class="sub-cell">Constancia del reproceso</div>
                              <button class="btn btn-ghost btn-sm" (click)="verConstancia.set(c.reprocesoId)">Ver documento</button>
                            } @else { <span class="muted small">Pendiente de firma</span> }
                          </td>
                          <td><ui-badge [estado]="c.estado" /></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
                <span class="hint">
                  Una inconformidad se resuelve igual que una falla de F0302: se clasifica, se corrige en configuración
                  o con un reproceso F0288 sobre el mismo Expediente técnico, y se cierra con firma.
                </span>
              }
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
                            <div class="sub-cell" style="max-width: 200px;">{{ data.textoEstadoIncidencia(f.estadoIncidencia) }}</div>
                            <div class="sub-cell" style="max-width: 200px;">Reproceso F0288: {{ f.requiereReprocesoF0288 ? 'Sí' : 'No' }} · sugerencia {{ f.sugerencia }}</div>
                            @if (f.reprocesoId) { <div class="sub-cell mono" style="max-width: 200px;">{{ f.reprocesoId }}</div> }
                            @if (data.resumenDetalleFalla(f); as det) { <div class="sub-cell" style="max-width: 220px;">{{ det }}</div> }
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

            <!-- ── Evidencias: qué imagen respalda cada etapa del equipo ── -->
            @case ('evid') {
              <p class="hint mb-2">
                Imágenes que respaldan cada etapa del equipo. Se muestran agrupadas por el proceso al
                que pertenecen; abrir una queda registrado en la trazabilidad.
              </p>
              @for (g of evidenciasEq(); track g.etapa + g.proceso) {
                <div class="card card-pad mt-2">
                  <div class="row-between" style="flex-wrap: wrap; gap: 8px;">
                    <b class="small">{{ g.etapa }} · <span class="mono">{{ g.proceso }}</span></b>
                    <span class="chip">
                      {{ g.lista.length }} {{ g.lista.length === 1 ? 'imagen adjunta' : 'imágenes adjuntas' }}
                    </span>
                  </div>
                  <ui-evidencias titulo="Ver evidencias" [lista]="g.lista"
                    (visualizar)="verEvidenciaEtapa(g, $event)" />
                </div>
              } @empty {
                <p class="small muted" style="text-align:center; padding: 22px;">
                  Este equipo todavía no tiene imágenes de evidencia en ninguna etapa.
                </p>
              }
            }

            <!-- ── Trazabilidad ── -->
            @case ('traza') {
              <p class="hint mb-2">
                Recorrido cronológico del equipo desde su ingreso hasta entrega, garantía o reproceso.
              </p>
              <ui-linea-tiempo [eventos]="lineaCompleta()" orden="asc" />
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

      <!-- Constancias: se consultan desde el historial técnico del equipo -->
      <ui-constancia-reproceso [idReproceso]="verConstancia()" (cerrado)="verConstancia.set('')" />
      <ui-constancia-correccion [idCorreccion]="verConstanciaCor()" (cerrado)="verConstanciaCor.set('')" />
    </div>
  `
})
export class TrazabilidadComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);

  /** Permite llegar con /trazabilidad?inventario=… (p. ej. desde Expediente único). */
  readonly inventario = input<string>();

  protected seleccion = signal('');
  /** Reproceso cuya constancia se está consultando desde el historial técnico. */
  protected verConstancia = signal('');
  /** Corrección F0302 por inconformidad cuya constancia se está consultando. */
  protected verConstanciaCor = signal('');
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
    // Ciclos de vida: la vista central del DER. Un equipo acumula ET y EU a lo largo de su vida,
    // y cada ciclo se lee por sus FK guardadas, nunca buscando el registro más reciente.
    { id: 'ciclos', nombre: 'Ciclos de vida' },
    { id: 'mov', nombre: 'Movimientos' },
    { id: 'ingresos', nombre: 'Ingresos a Hardware' },
    { id: 'f0288', nombre: 'Preparaciones F0288' },
    { id: 'f0302', nombre: 'Configuraciones F0302' },
    { id: 'asig', nombre: 'Asignaciones' },
    { id: 'gar', nombre: 'Garantía' },
    { id: 'docs', nombre: 'Documentos' },
    { id: 'evid', nombre: 'Evidencias' },
    { id: 'traza', nombre: 'Trazabilidad' },
    { id: 'descargos', nombre: 'Descargos' }
  ] as const;
  protected tab = signal<(typeof this.pestanas)[number]['id']>('resumen');

  /** Cuántos ciclos de vida acumula el equipo. Más de uno significa histórico que conservar. */
  protected ciclosDe(inventario: string): number {
    return this.data.expedientesTecnicosDeEquipo(inventario).length;
  }

  protected abrirTraza(inventario: string): void {
    const fila = this.filas().find((f) => f.equipo.inventario === inventario);
    if (fila) {
      this.fEvento.set('');
      this.tab.set('resumen');
      this.detalle.set(fila);
    }
  }

  /**
   * **Los ciclos de vida del equipo**, armados desde las FK del DER: cada ciclo trae su ET, su
   * F0288, el EU que ese ET habilitó y todo lo que colgó de él hasta la descarga que lo cerró.
   * Ninguno se deduce por fecha, así que el ciclo 1 sigue mostrando su preparación de entonces.
   */
  protected readonly ciclosEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.ciclosDeEquipo(d.equipo.inventario) : [];
  });
  /** Movimientos físicos del equipo (MOVIMIENTO_EQUIPO), del más reciente al más antiguo. */
  protected readonly movimientosEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.movimientosDeEquipo(d.equipo.inventario) : [];
  });
  /** Garantía de proveedor del equipo: existe desde la adquisición y no pertenece a ningún ciclo. */
  protected readonly garantiaProveedorEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.garantiaProveedorDeEquipo(d.equipo.inventario) : undefined;
  });

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

  /**
   * Imágenes de evidencia del equipo, agrupadas por la etapa que las produjo. Se recorren todos
   * los expedientes por los que pasó el equipo: un equipo puede tener varios ciclos, y el
   * historial técnico debe mostrarlos todos.
   */
  protected readonly evidenciasEq = computed(() => {
    const d = this.detalle();
    if (!d) return [];
    const expedientes = new Set<string>();
    for (const e of this.data.eventos().filter((x) => x.inventario === d.equipo.inventario)) {
      if (e.expediente) expedientes.add(e.expediente);
    }
    return [...expedientes].flatMap((exp) => this.data.evidenciasDelExpediente(exp));
  });

  protected verEvidenciaEtapa(g: { etapa: string; proceso: string; lista: { expediente: string }[] }, archivo: string): void {
    const u = this.auth.usuario();
    this.data.registrarConsultaEvidenciaTecnica(g.etapa as ModuloEvidencia, g.proceso,
      g.lista[0]?.expediente ?? '', archivo, `${u?.nombre} — ${u?.rol}`);
  }
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
        // F0302 con falla: la incidencia se atiende dentro del mismo Expediente técnico —corrección
        // de Soporte o reproceso F0288— y solo después se habilita el nuevo intento.
        acciones.push({ texto: 'Ver detalle de falla F0302', ruta: '/configuracion' });
        const incidencia = conf.falla?.estadoIncidencia ?? 'LISTO_PARA_REINTENTO_F0302';
        if (incidencia === 'LISTO_PARA_REINTENTO_F0302') {
          if (this.data.estadoPreparacionEquipo(inv) === 'Preparado') {
            acciones.push({ texto: 'Reintentar F0302', ruta: '/configuracion' });
          }
        } else if (conf.falla?.requiereReprocesoF0288) {
          acciones.push({ texto: 'Atender reproceso F0288', ruta: '/preparacion-tecnica' });
        } else {
          acciones.push({ texto: 'Registrar corrección de Soporte', ruta: '/configuracion' });
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
  /** Fallas F0302 = intentos que quedaron con falla. */
  protected readonly fallasF0302 = computed(() =>
    this.configuracionesEq().filter((c) => c.estado === 'Con falla').length
  );
  /**
   * Reprocesos F0288 del equipo. Llevan contador propio precisamente para que no se confundan con
   * las preparaciones ni inflen la cuenta de expedientes técnicos: son correcciones dentro de uno.
   */
  protected readonly reprocesosEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.reprocesosDeEquipo(d.equipo.inventario) : [];
  });

  /** Casos de garantía del equipo, con o sin revisión técnica de Hardware. */
  protected readonly casosGarantiaEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.casosGarantiaDeEquipo(d.equipo.inventario) : [];
  });

  /**
   * Ítems del F0302 de este equipo que quedaron como «No aplica», con su motivo. Se recorren todas
   * las configuraciones del equipo —no solo la vigente—: si un ciclo anterior dejó el Agente DLP
   * fuera, eso pertenece al historial del equipo tanto como lo que sí se hizo.
   */
  protected readonly noAplicaEq = computed(() => {
    const d = this.detalle();
    if (!d) return [];
    return this.data.configuraciones()
      .filter((c) => c.datos.inventario === d.equipo.inventario)
      .flatMap((c) => this.data.itemsNoAplicaF0302(c).map((item) => ({
        item, expediente: c.expediente, tecnico: c.tecnico,
        expedienteUnico: this.data.expedienteUnicoDe(c.expediente)?.codigoUnico ?? ''
      })));
  });

  /** Garantía vigente del equipo del detalle, con su tipo, sus fechas y sus modificaciones. */
  protected readonly garantiaEq = computed(() => {
    const d = this.detalle();
    if (!d) return undefined;
    return this.data.garantias().find((g) => g.inventario === d.equipo.inventario);
  });

  /**
   * Fichas del equipo en el inventario operativo de Controles: una por cada ciclo en el que
   * perteneció a una Dirección/Registro. Las descargadas se conservan — el descargo termina la
   * pertenencia, no borra que existió.
   */
  protected readonly controlesEq = computed(() => {
    const d = this.detalle();
    return d ? this.data.historialControlesDe(d.equipo.inventario) : [];
  });

  /** Revisión técnica de Hardware de un caso de garantía, si se generó. */
  protected revisionGarantia(caso: CasoGarantia) {
    return caso.revisionId ? this.data.reprocesoDe(caso.revisionId) : undefined;
  }

  /**
   * Inconformidades del usuario final atendidas sobre este equipo. Van junto a los reprocesos
   * porque son la otra puerta de entrada al mismo mecanismo de corrección.
   */
  protected readonly inconformidadesEq = computed(() => {
    const d = this.detalle();
    if (!d) return [];
    return this.data.correcciones()
      .filter((c) => c.inventario === d.equipo.inventario)
      .sort((a, b) => b.intentoNumero - a.intentoNumero);
  });

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

  // El dibujo de cada evento —icono, chips y detalle— vive ahora en `ui-linea-tiempo`, que es la
  // misma línea de tiempo para la vista por proceso y para el historial técnico del equipo.
}
