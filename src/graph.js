export function buildAdjacencyList(graph) {
	const adjacencyList = {};

	graph.nodes.forEach((node) => {
		adjacencyList[node.id] = [];
	});

	graph.edges.forEach(({ source, target, weight }) => {
		adjacencyList[source].push({ node: target, weight });
		adjacencyList[target].push({ node: source, weight });
	});

	return adjacencyList;
}
