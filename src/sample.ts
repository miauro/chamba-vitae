import { defaultSettings, uid } from './model';
import type { CV, Entry, LText } from './types';

const S = (es: string, en: string): LText => ({ es, en });

const entry = (title: LText, subtitle: LText, start: string, end: string, description: LText = {}): Entry => ({
  id: uid(),
  title,
  subtitle,
  start,
  end: end === 'now' ? '' : end,
  current: end === 'now',
  description,
});

/** CV de ejemplo para quien abre la app por primera vez. */
export function sampleCV(): CV {
  return {
    schema: 1,
    languages: ['es', 'en'],
    profile: {
      name: 'Alex Romero',
      title: S('Diseñador\nde Producto', 'Product\nDesigner'),
      contacts: [
        { id: uid(), label: S('Email:', 'Email:'), value: { es: 'alex.romero@example.com' } },
        { id: uid(), label: S('Teléfono:', 'Phone:'), value: { es: '+34 600 000 000' } },
        { id: uid(), label: S('Portfolio:', 'Portfolio:'), value: { es: 'alexromero.design' }, href: 'https://example.com' },
        { id: uid(), label: S('Disponibilidad:', 'Availability:'), value: S('Inmediata', 'Immediate') },
        { id: uid(), label: {}, value: { es: 'Madrid, ES' } },
      ],
    },
    sections: [
      {
        id: uid(),
        kind: 'text',
        title: S('sobre mí', 'about me'),
        body: S(
          'Diseñador de producto con **5 años de experiencia** creando interfaces digitales claras y útiles. Combino **investigación con usuarios**, diseño visual y prototipado para convertir problemas complejos en productos sencillos. Me gusta trabajar codo con codo con desarrollo y negocio.',
          'Product designer with **5 years of experience** building clear, useful digital interfaces. I combine **user research**, visual design and prototyping to turn complex problems into simple products. I enjoy working side by side with engineering and business.',
        ),
      },
      {
        id: uid(),
        kind: 'entries',
        title: S('formación', 'education'),
        items: [
          entry(S('Máster en Diseño de Interacción', 'MA in Interaction Design'), S('Escuela de Diseño, Madrid', 'School of Design, Madrid'), '2020', '2021'),
          entry(S('Grado en Bellas Artes', 'BA in Fine Arts'), S('Universidad Complutense, Madrid', 'Complutense University, Madrid'), '2015', '2019'),
        ],
      },
      {
        id: uid(),
        kind: 'entries',
        title: S('experiencia', 'experience'),
        items: [
          entry(
            S('Diseñador de Producto', 'Product Designer'),
            S('Estudio Norte | Madrid', 'Estudio Norte | Madrid'),
            '2022-03',
            'now',
            S('Diseño de apps web y móviles · Sistema de diseño · Tests con usuarios', 'Web & mobile app design · Design system · User testing'),
          ),
          entry(
            S('Diseñador UI', 'UI Designer'),
            S('Agencia Sur | Madrid', 'Agencia Sur | Madrid'),
            '2019-09',
            '2022-02',
            S('Interfaces para e-commerce · Prototipos en Figma', 'E-commerce interfaces · Figma prototypes'),
          ),
        ],
      },
      {
        id: uid(),
        kind: 'pairs',
        title: S('idiomas', 'languages'),
        items: [
          { id: uid(), label: S('Español', 'Spanish'), value: S('Nativo', 'Native') },
          { id: uid(), label: S('Inglés', 'English'), value: S('Avanzado (C1)', 'Advanced (C1)') },
        ],
      },
      {
        id: uid(),
        kind: 'skills',
        title: S('habilidades', 'skills'),
        groups: [
          {
            id: uid(),
            label: S('Herramientas', 'Tools'),
            rows: [
              { id: uid(), label: S('Diseño', 'Design'), items: { es: 'Figma\nIllustrator\nPhotoshop' } },
              { id: uid(), label: S('Código', 'Code'), items: { es: 'HTML & CSS\nJavaScript' } },
            ],
          },
        ],
      },
    ],
    variants: [{ id: uid(), name: 'General', hidden: [] }],
    settings: defaultSettings(),
  };
}
