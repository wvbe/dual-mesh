export type PointI = number[];

export type DelaunatorI = {
	halfedges: Int32Array;
	triangles: Int32Array;
};

export type PartialMesh = {
	numBoundaryRegions: number;
	numSolidSides: number;
	_r_vertex: PointI[];
	_halfedges: DelaunatorI['halfedges'];
	_triangles: DelaunatorI['triangles'];
};
