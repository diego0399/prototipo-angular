import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { DataService } from '../../core/services/data.service';
import { ToastService } from '../../core/services/toast.service';
import { CategoriaSoftware, EtapaSoftware, SoftwareCatalogo, TipoLicencia } from '../../core/models/models';
import { BadgeComponent, HelpTipComponent, ModalComponent } from '../../shared/ui';
import { IconComponent } from '../../shared/icon';

/**
 * Estado editable del formulario de alta/edición. Las versiones permitidas se manejan como lista
 * (se agregan y se quitan una por una), no como texto libre: así la versión vigente siempre sale
 * de una versión ya registrada.
 */
interface FormularioSoftware {
  codigo: string;
  nombre: string;
  categoria: CategoriaSoftware | '';
  descripcion: string;
  versiones: string[];
  versionVigente: string;
  etapa: EtapaSoftware;
  requiereLicencia: boolean;
  tipoLicencia: TipoLicencia | '';
  activo: boolean;
  observacion: string;
}

const FORM_VACIO: FormularioSoftware = {
  codigo: '', nombre: '', categoria: '', descripcion: '', versiones: [], versionVigente: '',
  etapa: 'Configuración F0302', requiereLicencia: false, tipoLicencia: '', activo: true, observacion: ''
};

@Component({
  selector: 'app-catalogo-software',
  imports: [FormsModule, BadgeComponent, HelpTipComponent, ModalComponent, IconComponent],
  styles: `
    .filtros { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
    .filtros input { max-width: 280px; }

    /* Etapa del proceso: etiqueta con color propio para leer la tabla de un vistazo. */
    .etapa {
      display: inline-block; font-size: 11.5px; font-weight: 700; letter-spacing: .02em;
      border-radius: 999px; padding: 3px 10px; white-space: nowrap;
      border: 1px solid var(--line-strong); color: var(--tx-2); background: var(--surface-2);
    }
    .etapa.f0288 { border-color: var(--blue-500); color: var(--blue-600); background: var(--blue-050); }
    .etapa.f0302 { border-color: var(--gold-500); color: var(--gold-600); }
    .etapa.ambas { border-color: var(--ok-line); color: var(--ok); background: var(--ok-bg); }

    .v-chip {
      display: inline-block; font-size: 11.5px; border: 1px solid var(--line-strong); border-radius: 999px;
      padding: 2px 9px; color: var(--tx-2); background: var(--surface-2);
    }
    .v-chip.vigente { border-color: var(--gold-500); color: var(--gold-600); font-weight: 700; }
    .chip-list { display: flex; flex-wrap: wrap; gap: 6px; }

    /* Secciones del formulario: cada bloque agrupa campos relacionados. */
    .form-sec { padding-top: 16px; }
    .form-sec + .form-sec { border-top: 1px solid var(--line); margin-top: 18px; }
    .form-sec:first-of-type { padding-top: 0; }

    /* Constructor de versiones permitidas: se escribe una, se agrega, y queda en la lista. */
    .ver-add { display: flex; gap: 8px; align-items: flex-end; }
    .ver-add .field { flex: 1 1 auto; }
    .ver-lista { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .ver-item {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
      border: 1px solid var(--line); border-radius: 8px; padding: 7px 10px; background: var(--surface-2);
      font-size: 13.5px; color: var(--navy-900);
    }
    .ver-item .marca { font-size: 11px; font-weight: 700; letter-spacing: .04em; color: var(--gold-600); }
    .ver-quitar {
      border: 0; background: transparent; cursor: pointer; color: var(--tx-3); font-size: 14px; line-height: 1;
      padding: 2px 6px; border-radius: 6px;
    }
    .ver-quitar:hover { background: var(--danger-bg); color: var(--danger); }
    .ver-vacio { font-size: 12.5px; color: var(--tx-3); font-style: italic; margin-top: 8px; }

    .form-check { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 500; color: var(--navy-900); }
    .form-check input { width: 16px; height: 16px; accent-color: var(--navy-800); cursor: pointer; }
    .acciones { display: flex; justify-content: flex-end; gap: 6px; flex-wrap: wrap; }
  `,
  template: `
    <div class="page">
      <div class="page-head">
        <div>
          <div class="page-kicker">Gestión de equipos</div>
          <h1>
            Catálogo de software permitido
            <ui-help texto="Controla qué software está permitido, qué versiones están autorizadas, cuál es la versión vigente y en qué etapa del proceso se usa. Solo el software activo se ofrece en F0288 y F0302; desactivarlo no borra lo que ya quedó guardado en preparaciones o configuraciones anteriores." />
          </h1>
          <p class="page-sub">Evita que se registre software no autorizado o versiones incorrectas en la Preparación F0288 y la Configuración F0302.</p>
        </div>
        <button class="btn btn-gold" (click)="abrirNuevo()">＋ Agregar software</button>
      </div>

      <div class="card card-pad mb-3">
        <div class="filtros">
          <input class="control" [ngModel]="busqueda()" (ngModelChange)="busqueda.set($event)"
            placeholder="Buscar por código o nombre…" />
          <select class="control" style="max-width: 210px;" [ngModel]="filtroCategoria()" (ngModelChange)="filtroCategoria.set($event)">
            <option value="Todas">Todas las categorías</option>
            @for (c of categoriasEnUso(); track c) { <option [value]="c">{{ c }}</option> }
          </select>
          <select class="control" style="max-width: 210px;" [ngModel]="filtroEtapa()" (ngModelChange)="filtroEtapa.set($event)">
            <option value="Todas">Todas las etapas</option>
            @for (e of etapas; track e) { <option [value]="e">{{ e }}</option> }
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
              <th>Código</th><th>Nombre</th><th>Categoría</th><th>Versión vigente</th>
              <th>Etapa del proceso</th><th>Requiere licencia</th><th>Estado</th>
              <th style="text-align:right;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (s of filas(); track s.codigo) {
              <tr>
                <td class="mono main-cell">{{ s.codigo }}</td>
                <td class="main-cell">{{ s.nombre }}</td>
                <td>{{ s.categoria }}</td>
                <td><span class="v-chip vigente">{{ s.versionVigente }}</span></td>
                <td><span [class]="'etapa ' + claseEtapa(s.etapa)">{{ s.etapa }}</span></td>
                <td>
                  @if (s.requiereLicencia) { Sí · <span class="small muted">{{ s.tipoLicencia }}</span> }
                  @else { <span class="muted">No</span> }
                </td>
                <td><ui-badge [estado]="s.activo ? 'Activo' : 'Inactivo'" /></td>
                <td>
                  <div class="acciones">
                    <button class="btn btn-outline btn-sm" (click)="detalle.set(s)">Ver detalle</button>
                    <button class="btn btn-outline btn-sm" (click)="abrirEditar(s)">Editar</button>
                    <button class="btn btn-ghost btn-sm" (click)="toggleEstado(s)">{{ s.activo ? 'Inactivar' : 'Activar' }}</button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="8" class="muted" style="text-align:center; padding: 22px;">
                No hay software que coincida con la búsqueda o los filtros aplicados.
              </td></tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Detalle completo del software (solo lectura) -->
      @if (detalle(); as s) {
        <ui-modal [titulo]="s.nombre" [sub]="s.codigo + ' · ' + s.categoria" (cerrar)="detalle.set(null)">
          <div class="grid grid-2">
            <dl class="dl">
              <dt>Código</dt><dd class="mono">{{ s.codigo }}</dd>
              <dt>Nombre</dt><dd>{{ s.nombre }}</dd>
              <dt>Categoría</dt><dd>{{ s.categoria }}</dd>
              <dt>Descripción</dt><dd>{{ s.descripcion || '—' }}</dd>
              <dt>Versiones permitidas</dt>
              <dd>
                <div class="chip-list">
                  @for (v of s.versionesPermitidas; track v) {
                    <span class="v-chip" [class.vigente]="v === s.versionVigente">{{ v }}</span>
                  }
                </div>
              </dd>
              <dt>Versión vigente</dt><dd>{{ s.versionVigente }}</dd>
            </dl>
            <dl class="dl">
              <dt>Etapa del proceso</dt><dd><span [class]="'etapa ' + claseEtapa(s.etapa)">{{ s.etapa }}</span></dd>
              <dt>Requiere licencia</dt><dd>{{ s.requiereLicencia ? 'Sí' : 'No' }}</dd>
              <dt>Tipo de licencia</dt><dd>{{ s.tipoLicencia || '—' }}</dd>
              <dt>Estado</dt><dd><ui-badge [estado]="s.activo ? 'Activo' : 'Inactivo'" /></dd>
              <dt>Observaciones</dt><dd>{{ s.observacion || '—' }}</dd>
              <dt>Última actualización</dt><dd class="mono">{{ s.ultimaActualizacion || '—' }}</dd>
            </dl>
          </div>
          @if (!s.activo) {
            <div class="alert warn mt-2">
              <span class="alert-ico">!</span>
              <span>
                Software <b>inactivo</b>: se conserva en el catálogo como historial, pero
                <b>no se ofrece</b> en nuevos registros de F0288 ni F0302.
              </span>
            </div>
          }
          <div class="row mt-2" style="justify-content: flex-end; gap: 10px;">
            <button class="btn btn-ghost" (click)="detalle.set(null)">Cerrar</button>
            <button class="btn btn-outline" (click)="abrirEditar(s)">Editar</button>
          </div>
        </ui-modal>
      }

      <!-- Alta / edición, en secciones para no ver todo el formulario de golpe -->
      @if (modalAbierto(); as modo) {
        <ui-modal
          [titulo]="modo === 'nuevo' ? 'Agregar software al catálogo' : 'Editar software del catálogo'"
          sub="Datos generales · Versiones · Uso en el proceso · Licenciamiento · Estado"
          (cerrar)="cerrarModal()">

          @if (errorForm(); as err) {
            <div class="alert danger mt-0"><span class="alert-ico">!</span><span>{{ err }}</span></div>
          }

          <!-- 1. Datos generales -->
          <div class="form-sec">
            <div class="sec-title">Datos generales</div>
            <div class="form-grid">
              <div class="field">
                <label>Código del software</label>
                <input class="control mono" [value]="form().codigo" disabled />
                <span class="hint">
                  {{ modo === 'nuevo'
                    ? 'Se genera automáticamente; no se escribe a mano.'
                    : 'El código no se puede cambiar: es la clave que usan F0288 y F0302.' }}
                </span>
              </div>
              <div class="field">
                <label>Nombre del software <span class="req">*</span></label>
                <input class="control" [ngModel]="form().nombre" (ngModelChange)="campo('nombre', $event)"
                  placeholder="Ej.: Google Chrome" />
              </div>
              <div class="field">
                <label>Categoría <span class="req">*</span></label>
                <select class="control" [ngModel]="form().categoria" (ngModelChange)="campo('categoria', $event)">
                  <option value="">Seleccione…</option>
                  @for (c of categorias; track c) { <option [value]="c">{{ c }}</option> }
                </select>
              </div>
              <div class="field full">
                <label>Descripción</label>
                <textarea class="control" rows="2" [ngModel]="form().descripcion" (ngModelChange)="campo('descripcion', $event)"
                  placeholder="Para qué se usa este software en el equipo (opcional)…"></textarea>
              </div>
            </div>
          </div>

          <!-- 2. Versiones -->
          <div class="form-sec">
            <div class="sec-title">Versiones</div>
            <div class="ver-add">
              <div class="field">
                <label>Versiones permitidas <span class="req">*</span></label>
                <input class="control" [ngModel]="nuevaVersion()" (ngModelChange)="nuevaVersion.set($event)"
                  (keyup.enter)="agregarVersion()" placeholder="Ej.: Windows 11 Pro" />
              </div>
              <button class="btn btn-outline" type="button" (click)="agregarVersion()">Agregar</button>
            </div>
            @if (form().versiones.length > 0) {
              <div class="ver-lista">
                @for (v of form().versiones; track v) {
                  <div class="ver-item">
                    <span>
                      {{ v }}
                      @if (v === form().versionVigente) { <span class="marca">· VIGENTE</span> }
                    </span>
                    <button class="ver-quitar" type="button" [attr.aria-label]="'Quitar ' + v" (click)="quitarVersion(v)"><ui-icon name="x" [size]="12" /></button>
                  </div>
                }
              </div>
            } @else {
              <p class="ver-vacio">Aún no hay versiones agregadas. Escriba una versión y presione «Agregar».</p>
            }
            <div class="field mt-2">
              <label>Versión vigente <span class="req">*</span></label>
              <select class="control" [ngModel]="form().versionVigente" (ngModelChange)="campo('versionVigente', $event)"
                [disabled]="form().versiones.length === 0">
                <option value="">Seleccione…</option>
                @for (v of form().versiones; track v) { <option [value]="v">{{ v }}</option> }
              </select>
              <span class="hint">Solo puede elegirse entre las versiones permitidas agregadas arriba.</span>
            </div>
          </div>

          <!-- 3. Uso en el proceso -->
          <div class="form-sec">
            <div class="sec-title">Uso en el proceso</div>
            <div class="field">
              <label>Etapa del proceso <span class="req">*</span></label>
              <div class="opt-row">
                @for (e of etapas; track e) {
                  <label class="opt" [class.on]="form().etapa === e">
                    <input type="radio" name="etapa" [checked]="form().etapa === e" (change)="campo('etapa', e)" />
                    {{ e }}
                  </label>
                }
              </div>
              <span class="hint">Determina en qué checklist se ofrece el software. «Ambas etapas» lo muestra en F0288 y en F0302.</span>
            </div>
          </div>

          <!-- 4. Licenciamiento -->
          <div class="form-sec">
            <div class="sec-title">Licenciamiento</div>
            <div class="form-grid">
              <div class="field">
                <label>¿Requiere licencia? <span class="req">*</span></label>
                <div class="opt-row">
                  <label class="opt" [class.on]="form().requiereLicencia">
                    <input type="radio" name="licencia" [checked]="form().requiereLicencia" (change)="cambiarRequiereLicencia(true)" /> Sí
                  </label>
                  <label class="opt" [class.on]="!form().requiereLicencia">
                    <input type="radio" name="licencia" [checked]="!form().requiereLicencia" (change)="cambiarRequiereLicencia(false)" /> No
                  </label>
                </div>
              </div>
              <div class="field">
                <label>Tipo de licencia @if (form().requiereLicencia) { <span class="req">*</span> }</label>
                <select class="control" [ngModel]="form().tipoLicencia" (ngModelChange)="campo('tipoLicencia', $event)"
                  [disabled]="!form().requiereLicencia">
                  <option value="">Seleccione…</option>
                  @for (t of tiposLicencia; track t) { <option [value]="t">{{ t }}</option> }
                </select>
                @if (!form().requiereLicencia) { <span class="hint">Se habilita cuando el software requiere licencia.</span> }
              </div>
            </div>
          </div>

          <!-- 5. Estado y observaciones -->
          <div class="form-sec">
            <div class="sec-title">Estado y observaciones</div>
            <div class="form-grid">
              <div class="field">
                <label>Estado <span class="req">*</span></label>
                <select class="control" [ngModel]="form().activo ? 'Activo' : 'Inactivo'"
                  (ngModelChange)="campo('activo', $event === 'Activo')">
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
                <span class="hint">Solo el software activo se ofrece en F0288 y F0302; el inactivo se conserva en el catálogo.</span>
              </div>
              <div class="field">
                <label>Observaciones</label>
                <textarea class="control" rows="2" [ngModel]="form().observacion" (ngModelChange)="campo('observacion', $event)"
                  placeholder="Ej.: Usar únicamente versión institucional autorizada."></textarea>
              </div>
            </div>
          </div>

          <div class="row mt-3" style="justify-content: flex-end; gap: 10px;">
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

  protected readonly categorias: CategoriaSoftware[] = [
    'Sistema operativo', 'Componentes de Windows', 'Ofimática', 'Seguridad', 'Inventario',
    'Navegación', 'Utilidad', 'Red', 'Comunicación', 'Otro'
  ];
  protected readonly etapas: EtapaSoftware[] = ['Preparación F0288', 'Configuración F0302', 'Ambas etapas'];
  protected readonly tiposLicencia: TipoLicencia[] = ['Institucional', 'Por usuario', 'Por equipo', 'Libre', 'Otro'];

  protected busqueda = signal('');
  protected filtroCategoria = signal('Todas');
  protected filtroEtapa = signal('Todas');
  protected filtroEstado = signal<'Todos' | 'Activo' | 'Inactivo'>('Todos');
  protected modalAbierto = signal<'nuevo' | string | null>(null);
  protected detalle = signal<SoftwareCatalogo | null>(null);
  protected form = signal<FormularioSoftware>({ ...FORM_VACIO });
  protected nuevaVersion = signal('');
  protected errorForm = signal('');

  constructor() {
    // Consulta deliberada: se registra una sola vez al entrar a la pantalla, no en cada render.
    const u = this.auth.usuario();
    this.data.registrarConsultaCatalogoSoftware(`${u?.nombre} — ${u?.rol}`);
  }

  /** Categorías presentes en el catálogo (para el filtro; el formulario usa la lista completa). */
  protected readonly categoriasEnUso = computed(() => {
    const vistas: string[] = [];
    for (const s of this.data.catalogoSoftware()) {
      if (!vistas.includes(s.categoria)) vistas.push(s.categoria);
    }
    return vistas;
  });

  protected readonly filas = computed<SoftwareCatalogo[]>(() => {
    const q = this.busqueda().trim().toLowerCase();
    const cat = this.filtroCategoria();
    const eta = this.filtroEtapa();
    const est = this.filtroEstado();
    return this.data.catalogoSoftware().filter((s) => {
      if (q && !s.codigo.toLowerCase().includes(q) && !s.nombre.toLowerCase().includes(q)) return false;
      if (cat !== 'Todas' && s.categoria !== cat) return false;
      if (eta !== 'Todas' && s.etapa !== eta) return false;
      if (est === 'Activo' && !s.activo) return false;
      if (est === 'Inactivo' && s.activo) return false;
      return true;
    });
  });

  protected claseEtapa(etapa: EtapaSoftware): string {
    return etapa === 'Preparación F0288' ? 'f0288' : etapa === 'Configuración F0302' ? 'f0302' : 'ambas';
  }

  protected campo<K extends keyof FormularioSoftware>(clave: K, valor: FormularioSoftware[K]): void {
    this.form.update((f) => ({ ...f, [clave]: valor }));
  }

  /** Al dejar de requerir licencia se limpia el tipo: no debe quedar un dato que ya no aplica. */
  protected cambiarRequiereLicencia(requiere: boolean): void {
    this.form.update((f) => ({ ...f, requiereLicencia: requiere, tipoLicencia: requiere ? f.tipoLicencia : '' }));
  }

  // ---------- Versiones permitidas ----------
  protected agregarVersion(): void {
    const v = this.nuevaVersion().trim();
    if (!v) return;
    if (this.form().versiones.includes(v)) {
      this.toast.error('Versión repetida', `«${v}» ya está en las versiones permitidas.`);
      return;
    }
    // La primera versión agregada queda como vigente: es el caso más común y evita un paso extra.
    this.form.update((f) => ({
      ...f, versiones: [...f.versiones, v], versionVigente: f.versionVigente || v
    }));
    this.nuevaVersion.set('');
  }

  /** Quitar una versión también limpia la vigente si era esa: no puede apuntar a algo que ya no existe. */
  protected quitarVersion(version: string): void {
    this.form.update((f) => ({
      ...f,
      versiones: f.versiones.filter((v) => v !== version),
      versionVigente: f.versionVigente === version ? '' : f.versionVigente
    }));
  }

  // ---------- Alta / edición ----------
  protected abrirNuevo(): void {
    this.form.set({ ...FORM_VACIO, codigo: this.data.siguienteCodigoSoftware() });
    this.nuevaVersion.set('');
    this.errorForm.set('');
    this.modalAbierto.set('nuevo');
  }

  protected abrirEditar(s: SoftwareCatalogo): void {
    this.form.set({
      codigo: s.codigo, nombre: s.nombre, categoria: s.categoria as CategoriaSoftware,
      descripcion: s.descripcion, versiones: [...s.versionesPermitidas], versionVigente: s.versionVigente,
      etapa: s.etapa, requiereLicencia: s.requiereLicencia, tipoLicencia: s.tipoLicencia,
      activo: s.activo, observacion: s.observacion
    });
    this.nuevaVersion.set('');
    this.errorForm.set('');
    this.detalle.set(null);
    this.modalAbierto.set(s.codigo);
  }

  protected cerrarModal(): void {
    this.modalAbierto.set(null);
    this.errorForm.set('');
  }

  protected guardar(modo: 'nuevo' | string): void {
    const f = this.form();
    const u = this.auth.usuario();
    const usuario = `${u?.nombre} — ${u?.rol}`;
    const datos: SoftwareCatalogo = {
      codigo: f.codigo, nombre: f.nombre, categoria: f.categoria, descripcion: f.descripcion,
      versionesPermitidas: f.versiones, versionVigente: f.versionVigente,
      etapa: f.etapa, requiereLicencia: f.requiereLicencia, tipoLicencia: f.tipoLicencia,
      activo: f.activo, observacion: f.observacion, ultimaActualizacion: ''
    };
    const error = modo === 'nuevo'
      ? this.data.agregarSoftwareCatalogo(datos, usuario)
      : this.data.editarSoftwareCatalogo(modo, datos, usuario);
    if (error) {
      // El error queda a la vista dentro del formulario, además del aviso flotante.
      this.errorForm.set(error);
      this.toast.error('No se pudo guardar el software', error);
      return;
    }
    this.toast.ok(modo === 'nuevo' ? 'Software agregado' : 'Software actualizado',
      `${datos.nombre} quedó guardado en el catálogo (${datos.etapa}).`);
    this.cerrarModal();
  }

  protected toggleEstado(s: SoftwareCatalogo): void {
    const u = this.auth.usuario();
    this.data.cambiarEstadoSoftwareCatalogo(s.codigo, !s.activo, `${u?.nombre} — ${u?.rol}`);
    this.toast.ok(!s.activo ? 'Software activado' : 'Software inactivado',
      !s.activo
        ? `${s.codigo} — ${s.nombre} vuelve a ofrecerse en F0288 y F0302 según su etapa.`
        : `${s.codigo} — ${s.nombre} ya no se ofrecerá en nuevos registros (lo ya guardado no cambia).`);
    // El detalle abierto debe reflejar el nuevo estado, no la copia previa.
    if (this.detalle()?.codigo === s.codigo) this.detalle.set(this.data.softwareCatalogoDe(s.codigo) ?? null);
  }
}
