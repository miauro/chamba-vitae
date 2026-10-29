# CV Express

Editor de CV en el navegador: editas, reordenas, cambias de idioma y descargas el PDF. Sin servidor y sin cuentas: tus datos se quedan en tu navegador y en el JSON que tú exportas.

*English below.*

## Uso

1. Abre la app (GitHub Pages o en local, ver abajo).
2. Edita a la izquierda; la derecha es exactamente el PDF.
3. **Archivo → Exportar JSON** para guardar una copia. **Importar JSON** (o arrastrar el archivo a la ventana) para recuperarla.
4. **Descargar PDF** abre el diálogo de impresión: elige *Guardar como PDF* y desactiva *Encabezados y pies de página*.

### Lo que puedes hacer

- **Arrastrar** secciones, entradas, contactos y filas para reordenarlos.
- **Multidioma**: cada texto guarda una versión por idioma (`{ "es": "…", "en": "…" }`). Cambias el idioma del CV con un clic. Si un texto no está traducido se usa el de otro idioma (en el editor aparece en ámbar, en cursiva), así que solo traduces lo que cambia. Puedes añadir más idiomas en *Diseño*.
- **Variantes**: versiones del CV para distintas ofertas a partir de los mismos datos. El ojo 👁 oculta un elemento solo en la variante activa, y cada variante puede tener su propio cargo.
- **Negritas**: `**así**` en cualquier texto.
- **Fechas**: año, o año y mes. Marca *Actualmente* para que salga «2022 - Hoy» o «Actualidad». *Ordenar por fecha* pone lo más reciente arriba.
- **Diseño**: fuente (o cualquier fuente instalada en tu equipo), tamaño del nombre, colores y foto en blanco y negro.
- **Deshacer y rehacer** con Ctrl+Z y Ctrl+Shift+Z.

### Tipos de sección

| Tipo | Para | Ejemplo |
|---|---|---|
| Texto | Párrafos | sobre mí, destrezas |
| Lista con fechas | Título, subtítulo, fechas, puntos → | formación, experiencia |
| Pares | Etiqueta y valor | idiomas |
| Habilidades | Grupo, categorías y lista | herramientas |

## Desarrollo

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # genera dist/
```

## Publicar en GitHub Pages

1. Sube el repo a GitHub (rama `main`).
2. En *Settings → Pages → Build and deployment*, elige **GitHub Actions**.
3. Cada `git push` a `main` publica la app con [.github/workflows/deploy.yml](.github/workflows/deploy.yml).

La carpeta `mis-cvs/` está en `.gitignore`: guarda ahí tus JSON personales sin subirlos.

---

## English

A browser-based CV editor: edit, reorder, switch language and download a PDF. No server or account: your data stays in your browser and in the JSON you export.

- Edit on the left; the right-hand preview is exactly the PDF.
- **File → Export JSON** to back up; **Import JSON** (or drop the file onto the window) to restore.
- **Download PDF** opens the print dialog: choose *Save as PDF* and turn off *Headers and footers*.
- Every text field stores one value per language. Untranslated fields fall back to another language, so you only translate what differs.
- **Variants** reuse the same data for different job applications. The eye icon hides an item in the active variant only.
- `**bold**` works in any text.

Run it locally with `npm install && npm run dev`. To deploy, set *Settings → Pages* to **GitHub Actions** and push to `main`.
