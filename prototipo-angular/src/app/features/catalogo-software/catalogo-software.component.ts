import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { SoftwareCatalogo } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';

/** Estado editable del formulario de alta/edición (todo texto; se limpia y valida al guardar). */
interface FormularioSoftware {
  codigo: string;
  nombre: string;
  categoria: string;
  versionesTexto: string;
  versionVigente: string;
  aplicaCPU: boolean;
  aplicaLaptop: boolean;
  aplicaF0288: boolean;
  aplicaF0302: boolean;
  activo: boolean;
  observacion: string;
}

const FORM_VACIO: FormularioSoftware = {
  codigo: '', nombre: '', categoria: '', versionesTexto: '', versionVigente: '',
  aplicaCPU: true, aplicaLaptop: true, aplicaF0288: false, aplicaF0302: true,
  activo: true, observacion: ''
};

@Component({
  selector: 'app-catalogo-software',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, ModalComponent],
  styles: `
    .filtros { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .filtros input { max-width: 280px; }
    .chip-list { display: flex; flex-wrap: wrap; gap: 6px; }
    .v-chip {
      display: inline-block; font-size: 11.5px; border: 1px solid var(--line-strong); border-radius: 999px;
      padding: 2px 9px; color: var(--tx-2); background: var(--surface-2);
    }
    .v-chip.vigente { border-color: var(--gold-500); color: var(--gold-600); font-weight: 700; }
    .aplica-cell { display: flex; gap: 4px; flex-wrap: wrap; }
    .aplica-tag {
      font-size: 10.5px; font-weight: 700; letter-spacing: .03em; border-radius: 999px; padding: 2px 8px;
      border: 1px solid var(--line-strong); color: var(--tx-3);
    }
    .aplica-tag.on { border-color: var(--blue-500); color: var(--blue-600); background: var(--blue-050); }
    .form-check { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--navy-900); }
    .form-check input { width: 16px; height: 16px; accent-color: var(--navy-800); cursor: pointer; }
    .check-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px 16px; margin-top: 6px; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Gestión</div>
          <h1>
            Catálogo de software
            <ui-help texto="Controla qué software puede seleccionarse en F0288 y F0302 y qué versiones están permitidas para cada uno. Solo el software activo se ofrece para nuevas selecciones; desactivarlo no borra lo que ya quedó guardado en preparaciones o configuraciones anteriores." />
          </h1>
          <p class="page-sub">Software permitido y versiones autorizadas para preparación (F0288) y configuración (F0302).</p>
        </div>
        <button class="btn btn-gold" (click)="abrirNuevo()">＋ Agregar software</button>
      </div>

      <div class="card card-pad mb-3">
        <div class="filtros">
          <input class="control" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)"
            placeholder="Buscar por código o nombre…" />
          <select class="control" style="max-width: 220px;" [ngModel]="filtroCategoria()" (ngModelChange)="filtroCategoria.set($event)">
            <option value="Todas">Todas las categorías</option>
            @for (c of categorias(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
          <select class="control" style="max-width: 180px;" [ngModel]="filtroEstado()" (ngModelChange)="filtroEstado.set($event)">
            <option value="Todos">Activos e inactivos</option>
            <option value="Activo">Solo activos</option>
            <option value="Inactivo">Solo inactivos</option>
          </select>
          <span class="hint">{{ filas().length }} de {{ data.catalogoSoftware().length }} software(s)</span>
        </div>
      </div>

      <div class="card table-wrap">
        <table class="tbl">
          <thead>
            <tr>
              <th>Código</th><th>Software</th><th>Categoría</th><th>Versiones permitidas</th>
              <th>CPU</th><th>Laptop</th><th>F0288</th><th>F0302</th><th>Estado</th><th>Observación</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (s of filas(); track s.codigo) {
              <tr>
                <td class="mono main-cell">{{ s.codigo }}</td>
                <td class="main-cell">{{ s.nombre }}</td>
                <td>{{ s.categoria }}</td>
                <td>
                  <div class="chip-list">
                    @for (v of s.versionesPermitidas; track v) {
                      <span class="v-chip" [class.vigente]="v === s.versionVigente">{{ v }}</span>
                    }
                  </div>
                </td>
                <td><span class="aplica-tag" [class.on]="s.aplicaCPU">{{ s.aplicaCPU ? 'Sí' : 'No' }}</span></td>
                <td><span class="aplica-tag" [class.on]="s.aplicaLaptop">{{ s.aplicaLaptop ? 'Sí' : 'No' }}</span></td>
                <td><span class="aplica-tag" [class.on]="s.aplicaF0288">{{ s.aplicaF0288 ? 'Sí' : 'No' }}</span></td>
                <td><span class="aplica-tag" [class.on]="s.aplicaF0302">{{ s.aplicaF0302 ? 'Sí' : 'No' }}</span></td>
                <td><ui-badge [estado]="s.activo ? 'Activo' : 'Inactivo'" /></td>
                <td><span class="small muted">{{ s.observacion || '—' }}</span></td>
                <td style="text-align:right;">
                  <div class="row" style="justify-content: flex-end; gap: 6px;">
                    <button class="btn btn-outline btn-sm" (click)="abrirEditar(s)">Editar</button>
                    <button class="btn btn-ghost btn-sm" (click)="toggleEstado(s)">{{ s.activo ? 'Desactivar' : 'Activar' }}</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="11" class="muted" style="text-align:center; padding: 22px;">
                No hay software que coincida con la búsqueda o los filtros aplicados.
              </td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (modalAbierto(); as modo) {
        <ui-modal
          [titulo]="modo === 'nuevo' ? 'Agregar software al catálogo' : 'Editar software del catálogo'"
          sub="Código, versiones permitidas y aplicación a CPU/Laptop y F0288/F0302"
          (cerrar)="cerrarModal()">
          <div class="grid grid-2">
            <div class="field">
              <label>Código <span class="req">*</span></label>
              <input class="control mono" [ngModel]="form().codigo" (ngModelChange)="campo('codigo', $event)"
                [disabled]="modo !== 'nuevo'" placeholder="SOFT-008" />
              @if (modo !== 'nuevo') { <span class="hint">El código no se puede cambiar: es la clave que usan F0288 y F0302.</span> }
            </div>
            <div class="field">
              <label>Nombre del software <span class="req">*</span></label>
              <input class="control" [ngModel]="form().nombre" (ngModelChange)="campo('nombre', $event)" placeholder="Ej.: Cliente VPN" />
            </div>
            <div class="field">
              <label>Categoría <span class="req">*</span></label>
              <input class="control" [ngModel]="form().categoria" (ngModelChange)="campo('categoria', $event)" placeholder="Ej.: Seguridad" />
            </div>
            <div class="field">
              <label>Versión vigente <span class="req">*</span></label>
              <select class="control" [ngModel]="form().versionVigente" (ngModelChange)="campo('versionVigente', $event)">
                <option value="">Seleccione…</option>
                @for (v of versionesForm(); track v) { <option [value]="v">{{ v }}</option> }
              </select>
              <span class="hint">Debe estar incluida en las versiones permitidas.</span>
            </div>
          </div>
          <div class="field">
            <label>Versiones permitidas <span class="req">*</span></label>
            <textarea class="control mono" rows="4" [ngModel]="form().versionesTexto" (ngModelChange)="campo('versionesTexto', $event)"
              placeholder="Una versión por línea, por ejemplo:&#10;5.0&#10;5.1"></textarea>
            <span class="hint">Una versión por línea. La versión vigente debe coincidir exactamente con una de estas líneas.</span>
          </div>
          <div class="field">
            <label>Aplica a</label>
            <div class="check-grid">
              <label class="form-check"><input type="checkbox" [ngModel]="form().aplicaCPU" (ngModelChange)="campo('aplicaCPU', $event)" /> CPU</label>
              <label class="form-check"><input type="checkbox" [ngModel]="form().aplicaLaptop" (ngModelChange)="campo('aplicaLaptop', $event)" /> Laptop</label>
              <label class="form-check"><input type="checkbox" [ngModel]="form().aplicaF0288" (ngModelChange)="campo('aplicaF0288', $event)" /> F0288 (Preparación)</label>
              <label class="form-check"><input type="checkbox" [ngModel]="form().aplicaF0302" (ngModelChange)="campo('aplicaF0302', $event)" /> F0302 (Configuración)</label>
            </div>
            <span class="hint">Debe aplicar al menos a CPU o Laptop, y al menos a F0288 o F0302.</span>
          </div>
          <div class="field">
            <label class="form-check"><input type="checkbox" [ngModel]="form().activo" (ngModelChange)="campo('activo', $event)" /> Software activo</label>
            <span class="hint">Un software inactivo deja de ofrecerse para nuevas selecciones, pero no afecta lo ya seleccionado antes.</span>
          </div>
          <div class="field">
            <label>Observación</label>
            <textarea class="control" rows="2" [ngModel]="form().observacion" (ngModelChange)="campo('observacion', $event)"
              placeholder="Observación opcional…"></textarea>
          </div>
          <div class="row mt-2" style="justify-content: flex-end; gap: 10px;">
            <button class="btn btn-outline" (click)="cerrarModal()">Cancelar</button>
            <button class="btn btn-gold" (click)="guardar(modo)">Guardar software</button>
          </div>
        </ui-modal>
      }
    </div>
  `
})
export class CatalogoSoftwareComponent {
  protected readonly data = inject(DataService);
  protected readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  protected busqueda = signal('');
  protected filtroCategoria = signal('Todas');
  protected filtroEstado = signal<'Todos' | 'Activo' | 'Inactivo'>('Todos');
  protected modalAbierto = signal<'nuevo' | string | null>(null);
  protected form = signal<FormularioSoftware>({ ...FORM_VACIO });

  constructor() {
    // Consulta deliberada: se registra una sola vez al entrar a la pantalla, no en cada render.
    const u = this.auth.usuario();
    this.data.registrarConsultaCatalogoSoftware(`${u?.nombre} — ${u?.rol}`);
  }

  protected readonly categorias = computed(() => {
    const vistas: string[] = [];
    for (const s of this.data.catalogoSoftware()) {
      if (!vistas.includes(s.categoria)) vistas.push(s.categoria);
    }
    return vistas;
  });

  protected readonly filas = computed<SoftwareCatalogo[]>(() => {
    const q = this.busqueda().trim().toLowerCase();
    const cat = this.filtroCategoria();
    const est = this.filtroEstado();
    return this.data.catalogoSoftware().filter((s) => {
      if (q && !s.codigo.toLowerCase().includes(q) && !s.nombre.toLowerCase().includes(q)) return false;
      if (cat !== 'Todas' && s.categoria !== cat) return false;
      if (est === 'Activo' && !s.activo) return false;
      if (est === 'Inactivo' && s.activo) return false;
      return true;
    });
  });

  /** Versiones parseadas del textarea del formulario (una por línea, sin vacíos ni duplicados). */
  protected readonly versionesForm = computed(() => {
    const vistas: string[] = [];
    for (const raw of this.form().versionesTexto.split(/\r?\n/)) {
      const v = raw.trim();
      if (v && !vistas.includes(v)) vistas.push(v);
    }
    return vistas;
  });

  protected campo<K extends keyof FormularioSoftware>(clave: K, valor: FormularioSoftware[K]): void {
    this.form.update((f) => ({ ...f, [clave]: valor }));
  }

  protected abrirNuevo(): void {
    this.form.set({ ...FORM_VACIO });
    this.modalAbierto.set('nuevo');
  }

  protected abrirEditar(s: SoftwareCatalogo): void {
    this.form.set({
      codigo: s.codigo, nombre: s.nombre, categoria: s.categoria,
      versionesTexto: s.versionesPermitidas.join('\n'), versionVigente: s.versionVigente,
      aplicaCPU: s.aplicaCPU, aplicaLaptop: s.aplicaLaptop, aplicaF0288: s.aplicaF0288, aplicaF0302: s.aplicaF0302,
      activo: s.activo, observacion: s.observacion
    });
    this.modalAbierto.set(s.codigo);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(null);
  }

  protected guardar(modo: 'nuevo' | string): void {
    const f = this.form();
    const u = this.auth.usuario();
    const usuario = `${u?.nombre} — ${u?.rol}`;
    const datos: SoftwareCatalogo = {
      codigo: f.codigo, nombre: f.nombre, categoria: f.categoria,
      versionesPermitidas: this.versionesForm(), versionVigente: f.versionVigente,
      aplicaCPU: f.aplicaCPU, aplicaLaptop: f.aplicaLaptop, aplicaF0288: f.aplicaF0288, aplicaF0302: f.aplicaF0302,
      activo: f.activo, observacion: f.observacion
    };
    const error = modo === 'nuevo'
      ? this.data.agregarSoftwareCatalogo(datos, usuario)
      : this.data.editarSoftwareCatalogo(modo, datos, usuario);
    if (error) {
      this.toast.error('No se pudo guardar el software', error);
      return;
    }
    this.toast.ok(modo === 'nuevo' ? 'Software agregado' : 'Software actualizado',
      `${datos.codigo} — ${datos.nombre} quedó guardado en el catálogo.`);
    this.modalAbierto.set(null);
  }

  protected toggleEstado(s: SoftwareCatalogo): void {
    const u = this.auth.usuario();
    this.data.cambiarEstadoSoftwareCatalogo(s.codigo, !s.activo, `${u?.nombre} — ${u?.rol}`);
    this.toast.ok(!s.activo ? 'Software activado' : 'Software desactivado',
      !s.activo
        ? `${s.codigo} — ${s.nombre} vuelve a ofrecerse para nuevas selecciones.`
        : `${s.codigo} — ${s.nombre} ya no se ofrecerá para nuevas selecciones (lo ya guardado no cambia).`);
  }
}
