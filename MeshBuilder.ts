/*
 * From https://github.com/redblobgames/dual-mesh
 * Copyright 2017 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 *
 * Generate a random triangle mesh for the area 0 <= x <= 1000, 0 <= y <= 1000
 *
 * This program runs on the command line (node)
 */

'use strict';

import type PoissonDiskSampling from '../poisson-disk-sampling/mod.ts';
import TriangleMesh from './TriangleMesh.ts';
import { type PartialMesh } from './types.ts';

import Delaunator from 'npm:delaunator@^4.0.0'; // ISC licensed
import { PointI } from '../poisson-disk-sampling/src/types.ts';

function s_next_s(s: number): number {
	return s % 3 == 2 ? s - 2 : s + 1;
}

function checkPointInequality({}: Omit<PartialMesh, 'numSolidSides' | 'numBoundaryRegions'>) {
	// TODO: check for collinear vertices. Around each red point P if
	// there's a point Q and R both connected to it, and the angle P→Q and
	// the angle P→R are 180° apart, then there's collinearity. This would
	// indicate an issue with point selection.
}

function checkTriangleInequality({
	_r_vertex,
	_triangles,
}: Pick<PartialMesh, '_r_vertex' | '_triangles'>) {
	// check for skinny triangles
	const badAngleLimit = 30;
	const summary = new Array(badAngleLimit).fill(0);
	let count = 0;
	for (let s = 0; s < _triangles.length; s++) {
		const r0 = _triangles[s],
			r1 = _triangles[s_next_s(s)],
			r2 = _triangles[s_next_s(s_next_s(s))];
		const p0 = _r_vertex[r0],
			p1 = _r_vertex[r1],
			p2 = _r_vertex[r2];
		const d0 = [p0[0] - p1[0], p0[1] - p1[1]];
		const d2 = [p2[0] - p1[0], p2[1] - p1[1]];
		const dotProduct = d0[0] * d2[0] + d0[1] + d2[1];
		const angleDegrees = (180 / Math.PI) * Math.acos(dotProduct);
		if (angleDegrees < badAngleLimit) {
			summary[angleDegrees | 0]++;
			count++;
		}
	}
	// NOTE: a much faster test would be the ratio of the inradius to
	// the circumradius, but as I'm generating these offline, I'm not
	// worried about speed right now

	// TODO: consider adding circumcenters of skinny triangles to the point set
	if (count > 0) {
		console.log('  bad angles:', summary.join(' '));
	}
}

function checkMeshConnectivity({ _r_vertex, _triangles, _halfedges }: PartialMesh) {
	// 1. make sure each side's opposite is back to itself
	// 2. make sure region-circulating starting from each side works
	const ghost_r = _r_vertex.length - 1,
		out_s = [];
	for (let s0 = 0; s0 < _triangles.length; s0++) {
		if (_halfedges[_halfedges[s0]] !== s0) {
			console.log(`FAIL _halfedges[_halfedges[${s0}]] !== ${s0}`);
		}
		let s = s0,
			count = 0;
		out_s.length = 0;
		do {
			count++;
			out_s.push(s);
			s = s_next_s(_halfedges[s]);
			if (count > 100 && _triangles[s0] !== ghost_r) {
				console.log(
					`FAIL to circulate around region with start side=${s0} from region ${_triangles[s0]} to ${
						_triangles[s_next_s(s0)]
					}, out_s=${out_s}`,
				);
				break;
			}
		} while (s !== s0);
	}
}

/*
 * Add vertices evenly along the boundary of the mesh;
 * use a slight curve so that the Delaunay triangulation
 * doesn't make long thing triangles along the boundary.
 * These points also prevent the Poisson disc generator
 * from making uneven points near the boundary.
 */
function addBoundaryPoints(spacing: number, size: number): number[][] {
	const N = Math.ceil(size / spacing);
	const points: number[][] = [];
	for (let i = 0; i <= N; i++) {
		const t = (i + 0.5) / (N + 1);
		const w = size * t;
		const offset = Math.pow(t - 0.5, 2);
		points.push([offset, w], [size - offset, w]);
		points.push([w, offset], [w, size - offset]);
	}
	return points;
}

function addGhostStructure({
	_r_vertex,
	_triangles,
	_halfedges,
}: Omit<PartialMesh, 'numSolidSides' | 'numBoundaryRegions'>): Omit<
	PartialMesh,
	'numBoundaryRegions'
> {
	const numSolidSides = _triangles.length;
	const ghost_r = _r_vertex.length;

	let numUnpairedSides = 0,
		firstUnpairedEdge = -1;
	const r_unpaired_s: number[] = []; // seed to side
	for (let s = 0; s < numSolidSides; s++) {
		if (_halfedges[s] === -1) {
			numUnpairedSides++;
			r_unpaired_s[_triangles[s]] = s;
			firstUnpairedEdge = s;
		}
	}

	const r_newvertex = _r_vertex.concat([[500, 500]]);
	const s_newstart_r = new Int32Array(numSolidSides + 3 * numUnpairedSides);
	s_newstart_r.set(_triangles);
	const s_newopposite_s = new Int32Array(numSolidSides + 3 * numUnpairedSides);
	s_newopposite_s.set(_halfedges);

	for (
		let i = 0, s = firstUnpairedEdge;
		i < numUnpairedSides;
		i++, s = r_unpaired_s[s_newstart_r[s_next_s(s)]]
	) {
		// Construct a ghost side for s
		const ghost_s = numSolidSides + 3 * i;
		s_newopposite_s[s] = ghost_s;
		s_newopposite_s[ghost_s] = s;
		s_newstart_r[ghost_s] = s_newstart_r[s_next_s(s)];

		// Construct the rest of the ghost triangle
		s_newstart_r[ghost_s + 1] = s_newstart_r[s];
		s_newstart_r[ghost_s + 2] = ghost_r;
		let k = numSolidSides + ((3 * i + 4) % (3 * numUnpairedSides));
		s_newopposite_s[ghost_s + 2] = k;
		s_newopposite_s[k] = ghost_s + 2;
	}

	return {
		numSolidSides,
		_r_vertex: r_newvertex,
		_triangles: s_newstart_r,
		_halfedges: s_newopposite_s,
	};
}

/**
 * Build a dual mesh from points, with ghost triangles around the exterior.
 *
 * The builder assumes 0 ≤ x < 1000, 0 ≤ y < 1000
 *
 * Options:
 *   - To have equally spaced points added around the 1000x1000 boundary,
 *     pass in boundarySpacing > 0 with the spacing value. If using Poisson
 *     disc points, I recommend 1.5 times the spacing used for Poisson disc.
 *
 * Phases:
 *   - Your own set of points
 *   - Poisson disc points
 *
 * The mesh generator runs some sanity checks but does not correct the
 * generated points.
 *
 * Examples:
 *
 * Build a mesh with poisson disc points and a boundary:
 *
 * new MeshBuilder({boundarySpacing: 150})
 *    .addPoisson(Poisson, 100)
 *    .create()
 */
class MeshBuilder {
	numBoundaryRegions: number;
	points: PointI[];

	/** If boundarySpacing > 0 there will be a boundary added around the 1000x1000 area */
	public constructor({ boundarySpacing = 0 } = {}) {
		const boundaryPoints = boundarySpacing > 0 ? addBoundaryPoints(boundarySpacing, 1000) : [];
		this.points = boundaryPoints;
		this.numBoundaryRegions = boundaryPoints.length;
	}

	/** Points should be [x, y] */
	addPoints(newPoints: PointI[]): this {
		for (let p of newPoints) {
			this.points.push(p);
		}
		return this;
	}

	/** Points will be [x, y] */
	getNonBoundaryPoints(): PointI[] {
		return this.points.slice(this.numBoundaryRegions);
	}

	/** (used for more advanced mixing of different mesh types) */
	clearNonBoundaryPoints(): this {
		this.points.splice(this.numBoundaryRegions, this.points.length);
		return this;
	}

	/** Pass in the constructor from the poisson-disk-sampling module */
	addPoisson(Poisson: typeof PoissonDiskSampling, spacing: number, random = Math.random): this {
		const generator = new Poisson(
			{
				shape: [1000, 1000],
				minDistance: spacing,
			},
			random,
		);
		this.points.forEach((p) => generator.addPoint(p));
		this.points = generator.fill();
		return this;
	}

	/** Build and return a TriangleMesh */
	create(runChecks = false): TriangleMesh {
		// TODO: use Float32Array instead of this, so that we can
		// construct directly from points read in from a file
		const delaunator = Delaunator.from(this.points);
		const graph: Omit<PartialMesh, 'numSolidSides' | 'numBoundaryRegions'> = {
			_r_vertex: this.points,
			_triangles: delaunator.triangles,
			_halfedges: delaunator.halfedges,
		};

		if (runChecks) {
			checkPointInequality(graph);
			checkTriangleInequality(graph);
		}

		const graph3: PartialMesh = {
			...addGhostStructure(graph),
			numBoundaryRegions: this.numBoundaryRegions,
		};
		if (runChecks) {
			checkMeshConnectivity(graph3);
		}

		return new TriangleMesh(graph3);
	}
}

export default MeshBuilder;
