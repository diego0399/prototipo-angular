import { Component, computed, inject, input, output } from '@angular/core';
import { DataService } from '../core/services/data.service';
import { AuthService } from '../core/services/auth.service';
import { ToastService } from '../core/services/toast.service';
import { FirmaProceso } from '../core/models/models';
import { EvidenciaVista } from './evidencias';
import { ModalComponent } from './ui';
import { SeccionDoc, VisorDocumentoComponent } from './visor-documento';

/**
 * Visor de la **Constancia de Reproceso F0288** y de la **Constancia de Revisión Técnica de
 * Garantía**, que son el mismo documento con distinto encabezado según el origen. Vive en `shared`
 * porque la constancia debe poder abrirse desde ocho pantallas distintas: si cada una la dibujara
 * por su cuenta, el documento se vería diferente según por dónde se entrara, y ese es justamente el
 * problema que se corrigió.
 *
 * No genera nada: la constancia se crea al firmar el reproceso. Aquí solo se consulta, se descarga
 * y se registra quién la abrió. El documento se arma como secciones y se dibuja en
 * `ui-visor-documento`, la hoja formal común a todos los documentos del sistema; la descarga sigue
 * usando el texto que produce `DataService`, sin tocarlo.
 */
@Component({
  selector: 'ui-constancia-reproceso',
  imports: [ModalComponent, VisorDocumentoComponent],
  template: `
    @if (abierto() && reproceso(); as r) {
      @if (documento(); as d) {
        <ui-visor-documento
          [abierto]="true"
          [nombre]="titulo()"
          [subtitulo]="subtitulo()"
          [codigo]="d.codigo ?? ''"
          [fecha]="d.fecha"
          [hora]="d.hora ?? ''"
          [generadoPor]="d.generadoPor"
          [estado]="d.estado ?? 'Generado'"
          [huella]="d.hash"
          [referencia]="referencia()"
          [secciones]="secciones()"
          [evidencias]="evidencias()"
          tituloEvidencias="Imágenes de evidencia de la intervención"
          [retiradas]="retiradas()"
          [firmas]="firmas()"
          notaPie="La constancia queda guardada en el expediente: consultarla de nuevo abre esta misma, no genera otra."
          (verEvidencia)="abrir($event)"
          (descargar)="descargar()"
          (cerrar)="cerrar()" />
      } @else {
        <!-- Sin firma no hay documento que mostrar: el aviso no necesita una hoja formal. -->
        <ui-modal [titulo]="titulo()" [sub]="'Reproceso ' + r.id" (cerrar)="cerrar()">
          <div class="alert warn">
            <span class="alert-ico">!</span>
            <span>
              Este reproceso todavía no tiene constancia: se genera al <b>firmarlo</b>. Estado actual del
              reproceso: <b>{{ r.estado }}</b>.
            </span>
          </div>
        </ui-modal>
      }
    }
  `
})
export class ConstanciaReprocesoComponent {
  protected readonly data = inject(DataService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Código del reproceso cuya constancia se muestra; vacío cierra el visor. */
  readonly idReproceso = input<string>('');
  readonly cerrado = output<void>();

  protected readonly abierto = computed(() => !!this.idReproceso());
  protected readonly reproceso = computed(() => this.data.reprocesoDe(this.idReproceso()));
  protected readonly documento = computed(() => this.data.constanciaDeReproceso(this.idReproceso()));

  /** Caso de garantía que originó la revisión técnica, cuando el reproceso viene de una garantía. */
  private readonly garantia = computed(() => {
    const r = this.reproceso();
    return r ? this.data.casoDeRevisionGarantia(r) : undefined;
  });

  protected readonly titulo = computed(() =>
    this.garantia() ? 'Constancia de Revisión Técnica de Garantía' : 'Constancia de Reproceso F0288');

  protected readonly subtitulo = computed(() => {
    const r = this.reproceso();
    if (!r) return '';
    return this.garantia()
      ? `Revisión técnica ${r.id} — caso de garantía ${this.garantia()!.caso.codigo}`
      : `Reproceso número ${r.numero} del expediente técnico ${r.expedienteTecnico}`;
  });

  protected readonly referencia = computed(() => {
    const r = this.reproceso();
    if (!r) return '';
    return [r.expedienteUnico, r.expedienteTecnico].filter(Boolean).join(' · ');
  });

  /** Imágenes de evidencia del reproceso que la constancia documenta. */
  protected readonly evidencias = computed<EvidenciaVista[]>(() => this.reproceso()?.evidencias ?? []);

  /**
   * Archivos que el documento certificó y que ya no están en el reproceso. No debería ocurrir
   * —las imágenes solo pueden eliminarse mientras el reproceso está en proceso—, pero si ocurriera
   * la constancia lo dice en vez de callarlo.
   */
  protected readonly retiradas = computed(() => {
    const actuales = this.evidencias().map((e) => e.archivo);
    return (this.documento()?.evidencias ?? []).filter((a) => !actuales.includes(a));
  });

  /** Firma del Técnico de Hardware que cerró la intervención. */
  protected readonly firmas = computed<FirmaProceso[]>(() => {
    const f = this.reproceso()?.firma;
    if (!f) return [];
    return [{
      documento: this.titulo(),
      rotulo: this.garantia() ? 'Técnico de Hardware que revisó el equipo' : 'Técnico de Hardware que ejecutó el reproceso',
      nombre: f.nombre, rol: [f.cargo, f.unidad].filter(Boolean).join(' · '),
      fecha: f.fecha, hora: f.hora, estado: 'Capturada',
      detalle: `Firma simulada registrada al cerrar ${this.garantia() ? 'la revisión técnica' : 'el reproceso'}.`
    }];
  });

  /** El documento, sección por sección, con los mismos datos que lleva la descarga en texto. */
  protected readonly secciones = computed<SeccionDoc[]>(() => {
    const r = this.reproceso();
    if (!r) return [];
    const gar = this.garantia();
    const eq = this.data.equipoDe(r.inventario);
    const tipoProblema = this.data.tipoProblemaDeReproceso(r);

    const secciones: SeccionDoc[] = [
      {
        titulo: 'Datos del expediente',
        campos: [
          ...(gar
            ? [{ etiqueta: 'Caso de garantía', valor: gar.caso.codigo, mono: true },
               { etiqueta: 'Código de la revisión técnica', valor: r.id, mono: true }]
            : [{ etiqueta: 'Código del reproceso', valor: r.id, mono: true },
               { etiqueta: 'Número de reproceso', valor: `#${r.numero}` }]),
          { etiqueta: 'Expediente técnico original', valor: r.expedienteTecnico, mono: true },
          { etiqueta: 'Expediente único', valor: r.expedienteUnico || '—', mono: true },
          { etiqueta: 'Origen de la intervención', valor: r.origen ?? 'Falla F0302' },
          { etiqueta: 'Unidad que atiende', valor: r.unidadAtiende },
          ...(r.justificacionUnidad
            ? [{ etiqueta: 'Justificación de la unidad', valor: r.justificacionUnidad, ancho: true }]
            : [])
        ]
      },
      {
        titulo: 'Datos del equipo',
        campos: [
          { etiqueta: 'Equipo', valor: eq ? `${eq.marca} ${eq.modelo}` : '—' },
          { etiqueta: 'Tipo de equipo', valor: eq ? (eq.tipo === 'Desktop' ? 'CPU' : 'Laptop') : '—' },
          { etiqueta: 'Número de inventario', valor: r.inventario, mono: true },
          { etiqueta: 'Número de serie', valor: eq?.serie ?? '—', mono: true },
          { etiqueta: 'Condición', valor: eq?.condicion ?? '—' },
          { etiqueta: 'Sistema operativo', valor: eq?.sistemaOperativo ?? '—' }
        ]
      }
    ];

    // El usuario final solo figura donde el proceso ya llegó hasta él: en una revisión de garantía
    // o en un reproceso originado por su inconformidad.
    const usuarioFinal = gar?.garantia.usuarioFinal || r.usuarioFinal || '';
    if (usuarioFinal) {
      secciones.push({
        titulo: 'Datos del usuario final',
        campos: [
          { etiqueta: 'Usuario final', valor: usuarioFinal },
          ...(r.intentoConformidad
            ? [{ etiqueta: 'Intento de conformidad', valor: `#${r.intentoConformidad}` }] : []),
          ...(r.observacionUsuarioFinal
            ? [{ etiqueta: 'Lo que reportó', valor: r.observacionUsuarioFinal, ancho: true }] : [])
        ]
      });
    }

    secciones.push({
      titulo: gar ? 'Problema reportado en garantía' : 'Falla reportada en la configuración F0302',
      campos: [
        { etiqueta: gar ? 'Tipo de problema reportado' : 'Tipo de falla reportada',
          valor: gar ? (gar.caso.tipoProblema ?? r.tipoFalla) : r.tipoFalla },
        { etiqueta: `Tipo de problema del ${gar ? 'checklist' : 'reproceso'}`, valor: tipoProblema },
        { etiqueta: 'Prioridad de atención', valor: r.prioridad },
        { etiqueta: 'Reportada por', valor: r.solicitadoPor },
        { etiqueta: 'Fecha del reporte', valor: `${r.fechaSolicitud} ${r.horaSolicitud}`.trim() },
        { etiqueta: 'Descripción de la falla', valor: r.motivo, ancho: true },
        { etiqueta: 'Observación de Soporte', valor: r.observacionSoporte || '—', ancho: true },
        { etiqueta: 'Evidencia reportada por Soporte', valor: r.evidenciaSoporte || '—', ancho: true }
      ]
    });

    secciones.push({
      titulo: 'Técnico responsable de la intervención',
      campos: [
        { etiqueta: 'Encargado que asignó', valor: r.asignadoPor || '—' },
        { etiqueta: 'Fecha de asignación',
          valor: r.fechaAsignacion ? `${r.fechaAsignacion} ${r.horaAsignacion}`.trim() : '—' },
        { etiqueta: 'Técnico de Hardware asignado', valor: r.tecnicoAsignado || '—' },
        { etiqueta: 'Atendido por', valor: r.atendidoPor || r.tecnicoAsignado || '—' },
        { etiqueta: 'Inicio de la intervención',
          valor: `${r.cronometro?.fechaInicio ?? r.fechaInicio} ${r.cronometro?.horaInicio ?? ''}`.trim() || '—' },
        { etiqueta: 'Finalización',
          valor: `${r.cronometro?.fechaFin ?? r.fechaFin} ${r.cronometro?.horaFin ?? ''}`.trim() || '—' },
        { etiqueta: 'Tiempo trabajado',
          valor: this.data.formatoDuracion(r.cronometro?.duracionMinutos ?? null) || 'menos de 1 min' }
      ]
    });

    // El checklist se imprime agrupado en sus secciones y en el orden en que se trabajó: el
    // reproceso no llevó otros ítems que los del tipo de problema atendido.
    const grupos = this.data.checklistPorSeccion(r);
    for (const g of grupos) {
      secciones.push({
        titulo: `${gar ? 'Revisión técnica' : 'Checklist de reproceso'} — ${g.seccion}`,
        items: g.items.map((i) => ({
          nombre: i.nombre,
          estado: this.data.etiquetaItemReproceso(i) === 'Completado' ? 'Realizado' : this.data.etiquetaItemReproceso(i),
          nota: i.nota
        }))
      });
    }

    const noAplica = r.checklist.filter((i) => i.estado === 'No aplica');
    if (noAplica.length) {
      secciones.push({
        titulo: 'Ítems marcados como No aplica',
        columnas: ['Ítem del checklist', 'Motivo registrado'],
        filas: noAplica.map((i) => [i.nombre, i.nota || 'Sin motivo registrado']),
        nota: 'El documento deja constancia de lo que no se hizo y por qué, no solo de lo que sí se hizo.'
      });
    }

    secciones.push({
      titulo: 'Resultado de la intervención',
      campos: [
        { etiqueta: 'Corrección técnica realizada', valor: r.correccionTecnica || '—', ancho: true },
        { etiqueta: 'Resultado', valor: r.resultado || '—' },
        { etiqueta: 'Estado del reproceso', valor: r.estado },
        { etiqueta: 'Observaciones del Técnico de Hardware',
          valor: r.observacionResultado || r.observaciones || '—', ancho: true }
      ]
    });

    // Lo que Soporte comprobó al recibir el equipo de vuelta cierra el circuito de la garantía.
    const validacion = gar?.caso.validacionSoporte;
    if (validacion) {
      secciones.push({
        titulo: 'Validación de Soporte tras la revisión',
        items: [
          { nombre: 'La corrección se realizó', estado: validacion.correccionRealizada || 'Pendiente' },
          { nombre: 'El equipo funciona correctamente', estado: validacion.equipoFunciona || 'Pendiente' },
          { nombre: 'La evidencia técnica fue revisada', estado: validacion.evidenciaRevisada || 'Pendiente' }
        ],
        campos: [
          { etiqueta: 'Validado por', valor: validacion.validadoPor },
          { etiqueta: 'Fecha de validación', valor: `${validacion.fecha} ${validacion.hora}`.trim() },
          { etiqueta: 'Observación', valor: validacion.observacion || '—', ancho: true }
        ]
      });
    }

    return secciones;
  });

  /** Abrir una imagen desde la constancia también es un acceso a la evidencia. */
  protected abrir(archivo: string): void {
    this.data.registrarConsultaEvidencia(this.idReproceso(), archivo, this.usuarioActual);
  }

  private get usuarioActual(): string {
    const u = this.auth.usuario();
    return `${u?.nombre} — ${u?.rol}`;
  }

  /** Deja constancia de la consulta al cerrar: abrir y mirar también es un acceso al documento. */
  protected cerrar(): void {
    if (this.documento()) this.data.registrarConsultaConstancia(this.idReproceso(), this.usuarioActual);
    this.cerrado.emit();
  }

  protected descargar(): void {
    const lineas = this.data.constanciaReprocesoF0288(this.idReproceso());
    if (typeof lineas === 'string') { this.toast.error('No se puede abrir la constancia', lineas); return; }
    const blob = new Blob([lineas.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.documento()?.codigo ?? 'Constancia-Reproceso'}-${this.idReproceso()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.data.registrarConsultaConstancia(this.idReproceso(), this.usuarioActual, true);
    this.toast.ok('Constancia descargada',
      `${this.documento()?.codigo} — la constancia sigue disponible en el expediente para consultarla luego.`);
  }
}
