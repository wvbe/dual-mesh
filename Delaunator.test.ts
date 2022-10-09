/*
 * From https://github.com/redblobgames/dual-mesh
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

import { expect, it, run } from 'https://deno.land/x/tincan@1.0.1/mod.ts';
import Delaunator from 'npm:delaunator@^4.0.0';
import Poisson from '../poisson-disk-sampling/mod.ts';
import { DelaunatorI } from './types.ts';

it('delaunator: properly connected halfedges', () => {
	const points = [
		[122, 270],
		[181, 121],
		[195, 852],
		[204, 694],
		[273, 525],
		[280, 355],
		[31, 946],
		[319, 938],
		[33, 625],
		[344, 93],
		[369, 793],
		[38, 18],
		[426, 539],
		[454, 239],
		[503, 51],
		[506, 997],
		[516, 661],
		[532, 386],
		[619, 889],
		[689, 131],
		[730, 511],
		[747, 750],
		[760, 285],
		[856, 83],
		[88, 479],
		[884, 943],
		[927, 696],
		[960, 472],
		[992, 253],
	].map((p) => [p[0] + Math.random(), p[1]]);
	const { halfedges } = Delaunator.from(points) as DelaunatorI;
	expect(
		halfedges.every(
			(a, b) =>
				a === -1 ||
				// … i is out of range, or
				// the half edge is reprocipical …
				halfedges[a] === b,
		),
	).toBeTruthy();
});

it('delaunator: properly connected halfedges, random set', () => {
	// NOTE: this is not a great test because the input data is
	// different each time; need to switch to a deterministic random
	// number generator
	let generator = new Poisson({ shape: [1000, 1000], minDistance: 50.0 });
	let points = generator.fill();
	const { halfedges } = Delaunator.from(points) as DelaunatorI;
	expect(
		halfedges.every(
			(a, b) =>
				a === -1 ||
				// … i is out of range, or
				// the half edge is reprocipical …
				halfedges[a] === b,
		),
	).toBeTruthy();
});

run();
