import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import {
  CargaSoporte, CasoGarantia, Garantia, ReprocesoF0288, RespuestaSiNo, TipoComentarioCaso, TipoGarantia
} from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { EvidenciasComponent } from '../../shared/evidencias';
import { SelectorSoporteComponent } from '../../shared/selector-soporte.component';

/**
 * Servicio de garantía: los Expedientes únicos aceptados por el usuario final aparecen aquí
 * automáticamente (nadie los registra a mano). Cada caso se asocia al Expediente único y un
 * expediente puede tener varios casos.
 */
@Component({
  selector: 'app-garantia',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent, EvidenciasComponent,
    SelectorSoporteComponent],
  styles: `
    .exp-cod { font-family: var(--font-mono, monospace); font-size: 12.5px; font-weight: 700; color: var(--navy-900); }
    .caso { border: 1px solid var(--line); border-radius: var(--r-md); padding: 12px 14px; margin-top: 10px; }
    .caso .c-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .caso .c-cod { font-family: var(--font-mono, monospace); font-size: 12.5px; font-weight: 700; color: var(--navy-900); }
    .caso .c-motivo { font-size: 13px; font-weight: 500; color: var(--navy-900); }
    .caso .c-fechas { margin-left: auto; font-size: 11.5px; color: var(--tx-3); }
    .caso .c-desc { font-size: 12.5px; color: var(--tx-2); margin-top: 6px; }
    .resultado { border-left: 3px solid var(--ok); background: var(--ok-bg); padding: 9px 13px; border-radius: 0 10px 10px 0; font-size: 12.5px; margin-top: 8px; }
    .c-com { border-top: 1px dashed var(--line); margin-top: 10px; padding-top: 9px; }
    .c-com-head { display: flex; align-items: center; gap: 10px; }
    .c-com-head b { font-size: 12px; color: var(--navy-900); }
    .c-com-head .btn { margin-left: auto; }
    .com-item { border-left: 2px solid var(--line-strong); padding: 4px 0 4px 12px; margin-top: 8px; }
    .com-meta { font-size: 11.5px; color: var(--tx-3); display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
    .com-meta b { color: var(--navy-900); font-weight: 600; }
    .com-tipo {
      font-size: 10.5px; font-weight: 700; letter-spacing: .04em; color: var(--gold-600);
      border: 1px solid var(--gold-500); border-radius: 999px; padding: 1px 8px;
    }
    .com-text { font-size: 12.5px; color: var(--tx-2); margin-top: 3px; }
    .g-fechas { display: flex; gap: 18px; align-items: center; margin: 4px 0 10px; font-size: 12.5px; color: var(--tx-2); flex-wrap: wrap; }
    .g-fechas b { color: var(--navy-900); }
    tr.sel td { background: var(--blue-050); }
    .g-tipo { font-size: 11.5px; font-weight: 700; color: var(--gold-600); letter-spacing: .03em; }
    .pend-adq { color: var(--warn-600, #8a6100); font-weight: 600; }
    .g-detalle {
      display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 10px 18px;
      background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md);
      padding: 13px 15px; margin-bottom: 12px;
    }
    .g-detalle > div { font-size: 12.5px; }
    .g-detalle .ancho { grid-column: 1 / -1; }
    .g-detalle span { display: block; color: var(--tx-2); font-size: 11px; text-transform: uppercase; letter-spacing: .04em; }
    .g-detalle b { color: var(--navy-900); }
    .hist-gar { margin-bottom: 12px; }
    .hist-gar summary { font-size: 12.5px; font-weight: 600; color: var(--navy-900); cursor: pointer; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Entrega y garantía</div>
          <h1>
            Servicio de garantía
            <ui-help texto="Cuando el usuario final acepta el equipo, el Expediente único aparece aquí automáticamente. La garantía del proveedor de un equipo nuevo corre desde su fecha de adquisición, no desde la aceptación; un equipo usado no tiene garantía de proveedor, sino responsabilidad interna de Soporte." />
          </h1>
          <p class="page-sub">Seguimiento de casos posteriores a la entrega.</p>
        </div>
      </div>

      <div class="alert mb-2">
        <span class="alert-ico">i</span>
        <span>Los expedientes se registran aquí <b>automáticamente</b> cuando el usuario final acepta el equipo mediante el formulario externo. No se crean manualmente.
          La aceptación confirma que el equipo fue recibido conforme: <b>no inicia la garantía del proveedor</b>, que corre desde la fecha de adquisición del equipo.</span>
      </div>

      @if (esTecHardware()) {
        <div class="alert mb-2">
          <span class="alert-ico">i</span>
          <span>Como <b>Técnico de Hardware</b> usted ve únicamente los casos de garantía de equipos donde participó
            en la preparación técnica (F0288). Puede consultar los casos y <b>agregar comentarios técnicos</b> mientras el
            caso esté abierto y la garantía vigente; la apertura y el cierre de casos los gestiona Soporte.</span>
        </div>
      } @else if (auth.esTecnico()) {
        <div class="alert mb-2">
          <span class="alert-ico">i</span>
          <span>Vista filtrada por usuario: solo se muestran las garantías de <b>procesos donde usted participó</b>.</span>
        </div>
      }

      <div class="card table-wrap mb-3">
        <table class="tbl">
          <thead>
            <tr>
              <th>Expediente único</th>
              <th>Usuario final</th>
              <th>Equipo entregado</th>
              <th>Aceptado el</th>
              <th>Garantía</th>
              <th>Estado</th>
              <th>Casos</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (g of data.garantiasVisibles(); track g.expediente) {
              <tr [class.sel]="seleccion()?.expediente === g.expediente">
                <td>
                  <div class="exp-cod">{{ unicoDe(g) || '—' }}</div>
                  <div class="sub-cell mono">{{ g.expediente }}</div>
                </td>
                <td class="main-cell">{{ g.usuarioFinal }}</td>
                <td>
                  <div class="main-cell">{{ g.equipo }}</div>
                  <div class="sub-cell mono">{{ g.inventario }}</div>
                </td>
                <td class="mono">{{ g.fechaAceptacion }}</td>
                <td>
                  <div class="g-tipo">{{ g.tipoGarantia || 'Sin definir' }}</div>
                  @if (g.fechaInicio) {
                    <div class="mono">{{ g.fechaInicio }} → {{ g.fechaVencimiento }}</div>
                    <div class="progress mt-1" style="max-width: 130px;" [class.ok]="g.estado === 'Vigente'">
                      <span [style.width.%]="avance(g)"></span>
                    </div>
                  } @else {
                    <div class="small pend-adq">Falta la fecha de adquisición</div>
                  }
                </td>
                <td>
                  <ui-badge [estado]="g.estado" />
                  <div class="sub-cell">{{ data.estadoDetalleGarantia(g) }}</div>
                </td>
                <td class="mono">{{ g.casos.length }}</td>
                <td>
                  <div class="row" style="justify-content: flex-end; flex-wrap: nowrap;">
                    @if (!esTecHardware()) {
                      <button class="btn btn-ghost btn-sm" (click)="verExpediente(g)">Ver expediente</button>
                    }
                    <button class="btn btn-outline btn-sm" (click)="seleccion.set(g)">Ver casos</button>
                    @if (!esTecHardware()) {
                      <button class="btn btn-primary btn-sm" [disabled]="!puedeAbrirCaso(g)" (click)="abrirRegistro(g)">Abrir caso</button>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="muted" style="text-align:center; padding: 28px;">
                  Aún no hay expedientes en garantía. Aparecerán automáticamente cuando el usuario final acepte la recepción del equipo.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Casos del expediente seleccionado -->
      @if (seleccion(); as g) {
        <div class="card">
          <div class="card-head">
            <div>
              <h2>Casos de garantía — {{ unicoDe(g) || g.expediente }}</h2>
              <p class="sub">{{ g.equipo }} · {{ g.inventario }} · {{ g.usuarioFinal }}</p>
            </div>
            <div class="row">
              @if (data.puedeModificarGarantia()) {
                <button class="btn btn-outline btn-sm" (click)="abrirModificar(g)">Modificar garantía</button>
              }
              @if (!esTecHardware()) {
                <button class="btn btn-primary btn-sm" [disabled]="!puedeAbrirCaso(g)" (click)="abrirRegistro(g)">Abrir caso de garantía</button>
              }
              <ui-badge [estado]="data.estadoDetalleGarantia(g)" />
            </div>
          </div>
          <div class="card-body">
            <!-- Detalle de la vigencia: de qué garantía se trata, desde cuándo y por qué -->
            <div class="g-detalle">
              <div><span>Tipo de equipo</span><b>{{ condicionDe(g) || '—' }}</b></div>
              <div><span>Tipo de garantía</span><b>{{ g.tipoGarantia || '—' }}</b></div>
              <div><span>Fecha de adquisición</span><b class="mono">{{ g.fechaAdquisicion || 'Sin registrar' }}</b></div>
              <div><span>Proveedor</span><b>{{ g.proveedor || 'No consta' }}</b></div>
              <div><span>Fecha de aceptación del Usuario Final</span><b class="mono">{{ g.fechaAceptacion }}</b></div>
              <!-- La vigencia del proveedor se muestra aunque ya no cubra: es un hecho del equipo -->
              @if (g.inicioProveedor || g.vencimientoProveedor) {
                <div><span>Inicio garantía del proveedor</span><b class="mono">{{ g.inicioProveedor || '—' }}</b></div>
                <div>
                  <span>Vencimiento garantía del proveedor</span>
                  <b class="mono">{{ g.vencimientoProveedor || '—' }}</b>
                  @if (g.tipoGarantia !== 'Garantía de proveedor') { <b class="pend-adq"> · ya vencida</b> }
                </div>
              }
              @if (g.inicioInterna || g.vencimientoInterna) {
                <div><span>Inicio responsabilidad interna</span><b class="mono">{{ g.inicioInterna || '—' }}</b></div>
                <div><span>Vencimiento responsabilidad interna</span><b class="mono">{{ g.vencimientoInterna || '—' }}</b></div>
              }
              <div><span>Días restantes</span><b>{{ diasTexto(g) }}</b></div>
              <div><span>Estado de garantía</span><b>{{ data.estadoDetalleGarantia(g) }}</b></div>
              <div><span>Responsable de garantía</span><b>{{ data.responsableGarantia(g) }}</b></div>
              @if (data.ultimaModificacionGarantia(g); as m) {
                <div><span>Última modificación</span><b class="mono">{{ m.fecha }} {{ m.hora }}</b></div>
                <div><span>Modificado por</span><b>{{ m.usuario.split('—')[0].trim() }} · {{ m.rol }}</b></div>
                <div class="ancho"><span>Motivo de modificación</span><b>{{ m.motivo }}</b></div>
              }
            </div>

            @if (data.faltaFechaAdquisicion(g)) {
              <div class="alert warn mb-2">
                <span class="alert-ico">!</span>
                <span>
                  <b>{{ data.MSG_DATOS_INSTITUCIONALES }}</b>
                  <div>
                    La fecha de adquisición viene de la base institucional al ingresar el equipo. Que falte en un
                    equipo nuevo es un error de ese registro, no un paso del proceso: no se sustituye por la fecha
                    de aceptación.
                  </div>
                  @if (data.puedeModificarGarantia()) {
                    <button class="btn btn-outline btn-sm mt-2" (click)="abrirModificar(g)">Corregir fecha de adquisición</button>
                  }
                </span>
              </div>
            } @else if (data.sinCoberturaVigente(g)) {
              <div class="alert warn mb-2">
                <span class="alert-ico">!</span>
                <span>
                  <b>{{ data.MSG_PROVEEDOR_VENCIDA_USADO }}</b>
                  <div>
                    La garantía del proveedor cubrió del <b>{{ g.inicioProveedor }}</b> al
                    <b>{{ g.vencimientoProveedor }}</b>. Mientras no se fije la responsabilidad interna, el equipo
                    no tiene cobertura y no se pueden abrir casos.
                  </div>
                  @if (data.puedeModificarGarantia()) {
                    <button class="btn btn-outline btn-sm mt-2" (click)="abrirInterna(g)">Establecer responsabilidad interna</button>
                  }
                </span>
              </div>
            } @else if (bloqueoCaso(g); as b) {
              <div class="alert warn mb-2">
                <span class="alert-ico">!</span>
                <span>
                  <b>{{ b }}</b>
                  @if (g.autorizacionInterna; as a) {
                    <div>Autorizada la atención por responsabilidad interna el {{ a.fecha }} por {{ a.autorizadoPor.split('—')[0].trim() }}: {{ a.motivo }}</div>
                  } @else if (data.puedeModificarGarantia()) {
                    <button class="btn btn-outline btn-sm mt-2" (click)="abrirAutorizar(g)">Autorizar por responsabilidad interna</button>
                  }
                </span>
              </div>
            }

            @if (g.modificaciones?.length) {
              <details class="hist-gar">
                <summary>Historial de modificaciones de la garantía ({{ g.modificaciones?.length }})</summary>
                <div class="table-wrap">
                  <table class="tbl">
                    <thead>
                      <tr><th>Fecha</th><th>Usuario</th><th>Tipo</th><th>Adquisición</th><th>Vigencia anterior</th><th>Vigencia nueva</th><th>Motivo</th></tr>
                    </thead>
                    <tbody>
                      @for (m of g.modificaciones; track m.fecha + m.hora) {
                        <tr>
                          <td class="mono">{{ m.fecha }}<div class="sub-cell">{{ m.hora }}</div></td>
                          <td>{{ m.usuario.split('—')[0].trim() }}<div class="sub-cell">{{ m.rol }}</div></td>
                          <td>
                            @if (m.tipoAnterior !== m.tipoNuevo) { {{ m.tipoAnterior }} → {{ m.tipoNuevo }} }
                            @else { {{ m.tipoNuevo }} }
                          </td>
                          <td class="mono">
                            @if (m.fechaAdquisicionAnterior !== m.fechaAdquisicionNueva) {
                              {{ m.fechaAdquisicionAnterior || 'sin registrar' }} → {{ m.fechaAdquisicionNueva }}
                            } @else { {{ m.fechaAdquisicionNueva || '—' }} }
                          </td>
                          <td class="mono">{{ m.inicioAnterior || '—' }} → {{ m.vencimientoAnterior || '—' }}</td>
                          <td class="mono">{{ m.inicioNuevo }} → {{ m.vencimientoNuevo }}</td>
                          <td>{{ m.motivo }}@if (m.observaciones) { <div class="sub-cell">{{ m.observaciones }}</div> }</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              </details>
            }

            <div class="g-fechas">
              <span>Aceptado: <b>{{ g.fechaAceptacion }}</b></span>
              <span>Vigencia efectiva: <b>{{ g.fechaInicio || 'sin definir' }} → {{ g.fechaVencimiento || 'sin definir' }}</b></span>
              <span>Casos asociados: <b>{{ g.casos.length }}</b></span>
            </div>

            @for (c of g.casos; track c.codigo) {
              <div class="caso">
                <div class="c-head">
                  <span class="c-cod">{{ c.codigo }}</span>
                  <span class="c-motivo">{{ c.motivo }}</span>
                  <ui-badge [estado]="c.estado" />
                  <span class="c-fechas">Abierto: {{ c.fechaApertura }}@if (c.fechaCierre) { · Cerrado: {{ c.fechaCierre }} }</span>
                </div>
                <div class="c-desc">{{ c.descripcion }}</div>
                <div class="c-desc"><b>Atiende:</b> {{ c.responsableAtencion }}@if (c.evidenciaTecnica) { · <b>Evidencia:</b> {{ c.evidenciaTecnica }} }</div>
                @if (c.resultado) {
                  <div class="resultado"><b>Resultado:</b> {{ c.resultado }}</div>
                }

                <!-- Imágenes del caso: apertura, diagnóstico, corrección y cierre -->
                <ui-evidencias titulo="Evidencias del caso de garantía"
                  [lista]="data.evid.de('Garantía', c.codigo)"
                  [editable]="data.puedeComentarCaso(g, c)"
                  [obligatoria]="c.estado !== 'Cerrado' && c.estado !== 'Resuelto'"
                  [mensajeFalta]="data.evid.mensajeFalta('Garantía')"
                  [contextos]="data.evid.contextosDe('Garantía')"
                  [sugeridas]="sugeridasGarantia"
                  (adjuntar)="adjuntarEvidencia(g, c, $event)"
                  (eliminar)="quitarEvidencia(g, c, $event)"
                  (visualizar)="verEvidencia(g, c, $event)"
                  (error)="toast.error('No se pudo adjuntar la imagen', $event)" />

                <!-- Comentarios internos del caso: no reemplazan la trazabilidad general -->
                <div class="c-com">
                  <div class="c-com-head">
                    <b>Comentarios del caso ({{ (c.comentarios ?? []).length }})</b>
                    <ui-help texto="Historial interno de seguimiento del caso: cada comentario guarda usuario, rol, fecha, hora y el estado del caso al momento de comentar. Solo se puede comentar con la garantía vigente y el caso abierto o en revisión; no reemplaza la trazabilidad general del expediente." />
                    <button class="btn btn-outline btn-sm" [disabled]="!data.puedeComentarCaso(g, c)" (click)="abrirComentar(g, c)">Agregar comentario</button>
                  </div>
                  @if (c.estado === 'Cerrado' || c.estado === 'Resuelto') {
                    <div class="alert mt-1">
                      <span class="alert-ico">i</span>
                      <span>Este caso de garantía está <b>cerrado</b>. No se pueden agregar nuevos comentarios; el historial se muestra en modo solo lectura.</span>
                    </div>
                  } @else if (vencida(g)) {
                    <div class="alert warn mt-1">
                      <span class="alert-ico">!</span>
                      <span>La garantía de este expediente está <b>vencida</b>: el caso queda en modo consulta y no admite nuevos comentarios.</span>
                    </div>
                  }
                  @for (m of c.comentarios ?? []; track $index) {
                    <div class="com-item">
                      <div class="com-meta">
                        <span class="mono">{{ m.fecha }} · {{ m.hora }}</span> · <b>{{ m.usuario }}</b>
                        <span class="com-tipo">{{ m.tipo }}</span>
                        <span>Estado del caso: {{ m.estadoCaso }}</span>
                      </div>
                      <div class="com-text">{{ m.texto }}</div>
                    </div>
                  } @empty {
                    <p class="muted small mt-1">Sin comentarios registrados en este caso.</p>
                  }
                </div>

                <!-- Revisión técnica de Hardware: no todo caso de garantía la necesita. Soporte
                     clasifica el problema y el sistema dice a quién le toca. -->
                @if ((c.estado === 'Abierto' || c.estado === 'En revisión') && !vencida(g) && !esTecHardware()) {
                  <div class="rev-bloque">
                    <div class="row-between" style="flex-wrap: wrap; gap: 10px;">
                      <div>
                        <b class="small">Revisión del caso</b>
                        <p class="small muted" style="max-width: 62ch;">
                          Clasifique el problema para saber si se resuelve en Soporte o si el equipo debe ir a
                          revisión técnica de Hardware. No todos los casos de garantía generan revisión.
                        </p>
                      </div>
                      @if (!c.tipoProblema) {
                        <button class="btn btn-outline btn-sm" (click)="abrirRevision(g, c)">Clasificar problema</button>
                      }
                    </div>
                    @if (c.tipoProblema) {
                      <dl class="dl">
                        <dt>Problema clasificado</dt>
                        <dd>
                          {{ c.tipoProblema }}
                          <span class="chip">{{ data.garantiaRequiereHardware(c.tipoProblema) ? 'Requiere Hardware' : 'Se resuelve en Soporte' }}</span>
                          <div class="sub-cell">{{ data.notaProblemaGarantia(c.tipoProblema) }}</div>
                        </dd>
                        @if (c.estadoRevision) { <dt>Estado técnico</dt><dd class="mono">{{ c.estadoRevision }}</dd> }
                      </dl>
                      @if (data.garantiaRequiereHardware(c.tipoProblema) && !c.revisionId) {
                        @if (data.tecnicoSugeridoGarantia(g.inventario); as s) {
                          <p class="hint">Técnico sugerido: <b>{{ s.tecnico }}</b> — {{ s.motivo }} La asignación la hace un Encargado.</p>
                        }
                        <div class="row" style="justify-content: flex-end;">
                          <button class="btn btn-primary btn-sm" (click)="abrirEnvio(g, c)">Enviar a revisión de Hardware</button>
                        </div>
                      }
                    }
                    @if (revision(c); as r) {
                      <dl class="dl">
                        <dt>Revisión técnica de garantía</dt>
                        <dd class="mono">{{ r.id }} <span class="chip">No se crea un Expediente técnico nuevo</span></dd>
                        <dt>Estado de la revisión</dt><dd>{{ r.estado }}</dd>
                        <dt>Técnico de Hardware</dt>
                        <dd>
                          {{ r.tecnicoAsignado || 'Sin asignar' }}
                          @if (!r.tecnicoAsignado && r.tecnicoSugerido) {
                            <div class="sub-cell">Sugerido: {{ r.tecnicoSugerido }} — {{ r.motivoSugerencia }}</div>
                          }
                          @if (r.asignadoPor) { <div class="sub-cell">Asignado por {{ r.asignadoPor }} · {{ r.fechaAsignacion }} {{ r.horaAsignacion }}</div> }
                        </dd>
                        @if (r.resultado) { <dt>Resultado</dt><dd>{{ r.resultado }}</dd> }
                        @if (r.firma; as fi) {
                          <dt>Firma de Hardware</dt>
                          <dd>{{ fi.nombre }} — {{ fi.cargo }} · {{ fi.fecha }} {{ fi.hora }}</dd>
                        }
                        @if (constanciaDe(r); as doc) {
                          <dt>Constancia</dt>
                          <dd class="mono">{{ doc.codigo }} <span class="chip">{{ doc.tipo }}</span></dd>
                        }
                      </dl>
                      <div class="row">
                        <a class="btn btn-outline btn-sm" routerLink="/reprocesos-f0288">Ver revisión en Hardware</a>
                        @if (r.firma && !c.validacionSoporte && r.resultado !== 'Requiere sustitución de equipo') {
                          <button class="btn btn-primary btn-sm" (click)="abrirValidacion(g, c)">Validar resultado</button>
                        }
                      </div>
                      @if (c.validacionSoporte; as v) {
                        <dl class="dl">
                          <dt>Validación de Soporte</dt>
                          <dd>
                            Corrección: {{ v.correccionRealizada }} · Equipo funciona: {{ v.equipoFunciona }}
                            · Evidencia revisada: {{ v.evidenciaRevisada }}
                            <div class="sub-cell">{{ v.observacion }}</div>
                            <div class="sub-cell">{{ v.validadoPor }} · {{ v.fecha }} {{ v.hora }}</div>
                          </dd>
                        </dl>
                      }
                      @if (data.faltaValidacionGarantia(c); as pendiente) {
                        <div class="alert warn">
                          <span class="alert-ico">!</span>
                          <span>{{ pendiente }}</span>
                        </div>
                      }
                    }
                  </div>
                  <div class="row mt-1" style="justify-content: flex-end;">
                    <button class="btn btn-primary btn-sm" (click)="abrirCierre(g, c)">Cerrar caso</button>
                  </div>
                }
              </div>
            } @empty {
              <p class="muted small">Sin casos de garantía registrados para este expediente.</p>
            }

            @if (vencida(g)) {
              <div class="alert warn mt-2">
                <span class="alert-ico">!</span>
                <span>La garantía de este expediente está <b>vencida</b>. No se pueden abrir nuevos casos ni agregar comentarios:
                  el módulo queda en <b>modo consulta</b> (casos y comentarios históricos de solo lectura).</span>
              </div>
            } @else if (!puedeAbrirCaso(g)) {
              <div class="alert warn mt-2">
                <span class="alert-ico">!</span>
                <span>La garantía de este expediente ya no está vigente; no se registran casos nuevos.</span>
              </div>
            }
          </div>
        </div>
      }

      <!-- Clasificar el problema del caso: es lo que decide si le toca a Hardware -->
      @if (revisar(); as c) {
        <ui-modal titulo="Revisar caso de garantía" [sub]="c.caso.codigo + ' · ' + c.caso.motivo" (cerrar)="revisar.set(null)">
          <div class="field mb-2">
            <label>Tipo de problema <span class="req">*</span></label>
            <select class="control" [ngModel]="problema()" (ngModelChange)="problema.set($event)">
              <option value="" disabled>Seleccione…</option>
              @for (p of data.problemasGarantia; track p.nombre) {
                <option [value]="p.nombre">{{ p.nombre }}</option>
              }
            </select>
            @if (problema()) {
              <span class="hint">{{ data.notaProblemaGarantia(problema()) }}</span>
            }
          </div>
          @if (problema()) {
            <div class="alert mb-2" [class.warn]="data.garantiaRequiereHardware(problema())">
              <span class="alert-ico">{{ data.garantiaRequiereHardware(problema()) ? '!' : 'i' }}</span>
              @if (data.garantiaRequiereHardware(problema())) {
                <span>Este problema exige <b>revisión física del equipo</b>: después de guardar podrá generar la
                  <b>revisión técnica de garantía</b> y un Encargado la asignará a un Técnico de Hardware.</span>
              } @else {
                <span>Este problema <b>se resuelve en Soporte</b>: no genera revisión técnica de Hardware.</span>
              }
            </div>
          }
          <div class="row" style="justify-content: flex-end;">
            <button class="btn btn-primary" [disabled]="!problema()" (click)="guardarRevision(c)">Guardar clasificación</button>
          </div>
        </ui-modal>
      }

      <!-- Generar la revisión técnica de garantía -->
      @if (enviar(); as c) {
        <ui-modal titulo="Enviar a revisión de Hardware"
          [sub]="c.caso.codigo + ' · ' + (c.caso.tipoProblema ?? '')" (cerrar)="enviar.set(null)">
          <dl class="dl mb-2">
            <dt>Equipo</dt><dd>{{ c.garantia.equipo }} · <span class="mono">{{ c.garantia.inventario }}</span></dd>
            <dt>Expediente técnico</dt>
            <dd class="mono">{{ expTecnico(c.garantia) || '—' }} <span class="chip">Se conserva: no se crea uno nuevo</span></dd>
            @if (data.tecnicoSugeridoGarantia(c.garantia.inventario); as s) {
              <dt>Técnico sugerido</dt><dd>{{ s.tecnico }}<div class="sub-cell">{{ s.motivo }}</div></dd>
            }
          </dl>
          <div class="field mb-2">
            <label>Observación para Hardware</label>
            <textarea class="control" rows="2" [ngModel]="observacion()" (ngModelChange)="observacion.set($event)"
              placeholder="Lo que Hardware debe revisar en el equipo…"></textarea>
          </div>
          <div class="alert warn mb-2">
            <span class="alert-ico">!</span>
            <span>La revisión nacerá <b>pendiente de asignación</b>: el Técnico de Hardware no se autoasigna,
              la asignación la hace un <b>Encargado</b>.</span>
          </div>
          <div class="row" style="justify-content: flex-end;">
            <button class="btn btn-primary" (click)="generarRevision(c)">Generar revisión técnica de garantía</button>
          </div>
        </ui-modal>
      }

      <!-- Validación de Soporte tras la firma de Hardware -->
      @if (validar(); as c) {
        <ui-modal titulo="Validar la revisión técnica de garantía"
          [sub]="c.caso.codigo + ' · ' + (c.caso.revisionId ?? '')" (cerrar)="validar.set(null)">
          @if (revision(c.caso); as r) {
            <dl class="dl mb-2">
              <dt>Resultado de Hardware</dt><dd>{{ r.resultado }}</dd>
              <dt>Corrección técnica</dt><dd>{{ r.correccionTecnica || '—' }}</dd>
              <dt>Observación</dt><dd>{{ r.observacionResultado || '—' }}</dd>
            </dl>
            <ui-evidencias titulo="Evidencia de la revisión técnica" [lista]="r.evidencias" />
          }
          <div class="grid grid-2 mt-2">
            <div class="field">
              <label>¿La corrección se realizó? <span class="req">*</span></label>
              <div class="radio-line">
                <label><input type="radio" name="vcor" [checked]="vCorreccion() === 'Sí'" (change)="vCorreccion.set('Sí')" /> Sí</label>
                <label><input type="radio" name="vcor" [checked]="vCorreccion() === 'No'" (change)="vCorreccion.set('No')" /> No</label>
              </div>
            </div>
            <div class="field">
              <label>¿El equipo funciona correctamente? <span class="req">*</span></label>
              <div class="radio-line">
                <label><input type="radio" name="vfun" [checked]="vFunciona() === 'Sí'" (change)="vFunciona.set('Sí')" /> Sí</label>
                <label><input type="radio" name="vfun" [checked]="vFunciona() === 'No'" (change)="vFunciona.set('No')" /> No</label>
              </div>
            </div>
          </div>
          <div class="field mb-2">
            <label>¿Revisó la evidencia de Hardware? <span class="req">*</span></label>
            <div class="radio-line">
              <label><input type="radio" name="vevi" [checked]="vEvidencia() === 'Sí'" (change)="vEvidencia.set('Sí')" /> Sí</label>
              <label><input type="radio" name="vevi" [checked]="vEvidencia() === 'No'" (change)="vEvidencia.set('No')" /> No</label>
            </div>
          </div>
          <div class="field mb-2">
            <label>Observación de la validación <span class="req">*</span></label>
            <textarea class="control" rows="2" [ngModel]="vObs()" (ngModelChange)="vObs.set($event)"
              placeholder="Qué comprobó Soporte antes de cerrar el caso…"></textarea>
          </div>
          <div class="row" style="justify-content: flex-end;">
            <button class="btn btn-primary" (click)="guardarValidacion(c)">Guardar validación</button>
          </div>
        </ui-modal>
      }

      <!-- Registrar caso -->
      @if (abrirCaso(); as g) {
        <ui-modal titulo="Abrir caso de garantía" [sub]="(unicoDe(g) || g.expediente) + ' · ' + g.equipo" (cerrar)="abrirCaso.set(null)">
          <div class="field mb-2">
            <label>Motivo del caso <span class="req">*</span></label>
            <select class="control" [(ngModel)]="motivo">
              <option value="" disabled>Seleccione…</option>
              <option>Falla del equipo</option>
              <option>Inconformidad posterior</option>
              <option>Revisión técnica</option>
              <option>Otro</option>
            </select>
          </div>
          <div class="field mb-2">
            <label>Descripción del caso <span class="req">*</span></label>
            <textarea class="control" rows="3" placeholder="Describa lo reportado por el usuario…" [(ngModel)]="descripcion"></textarea>
          </div>
          <div class="field mb-2">
            <label>Técnico responsable de atención <span class="req">*</span></label>
            @if (puedeElegirResponsable()) {
              <!-- El Encargado reparte el caso: ve la carga de cada técnico antes de decidir -->
              <input class="control mb-1" readonly [value]="responsableCaso() || 'Sin asignar'" />
              @if (cargaResponsable(); as c) {
                <div class="small muted">{{ c.carga }} · {{ c.total }} procesos activos · {{ data.resumenCargaSoporte(c) }}.</div>
                @if (c.nivel === 'Alta') {
                  <div class="alert warn mt-1">
                    <span class="alert-ico">!</span>
                    <span>{{ data.MSG_CARGA_ALTA }}</span>
                  </div>
                }
              }
              <button type="button" class="btn btn-outline btn-sm mt-1" (click)="buscarResponsable.set(true)">
                {{ responsableCaso() ? 'Cambiar técnico' : 'Seleccionar Técnico de Soporte' }}
              </button>
            } @else {
              <input class="control" readonly [value]="responsableCaso()" />
              <span class="hint">El caso queda a su nombre. El Encargado de Soporte puede asignarlo a otro técnico.</span>
            }
          </div>
          <div class="alert mb-2">
            <span class="alert-ico">i</span>
            <span>El caso quedará asociado al <b>Expediente único</b> del equipo y registrado en la trazabilidad.</span>
          </div>
          <div class="row" style="justify-content: flex-end;">
            <button class="btn btn-primary" [disabled]="!motivo() || !descripcion().trim() || !responsableCaso()" (click)="registrarCaso(g)">Abrir caso</button>
          </div>
        </ui-modal>

        @if (buscarResponsable()) {
          <app-selector-soporte
            titulo="Técnico responsable de atención de garantía"
            [sub]="g.equipo + ' · ' + g.inventario"
            nota="Elija quién atiende el caso viendo los procesos que cada técnico ya tiene abiertos. Una carga alta no impide asignarlo."
            vacio="No hay Técnicos de Soporte activos registrados."
            [tecnicos]="data.tecnicosSoporteParaProceso(g.expediente)"
            [seleccionado]="responsableCaso()"
            [expediente]="g.expediente"
            (seleccion)="responsableCaso.set($event.nombreRol); buscarResponsable.set(false)"
            (cerrar)="buscarResponsable.set(false)" />
        }
      }

      <!-- Agregar comentario al caso -->
      @if (comentar(); as c) {
        <ui-modal titulo="Agregar comentario" [sub]="c.caso.codigo + ' · ' + c.caso.motivo + ' · Estado: ' + c.caso.estado" (cerrar)="comentar.set(null)">
          <div class="field mb-2">
            <label>Tipo de comentario <span class="req">*</span></label>
            <select class="control" [(ngModel)]="tipoComentario">
              <option>Seguimiento</option>
              <option>Revisión técnica</option>
              <option>Observación</option>
              <option>Resolución</option>
              <option>Otro</option>
            </select>
          </div>
          <div class="field mb-2">
            <label>Comentario <span class="req">*</span></label>
            <textarea class="control" rows="3" placeholder="Escriba el seguimiento, la revisión o la observación del caso…" [(ngModel)]="textoComentario"></textarea>
          </div>
          <div class="alert mb-2">
            <span class="alert-ico">i</span>
            <span>
              El comentario quedará asociado al caso <b>{{ c.caso.codigo }}</b> del expediente
              <b>{{ unicoDe(c.garantia) || c.garantia.expediente }}</b> ({{ c.garantia.equipo }} · {{ c.garantia.inventario }}), con su
              <b>usuario, rol, fecha y hora</b> y el estado del caso al momento de comentar. Es un comentario interno: no
              reemplaza la trazabilidad general.
            </span>
          </div>
          <div class="row" style="justify-content: flex-end;">
            <button class="btn btn-primary" [disabled]="!textoComentario().trim()" (click)="guardarComentario(c.garantia, c.caso)">Guardar comentario</button>
          </div>
        </ui-modal>
      }

      <!-- Cerrar caso -->
      @if (cierre(); as c) {
        <ui-modal titulo="Cerrar caso de garantía" [sub]="c.caso.codigo + ' · ' + c.caso.motivo" (cerrar)="cierre.set(null)">
          <div class="field mb-2">
            <label>Resultado de revisión <span class="req">*</span></label>
            <textarea class="control" rows="3" placeholder="Describa la revisión realizada y el resultado…" [(ngModel)]="resultado"></textarea>
          </div>
          @if (data.evid.hay('Garantía', c.caso.codigo)) {
            <p class="hint">
              Respaldado por {{ data.evid.de('Garantía', c.caso.codigo).length }} imagen(es) del caso.
            </p>
          } @else {
            <div class="alert warn mb-2">
              <span class="alert-ico">!</span>
              <span>{{ data.evid.mensajeFalta('Garantía') }} Adjúntela en el caso antes de cerrarlo.</span>
            </div>
          }
          <div class="row" style="justify-content: flex-end;">
            <button class="btn btn-primary" [disabled]="!resultado().trim()" (click)="cerrar(c.garantia, c.caso)">Cerrar caso</button>
          </div>
        </ui-modal>
      }

      <!-- Modificar la vigencia: solo Encargado de Soporte y Administrador -->
      @if (modificar(); as g) {
        <ui-modal titulo="Modificar vigencia de garantía"
          [sub]="g.equipo + ' · ' + g.inventario + ' · equipo ' + (condicionDe(g) || 'sin condición')"
          (cerrar)="modificar.set(null)">
          <div class="alert mb-2">
            <span class="alert-ico">i</span>
            <span>
              La <b>garantía del proveedor</b> corre desde la fecha de adquisición del equipo.
              La <b>responsabilidad interna de Soporte</b> puede iniciar en la aceptación del usuario
              final ({{ g.fechaAceptacion }}) o en la fecha que defina el Encargado de Soporte.
            </span>
          </div>
          <div class="form-grid">
            <div class="field">
              <label>Tipo de garantía <span class="req">*</span></label>
              <select class="control" [ngModel]="mTipo()" (ngModelChange)="cambiarTipo($event)">
                @for (t of tipos; track t) { <option [value]="t">{{ t }}</option> }
              </select>
            </div>
            <div class="field">
              <label>Fecha de adquisición @if (mTipo() === 'Garantía de proveedor') { <span class="req">*</span> }</label>
              <input class="control" type="date" [ngModel]="mAdquisicion()" (ngModelChange)="cambiarAdquisicion($event)" />
              <span class="hint">Fecha de compra o recepción institucional del equipo. No es la fecha de ingreso al inventario.</span>
            </div>
            <div class="field">
              <label>Fecha de inicio <span class="req">*</span></label>
              <input class="control" type="date" [(ngModel)]="mInicio" [readonly]="mTipo() === 'Garantía de proveedor'" />
              @if (mTipo() === 'Garantía de proveedor') {
                <span class="hint">La garantía del proveedor inicia siempre en la fecha de adquisición.</span>
              }
            </div>
            <div class="field">
              <label>Fecha de vencimiento <span class="req">*</span></label>
              <input class="control" type="date" [(ngModel)]="mVencimiento" />
              @if (mTipo() === 'Garantía de proveedor' && mAdquisicion()) {
                <span class="hint">Duración sugerida: {{ data.ANIOS_GARANTIA_PROVEEDOR }} años desde la adquisición.</span>
              }
            </div>
            <div class="field full">
              <label>Proveedor</label>
              <input class="control" [(ngModel)]="mProveedor" placeholder="Empresa que vendió o entregó el equipo…" />
            </div>
            <div class="field full">
              <label>Motivo de modificación <span class="req">*</span></label>
              <textarea class="control" rows="2" [(ngModel)]="mMotivo"
                placeholder="Por qué cambia la vigencia de esta garantía…"></textarea>
              <span class="hint">{{ data.MSG_MOTIVO_GARANTIA }}</span>
            </div>
            <div class="field full">
              <label>Observaciones</label>
              <textarea class="control" rows="2" [(ngModel)]="mObservaciones"
                placeholder="Número de póliza, cobertura, condiciones…"></textarea>
            </div>
          </div>
          <div class="row-between mt-3">
            <span class="small muted">Vigencia actual: <b>{{ g.fechaInicio || 'sin definir' }} → {{ g.fechaVencimiento || 'sin definir' }}</b></span>
            <button class="btn btn-primary" (click)="guardarModificacion(g)">Guardar modificación</button>
          </div>
        </ui-modal>
      }

      <!-- Autorizar atención por responsabilidad interna con la garantía del proveedor vencida -->
      @if (autorizar(); as g) {
        <ui-modal titulo="Autorizar atención por responsabilidad interna"
          [sub]="g.equipo + ' · ' + g.inventario" (cerrar)="autorizar.set(null)">
          <div class="alert warn mb-2">
            <span class="alert-ico">!</span>
            <span>{{ data.MSG_PROVEEDOR_VENCIDA }}</span>
          </div>
          <div class="field full">
            <label>Justificación <span class="req">*</span></label>
            <textarea class="control" rows="3" [(ngModel)]="aMotivo"
              placeholder="Por qué Soporte asume la atención pese a que el proveedor ya no responde…"></textarea>
          </div>
          <div class="row mt-3" style="justify-content: flex-end;">
            <button class="btn btn-primary" [disabled]="!aMotivo().trim()" (click)="guardarAutorizacion(g)">Autorizar</button>
          </div>
        </ui-modal>
      }
    </div>
  `
})
export class GarantiaComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  protected readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly casoActivo = inject(CasoActivoService);

  protected seleccion = signal<Garantia | null>(this.data.garantiasVisibles()[0] ?? null);
  protected abrirCaso = signal<Garantia | null>(null);
  protected cierre = signal<{ garantia: Garantia; caso: CasoGarantia } | null>(null);
  protected comentar = signal<{ garantia: Garantia; caso: CasoGarantia } | null>(null);
  protected motivo = signal('');
  protected descripcion = signal('');
  protected resultado = signal('');
  protected evidencia = signal('');
  protected tipoComentario = signal<TipoComentarioCaso>('Seguimiento');
  protected textoComentario = signal('');
  /** Revisión técnica de garantía: clasificación, envío a Hardware y validación de Soporte. */
  protected revisar = signal<{ garantia: Garantia; caso: CasoGarantia } | null>(null);
  protected enviar = signal<{ garantia: Garantia; caso: CasoGarantia } | null>(null);
  protected validar = signal<{ garantia: Garantia; caso: CasoGarantia } | null>(null);
  protected problema = signal('');
  protected observacion = signal('');
  protected vCorreccion = signal<RespuestaSiNo>('');
  protected vFunciona = signal<RespuestaSiNo>('');
  protected vEvidencia = signal<RespuestaSiNo>('');
  protected vObs = signal('');

  /** El Técnico de Hardware solo consulta y comenta los casos donde preparó el equipo: no abre ni cierra casos. */
  protected readonly esTecHardware = computed(() => this.auth.usuario()?.clave === 'tec-hardware');

  protected unicoDe(g: Garantia): string {
    return this.data.expedienteUnicoDe(g.expediente)?.codigoUnico ?? '';
  }

  protected vencida(g: Garantia): boolean {
    return this.data.garantiaVencida(g);
  }

  /**
   * Un caso se abre con la garantía o la responsabilidad vigente. Un equipo nuevo sin fecha de
   * adquisición no puede abrir caso: no se sabe si su garantía sigue corriendo, y suponerlo sería
   * volver a usar una fecha que no es.
   */
  protected puedeAbrirCaso(g: Garantia): boolean {
    return !this.data.bloqueoCasoGarantia(g) && g.estado !== 'Cerrado';
  }
  protected bloqueoCaso(g: Garantia): string {
    return this.data.bloqueoCasoGarantia(g);
  }

  /** Condición del equipo: es lo que decide si hay garantía de proveedor o responsabilidad interna. */
  protected condicionDe(g: Garantia): string {
    return this.data.equipoDe(g.inventario)?.condicion ?? '';
  }

  protected diasTexto(g: Garantia): string {
    const dias = this.data.diasRestantesGarantia(g);
    if (dias === null) return 'Sin vigencia calculada';
    return dias < 0 ? `Vencida hace ${Math.abs(dias)} día(s)` : `${dias} día(s)`;
  }

  protected avance(g: Garantia): number {
    const ini = new Date(g.fechaInicio).getTime();
    const fin = new Date(g.fechaVencimiento).getTime();
    const hoy = Date.now();
    if (Number.isNaN(ini) || Number.isNaN(fin) || fin <= ini) return 0;
    if (hoy >= fin) return 100;
    if (hoy <= ini) return 2;
    return Math.round(((hoy - ini) / (fin - ini)) * 100);
  }

  // ---------- Modificación de la vigencia (Encargado de Soporte / Administrador) ----------
  protected readonly tipos: TipoGarantia[] =
    ['Garantía de proveedor', 'Responsabilidad interna de Soporte', 'Sin garantía de proveedor'];
  protected modificar = signal<Garantia | null>(null);
  protected autorizar = signal<Garantia | null>(null);
  protected mTipo = signal<TipoGarantia>('Garantía de proveedor');
  protected mAdquisicion = signal('');
  protected mInicio = signal('');
  protected mVencimiento = signal('');
  protected mProveedor = signal('');
  protected mMotivo = signal('');
  protected mObservaciones = signal('');
  protected aMotivo = signal('');

  /**
   * Atajo del §6: el proveedor ya no responde y el Encargado tiene que decir desde cuándo y hasta
   * cuándo lo asume Soporte. Abre el mismo modal, con el tipo y las fechas ya puestos.
   */
  protected abrirInterna(g: Garantia): void {
    this.abrirModificar(g);
    this.mTipo.set('Responsabilidad interna de Soporte');
    this.mInicio.set(g.fechaAceptacion || new Date().toISOString().slice(0, 10));
    this.mVencimiento.set('');
  }

  protected abrirModificar(g: Garantia): void {
    const vig = this.data.vigenciaEfectiva(g);
    this.mTipo.set(g.tipoGarantia ?? 'Garantía de proveedor');
    this.mAdquisicion.set(g.fechaAdquisicion ?? this.data.fechaAdquisicionDe(g.inventario));
    this.mInicio.set(vig.inicio);
    this.mVencimiento.set(vig.vencimiento);
    this.mProveedor.set(g.proveedor ?? '');
    this.mObservaciones.set(g.observacionesGarantia ?? '');
    this.mMotivo.set('');
    this.modificar.set(g);
    // Si el equipo es nuevo y aún no tiene fecha, el modal abre con la propuesta lista para que
    // registrar la fecha de adquisición sea un solo paso.
    if (this.mTipo() === 'Garantía de proveedor' && this.mAdquisicion() && !this.mInicio()) {
      this.cambiarAdquisicion(this.mAdquisicion());
    }
  }

  /** Cambiar el tipo reordena las fechas: cada garantía tiene su propio punto de partida. */
  protected cambiarTipo(tipo: TipoGarantia): void {
    this.mTipo.set(tipo);
    const g = this.modificar();
    if (!g) return;
    if (tipo === 'Garantía de proveedor') {
      this.cambiarAdquisicion(this.mAdquisicion());
    } else if (tipo === 'Responsabilidad interna de Soporte') {
      this.mInicio.set(g.inicioInterna || g.fechaAceptacion);
      this.mVencimiento.set(g.vencimientoInterna || '');
    }
  }

  /** La garantía del proveedor arranca en la adquisición y dura lo sugerido: se propone entero. */
  protected cambiarAdquisicion(fecha: string): void {
    this.mAdquisicion.set(fecha);
    if (this.mTipo() !== 'Garantía de proveedor' || !fecha) return;
    this.mInicio.set(fecha);
    const [a, m, d] = fecha.split('-').map(Number);
    if (a && m && d) {
      this.mVencimiento.set(
        new Date(Date.UTC(a + this.data.ANIOS_GARANTIA_PROVEEDOR, m - 1, d)).toISOString().slice(0, 10));
    }
  }

  protected guardarModificacion(g: Garantia): void {
    const error = this.data.modificarGarantia(g.expediente, {
      tipoGarantia: this.mTipo(), fechaAdquisicion: this.mAdquisicion(),
      inicio: this.mInicio(), vencimiento: this.mVencimiento(),
      proveedor: this.mProveedor(), motivo: this.mMotivo(), observaciones: this.mObservaciones()
    }, this.quien());
    if (error) { this.toast.error('No se pudo modificar la garantía', error); return; }
    const actualizada = this.data.garantiaDe(g.expediente)!;
    this.toast.ok('Garantía modificada',
      `${actualizada.tipoGarantia}: ${actualizada.fechaInicio} → ${actualizada.fechaVencimiento}.`);
    this.seleccion.set(actualizada);
    this.modificar.set(null);
  }

  protected abrirAutorizar(g: Garantia): void {
    this.aMotivo.set('');
    this.autorizar.set(g);
  }

  protected guardarAutorizacion(g: Garantia): void {
    const error = this.data.autorizarResponsabilidadInterna(g.expediente, this.quien(), this.aMotivo());
    if (error) { this.toast.error('No se pudo autorizar', error); return; }
    this.toast.ok('Atención autorizada', 'El equipo se atenderá por responsabilidad interna de Soporte.');
    this.seleccion.set(this.data.garantiaDe(g.expediente)!);
    this.autorizar.set(null);
  }

  private quien(): string {
    const u = this.auth.usuario();
    return u ? `${u.nombre} — ${u.rol}` : '';
  }

  protected verExpediente(g: Garantia): void {
    this.casoActivo.seleccionar(g.expediente);
    this.router.navigate(['/expediente-unico'], { queryParams: { expediente: g.expediente } });
  }

  protected abrirRegistro(g: Garantia): void {
    this.motivo.set('');
    this.descripcion.set('');
    this.buscarResponsable.set(false);
    // Un Técnico de Soporte abre el caso a su nombre; el Encargado y el Administrador reparten:
    // arrancan sin responsable y lo eligen viendo la carga de cada quien.
    const u = this.auth.usuario();
    this.responsableCaso.set(u?.clave === 'tec-soporte' ? `${u.nombre} — ${u.rol}` : '');
    this.abrirCaso.set(g);
  }

  /** Solo Encargado de Soporte y Administrador asignan el caso a otro técnico. */
  protected readonly puedeElegirResponsable = computed(() => {
    const clave = this.auth.usuario()?.clave;
    return clave === 'enc-soporte' || clave === 'admin';
  });
  protected buscarResponsable = signal(false);
  protected responsableCaso = signal('');
  /** Carga del técnico elegido, para mostrarla junto al nombre sin reabrir el buscador. */
  protected cargaResponsable(): CargaSoporte | null {
    const t = this.responsableCaso();
    return t ? this.data.cargaSoporteDe(t) : null;
  }

  protected abrirComentar(g: Garantia, c: CasoGarantia): void {
    this.tipoComentario.set('Seguimiento');
    this.textoComentario.set('');
    this.comentar.set({ garantia: g, caso: c });
  }

  protected guardarComentario(g: Garantia, c: CasoGarantia): void {
    const u = this.auth.usuario();
    const error = this.data.agregarComentarioCaso(
      g.expediente, c.codigo, this.tipoComentario(), this.textoComentario(), `${u?.nombre} — ${u?.rol}`
    );
    if (error) {
      this.toast.warn('No se guardó el comentario', error);
      return;
    }
    this.toast.ok('Comentario agregado', `Quedó registrado en el historial del caso ${c.codigo} con su usuario, fecha y hora.`);
    this.seleccion.set(this.data.garantias().find((x) => x.expediente === g.expediente) ?? null);
    this.comentar.set(null);
  }

  protected abrirCierre(g: Garantia, c: CasoGarantia): void {
    this.resultado.set('');
    this.evidencia.set('');
    this.cierre.set({ garantia: g, caso: c });
  }

  protected registrarCaso(g: Garantia): void {
    const u = this.auth.usuario();
    const quien = `${u?.nombre} — ${u?.rol}`;
    const responsable = this.responsableCaso() || quien;
    // La carga del responsable se registra antes de abrir el caso: es la que tenía al recibirlo.
    this.data.registrarSeleccionSoporte(responsable, quien, {
      expediente: g.expediente, modulo: 'Servicio de garantía', inventario: g.inventario,
      expedienteUnico: this.unicoDe(g)
    });
    const caso = this.data.registrarCasoGarantia(g.expediente, this.motivo(), this.descripcion().trim(), responsable);
    if (caso) {
      this.toast.ok(`Caso ${caso.codigo} abierto`, 'El caso quedó asociado al Expediente único y registrado en la trazabilidad.');
      this.seleccion.set(this.data.garantias().find((x) => x.expediente === g.expediente) ?? null);
    }
    this.abrirCaso.set(null);
  }

  /** Qué imágenes se esperan en un caso de garantía, de la apertura al cierre. */
  protected readonly sugeridasGarantia = [
    'Fotografía del equipo al abrir el caso', 'Captura o fotografía del diagnóstico',
    'Fotografía de la corrección aplicada', 'Fotografía del equipo al cerrar el caso'
  ];

  private usuarioActual(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  protected adjuntarEvidencia(g: Garantia, c: CasoGarantia, ev: { archivo: string; tipo: string; imagen: string; item: string }): void {
    const error = this.data.adjuntarEvidencia({
      modulo: 'Garantía', proceso: c.codigo, expediente: g.expediente, inventario: g.inventario,
      archivo: ev.archivo, tipo: ev.tipo, usuario: this.usuarioActual(), imagen: ev.imagen, item: ev.item
    });
    if (error) { this.toast.error('No se pudo adjuntar la imagen', error); return; }
    this.toast.ok('Imagen de evidencia adjuntada', `Queda asociada al caso ${c.codigo} y al Expediente único.`);
  }

  protected quitarEvidencia(g: Garantia, c: CasoGarantia, archivo: string): void {
    const error = this.data.eliminarEvidencia('Garantía', c.codigo, g.expediente, archivo, this.usuarioActual());
    if (error) { this.toast.error('No se pudo eliminar la imagen', error); return; }
    this.toast.ok('Imagen de evidencia eliminada', `${archivo} ya no respalda el caso ${c.codigo}.`);
  }

  protected verEvidencia(g: Garantia, c: CasoGarantia, archivo: string): void {
    this.data.registrarConsultaEvidenciaTecnica('Garantía', c.codigo, g.expediente, archivo, this.usuarioActual());
  }

  protected cerrar(g: Garantia, c: CasoGarantia): void {
    const error = this.data.cerrarCasoGarantia(g.expediente, c.codigo, this.resultado().trim(),
      this.evidencia().trim(), this.usuarioActual());
    if (error) { this.toast.error('No se puede cerrar el caso', error); return; }
    this.toast.ok('Caso cerrado', 'El resultado de la revisión y sus imágenes quedaron en el Expediente único.');
    this.seleccion.set(this.data.garantias().find((x) => x.expediente === g.expediente) ?? null);
    this.cierre.set(null);
  }

  // ---------- Revisión técnica de garantía ----------
  protected expTecnico(g: Garantia): string {
    return this.data.expTecnicoDeEquipo(g.inventario)?.codigo ?? '';
  }

  /** Revisión técnica generada para el caso, si la hay. */
  protected revision(c: CasoGarantia): ReprocesoF0288 | undefined {
    return c.revisionId ? this.data.reprocesoDe(c.revisionId) : undefined;
  }

  protected constanciaDe(r: ReprocesoF0288) {
    return this.data.constanciaDeReproceso(r.id);
  }

  protected abrirRevision(g: Garantia, c: CasoGarantia): void {
    this.problema.set(c.tipoProblema ?? '');
    this.revisar.set({ garantia: g, caso: c });
  }

  protected guardarRevision(par: { garantia: Garantia; caso: CasoGarantia }): void {
    const error = this.data.revisarCasoGarantia(par.garantia.expediente, par.caso.codigo,
      this.problema(), this.usuarioActual());
    if (error) { this.toast.error('No se pudo registrar la revisión', error); return; }
    const hardware = this.data.garantiaRequiereHardware(this.problema());
    this.toast.ok('Caso revisado por Soporte', hardware
      ? 'El problema requiere revisión física: genere la revisión técnica de garantía para que un Encargado la asigne.'
      : 'El problema se resuelve en Soporte: no requiere revisión técnica de Hardware.');
    this.refrescar(par.garantia);
    this.revisar.set(null);
  }

  protected abrirEnvio(g: Garantia, c: CasoGarantia): void {
    this.observacion.set('');
    this.enviar.set({ garantia: g, caso: c });
  }

  protected generarRevision(par: { garantia: Garantia; caso: CasoGarantia }): void {
    const r = this.data.generarRevisionGarantia(par.garantia.expediente, par.caso.codigo,
      this.usuarioActual(), this.observacion());
    if (typeof r === 'string') { this.toast.error('No se pudo generar la revisión', r); return; }
    this.toast.ok(`Revisión técnica ${r.id} generada`,
      'Queda pendiente de asignación: el Encargado la asigna a un Técnico de Hardware. No se creó un Expediente técnico nuevo.');
    this.refrescar(par.garantia);
    this.enviar.set(null);
  }

  protected abrirValidacion(g: Garantia, c: CasoGarantia): void {
    this.vCorreccion.set('');
    this.vFunciona.set('');
    this.vEvidencia.set('');
    this.vObs.set('');
    this.validar.set({ garantia: g, caso: c });
  }

  protected guardarValidacion(par: { garantia: Garantia; caso: CasoGarantia }): void {
    const error = this.data.validarGarantiaTrasRevision(par.garantia.expediente, par.caso.codigo, {
      correccionRealizada: this.vCorreccion(), equipoFunciona: this.vFunciona(),
      evidenciaRevisada: this.vEvidencia(), observacion: this.vObs()
    }, this.usuarioActual());
    if (error) { this.toast.error('No se pudo validar la revisión', error); return; }
    this.toast.ok('Revisión validada por Soporte', 'El caso de garantía ya puede cerrarse.');
    this.refrescar(par.garantia);
    this.validar.set(null);
  }

  private refrescar(g: Garantia): void {
    this.seleccion.set(this.data.garantias().find((x) => x.expediente === g.expediente) ?? null);
  }
}
