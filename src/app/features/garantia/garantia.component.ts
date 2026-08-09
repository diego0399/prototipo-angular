import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import {
  CasoGarantia, Garantia, ReprocesoF0288, RespuestaSiNo, TipoComentarioCaso
} from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { EvidenciasComponent } from '../../shared/evidencias';

/**
 * Servicio de garantía: los Expedientes únicos aceptados por el usuario final aparecen aquí
 * automáticamente (nadie los registra a mano). Cada caso se asocia al Expediente único y un
 * expediente puede tener varios casos.
 */
@Component({
  selector: 'app-garantia',
  imports: [FormsModule, RouterLink, BadgeComponent, HelpTipComponent, ModalComponent, EvidenciasComponent],
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
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Entrega y garantía</div>
          <h1>
            Servicio de garantía
            <ui-help texto="Cuando el usuario final acepta el equipo, el Expediente único aparece aquí automáticamente con su garantía de un mes vigente. Cada caso de garantía se asocia al Expediente único; un expediente puede tener varios casos." />
          </h1>
          <p class="page-sub">Seguimiento de casos posteriores a la entrega.</p>
        </div>
      </div>

      <div class="alert mb-2">
        <span class="alert-ico">i</span>
        <span>Los expedientes se registran aquí <b>automáticamente</b> cuando el usuario final acepta el equipo mediante el formulario externo. No se crean manualmente.</span>
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
                  <div class="mono">{{ g.fechaInicio }} → {{ g.fechaVencimiento }}</div>
                  <div class="progress mt-1" style="max-width: 130px;" [class.ok]="g.estado === 'Vigente'">
                    <span [style.width.%]="avance(g)"></span>
                  </div>
                </td>
                <td><ui-badge [estado]="g.estado" /></td>
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
              @if (!esTecHardware()) {
                <button class="btn btn-primary btn-sm" [disabled]="!puedeAbrirCaso(g)" (click)="abrirRegistro(g)">Abrir caso de garantía</button>
              }
              <ui-badge [estado]="vencida(g) ? 'Garantía vencida' : g.estado" />
            </div>
          </div>
          <div class="card-body">
            <div class="g-fechas">
              <span>Aceptado: <b>{{ g.fechaAceptacion }}</b></span>
              <span>Garantía: <b>{{ g.fechaInicio }} → {{ g.fechaVencimiento }}</b></span>
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
            <label>Responsable de atención</label>
            <input class="control" readonly [value]="auth.usuario()?.nombre + ' — ' + auth.usuario()?.rol" />
          </div>
          <div class="alert mb-2">
            <span class="alert-ico">i</span>
            <span>El caso quedará asociado al <b>Expediente único</b> del equipo y registrado en la trazabilidad.</span>
          </div>
          <div class="row" style="justify-content: flex-end;">
            <button class="btn btn-primary" [disabled]="!motivo() || !descripcion().trim()" (click)="registrarCaso(g)">Abrir caso</button>
          </div>
        </ui-modal>
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

  protected puedeAbrirCaso(g: Garantia): boolean {
    return (g.estado === 'Vigente' || g.estado === 'Caso abierto') && !this.vencida(g);
  }

  protected avance(g: Garantia): number {
    const ini = new Date(g.fechaInicio).getTime();
    const fin = new Date(g.fechaVencimiento).getTime();
    const hoy = Date.now();
    if (hoy >= fin) return 100;
    if (hoy <= ini) return 2;
    return Math.round(((hoy - ini) / (fin - ini)) * 100);
  }

  protected verExpediente(g: Garantia): void {
    this.casoActivo.seleccionar(g.expediente);
    this.router.navigate(['/expediente-unico'], { queryParams: { expediente: g.expediente } });
  }

  protected abrirRegistro(g: Garantia): void {
    this.motivo.set('');
    this.descripcion.set('');
    this.abrirCaso.set(g);
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
    const caso = this.data.registrarCasoGarantia(g.expediente, this.motivo(), this.descripcion().trim(), `${u?.nombre} — ${u?.rol}`);
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
