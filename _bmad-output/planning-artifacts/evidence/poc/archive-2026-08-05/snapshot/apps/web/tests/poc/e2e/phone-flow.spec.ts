import { expect, test } from '@playwright/test';

test.describe('phone proof of concept', () => {
  test('adds a divider in the current demo session and returns from InApp Focus', async ({
    page
  }) => {
    await page.goto('/');

    await expect(
      page.getByLabel('Статус POC').getByText('POC · demo data · not saved')
    ).toBeVisible();
    await expect(page.getByTestId('wall-count')).toHaveText('8 сегментов стен');

    await page.getByRole('button', { name: 'Перегородка' }).click();
    await page.getByRole('button', { name: 'Добавить перегородку' }).click();

    await expect(page.getByTestId('wall-count')).toHaveText('9 сегментов стен');
    await expect(page.getByTestId('editor-notice')).toHaveText(
      'Перегородка добавлена только в эту сессию'
    );
    await expect(
      page.getByRole('button', { name: 'Добавить перегородку' })
    ).toBeDisabled();

    await page.getByRole('button', { name: 'Открыть фокус-режим' }).click();
    await expect(page.getByTestId('focus-editor')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выйти из фокус-режима' })).toBeVisible();
    await expect(page.getByTestId('focus-active-tool')).toHaveText(
      'ИНСТРУМЕНТ: Перегородка'
    );
    expect(await page.evaluate(() => document.fullscreenElement)).toBeNull();
    await expect(
      page.getByLabel('Статус POC').getByText('POC · demo data · not saved')
    ).toBeVisible();
    await expect(
      page.getByRole('img', { name: 'Демонстрационный план квартиры' })
    ).toBeInViewport();
    await expect(page.getByTestId('demo-divider')).toHaveAttribute('d', 'M184 225V340');
    await expect(
      page.getByRole('button', { name: 'Добавить перегородку' })
    ).toBeInViewport();

    const focusViewportHeight = await page.evaluate(() => window.innerHeight);

    for (const buttonName of ['Выйти из фокус-режима', 'Добавить перегородку']) {
      const button = page.getByRole('button', { name: buttonName });
      const box = await button.boundingBox();

      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        focusViewportHeight
      );
      await expect(button).toBeInViewport();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight)
    ).toBeLessThanOrEqual(focusViewportHeight);

    await page.getByRole('button', { name: 'Выйти из фокус-режима' }).click();
    await expect(page.getByTestId('focus-editor')).toHaveCount(0);
    await expect(page.getByTestId('wall-count')).toHaveText('9 сегментов стен');
    await expect(page.getByRole('button', { name: 'Перегородка' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByTestId('demo-divider')).toHaveAttribute('d', 'M184 225V340');
  });

  test('resets every ephemeral editor state to the source-controlled demo on reload', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Перегородка' }).click();
    await page.getByRole('button', { name: 'Добавить перегородку' }).click();
    await expect(page.getByTestId('wall-count')).toHaveText('9 сегментов стен');
    await page.getByRole('button', { name: 'Открыть фокус-режим' }).click();
    await expect(page.getByTestId('focus-editor')).toBeVisible();

    await page.reload();

    await expect(page.getByTestId('wall-count')).toHaveText('8 сегментов стен');
    await expect(page.getByTestId('focus-editor')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Открыть фокус-режим' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выбор' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(page.getByTestId('demo-divider')).toHaveCount(0);
    await expect(
      page.getByLabel('Статус POC').getByText('POC · demo data · not saved')
    ).toBeVisible();
  });

  test('explains the divider guard and lets the person recover with the matching tool', async ({
    page
  }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Объект' }).click();
    await page.getByRole('button', { name: 'Открыть фокус-режим' }).click();

    await expect(page.getByTestId('focus-active-tool')).toHaveText('ИНСТРУМЕНТ: Объект');
    await page.getByRole('button', { name: 'Добавить перегородку' }).click();

    await expect(page.getByTestId('wall-count')).toHaveText('8 сегментов стен');
    await expect(page.getByTestId('editor-notice')).toHaveText(
      'Выберите инструмент «Перегородка»'
    );
    await expect(page.getByTestId('demo-divider')).toHaveCount(0);

    await page.getByRole('button', { name: 'Выйти из фокус-режима' }).click();

    await page.getByRole('button', { name: 'Перегородка' }).click();
    await page.getByRole('button', { name: 'Добавить перегородку' }).click();

    await expect(page.getByTestId('wall-count')).toHaveText('9 сегментов стен');
    await expect(page.getByTestId('demo-divider')).toHaveAttribute('d', 'M184 225V340');
  });

  test('keeps each normal-mode tool target at the phone touch floor', async ({ page }) => {
    await page.goto('/');

    const normalViewportHeight = await page.evaluate(() => window.innerHeight);

    for (const buttonName of ['Выбор', 'Перегородка', 'Объект']) {
      const button = page.getByRole('button', { name: buttonName });
      const box = await button.boundingBox();

      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.y).toBeGreaterThanOrEqual(0);
      expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(
        normalViewportHeight
      );
      await expect(button).toBeInViewport();
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight)
    ).toBeLessThanOrEqual(normalViewportHeight);
  });

  test('keeps the POC session local to the browser tab', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', (request) => {
      if (new URL(request.url()).origin !== 'http://127.0.0.1:4173') {
        externalRequests.push(request.url());
      }
    });

    await page.goto('/');
    await page.getByRole('button', { name: 'Перегородка' }).click();
    await page.getByRole('button', { name: 'Добавить перегородку' }).click();
    await page.getByRole('button', { name: 'Открыть фокус-режим' }).click();

    expect(externalRequests).toEqual([]);
    expect(
      await page.evaluate(() => ({
        localStorageEntries: localStorage.length,
        sessionStorageEntries: sessionStorage.length
      }))
    ).toEqual({ localStorageEntries: 0, sessionStorageEntries: 0 });
  });
});
