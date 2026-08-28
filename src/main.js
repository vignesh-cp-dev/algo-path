import { buildAdjacencyList } from './graph.js';
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

	edges: [
		{ source: 'A', target: 'B', weight: 4 },
		{ source: 'B', target: 'D', weight: 5 },
		{ source: 'A', target: 'C', weight: 2 },
		{ source: 'C', target: 'D', weight: 1 },
	],
};
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

	updateAnimationControls();
	renderResultPanel();
	renderExplanationPanel();
}

function updateAnimationControls() {
	const isComplete =
		animation.isPrepared &&
		animation.currentStepIndex >=
			animation.steps.length - 1;

	const hasValidStartAndDest =
		ui.startNodeId !== null &&
		ui.destinationNodeId !== null;

	// Prepare Dijkstra:
	// Enabled anytime, but disabled during animation
	runDijkstraBtn.disabled =
		animation.isRunning;

	// Run:
	// Enabled only if prepared, not running, and not complete
	runAnimationBtn.disabled =
		!animation.isPrepared ||
		animation.isRunning ||
		isComplete;

	// Next Step:
	// Enabled only if prepared, not running, and not complete
	nextStepBtn.disabled =
		!animation.isPrepared ||
		animation.isRunning ||
		isComplete;

	// Reset:
	// Always enabled (can reset anytime)
	// No need to set .disabled since we want it always available

	updateModeUi();
}

function prepareAnimation() {
	// Validate Start Node
	if (ui.startNodeId === null) {
		pathResult.textContent =
			'Select a Start Node first.';
		return false;
	}

	// Validate Destination Node
	if (ui.destinationNodeId === null) {
		pathResult.textContent =
			'Select a Destination first.';
		return false;
	}

	// Build adjacency list from current graph
	const adjacencyList =
		buildAdjacencyList(graph);

	// Run Dijkstra algorithm
	const result =
		dijkstraWithSteps(
			adjacencyList,
			ui.startNodeId
		);

	// Reset animation state and apply results
	resetAnimationState();
	animation.steps = result.steps;
	animation.distances = result.distances;
	animation.previous = result.previous;
	animation.isPrepared = true;

	// Clear any previous messages
	pathResult.textContent = '';

	// Update UI to reflect prepared state
	updateAnimationControls();
	renderResultPanel();
	renderExplanationPanel();
	renderGraph();

	return true;
}

function stepForward() {
	if (!animation.isPrepared) {
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

	if (
		animation.currentStepIndex >=
		animation.steps.length - 1
	) {
		completeAnimation();
	}

	updateAnimationControls();
	renderResultPanel();
	renderExplanationPanel();
	renderGraph();
}

function runAnimation() {
	if (animation.isRunning) {
		return;
	}

	if (!animation.isPrepared) {
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
	renderResultPanel();
	renderExplanationPanel();

	const advance = () => {
		stepForward();

		if (
			animation.currentStepIndex >=
			animation.steps.length - 1
		) {
			animation.isRunning = false;
			animation.timeoutId = null;
			updateAnimationControls();
			renderResultPanel();
			renderExplanationPanel();
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
	pathResult.textContent = '';
	updateAnimationControls();
	renderResultPanel();
	renderExplanationPanel();
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
				Prepare Dijkstra
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

		<div
			id="legend-container"
			style="
				margin: 20px 0 0;
				padding: 16px;
				border: 1px solid #d2d2d2;
				border-radius: 10px;
				background: #f8f8f8;
			"
		></div>

		<div
			id="result-panel"
			style="
				margin: 20px 0 0;
				padding: 16px;
				border: 1px solid #d2d2d2;
				border-radius: 10px;
				background: #f9fafb;
				min-height: 100px;
			"
		></div>

		<div
			id="explanation-panel"
			style="
				margin: 20px 0 0;
				padding: 16px;
				border: 1px solid #d2d2d2;
				border-radius: 10px;
				background: #f0f9ff;
				min-height: 100px;
			"
		></div>
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

const legendContainer =
	document.querySelector('#legend-container');

const resultPanel =
	document.querySelector('#result-panel');

const explanationPanel =
	document.querySelector('#explanation-panel');

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

// ======================================================
// RENDER LEGEND
// ======================================================

function renderLegend() {
	legendContainer.innerHTML = `
		<h3 style="
			margin: 0 0 12px;
			font-size: 1.1rem;
			font-weight: 600;
			color: #0f172a;
		">
			Legend
		</h3>
		<div style="
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
			gap: 12px;
		">
			<div style="display: flex; align-items: center; gap: 8px;">
				<div style="
					width: 24px;
					height: 24px;
					border-radius: 50%;
					background: #22c55e;
					border: 2px solid #15803d;
				"></div>
				<span style="font-size: 0.95rem;">Start Node</span>
			</div>
			<div style="display: flex; align-items: center; gap: 8px;">
				<div style="
					width: 24px;
					height: 24px;
					border-radius: 50%;
					background: #ef4444;
					border: 2px solid #b91c1c;
				"></div>
				<span style="font-size: 0.95rem;">Destination</span>
			</div>
			<div style="display: flex; align-items: center; gap: 8px;">
				<div style="
					width: 24px;
					height: 24px;
					border-radius: 50%;
					background: #7c3aed;
					border: 2px solid #0f172a;
				"></div>
				<span style="font-size: 0.95rem;">Visited Node</span>
			</div>
			<div style="display: flex; align-items: center; gap: 8px;">
				<div style="
					width: 24px;
					height: 24px;
					border-radius: 50%;
					background: #3b82f6;
					border: 2px solid #0f172a;
				"></div>
				<span style="font-size: 0.95rem;">Current Node</span>
			</div>
			<div style="display: flex; align-items: center; gap: 8px;">
				<div style="
					width: 24px;
					height: 24px;
					border-radius: 50%;
					background: #facc15;
					border: 2px solid #0f172a;
				"></div>
				<span style="font-size: 0.95rem;">Shortest Path Node</span>
			</div>
			<div style="display: flex; align-items: center; gap: 8px;">
				<div style="
					width: 100px;
					height: 2px;
					background: #64748b;
				"></div>
				<span style="font-size: 0.95rem;">Normal Edge</span>
			</div>
			<div style="display: flex; align-items: center; gap: 8px;">
				<div style="
					width: 100px;
					height: 3px;
					background: #2563eb;
				"></div>
				<span style="font-size: 0.95rem;">Checking Edge</span>
			</div>
			<div style="display: flex; align-items: center; gap: 8px;">
				<div style="
					width: 100px;
					height: 4px;
					background: #eab308;
				"></div>
				<span style="font-size: 0.95rem;">Shortest Path Edge</span>
			</div>
		</div>
	`;
}

// ======================================================
// RENDER RESULT PANEL
// ======================================================

function renderResultPanel() {
	let content = '';

	// Case 1: Animation is running
	if (animation.isRunning) {
		content = `
			<h3 style="margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; color: #0f172a;">
				Dijkstra Result
			</h3>
			<p style="margin: 0; color: #666; font-style: italic;">
				Animation in progress...
			</p>
		`;
	}
	// Case 2: Not prepared yet
	else if (!animation.isPrepared) {
		content = `
			<h3 style="margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; color: #0f172a;">
				Dijkstra Result
			</h3>
			<p style="margin: 0; color: #666;">
				Select a start and destination, then prepare Dijkstra.
			</p>
		`;
	}
	// Case 3: Prepared but animation not complete
	else if (animation.currentStepIndex < animation.steps.length - 1) {
		content = `
			<h3 style="margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; color: #0f172a;">
				Dijkstra Result
			</h3>
			<div style="margin: 0 0 12px;">
				<div style="margin: 0 0 8px;">
					<span style="font-weight: 600; color: #0f172a;">Start:</span>
					<span style="color: #22c55e; font-weight: 600;">${ui.startNodeId}</span>
				</div>
				<div style="margin: 0 0 8px;">
					<span style="font-weight: 600; color: #0f172a;">Destination:</span>
					<span style="color: #ef4444; font-weight: 600;">${ui.destinationNodeId}</span>
				</div>
			</div>
			<p style="margin: 0; color: #666; font-style: italic;">
				Ready to visualize the shortest path.
			</p>
		`;
	}
	// Case 4: Animation complete
	else {
		const startNode = ui.startNodeId;
		const destNode = ui.destinationNodeId;

		if (animation.finalPath.length === 0) {
			// No path exists
			content = `
				<h3 style="margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; color: #0f172a;">
					Dijkstra Result
				</h3>
				<div style="margin: 0 0 12px;">
					<div style="margin: 0 0 8px;">
						<span style="font-weight: 600; color: #0f172a;">Start:</span>
						<span style="color: #22c55e; font-weight: 600;">${startNode}</span>
					</div>
					<div style="margin: 0 0 8px;">
						<span style="font-weight: 600; color: #0f172a;">Destination:</span>
						<span style="color: #ef4444; font-weight: 600;">${destNode}</span>
					</div>
				</div>
				<p style="margin: 0; color: #b91c1c; font-weight: 600;">
					No path exists between ${startNode} and ${destNode}.
				</p>
			`;
		} else {
			// Path exists
			const pathStr = animation.finalPath.join(' → ');
			const distance = animation.distances[destNode];

			content = `
				<h3 style="margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; color: #0f172a;">
					Dijkstra Result
				</h3>
				<div style="margin: 0 0 12px;">
					<div style="margin: 0 0 8px;">
						<span style="font-weight: 600; color: #0f172a;">Start:</span>
						<span style="color: #22c55e; font-weight: 600;">${startNode}</span>
					</div>
					<div style="margin: 0 0 8px;">
						<span style="font-weight: 600; color: #0f172a;">Destination:</span>
						<span style="color: #ef4444; font-weight: 600;">${destNode}</span>
					</div>
				</div>
				<div style="margin: 0 0 12px;">
					<div style="margin: 0 0 8px;">
						<span style="font-weight: 600; color: #0f172a;">Shortest Path:</span>
					</div>
					<div style="
						margin: 0;
						padding: 8px;
						background: #f0f0f0;
						border-radius: 6px;
						font-family: monospace;
						color: #0f172a;
						font-size: 0.95rem;
					">
						${pathStr}
					</div>
				</div>
				<div>
					<span style="font-weight: 600; color: #0f172a;">Total Distance:</span>
					<span style="color: #0f172a; font-weight: 600; margin-left: 4px;">${distance}</span>
				</div>
			`;
		}
	}

	resultPanel.innerHTML = content;
}

// ======================================================
// GET EXPLANATION CONTENT
// ======================================================

function getExplanationContent() {
	// Case 1: Not prepared yet
	if (!animation.isPrepared) {
		// Substep 1a: Start and Destination selected
		if (
			ui.startNodeId !== null &&
			ui.destinationNodeId !== null
		) {
			return {
				title: 'Ready to Run Dijkstra',
				content: `
					<div style="margin: 0 0 12px;">
						<div style="margin: 0 0 8px;">
							<span style="font-weight: 600; color: #0f172a;">Start:</span>
							<span style="color: #22c55e; font-weight: 600;">${ui.startNodeId}</span>
						</div>
						<div>
							<span style="font-weight: 600; color: #0f172a;">Destination:</span>
							<span style="color: #ef4444; font-weight: 600;">${ui.destinationNodeId}</span>
						</div>
					</div>
					<p style="margin: 0; color: #666; font-size: 0.95rem; line-height: 1.5;">
						Click "Prepare Dijkstra" to start the algorithm.
					</p>
				`,
			};
		}

		// Substep 1b: No start/destination yet
		return {
			title: '🧠 How Dijkstra\'s Algorithm Works',
			content: `
				<p style="margin: 0; color: #666; font-size: 0.95rem; line-height: 1.5;">
					Dijkstra's algorithm finds the shortest path from a starting node through a weighted graph.
				</p>
				<p style="margin: 12px 0 0; color: #666; font-size: 0.95rem; line-height: 1.5;">
					It repeatedly selects the unvisited node with the smallest known distance and checks whether travelling through that node produces a shorter distance to its neighbors.
				</p>
				<p style="margin: 12px 0 0; color: #999; font-size: 0.9rem; font-style: italic;">
					Select a start and destination to begin.
				</p>
			`,
		};
	}

	// Case 2: Animation is running
	if (animation.isRunning) {
		return {
			title: '▶ Algorithm Running',
			content: `
				<p style="margin: 0; color: #666; font-size: 0.95rem; font-style: italic;">
					Animation in progress...
				</p>
			`,
		};
	}

	// Case 3: Animation is complete
	if (animation.currentStepIndex >= animation.steps.length - 1) {
		const startNode = ui.startNodeId;
		const destNode = ui.destinationNodeId;

		if (animation.finalPath.length === 0) {
			// No path exists
			return {
				title: '🎯 Algorithm Complete',
				content: `
					<p style="margin: 0; color: #b91c1c; font-weight: 600;">
						No path exists between ${startNode} and ${destNode}.
					</p>
					<p style="margin: 12px 0 0; color: #666; font-size: 0.95rem; line-height: 1.5;">
						Dijkstra explored all reachable nodes but could not reach the destination.
					</p>
				`,
			};
		} else {
			// Path exists
			const pathStr = animation.finalPath.join(' → ');
			const distance = animation.distances[destNode];

			return {
				title: '🎯 Algorithm Complete',
				content: `
					<p style="margin: 0 0 12px; color: #0f172a; font-weight: 600;">
						The shortest path from ${startNode} to ${destNode}:
					</p>
					<div style="
						padding: 8px;
						background: #f0f0f0;
						border-radius: 6px;
						font-family: monospace;
						color: #0f172a;
						font-size: 0.95rem;
						margin: 0 0 12px;
					">
						${pathStr}
					</div>
					<div>
						<span style="font-weight: 600; color: #0f172a;">Total Distance:</span>
						<span style="color: #0f172a; font-weight: 600; margin-left: 4px;">${distance}</span>
					</div>
				`,
			};
		}
	}

	// Case 4: Prepared, animation progressing (next step / run)
	if (animation.isPrepared) {
		const currentStep = animation.steps[animation.currentStepIndex + 1];
		const stepNum = Math.min(animation.currentStepIndex + 2, animation.steps.length);
		const totalSteps = animation.steps.length;

		let stepContent = '';

		if (currentStep) {
			if (currentStep.type === 'current') {
				const currentNode = currentStep.node;
				const currentDist = animation.distances[currentNode];
				stepContent = `
					<p style="margin: 0 0 8px; color: #0f172a;">
						<strong>Visiting node:</strong> ${currentNode}
					</p>
					<p style="margin: 0 0 12px; color: #0f172a;">
						<strong>Current distance:</strong> ${currentDist !== undefined ? currentDist : '∞'}
					</p>
				`;
			} else if (currentStep.type === 'checking-edge') {
				stepContent = `
					<p style="margin: 0 0 12px; color: #0f172a;">
						<strong>Checking edge:</strong> ${currentStep.from} → ${currentStep.to}
					</p>
				`;
			} else if (currentStep.type === 'update-distance') {
				const newDist = currentStep.distance;
				stepContent = `
					<p style="margin: 0 0 8px; color: #22c55e; font-weight: 600;">
						✓ Distance updated
					</p>
					<p style="margin: 0 0 12px; color: #0f172a;">
						<strong>New distance to ${currentStep.node}:</strong> ${newDist}
					</p>
				`;
			} else if (currentStep.type === 'visited') {
				stepContent = `
					<p style="margin: 0 0 12px; color: #0f172a;">
						<strong>Marked as visited:</strong> ${currentStep.node}
					</p>
				`;
			}
		}

		const visitedStr = animation.visitedNodes.size > 0
			? Array.from(animation.visitedNodes).sort().join(', ')
			: 'None';

		return {
			title: `Step ${stepNum} / ${totalSteps}`,
			content: `
				${stepContent}
				<p style="margin: 12px 0 0; color: #666; font-size: 0.9rem;">
					<strong>Visited nodes:</strong> ${visitedStr}
				</p>
			`,
		};
	}

	// Fallback
	return {
		title: '🧠 Algorithm Explanation',
		content: `<p style="margin: 0; color: #666;">Select start and destination to begin.</p>`,
	};
}

// ======================================================
// RENDER EXPLANATION PANEL
// ======================================================

function renderExplanationPanel() {
	const explanation = getExplanationContent();

	explanationPanel.innerHTML = `
		<h3 style="margin: 0 0 12px; font-size: 1.1rem; font-weight: 600; color: #0f172a;">
			${explanation.title}
		</h3>
		<div style="color: #0f172a; font-size: 0.95rem; line-height: 1.6;">
			${explanation.content}
		</div>
	`;
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
	} else if (animation.isRunning) {
		modeLabel.textContent =
			'Running Dijkstra...';
	} else if (
		animation.isPrepared &&
		animation.currentStepIndex >=
			animation.steps.length - 1
	) {
		modeLabel.textContent =
			animation.finalPath.length === 0
				? 'No path exists'
				: 'Dijkstra complete';
	} else if (animation.isPrepared) {
		modeLabel.textContent =
			'Dijkstra prepared — choose Run or Next Step';
	} else if (
		ui.startNodeId !== null &&
		ui.destinationNodeId !== null
	) {
		modeLabel.textContent =
			'Ready to prepare Dijkstra';
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

	updateAnimationControls();
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
		resetVisualization();
		renderExplanationPanel();

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
	prepareAnimation
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

updateAnimationControls();
renderGraph();
renderLegend();
renderResultPanel();
renderExplanationPanel();