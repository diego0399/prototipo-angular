import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ContextoEvidencia } from '../core/models/models';
import { EvidenciaService } from '../core/services/evidencia.service';
import { ModalComponent } from './ui';
import { IconComponent } from './icon';

/** Forma mínima que necesita la galería; sirve para las evidencias de cualquier módulo. */
export interface EvidenciaVista {
  archivo: string;
  tipo: string;
  fecha: string;
  hora?: string;
  cargadaPor: string;
  imagen?: string;
  /** Ítem o sección que la imagen respalda, cuando se cargó desde uno. */
  item?: string;
}

/**
 * Bloque de **imágenes de evidencia** de todo el sistema: la galería de lo adjunto, el formulario
 * de carga y el visor a tamaño grande.
 *
 * Es presentacional a propósito. No guarda nada ni conoce el proceso: recibe la lista y emite lo
 * que el usuario hizo, y cada pantalla lo conecta con su propia etapa. Así la regla de formato, el
 * catálogo de tipos y el aspecto son los mismos en F0288, F0302, correcciones, reprocesos,
 * garantía y descargo, sin copiar la validación seis veces.
 *
 * El tipo de evidencia se asigna solo: cada módulo entrega en `contextos` los ítems que puede
 * respaldar con su tipo, y el formulario pregunta **qué** se está respaldando, no cómo clasificarlo.
 * Con un solo contexto ni siquiera pregunta. El desplegable de tipos queda como respaldo para el
 * módulo que aún no declare los suyos.
 */
@Component({
  selector: 'ui-evidencias',
  imports: [FormsModule, ModalComponent, IconComponent],
  styles: `
    .ev-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(205px, 1fr)); gap: 12px; margin-top: 8px; }
    .ev-card { border: 1px solid var(--line); border-radius: 8px; padding: 8px; background: var(--bg-1, #fff); }
    .ev-thumb { display: block; width: 100%; height: 118px; object-fit: cover; border-radius: 6px; border: 1px solid var(--line); cursor: pointer; }
    .ev-sim { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
      border-style: dashed; background: var(--bg-2, #fafafa); color: var(--tx-3); font-size: 11px; font-weight: 700; letter-spacing: .06em; }
    .ev-sim .ev-sim-txt { font-weight: 400; letter-spacing: 0; font-size: 10.5px; text-align: center; padding: 0 6px; }
    .ev-datos { display: flex; flex-direction: column; gap: 2px; padding: 8px 2px 6px; font-size: 12px; }
    .ev-datos .chip { align-self: flex-start; }
    .ev-previa { width: 150px; height: 96px; cursor: default; }
    .ev-grande { max-width: 100%; max-height: 60vh; display: block; margin: 0 auto; border-radius: 8px; border: 1px solid var(--line); }
  `,
  template: `
    <div class="sec-title mt-3">{{ titulo() }} ({{ lista().length }})</div>
    @if (nota()) { <p class="hint">{{ nota() }}</p> }

    @if (obligatoria() && !lista().length && editable()) {
      <div class="alert warn">
        <span class="alert-ico">!</span>
        <span>{{ mensajeFalta() }} La evidencia visual respalda lo que se declaró en esta etapa.</span>
      </div>
    }

    <!-- La lista y el aviso de vacío son excluyentes: nunca se ven a la vez -->
    @if (lista().length) {
      <div class="ev-grid">
        @for (e of lista(); track e.archivo) {
          <div class="ev-card">
            @if (e.imagen) {
              <img class="ev-thumb" [src]="e.imagen" [alt]="e.archivo" (click)="abrir(e)" />
            } @else {
              <div class="ev-thumb ev-sim" (click)="abrir(e)">
                <ui-icon name="image" [size]="24" />
                <span>{{ evid.formatoDe(e.archivo).toUpperCase() || 'SIN FORMATO' }}</span>
                <span class="ev-sim-txt">Vista previa simulada</span>
              </div>
            }
            <div class="ev-datos">
              <b class="mono">{{ e.archivo }}</b>
              <span class="chip">{{ e.tipo }}</span>
              @if (e.item) { <span class="sub-cell">Ítem: {{ e.item }}</span> }
              <span class="sub-cell">{{ e.cargadaPor }}</span>
              <span class="sub-cell">{{ e.fecha }} {{ e.hora }}</span>
            </div>
            <div class="row" style="justify-content: flex-end; gap: 6px;">
              <button class="btn btn-ghost btn-sm" (click)="abrir(e)">Ver imagen</button>
              @if (editable()) {
                <button class="btn btn-ghost btn-sm" (click)="eliminar.emit(e.archivo)">Eliminar</button>
              }
            </div>
          </div>
        }
      </div>
    } @else {
      <p class="small muted">Sin evidencias adjuntas.</p>
    }

    <!-- El formulario general solo existe donde la imagen no nace de un ítem del checklist. En el
         F0288 y el F0302 se adjunta desde el ítem que la exige, y aquí solo se listan. -->
    @if (editable() && puedeAdjuntar()) {
      <div class="card card-pad mt-2">
        <b class="small">Adjuntar imágenes de evidencia</b>
        <p class="small muted">Adjunte fotografías o capturas relacionadas con la revisión o corrección realizada.</p>
        @if (sugeridas().length) {
          <p class="hint">Se esperan imágenes como: {{ sugeridas().join(' · ') }}.</p>
        }
        <div class="grid grid-2 mt-1">
          <div class="field">
            <label>Imagen <span class="req">*</span></label>
            <input type="file" hidden #arch accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              (change)="elegir(arch)" />
            <div class="row">
              <button class="btn btn-outline btn-sm" (click)="arch.click()">
                <ui-icon name="image" [size]="15" /> Subir imagen
              </button>
              @if (archivo()) { <span class="small mono">{{ archivo() }}</span> }
            </div>
            <span class="hint">Formatos permitidos: PNG, JPG, JPEG o WEBP.</span>
          </div>
          <!-- El técnico dice qué está respaldando; el tipo de evidencia sale de ahí. Con un solo
               contexto no hay nada que preguntar y se muestra como dato. -->
          <div class="field">
            <label>Ítem que respalda la imagen @if (contextos().length > 1) { <span class="req">*</span> }</label>
            @if (contextos().length > 1) {
              <select class="control" [ngModel]="item()" (ngModelChange)="item.set($event)">
                @for (c of contextos(); track c.nombre) { <option [value]="c.nombre">{{ c.nombre }}</option> }
              </select>
            } @else {
              <p class="small mb-0"><b>{{ item() || '—' }}</b></p>
            }
            <span class="hint">Tipo de evidencia: <span class="chip">{{ tipoEfectivo() || 'sin asignar' }}</span>
              se asigna automáticamente según el ítem.</span>
          </div>
        </div>
        @if (imagen(); as img) {
          <div class="row mt-1" style="align-items: flex-start; gap: 12px;">
            <img class="ev-thumb ev-previa" [src]="img" alt="Vista previa de la imagen seleccionada" />
            <div class="ev-datos">
              <span class="hint">Sin adjuntar todavía: <b>{{ archivo() }}</b> se registra al pulsar «Adjuntar imagen».</span>
              <span class="sub-cell">Tipo de evidencia: {{ tipoEfectivo() || '—' }}</span>
              @if (item()) { <span class="sub-cell">Ítem asociado: {{ item() }}</span> }
            </div>
          </div>
        }
        <div class="row" style="justify-content: flex-end;">
          <button class="btn btn-outline btn-sm" (click)="confirmar()">Adjuntar imagen</button>
        </div>
      </div>
    }

    @if (verImagen(); as e) {
      <ui-modal [titulo]="'Imagen de evidencia · ' + e.tipo" [sub]="e.archivo" (cerrar)="verImagen.set(null)">
        @if (e.imagen) {
          <img class="ev-grande" [src]="e.imagen" [alt]="e.archivo" />
        } @else {
          <div class="ev-grande ev-sim" style="height: 220px;">
            <ui-icon name="image" [size]="34" />
            <span>{{ evid.formatoDe(e.archivo).toUpperCase() || 'SIN FORMATO' }}</span>
            <span class="ev-sim-txt">Evidencia del set de demostración: se conserva la referencia, no se inventa la imagen.</span>
          </div>
        }
        <dl class="dl mt-2">
          <dt>Archivo</dt><dd class="mono">{{ e.archivo }}</dd>
          <dt>Tipo de evidencia</dt><dd>{{ e.tipo }}</dd>
          @if (e.item) { <dt>Ítem asociado</dt><dd>{{ e.item }}</dd> }
          <dt>Cargada por</dt><dd>{{ e.cargadaPor }}</dd>
          <dt>Fecha de carga</dt><dd>{{ e.fecha }} {{ e.hora }}</dd>
        </dl>
      </ui-modal>
    }
  `
})
export class EvidenciasComponent {
  protected readonly evid = inject(EvidenciaService);

  readonly lista = input<EvidenciaVista[]>([]);
  readonly titulo = input('Evidencias');
  /** Solo se puede adjuntar o eliminar mientras la etapa sigue abierta. */
  readonly editable = input(false);
  /** Si la imagen se adjunta desde el ítem del checklist, este bloque solo la lista. */
  readonly puedeAdjuntar = input(true);
  readonly obligatoria = input(false);
  /** Línea breve que dice qué imágenes exige la etapa, cuando las exige por ítem. */
  readonly nota = input('');
  readonly mensajeFalta = input('');
  /** Guía de qué imágenes se esperan en esta etapa. */
  readonly sugeridas = input<string[]>([]);
  /** Ítems que este módulo puede respaldar, cada uno con su tipo de evidencia. */
  readonly contextos = input<ContextoEvidencia[]>([]);

  readonly adjuntar = output<{ archivo: string; tipo: string; imagen: string; item: string }>();
  readonly eliminar = output<string>();
  readonly visualizar = output<string>();
  readonly error = output<string>();

  protected archivo = signal('');
  protected imagen = signal('');
  protected item = signal('');
  protected verImagen = signal<EvidenciaVista | null>(null);

  /**
   * Tipo con el que se guardará la imagen: el del ítem elegido. Queda vacío solo si el módulo no
   * declaró contextos, y entonces la validación lo frena en vez de guardar una imagen sin clasificar.
   */
  protected readonly tipoEfectivo = computed(() => {
    const lista = this.contextos();
    return lista.find((c) => c.nombre === this.item())?.tipo ?? lista[0]?.tipo ?? '';
  });

  constructor() {
    // Los contextos del reproceso cambian con el checklist: si el ítem elegido deja de existir,
    // vuelve al primero en vez de quedarse apuntando a una acción que ya no está marcada.
    effect(() => {
      const lista = this.contextos();
      const vigente = lista.some((c) => c.nombre === this.item());
      if (lista.length && !vigente) this.item.set(lista[0].nombre);
      if (!lista.length && this.item()) this.item.set('');
    });
  }

  protected abrir(e: EvidenciaVista): void {
    this.verImagen.set(e);
    this.visualizar.emit(e.archivo);
  }

  /**
   * Toma la imagen elegida y la reduce antes de entregarla. El prototipo guarda su estado completo
   * en el navegador: una fotografía de teléfono a tamaño original llenaría el espacio disponible y
   * el resto del expediente dejaría de guardarse.
   */
  protected async elegir(input: HTMLInputElement): Promise<void> {
    const archivo = input.files?.[0];
    input.value = '';
    if (!archivo) return;
    if (!this.evid.formatoValido(archivo.name)) {
      this.limpiar();
      this.error.emit(this.evid.MSG_FORMATO);
      return;
    }
    try {
      const leida = await this.evid.leerImagen(archivo);
      this.imagen.set(leida.imagen);
      this.archivo.set(leida.archivo);
    } catch {
      this.limpiar();
      this.error.emit('No se pudo leer la imagen. Intente con otro archivo PNG, JPG, JPEG o WEBP.');
    }
  }

  private limpiar(): void {
    this.archivo.set('');
    this.imagen.set('');
  }

  protected confirmar(): void {
    const error = this.evid.validarCarga(this.archivo(), this.tipoEfectivo());
    if (error) { this.error.emit(error); return; }
    this.adjuntar.emit({
      archivo: this.archivo(), tipo: this.tipoEfectivo(), imagen: this.imagen(), item: this.item()
    });
    this.limpiar();
  }
}
