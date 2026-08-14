import { Component, computed, inject, input, output } from '@angular/core';
import { DataService } from '../core/services/data.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { FirmaProceso } from '../core/models/models';
import { EvidenciaVista } from './evidencias';
import { ModalComponent } from './ui';
import { SeccionDoc, VisorDocumentoComponent } from './visor-documento';

/**
 * Visor de la **Constancia de Corrección F0302 por Inconformidad**. Es el hermano del visor de la
 * constancia de reproceso y vive en `shared` por la misma razón: el documento debe verse igual
 * desde el historial técnico, el expediente único, el detalle del equipo, el Generador de
 * documentos y la trazabilidad.
 *
 * No genera nada: la constancia se crea al firmar la corrección. Aquí solo se consulta, se
 * descarga y se registra quién la abrió; la hoja es la misma que la de los demás documentos.
 */
@Component({
  selector: 'ui-constancia-correccion',
  imports: [ModalComponent, VisorDocumentoComponent],
  template: `
    @if (abierto() && correccion(); as c) {
      @if (documento(); as d) {
        <ui-visor-documento
          [abierto]="true"
          nombre="Constancia de Corrección F0302 por Inconformidad"
          [subtitulo]="'Corrección ' + c.id + ' — intento de conformidad número ' + c.intentoNumero"
          [codigo]="d.codigo ?? ''"
          [fecha]="d.fecha"
          [hora]="d.hora ?? ''"
          [generadoPor]="d.generadoPor"
          [estado]="d.estado ?? 'Generado'"
          [huella]="d.hash"
          [referencia]="referencia()"
          [secciones]="secciones()"
          [evidencias]="evidencias()"
          tituloEvidencias="Imágenes de evidencia de la corrección"
          [firmas]="firmas()"
          notaPie="La constancia queda guardada en el expediente: consultarla de nuevo abre esta misma, no genera otra."
          (verEvidencia)="verEvidencia(c, $event)"
          (descargar)="descargar()"
          (cerrar)="cerrar()" />
      } @else {
        <ui-modal titulo="Constancia de Corrección F0302 por Inconformidad" [sub]="'Corrección ' + c.id" (cerrar)="cerrar()">
          <div class="alert warn">
            <span class="alert-ico">!</span>
            <span>
              Esta corrección todavía no tiene constancia: se genera al <b>firmarla</b> el Técnico de
              Soporte. Estado actual: <b>{{ c.estado }}</b>.
            </span>
          </div>
        </ui-modal>
      }
    }
  `
})
export class ConstanciaCorreccionComponent {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Código de la corrección cuya constancia se muestra; vacío cierra el visor. */
  readonly idCorreccion = input<string>('');
  readonly cerrado = output<void>();

  protected readonly abierto = computed(() => !!this.idCorreccion());
  protected readonly correccion = computed(() => this.data.correccionDe(this.idCorreccion()));
  protected readonly documento = computed(() => this.data.constanciaDeCorreccion(this.idCorreccion()));

  protected readonly referencia = computed(() => {
    const c = this.correccion();
    if (!c) return '';
    return [this.data.expedienteUnicoDe(c.expediente)?.codigoUnico, c.expediente]
      .filter(Boolean).join(' · ');
  });

  /** Imágenes que respaldan la corrección, tal como las guarda el módulo de evidencias. */
  protected readonly evidencias = computed<EvidenciaVista[]>(() => {
    const c = this.correccion();
    return c ? this.data.evid.de('Corrección F0302', c.id) : [];
  });

  /** Firma del Técnico de Soporte que cerró la corrección. */
  protected readonly firmas = computed<FirmaProceso[]>(() => {
    const f = this.correccion()?.firma;
    if (!f) return [];
    return [{
      documento: 'Constancia de Corrección F0302 por Inconformidad',
      rotulo: 'Técnico de Soporte que atendió la inconformidad',
      nombre: f.nombre, rol: [f.cargo, f.unidad].filter(Boolean).join(' · '),
      fecha: f.fecha, hora: f.hora, estado: 'Capturada',
      detalle: 'Firma simulada registrada al cerrar la corrección.'
    }];
  });

  /** El documento, sección por sección, con los mismos datos que lleva la descarga en texto. */
  protected readonly secciones = computed<SeccionDoc[]>(() => {
    const c = this.correccion();
    if (!c) return [];
    const eq = this.data.equipoDe(c.inventario);
    const unico = this.data.expedienteUnicoDe(c.expediente);

    const secciones: SeccionDoc[] = [
      {
        titulo: 'Datos del expediente',
        campos: [
          { etiqueta: 'Código de corrección', valor: c.id, mono: true },
          { etiqueta: 'Expediente único', valor: unico?.codigoUnico ?? '—', mono: true },
          { etiqueta: 'Expediente técnico',
            valor: this.data.expTecnicoDeEquipo(c.inventario)?.codigo ?? '—', mono: true },
          { etiqueta: 'Solicitud', valor: c.expediente, mono: true },
          { etiqueta: 'Intento de conformidad', valor: `#${c.intentoNumero}` },
          { etiqueta: 'Estado de la corrección', valor: c.estado }
        ]
      },
      {
        titulo: 'Datos del equipo',
        campos: [
          { etiqueta: 'Equipo', valor: eq ? `${eq.marca} ${eq.modelo}` : '—' },
          { etiqueta: 'Tipo de equipo', valor: eq ? (eq.tipo === 'Desktop' ? 'CPU' : 'Laptop') : '—' },
          { etiqueta: 'Número de inventario', valor: c.inventario, mono: true },
          { etiqueta: 'Número de serie', valor: eq?.serie ?? '—', mono: true }
        ]
      },
      {
        titulo: 'Datos del usuario final',
        campos: [
          { etiqueta: 'Usuario final', valor: c.usuarioFinal },
          { etiqueta: 'Tipo de problema reportado', valor: c.tipoProblema },
          { etiqueta: 'Observación del usuario final', valor: c.observacionUsuario || '—', ancho: true }
        ]
      },
      {
        titulo: 'Resolución adoptada',
        campos: [
          { etiqueta: 'Resolución', valor: c.resolucion },
          { etiqueta: 'Resolución sugerida por la matriz', valor: c.sugerencia },
          ...(c.justificacionResolucion
            ? [{ etiqueta: 'Justificación de la excepción', valor: c.justificacionResolucion, ancho: true }]
            : []),
          ...(c.revisionFisicaRed
            ? [{ etiqueta: '¿La revisión de red es física?', valor: c.revisionFisicaRed }] : []),
          ...(c.reinstalacionSO
            ? [{ etiqueta: '¿Requiere reinstalación del sistema operativo?', valor: c.reinstalacionSO }] : []),
          ...(c.reprocesoId
            ? [{ etiqueta: 'Reproceso F0288 generado', valor: c.reprocesoId, mono: true }] : [])
        ]
      },
      {
        titulo: 'Técnico responsable de la atención',
        campos: [
          { etiqueta: 'Técnico de Soporte', valor: c.tecnico },
          { etiqueta: 'Inicio de la atención', valor: `${c.fechaInicio} ${c.horaInicio}`.trim() || '—' },
          { etiqueta: 'Finalización', valor: `${c.fechaFin} ${c.horaFin}`.trim() || '—' },
          { etiqueta: 'Tiempo trabajado',
            valor: this.data.formatoDuracion(c.cronometro?.duracionMinutos ?? null) || 'menos de 1 min' }
        ]
      },
      {
        titulo: 'Checklist de atención',
        items: c.checklist.map((i) => ({ nombre: i.nombre, estado: i.estado, nota: i.nota }))
      },
      {
        titulo: 'Resultado de la corrección',
        campos: [
          { etiqueta: 'Corrección realizada', valor: c.descripcion || '—', ancho: true },
          { etiqueta: 'Complejidad',
            valor: c.huboComplejidad === 'Sí' ? `Sí — ${c.detalleComplejidad}` : 'No', ancho: true },
          { etiqueta: 'Observación técnica', valor: c.observacionTecnica || '—', ancho: true },
          { etiqueta: 'Resultado', valor: c.resultado || '—' }
        ]
      }
    ];

    return secciones;
  });

  /** Abrir una imagen desde la constancia también es un acceso a la evidencia. */
  protected verEvidencia(c: { id: string; expediente: string }, archivo: string): void {
    this.data.registrarConsultaEvidenciaTecnica('Corrección F0302', c.id, c.expediente,
      archivo, this.usuarioActual);
  }

  private get usuarioActual(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  /** Deja constancia de la consulta al cerrar: abrir y mirar también es un acceso al documento. */
  protected cerrar(): void {
    if (this.documento()) this.data.registrarConsultaConstanciaCorreccion(this.idCorreccion(), this.usuarioActual);
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
