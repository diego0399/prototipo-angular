import { Component, ElementRef, computed, inject, input, output } from '@angular/core';
import { FirmaProceso } from '../core/models/models';
import { EvidenciaVista, EvidenciasComponent } from './evidencias';
import { IconComponent } from './icon';

/** Dato con etiqueta de una sección del documento («Número de inventario: HW-0142»). */
export interface CampoDoc {
  etiqueta: string;
  valor: string;
  /** Códigos, inventarios y huellas se imprimen en tipografía de ancho fijo. */
  mono?: boolean;
  /** Ocupa el ancho completo de la sección; para observaciones y justificaciones largas. */
  ancho?: boolean;
}

/** Ítem de un checklist tal como se imprime en el documento. */
export interface ItemDoc {
  nombre: string;
  estado: string;
  nota?: string;
}

/**
 * Sección de un documento. La sección se compone de lo que el emisor le ponga: datos con etiqueta,
 * una tabla, un checklist, un párrafo, o varias de esas cosas a la vez y en ese orden.
 */
export interface SeccionDoc {
  titulo: string;
  campos?: CampoDoc[];
  columnas?: string[];
  filas?: string[][];
  items?: ItemDoc[];
  texto?: string;
  /** Línea al pie de la sección: aclaraciones y advertencias del propio documento. */
  nota?: string;
}

/**
 * **Visor de documentos** del prototipo: la ventana donde se abre cualquier documento generado
 * —F0288, F0302, las tres constancias, el descargo, la entrega y el reporte final—.
 *
 * Existe por una razón concreta: los documentos se veían como una tarjeta más del panel, y una
 * tarjeta no se puede presentar en una reunión ni imprimir. Aquí se abren sobre una hoja blanca con
 * encabezado institucional, márgenes, tipografía formal, secciones numeradas, firmas y pie de
 * página, y esa hoja es lo único que sale por la impresora.
 *
 * No conoce ningún proceso ni consulta nada: recibe las secciones ya armadas y las dibuja. Por eso
 * los ocho documentos se ven iguales entre sí, que era justamente lo que no ocurría cuando cada
 * pantalla dibujaba el suyo.
 */
@Component({
  selector: 'ui-visor-documento',
  imports: [IconComponent, EvidenciasComponent],
  template: `
    @if (abierto()) {
      <div class="visor" role="dialog" aria-modal="true">
        <div class="visor-barra">
          <div class="vb-id">
            <ui-icon class="vb-ico" name="file" [size]="20" />
            <div>
              <div class="vb-nombre">{{ nombre() }}</div>
              <div class="vb-meta">
                {{ codigo() || 'Sin código' }}@if (fecha()) { · {{ fecha() }}@if (hora()) { {{ hora() }} } }
              </div>
            </div>
          </div>
          @if (firmas().length) {
            <button class="btn btn-ghost btn-sm" type="button" (click)="irA('firmas')">
              <ui-icon name="pen" [size]="14" /> Ver firmas registradas
            </button>
          }
          @if (evidencias().length) {
            <button class="btn btn-ghost btn-sm" type="button" (click)="irA('evidencias')">
              <ui-icon name="image" [size]="14" /> Ver evidencias asociadas
            </button>
          }
          @if (imprimible()) {
            <button class="btn btn-outline btn-sm" type="button" (click)="imprimir()">
              <ui-icon name="file" [size]="14" /> Imprimir
            </button>
          }
          @if (descargable()) {
            <button class="btn btn-primary btn-sm" type="button" (click)="descargar.emit()">
              <ui-icon name="download" [size]="14" /> Descargar documento
            </button>
          }
          <button class="btn btn-ghost btn-sm" type="button" (click)="cerrar.emit()">
            <ui-icon name="x" [size]="14" /> Cerrar vista previa
          </button>
        </div>

        <div class="visor-area">
          <article class="hoja">
            <header class="hoja-cab">
              <img src="assets/logos/LogoCNR.png" alt="Centro Nacional de Registros" />
              <div class="hoja-inst">
                <div class="h-org">Centro Nacional de Registros</div>
                <div class="h-sis">SISGOST — Sistema de Gestión y Seguimiento de Soporte Técnico</div>
                <div class="h-mod">Gestión de Equipos</div>
              </div>
              <div class="hoja-ref">
                @if (codigo()) { <div class="r-cod">{{ codigo() }}</div> }
                @if (fecha()) { <div>{{ fecha() }}@if (hora()) { · {{ hora() }} }</div> }
                @if (paginaDe()) { <div>{{ paginaDe() }}</div> }
              </div>
            </header>

            <div class="hoja-tit">
              <h1>{{ nombre() }}</h1>
              @if (subtitulo()) { <p>{{ subtitulo() }}</p> }
            </div>
            <div class="hoja-regla"></div>

            <table class="hoja-ident">
              <tbody>
                <tr>
                  <th>Código del documento</th>
                  <td class="mono">{{ codigo() || 'Sin código asignado' }}</td>
                  <th>Fecha de generación</th>
                  <td class="mono">{{ fecha() || '—' }}@if (hora()) { · {{ hora() }} }</td>
                </tr>
                <tr>
                  <th>Generado por</th>
                  <td>{{ generadoPor() || '—' }}</td>
                  <th>Estado del documento</th>
                  <td>{{ estado() || 'Generado' }}</td>
                </tr>
                @if (referencia()) {
                  <tr>
                    <th>Proceso de referencia</th>
                    <td colspan="3" class="mono">{{ referencia() }}</td>
                  </tr>
                }
              </tbody>
            </table>

            @for (s of secciones(); track s.titulo; let i = $index) {
              <section class="hoja-sec">
                <h2><span class="s-num">{{ numero(i) }}</span>{{ s.titulo }}</h2>

                @if (s.campos?.length) {
                  <dl class="hoja-campos">
                    @for (c of s.campos; track c.etiqueta) {
                      <div class="c" [class.ancho]="c.ancho">
                        <dt>{{ c.etiqueta }}</dt>
                        <dd [class.mono]="c.mono">{{ c.valor || '—' }}</dd>
                      </div>
                    }
                  </dl>
                }

                @if (s.items?.length) {
                  <ul class="hoja-check">
                    @for (k of s.items; track k.nombre) {
                      <li>
                        <span class="k-caja" [class.na]="k.estado === 'No aplica'">
                          @if (k.estado === 'Realizado' || k.estado === 'Sí') {
                            <ui-icon name="check" [size]="12" />
                          } @else if (k.estado === 'No aplica') { – }
                        </span>
                        <span class="k-txt">
                          {{ k.nombre }}
                          @if (k.nota) { <div class="k-nota">{{ k.nota }}</div> }
                        </span>
                        <span class="k-est">{{ k.estado }}</span>
                      </li>
                    }
                  </ul>
                }

                @if (s.filas?.length) {
                  <table class="hoja-tabla">
                    @if (s.columnas?.length) {
                      <thead><tr>@for (c of s.columnas; track c) { <th>{{ c }}</th> }</tr></thead>
                    }
                    <tbody>
                      @for (fila of s.filas; track $index) {
                        <tr>@for (celda of fila; track $index) { <td>{{ celda || '—' }}</td> }</tr>
                      }
                    </tbody>
                  </table>
                }

                @if (s.texto) { <p class="s-texto">{{ s.texto }}</p> }
                @if (s.nota) { <p class="s-nota">{{ s.nota }}</p> }
              </section>
            }

            @if (evidencias().length) {
              <section class="hoja-sec" data-ancla="evidencias">
                <h2><span class="s-num">{{ numero(secciones().length) }}</span>Evidencias asociadas</h2>
                <ui-evidencias [titulo]="tituloEvidencias()" [lista]="evidencias()" [editable]="false"
                  [puedeAdjuntar]="false" (visualizar)="verEvidencia.emit($event)" />
                @if (retiradas().length) {
                  <p class="s-nota">
                    El documento certificó además: {{ retiradas().join(' · ') }}. Ese archivo ya no está entre
                    las imágenes vigentes de la etapa.
                  </p>
                }
              </section>
            }

            @if (firmas().length) {
              <section class="hoja-sec" data-ancla="firmas">
                <h2><span class="s-num">{{ numero(secciones().length + (evidencias().length ? 1 : 0)) }}</span>Firmas registradas</h2>
                <div class="hoja-firmas">
                  @for (f of firmas(); track f.rotulo) {
                    <div class="hoja-firma">
                      <div class="fi-linea">
                        @if (f.estado === 'Capturada') {
                          <span class="fi-rubrica">{{ f.nombre }}</span>
                        } @else {
                          <span class="fi-vacia">{{ f.estado === 'No aplica' ? 'No aplica' : 'Pendiente de captura' }}</span>
                        }
                      </div>
                      <div class="fi-rot">{{ f.rotulo }}</div>
                      @if (f.estado === 'Capturada') {
                        <div class="fi-det">{{ f.nombre }}@if (f.rol) { — {{ f.rol }} }</div>
                        <div class="fi-det">Firmado electrónicamente el {{ f.fecha }}@if (f.hora) { a las {{ f.hora }} }</div>
                      } @else if (f.estado === 'No aplica') {
                        <div class="fi-det">{{ f.detalle || 'No corresponde firma para este documento.' }}</div>
                      } @else {
                        <div class="fi-det">La firma aún no se ha capturado en el proceso.</div>
                      }
                    </div>
                  }
                </div>
              </section>
            }

            <ng-content />

            <footer class="hoja-pie">
              <div class="p-txt">
                Centro Nacional de Registros · SISGOST — Gestión de Equipos<br />
                {{ notaPie() || 'Documento generado por el sistema. Las firmas electrónicas son simuladas: este es un prototipo de demostración.' }}
              </div>
              @if (huella()) { <div class="p-huella">Huella de integridad<br />{{ huella() }}</div> }
            </footer>
          </article>
        </div>
      </div>
    }
  `
})
export class VisorDocumentoComponent {
  private readonly host = inject(ElementRef<HTMLElement>);

  readonly abierto = input(false);
  /** Nombre del documento, tal como se imprime en la hoja. */
  readonly nombre = input.required<string>();
  readonly subtitulo = input('');
  readonly codigo = input('');
  readonly fecha = input('');
  readonly hora = input('');
  readonly generadoPor = input('');
  readonly estado = input('');
  readonly huella = input('');
  /** Proceso al que pertenece el documento (expediente único, caso de garantía…). */
  readonly referencia = input('');
  /** Numeración de hoja del documento («Hoja 1 de 1»); vacío la omite. */
  readonly paginaDe = input('');
  readonly secciones = input<SeccionDoc[]>([]);
  readonly evidencias = input<EvidenciaVista[]>([]);
  readonly tituloEvidencias = input('Imágenes de evidencia');
  /** Archivos que el documento certificó y que ya no están en la etapa. */
  readonly retiradas = input<string[]>([]);
  readonly firmas = input<FirmaProceso[]>([]);
  readonly notaPie = input('');
  readonly descargable = input(true);
  readonly imprimible = input(true);

  readonly cerrar = output<void>();
  readonly descargar = output<void>();
  readonly verEvidencia = output<string>();

  /** Numeración romana de las secciones: es lo que hace que la hoja se lea como un documento. */
  private readonly romanos = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X',
    'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX'];

  protected numero(i: number): string {
    return this.romanos[i] ?? String(i + 1);
  }

  protected readonly hayAnclas = computed(() => this.firmas().length > 0 || this.evidencias().length > 0);

  /** Lleva la lectura a las firmas o a las evidencias sin obligar a recorrer la hoja entera. */
  protected irA(ancla: 'firmas' | 'evidencias'): void {
    const el = (this.host.nativeElement as HTMLElement).querySelector(`[data-ancla="${ancla}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /**
   * Manda la hoja a la impresora. La regla `@media print` de los estilos globales deja fuera la
   * barra de acciones y el resto de la aplicación: sale la hoja, no la pantalla.
   */
  protected imprimir(): void {
    window.print();
  }
}
