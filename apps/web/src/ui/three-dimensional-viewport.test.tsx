import { describe, expect, it } from '@rstest/core';

import {
	fitThreeDimensionalViewport,
	focusThreeDimensionalViewportOnSelectedItem,
  initialThreeDimensionalViewport,
	initialThreeDimensionalViewportForRoom,
	initialThreeDimensionalViewportForSelectedItem,
  orbitThreeDimensionalViewport,
  panThreeDimensionalViewport,
  zoomThreeDimensionalViewport
} from './three-dimensional-viewport';

const room = {
	cameraBounds: { centerXM: 2.05, centerZM: 1.55, depthM: 3.1, widthM: 4.1 },
	dimensions: { depthMm: 3000, heightMm: 2600, widthMm: 4000 },
};

describe('three-dimensional viewport', () => {
	 it('starts close enough for the room shell to occupy the phone canvas', () => {
		expect(initialThreeDimensionalViewport.distance).toBe(2.1);
	 });

	it('fits the disposable room envelope to the live portrait canvas instead of using a fixed distant frame', () => {
		const fitted = fitThreeDimensionalViewport(
			initialThreeDimensionalViewport,
			room,
			{ height: 660, width: 393 },
		);

		expect(fitted.distance).toBeGreaterThan(1.8);
		expect(fitted.distance).toBeLessThan(2.9);
		expect(fitted).toMatchObject({
			azimuthRadians: initialThreeDimensionalViewport.azimuthRadians,
			elevationRadians: initialThreeDimensionalViewport.elevationRadians,
			panXM: 0,
			panZM: 0,
		});
	});

	it('uses the compact axis to keep a wide four-room apartment closer on a portrait phone', () => {
		const fourRoomApartment = {
			cameraBounds: { depthM: 4.9, widthM: 6.1 },
			dimensions: { heightMm: 2600 },
		};
		const compactAxis = fitThreeDimensionalViewport(
			initialThreeDimensionalViewport,
			fourRoomApartment,
			{ height: 660, width: 393 },
		);
		const broadAxis = fitThreeDimensionalViewport(
			{ ...initialThreeDimensionalViewport, azimuthRadians: Math.PI / 2 },
			fourRoomApartment,
			{ height: 660, width: 393 },
		);

		expect(compactAxis.distance).toBeLessThan(broadAxis.distance);
	});

	it('keeps a wider or taller envelope safely framed when the phone canvas changes shape', () => {
		const portrait = fitThreeDimensionalViewport(
			initialThreeDimensionalViewport,
			{
				...room,
				cameraBounds: { ...room.cameraBounds, depthM: 6.2, widthM: 6.2 },
				dimensions: { heightMm: 3200 },
			},
			{ height: 660, width: 393 },
		);
		const landscape = fitThreeDimensionalViewport(
			initialThreeDimensionalViewport,
			{
				...room,
				cameraBounds: { ...room.cameraBounds, depthM: 6.2, widthM: 6.2 },
				dimensions: { heightMm: 3200 },
			},
			{ height: 393, width: 660 },
		);

		expect(portrait.distance).toBeGreaterThan(landscape.distance);
		expect(portrait.distance).toBeLessThanOrEqual(3.4);
	});

	it('fails closed while the canvas has not reported a finite layout size', () => {
		expect(
			fitThreeDimensionalViewport(initialThreeDimensionalViewport, room, {
				height: 0,
				width: 393,
			}),
		).toBe(initialThreeDimensionalViewport);
		expect(
			fitThreeDimensionalViewport(initialThreeDimensionalViewport, room, {
				height: Number.NaN,
				width: 393,
			}),
		).toBe(initialThreeDimensionalViewport);
	});

	it('opens across the compact room axis so a furnished shell fills a portrait phone', () => {
		expect(initialThreeDimensionalViewport.azimuthRadians).toBe(0);
		expect(initialThreeDimensionalViewport.elevationRadians).toBe(1);
	});

	it('chooses the compact horizontal axis for both wide and tall room envelopes', () => {
		expect(
			initialThreeDimensionalViewportForRoom({
				cameraBounds: { depthM: 3, widthM: 7 },
			}).azimuthRadians,
		).toBe(0);
		expect(
			initialThreeDimensionalViewportForRoom({
				cameraBounds: { depthM: 7, widthM: 3 },
			}).azimuthRadians,
		).toBe(Math.PI / 2);
		expect(
			initialThreeDimensionalViewportForRoom({
				cameraBounds: { depthM: 7, widthM: 3 },
			}).elevationRadians,
		).toBe(1.15);
		expect(
			initialThreeDimensionalViewportForRoom({
				cameraBounds: { depthM: 6, widthM: 6 },
			}).azimuthRadians,
		).toBe(0);
	});

	it('opens through the nearest complete facade for an item already selected in Plan', () => {
		const roomCentre = { centerXM: 3, centerZM: 2.4 };

		expect(
			initialThreeDimensionalViewportForSelectedItem(roomCentre, {
				centerXM: 4,
				centerZM: 2.4,
			}).azimuthRadians,
		).toBe(0);
		expect(
			initialThreeDimensionalViewportForSelectedItem(roomCentre, {
				centerXM: 2,
				centerZM: 2.4,
			}).azimuthRadians,
		).toBe(Math.PI);
		expect(
			initialThreeDimensionalViewportForSelectedItem(roomCentre, {
				centerXM: 3,
				centerZM: 3.4,
			}).azimuthRadians,
		).toBe(Math.PI / 2);
		expect(
			initialThreeDimensionalViewportForSelectedItem(roomCentre, {
				centerXM: 3,
				centerZM: 1.4,
			}).azimuthRadians,
		).toBe(-Math.PI / 2);
		expect(
			initialThreeDimensionalViewportForSelectedItem(roomCentre, {
				centerXM: 3,
				centerZM: 2.4,
			}),
		).toEqual(initialThreeDimensionalViewport);
	});

	it('centres a preselected floor item and closes the initial camera without changing its facade', () => {
		const fittedRoomViewport = {
			...initialThreeDimensionalViewport,
			distance: 1.8,
		};

		const focused = focusThreeDimensionalViewportOnSelectedItem(
			fittedRoomViewport,
			{ centerXM: 3, centerZM: 2.4 },
			{ centerXM: 4.8, centerZM: 1.2 },
		);
		expect(focused).toMatchObject({
			azimuthRadians: fittedRoomViewport.azimuthRadians,
			elevationRadians: fittedRoomViewport.elevationRadians,
		});
		expect(focused.distance).toBeCloseTo(0.72, 8);
		expect(focused.panXM).toBeCloseTo(1.8, 8);
		expect(focused.panZM).toBeCloseTo(-1.2, 8);
		expect(
			focusThreeDimensionalViewportOnSelectedItem(
				fittedRoomViewport,
				{ centerXM: 3, centerZM: 2.4 },
				undefined,
			),
		).toBe(fittedRoomViewport);
	});

	it('orbits the disposable camera without storing a project transform', () => {
		expect(orbitThreeDimensionalViewport(initialThreeDimensionalViewport, 50, -30)).toEqual({
			azimuthRadians: 0.5,
		  distance: 2.1,
		  elevationRadians: 0.7,
      panXM: 0,
      panZM: 0
    });
  });

  it('clamps touch pinch distance to a controlled camera range', () => {
    expect(zoomThreeDimensionalViewport(initialThreeDimensionalViewport, 100)).toMatchObject({ distance: 0.7 });
    expect(zoomThreeDimensionalViewport(initialThreeDimensionalViewport, 0.01)).toMatchObject({ distance: 3.4 });
  });

	it('moves the 3D scene in the same direction as a two-finger translation', () => {
	const panned = panThreeDimensionalViewport(initialThreeDimensionalViewport, 50, -30);

		expect(panned.panXM).toBeCloseTo(0.3, 3);
		expect(panned.panZM).toBeCloseTo(0.5, 3);
  });

	it('keeps two-finger panning coherent after the user orbits into an oblique view', () => {
		const panned = panThreeDimensionalViewport(
			{ ...initialThreeDimensionalViewport, azimuthRadians: Math.PI / 4 },
			50,
			-30,
		);

		expect(panned.panXM).toBeCloseTo(-0.141, 3);
		expect(panned.panZM).toBeCloseTo(0.566, 3);
	});
});
