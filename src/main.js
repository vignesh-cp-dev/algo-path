import { buildAdjacencyList } from './graph.js';
import { dijkstra } from './dijkstra.js';
import {
    dijkstraWithSteps
} from './dijkstra.js';
 
const svgNS = 'http://www.w3.org/2000/svg';

// ======================================================
// CORE GRAPH STATE
// ======================================================

const graph = {
	nodes: [
		{ id: 'A', x: 140, y: 110 },
		{ id: 'B', x: 380, y: 90 },
		{ id: 'C', x: 560, y: 240 },
		{ id: 'D', x: 260, y: 290 },
	],

	edges: [],
};

const testGraph = {
	nodes: [
		{ id: 'A' },
		{ id: 'B' },
		{ id: 'C' },
		{ id: 'D' },
	],

	edges: [
		{ source: 'A', target: 'B', weight: 5 },
		{ source: 'A', target: 'C', weight: 2 },
		{ source: 'C', target: 'D', weight: 3 },
		{ source: 'B', target: 'D', weight: 1 },
	],
};

const testAdjacencyList =
	buildAdjacencyList(testGraph);

const testResult =
	dijkstraWithSteps(
		testAdjacencyList,
		'A'
	);

console.log(
	'========== M4D.1 DIJKSTRA STEPS TEST =========='
);

console.log(
	'Test Adjacency List:',
	testAdjacencyList
);

console.log(
	'Final Distances:',
	testResult.distances
);

console.log(
	'Final Previous:',
	testResult.previous
);

console.log(
	'Execution Steps:',
	testResult.steps
);

console.log(
	'Number of Steps:',
	testResult.steps.length
);

console.log(
	'==============================================='
);

// ======================================================
// UI STATE
// ======================================================

const ui = {
	selectedNodeId: null,
	draggingNodeId: null,
	startNodeId: null,
	destinationNodeId: null,

	selectMode: true,
	addNodeMode: false,
	addEdgeMode: false,
	deleteMode: false,
	startMode: false,
	destinationMode: false,

	edgeSourceNodeId: null,
};

const animation = {
	steps: [],
	currentStepIndex: -1,
	visitedNodes: new Set(),
	currentNodeId: null,
	checkingEdge: null,
	distanceUpdates: {},
	distances: {},
	previous: {},
	finalPath: [],
	isRunning: false,
	timeoutId: null,
	isPrepared: false,
};

function resetAnimationState() {
	animation.steps = [];
	animation.currentStepIndex = -1;
	animation.visitedNodes.clear();
	animation.currentNodeId = null;
	animation.checkingEdge = null;
	animation.distanceUpdates = {};
	animation.distances = {};
	animation.previous = {};
	animation.finalPath = [];
	animation.isPrepared = false;
}

function applyAnimationStep(step) {
	if (!step) {
		return;
	}

	if (step.type === 'current') {
		animation.currentNodeId = step.node;
	} else if (step.type === 'checking-edge') {
		animation.checkingEdge = {
			from: step.from,
			to: step.to,
		};
	} else if (step.type === 'update-distance') {
		animation.distanceUpdates[step.node] = step.distance;
	} else if (step.type === 'visited') {
		animation.visitedNodes.add(step.node);
	}

	animation.currentStepIndex++;
}

function reconstructShortestPath(
	previous,
	startNode,
	destinationNode
) {
	if (startNode === destinationNode) {
		return [startNode];
	}

	const path = [];
	const seenNodes = new Set();
	let currentNode = destinationNode;

	while (
		currentNode !== null &&
		!seenNodes.has(currentNode)
	) {
		seenNodes.add(currentNode);
		path.unshift(currentNode);

		if (currentNode === startNode) {
			return path;
		}

		currentNode =
			previous[currentNode];
	}

	return [];
}

function completeAnimation() {
	animation.checkingEdge = null;
	animation.finalPath =
		reconstructShortestPath(
			animation.previous,
			ui.startNodeId,
			ui.destinationNodeId
		);

	if (animation.finalPath.length === 0) {
		pathResult.textContent =
			'No path exists between the selected nodes.';
	} else {
		pathResult.textContent =
			`Shortest Path: ${animation.finalPath.join(' → ')} | Total Distance: ${animation.distances[ui.destinationNodeId]}`;
	}
}

function logAnimationStep(step) {
	console.log(
		`========== DIJKSTRA STEP ${animation.currentStepIndex} ==========`
	);
	console.log('Event:', step.type);

	if (step.type === 'current') {
		console.log('Current Node:', step.node);
	} else if (step.type === 'checking-edge') {
		console.log('From:', step.from);
		console.log('To:', step.to);
		console.log('Weight:', step.weight);
	} else if (step.type === 'update-distance') {
		console.log('Node:', step.node);
		console.log('New Distance:', step.distance);
		console.log('Previous:', step.previous);
	} else if (step.type === 'visited') {
		console.log('Node:', step.node);
		console.log('Visited Nodes:', [...animation.visitedNodes]);
	}

	console.log('Animation State:');
	console.log('Current Node:', animation.currentNodeId);
	console.log('Visited:', [...animation.visitedNodes]);
	console.log('Checking Edge:', animation.checkingEdge);
	console.log('Distance Updates:', animation.distanceUpdates);
	console.log('======================================');
}

function updateAnimationControls() {
	nextStepBtn.disabled =
		animation.isRunning ||
		(animation.isPrepared &&
			animation.currentStepIndex >=
				animation.steps.length - 1);

	runAnimationBtn.disabled =
		animation.isRunning;
}

function prepareAnimation() {
	if (ui.startNodeId === null) {
		pathResult.textContent =
			'Please select a start node.';
		return false;
	}

	if (ui.destinationNodeId === null) {
		pathResult.textContent =
			'Please select a destination node.';
		return false;
	}

	if (ui.startNodeId === ui.destinationNodeId) {
		pathResult.textContent =
			'Start and destination must be different.';
		return false;
	}

	const adjacencyList =
		buildAdjacencyList(graph);

	const result =
		dijkstraWithSteps(
			adjacencyList,
			ui.startNodeId
		);

	resetAnimationState();
	animation.steps = result.steps;
	animation.distances = result.distances;
	animation.previous = result.previous;
	animation.isPrepared = true;

	pathResult.textContent = '';
	updateAnimationControls();
	renderGraph();

	return true;
}

function stepForward() {
	if (!animation.isPrepared && !prepareAnimation()) {
		return;
	}

	if (
		animation.currentStepIndex >=
		animation.steps.length - 1
	) {
		updateAnimationControls();
		return;
	}

	applyAnimationStep(
		animation.steps[
			animation.currentStepIndex + 1
		]
	);

	logAnimationStep(
		animation.steps[
			animation.currentStepIndex
		]
	);

	if (
		animation.currentStepIndex >=
		animation.steps.length - 1
	) {
		completeAnimation();
	}

	updateAnimationControls();
	renderGraph();
}

function runAnimation() {
	if (animation.isRunning) {
		return;
	}

	if (!animation.isPrepared && !prepareAnimation()) {
		return;
	}

	if (
		animation.currentStepIndex >=
		animation.steps.length - 1
	) {
		return;
	}

	animation.isRunning = true;
	updateAnimationControls();

	const advance = () => {
		stepForward();

		if (
			animation.currentStepIndex >=
			animation.steps.length - 1
		) {
			animation.isRunning = false;
			animation.timeoutId = null;
			updateAnimationControls();
			return;
		}

		animation.timeoutId =
			window.setTimeout(
				advance,
				500
			);
	};

	advance();
}

function resetVisualization() {
	if (animation.timeoutId !== null) {
		window.clearTimeout(
			animation.timeoutId
		);
	}

	animation.timeoutId = null;
	animation.isRunning = false;
	resetAnimationState();
	updateAnimationControls();
	renderGraph();
}

// ======================================================
// APP UI
// ======================================================

const app = document.querySelector('#app');

app.innerHTML = `
	<div
		style="
			max-width: 980px;
			margin: 0 auto;
			padding: 24px;
			box-sizing: border-box;
		"
	>
		<h1 style="margin: 0 0 8px; font-size: 2rem;">
			SVG Graph Visualizer
		</h1>

		<p style="margin: 0 0 18px; opacity: 0.8;">
			Use Add Node mode to create new nodes, then drag them to reposition.
		</p>

		<div
			style="
				display: flex;
				align-items: center;
				gap: 12px;
				margin: 0 0 14px;
			"
		>
			<button
				id="select-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #0f172a;
					border-radius: 8px;
					background: #0f172a;
					color: #ffffff;
					cursor: pointer;
				"
			>
				Select
			</button>

			<button
				id="add-node-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #0f172a;
					border-radius: 8px;
					background: #ffffff;
					color: #0f172a;
					cursor: pointer;
				"
			>
				Add Node: Off
			</button>

			<button
				id="add-edge-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #0f172a;
					border-radius: 8px;
					background: #ffffff;
					color: #0f172a;
					cursor: pointer;
				"
			>
				Add Edge: Off
			</button>

			<button
				id="delete-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #b91c1c;
					border-radius: 8px;
					background: #ffffff;
					color: #b91c1c;
					cursor: pointer;
				"
			>
				Delete
			</button>

			<button
				id="start-node-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #15803d;
					border-radius: 8px;
					background: #ffffff;
					color: #15803d;
					cursor: pointer;
				"
			>
				Start Node
			</button>

			<button
				id="destination-node-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #b91c1c;
					border-radius: 8px;
					background: #ffffff;
					color: #b91c1c;
					cursor: pointer;
				"
			>
				Destination
			</button>

			<button
				id="run-dijkstra-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #0f172a;
					border-radius: 8px;
					background: #ffffff;
					color: #0f172a;
					cursor: pointer;
				"
			>
				Run Dijkstra
			</button>

			<button
				id="run-animation-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #0f172a;
					border-radius: 8px;
					background: #ffffff;
					color: #0f172a;
					cursor: pointer;
				"
			>
				▶ Run
			</button>

			<button
				id="next-step-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #0f172a;
					border-radius: 8px;
					background: #ffffff;
					color: #0f172a;
					cursor: pointer;
				"
			>
				⏭ Next Step
			</button>

			<button
				id="reset-animation-btn"
				type="button"
				style="
					padding: 8px 12px;
					border: 1px solid #0f172a;
					border-radius: 8px;
					background: #ffffff;
					color: #0f172a;
					cursor: pointer;
				"
			>
				↻ Reset
			</button>

			<span
				id="mode-label"
				style="
					font-size: 0.95rem;
					opacity: 0.8;
				"
			>
				Mode: Select / Drag
			</span>
		</div>

		<div
			id="path-result"
			style="
				min-height: 24px;
				margin: 0 0 14px;
			"
		></div>

		<svg
			id="graph-svg"
			viewBox="0 0 760 420"
			style="
				width: 100%;
				border: 1px solid #d2d2d2;
				border-radius: 10px;
				background: #fffdf9;
				touch-action: none;
			"
		></svg>
	</div>
`;

// ======================================================
// DOM REFERENCES
// ======================================================

const svg = document.querySelector('#graph-svg');

const selectBtn =
	document.querySelector('#select-btn');

const addNodeBtn =
	document.querySelector('#add-node-btn');

const addEdgeBtn =
	document.querySelector('#add-edge-btn');

const deleteBtn =
	document.querySelector('#delete-btn');

const startNodeBtn =
	document.querySelector('#start-node-btn');

const destinationBtn =
	document.querySelector('#destination-node-btn');

const runDijkstraBtn =
	document.querySelector('#run-dijkstra-btn');

const runAnimationBtn =
	document.querySelector('#run-animation-btn');

const nextStepBtn =
	document.querySelector('#next-step-btn');

const resetAnimationBtn =
	document.querySelector('#reset-animation-btn');

const modeLabel =
	document.querySelector('#mode-label');

const pathResult =
	document.querySelector('#path-result');

// ======================================================
// SVG HELPER
// ======================================================

function createSvgElement(
	tag,
	attrs = {}
) {
	const element =
		document.createElementNS(
			svgNS,
			tag
		);

	Object.entries(attrs).forEach(
		([key, value]) => {
			element.setAttribute(
				key,
				String(value)
			);
		}
	);

	return element;
}

// ======================================================
// GRAPH HELPERS
// ======================================================

function getNodeById(id) {
	return graph.nodes.find(
		(node) => node.id === id
	);
}

function indexToNodeId(index) {
	let value = index + 1;
	let id = '';

	while (value > 0) {
		const remainder =
			(value - 1) % 26;

		id =
			String.fromCharCode(
				65 + remainder
			) + id;

		value =
			Math.floor(
				(value - 1) / 26
			);
	}

	return id;
}

function getNextNodeId() {
	const usedIds =
		new Set(
			graph.nodes.map(
				(node) => node.id
			)
		);

	let index = 0;

	while (
		usedIds.has(
			indexToNodeId(index)
		)
	) {
		index++;
	}

	return indexToNodeId(index);
}

function reconstructPath(
	previous,
	startNode,
	destinationNode
) {
	const path = [];
	let currentNode = destinationNode;

	while (currentNode !== null) {
		path.unshift(currentNode);

		if (currentNode === startNode) {
			return path;
		}

		currentNode = previous[currentNode];
	}

	return [];
}

// ======================================================
// NODE CREATION
// ======================================================

function addNodeAtPosition(
	x,
	y
) {
	const id =
		getNextNodeId();

	const newNode = {
		id,

		x: Math.max(
			24,
			Math.min(736, x)
		),

		y: Math.max(
			24,
			Math.min(396, y)
		),
	};

	graph.nodes.push(
		newNode
	);

	ui.selectedNodeId = id;
}

// ======================================================
// SVG COORDINATES
// ======================================================

function toSvgPoint(
	clientX,
	clientY
) {
	const point =
		svg.createSVGPoint();

	point.x = clientX;
	point.y = clientY;

	const transformedPoint =
		point.matrixTransform(
			svg
				.getScreenCTM()
				.inverse()
		);

	return {
		x: transformedPoint.x,
		y: transformedPoint.y,
	};
}

// ======================================================
// RENDER NODES
// ======================================================

function renderNodes() {
	graph.nodes.forEach(
		(node) => {
			const isSelected =
				ui.selectedNodeId ===
				node.id;

			const isEdgeSource =
				ui.edgeSourceNodeId ===
				node.id;

			const isStart =
				ui.startNodeId === node.id;

			const isDestination =
				ui.destinationNodeId === node.id;

			const isCurrent =
				animation.currentNodeId === node.id;

			const isVisited =
				animation.visitedNodes.has(node.id);

			const isFinalPath =
				animation.finalPath.includes(node.id);

			const nodeGroup =
				createSvgElement(
					'g',
					{
						'data-node-id':
							node.id,

						style:
							'cursor: grab;',
					}
				);

			const circle =
				createSvgElement(
					'circle',
					{
						cx: node.x,
						cy: node.y,
						r: 24,

						fill:
							isDestination
								? '#ef4444'
								: isStart
									? '#22c55e'
										: isFinalPath
											? '#facc15'
									: isCurrent
										? '#3b82f6'
										: isVisited
											? '#7c3aed'
											: isSelected
												? '#0ea5e9'
												: '#94a3b8',

						stroke:
							isDestination
								? '#b91c1c'
								: isStart
									? '#15803d'
									: isEdgeSource
										? '#b45309'
										: '#0f172a',

						'stroke-width':
							isEdgeSource ||
							isSelected ||
							isStart ||
							isDestination
								? 3
								: 2,

						'data-node-id':
							node.id,
					}
				);

			const label =
				createSvgElement(
					'text',
					{
						x: node.x,
						y: node.y + 5,

						'text-anchor':
							'middle',

						'font-size': 14,

						'font-family':
							'sans-serif',

						'font-weight':
							'bold',

						fill: '#ffffff',

						'pointer-events':
							'none',
					}
				);

			label.textContent =
				node.id;

			nodeGroup.appendChild(
				circle
			);

			nodeGroup.appendChild(
				label
			);

			svg.appendChild(
				nodeGroup
			);
		}
	);
}

// ======================================================
// RENDER EDGES
// ======================================================

function renderEdges() {
	graph.edges.forEach(
		(edge, edgeIndex) => {
			const source =
				getNodeById(
					edge.source
				);

			const target =
				getNodeById(
					edge.target
				);

			if (
				!source ||
				!target
			) {
				return;
			}

			const isCheckingEdge =
				animation.checkingEdge &&
				(
					(
						edge.source ===
							animation.checkingEdge.from &&
						edge.target ===
							animation.checkingEdge.to
					) ||
					(
						edge.source ===
							animation.checkingEdge.to &&
						edge.target ===
							animation.checkingEdge.from
					)
				);

			const finalPathIndex =
				animation.finalPath.indexOf(
					edge.source
				);

			const isFinalPathEdge =
				finalPathIndex !== -1 &&
				(
					animation.finalPath[
						finalPathIndex + 1
					] === edge.target ||
					(
						finalPathIndex > 0 &&
						animation.finalPath[
							finalPathIndex - 1
						] === edge.target
					)
				);

			const line =
				createSvgElement(
					'line',
					{
						x1: source.x,
						y1: source.y,

						x2: target.x,
						y2: target.y,

						stroke:
							isFinalPathEdge
								? '#eab308'
								: isCheckingEdge
								? '#2563eb'
								: '#64748b',

						'stroke-width':
							isFinalPathEdge
								? 5
								: isCheckingEdge
								? 4
								: 2,

						'pointer-events':
							'stroke',

						'data-edge-index':
							edgeIndex,
					}
				);

			const weight =
				createSvgElement(
					'text',
					{
						x:
							(source.x +
								target.x) /
							2,

						y:
							(source.y +
								target.y) /
								2 -
							8,

						'text-anchor':
							'middle',

						'font-size': 13,

						'font-family':
							'sans-serif',

						'font-weight':
							'bold',

						fill: '#0f172a',

						'pointer-events':
							'all',

						'data-edge-index':
							edgeIndex,
					}
				);

			weight.textContent =
				String(
					edge.weight
				);

			svg.appendChild(
				line
			);

			svg.appendChild(
				weight
			);
		}
	);
}

// ======================================================
// RENDER GRAPH
// ======================================================

function renderGraph() {
	svg.replaceChildren();

	renderEdges();
	renderNodes();
}

function testAnimationStep() {
	resetAnimationState();
	animation.steps = testResult.steps;
	animation.isPrepared = false;

	applyAnimationStep(
		animation.steps[0]
	);

	renderGraph();

	console.log(
		'M4D.2 Animation State:',
		animation
	);

	updateAnimationControls();
}

// ======================================================
// MODE UI
// ======================================================

function updateModeUi() {
	const activeButtonStyle =
		(button, isActive) => {
			button.style.background =
				isActive
					? '#0f172a'
					: '#ffffff';

			button.style.color =
				isActive
					? '#ffffff'
					: '#0f172a';
		};

	activeButtonStyle(
		selectBtn,
		ui.selectMode
	);

	addNodeBtn.textContent =
		`Add Node: ${
			ui.addNodeMode
				? 'On'
				: 'Off'
		}`;

	activeButtonStyle(
		addNodeBtn,
		ui.addNodeMode
	);

	addEdgeBtn.textContent =
		`Add Edge: ${
			ui.addEdgeMode
				? 'On'
				: 'Off'
		}`;

	activeButtonStyle(
		addEdgeBtn,
		ui.addEdgeMode
	);

	activeButtonStyle(
		startNodeBtn,
		ui.startMode
	);

	activeButtonStyle(
		destinationBtn,
		ui.destinationMode
	);

	startNodeBtn.style.background =
		ui.startMode
			? '#15803d'
			: '#ffffff';

	startNodeBtn.style.color =
		ui.startMode
			? '#ffffff'
			: '#15803d';

	destinationBtn.style.background =
		ui.destinationMode
			? '#b91c1c'
			: '#ffffff';

	destinationBtn.style.color =
		ui.destinationMode
			? '#ffffff'
			: '#b91c1c';

	deleteBtn.style.background =
		ui.deleteMode
			? '#b91c1c'
			: '#ffffff';

	deleteBtn.style.color =
		ui.deleteMode
			? '#ffffff'
			: '#b91c1c';

	if (ui.addNodeMode) {
		modeLabel.textContent =
			'Mode: Add Node';
	} else if (
		ui.addEdgeMode
	) {
		modeLabel.textContent =
			ui.edgeSourceNodeId
				? `Mode: Add Edge (source: ${ui.edgeSourceNodeId})`
				: 'Mode: Add Edge (select source)';
	} else if (
		ui.deleteMode
	) {
		modeLabel.textContent =
			'Mode: Delete (click a node or edge)';
	} else if (
		ui.startMode
	) {
		modeLabel.textContent =
			'Mode: Select Start Node';
	} else if (
		ui.destinationMode
	) {
		modeLabel.textContent =
			'Mode: Select Destination Node';
	} else {
		modeLabel.textContent =
			'Mode: Select / Drag';
	}
}

// ======================================================
// MODE SWITCHING
// ======================================================

function setMode(mode) {
	ui.selectMode =
		mode === 'select';

	ui.addNodeMode =
		mode === 'add-node';

	ui.addEdgeMode =
		mode === 'add-edge';

	ui.deleteMode =
		mode === 'delete';

	ui.edgeSourceNodeId =
		null;

	ui.draggingNodeId =
		null;

	ui.startMode =
		mode === 'start';

	ui.destinationMode =
		mode === 'destination';

	updateModeUi();
	renderGraph();
}

// ======================================================
// EDGE HELPERS
// ======================================================

function hasEdgeBetween(
	sourceId,
	targetId
) {
	return graph.edges.some(
		(edge) =>
			(
				edge.source ===
					sourceId &&
				edge.target ===
					targetId
			) ||
			(
				edge.source ===
					targetId &&
				edge.target ===
					sourceId
			)
	);
}

// ======================================================
// ADD EDGE
// ======================================================

function addEdgeBetween(
	sourceId,
	targetId
) {
	if (
		sourceId === targetId ||
		hasEdgeBetween(
			sourceId,
			targetId
		)
	) {
		return false;
	}

	const input =
		window.prompt(
			`Enter a positive weight for edge ${sourceId}-${targetId}:`
		);

	if (input === null) {
		return false;
	}

	if (
		input.trim() === ''
	) {
		return false;
	}

	const weight =
		Number(input);

	if (
		!Number.isFinite(
			weight
		) ||
		weight <= 0
	) {
		return false;
	}

	graph.edges.push({
		source: sourceId,
		target: targetId,
		weight,
	});

	return true;
}

// ======================================================
// EDIT EDGE WEIGHT
// ======================================================

function editEdgeWeight(
	edgeIndex
) {
	const edge =
		graph.edges[
			edgeIndex
		];

	if (!edge) {
		return;
	}

	const input =
		window.prompt(
			'Enter a new positive weight for this edge:',
			String(edge.weight)
		);

	if (input === null) {
		return;
	}

	const weight =
		Number(input);

	if (
		!Number.isFinite(
			weight
		) ||
		weight <= 0
	) {
		return;
	}

	edge.weight =
		weight;
}

// ======================================================
// DELETE NODE
// ======================================================

function deleteNode(
	nodeId
) {
	graph.nodes =
		graph.nodes.filter(
			(node) =>
				node.id !==
				nodeId
		);

	graph.edges =
		graph.edges.filter(
			(edge) =>
				edge.source !==
					nodeId &&
				edge.target !==
					nodeId
		);

	if (
		ui.selectedNodeId ===
		nodeId
	) {
		ui.selectedNodeId =
			null;
	}

	if (
		ui.edgeSourceNodeId ===
		nodeId
	) {
		ui.edgeSourceNodeId =
			null;
	}

	if (
		ui.startNodeId ===
		nodeId
	) {
		ui.startNodeId =
			null;
	}

	if (
		ui.destinationNodeId ===
		nodeId
	) {
		ui.destinationNodeId =
			null;
	}
}

// ======================================================
// DELETE EDGE
// ======================================================

function deleteEdge(
	edgeIndex
) {
	graph.edges.splice(
		edgeIndex,
		1
	);
}

// ======================================================
// POINTER DOWN
// ======================================================

function onPointerDown(
	event
) {
	const target =
		event.target;

	if (
		!(
			target instanceof
			SVGElement
		)
	) {
		return;
	}

	const nodeId =
		target.getAttribute(
			'data-node-id'
		);

	// ADD NODE

	if (
		ui.addNodeMode &&
		!nodeId
	) {
		const {
			x,
			y,
		} = toSvgPoint(
			event.clientX,
			event.clientY
		);

		addNodeAtPosition(
			x,
			y
		);

		renderGraph();

		return;
	}

	// START OR DESTINATION NODE

	if (
		ui.startMode ||
		ui.destinationMode
	) {
		if (!nodeId) {
			return;
		}

		if (ui.startMode) {
			ui.startNodeId =
				nodeId;
		} else {
			ui.destinationNodeId =
				nodeId;
		}

		setMode(
			'select'
		);

		return;
	}

	// DELETE

	if (ui.deleteMode) {
		const edgeIndex =
			target.getAttribute(
				'data-edge-index'
			);

		if (nodeId) {
			deleteNode(
				nodeId
			);
		} else if (
			edgeIndex !== null
		) {
			deleteEdge(
				Number(edgeIndex)
			);
		}

		renderGraph();

		return;
	}

	// ADD EDGE

	if (ui.addEdgeMode) {
		if (!nodeId) {
			return;
		}

		if (
			!ui.edgeSourceNodeId
		) {
			ui.edgeSourceNodeId =
				nodeId;

			ui.selectedNodeId =
				nodeId;
		} else {
			const sourceId =
				ui.edgeSourceNodeId;

			const created =
				addEdgeBetween(
					sourceId,
					nodeId
				);

			if (created) {
				ui.selectedNodeId =
					nodeId;

				ui.edgeSourceNodeId =
					null;
			}
		}

		updateModeUi();
		renderGraph();

		return;
	}

	// SELECT

	if (!ui.selectMode) {
		return;
	}

	const edgeIndex =
		target.getAttribute(
			'data-edge-index'
		);

	if (
		edgeIndex !== null
	) {
		editEdgeWeight(
			Number(edgeIndex)
		);

		renderGraph();

		return;
	}

	if (!nodeId) {
		ui.selectedNodeId =
			null;

		renderGraph();

		return;
	}

	ui.selectedNodeId =
		nodeId;

	ui.draggingNodeId =
		nodeId;

	svg.setPointerCapture(
		event.pointerId
	);

	renderGraph();
}

// ======================================================
// POINTER MOVE
// ======================================================

function onPointerMove(
	event
) {
	if (!ui.draggingNodeId) {
		return;
	}

	const activeNode =
		getNodeById(
			ui.draggingNodeId
		);

	if (!activeNode) {
		return;
	}

	const {
		x,
		y,
	} = toSvgPoint(
		event.clientX,
		event.clientY
	);

	activeNode.x =
		Math.max(
			24,
			Math.min(
				736,
				x
			)
		);

	activeNode.y =
		Math.max(
			24,
			Math.min(
				396,
				y
			)
		);

	renderGraph();
}

// ======================================================
// POINTER UP
// ======================================================

function onPointerUp(
	event
) {
	if (!ui.draggingNodeId) {
		return;
	}

	ui.draggingNodeId =
		null;

	if (
		svg.hasPointerCapture(
			event.pointerId
		)
	) {
		svg.releasePointerCapture(
			event.pointerId
		);
	}
}

// ======================================================
// BUTTON EVENTS
// ======================================================

runDijkstraBtn.addEventListener(
	'click',
	() => {
		pathResult.textContent =
			'';

		if (ui.startNodeId === null) {
			pathResult.textContent =
				'Please select a start node.';
			return;
		}

		if (ui.destinationNodeId === null) {
			pathResult.textContent =
				'Please select a destination node.';
			return;
		}

		if (
			ui.startNodeId ===
			ui.destinationNodeId
		) {
			pathResult.textContent =
				'Start and destination must be different.';
			return;
		}

		const adjacencyList =
			buildAdjacencyList(graph);

		const result =
			dijkstra(
				adjacencyList,
				ui.startNodeId
			);

		const distance =
			result.distances[
				ui.destinationNodeId
			];

		if (distance === Infinity) {
			pathResult.textContent =
				'No path exists between the selected nodes.';
			return;
		}

		const path =
			reconstructPath(
				result.previous,
				ui.startNodeId,
				ui.destinationNodeId
			);

		pathResult.textContent =
			`Shortest Path: ${path.join(' -> ')} | Total Distance: ${distance}`;
	}
);

runAnimationBtn.addEventListener(
	'click',
	runAnimation
);

nextStepBtn.addEventListener(
	'click',
	stepForward
);

resetAnimationBtn.addEventListener(
	'click',
	resetVisualization
);

addNodeBtn.addEventListener(
	'click',
	() => {
		setMode(
			ui.addNodeMode
				? 'select'
				: 'add-node'
		);
	}
);

startNodeBtn.addEventListener(
	'click',
	() => {
		setMode(
			ui.startMode
				? 'select'
				: 'start'
		);
	}
);

destinationBtn.addEventListener(
	'click',
	() => {
		setMode(
			ui.destinationMode
				? 'select'
				: 'destination'
		);
	}
);

addEdgeBtn.addEventListener(
	'click',
	() => {
		setMode(
			ui.addEdgeMode
				? 'select'
				: 'add-edge'
		);
	}
);

deleteBtn.addEventListener(
	'click',
	() => {
		setMode(
			ui.deleteMode
				? 'select'
				: 'delete'
		);
	}
);

selectBtn.addEventListener(
	'click',
	() => {
		setMode(
			'select'
		);
	}
);

// ======================================================
// SVG EVENTS
// ======================================================

svg.addEventListener(
	'pointerdown',
	onPointerDown
);

svg.addEventListener(
	'pointermove',
	onPointerMove
);

svg.addEventListener(
	'pointerup',
	onPointerUp
);

svg.addEventListener(
	'pointerleave',
	onPointerUp
);

// ======================================================
// INITIALIZE
// ======================================================

updateModeUi();
renderGraph();
testAnimationStep();