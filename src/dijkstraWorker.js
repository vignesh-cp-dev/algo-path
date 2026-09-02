// ======================================================
// DIJKSTRA WEB WORKER (OFF-MAIN-THREAD GRAPH COMPUTATION)
// ======================================================

class MinHeap {
	constructor() {
		this.heap = [];
	}

	push(nodeId, priority) {
		this.heap.push({ id: nodeId, priority });
		this._bubbleUp(this.heap.length - 1);
	}

	pop() {
		if (this.heap.length === 0) return null;
		const top = this.heap[0];
		const bottom = this.heap.pop();
		if (this.heap.length > 0) {
			this.heap[0] = bottom;
			this._sinkDown(0);
		}
		return top;
	}

	isEmpty() {
		return this.heap.length === 0;
	}

	_bubbleUp(idx) {
		const element = this.heap[idx];
		while (idx > 0) {
			const parentIdx = Math.floor((idx - 1) / 2);
			const parent = this.heap[parentIdx];
			if (element.priority >= parent.priority) break;
			this.heap[idx] = parent;
			this.heap[parentIdx] = element;
			idx = parentIdx;
		}
	}

	_sinkDown(idx) {
		const length = this.heap.length;
		const element = this.heap[idx];
		while (true) {
			let leftChildIdx = 2 * idx + 1;
			let rightChildIdx = 2 * idx + 2;
			let swap = null;

			if (leftChildIdx < length) {
				if (this.heap[leftChildIdx].priority < element.priority) {
					swap = leftChildIdx;
				}
			}

			if (rightChildIdx < length) {
				if (
					(swap === null && this.heap[rightChildIdx].priority < element.priority) ||
					(swap !== null && this.heap[rightChildIdx].priority < this.heap[leftChildIdx].priority)
				) {
					swap = rightChildIdx;
				}
			}

			if (swap === null) break;
			this.heap[idx] = this.heap[swap];
			this.heap[swap] = element;
			idx = swap;
		}
	}
}

self.onmessage = function (e) {
	const {
		nodes, // Array of [id, lat, lon] or Map
		adjacency, // Object: id -> [{ targetId, weight, geometry, wayId, highway }]
		sourceNodeId,
		targetNodeId,
		osrmDistanceKm,
		nodeCount,
		edgeCount,
	} = e.data;

	const tStart = performance.now();

	const nodesMap = new Map();
	if (Array.isArray(nodes)) {
		for (let i = 0; i < nodes.length; i++) {
			const [id, lat, lon] = nodes[i];
			nodesMap.set(id, { id, lat, lon });
		}
	} else if (nodes) {
		for (const k in nodes) {
			nodesMap.set(k, nodes[k]);
		}
	}

	const sourceNode = nodesMap.get(sourceNodeId);
	const targetNode = nodesMap.get(targetNodeId);

	if (!sourceNode || !targetNode) {
		self.postMessage({
			success: false,
			error: 'Source or destination node does not exist in graph.',
		});
		return;
	}

	// Edge Case: Start and Destination map to the same OSM node
	if (sourceNodeId === targetNodeId) {
		const computationTimeMs = (performance.now() - tStart).toFixed(1);
		const pointGeometry = [[sourceNode.lat, sourceNode.lon], [sourceNode.lat, sourceNode.lon]];
		self.postMessage({
			success: true,
			pathFound: true,
			isSameLocation: true,
			sourceNode: { id: sourceNodeId, lat: sourceNode.lat, lon: sourceNode.lon },
			targetNode: { id: targetNodeId, lat: targetNode.lat, lon: targetNode.lon },
			visitedCount: 1,
			settledSteps: [{
				nodeId: sourceNodeId,
				distance: 0,
				prevId: sourceNodeId,
				geometry: pointGeometry,
				weight: 0,
				wayId: null,
				highway: null,
			}],
			totalGraphNodes: nodeCount,
			totalGraphEdges: edgeCount,
			dijkstraDistanceKm: '0.00',
			pathEdgeCount: 0,
			nodePath: [sourceNodeId],
			edgePath: [{
				from: sourceNodeId,
				to: sourceNodeId,
				weight: 0,
				geometry: pointGeometry,
				wayId: null,
				highway: null,
			}],
			osrmDistanceKm: osrmDistanceKm || '0.00',
			computationTimeMs,
			startDegree: adjacency[sourceNodeId] ? adjacency[sourceNodeId].length : 0,
			destDegree: adjacency[targetNodeId] ? adjacency[targetNodeId].length : 0,
			bothExistInAdjacency: Boolean(adjacency[sourceNodeId]),
		});
		return;
	}

	const distances = new Map();
	const previous = new Map(); // targetId -> { prevId, weight, geometry, wayId, highway }
	const visited = new Set();
	const pq = new MinHeap();
	const settledOrder = []; // Sequence of settled nodes for sampled visualization

	// Initialize source
	distances.set(sourceNodeId, 0);
	pq.push(sourceNodeId, 0);

	let destinationSettled = false;
	let settledCount = 0;

	while (!pq.isEmpty()) {
		const current = pq.pop();
		const uId = current.id;
		const uDist = current.priority;

		// If we already settled this vertex with a shorter path, skip
		if (visited.has(uId)) continue;
		visited.add(uId);
		settledCount++;
		settledOrder.push({ id: uId, dist: uDist });

		// Stop immediately once destination node is settled
		if (uId === targetNodeId) {
			destinationSettled = true;
			break;
		}

		const neighbors = adjacency[uId] || [];
		for (let i = 0; i < neighbors.length; i++) {
			const edge = neighbors[i];
			const vId = edge.targetId;
			if (visited.has(vId)) continue;

			const newDist = uDist + edge.weight;
			const currentDist = distances.has(vId) ? distances.get(vId) : Infinity;

			if (newDist < currentDist) {
				distances.set(vId, newDist);
				previous.set(vId, {
					prevId: uId,
					weight: edge.weight,
					geometry: edge.geometry,
					wayId: edge.wayId,
					highway: edge.highway,
				});
				pq.push(vId, newDist);
			}
		}
	}

	// Sample visualization exploration steps (~800-1500 steps)
	const settledSteps = [];
	const totalSettled = settledOrder.length;
	const TARGET_SAMPLE_COUNT = 1000;

	if (totalSettled <= TARGET_SAMPLE_COUNT) {
		for (let i = 0; i < totalSettled; i++) {
			const { id: uId, dist: uDist } = settledOrder[i];
			const prevInfo = previous.get(uId);
			if (prevInfo && prevInfo.geometry) {
				settledSteps.push({
					nodeId: uId,
					distance: uDist,
					prevId: prevInfo.prevId,
					geometry: prevInfo.geometry,
					weight: prevInfo.weight,
					wayId: prevInfo.wayId,
					highway: prevInfo.highway,
				});
			}
		}
	} else {
		const headCount = Math.min(100, Math.floor(totalSettled * 0.1));
		const tailCount = Math.min(100, Math.floor(totalSettled * 0.1));
		const middleTotal = totalSettled - headCount - tailCount;
		const middleTarget = TARGET_SAMPLE_COUNT - headCount - tailCount;
		const stride = Math.max(1, Math.floor(middleTotal / middleTarget));

		const indicesToInclude = new Set();
		for (let i = 0; i < headCount; i++) indicesToInclude.add(i);
		for (let i = headCount; i < totalSettled - tailCount; i += stride) indicesToInclude.add(i);
		for (let i = totalSettled - tailCount; i < totalSettled; i++) indicesToInclude.add(i);

		for (let i = 0; i < totalSettled; i++) {
			if (indicesToInclude.has(i)) {
				const { id: uId, dist: uDist } = settledOrder[i];
				const prevInfo = previous.get(uId);
				if (prevInfo && prevInfo.geometry) {
					settledSteps.push({
						nodeId: uId,
						distance: uDist,
						prevId: prevInfo.prevId,
						geometry: prevInfo.geometry,
						weight: prevInfo.weight,
						wayId: prevInfo.wayId,
						highway: prevInfo.highway,
					});
				}
			}
		}
	}

	// Reconstruct the shortest path if reached
	let pathFound = destinationSettled;
	const nodePath = [];
	const edgePath = [];
	let totalDijkstraDistanceKm = 0;

	if (pathFound) {
		let currId = targetNodeId;
		nodePath.unshift(currId);

		while (currId !== sourceNodeId) {
			const prevInfo = previous.get(currId);
			if (!prevInfo) break;
			edgePath.unshift({
				from: prevInfo.prevId,
				to: currId,
				weight: prevInfo.weight,
				geometry: prevInfo.geometry,
				wayId: prevInfo.wayId,
				highway: prevInfo.highway,
			});
			totalDijkstraDistanceKm += prevInfo.weight;
			currId = prevInfo.prevId;
			nodePath.unshift(currId);
		}
	}

	const computationTimeMs = (performance.now() - tStart).toFixed(1);
	const startDegree = adjacency[sourceNodeId] ? adjacency[sourceNodeId].length : 0;
	const destDegree = adjacency[targetNodeId] ? adjacency[targetNodeId].length : 0;
	const bothExistInAdjacency = Boolean(adjacency[sourceNodeId] && adjacency[targetNodeId]);

	self.postMessage({
		success: true,
		pathFound,
		sourceNode: { id: sourceNodeId, lat: sourceNode.lat, lon: sourceNode.lon },
		targetNode: { id: targetNodeId, lat: targetNode.lat, lon: targetNode.lon },
		visitedCount: settledCount,
		settledSteps,
		totalGraphNodes: nodeCount,
		totalGraphEdges: edgeCount,
		dijkstraDistanceKm: pathFound ? totalDijkstraDistanceKm.toFixed(2) : null,
		pathEdgeCount: edgePath.length,
		nodePath,
		edgePath,
		osrmDistanceKm: osrmDistanceKm || null,
		computationTimeMs,
		startDegree,
		destDegree,
		bothExistInAdjacency,
	});
};
