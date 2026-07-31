import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CasoActivoService } from '../../core/services/caso-activo.service';
import { CasoGarantia, Garantia, TipoComentarioCaso } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';

/**
 * Servicio de garantía: los Expedientes únicos aceptados por el usuario final aparecen aquí
 * automáticamente (nadie los registra a mano). Cada caso se asocia al Expediente único y un
 * expediente puede tener varios casos.
 */
@Component({
  selector: 'app-garantia',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, ModalComponent],
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

                @if ((c.estado === 'Abierto' || c.estado === 'En revisión') && !vencida(g) && !esTecHardware()) {
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
          <div class="field mb-2">
            <label>Evidencia técnica <span class="hint">(opcional)</span></label>
            <input class="control" placeholder="Ej.: captura de diagnóstico" [(ngModel)]="evidencia" />
          </div>
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
  private readonly toast = inject(ToastService);
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

  protected cerrar(g: Garantia, c: CasoGarantia): void {
    const u = this.auth.usuario();
    this.data.cerrarCasoGarantia(g.expediente, c.codigo, this.resultado().trim(), this.evidencia().trim(), `${u?.nombre} — ${u?.rol}`);
    this.toast.ok('Caso cerrado', 'El resultado de la revisión quedó registrado en el Expediente único.');
    this.seleccion.set(this.data.garantias().find((x) => x.expediente === g.expediente) ?? null);
    this.cierre.set(null);
  }
}
