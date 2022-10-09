/*
 * From https://github.com/redblobgames/dual-mesh
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 */

import { expect, it, run } from 'https://deno.land/x/tincan@1.0.1/mod.ts';
import Delaunator from 'npm:delaunator@^4.0.0';
import Poisson from '../poisson-disk-sampling/mod.ts';
import MeshBuilder from './MeshBuilder.ts';
import { DelaunatorI } from './types.ts';

it('structural invariants', () => {
	const mesh = new MeshBuilder({ boundarySpacing: 450 }).addPoisson(Poisson, 450).create(true);

	let s_out: number[] = [];
	for (let s1 = 0; s1 < mesh.numSides; s1++) {
		let s2 = mesh.s_opposite_s(s1);
		expect(mesh.s_opposite_s(s2)).toBe(s1);
		expect(mesh.s_begin_r(s1)).toBe(mesh.s_end_r(s2));
		expect(mesh.s_inner_t(s1)).toBe(mesh.s_outer_t(s2));
		expect(mesh.s_begin_r(mesh.s_next_s(s1))).toBe(mesh.s_begin_r(s2));
	}
	console.log('s_out:');
	console.log(s_out);
	for (let r = 0; r < mesh.numRegions; r++) {
		mesh.r_circulate_s(s_out, r);
		console.log('s_out 2:');
		console.log(s_out);
		for (let s of s_out) {
			console.log(s, r);
			expect(mesh.s_begin_r(s)).toBe(r);
		}
	}
	for (let t = 0; t < mesh.numTriangles; t++) {
		mesh.t_circulate_s(s_out, t);
		for (let s of s_out) {
			expect(mesh.s_inner_t(s)).toBe(t);
		}
	}
});

run();
