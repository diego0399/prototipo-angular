import { Component, computed, inject, input, output, signal } from '@angular/core';
import { DataService } from '../core/services/data.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { BadgeComponent, ModalComponent } from './ui';

/**
 * Visor de la **Constancia de Corrección F0302 por Inconformidad**. Es el hermano del visor de la
 * constancia de reproceso y vive en `shared` por la misma razón: el documento debe verse igual
 * desde el historial técnico, el expediente único, el detalle del equipo, Documentos generados y
 * la trazabilidad.
 *
 * No genera nada: la constancia se crea al firmar la corrección. Aquí solo se consulta, se
 * descarga y se registra quién la abrió.
 */
@Component({
  selector: 'ui-constancia-correccion',
  imports: [BadgeComponent, ModalComponent],
  styles: `
    .doc-hoja {
      background: var(--bg-1, #fff); border: 1px solid var(--line); border-radius: 8px;
      padding: 18px 20px; max-height: 58vh; overflow: auto;
      font-family: var(--font-mono, monospace); font-size: 12.5px; line-height: 1.65;
      white-space: pre-wrap; color: var(--tx-1, #1b2430);
    }
    .doc-firma { border: 1px dashed var(--line-strong); border-radius: 8px; padding: 12px 14px; margin-top: 12px; }
    .doc-firma .f-nombre { font-family: var(--font-brand, cursive); font-size: 19px; color: var(--navy-900); }
  `,
  template: `
    @if (abierto() && correccion(); as c) {
      <ui-modal [titulo]="'Constancia de Corrección F0302 por Inconformidad · ' + c.id" (cerrar)="cerrar()">
        @if (documento(); as d) {
          <div class="row-between mb-2" style="flex-wrap: wrap; gap: 10px;">
            <div>
              <b class="mono">{{ d.codigo }}</b>
              <p class="small muted">
                Generada por {{ d.generadoPor }} · {{ d.fecha }} {{ d.hora }} · huella {{ d.hash }}
              </p>
            </div>
            <ui-badge [estado]="d.estado ?? 'Generado'" />
          </div>

          @if (soloFirma()) {
            @if (c.firma; as f) {
              <div class="doc-firma">
                <div class="f-nombre">{{ f.firma }}</div>
                <div class="small muted">{{ f.nombre }} · {{ f.cargo }} · {{ f.unidad }}</div>
                <div class="small muted">Firmado el {{ f.fecha }} a las {{ f.hora }}</div>
                <div class="small muted">Resultado: {{ c.resultado }}</div>
              </div>
            }
          } @else {
            <div class="doc-hoja">{{ texto() }}</div>
          }

          <div class="row mt-2" style="justify-content: flex-end; flex-wrap: wrap;">
            <button class="btn btn-outline btn-sm" (click)="soloFirma.set(!soloFirma())">
              {{ soloFirma() ? 'Ver documento completo' : 'Ver firma' }}
            </button>
            <button class="btn btn-primary btn-sm" (click)="descargar()">Descargar documento</button>
          </div>
          <span class="hint">
            Descarga simulada del prototipo. La constancia queda guardada en el expediente: consultarla
            de nuevo abre esta misma, no genera otra.
          </span>
        } @else {
          <div class="alert warn">
            <span class="alert-ico">!</span>
            <span>
              Esta corrección todavía no tiene constancia: se genera al <b>firmarla</b> el Técnico de
              Soporte. Estado actual: <b>{{ c.estado }}</b>.
            </span>
          </div>
        }
      </ui-modal>
    }
  `
})
export class ConstanciaCorreccionComponent {
  private readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Código de la corrección cuya constancia se muestra; vacío cierra el visor. */
  readonly idCorreccion = input<string>('');
  readonly cerrado = output<void>();

  protected soloFirma = signal(false);

  protected readonly abierto = computed(() => !!this.idCorreccion());
  protected readonly correccion = computed(() => this.data.correccionDe(this.idCorreccion()));
  protected readonly documento = computed(() => this.data.constanciaDeCorreccion(this.idCorreccion()));
  protected readonly texto = computed(() => {
    const lineas = this.data.constanciaCorreccionF0302(this.idCorreccion());
    return typeof lineas === 'string' ? lineas : lineas.join('\n');
  });

  private get usuarioActual(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  /** Deja constancia de la consulta al cerrar: abrir y mirar también es un acceso al documento. */
  protected cerrar(): void {
    if (this.documento()) this.data.registrarConsultaConstanciaCorreccion(this.idCorreccion(), this.usuarioActual);
    this.soloFirma.set(false);
    this.cerrado.emit();
  }

  protected descargar(): void {
    const lineas = this.data.constanciaCorreccionF0302(this.idCorreccion());
    if (typeof lineas === 'string') { this.toast.error('No se puede abrir la constancia', lineas); return; }
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.documento()?.codigo ?? 'Constancia-Correccion'}-${this.idCorreccion()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.data.registrarConsultaConstanciaCorreccion(this.idCorreccion(), this.usuarioActual, true);
    this.toast.ok('Constancia descargada',
      `${this.documento()?.codigo} — la constancia sigue disponible en el expediente para consultarla luego.`);
  }
}
