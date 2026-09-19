import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
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
                  <div class="datos mt-1">
                    <div><span>Equipo</span><b class="mono">{{ nuevo.inventario }}</b></div>
                    <div><span>Asignado a</span><b>{{ asignacionDeEu(nuevo)?.usuarioFinal || '—' }}</b></div>
                    <div><span>Técnico de Configuración</span><b>{{ tecnicoVigente(nuevo) || '—' }}</b></div>
                    <div><span>Estado</span><b>{{ nuevo.estado }}</b></div>
                  </div>
                  <p class="small muted">
                    Siguiente paso: el Técnico de Configuración inicia el F0302 desde su módulo.
                  </p>
                </div>
              </div>
              <div class="row mt-2">
                <a class="btn btn-gold" routerLink="/configuracion">Ir a Configuración F0302</a>
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
                  <p class="chk ok"><ui-icon name="check" [size]="14" /> Solicitud seleccionada</p>
                  <div class="datos">
                    <div><span>Solicitud</span><b class="mono">{{ p.expediente }}</b></div>
                    <div><span>Tipo</span><b>{{ p.tipoEquipo | tipoRequerimiento }}</b></div>
                    <div><span>Usuario final</span><b>{{ p.destinatario }} — {{ p.unidadDestino }}</b></div>
                    <div><span>Correo institucional</span><b>{{ p.correoDestinatario }}</b></div>
                    <div><span>Estado</span><b>{{ p.estado }}</b></div>
                  </div>
                  <button class="btn btn-ghost btn-sm mt-1" (click)="abrirBusquedaSol()">Cambiar solicitud</button>
                } @else {
                  <button class="btn btn-primary" (click)="abrirBusquedaSol()">Buscar solicitud / requerimiento</button>
                  <span class="hint">
                    <b>Todo Expediente único nace de una solicitud</b>: sin requerimiento no se abre
                    el ciclo, tampoco después de un reingreso a Hardware. El equipo se elige en el
                    paso 2 y la asignación al usuario final se registra después, ya con el
                    expediente creado.
                  </span>
                }
              </section>

              <!-- ── Paso 2: el equipo preparado con el que se abre el ciclo ──
                   El DER encadena ET PREPARADO → EXPEDIENTE_UNICO → ASIGNACION: el equipo se
                   elige aquí por su Expediente técnico, y la asignación al usuario final viene
                   después. Antes se tomaba de la asignación, que era justo el orden inverso. -->
              @if (!equipoProceso() && proceso()) {
                <section class="paso">
                  <h3 class="paso-t"><span class="n">2</span> Equipo preparado</h3>
                  <button class="btn btn-primary" (click)="buscarEquipoAbierto.set(true)">Buscar equipo preparado</button>
                  <span class="hint">
                    Solo equipos con su ciclo abierto, Expediente técnico <b>PREPARADO</b> y F0288
                    finalizado y firmado. Son los {{ equiposDisponibles().length }} que hoy pueden abrir un ciclo.
                  </span>
                </section>
              }
              @if (equipoProceso(); as e) {
                <section class="paso">
                  <h3 class="paso-t"><span class="n">2</span> Equipo preparado</h3>
                  <p class="chk ok"><ui-icon name="check" [size]="14" /> Equipo preparado, listo para abrir el ciclo</p>
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
                  <span class="hint">
                    El equipo abre el ciclo con su Expediente técnico. La asignación al usuario final
                    y la designación del técnico se registran junto con el expediente, en este mismo paso.
                  </span>
                  <button class="btn btn-ghost btn-sm mt-1" (click)="buscarEquipoAbierto.set(true)">Cambiar equipo</button>
                </section>
              }

              <!-- ── Paso 3: asignación ──
                   No se vuelve a preguntar quién recibe el equipo: el usuario final, su Dirección y
                   su área **salen de la solicitud**. Esto es lo que hacía innecesaria la pantalla
                   aparte de Asignación de equipo. -->
              @if (equipoProceso() && proceso(); as _) {
                <section class="paso">
                  <h3 class="paso-t"><span class="n">3</span> Asignación</h3>
                  <p class="chk ok"><ui-icon name="check" [size]="14" /> El usuario final sale de la solicitud; no se elige aparte</p>
                  <div class="datos">
                    <div><span>Usuario final</span><b>{{ proceso()?.destinatario }}</b></div>
                    <div><span>Correo institucional</span><b>{{ proceso()?.correoDestinatario }}</b></div>
                    <div><span>Equipo</span><b class="mono">{{ equipoProceso()?.inventario }}</b></div>
                    <div><span>Dirección / Registro</span><b>{{ dirUnidad().unidad || dirUnidad().direccion || '—' }}</b></div>
                    <div><span>Área</span><b>{{ areaTexto() }}</b></div>
                  </div>
                  <span class="hint">
                    La asignación se registra como entidad propia junto con el expediente, en el
                    orden del DER: primero el Expediente único, después la asignación.
                  </span>
                </section>
              }

              <!-- ── Paso 4: técnico de configuración ── -->
              @if (equipoProceso() && proceso()) {
                <section class="paso">
                  <h3 class="paso-t"><span class="n">4</span> Técnico de Configuración</h3>
                  @if (tecnicoConfig(); as t) {
                    <p class="chk ok"><ui-icon name="check" [size]="14" /> Técnico de configuración seleccionado</p>
                    <div class="datos">
                      <div><span>Técnico</span><b>{{ t.split('—')[0].trim() }}</b></div>
                      @if (cargaDe(t); as c) {
                        <div><span>Carga laboral</span><b>{{ c.carga }} · {{ c.total }} procesos activos</b></div>
                        <div><span>Direcciones/Registros atendidas</span><b>{{ c.direccionUnidad || '—' }}</b></div>
                        <div><span>Disponibilidad</span><b>{{ c.disponibilidad }}</b></div>
                      }
                    </div>
                    @if (cargaDe(t); as c) {
                      @if (c.nivel === 'Alta') {
                        <div class="alert warn mt-1"><span class="alert-ico">!</span><span>{{ data.MSG_CARGA_ALTA }}</span></div>
                      } @else {
                        <p class="small mt-1">{{ data.avisoCarga(c.nivel) }}</p>
                      }
                    }
                    <button class="btn btn-ghost btn-sm mt-1" (click)="abrirBusquedaTecnico()">Cambiar técnico</button>
                  } @else {
                    <button class="btn btn-primary" (click)="abrirBusquedaTecnico()">Seleccionar Técnico de Configuración</button>
                    <span class="hint">
                      Solo los Técnicos de Soporte responsables de {{ dirUnidadTexto() }}, según la
                      distribución vigente. Queda responsable del expediente; <b>el trabajo lo inicia
                      él</b> desde Configuración F0302.
                    </span>
                  }
                  @if (!tecnicosSoporte().length) {
                    <div class="alert warn mt-2">
                      <span class="alert-ico">!</span>
                      <span>
                        <b>{{ data.MSG_SIN_DISTRIBUCION }}</b>
                        <div>La distribución se edita en SISGOST — Controles Mensuales y este módulo la lee
                          automáticamente.</div>
                        @if (esEncSoporte()) {
                          <a class="btn btn-outline btn-sm mt-2" routerLink="/distribucion-soportes">Ir a Distribución de soportes</a>
                        }
                      </span>
                    </div>
                  }
                </section>
              }

              <!-- ── Paso 5: confirmación ── -->
              @if (equipoProceso() && proceso()) {
                <section class="paso">
                  <h3 class="paso-t"><span class="n">5</span> Confirmación</h3>

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
                      <div><span>Técnico de configuración</span><b>{{ tecnicoConfig().split('—')[0].trim() || 'Pendiente' }}</b></div>
                      <div><span>Ciclo del equipo</span><b class="mono">{{ expTecProceso()?.ciclo || '—' }}</b></div>
                    </div>
                  </div>

                  <div class="alert mt-2">
                    <span class="alert-ico">i</span>
                    <span>
                      <b>Un solo clic, tres hechos del DER.</b>
                      <div>Se crean, en este orden, el <b>Expediente único</b>, la <b>asignación</b> del
                        equipo al usuario final y la <b>designación</b> del Técnico de Configuración.
                        El checklist F0302 <b>no</b> se abre todavía: lo inicia el técnico desde su módulo.</div>
                    </span>
                  </div>

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
            @if (esEncSoporte()) {
              <button class="btn btn-ghost btn-sm" (click)="abrirEdicion(x)">
                <ui-icon name="edit" [size]="14" /> Editar Expediente único
              </button>
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
                  <!-- La solicitud origina el expediente, y nunca falta. -->
                  <dt>Solicitud que lo origina</dt>
                  <dd class="mono">{{ x.expediente }} <span class="chip">{{ solicitudDe(x)?.tipoEquipo | tipoRequerimiento }}</span></dd>
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

      <!-- ── Editar Expediente único ──
           Corregir no es reescribir: cada cambio deja el valor anterior, el nuevo, quién y por qué.
           Lo que se puede tocar depende de cuánto proceso hay encima, no del permiso. -->
      @if (editando(); as x) {
        <ui-modal titulo="Editar Expediente único" [sub]="x.codigoUnico + ' · ' + x.estado" (cerrar)="editando.set(null)">
          @if (permisos(); as perm) {
            @if (perm.motivo) {
              <div class="alert warn mb-2"><span class="alert-ico">!</span><span>{{ perm.motivo }}</span></div>
            }

            <h3 class="mb-2">Técnico de Configuración</h3>
            <p class="small muted">
              Vigente: <b>{{ tecnicoVigente(x) || 'sin designar' }}</b>.
              Reasignar <b>no borra</b> la designación anterior: queda cancelada en el histórico.
            </p>
            <div class="field mb-2">
              <label>Motivo de la reasignación <span class="req">*</span></label>
              <input class="control" [(ngModel)]="motivoEdicion" placeholder="Por qué cambia el técnico…" />
            </div>
            <button class="btn btn-primary btn-sm mb-3" [disabled]="!perm.tecnico || !motivoEdicion().trim()"
              (click)="abrirReasignacion(x)">Reasignar Técnico de Configuración</button>

            @if (historialTecnicos(x).length) {
              <div class="table-wrap mb-3">
                <table class="tbl">
                  <thead><tr><th>Designación</th><th>Técnico</th><th>Desde</th><th>Hasta</th><th>Estado</th><th>Motivo</th></tr></thead>
                  <tbody>
                    @for (a of historialTecnicos(x); track a.id) {
                      <tr>
                        <td class="mono main-cell">{{ a.id }}</td>
                        <td>{{ a.tecnico.split('—')[0].trim() }}</td>
                        <td class="mono">{{ a.fechaInicio }}</td>
                        <td class="mono">{{ a.fechaCierre || '—' }}</td>
                        <td><ui-badge [estado]="a.estado" /></td>
                        <td class="sub-cell">{{ a.motivo || '—' }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            }

            <h3 class="mb-2">Equipo asignado</h3>
            <p class="small muted">
              Actual: <b class="mono">{{ x.inventario }}</b> · expediente técnico
              <b class="mono">{{ x.expedienteTecnico }}</b>.
              @if (!perm.equipo) { Ya no puede sustituirse: la configuración está en marcha. }
            </p>
            @if (perm.equipo) {
              <div class="field mb-2">
                <label>Equipo de sustitución</label>
                <select class="control" [(ngModel)]="equipoCorreccion">
                  <option value="">Seleccione…</option>
                  @for (e of equiposDisponibles(); track e.inventario) {
                    <option [value]="e.inventario">{{ e.inventario }} — {{ e | marcaModelo }}</option>
                  }
                </select>
              </div>
              <button class="btn btn-outline btn-sm mb-3"
                [disabled]="!equipoCorreccion() || !motivoEdicion().trim()"
                (click)="corregirEquipo(x)">Sustituir equipo</button>
            }

            @if (asignacionDeEu(x); as a) {
              @if (a.modificaciones?.length) {
                <div class="table-wrap mb-3">
                  <table class="tbl">
                    <thead><tr><th>Fecha</th><th>Equipo anterior</th><th>Equipo nuevo</th><th>Motivo</th><th>Registró</th></tr></thead>
                    <tbody>
                      @for (m of a.modificaciones; track m.fecha + m.hora) {
                        <tr>
                          <td class="mono main-cell">{{ m.fecha }} {{ m.hora }}</td>
                          <td class="mono">{{ m.equipoAnterior }}</td>
                          <td class="mono">{{ m.equipoNuevo }}</td>
                          <td class="sub-cell">{{ m.motivo }}<div class="sub-cell">{{ m.observacion }}</div></td>
                          <td class="sub-cell">{{ m.encargado.split('—')[0].trim() }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
            }

            <h3 class="mb-2">Observación administrativa</h3>
            <div class="field mb-2">
              <textarea class="control" rows="2" [(ngModel)]="observacionEdicion"
                placeholder="Queda anotada en el expediente y en la trazabilidad…"></textarea>
            </div>
            <button class="btn btn-ghost btn-sm" [disabled]="!observacionEdicion().trim()"
              (click)="guardarObservacion(x)">Registrar observación</button>

            <p class="hint mt-3">
              La <b>solicitud</b> que origina el expediente no se cambia desde aquí: es su origen.
              Si se eligió la equivocada y no hay actividad posterior, el expediente se anula y se
              abre el correcto, dejando los dos en el histórico.
            </p>
          }
        </ui-modal>
      }

      <!-- Paso 2 · Equipos preparados: los que pueden abrir un ciclo (ET PREPARADO + F0288 firmado) -->
      @if (buscarEquipoAbierto()) {
        <ui-modal titulo="Buscar equipo preparado" sub="Ciclo abierto, Expediente técnico PREPARADO y F0288 finalizado y firmado" (cerrar)="buscarEquipoAbierto.set(false)">
          <div class="table-wrap">
            <table class="tbl">
              <thead>
                <tr><th>Inventario</th><th>Equipo</th><th>Ciclo</th><th>Expediente técnico</th><th>Técnico que preparó</th><th></th></tr>
              </thead>
              <tbody>
                @for (e of equiposDisponibles(); track e.inventario) {
                  <tr>
                    <td class="mono main-cell">{{ e.inventario }}</td>
                    <td>{{ e | marcaModelo }}<div class="sub-cell">{{ e.tipo === 'Desktop' ? 'CPU' : 'Laptop' }} · {{ e.condicion.toLowerCase() }}</div></td>
                    <td class="mono">{{ data.cicloAbiertoDeEquipo(e.inventario)?.ciclo }}</td>
                    <td class="mono">{{ data.cicloAbiertoDeEquipo(e.inventario)?.codigo }}</td>
                    <td class="sub-cell">{{ data.cicloAbiertoDeEquipo(e.inventario)?.tecnicoPreparacion?.split('—')?.[0]?.trim() }}</td>
                    <td style="text-align:right;">
                      <button class="btn btn-primary btn-sm" (click)="elegirEquipo(e.inventario)">Seleccionar</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="6" class="muted">
                    Ningún equipo está listo para abrir un ciclo. Hace falta un Expediente técnico
                    PREPARADO con su F0288 finalizado y firmado.
                  </td></tr>
                }
              </tbody>
            </table>
          </div>
        </ui-modal>
      }

      <!-- Paso 1 · Búsqueda de solicitudes -->
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
                      <a class="btn btn-outline btn-sm mt-2" routerLink="/solicitudes" (click)="buscarSolAbierto.set(false)">Ver solicitudes</a>
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
          [titulo]="designando() ? 'Reasignar Técnico de Configuración' : 'Seleccionar Técnico de Configuración'"
          [sub]="'Responsables de ' + dirUnidadTexto() + ', con su carga de trabajo'"
          nota="El Técnico de Configuración sale de la Distribución de Soportes: en San Salvador, el responsable de esa Dirección/Registro; en los demás departamentos, el responsable del Departamento completo. Quien no responde por el requerimiento no aparece en esta lista."
          [vacio]="data.MSG_SIN_DISTRIBUCION"
          [rutaVacio]="esEncSoporte() ? '/distribucion-soportes' : ''"
          [tecnicos]="tecnicosSoporte()"
          [seleccionado]="tecnicoConfig()"
          [expediente]="designando()?.expediente || procesoSel()"
          (seleccion)="seleccionarTecnico($event.nombreRol)"
          (cerrar)="cerrarSelectorTecnico()" />
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
  private readonly ruta = inject(ActivatedRoute);

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
  /**
   * Solicitud en curso. Llega del caso activo o del enlace `?solicitud=` con el que Solicitudes
   * manda aquí —antes mandaba a la pantalla de Asignación, que ya no existe—.
   */
  protected procesoSel = signal(
    (() => {
      const porEnlace = this.ruta.snapshot.queryParamMap.get('solicitud') ?? '';
      if (porEnlace && !this.data.expedienteUnicoDe(porEnlace)) return porEnlace;
      const activo = this.casoActivo.expediente();
      return activo && !this.data.expedienteUnicoDe(activo) ? activo : '';
    })()
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
   * Equipo elegido para abrir el ciclo. **Ya no viene de la asignación**: en el DER la ASIGNACION
   * cuelga del Expediente único (`EU → ASIGNACION`), así que exigir una asignación previa invertía
   * el orden. Aquí se elige un equipo **preparado** —su ET PREPARADO y su F0288 firmado— y la
   * asignación al usuario final se registra después, ya con el EU creado.
   */
  protected equipoSel = signal('');
  protected readonly equipoProceso = computed(() => {
    const inv = this.equipoSel()
      || this.proceso()?.equipoInventario
      || this.asigProceso()?.equipoInventario
      || '';
    return inv ? this.data.equipoDe(inv) : undefined;
  });
  /** El ET del ciclo **abierto** del equipo: es el único que puede habilitar un EU. */
  protected readonly expTecProceso = computed(() => {
    const e = this.equipoProceso();
    return e ? this.data.cicloAbiertoDeEquipo(e.inventario) : undefined;
  });
  /** Equipos preparados sin Expediente único: la lista del paso 2. */
  protected readonly equiposDisponibles = computed(() => {
    const enEdicion = this.editando();
    const tipo = enEdicion
      ? this.data.solicitud(enEdicion.expediente)?.tipoEquipo
      : this.proceso()?.tipoEquipo;
    const lista = this.data.equiposParaExpedienteUnico();
    // Un requerimiento de CPU no se abre con una laptop: se ofrece solo lo compatible.
    return tipo ? lista.filter((e) => e.tipo === tipo) : lista;
  });
  protected buscarEquipoAbierto = signal(false);
  protected readonly prepProceso = computed(() => {
    const t = this.expTecProceso();
    return t ? this.data.preparacionPorCodigo(t.codigo) : undefined;
  });

  /**
   * Tres pasos visibles, no seis. El expediente técnico y el F0288 no son un paso propio: se
   * completan al elegir el equipo preparado, así que se muestran como resultado del paso 2.
   */
  /** Área del usuario final según la solicitud: el nivel del DER al que pertenece la persona. */
  protected areaTexto(): string {
    const cadena = this.data.cadenaOrganizativaDeSolicitud(this.procesoSel());
    return cadena.areaCatalogo?.nombre ?? cadena.areaUnidad?.nombreEspecifico ?? '—';
  }

  protected readonly pasos = computed(() => [
    { lbl: 'Solicitud', done: !!this.proceso() },
    { lbl: 'Equipo preparado', done: !!this.equipoProceso() && this.expTecProceso()?.estado === 'Preparado' },
    { lbl: 'Asignación', done: !!this.proceso() && !!this.equipoProceso() },
    { lbl: 'Técnico de configuración', done: !!this.tecnicoConfig() },
    { lbl: 'Confirmación', done: this.puedeCrear() }
  ]);

  /**
   * Mismos requisitos de siempre, más los dos que ahora son explícitos: la solicitud debe traer su
   * equipo asignado (de ahí sale `equipoProceso`) y no puede tener ya un Expediente único.
   */
  /**
   * Lo que hace falta para abrir el ciclo, y **nada más**: equipo con su ciclo abierto PREPARADO y
   * su F0288 firmado. Ni asignación (viene después) ni Técnico de Configuración (viene después de
   * la asignación): las dos cosas se pedían aquí y adelantaban pasos del DER.
   */
  protected readonly puedeCrear = computed(() =>
    this.esEncSoporte() &&
    // La solicitud es condición, no alternativa: no hay expediente único sin ella.
    !!this.proceso() && !!this.proceso()?.correoDestinatario &&
    !!this.equipoProceso() && this.expTecProceso()?.estado === 'Preparado' && this.f0288Listo() &&
    !this.data.expedienteUnicoDe(this.procesoSel()) &&
    // El técnico se designa en el mismo paso: la creación registra también ASIGNACION_CONFIGURACION.
    !!this.tecnicoConfig() &&
    this.data.atiendeDireccionUnidad(this.tecnicoConfig(), this.dirUnidad().direccion, this.dirUnidad().unidad) &&
    !this.data.bloqueoExpedienteUnico(this.procesoSel(), '', this.equipoProceso()?.inventario ?? '')
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
    { lbl: 'Solicitud seleccionada', falta: 'seleccionar la solicitud que origina el ciclo', ok: !!this.proceso() },
    { lbl: 'Equipo preparado seleccionado', falta: 'elegir un equipo preparado', ok: !!this.equipoProceso() },
    { lbl: 'Expediente técnico completado', falta: 'un expediente técnico completado', ok: this.expTecProceso()?.estado === 'Preparado' },
    { lbl: 'F0288 firmado', falta: 'finalizar y firmar el F0288 del equipo', ok: this.f0288Listo() },
    { lbl: 'Ese Expediente técnico no tiene ya un Expediente único', falta: 'un ciclo sin expediente único previo',
      ok: !!this.expTecProceso() && !this.data.expedienteUnicoDeExpTecnico(this.expTecProceso()!.codigo) },
    { lbl: 'Técnico de configuración seleccionado', falta: 'seleccionar el Técnico de Configuración', ok: !!this.tecnicoConfig() },
    { lbl: 'El técnico responde por esa Dirección/Registro', falta: 'un técnico de la distribución de esa Dirección/Registro',
      ok: !!this.tecnicoConfig() && this.data.atiendeDireccionUnidad(this.tecnicoConfig(), this.dirUnidad().direccion, this.dirUnidad().unidad) }
  ]);

  /**
   * Qué falta, en una línea. Es el primer requisito sin cumplir: quien lo lee necesita saber qué
   * hacer ahora, no la norma entera.
   */
  protected falta(): string {
    if (this.puedeCrear()) return '';
    if (!this.esEncSoporte()) return 'Solo el Encargado de Soporte puede crear el Expediente único.';
    if (!this.proceso()) return this.data.MSG_SIN_SOLICITUD;
    if (this.data.expedienteUnicoDe(this.procesoSel())) return 'Esta solicitud ya tiene un Expediente único.';
    if (!this.equipoProceso()) {
      return 'Elija el equipo preparado con el que se abre este ciclo.';
    }
    if (!this.f0288Listo()) return 'El F0288 del equipo debe estar finalizado y firmado.';
    if (this.expTecProceso()?.estado !== 'Preparado') return 'El Expediente técnico del equipo aún no está PREPARADO.';
    if (!this.proceso()?.correoDestinatario) return 'La solicitud no tiene correo institucional del usuario final.';
    if (!this.tecnicoConfig()) return 'Seleccione el Técnico de Configuración.';
    return 'Revise las condiciones del ciclo.';
  }

  /** Elige el equipo preparado con el que se abrirá el ciclo. */
  protected elegirEquipo(inventario: string): void {
    this.equipoSel.set(inventario);
    this.buscarEquipoAbierto.set(false);
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
  protected readonly tecnicosSoporte = computed(() => {
    // Al designar, la Dirección sale del expediente (que puede no tener solicitud); al crear,
    // del requerimiento seleccionado.
    const eu = this.designando();
    if (eu) {
      const { direccion, unidad } = this.data.dirUnidadDeExpedienteUnico(eu);
      return this.data.tecnicosDeDireccionUnidadConCarga(direccion, unidad);
    }
    return this.procesoSel() ? this.data.tecnicosConfiguracionDe(this.procesoSel()) : [];
  });
  protected cargaDe(nombreRol: string) {
    return this.tecnicosSoporte().find((t) => t.nombreRol === nombreRol);
  }

  /** Dirección/Registro del requerimiento seleccionado, tal como se muestra en el paso 3. */
  protected readonly dirUnidad = computed(() => {
    const eu = this.designando();
    return eu ? this.data.dirUnidadDeExpedienteUnico(eu) : this.data.dirUnidadDeSolicitud(this.procesoSel());
  });
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

  /**
   * Expediente único al que se le está designando técnico. Cuando está puesto, el selector no
   * alimenta la creación del expediente —que ya no pide técnico— sino la designación posterior.
   */
  protected designando = signal<ExpedienteUnico | null>(null);

  protected asignacionDeEu(x: ExpedienteUnico) {
    return this.data.asignaciones().find((a) => a.expedienteUnico === x.codigoUnico);
  }

  /** Expediente cuya edición se retoma al cerrar el selector: dos modales apilados no se leen. */
  private volverAEditar = signal<string>('');

  /**
   * Abre el selector para **reasignar** el Técnico de Configuración de un expediente que ya lo
   * tiene. No existe «designar más tarde»: el técnico se elige antes de crear el expediente, y
   * esto es la corrección de ese dato, no un paso pendiente del flujo.
   */
  protected abrirReasignacion(x: ExpedienteUnico): void {
    this.designando.set(x);
    this.tecnicoConfig.set('');
    // El selector se abre solo: el modal de edición se aparta y vuelve al cerrarlo.
    if (this.editando()) {
      this.volverAEditar.set(x.codigoUnico);
      this.editando.set(null);
    }
    this.buscarTecnicoAbierto.set(true);
  }

  // ---------------------------------------------------------------- edición administrativa
  protected editando = signal<ExpedienteUnico | null>(null);
  protected motivoEdicion = signal('');
  protected equipoCorreccion = signal('');
  protected observacionEdicion = signal('');

  /** Qué admite corregir el expediente abierto, según cuánto proceso lleva encima. */
  protected readonly permisos = computed(() => {
    const x = this.editando();
    return x ? this.data.edicionPermitida(x.codigoUnico) : null;
  });

  protected abrirEdicion(x: ExpedienteUnico): void {
    this.editando.set(x);
    this.motivoEdicion.set('');
    this.equipoCorreccion.set('');
    this.observacionEdicion.set('');
  }

  protected tecnicoVigente(x: ExpedienteUnico): string {
    return this.data.asignacionConfiguracionVigente(x.codigoUnico)?.tecnico.split('—')[0].trim() ?? '';
  }
  /** Todas las designaciones del expediente, vigentes y canceladas: el histórico no se pierde. */
  protected historialTecnicos(x: ExpedienteUnico) {
    return this.data.asignacionesConfiguracionDe(x.codigoUnico);
  }

  protected corregirEquipo(x: ExpedienteUnico): void {
    const u = this.auth.usuario();
    const error = this.data.corregirEquipoDeExpedienteUnico(
      x.codigoUnico, this.equipoCorreccion(), this.motivoEdicion(), `${u?.nombre} — ${u?.rol}`);
    if (error) { this.toast.error('No se pudo sustituir el equipo', error); return; }
    this.toast.ok('Equipo sustituido', `${x.codigoUnico}: queda el registro del equipo anterior.`);
    this.editando.set(this.data.expedienteUnicoPorCodigo(x.codigoUnico) ?? null);
    this.equipoCorreccion.set('');
  }

  protected guardarObservacion(x: ExpedienteUnico): void {
    const u = this.auth.usuario();
    const error = this.data.observarExpedienteUnico(x.codigoUnico, this.observacionEdicion(), `${u?.nombre} — ${u?.rol}`);
    if (error) { this.toast.error('No se pudo registrar la observación', error); return; }
    this.toast.ok('Observación registrada', 'Queda en el expediente y en la trazabilidad.');
    this.observacionEdicion.set('');
  }

  protected cerrarSelectorTecnico(): void {
    this.buscarTecnicoAbierto.set(false);
    this.designando.set(null);
    const volver = this.volverAEditar();
    if (volver) {
      this.editando.set(this.data.expedienteUnicoPorCodigo(volver) ?? null);
      this.volverAEditar.set('');
    }
  }

  protected seleccionarTecnico(nombreRol: string): void {
    const objetivo = this.designando();
    if (objetivo) {
      // Designación posterior a la asignación: la valida y la ejecuta el servicio.
      const u = this.auth.usuario();
      const error = this.data.designarConfiguracion(
        objetivo.codigoUnico, nombreRol, `${u?.nombre} — ${u?.rol}`, this.motivoEdicion());
      if (error) {
        this.toast.error('No se pudo designar al Técnico de Configuración', error);
      } else {
        this.toast.ok('Técnico de Configuración designado',
          `${objetivo.codigoUnico}: ${nombreRol.split('—')[0].trim()} queda responsable; iniciará la configuración desde su módulo.`);
        this.motivoEdicion.set('');
      }
      this.cerrarSelectorTecnico();
      return;
    }
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
    // El equipo va explícito: el EU nace del ET del equipo. **Sin técnico de configuración**: ese
    // se designa después de la asignación, que es el orden del DER.
    const creado = this.data.crearExpedienteUnico(
      p.expediente, quien, this.equipoProceso()?.inventario ?? '', this.tecnicoConfig());
    if (creado) {
      this.toast.ok(`${creado.codigoUnico} creado`, 'Configuración F0302 habilitada.');
      this.detalle.set(creado);
      // La tarjeta de creación pasa a confirmación: lo creado y el paso que sigue, nada más.
      this.creado.set(creado);
      this.verDetalle.set(false);
      this.procesoSel.set('');
      this.equipoSel.set('');
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
