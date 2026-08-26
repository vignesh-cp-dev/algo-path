export function dijkstra(adjacencyList, startNode) {
	const distances = {};
	const previous = {};
	const visited = new Set();

	Object.keys(adjacencyList).forEach((node) => {
		distances[node] = Infinity;
		previous[node] = null;
	});

	distances[startNode] = 0;

	while (visited.size < Object.keys(adjacencyList).length) {
		let currentNode = null;
		let shortestDistance = Infinity;

		Object.keys(distances).forEach((node) => {
			if (!visited.has(node) && distances[node] < shortestDistance) {
				shortestDistance = distances[node];
				currentNode = node;
			}
		});

		if (currentNode === null) {
			break;
		}

		visited.add(currentNode);

		adjacencyList[currentNode].forEach(({ node, weight }) => {
			const distanceThroughCurrent = distances[currentNode] + weight;

			if (distanceThroughCurrent < distances[node]) {
				distances[node] = distanceThroughCurrent;
				previous[node] = currentNode;
			}
		});
	}

	return { distances, previous };
}
