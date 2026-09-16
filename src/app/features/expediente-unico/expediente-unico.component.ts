import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { ExpedienteUnico } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent, TipoRequerimientoPipe } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';
import { ConstanciaReprocesoComponent } from '../../shared/constancia-reproceso';
import { ConstanciaCorreccionComponent } from '../../shared/constancia-correccion';
import { SelectorSoporteComponent } from '../../shared/selector-soporte.component';

/**
 * Expediente único: aquí se hace la unión entre la solicitud/requerimiento, el usuario final,
 * el equipo preparado, el expediente técnico y el F0288. Solo el Encargado de Soporte lo crea;
 * al crearse queda habilitada de inmediato la Configuración F0302.
 */
@Component({
  selector: 'app-expediente-unico',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, MarcaModeloPipe, ModalComponent, TipoRequerimientoPipe,
    ConstanciaReprocesoComponent, ConstanciaCorreccionComponent, IconComponent, SelectorSoporteComponent],
  styles: `
    .exp-card { cursor: pointer; transition: box-shadow .15s, border-color .15s; }
    .exp-card:hover { box-shadow: var(--shadow-2); border-color: var(--blue-500); }
    .exp-cod { font-family: var(--font-brand); font-size: 20px; color: var(--navy-900); }
    .exp-sel { border-color: var(--blue-500); box-shadow: 0 0 0 2px var(--blue-100); }
    .bloqueado { opacity: .55; pointer-events: none; }

    /* Proceso guiado: un paso por bloque, separados por una línea y no por tarjetas anidadas. */
    .crear { border-color: var(--gold-500); }
    .paso { padding: 16px 0; border-top: 1px solid var(--line); }
    .paso:first-of-type { padding-top: 4px; border-top: 0; }
    .paso-t { display: flex; align-items: center; gap: 9px; font-size: 14px; color: var(--navy-900); margin-bottom: 10px; }
    .paso-t .n {
      display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%;
      background: var(--navy-900); color: #fff; font-size: 12px; font-weight: 700;
    }
    /* Estado de cada requisito en una línea, en vez de un párrafo explicando la regla. */
    .chk { font-size: 13px; margin-top: 8px; display: flex; align-items: center; gap: 7px; }
    .chk.ok { color: var(--ok); }
    .chk.pend { color: var(--tx-3); }
    .chk b { color: var(--navy-900); }
    .datos { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 6px 20px; margin-top: 8px; }
    .datos span { display: block; font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .datos b { font-size: 13px; font-weight: 500; color: var(--navy-900); }
    .datos b + b { font-weight: 400; color: var(--tx-2); font-size: 12.5px; }
    .valida { margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--line); }
    .resumen { background: var(--surface-2); border-radius: var(--r-md); padding: 12px 16px; margin-top: 14px; }
    .resumen .r-t { font-size: 11px; font-weight: 700; letter-spacing: .07em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 4px; }
    /* Filtros rápidos del buscador de solicitudes. */
    .chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .chip-f {
      border: 1px solid var(--line-strong); background: var(--surface); color: var(--tx-2);
      border-radius: 999px; padding: 5px 13px; font-size: 12px; cursor: pointer;
    }
    .chip-f:hover { border-color: var(--blue-500); }
    .chip-f.on { background: var(--navy-900); border-color: var(--navy-900); color: #fff; }
    .det-fila { background: var(--surface-2); }
    .listo { display: flex; align-items: center; gap: 12px; font-size: 14px; }
    .listo-ico {
      display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%;
      background: var(--ok-bg); color: var(--ok); border: 1px solid var(--ok-line); font-size: 17px;
    }
    .cat-busq { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .cat-busq input[type='search'] { flex: 1 1 320px; font-size: 13.5px; padding: 10px 14px; }
    .cat-busq select { max-width: 190px; }
    .n-result { font-size: 12px; color: var(--tx-3); }
    .mini-cols { display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; }
    .mini-col h4 { font-size: 11px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--tx-3); margin-bottom: 6px; }
    .mini-item {
      display: block; width: 100%; text-align: left; border: 0; background: transparent; cursor: pointer;
      padding: 6px 4px; border-bottom: 1px solid var(--line); font-size: 12px; color: var(--tx-2);
    }
    .mini-item:hover { background: var(--surface-2); }
    .mini-item b { color: var(--navy-900); display: block; }
    .mini-item:last-child { border-bottom: 0; }
    .res-sel { border: 1px solid var(--gold-500); border-left: 5px solid var(--gold-500); }
    .res-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 8px 18px; margin-top: 10px; }
    .res-grid .d-k { font-size: 10.5px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; color: var(--tx-3); }
    .res-grid .d-v { font-size: 13px; color: var(--navy-900); margin-top: 1px; }
    tr.sel td { background: var(--blue-050); }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Proceso técnico</div>
          <h1>
            Expediente único
            <ui-help texto="El Expediente único une la solicitud, el usuario final, el equipo preparado, el expediente técnico, el F0288, el F0302, la entrega, la conformidad y la garantía. Es un contenedor digital del proceso." />
          </h1>
          <p class="page-sub">Consolidación del proceso técnico, configuración, entrega y garantía.</p>
        </div>
      </div>

      <!--
        Crear Expediente único: proceso guiado de tres pasos. Cada paso aparece cuando el anterior
        está resuelto, para que la pantalla muestre una decisión a la vez en lugar de todo junto.
      -->
      <div class="card mb-3 crear">
        <div class="card-head">
          <div>
            <h2>Crear Expediente único</h2>
            <p class="sub">Solicitud · Equipo preparado · Confirmación</p>
          </div>
          <ui-help texto="El Encargado de Soporte elige la solicitud y el equipo preparado; el expediente técnico, el F0288 y el técnico que preparó se completan solos a partir del equipo. Solo falta asignar al técnico de configuración." />
        </div>
        <div class="card-body">
          @if (!esEncSoporte()) {
            <p class="small muted mb-2">Solo el <b>Encargado de Soporte</b> crea el Expediente único. Su rol puede consultar el avance.</p>
          }

          <div [class.bloqueado]="!esEncSoporte()">
            @if (creado(); as nuevo) {
              <!-- Confirmación: lo creado y el único paso que sigue -->
              <div class="listo">
                <span class="listo-ico"><ui-icon name="check" [size]="18" /></span>
                <div>
                  Expediente único <b class="mono">{{ nuevo.codigoUnico }}</b> creado correctamente.
                  <p class="small muted">Configuración F0302 habilitada para {{ tecnicoConfigDe(nuevo) }}.</p>
                </div>
              </div>
              <div class="row mt-2">
                <button class="btn btn-gold" (click)="irAConfiguracion(nuevo)">Continuar a Configuración F0302</button>
                <button class="btn btn-ghost" (click)="creado.set(null)">Crear otro expediente único</button>
              </div>
            } @else {
              <div class="stepper mb-3">
                @for (paso of pasos(); track paso.lbl; let i = $index) {
                  <div class="step" [class.done]="paso.done" [class.now]="!paso.done && (i === 0 || pasos()[i - 1].done)">
                    <span class="dot">@if (paso.done) { <ui-icon name="check" [size]="12" /> } @else { {{ i + 1 }} }</span>
                    <span class="lbl">{{ paso.lbl }}</span>
                  </div>
                }
              </div>

              <!-- ── Paso 1: solicitud con equipo ya asignado ── -->
              <section class="paso">
                <h3 class="paso-t"><span class="n">1</span> Solicitud</h3>
                @if (proceso(); as p) {
                  <p class="chk" [class.ok]="!!asigProceso()" [class.pend]="!asigProceso()">
                    <ui-icon [name]="asigProceso() ? 'check' : 'clock'" [size]="14" />
                    {{ asigProceso() ? 'Solicitud con equipo asignado' : 'Solicitud sin equipo asignado' }}
                  </p>
                  <div class="datos">
                    <div><span>Solicitud</span><b class="mono">{{ p.expediente }}</b></div>
                    <div><span>Tipo</span><b>{{ p.tipoEquipo | tipoRequerimiento }}</b></div>
                    <div><span>Usuario final</span><b>{{ p.destinatario }} — {{ p.unidadDestino }}</b></div>
                    <div><span>Correo institucional</span><b>{{ p.correoDestinatario }}</b></div>
                    <div><span>Estado</span><b>{{ p.estado }}</b></div>
                  </div>
                  @if (!asigProceso()) {
                    <div class="alert warn mt-2">
                      <span class="alert-ico">!</span>
                      <span>Esta solicitud aún no tiene equipo asignado y no puede crear Expediente único.</span>
                    </div>
                    <a class="btn btn-outline btn-sm mt-1" routerLink="/asignacion">Ir a Asignación de equipo</a>
                  }
                  <button class="btn btn-ghost btn-sm mt-1" (click)="abrirBusquedaSol()">Cambiar solicitud</button>
                } @else {
                  <button class="btn btn-primary" (click)="abrirBusquedaSol()">Buscar solicitud / requerimiento</button>
                  <span class="hint">Solo aparecen solicitudes con un equipo preparado y asignado al usuario final.</span>
                }
              </section>

              <!-- ── Paso 2: el equipo llega de la asignación; aquí solo se revisa ── -->
              @if (equipoProceso(); as e) {
                <section class="paso">
                  <h3 class="paso-t"><span class="n">2</span> Equipo asignado</h3>
                  <p class="chk ok"><ui-icon name="check" [size]="14" /> Equipo preparado y asignado al usuario final</p>
                  <div class="datos">
                    <div><span>Inventario</span><b class="mono">{{ e.inventario }}</b></div>
                    <div><span>Tipo</span><b>{{ e.tipo === 'Desktop' ? 'CPU' : 'Laptop' }}</b></div>
                    <div><span>Marca / modelo</span><b>{{ e | marcaModelo }}</b></div>
                    <div><span>Estado de asignación</span><b>{{ estadoEquipo(e.inventario) }} · {{ data.estadoAsignacionEquipo(e.inventario) }}</b></div>
                  </div>
                  @if (expTecProceso(); as t) {
                    <p class="chk" [class.ok]="t.estado === 'Preparado'" [class.pend]="t.estado !== 'Preparado'">
                      <ui-icon [name]="t.estado === 'Preparado' ? 'check' : 'clock'" [size]="14" />
                      Expediente técnico <b class="mono">{{ t.codigo }}</b>
                      {{ t.estado === 'Preparado' ? 'completado' : '— ' + t.estado }}
                    </p>
                    <p class="chk" [class.ok]="f0288Listo()" [class.pend]="!f0288Listo()">
                      <ui-icon [name]="f0288Listo() ? 'check' : 'clock'" [size]="14" /> F0288 {{ textoF0288() }}
                    </p>
                    <div class="datos">
                      <div><span>Técnico de preparación</span><b>{{ t.tecnicoPreparacion.split('—')[0].trim() }}</b></div>
                      <div><span>Fecha de preparación</span><b class="mono">{{ prepProceso()?.fecha || t.fecha }}</b></div>
                    </div>
                  } @else {
                    <p class="chk pend"><ui-icon name="clock" [size]="14" /> Este equipo aún no tiene expediente técnico</p>
                  }
                  <span class="hint">El equipo viene de la asignación al usuario final; se cambia desde <a routerLink="/asignacion">Asignación de equipo</a>.</span>
                </section>
              }

              <!-- ── Paso 3: técnico de configuración y confirmación ── -->
              @if (equipoProceso()) {
                <section class="paso">
                  <h3 class="paso-t"><span class="n">3</span> Confirmación</h3>
                  @if (tecnicoConfig(); as t) {
                    <p class="chk ok"><ui-icon name="check" [size]="14" /> Técnico de configuración asignado</p>
                    <div class="datos">
                      <div><span>Técnico de configuración</span><b>{{ t }}</b></div>
                      @if (cargaDe(t); as c) {
                        <div><span>Carga laboral</span><b>{{ c.carga }} · {{ c.total }} procesos activos</b></div>
                        <div><span>Expedientes únicos activos</span><b>{{ c.expedientesUnicos }}</b></div>
                        <div><span>Configuraciones activas</span><b>{{ c.configuraciones }}</b></div>
                        <div><span>Correcciones pendientes</span><b>{{ c.correcciones }}</b></div>
                        <div><span>Inconformidades pendientes</span><b>{{ c.inconformidades }}</b></div>
                        <div><span>Casos de garantía asignados</span><b>{{ c.garantias }}</b></div>
                        <div><span>Direcciones/Registros asignadas</span><b>{{ c.direccionUnidad || '—' }}</b></div>
                        <div><span>Disponibilidad</span><b>{{ c.disponibilidad }}</b></div>
                      }
                    </div>
                    @if (cargaDe(t); as c) {
                      @if (c.nivel === 'Alta') {
                        <!-- §8: advierte, no bloquea; el botón de crear sigue habilitado -->
                        <div class="alert warn mt-1">
                          <span class="alert-ico">!</span>
                          <span>{{ data.MSG_CARGA_ALTA }}</span>
                        </div>
                      } @else {
                        <p class="small mt-1">{{ data.avisoCarga(c.nivel) }}</p>
                      }
                    }
                    <button class="btn btn-ghost btn-sm mt-1" (click)="abrirBusquedaTecnico()">Cambiar técnico</button>
                  } @else {
                    <button class="btn btn-primary" (click)="abrirBusquedaTecnico()">Seleccionar Técnico de Configuración</button>
                    <span class="hint">
                      Solo aparecen los Técnicos de Soporte responsables de {{ dirUnidadTexto() }},
                      con su carga laboral y disponibilidad.
                    </span>
                  }

                  <!-- Sin distribución no hay técnico posible: se dice aquí, no al pulsar el botón -->
                  @if (!tecnicosSoporte().length) {
                    <div class="alert warn mt-2">
                      <span class="alert-ico">!</span>
                      <span>
                        <!-- El texto sale del servicio: la regla y su enunciado no se duplican. -->
                        <b>{{ data.MSG_SIN_DISTRIBUCION }}</b>
                        <div>La distribución se edita en SISGOST — Controles Mensuales y este módulo la lee
                          automáticamente: en cuanto se asigne un responsable —a esta Dirección/Registro en San
                          Salvador, o al Departamento completo en el resto del país— aparecerá aquí sin recargar.</div>
                        @if (esEncSoporte()) {
                          <a class="btn btn-outline btn-sm mt-2" routerLink="/distribucion-soportes">Ir a Distribución de soportes</a>
                        }
                      </span>
                    </div>
                  }

                  <!-- Validaciones como checklist, no como párrafo -->
                  <div class="valida">
                    @for (v of validaciones(); track v.lbl) {
                      <p class="chk" [class.ok]="v.ok" [class.pend]="!v.ok">
                        <ui-icon [name]="v.ok ? 'check' : 'clock'" [size]="14" />
                        {{ v.ok ? v.lbl : 'Falta ' + v.falta }}
                      </p>
                    }
                  </div>

                  <div class="resumen">
                    <div class="r-t">Resumen para crear Expediente único</div>
                    <div class="datos">
                      <div><span>Solicitud</span><b class="mono">{{ proceso()?.expediente }}</b><b>{{ proceso()?.tipoEquipo | tipoRequerimiento }}</b></div>
                      <div><span>Usuario final</span><b>{{ proceso()?.destinatario }}</b><b>{{ proceso()?.correoDestinatario }}</b></div>
                      <div><span>Equipo</span><b class="mono">{{ equipoProceso()?.inventario }}</b><b>{{ equipoProceso()?.tipo === 'Desktop' ? 'CPU' : 'Laptop' }} · {{ equipoProceso()?.marca }} {{ equipoProceso()?.modelo }}</b></div>
                      <div><span>Expediente técnico</span><b class="mono">{{ expTecProceso()?.codigo || '—' }}</b><b>F0288 {{ textoF0288() }}</b></div>
                      <div><span>Técnico de preparación</span><b>{{ expTecProceso()?.tecnicoPreparacion?.split('—')?.[0]?.trim() || '—' }}</b></div>
                      <div><span>Técnico de configuración</span><b>{{ tecnicoConfig() || 'Pendiente' }}</b></div>
                      <div><span>Dirección solicitante</span><b>{{ dirUnidad().direccion || '—' }}</b></div>
                      <div><span>Unidad solicitante</span><b>{{ dirUnidad().unidad || '—' }}</b></div>
                    </div>
                  </div>

                  @if (bloqueo() === data.MSG_TECNICO_FUERA_DIRECCION) {
                    <div class="alert warn mt-2">
                      <span class="alert-ico">!</span>
                      <span>
                        <b>El Técnico de Configuración seleccionado no está asignado a la Dirección/Registro de este requerimiento.</b>
                        <div>Seleccione un técnico responsable de esa Dirección/Registro.</div>
                      </span>
                    </div>
                  }

                  <button class="btn btn-gold btn-lg mt-2" [disabled]="!puedeCrear()" (click)="crearUnico()">
                    Crear Expediente único
                  </button>
                  @if (falta(); as f) { <span class="hint">{{ f }}</span> }
                </section>
              }
            }
          </div>
        </div>
      </div>

      <!-- Catálogo de expedientes únicos: buscador + filtros + tabla compacta -->
      <div class="card mb-2">
        <div class="card-head">
          <div>
            <h2>Buscar Expediente único</h2>
            <p class="sub">
              @if (auth.esTecnico()) { Solo los expedientes donde usted participa }
              @else { Busque por expediente, solicitud, inventario o usuario final }
            </p>
          </div>
        </div>
        <div class="card-body">
          <div class="cat-busq">
            <input class="control" type="search"
              placeholder="Buscar por expediente, solicitud, inventario, nombre del equipo, IP reservada, usuario final o estado…"
              [(ngModel)]="qU" (ngModelChange)="mostrarU.set(6)" />
            <select class="control" [(ngModel)]="fAnioU" (ngModelChange)="mostrarU.set(6)">
              <option value="">Año: todos</option>
              @for (a of aniosU(); track a) { <option [value]="a">{{ a }}</option> }
            </select>
            <select class="control" [(ngModel)]="fEstadoU" (ngModelChange)="mostrarU.set(6)">
              <option value="">Estado: todos</option>
              @for (e of estadosU(); track e) { <option [value]="e">{{ e }}</option> }
            </select>
            <select class="control" [(ngModel)]="fTipoU" (ngModelChange)="mostrarU.set(6)">
              <option value="">Tipo de equipo: todos</option>
              <option value="Laptop">Laptop</option>
              <option value="Desktop">CPU / Desktop</option>
            </select>
            @if (qU() || fAnioU() || fEstadoU() || fTipoU()) {
              <button class="btn btn-ghost btn-sm" (click)="limpiarCatalogo()">Limpiar filtros</button>
            }
          </div>
          <p class="n-result mb-1">Se encontraron {{ filtradosU().length }} expedientes. Mostrando {{ visiblesU().length }}.</p>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr>
                  <th>Expediente</th><th>Solicitud</th><th>Inventario</th><th>Equipo</th>
                  <th>Usuario final</th><th>Fase actual</th><th>Estado</th><th>Garantía</th>
                  <th style="text-align:right;">Acción</th>
                </tr>
              </thead>
              <tbody>
                @for (x of visiblesU(); track x.codigoUnico) {
                  <tr [class.sel]="detalle()?.codigoUnico === x.codigoUnico">
                    <td class="mono main-cell">{{ x.codigoUnico }}</td>
                    <td>
                      <div class="mono">{{ x.expediente }}</div>
                      <div class="sub-cell">{{ solicitudDe(x)?.tipoEquipo | tipoRequerimiento }}</div>
                    </td>
                    <td class="mono">{{ solicitudDe(x)?.equipoInventario || '—' }}</td>
                    <td><div class="sub-cell" style="max-width: 180px;">{{ equipoDe(x) }}</div></td>
                    <td>{{ solicitudDe(x)?.destinatario || '—' }}</td>
                    <td>{{ faseDe(x) }}</td>
                    <td><ui-badge [estado]="x.estado" /></td>
                    <td>
                      @if (garantiaDe(x); as g) { <ui-badge [estado]="g.estado" /> } @else { <span class="muted">—</span> }
                    </td>
                    <td>
                      <div class="row" style="justify-content: flex-end;">
                        <button class="btn btn-primary btn-sm" (click)="seleccionar(x)">Ver detalle</button>
                      </div>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="9" class="muted" style="text-align:center; padding: 24px;">
                      @if (auth.esTecnico() && visibles().length === 0) {
                        No participa en ningún expediente único todavía. Aparecerán aquí cuando tenga tareas asignadas en un proceso.
                      } @else {
                        Ningún expediente único coincide con la búsqueda o los filtros aplicados.
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
          @if (filtradosU().length > visiblesU().length) {
            <div class="row mt-2" style="justify-content: center;">
              <button class="btn btn-outline" (click)="mostrarU.set(mostrarU() + 6)">Cargar más ({{ filtradosU().length - visiblesU().length }} restantes)</button>
            </div>
          }
        </div>
      </div>

      <!-- Últimos registros y accesos rápidos (respetan permisos por rol) -->
      @if (visibles().length > 0) {
        <div class="card card-pad mb-3">
          <div class="mini-cols">
            <div class="mini-col">
              <h4>Últimos expedientes creados</h4>
              @for (x of ultimosCreados(); track x.codigoUnico) {
                <button class="mini-item" (click)="seleccionar(x)"><b class="mono">{{ x.codigoUnico }}</b>{{ x.resumenEstado }}</button>
              } @empty { <p class="muted small">Sin registros.</p> }
            </div>
            <div class="mini-col">
              <h4>En configuración</h4>
              @for (x of enConfigU(); track x.codigoUnico) {
                <button class="mini-item" (click)="seleccionar(x)"><b class="mono">{{ x.codigoUnico }}</b>{{ solicitudDe(x)?.destinatario }}</button>
              } @empty { <p class="muted small">Ninguno en configuración.</p> }
            </div>
            <div class="mini-col">
              <h4>Pendientes de aceptación</h4>
              @for (x of pendAceptacionU(); track x.codigoUnico) {
                <button class="mini-item" (click)="seleccionar(x)"><b class="mono">{{ x.codigoUnico }}</b>{{ solicitudDe(x)?.destinatario }}</button>
              } @empty { <p class="muted small">Ninguno pendiente.</p> }
            </div>
            <div class="mini-col">
              <h4>En garantía</h4>
              @for (x of enGarantiaU(); track x.codigoUnico) {
                <button class="mini-item" (click)="seleccionar(x)"><b class="mono">{{ x.codigoUnico }}</b>{{ garantiaDe(x)?.estado }}</button>
              } @empty { <p class="muted small">Ninguno en garantía.</p> }
            </div>
          </div>
        </div>
      }

      <!-- Tarjeta resumen del expediente seleccionado -->
      @if (detalle(); as x) {
        <div class="card card-pad res-sel mb-2">
          <div class="row-between">
            <span class="exp-cod">{{ x.codigoUnico }}</span>
            <ui-badge [estado]="x.estado" />
          </div>
          <div class="res-grid">
            <div><div class="d-k">Fase actual</div><div class="d-v">{{ faseDe(x) }}</div></div>
            <div><div class="d-k">Equipo</div><div class="d-v">{{ equipoDe(x) }}</div></div>
            <div><div class="d-k">Inventario</div><div class="d-v mono">{{ solicitudDe(x)?.equipoInventario || '—' }}</div></div>
            <div><div class="d-k">Nombre del equipo</div><div class="d-v mono">{{ configDe(x)?.datos?.nombrePC || '—' }}</div></div>
            <div><div class="d-k">Reserva de IP</div><div class="d-v">{{ configDe(x)?.datos?.requiereReservaIP || '—' }}</div></div>
            <div><div class="d-k">IP reservada</div><div class="d-v mono">{{ data.textoIPReservada(configDe(x)) }}</div></div>
            @if (configDe(x)?.datos?.requiereReservaIP === 'Sí') {
              <div><div class="d-k">MAC del equipo</div><div class="d-v mono">{{ configDe(x)?.datos?.macEquipo || 'Sin registrar' }}</div></div>
              <div><div class="d-k">Solicitud de reserva de IP</div><div class="d-v">{{ data.textoEstadoSolicitudIP(configDe(x)) }}</div></div>
            } @else if (configDe(x)?.datos?.requiereReservaIP === 'No') {
              <div><div class="d-k">Justificación de no reserva</div><div class="d-v">{{ configDe(x)?.datos?.justificacionSinReservaIP || 'Sin registrar' }}</div></div>
            }
            <div><div class="d-k">Usuario final</div><div class="d-v">{{ solicitudDe(x)?.destinatario || '—' }}</div></div>
            <div><div class="d-k">Técnico de configuración</div><div class="d-v">{{ tecnicoConfigDe(x) }}</div></div>
            @if (fallaDe(x); as f) {
              <div><div class="d-k">Incidencia de configuración</div><div class="d-v">{{ data.textoEstadoIncidencia(f.estadoIncidencia) }}<div class="sub-cell">{{ f.tipo }}</div></div></div>
              <div>
                <div class="d-k">Reproceso F0288</div>
                <div class="d-v">{{ f.requiereReprocesoF0288 ? 'Sí' : 'No' }}
                  <div class="sub-cell mono">{{ f.reprocesoId || 'Sin reproceso' }} · Exp. técnico {{ expTecnicoDe(x) || '—' }}</div>
                </div>
              </div>
            }
            <div><div class="d-k">Última actualización</div><div class="d-v mono">{{ ultimaActualizacion(x) }}</div></div>
          </div>
          <div class="row mt-2">
            <button class="btn btn-primary btn-sm" (click)="verDetalle.set(!verDetalle())">{{ verDetalle() ? 'Ocultar detalle' : 'Ver detalle' }}</button>
            @if (!auth.esTecnico() && solicitudDe(x)?.equipoInventario) {
              <button class="btn btn-outline btn-sm" (click)="verTrazabilidad(x)">Ver trazabilidad</button>
            }
            <a class="btn btn-outline btn-sm" routerLink="/generador-documentos">Ver documentos</a>
            @if (garantiaDe(x)) {
              <a class="btn btn-outline btn-sm" routerLink="/garantia">Ver garantía</a>
            }
          </div>
        </div>
      }

      <!-- Vista ejecutiva del expediente seleccionado -->
      @if (detalle(); as x) {
        @if (verDetalle()) {
        <div class="card">
          <div class="card-head">
            <div>
              <h2>{{ x.codigoUnico }} — vista ejecutiva</h2>
              <p class="sub">Solicitud {{ x.expediente }} · {{ x.resumenEstado }}</p>
            </div>
            <div class="row">
              @if (x.estado === 'En configuración') {
                <a class="btn btn-primary" routerLink="/configuracion">Continuar a Configuración F0302</a>
              }
              <ui-badge [estado]="x.estado" />
            </div>
          </div>
          <div class="card-body">
            <div class="grid grid-2 mb-2">
              <div>
                <div class="sec-title">Datos generales</div>
                <dl class="dl">
                  <dt>Código único</dt><dd>{{ x.codigoUnico }}</dd>
                  <dt>Solicitud</dt><dd>{{ x.expediente }} · {{ solicitudDe(x)?.tipoEquipo | tipoRequerimiento }}</dd>
                  <!-- El EU guarda su equipo y su expediente técnico: no se deducen del equipo,
                       porque un equipo acumula varios ciclos y cada uno tiene los suyos. -->
                  <dt>Ciclo del equipo</dt>
                  <dd>
                    Ciclo {{ x.ciclo }}
                    <span class="chip">{{ x.fechaCierre ? 'Histórico · cerrado ' + x.fechaCierre : 'En curso' }}</span>
                  </dd>
                  <dt>Expediente técnico</dt>
                  <dd class="mono">{{ x.expedienteTecnico || '—' }} <span class="chip">Guardado en el expediente</span></dd>
                  <dt>Apertura</dt><dd>{{ x.fechaApertura || '—' }}</dd>
                  <dt>Estado</dt><dd>{{ x.resumenEstado }}</dd>
                  @if (x.fechaEntrega) { <dt>Fecha de entrega</dt><dd>{{ x.fechaEntrega }}</dd> }
                  @if (x.observaciones) { <dt>Observaciones</dt><dd>{{ x.observaciones }}</dd> }
                </dl>
              </div>
              <div>
                <div class="sec-title">Equipo y usuario final</div>
                <dl class="dl">
                  <dt>Equipo</dt><dd>{{ equipoDe(x) }}</dd>
                  <dt>Inventario</dt><dd class="mono">{{ x.inventario || solicitudDe(x)?.equipoInventario }}</dd>
                  <dt>Área del usuario final</dt>
                  <dd>{{ rutaOrganizativa(x) || '—' }}</dd>
                  <dt>Nombre del equipo</dt><dd class="mono">{{ configDe(x)?.datos?.nombrePC || '—' }}</dd>
                  <dt>Reserva de IP</dt><dd>{{ configDe(x)?.datos?.requiereReservaIP || '—' }}</dd>
                  <dt>IP reservada</dt><dd class="mono">{{ data.textoIPReservada(configDe(x)) }}</dd>
                  @if (configDe(x)?.datos?.requiereReservaIP === 'Sí') {
                    <dt>MAC del equipo</dt><dd class="mono">{{ configDe(x)?.datos?.macEquipo || 'Sin registrar' }}</dd>
                    <dt>Solicitud de reserva de IP</dt><dd>{{ data.textoEstadoSolicitudIP(configDe(x)) }}</dd>
                  } @else if (configDe(x)?.datos?.requiereReservaIP === 'No') {
                    <dt>Justificación de no reserva</dt><dd>{{ configDe(x)?.datos?.justificacionSinReservaIP || 'Sin registrar' }}</dd>
                  }
                  @if (fallaDe(x); as f) {
                    <dt>Falla detectada en F0302</dt>
                    <dd>{{ f.tipo }} — {{ f.descripcion }}
                      @if (data.resumenDetalleFalla(f); as det) { <div class="sub-cell">{{ det }}</div> }
                    </dd>
                    <dt>Estado de la incidencia</dt><dd>{{ data.textoEstadoIncidencia(f.estadoIncidencia) }}</dd>
                    <dt>¿Requiere reproceso F0288?</dt>
                    <dd>{{ f.requiereReprocesoF0288 ? 'Sí' : 'No' }} <span class="chip">Sugerencia del sistema: {{ f.sugerencia }}</span>
                      @if (f.justificacionReproceso) { <div class="sub-cell">Justificación: {{ f.justificacionReproceso }}</div> }
                    </dd>
                    <dt>Expediente técnico</dt>
                    <dd class="mono">{{ expTecnicoDe(x) || '—' }} <span class="chip">El mismo antes y después de la falla</span></dd>
                    @for (r of reprocesosDe(x); track r.id) {
                      <dt>Reproceso F0288 #{{ r.numero }}</dt>
                      <dd class="mono">{{ r.id }} · {{ r.estado }}
                        @if (r.correccionTecnica) { <div class="sub-cell">Corrección: {{ r.correccionTecnica }}</div> }
                        @if (data.constanciaDeReproceso(r.id); as d) {
                          <div class="sub-cell">
                            Constancia {{ d.codigo }} · {{ d.estado }}
                            <button class="btn btn-ghost btn-sm" (click)="verConstancia.set(r.id)">Ver documento</button>
                          </div>
                        } @else { <div class="sub-cell">Constancia pendiente de firma</div> }
                      </dd>
                    }
                    @if (f.correccionSoporte; as k) {
                      <dt>Corrección de Soporte</dt><dd>{{ k.descripcion }} <div class="sub-cell">{{ k.tecnico }} · {{ k.fecha }} {{ k.hora }}</div></dd>
                    }
                  }
                  @for (c of inconformidadesDe(x); track c.id) {
                    <dt>Inconformidad · intento #{{ c.intentoNumero }}</dt>
                    <dd>
                      {{ c.tipoProblema }} — resuelta como <b>{{ c.resolucion }}</b>
                      <div class="sub-cell">{{ c.observacionUsuario }}</div>
                      <div class="sub-cell mono">{{ c.id }}@if (c.reprocesoId) {  · {{ c.reprocesoId }}} · {{ c.estado }}</div>
                      @if (data.constanciaDeCorreccion(c.id); as d) {
                        <div class="sub-cell">
                          Constancia {{ d.codigo }} · {{ d.estado }}
                          <button class="btn btn-ghost btn-sm" (click)="verConstanciaCor.set(c.id)">Ver documento</button>
                        </div>
                      } @else if (c.resolucion === 'Corrección F0302') {
                        <div class="sub-cell">Constancia pendiente de firma</div>
                      }
                    </dd>
                  }
                  <dt>Usuario final</dt><dd>{{ solicitudDe(x)?.destinatario }} — {{ solicitudDe(x)?.unidadDestino }}</dd>
                  <dt>Correo institucional</dt><dd>{{ solicitudDe(x)?.correoDestinatario }}</dd>
                </dl>
              </div>
            </div>

            <div class="grid grid-2 mb-2">
              <div>
                <div class="sec-title">Responsables técnicos</div>
                <dl class="dl">
                  <dt>Asignó el equipo</dt><dd>{{ asignacionDe(x)?.responsableAsignacion || '—' }}</dd>
                  <dt>Preparación (F0288)</dt><dd>{{ asignacionDe(x)?.responsablesFase?.tecnicoPreparacion || '—' }}</dd>
                  <dt>Configuración (F0302)</dt><dd>{{ asignacionDe(x)?.responsablesFase?.tecnicoConfiguracion || '—' }}</dd>
                  <dt>Entrega</dt><dd>{{ asignacionDe(x)?.responsablesFase?.responsableEntrega || '—' }}</dd>
                </dl>
              </div>
              <div>
                <div class="sec-title">Documentos generados</div>
                @if (docsDe(x).length > 0) {
                  <dl class="dl">
                    @for (d of docsDe(x); track d.tipo + d.fecha) {
                      <dt>{{ d.tipo }}</dt><dd>{{ d.fecha }} · por {{ d.generadoPor }} · huella {{ d.hash }}</dd>
                    }
                  </dl>
                } @else {
                  <p class="muted small">Aún no se han generado documentos para este proceso.</p>
                }
              </div>
            </div>

            <!-- Reporte final de auditoría: antes era un módulo aparte; ahora vive aquí porque -->
            <!-- consolida exactamente lo mismo que ya se ve en este expediente único. -->
            <div class="card mt-2 mb-2">
              <div class="card-head">
                <div>
                  <h3>
                    Reporte final de auditoría
                    <ui-help texto="El reporte final consolida el expediente único completo y cierra el proceso. Requiere que el usuario final haya aceptado la recepción del equipo." />
                  </h3>
                  <p class="sub">Consolida el expediente completo y cierra la auditoría del proceso</p>
                </div>
                <ui-badge [estado]="reporteGenerado(x) ? 'Cerrado' : (x.estado === 'Aceptado' ? 'Pendiente' : 'No iniciada')" />
              </div>
              <div class="card-body">
                <div class="grid grid-2 mb-2">
                  <dl class="dl">
                    <dt>Conformidad</dt>
                    <dd>
                      @if (conformidadDe(x); as c) { <ui-badge [estado]="c.estado" /> <span class="small muted">· formulario externo {{ c.token }}</span> }
                      @else { <span class="muted">No enviada aún</span> }
                    </dd>
                  </dl>
                  <dl class="dl">
                    <dt>Garantía</dt>
                    <dd>
                      @if (garantiaDe(x); as g) {
                        <ui-badge [estado]="data.estadoDetalleGarantia(g)" />
                        <span class="small muted">· {{ g.tipoGarantia }}</span>
                        <div class="small muted">
                          Adquisición: <b>{{ g.fechaAdquisicion || 'sin registrar' }}</b> ·
                          Aceptación: <b>{{ g.fechaAceptacion }}</b> ·
                          Vigencia: <b>{{ g.fechaInicio || '—' }} → {{ g.fechaVencimiento || '—' }}</b>
                        </div>
                        <div class="small muted">Responsable: <b>{{ data.responsableGarantia(g) }}</b></div>
                        @if (data.ultimaModificacionGarantia(g); as m) {
                          <div class="small muted">
                            Modificada el {{ m.fecha }} por {{ m.usuario.split('—')[0].trim() }} ({{ m.rol }}): {{ m.motivo }}
                          </div>
                        }
                        @if (g.tipoGarantia === 'Garantía de proveedor' && g.fechaAdquisicion) {
                          <div class="small muted">La garantía del proveedor inicia en la adquisición, no en la aceptación.</div>
                        }
                      }
                      @else { <span class="muted">No iniciada</span> }
                    </dd>
                  </dl>
                </div>
                <div class="row-between">
                  <p class="small muted" style="max-width: 56ch;">
                    Al generar el reporte final, el expediente único queda cerrado y el proceso auditado de extremo a extremo. El expediente sigue disponible para registrar casos de garantía mientras esté vigente.
                    @if (!puedeGenerarReporte() && !reporteGenerado(x)) { <b> La generación corresponde al Encargado de Soporte.</b> }
                  </p>
                  @if (reporteGenerado(x)) {
                    <a class="btn btn-outline btn-sm" routerLink="/generador-documentos">Ver documento</a>
                  } @else {
                    <button class="btn btn-gold btn-lg" [disabled]="x.estado !== 'Aceptado' || !puedeGenerarReporte()" (click)="generarReporte(x)">
                      Generar reporte final
                    </button>
                  }
                </div>
              </div>
            </div>

            @if (x.estado === 'Aceptado' || x.estado === 'Cerrado') {
              <div class="alert ok mb-2">
                <span class="alert-ico"><ui-icon name="check" [size]="13" /></span>
                <span>El expediente permanece <b>disponible para registrar casos de garantía</b> después de la aceptación del usuario final.</span>
                <a class="btn btn-outline btn-sm" routerLink="/garantia" style="margin-left: auto;">Servicio de garantía</a>
              </div>
            }

            <details class="acc">
              <summary>Ver contenido del expediente ({{ x.anexos.length }} elementos) <span class="acc-arrow"><ui-icon name="chevron" [size]="13" /></span></summary>
              <div class="acc-body table-wrap">
                <table class="tbl">
                  <thead><tr><th>Elemento</th><th>Detalle</th><th>Estado</th><th>Fecha</th></tr></thead>
                  <tbody>
                    @for (a of x.anexos; track a.nombre) {
                      <tr>
                        <td class="main-cell">{{ a.nombre }}</td>
                        <td>{{ a.detalle }}</td>
                        <td><ui-badge [estado]="a.estado" /></td>
                        <td class="mono">{{ a.fecha || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </details>

            <details class="acc mt-1">
              <summary>Ver trazabilidad resumida <span class="acc-arrow"><ui-icon name="chevron" [size]="13" /></span></summary>
              <div class="acc-body">
                <div class="timeline">
                  @for (e of hitosDe(x); track $index) {
                    <div class="tl-item hito">
                      <div class="tl-when">{{ e.fecha }} · {{ e.hora }}</div>
                      <div class="tl-what">{{ e.accion }}</div>
                      <div class="tl-who">{{ e.usuario }}</div>
                    </div>
                  } @empty {
                    <p class="muted small">Sin hitos registrados.</p>
                  }
                </div>
              </div>
            </details>
          </div>
        </div>
        }
      }

      <!-- Paso 1 · Búsqueda de solicitudes: solo las que ya tienen equipo asignado -->
      @if (buscarSolAbierto()) {
        <ui-modal titulo="Buscar solicitud / requerimiento" sub="Solo solicitudes con equipo preparado y asignado al usuario final" (cerrar)="buscarSolAbierto.set(false)">
          <div class="field mb-2">
            <input class="control" type="search" placeholder="Código, tipo, usuario final, correo, inventario, estado o fecha…" [(ngModel)]="qSol" />
          </div>
          <div class="chips mb-2">
            @for (fx of filtrosSolicitud; track fx) {
              <button class="chip-f" [class.on]="fSol() === fx" (click)="fSol.set(fx)">{{ fx }}</button>
            }
          </div>
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Código</th><th>Tipo</th><th>Usuario final</th><th>Equipo asignado</th><th>Inventario</th><th>Asignación</th><th>F0288</th><th>Estado</th><th style="text-align:right;">Acción</th></tr>
              </thead>
              <tbody>
                @for (s of solicitudesFiltradas(); track s.expediente) {
                  <tr>
                    <td class="mono main-cell">{{ s.expediente }}</td>
                    <td>{{ s.tipoEquipo | tipoRequerimiento }}</td>
                    <td>{{ s.destinatario }}<div class="sub-cell">{{ s.correoDestinatario }}</div></td>
                    <td>{{ equipoAsignadoTexto(s.expediente) }}</td>
                    <td class="mono">{{ inventarioDe(s.expediente) }}</td>
                    <td><ui-badge estado="Asignado" /></td>
                    <td><ui-badge [estado]="estadoF0288De(inventarioDe(s.expediente))" /></td>
                    <td><ui-badge [estado]="s.estado" /></td>
                    <td>
                      <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                        <button class="btn btn-ghost btn-sm" (click)="detalleSol.set(detalleSol() === s.expediente ? '' : s.expediente)">
                          {{ detalleSol() === s.expediente ? 'Ocultar' : 'Ver detalle' }}
                        </button>
                        <button class="btn btn-primary btn-sm" (click)="seleccionarSolicitud(s.expediente)">Seleccionar</button>
                      </div>
                    </td>
                  </tr>
                  @if (detalleSol() === s.expediente) {
                    <tr>
                      <td colspan="9" class="det-fila">
                        <div class="datos">
                          <div><span>Requerimiento</span><b>{{ s.descripcion }}</b></div>
                          <div><span>Dirección / gerencia</span><b>{{ s.direccionGerencia }}</b></div>
                          <div><span>Carné</span><b class="mono">{{ s.carne }}</b></div>
                          <div><span>Expediente técnico</span><b class="mono">{{ expTecnicoDeSolicitud(s.expediente) }}</b></div>
                          <div><span>Técnico de preparación</span><b>{{ tecnicoPreparoDe(s.expediente) }}</b></div>
                          <div><span>Fecha de la solicitud</span><b class="mono">{{ s.fecha }}</b></div>
                        </div>
                      </td>
                    </tr>
                  }
                } @empty {
                  <tr><td colspan="9" class="muted" style="text-align:center; padding: 26px;">
                    @if (data.solicitudesParaExpedienteUnico().length) {
                      Ninguna solicitud coincide con la búsqueda.
                    } @else {
                      <b>No hay solicitudes disponibles para crear Expediente único.</b>
                      <div class="mt-1">Solo se muestran solicitudes que ya tienen un equipo preparado y asignado al usuario final.</div>
                      <a class="btn btn-outline btn-sm mt-2" routerLink="/asignacion" (click)="buscarSolAbierto.set(false)">Ir a Asignación de equipo</a>
                    }
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }

      <!-- Paso 3 · Selección del técnico de configuración, filtrada por la Dirección/Registro del requerimiento -->
      @if (buscarTecnicoAbierto()) {
        <app-selector-soporte
          titulo="Seleccionar Técnico de Configuración"
          [sub]="'Responsables de ' + dirUnidadTexto() + ', con su carga de trabajo'"
          nota="El Técnico de Configuración sale de la Distribución de Soportes: en San Salvador, el responsable de esa Dirección/Registro; en los demás departamentos, el responsable del Departamento completo. Quien no responde por el requerimiento no aparece en esta lista."
          [vacio]="data.MSG_SIN_DISTRIBUCION"
          [rutaVacio]="esEncSoporte() ? '/distribucion-soportes' : ''"
          [tecnicos]="tecnicosSoporte()"
          [seleccionado]="tecnicoConfig()"
          [expediente]="procesoSel()"
          (seleccion)="seleccionarTecnico($event.nombreRol)"
          (cerrar)="buscarTecnicoAbierto.set(false)" />
      }

      <!-- Constancias consultables desde el expediente único -->
      <ui-constancia-reproceso [idReproceso]="verConstancia()" (cerrado)="verConstancia.set('')" />
      <ui-constancia-correccion [idCorreccion]="verConstanciaCor()" (cerrado)="verConstanciaCor.set('')" />
    </div>
  `
})
export class ExpedienteUnicoComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly casoActivo = inject(CasoActivoService);
  private readonly router = inject(Router);

  /** Llega como query param desde Servicio de garantía («Ver expediente»). */
  readonly expediente = input<string>();

  protected detalle = signal<ExpedienteUnico | null>(
    this.data.expedientesUnicosVisibles().find((x) => x.expediente === this.casoActivo.expediente())
    ?? this.data.expedientesUnicosVisibles()[0]
    ?? null
  );

  /** Encargados: expedientes únicos globales; Técnico de Soporte: solo donde participa. */
  protected readonly visibles = computed(() => this.data.expedientesUnicosVisibles());

  // ---------- Catálogo con buscador, filtros y «Cargar más» ----------
  protected qU = signal('');
  protected fAnioU = signal('');
  protected fEstadoU = signal('');
  protected fTipoU = signal('');
  protected mostrarU = signal(6);
  protected verDetalle = signal(false);

  protected readonly aniosU = computed(() =>
    [...new Set(this.visibles().map((x) => x.codigoUnico.split('-')[1]).filter(Boolean))].sort().reverse()
  );
  protected readonly estadosU = computed(() =>
    [...new Set(this.visibles().map((x) => x.estado))].sort()
  );

  /**
   * Búsqueda dinámica del catálogo: expediente único, solicitud/requerimiento,
   * inventario, usuario final, correo, marca y modelo, estado, fase, técnico de
   * configuración y garantía (estado y casos).
   */
  protected readonly filtradosU = computed(() => {
    const q = this.qU().toLowerCase().trim();
    return this.visibles().filter((x) => {
      if (this.fAnioU() && x.codigoUnico.split('-')[1] !== this.fAnioU()) return false;
      if (this.fEstadoU() && x.estado !== this.fEstadoU()) return false;
      const s = this.solicitudDe(x);
      if (this.fTipoU() && s?.tipoEquipo !== this.fTipoU()) return false;
      if (!q) return true;
      const g = this.garantiaDe(x);
      const c = this.configDe(x);
      const texto = [
        x.codigoUnico, x.expediente, x.estado, x.resumenEstado, this.faseDe(x),
        s ? this.data.tipoRequerimientoTexto(s) : '', s?.equipoInventario, s?.destinatario, s?.correoDestinatario, s?.unidadDestino,
        // El expediente también se busca por el nombre del equipo, su IP reservada y su MAC.
        c?.datos.nombrePC, c?.datos.ipReservada, c?.datos.macEquipo,
        this.equipoDe(x), this.asignacionDe(x)?.responsablesFase?.tecnicoConfiguracion,
        g?.estado, ...(g?.casos.map((c) => c.codigo) ?? [])
      ].filter(Boolean).join(' ').toLowerCase();
      return texto.includes(q);
    });
  });
  protected readonly visiblesU = computed(() => this.filtradosU().slice(0, this.mostrarU()));

  protected limpiarCatalogo(): void {
    this.qU.set('');
    this.fAnioU.set('');
    this.fEstadoU.set('');
    this.fTipoU.set('');
    this.mostrarU.set(6);
  }

  /** «Ver detalle» del catálogo: muestra primero la tarjeta resumen del expediente. */
  protected seleccionar(x: ExpedienteUnico): void {
    this.detalle.set(x);
    this.verDetalle.set(false);
  }

  /** Fase actual del proceso, derivada del estado de la solicitud (o del expediente). */
  protected faseDe(x: ExpedienteUnico): string {
    const s = this.solicitudDe(x)?.estado ?? x.estado;
    const fases: Record<string, string> = {
      'Asignada': 'Asignación de equipo',
      'En configuración': 'Configuración F0302',
      'Pendiente de aceptación': 'Entrega y aceptación',
      'Entregado': 'Servicio de garantía',
      'No conforme': 'Revisión de inconformidad',
      'Cerrado': 'Auditoría cerrada'
    };
    return fases[s] ?? s;
  }

  protected tecnicoConfigDe(x: ExpedienteUnico): string {
    const t = this.asignacionDe(x)?.responsablesFase?.tecnicoConfiguracion;
    return t ? t.split('—')[0].trim() : '—';
  }

  protected ultimaActualizacion(x: ExpedienteUnico): string {
    const eventos = this.data.eventosDe(x.expediente);
    return eventos[eventos.length - 1]?.fecha ?? x.fechaEntrega ?? '—';
  }

  /** Abre Trazabilidad con el recorrido completo del equipo de este expediente. */
  protected verTrazabilidad(x: ExpedienteUnico): void {
    const inv = this.solicitudDe(x)?.equipoInventario;
    if (inv) this.router.navigate(['/trazabilidad'], { queryParams: { inventario: inv } });
  }

  // Últimos registros y accesos rápidos (sobre los expedientes visibles por rol)
  protected readonly ultimosCreados = computed(() => this.visibles().slice(0, 3));
  protected readonly enConfigU = computed(() =>
    this.visibles().filter((x) => x.estado === 'En configuración').slice(0, 3)
  );
  protected readonly pendAceptacionU = computed(() =>
    this.visibles().filter((x) => this.solicitudDe(x)?.estado === 'Pendiente de aceptación').slice(0, 3)
  );
  protected readonly enGarantiaU = computed(() =>
    this.visibles().filter((x) => {
      const g = this.garantiaDe(x);
      return !!g && (g.estado === 'Vigente' || g.estado === 'Caso abierto');
    }).slice(0, 3)
  );

  constructor() {
    // Entrar aquí es uno de los momentos en que la distribución debe releerse: puede haberse
    // editado en Controles Mensuales hace un segundo, en la otra pestaña. Y cambiar de usuario
    // cambia lo que ese usuario puede ver, así que también dispara la lectura.
    effect(() => {
      const quien = this.auth.usuario()?.usuario ?? '';
      this.data.sincronizarDistribucionCompartida(
        quien ? `entrada al Expediente único (${quien})` : 'entrada al Expediente único');
    });
    effect(() => {
      const id = this.expediente();
      const x = id ? this.data.expedienteUnicoDe(id) : undefined;
      if (x) this.detalle.set(x);
    });
    // Recuerda el último caso elegido aquí para sembrarlo en Configuración, Entrega y
    // Generador de documentos (sin forzar la selección: cada módulo sigue validando su rol).
    effect(() => {
      const d = this.detalle();
      if (d) this.casoActivo.seleccionar(d.expediente);
    });
  }

  // Creación (solo Encargado de Soporte)
  // Si el último caso activo (p. ej. recién asignado en Asignación de equipo) todavía no
  // tiene Expediente único, se precarga aquí para no tener que volver a buscarlo.
  protected procesoSel = signal(
    this.casoActivo.expediente() && !this.data.expedienteUnicoDe(this.casoActivo.expediente())
      ? this.casoActivo.expediente()
      : ''
  );
  protected tecnicoConfig = signal('');
  /** Buscadores de los pasos 1 y 3: el select largo se sustituyó por catálogos con detalle. */
  protected buscarSolAbierto = signal(false);
  protected qSol = signal('');
  protected fSol = signal('Todas');
  protected detalleSol = signal('');
  protected buscarTecnicoAbierto = signal(false);

  /**
   * Filtros rápidos del catálogo. Ya no hace falta uno de «Sin Expediente único» ni de
   * «Pendientes»: la lista solo trae solicitudes con equipo asignado y sin expediente, así que
   * ambos filtrarían cero.
   */
  protected readonly filtrosSolicitud = ['Todas', 'Requerimiento de CPU', 'Requerimiento de Laptop'];

  protected readonly esEncSoporte = computed(() => this.auth.usuario()?.clave === 'enc-soporte');

  protected readonly proceso = computed(() =>
    this.procesoSel() ? this.data.solicitud(this.procesoSel()) : undefined
  );
  protected readonly asigProceso = computed(() =>
    this.procesoSel() ? this.data.asignacionDe(this.procesoSel()) : undefined
  );
  /**
   * Equipo del proceso: siempre el de la asignación al usuario final. Ya no se busca a mano aquí
   * —el equipo del Expediente único es el que se asignó antes—, así que si la solicitud no tiene
   * asignación tampoco hay equipo que consolidar.
   */
  protected readonly equipoProceso = computed(() => {
    const asig = this.asigProceso();
    return asig ? this.data.equipoDe(asig.equipoInventario) : undefined;
  });
  protected readonly expTecProceso = computed(() => {
    const e = this.equipoProceso();
    return e ? this.data.expTecnicoDeEquipo(e.inventario) : undefined;
  });
  protected readonly prepProceso = computed(() => {
    const t = this.expTecProceso();
    return t ? this.data.preparacionPorCodigo(t.codigo) : undefined;
  });

  /**
   * Tres pasos visibles, no seis. El expediente técnico y el F0288 no son un paso propio: se
   * completan al elegir el equipo preparado, así que se muestran como resultado del paso 2.
   */
  protected readonly pasos = computed(() => [
    { lbl: 'Solicitud', done: !!this.proceso() },
    { lbl: 'Equipo asignado', done: !!this.equipoProceso() && this.expTecProceso()?.estado === 'Preparado' },
    { lbl: 'Confirmación', done: this.puedeCrear() }
  ]);

  /**
   * Mismos requisitos de siempre, más los dos que ahora son explícitos: la solicitud debe traer su
   * equipo asignado (de ahí sale `equipoProceso`) y no puede tener ya un Expediente único.
   */
  protected readonly puedeCrear = computed(() =>
    this.esEncSoporte() && !!this.proceso() && !!this.proceso()?.correoDestinatario &&
    !!this.asigProceso() && !!this.equipoProceso() && this.expTecProceso()?.estado === 'Preparado' &&
    !this.data.expedienteUnicoDe(this.procesoSel()) && !!this.tecnicoConfig() &&
    // El técnico elegido debe atender la Dirección/Registro del requerimiento: es la regla nueva y
    // la aplica el servicio, aquí solo se refleja para no ofrecer un botón que va a fallar.
    !this.data.bloqueoExpedienteUnico(this.procesoSel(), this.tecnicoConfig())
  );

  /** ¿El F0288 del equipo elegido está finalizado y firmado? */
  protected f0288Listo(): boolean {
    const prep = this.prepProceso();
    return prep?.estado === 'Completada' && prep?.firma?.estado === 'Firmado';
  }
  protected textoF0288(): string {
    const prep = this.prepProceso();
    if (!prep) return 'sin registrar';
    if (prep.estado !== 'Completada') return prep.estado.toLowerCase();
    return prep.firma?.estado === 'Firmado' ? 'finalizado y firmado' : 'finalizado, pendiente de firma';
  }

  /**
   * Los cinco requisitos como checklist, con el verbo de lo que falta. Sustituye al párrafo que
   * repetía la regla completa aunque solo faltara un dato.
   */
  protected readonly validaciones = computed(() => [
    { lbl: 'Solicitud con equipo asignado', falta: 'seleccionar una solicitud con equipo asignado', ok: !!this.proceso() && !!this.asigProceso() },
    { lbl: 'Equipo preparado', falta: 'que el equipo esté preparado', ok: !!this.equipoProceso() },
    { lbl: 'Expediente técnico completado', falta: 'un expediente técnico completado', ok: this.expTecProceso()?.estado === 'Preparado' },
    { lbl: 'F0288 firmado', falta: 'finalizar y firmar el F0288 del equipo', ok: this.f0288Listo() },
    { lbl: 'Técnico de configuración asignado', falta: 'asignar técnico de configuración', ok: !!this.tecnicoConfig() },
    // El técnico no basta con que exista: debe atender la Dirección/Registro del requerimiento.
    { lbl: 'Técnico responsable de la Dirección/Registro', falta: 'un técnico de la distribución de soporte de esa Dirección/Registro',
      ok: !!this.tecnicoConfig() && this.data.atiendeDireccionUnidad(this.tecnicoConfig(), this.dirUnidad().direccion, this.dirUnidad().unidad) }
  ]);

  /**
   * Qué falta, en una línea. Es el primer requisito sin cumplir: quien lo lee necesita saber qué
   * hacer ahora, no la norma entera.
   */
  protected falta(): string {
    if (this.puedeCrear()) return '';
    if (!this.esEncSoporte()) return 'Solo el Encargado de Soporte puede crear el Expediente único.';
    if (!this.proceso()) return 'Seleccione la solicitud.';
    if (this.data.expedienteUnicoDe(this.procesoSel())) return 'Esta solicitud ya tiene un Expediente único.';
    if (!this.asigProceso() || !this.equipoProceso()) {
      return 'Esta solicitud aún no tiene equipo asignado y no puede crear Expediente único.';
    }
    if (!this.proceso()?.correoDestinatario) return 'La solicitud no tiene correo institucional del usuario final.';
    if (this.expTecProceso()?.estado !== 'Preparado') return 'El expediente técnico del equipo aún no está completado (F0288).';
    return 'Asigne al técnico de configuración.';
  }

  /** Estado de preparación del equipo, para mostrarlo junto a los datos autocompletados. */
  protected estadoEquipo(inventario: string): string {
    return this.data.estadoPreparacionEquipo(inventario);
  }

  /** Expediente único recién creado: la pantalla pasa a confirmación y al paso siguiente. */
  protected creado = signal<ExpedienteUnico | null>(null);

  /** Deja el caso activo sembrado y abre Configuración F0302, que es lo que sigue. */
  protected irAConfiguracion(x: ExpedienteUnico): void {
    this.casoActivo.seleccionar(x.expediente);
    this.router.navigate(['/configuracion']);
  }

  /**
   * Técnicos elegibles del paso 3: solo los responsables de la Dirección/Registro del requerimiento
   * seleccionado, con su carga. Sin requerimiento seleccionado la lista está vacía a propósito —
   * la Dirección/Registro la pone el requerimiento, no el Encargado.
   */
  protected readonly tecnicosSoporte = computed(() =>
    this.procesoSel() ? this.data.tecnicosConfiguracionDe(this.procesoSel()) : []);
  protected cargaDe(nombreRol: string) {
    return this.tecnicosSoporte().find((t) => t.nombreRol === nombreRol);
  }

  /** Dirección/Registro del requerimiento seleccionado, tal como se muestra en el paso 3. */
  protected readonly dirUnidad = computed(() => this.data.dirUnidadDeSolicitud(this.procesoSel()));
  protected dirUnidadTexto(): string {
    const { direccion, unidad } = this.dirUnidad();
    if (!direccion && !unidad) return 'la Dirección/Registro del requerimiento';
    return direccion === unidad ? direccion : `${direccion} / ${unidad}`;
  }
  /** Motivo por el que hoy no se puede crear el Expediente único; '' si se puede. */
  protected readonly bloqueo = computed(() =>
    this.procesoSel() ? this.data.bloqueoExpedienteUnico(this.procesoSel(), this.tecnicoConfig()) : '');

  /**
   * Catálogo de solicitudes del paso 1: solo las que ya tienen equipo asignado al usuario final,
   * con su preparación terminada y sin Expediente único. El filtro vive en el servicio; aquí solo
   * se busca y se separa por tipo de requerimiento.
   */
  protected readonly solicitudesFiltradas = computed(() => {
    const q = this.qSol().toLowerCase().trim();
    const filtro = this.fSol();
    return this.data.solicitudesParaExpedienteUnico().filter((s) => {
      if (filtro === 'Requerimiento de CPU' && s.tipoEquipo !== 'Desktop') return false;
      if (filtro === 'Requerimiento de Laptop' && s.tipoEquipo !== 'Laptop') return false;
      if (!q) return true;
      return [s.expediente, this.data.tipoRequerimientoTexto(s), s.destinatario, s.correoDestinatario,
        s.unidadDestino, s.estado, s.fecha, s.descripcion, this.inventarioDe(s.expediente),
        this.equipoAsignadoTexto(s.expediente), this.expTecnicoDeSolicitud(s.expediente)]
        .filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  });

  /** Datos del equipo ya asignado a la solicitud, para las columnas del catálogo. */
  protected inventarioDe(id: string): string {
    return this.data.asignacionDe(id)?.equipoInventario ?? '';
  }
  protected equipoAsignadoTexto(id: string): string {
    const e = this.data.equipoDe(this.inventarioDe(id));
    return e ? `${e.marca} ${e.modelo}` : '—';
  }
  /** ET de una solicitud: por su EU si ya existe; si no, el ciclo abierto del equipo asignado. */
  protected expTecnicoDeSolicitud(id: string): string {
    return this.data.expTecnicoDe(id)?.codigo ?? '—';
  }
  protected tecnicoPreparoDe(id: string): string {
    const t = this.data.expTecnicoDeEquipo(this.inventarioDe(id));
    return t ? t.tecnicoPreparacion.split('—')[0].trim() : '—';
  }

  /** Estado del F0288 del equipo, tal como se muestra en el buscador y en el resumen. */
  protected estadoF0288De(inventario: string): string {
    const tec = this.data.expTecnicoDeEquipo(inventario);
    const prep = tec ? this.data.preparacionPorCodigo(tec.codigo) : undefined;
    return prep?.estado || 'Sin registrar';
  }

  protected abrirBusquedaSol(): void {
    this.qSol.set('');
    this.fSol.set('Todas');
    this.detalleSol.set('');
    this.buscarSolAbierto.set(true);
  }

  protected seleccionarSolicitud(id: string): void {
    this.procesoSel.set(id);
    this.buscarSolAbierto.set(false);
    // Otra Dirección/Registro, otros responsables: se relee antes de volver a ofrecer técnicos.
    this.data.sincronizarDistribucionCompartida('cambio de Dirección/Registro del requerimiento');
    // Cambiar de requerimiento cambia la Dirección/Registro y, con ella, quiénes pueden configurar:
    // conservar la selección anterior dejaría elegido a un técnico que ya no es responsable.
    this.tecnicoConfig.set('');
  }

  /**
   * Abrir el selector relee la distribución antes de dibujar la lista: es el punto exacto donde
   * se decide quién puede configurar, y donde más caro sale mostrar una lista vieja.
   */
  protected abrirBusquedaTecnico(): void {
    this.data.sincronizarDistribucionCompartida('apertura del selector de Técnico de Configuración');
    // Queda trazado con qué regla territorial se armó la lista, no solo que se abrió (§32).
    if (this.procesoSel()) this.data.registrarFiltroTecnicoConfiguracion(this.procesoSel());
    this.buscarTecnicoAbierto.set(true);
  }

  protected seleccionarTecnico(nombreRol: string): void {
    this.tecnicoConfig.set(nombreRol);
    this.buscarTecnicoAbierto.set(false);
  }

  protected crearUnico(): void {
    const p = this.proceso();
    if (!this.esEncSoporte()) {
      this.toast.error('Acción no permitida', 'Solo el Encargado de Soporte crea el Expediente único.');
      return;
    }
    if (!p || !this.puedeCrear()) {
      // La Dirección/Registro tiene su propio mensaje: decir «falta un dato» cuando el problema es
      // que el técnico no atiende esa Dirección/Registro no explica qué hacer.
      const bloqueo = this.bloqueo();
      if (bloqueo === this.data.MSG_TECNICO_FUERA_DIRECCION || bloqueo === this.data.MSG_SIN_DISTRIBUCION) {
        this.toast.error('No se puede crear el Expediente único', bloqueo);
        return;
      }
      this.toast.warn('Falta un dato', this.falta());
      return;
    }
    const u = this.auth.usuario();
    const quien = `${u?.nombre} — ${u?.rol}`;
    // El equipo ya viene de la asignación al usuario final: esta pantalla ya no la registra.
    const creado = this.data.crearExpedienteUnico(p.expediente, this.tecnicoConfig(), quien);
    if (creado) {
      this.toast.ok(`${creado.codigoUnico} creado`, 'Configuración F0302 habilitada.');
      this.detalle.set(creado);
      // La tarjeta de creación pasa a confirmación: lo creado y el paso que sigue, nada más.
      this.creado.set(creado);
      this.verDetalle.set(false);
      this.procesoSel.set('');
      this.tecnicoConfig.set('');
    } else {
      this.toast.error('No fue posible crear el Expediente único', 'Verifique el equipo preparado y los datos del proceso.');
    }
  }

  protected solicitudDe(x: ExpedienteUnico) { return this.data.solicitud(x.expediente); }
  /** Falla del último intento F0302 con falla del proceso, si la hubo. */
  protected fallaDe(x: ExpedienteUnico) { return this.data.fallaVigenteDe(x.expediente); }
  /** Expediente técnico del equipo: no cambia por una falla en F0302. */
  /**
   * Expediente técnico de este Expediente único: **el que el EU guarda**, no el que el equipo
   * tenga hoy. Un equipo con dos ciclos tiene dos ET, y un expediente cerrado debe seguir
   * mostrando el suyo.
   */
  /**
   * «Karla Rivas · Inscripción y Registro · Registro de la Propiedad Raíz e Hipotecas · San
   * Salvador · Zona Central»: el lugar del usuario final en la organización, según el DER.
   */
  protected rutaOrganizativa(x: ExpedienteUnico): string {
    return this.data.territorio.rutaOrganizativa(this.data.cadenaOrganizativaDeSolicitud(x.expediente));
  }
  protected expTecnicoDe(x: ExpedienteUnico): string {
    if (x.expedienteTecnico) return x.expedienteTecnico;
    const inv = x.inventario || (this.solicitudDe(x)?.equipoInventario ?? '');
    return inv ? (this.data.cicloAbiertoDeEquipo(inv)?.codigo ?? '') : '';
  }
  /** Reproceso cuya constancia se consulta desde el expediente único. */
  protected verConstancia = signal('');
  /** Corrección F0302 por inconformidad cuya constancia se consulta. */
  protected verConstanciaCor = signal('');
  protected reprocesosDe(x: ExpedienteUnico) {
    return this.data.reprocesos().filter((r) => r.expediente === x.expediente).sort((a, b) => a.numero - b.numero);
  }
  /** Inconformidades del usuario final registradas sobre este expediente. */
  protected inconformidadesDe(x: ExpedienteUnico) {
    return this.data.correccionesDe(x.expediente);
  }
  /** Configuración F0302 del proceso: aporta el nombre del equipo y la reserva de IP al expediente. */
  protected configDe(x: ExpedienteUnico) { return this.data.configuracionDe(x.expediente); }
  protected asignacionDe(x: ExpedienteUnico) { return this.data.asignacionDe(x.expediente); }
  protected docsDe(x: ExpedienteUnico) { return this.data.documentosDe(x.expediente); }
  protected hitosDe(x: ExpedienteUnico) { return this.data.eventosDe(x.expediente).filter((e) => e.hito); }
  protected conformidadDe(x: ExpedienteUnico) { return this.data.conformidades().find((c) => c.expediente === x.expediente); }
  protected garantiaDe(x: ExpedienteUnico) { return this.data.garantiaDe(x.expediente); }
  protected reporteGenerado(x: ExpedienteUnico): boolean {
    return this.docsDe(x).some((d) => d.tipo === 'Reporte final');
  }

  /** El Reporte final lo gestiona el Encargado de Soporte (o el Administrador). */
  protected readonly puedeGenerarReporte = computed(() => {
    const c = this.auth.usuario()?.clave;
    return c === 'enc-soporte' || c === 'admin';
  });

  protected generarReporte(x: ExpedienteUnico): void {
    if (!this.puedeGenerarReporte()) {
      this.toast.error('Acción no permitida', 'El Reporte final lo genera el Encargado de Soporte.');
      return;
    }
    const u = this.auth.usuario();
    if (this.data.generarReporteFinal(x.expediente, `${u?.nombre} — ${u?.rol}`)) {
      this.toast.ok('Reporte final generado', 'El expediente único quedó cerrado; la auditoría del proceso está completa.');
      const actualizado = this.data.expedienteUnicoDe(x.expediente);
      if (actualizado) this.detalle.set(actualizado);
    } else {
      this.toast.error('No es posible generar el reporte final', 'El usuario final debe haber aceptado la recepción del equipo (conformidad).');
    }
  }
  protected equipoDe(x: ExpedienteUnico): string {
    const s = this.solicitudDe(x);
    const eq = s ? this.data.equipoDe(s.equipoInventario) : undefined;
    return eq ? `${eq.marca} ${eq.modelo} · ${eq.tipo === 'Desktop' ? 'CPU' : 'Laptop'} ${eq.condicion.toLowerCase()}` : '—';
  }
}
