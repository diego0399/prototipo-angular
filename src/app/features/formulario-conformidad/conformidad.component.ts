import { Component, computed, inject, input, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Conformidad } from '../../core/models/models';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { BadgeComponent } from '../../shared/ui';

/**
 * Vista EXTERNA del formulario de conformidad. Simula el enlace único que el
 * usuario final recibe en su correo institucional. No tiene menú, roles ni
 * sesión: el usuario final no posee acceso a SISGOST.
 */
@Component({
  selector: 'app-conformidad',
  imports: [FormsModule, SlicePipe, BadgeComponent],
  styles: `
    :host { display: block; min-height: 100vh; background: var(--bg); }
    .banda {
      background: linear-gradient(135deg, var(--navy-950), var(--navy-800));
      color: var(--tx-inv); padding: 22px 20px;
    }
    .banda-in { max-width: 760px; margin: 0 auto; display: flex; align-items: center; gap: 16px; }
    .banda img { height: 40px; }
    .banda .b-name { font-family: var(--font-brand); font-size: 22px; color: #fff; }
    .banda .b-sub { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #9fb4d4; }

    .cuerpo { max-width: 760px; margin: 26px auto 60px; padding: 0 20px; display: grid; gap: 16px; }
    .aviso { font-size: 12.5px; color: var(--tx-2); background: var(--gold-100); border: 1px solid #e4d193; border-radius: var(--r-md); padding: 12px 16px; }

    .resumen { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--r-md); padding: 14px 16px; font-size: 13px; color: var(--tx-2); }
    .reenvio { border-left: 3px solid var(--gold-600); background: var(--gold-100); border-radius: 0 10px 10px 0; padding: 12px 16px; }
    .reenvio .rv-cap { font-size: 10.5px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--gold-600); margin-bottom: 6px; }
    .firma-sim {
      max-width: 380px; margin: 18px auto 0; text-align: left;
      border: 1px dashed var(--line-strong); border-radius: var(--r-md); background: var(--surface-2); padding: 14px 18px;
    }
    .firma-sim .fs-cap { font-size: 10.5px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: var(--gold-600); margin-bottom: 6px; }
    .firma-sim .fs-nombre { font-family: var(--font-brand); font-size: 21px; color: var(--navy-900); border-bottom: 1px solid var(--tx-2); padding-bottom: 4px; margin-bottom: 6px; }
    .firma-sim .fs-det { font-size: 11.5px; color: var(--tx-3); line-height: 1.6; }
    .gracias { text-align: center; padding: 40px 20px; }
    .gracias .g-ico { width: 64px; height: 64px; margin: 0 auto 14px; border-radius: 50%; display: grid; place-items: center; font-size: 28px; background: var(--ok-bg); color: var(--ok); border: 2px solid var(--ok-line); }
    .gracias.mala .g-ico { background: var(--warn-bg); color: var(--warn); border-color: var(--warn-line); }
  `,
  template: `
    <header class="banda">
      <div class="banda-in">
        <img src="assets/logos/LogoCNR_white.png" alt="CNR" />
        <div>
          <div class="b-name">SISGOST</div>
          <div class="b-sub">Formulario de conformidad de recepción de equipo</div>
        </div>
      </div>
    </header>

    <main class="cuerpo">
      @if (conf(); as c) {
        <p class="aviso">
          Este formulario fue generado automáticamente por <b>SISGOST</b> para registrar la conformidad de
          recepción del equipo. El usuario final no posee acceso al sistema; únicamente responde este
          formulario mediante el enlace enviado a su correo institucional.
        </p>

        <div class="card">
          <div class="card-head">
            <div>
              <h2>Recepción de equipo — {{ c.usuarioFinal }}</h2>
              <p class="sub">Enlace único {{ c.token }} · válido hasta {{ c.vence }}</p>
            </div>
            <ui-badge [estado]="c.estado" />
          </div>
          <div class="card-body">
            <div class="grid grid-2 mb-2">
              <dl class="dl">
                <dt>Usuario final</dt><dd>{{ c.usuarioFinal }}</dd>
                <dt>Correo institucional</dt><dd>{{ c.correo }}</dd>
                <dt>Dirección / unidad</dt><dd>{{ c.unidad }}</dd>
                <dt>Fecha de entrega</dt><dd>{{ c.fechaEntrega }}</dd>
              </dl>
              <dl class="dl">
                <dt>Equipo asignado</dt><dd>{{ c.equipo }}</dd>
                <dt>Marca y modelo</dt><dd>{{ c.marcaModelo }}</dd>
                <dt>Número de inventario</dt><dd>{{ c.inventario }}</dd>
                <dt>Nombre del equipo</dt><dd>{{ nombreEquipo(c) }}</dd>
                <dt>Reserva de IP</dt><dd>{{ reservaIP(c) }}</dd>
                <dt>IP reservada</dt><dd>{{ ipReservada(c) }}</dd>
                @if (reservaIP(c) === 'Sí') {
                  <dt>MAC del equipo</dt><dd>{{ macEquipo(c) }}</dd>
                  <dt>Solicitud de reserva de IP</dt><dd>{{ estadoSolicitudIP(c) }}</dd>
                } @else if (reservaIP(c) === 'No') {
                  <dt>Justificación de no reserva</dt><dd>{{ justificacionIP(c) }}</dd>
                }
                @if (validacionIP(c); as v) { <dt>Reserva validada por</dt><dd>{{ v }}</dd> }
                <dt>Entregado por</dt><dd>{{ c.tecnicoEntrega }}</dd>
              </dl>
            </div>

            <div class="resumen">
              <b>Resumen del F0302 (configuración del equipo):</b> {{ c.resumenF0302 }}
            </div>

            @if (intentoActual(); as ia) {
              @if (ia.numero > 1) {
                <div class="reenvio">
                  <div class="rv-cap">Formulario reenviado · intento de aceptación #{{ ia.numero }}</div>
                  @if (intentoAnterior(); as prev) {
                    <p class="small"><b>Su observación anterior:</b> «{{ prev.observacion }}»</p>
                  }
                  @if (ia.correccionRealizada) {
                    <p class="small mt-1"><b>Corrección realizada por Soporte:</b> {{ ia.correccionRealizada }}</p>
                  }
                  <p class="small muted mt-1">Revise el equipo nuevamente y confirme si la corrección resolvió su observación.</p>
                </div>
              }
            }

            @if (!respondido()) {
              <hr class="divider" />

              <div class="field mb-2">
                <label>Su respuesta <span class="req">*</span></label>
                <div class="opt-row">
                  <label class="opt" [class.on]="respuesta() === 'acepta'">
                    <input type="radio" name="resp" value="acepta" [checked]="respuesta() === 'acepta'" (change)="respuesta.set('acepta')" />
                    Acepto la recepción del equipo
                  </label>
                  <label class="opt" [class.on]="respuesta() === 'noconforme'">
                    <input type="radio" name="resp" value="noconforme" [checked]="respuesta() === 'noconforme'" (change)="respuesta.set('noconforme')" />
                    No estoy conforme
                  </label>
                </div>
              </div>

              @if (respuesta() === 'noconforme') {
                <div class="alert warn mb-2">
                  <span class="alert-ico">!</span>
                  <span>Si registra una inconformidad, la entrega quedará <b>observada</b> y el expediente <b>pendiente de corrección</b> por la unidad de Soporte; <b>no se habilita la garantía</b> hasta que acepte formalmente. La observación es obligatoria.</span>
                </div>
              }

              <div class="field mb-2">
                <label>Observaciones @if (respuesta() === 'noconforme') { <span class="req">*</span> } @else { <span class="hint">(opcional)</span> }</label>
                <textarea class="control" rows="3" [placeholder]="respuesta() === 'noconforme' ? 'Describa por qué no está conforme (obligatorio): software faltante, falla, accesorio, acceso, etc.' : 'Escriba aquí cualquier observación sobre el equipo recibido…'" [(ngModel)]="observaciones"></textarea>
                @if (respuesta() === 'noconforme' && observaciones().trim().length < 3) {
                  <span class="hint" style="color: var(--danger);">Debe registrar una observación para marcar No conforme.</span>
                }
              </div>

              <label class="opt mb-2" [class.on]="acepto()" style="display: flex;">
                <input type="checkbox" [checked]="acepto()" (change)="acepto.set(!acepto())" />
                Acepto los términos de uso institucional del equipo asignado <span class="req">*</span>
              </label>

              <div class="field mb-2">
                <label>Firma / confirmación (escriba su nombre) <span class="req">*</span></label>
                <input class="control" [placeholder]="c.usuarioFinal" [(ngModel)]="firma" />
              </div>

              <button class="btn btn-primary btn-lg" style="width: 100%" (click)="enviar()" [disabled]="!puedeEnviar()">
                Enviar respuesta
              </button>
            } @else {
              <div class="gracias" [class.mala]="conf()?.estado === 'No conforme'">
                <div class="g-ico">{{ conf()?.estado === 'No conforme' ? '!' : '✓' }}</div>
                <h2>{{ conf()?.estado === 'No conforme' ? 'Inconformidad registrada' : 'Conformidad registrada' }}</h2>
                <p class="muted mt-1" style="max-width: 52ch; margin-inline: auto;">
                  @if (conf()?.estado === 'No conforme') {
                    Su inconformidad quedó registrada con fecha y hora. La entrega queda <b>observada</b> y la unidad de
                    Soporte atenderá la corrección; una vez corregida recibirá <b>nuevamente</b> este formulario para su
                    aceptación. La garantía no inicia hasta que acepte formalmente.
                  } @else {
                    Gracias, {{ c.usuarioFinal }}. Su aceptación quedó registrada con fecha y hora, se anexó al
                    expediente único del equipo y dio inicio al servicio de garantía de un mes.
                  }
                </p>
                <p class="small muted mt-2">Respuesta: «{{ conf()?.respuesta }}» · {{ conf()?.fechaRespuesta | slice: 0:10 }}</p>
                @if (conf()?.estado === 'Aceptado') {
                  <div class="firma-sim">
                    <div class="fs-cap">Firma de conformidad simulada</div>
                    <div class="fs-nombre">{{ conf()?.firmaUsuarioFinal || c.usuarioFinal }}</div>
                    <div class="fs-det">
                      Firmado electrónicamente por el usuario final<br />
                      Correo institucional: {{ c.correo }}<br />
                      Fecha de aceptación: {{ conf()?.fechaRespuesta | slice: 0:10 }} · {{ conf()?.fechaRespuesta | slice: 11:16 }}
                    </div>
                  </div>
                  <p class="small muted mt-2">La firma quedó asociada al Expediente único, al documento de Entrega y aceptación y al F0302.</p>
                } @else {
                  <p class="small muted mt-1">Al registrar una inconformidad <b>no se genera firma de aceptación</b>; el caso queda pendiente de revisión.</p>
                }
                <p class="small muted mt-2">Ya puede cerrar esta ventana.</p>
              </div>
            }
          </div>
        </div>
      } @else {
        <div class="card card-pad" style="text-align:center;">
          <h2>Enlace no válido</h2>
          <p class="muted mt-1">El enlace de conformidad no existe o ya expiró. Solicite un reenvío a la unidad de Soporte.</p>
        </div>
      }
    </main>
  `
})
export class ConformidadComponent {
  protected readonly data = inject(DataService);
  private readonly toast = inject(ToastService);

  /** Token del enlace único (ruta /formulario-conformidad/:token). */
  readonly token = input.required<string>();

  protected respuesta = signal<'' | 'acepta' | 'noconforme'>('');
  protected observaciones = signal('');
  protected acepto = signal(false);
  protected firma = signal('');

  protected readonly conf = computed(() => this.data.conformidadPorToken(this.token()));
  protected readonly respondido = computed(() => {
    const c = this.conf();
    return !!c && (c.estado === 'Aceptado' || c.estado === 'No conforme');
  });

  // El formulario muestra el nombre del equipo y la reserva de IP con que quedó configurado: son
  // datos que el usuario final debe poder verificar antes de aceptar la recepción. Se leen del
  // propio formulario (congelados al enviarlo) y, si se envió antes de esta regla, del F0302.
  private datosF0302(c: Conformidad) {
    return this.data.configuracionDe(c.expediente)?.datos;
  }
  protected nombreEquipo(c: Conformidad): string {
    return (c.nombreEquipo || this.datosF0302(c)?.nombrePC || '').trim() || '—';
  }
  protected reservaIP(c: Conformidad): string {
    return c.requiereReservaIP || this.datosF0302(c)?.requiereReservaIP || '—';
  }
  protected ipReservada(c: Conformidad): string {
    const requiere = this.reservaIP(c);
    if (requiere === 'No') return 'No aplica';
    if (requiere !== 'Sí') return '—';
    return (c.ipReservada || this.datosF0302(c)?.ipReservada || '').trim() || '—';
  }
  protected macEquipo(c: Conformidad): string {
    return (c.macEquipo || this.datosF0302(c)?.macEquipo || '').trim() || '—';
  }
  /** Estado de la solicitud enviada al Departamento de Servidores para reservar la IP. */
  protected estadoSolicitudIP(c: Conformidad): string {
    return c.estadoSolicitudIP || this.datosF0302(c)?.estadoSolicitudIP || '—';
  }
  protected justificacionIP(c: Conformidad): string {
    return (c.justificacionSinReservaIP || this.datosF0302(c)?.justificacionSinReservaIP || '').trim() || '—';
  }
  /** Quién validó la reserva en el modal previo al envío y cuándo; vacío si el dato no se guardó. */
  protected validacionIP(c: Conformidad): string {
    const por = c.ipValidadaPor || this.datosF0302(c)?.ipValidadaPor || '';
    const el = c.ipValidadaEl || this.datosF0302(c)?.ipValidadaEl || '';
    return por ? `${por}${el ? ` · ${el}` : ''}` : '';
  }

  /** Intento de aceptación vigente (el que porta este token del formulario). */
  protected readonly intentoActual = computed(() => {
    const c = this.conf();
    return c ? this.data.intentosDe(c.expediente).find((i) => i.token === this.token()) : undefined;
  });
  /** Intento inmediatamente anterior: aporta la observación previa del usuario final en un reenvío. */
  protected readonly intentoAnterior = computed(() => {
    const c = this.conf();
    const num = this.intentoActual()?.numero;
    return c && num && num > 1 ? this.data.intentosDe(c.expediente).find((i) => i.numero === num - 1) : undefined;
  });

  protected puedeEnviar(): boolean {
    if (!this.respuesta() || !this.acepto() || this.firma().trim().length <= 2) return false;
    // La observación es obligatoria cuando el usuario final marca No conforme.
    if (this.respuesta() === 'noconforme' && this.observaciones().trim().length < 3) return false;
    return true;
  }

  protected enviar(): void {
    if (!this.puedeEnviar()) return;
    this.data.responderConformidad(this.token(), this.respuesta() === 'acepta', this.observaciones().trim(), this.firma().trim());
    this.toast.ok('Respuesta enviada', 'Su respuesta quedó registrada en el expediente único del equipo.');
  }
}
