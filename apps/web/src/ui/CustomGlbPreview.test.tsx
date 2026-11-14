import { describe, expect, it } from '@rstest/core';
import { renderToStaticMarkup } from 'react-dom/server';

import { CustomGlbPreview } from './CustomGlbPreview';

describe('CustomGlbPreview', () => {
  it('keeps a concrete model preview surface and a non-visual loading fallback', () => {
    const markup = renderToStaticMarkup(
      <CustomGlbPreview bytes={new Uint8Array([0x67, 0x6c, 0x54, 0x46])} label="Кресло из Sketchfab" />
    );

    expect(markup).toContain('data-testid="custom-glb-preview"');
    expect(markup).toContain('aria-label="Предпросмотр модели: Кресло из Sketchfab"');
    expect(markup).toContain('Подготавливаем 3D-предпросмотр');
  });
});
