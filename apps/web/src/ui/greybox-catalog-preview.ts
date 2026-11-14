import type { GreyboxFurniturePreset } from './greybox-furniture';

export type GreyboxPreviewRole =
  | 'arm'
  | 'back'
  | 'bed-base'
  | 'body'
  | 'drawer'
  | 'headboard'
  | 'leg'
  | 'mattress'
  | 'seat'
  | 'tabletop';

export interface GreyboxPreviewPart {
  readonly height: number;
  readonly role: GreyboxPreviewRole;
  readonly tone: 'base' | 'highlight' | 'shadow';
  readonly width: number;
  readonly x: number;
  readonly y: number;
}

type PreviewId = GreyboxFurniturePreset['id'];

const commonBody = (role: GreyboxPreviewRole = 'body'): readonly GreyboxPreviewPart[] => [
  { height: 55, role, tone: 'base', width: 66, x: 17, y: 30 }
];

/** Local card silhouettes intentionally mirror the procedural 3D greybox family, never a remote catalog asset. */
export function greyboxPreviewPartsFor(id: PreviewId): readonly GreyboxPreviewPart[] {
  switch (id) {
    case 'bed':
      return [
        { height: 30, role: 'bed-base', tone: 'base', width: 72, x: 14, y: 57 },
        { height: 24, role: 'mattress', tone: 'highlight', width: 68, x: 16, y: 37 },
        { height: 52, role: 'headboard', tone: 'shadow', width: 12, x: 12, y: 18 }
      ];
    case 'table':
      return [
        { height: 14, role: 'tabletop', tone: 'highlight', width: 70, x: 15, y: 35 },
        { height: 42, role: 'leg', tone: 'base', width: 8, x: 20, y: 48 },
        { height: 42, role: 'leg', tone: 'base', width: 8, x: 72, y: 48 },
        { height: 22, role: 'leg', tone: 'shadow', width: 8, x: 28, y: 60 },
        { height: 22, role: 'leg', tone: 'shadow', width: 8, x: 64, y: 60 }
      ];
    case 'chair':
      return [
        { height: 18, role: 'seat', tone: 'highlight', width: 48, x: 26, y: 52 },
        { height: 33, role: 'leg', tone: 'base', width: 7, x: 30, y: 67 },
        { height: 33, role: 'leg', tone: 'base', width: 7, x: 63, y: 67 },
        { height: 24, role: 'leg', tone: 'shadow', width: 7, x: 37, y: 75 },
        { height: 24, role: 'leg', tone: 'shadow', width: 7, x: 56, y: 75 }
      ];
    case 'sofa':
      return [
        { height: 35, role: 'body', tone: 'base', width: 70, x: 15, y: 55 },
        { height: 20, role: 'seat', tone: 'highlight', width: 54, x: 23, y: 43 },
        { height: 40, role: 'back', tone: 'shadow', width: 70, x: 15, y: 18 },
        { height: 38, role: 'arm', tone: 'base', width: 12, x: 13, y: 45 },
        { height: 38, role: 'arm', tone: 'base', width: 12, x: 75, y: 45 }
      ];
    case 'bedside-table':
    case 'dresser':
    case 'wardrobe':
      return [
        ...commonBody(),
        { height: 8, role: 'drawer', tone: 'highlight', width: 56, x: 22, y: 42 },
        { height: 8, role: 'drawer', tone: 'highlight', width: 56, x: 22, y: 57 },
        { height: 8, role: 'drawer', tone: 'highlight', width: 56, x: 22, y: 72 }
      ];
  }
}
