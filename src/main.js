import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';
import './style.css';

// Fix Leaflet default marker icon paths in Vite bundles
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl,
	iconUrl,
	shadowUrl,
});
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
	<div class="app-layout">
		<!-- Top Navigation Header -->
		<header class="top-nav">
			<div class="nav-container">
				<div class="brand-group">
					<div class="brand-badge-icon">⚡</div>
					<div class="brand-info">
						<span class="brand-title">AlgoPath</span>
						<span class="brand-subtitle">Graph &amp; Road Pathfinder</span>
					</div>
				</div>
				<nav class="nav-menu">
					<a href="#map-section" class="nav-item active">Map Experiment</a>
					<a href="#graph-section" class="nav-item">Graph Visualizer</a>
					<a href="#about-section" class="nav-item">About</a>
				</nav>
			</div>
		</header>

		<main class="dashboard-body">
			<!-- MAP EXPERIMENT SECTION (2-Column Layout) -->
			<section id="map-section" class="dashboard-card map-experiment-card">
				<div class="card-header-row">
					<div class="card-title-group">
						<div class="badge-pill badge-pill-emerald">Real-World Routing</div>
						<h2 class="card-main-title">Map Experiment</h2>
						<p class="card-description">
							Explore real-world street network routing using OpenStreetMap geocoding and OSRM practical road graph traversal.
						</p>
					</div>
				</div>

				<div class="map-experiment-layout">
					<!-- Left Sidebar: Controls & Inputs -->
					<aside class="map-sidebar">
						<div class="sidebar-section-header">
							<span class="sidebar-kicker">CONTROLS &amp; CONFIGURATION</span>
							<h3 class="sidebar-title">Route Search</h3>
						</div>

						<div class="sidebar-toggle-row">
							<button id="pick-on-map-btn" class="app-btn pick-toggle-btn" type="button">
								📍 Pick on Map
							</button>
							<button id="clear-map-selection-btn" class="app-btn clear-btn" type="button">
								✖ Clear
							</button>
						</div>

						<div id="place-search-container" class="search-inputs-card">
							<div class="form-field">
								<label class="field-label" for="place-from-input">Start Location</label>
								<div class="input-container">
									<span class="field-icon icon-start">📍</span>
									<input
										id="place-from-input"
										class="app-input"
										type="text"
										placeholder="e.g. Majestic, Bangalore"
									/>
								</div>
							</div>

							<div class="form-field">
								<label class="field-label" for="place-dest-input">Destination</label>
								<div class="input-container">
									<span class="field-icon icon-dest">🏁</span>
									<input
										id="place-dest-input"
										class="app-input"
										type="text"
										placeholder="e.g. Indiranagar, Bangalore"
									/>
								</div>
							</div>

							<button id="find-places-btn" class="app-btn btn-primary btn-submit-route" type="button">
								<span>⚡ Find Route</span>
							</button>
						</div>

						<div id="place-search-status" class="place-search-status"></div>

						<!-- Sidebar Dijkstra Trigger Card -->
						<div id="sidebar-dijkstra-card" class="sidebar-dijkstra-card">
							<div class="sidebar-dijkstra-header">
								<span class="dijkstra-badge">Dijkstra Explorer</span>
								<span id="sidebar-dijkstra-status" class="status-badge status-badge-waiting">Waiting</span>
							</div>
							<p class="sidebar-dijkstra-desc">
								Step-by-step exploration through real OSM road-network topology.
							</p>
							<button id="sidebar-visualize-dijkstra-btn" class="app-btn btn-visualize-dijkstra" type="button" disabled>
								<span>⚡ Visualize Dijkstra</span>
							</button>
						</div>
					</aside>

					<!-- Right Main Viewport: Large Map & Bottom Algorithm Evaluation -->
					<div class="map-main-viewport">
						<div class="map-canvas-container">
							<div class="map-glass-badge">
								<span class="pulse-dot"></span>
								<span>Leaflet • OSM Road Network</span>
							</div>
							<div id="map"></div>
						</div>

						<!-- Bottom Algorithm Status & Route Analysis Section -->
						<div id="route-analysis" class="route-analysis-section" style="display: none;"></div>
					</div>
				</div>
			</section>

			<!-- GRAPH VISUALIZER SECTION -->
			<section id="graph-section" class="dashboard-card graph-visualizer-card">
				<div class="card-header-row">
					<div class="card-title-group">
						<div class="badge-pill badge-pill-purple">Theoretical Algorithm</div>
						<h2 class="card-main-title">SVG Graph Visualizer</h2>
						<p class="card-description">
							Interactive Dijkstra shortest-path algorithm demonstration. Add custom vertices, weighted edges, drag nodes, and inspect step-by-step priority queue exploration.
						</p>
					</div>
				</div>

				<div class="graph-toolbar-card">
					<div class="toolbar-cluster">
						<button id="select-btn" class="app-btn" type="button">Select</button>
						<button id="add-node-btn" class="app-btn" type="button">Add Node: Off</button>
						<button id="add-edge-btn" class="app-btn" type="button">Add Edge: Off</button>
						<button id="delete-btn" class="app-btn btn-danger-outline" type="button">Delete</button>
					</div>

					<div class="toolbar-cluster">
						<button id="start-node-btn" class="app-btn btn-start-outline" type="button">Start Node</button>
						<button id="destination-node-btn" class="app-btn btn-dest-outline" type="button">Destination</button>
					</div>

					<div class="toolbar-cluster">
						<button id="run-dijkstra-btn" class="app-btn btn-prepare" type="button">Prepare Dijkstra</button>
						<button id="run-animation-btn" class="app-btn btn-primary" type="button">▶ Run</button>
						<button id="next-step-btn" class="app-btn" type="button">⏭ Next Step</button>
						<button id="reset-animation-btn" class="app-btn" type="button">↻ Reset</button>
					</div>

					<div class="toolbar-status-badge">
						<span id="mode-label" class="mode-label">Mode: Select / Drag</span>
					</div>
				</div>

				<div id="path-result" class="path-result-area"></div>

				<div class="svg-viewport-wrapper">
					<svg id="graph-svg" viewBox="0 0 760 420" class="graph-svg-canvas"></svg>
				</div>

				<div class="graph-panels-row">
					<div id="legend-container" class="panel-card"></div>
					<div id="result-panel" class="panel-card"></div>
					<div id="explanation-panel" class="panel-card"></div>
				</div>
			</section>

			<!-- ABOUT SECTION -->
			<section id="about-section" class="dashboard-card about-card">
				<div class="about-header-group">
					<div class="badge-pill badge-pill-blue">Pathfinding Insights</div>
					<h3 class="about-main-title">Theoretical Shortest Path vs. Real-World Road Networks</h3>
				</div>
				<div class="about-pillars-grid">
					<div class="pillar-card">
						<div class="pillar-icon">📐</div>
						<h4 class="pillar-title">Dijkstra's Algorithm</h4>
						<p class="pillar-text">
							Operates on abstract weighted graphs $(V, E)$ with non-negative weights, guaranteeing mathematical optimality by greedily relaxing the shortest tentative distance.
						</p>
					</div>
					<div class="pillar-card">
						<div class="pillar-icon">🛣️</div>
						<h4 class="pillar-title">OSRM Road Routing</h4>
						<p class="pillar-text">
							Evaluates practical highway graphs, turn restrictions, speed profiles, and geometry points mapped to actual road network topologies.
						</p>
					</div>
					<div class="pillar-card">
						<div class="pillar-icon">🔄</div>
						<h4 class="pillar-title">Interactive Analysis</h4>
						<p class="pillar-text">
							Explore both paradigms in a single unified dashboard—step through graph exploration or test real-world street coordinate routes with animated playback.
						</p>
					</div>
				</div>
			</section>
		</main>
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

// ======================================================
// LEAFLET MAP INITIALIZATION
// ======================================================

const map = L.map('map').setView([12.9716, 77.5946], 12);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
	maxZoom: 19,
	attribution:
		'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
}).addTo(map);

// ======================================================
// REAL-PLACE GEOCODING & OSRM ROUTING (M6.2, M6.3, M7 & M10.2)
// ======================================================

const placeFromInput = document.querySelector('#place-from-input');
const placeDestInput = document.querySelector('#place-dest-input');
const findPlacesBtn = document.querySelector('#find-places-btn');
const pickOnMapBtn = document.querySelector('#pick-on-map-btn');
const clearMapSelectionBtn = document.querySelector('#clear-map-selection-btn');
const placeSearchStatus = document.querySelector('#place-search-status');
const routeAnalysis = document.querySelector('#route-analysis');

let searchMarkers = [];
let currentRouteLayer = null;
let alternativeRouteLayers = [];
let currentCalculatedRoutes = [];
let currentRoadNetworkGraph = null;
let currentDijkstraResult = null;
let isPickOnMapMode = false;
let pickedStartCoords = null;
let pickedDestCoords = null;

let activeGraphFetchController = null;
let activeGraphRequestId = 0;
let osmCanvasRenderer = null;

function getStartMarkerIcon() {
	return L.divIcon({
		className: 'custom-map-marker-container',
		html: `
			<div class="custom-map-marker marker-start" title="Starting Point (S)">
				<div class="marker-inner">S</div>
			</div>
			<div class="marker-pulse-ring marker-pulse-start"></div>
		`,
		iconSize: [32, 38],
		iconAnchor: [16, 36],
		popupAnchor: [0, -36],
	});
}

function getDestMarkerIcon() {
	return L.divIcon({
		className: 'custom-map-marker-container',
		html: `
			<div class="custom-map-marker marker-dest" title="Destination Point (D)">
				<div class="marker-inner">D</div>
			</div>
			<div class="marker-pulse-ring marker-pulse-dest"></div>
		`,
		iconSize: [32, 38],
		iconAnchor: [16, 36],
		popupAnchor: [0, -36],
	});
}

function getOsmCanvasRenderer() {
	if (!osmCanvasRenderer) {
		osmCanvasRenderer = L.canvas({ padding: 0.5 });
	}
	return osmCanvasRenderer;
}

const osmDijkstraAnimation = {
	isRunning: false,
	isPaused: false,
	isComplete: false,
	currentIndex: 0,
	totalNodes: 0,
	settledSteps: [],
	exploredSegments: [],
	sampleInterval: 1,
	stepAdvance: 1,
	isPerformanceMode: false,
	animFrameId: null,
	exploredLayer: null,
	finalPathLayer: null,
};

function clearOsmDijkstraVisualization() {
	if (osmDijkstraAnimation.animFrameId) {
		cancelAnimationFrame(osmDijkstraAnimation.animFrameId);
		osmDijkstraAnimation.animFrameId = null;
	}
	if (osmDijkstraAnimation.exploredLayer) {
		map.removeLayer(osmDijkstraAnimation.exploredLayer);
		osmDijkstraAnimation.exploredLayer = null;
	}
	if (osmDijkstraAnimation.finalPathLayer) {
		map.removeLayer(osmDijkstraAnimation.finalPathLayer);
		osmDijkstraAnimation.finalPathLayer = null;
	}
	osmDijkstraAnimation.isRunning = false;
	osmDijkstraAnimation.isPaused = false;
	osmDijkstraAnimation.isComplete = false;
	osmDijkstraAnimation.currentIndex = 0;
	osmDijkstraAnimation.totalNodes = 0;
	osmDijkstraAnimation.settledSteps = [];
	osmDijkstraAnimation.exploredSegments = [];
	osmDijkstraAnimation.sampleInterval = 1;
	osmDijkstraAnimation.stepAdvance = 1;
	osmDijkstraAnimation.isPerformanceMode = false;

	updateDijkstraUI('WAITING');
}

function escapeHtml(str) {
	if (!str) return '';
	return String(str)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

async function geocodePlace(query) {
	const trimmed = query.trim();
	if (!trimmed) {
		return null;
	}

	const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}&limit=1`;
	const response = await fetch(url, {
		headers: {
			Accept: 'application/json',
		},
	});

	if (!response.ok) {
		throw new Error(`Geocoding failed with status ${response.status}`);
	}

	const data = await response.json();
	if (!data || data.length === 0) {
		return null;
	}

	return {
		name: trimmed,
		displayName: data[0].display_name,
		lat: parseFloat(data[0].lat),
		lon: parseFloat(data[0].lon),
	};
}

async function fetchOSRMRoute(fromCoords, destCoords) {
	// OSRM expects exactly two routing points: {start_lon},{start_lat};{dest_lon},{dest_lat}
	// Explicitly request multiple alternative routes using alternatives=3 with full geojson geometry
	const url = `https://router.project-osrm.org/route/v1/driving/${fromCoords.lon},${fromCoords.lat};${destCoords.lon},${destCoords.lat}?overview=full&geometries=geojson&alternatives=3`;
	const response = await fetch(url);

	if (!response.ok) {
		throw new Error(`Routing request failed with status ${response.status}`);
	}

	const data = await response.json();
	if (!data || data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
		throw new Error('No route returned by routing service.');
	}

	const routesCount = data.routes.length;
	console.log(`[OSRM] Number of routes returned: ${routesCount}`);
	if (routesCount === 1) {
		console.log('[OSRM] Note: Only 1 route was supplied by OSRM for this location pair.');
	} else {
		console.log(`[OSRM] Found ${routesCount} routes (1 recommended shortest + ${routesCount - 1} alternative(s)).`);
	}

	// Parse every returned route in data.routes into a clean, structured array
	const allRoutes = data.routes.map((r, idx) => {
		const coords = r.geometry && Array.isArray(r.geometry.coordinates)
			? r.geometry.coordinates.map(([lon, lat]) => [lat, lon])
			: [];
		const ptCount = coords.length;
		const colorConfig = ROUTE_COLORS[idx] || { color: '#94a3b8', weight: 3.5, opacity: 0.75 };

		return {
			id: idx + 1,
			name: idx === 0 ? 'Route 1 (Shortest / Recommended)' : `Route ${idx + 1} (Alternative)`,
			isShortest: idx === 0,
			geometry: r.geometry,
			coordinates: coords,
			distanceKm: (r.distance / 1000).toFixed(2),
			durationMin: (r.duration / 60).toFixed(1),
			pointCount: ptCount,
			color: colorConfig.color,
			weight: colorConfig.weight,
			opacity: colorConfig.opacity,
			index: idx,
		};
	});

	currentCalculatedRoutes = allRoutes;

	const primaryRoute = allRoutes[0];
	const alternatives = allRoutes.slice(1);

	return {
		geometry: primaryRoute.geometry,
		distanceKm: primaryRoute.distanceKm,
		durationMin: primaryRoute.durationMin,
		pointCount: primaryRoute.pointCount,
		routes: allRoutes,
		alternatives,
		totalRoutes: routesCount,
	};
}

const OVERPASS_ENDPOINTS = [
	'https://lz4.overpass-api.de/api/interpreter',
	'https://overpass-api.de/api/interpreter',
	'https://z.overpass-api.de/api/interpreter',
	'https://overpass.kumi.systems/api/interpreter',
	'https://overpass.private.coffee/api/interpreter',
];

async function fetchOverpassWithFallback(query, onProgress = null, abortSignal = null) {
	const timeoutMs = 15000;
	let lastError = null;

	for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
		if (abortSignal && abortSignal.aborted) {
			throw new Error('Overpass request aborted');
		}

		const endpoint = OVERPASS_ENDPOINTS[i];
		const isPrimary = i === 0;
		const progressMessage = isPrimary
			? 'Fetching OSM road network...'
			: `Retrying with alternate OSM server (${i + 1}/${OVERPASS_ENDPOINTS.length})...`;

		if (onProgress) {
			onProgress(progressMessage);
		}

		console.log(`[OSM Graph] Overpass request (${i + 1}/${OVERPASS_ENDPOINTS.length}): ${endpoint}`);

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		const abortHandler = () => {
			controller.abort();
		};
		if (abortSignal) {
			abortSignal.addEventListener('abort', abortHandler, { once: true });
		}

		try {
			const res = await fetch(endpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/x-www-form-urlencoded',
					'User-Agent': 'AlgoPath-Explorer/1.0',
				},
				body: `data=${encodeURIComponent(query)}`,
				signal: controller.signal,
			});
			clearTimeout(timeoutId);
			if (abortSignal) {
				abortSignal.removeEventListener('abort', abortHandler);
			}

			if (!res.ok) {
				throw new Error(`HTTP ${res.status} ${res.statusText}`);
			}

			const data = await res.json();
			if (!data || !Array.isArray(data.elements)) {
				throw new Error('Invalid or empty Overpass response JSON');
			}

			console.log(`[OSM Graph] Loaded ${data.elements.length} elements from ${endpoint}`);
			return data;
		} catch (err) {
			clearTimeout(timeoutId);
			if (abortSignal) {
				abortSignal.removeEventListener('abort', abortHandler);
				if (abortSignal.aborted) {
					throw new Error('Overpass request aborted');
				}
			}
			const errMsg = err.name === 'AbortError' ? 'Timeout (15s exceeded)' : err.message;
			console.warn(`[OSM Graph] Endpoint ${endpoint} failed: ${errMsg}`);
			lastError = new Error(`${endpoint}: ${errMsg}`);
		}
	}

	throw lastError || new Error('All Overpass endpoints failed');
}

async function fetchRoadNetworkGraph(fromCoords, destCoords, routeCoords = null, onProgress = null, abortSignal = null) {
	let minLat, maxLat, minLon, maxLon;
	if (routeCoords && Array.isArray(routeCoords) && routeCoords.length > 0) {
		const lats = routeCoords.map((c) => (Array.isArray(c) ? c[0] : c.lat));
		const lons = routeCoords.map((c) => (Array.isArray(c) ? c[1] : c.lon));
		minLat = Math.min(fromCoords.lat, destCoords.lat, ...lats);
		maxLat = Math.max(fromCoords.lat, destCoords.lat, ...lats);
		minLon = Math.min(fromCoords.lon, destCoords.lon, ...lons);
		maxLon = Math.max(fromCoords.lon, destCoords.lon, ...lons);
	} else {
		minLat = Math.min(fromCoords.lat, destCoords.lat);
		maxLat = Math.max(fromCoords.lat, destCoords.lat);
		minLon = Math.min(fromCoords.lon, destCoords.lon);
		maxLon = Math.max(fromCoords.lon, destCoords.lon);
	}

	const straightDistKm = calculateDistanceBetweenCoords(
		fromCoords.lat,
		fromCoords.lon,
		destCoords.lat,
		destCoords.lon
	);

	// Tight corridor buffer around the route bounds (~4-8km) to minimize download size
	const padLat = Math.max(0.04, Math.min(0.08, (maxLat - minLat) * 0.08));
	const padLon = Math.max(0.04, Math.min(0.08, (maxLon - minLon) * 0.08));

	const south = Math.max(-90, minLat - padLat).toFixed(4);
	const west = Math.max(-180, minLon - padLon).toFixed(4);
	const north = Math.min(90, maxLat + padLat).toFixed(4);
	const east = Math.min(180, maxLon + padLon).toFixed(4);

	// Include link roads (motorway_link, trunk_link, primary_link, etc.) to ensure highway junctions and interchanges stay connected
	let highwayFilter = 'motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link';
	if (straightDistKm > 200) {
		highwayFilter = 'motorway|motorway_link|trunk|trunk_link|primary|primary_link';
	} else if (straightDistKm <= 25) {
		highwayFilter = 'motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified';
	}

	const overpassQuery = `[out:json][timeout:25];(way["highway"~"${highwayFilter}"](${south},${west},${north},${east}););(._;>;);out body;`;

	try {
		const data = await fetchOverpassWithFallback(overpassQuery, onProgress, abortSignal);

		const nodesMap = new Map();
		const ways = [];

		for (const el of data.elements) {
			if (el.type === 'node') {
				nodesMap.set(el.id, { id: el.id, lat: el.lat, lon: el.lon });
			} else if (el.type === 'way' && Array.isArray(el.nodes)) {
				ways.push(el);
			}
		}

		const adjacency = new Map();
		let totalEdgeCount = 0;

		const addEdge = (uId, vId, wayId, highway) => {
			const uNode = nodesMap.get(uId);
			const vNode = nodesMap.get(vId);
			if (!uNode || !vNode) return;

			const distKm = calculateDistanceBetweenCoords(uNode.lat, uNode.lon, vNode.lat, vNode.lon);
			if (!adjacency.has(uId)) adjacency.set(uId, []);

			adjacency.get(uId).push({
				targetId: vId,
				weight: distKm,
				geometry: [[uNode.lat, uNode.lon], [vNode.lat, vNode.lon]],
				wayId,
				highway,
			});
			totalEdgeCount++;
		};

		for (const way of ways) {
			const onewayTag = way.tags && way.tags.oneway;
			const isOneWay =
				onewayTag === 'yes' ||
				onewayTag === '1' ||
				onewayTag === 'true' ||
				(way.tags && way.tags.junction === 'roundabout');
			const isReverseOneWay = onewayTag === '-1' || onewayTag === 'reverse';
			const hw = way.tags ? way.tags.highway : 'road';

			for (let i = 0; i < way.nodes.length - 1; i++) {
				const uId = way.nodes[i];
				const vId = way.nodes[i + 1];
				if (isReverseOneWay) {
					addEdge(vId, uId, way.id, hw);
				} else if (isOneWay) {
					addEdge(uId, vId, way.id, hw);
				} else {
					addEdge(uId, vId, way.id, hw);
					addEdge(vId, uId, way.id, hw);
				}
			}
		}

		// Map Start and Destination to nearest connected graph nodes
		const findNearestNodes = (targetCoords, maxCandidates = 10) => {
			const candidates = [];
			for (const [nodeId, node] of nodesMap.entries()) {
				if (!adjacency.has(nodeId) || adjacency.get(nodeId).length === 0) continue;
				const d = calculateDistanceBetweenCoords(targetCoords.lat, targetCoords.lon, node.lat, node.lon);
				candidates.push({ id: nodeId, lat: node.lat, lon: node.lon, distanceKm: d });
			}
			candidates.sort((a, b) => a.distanceKm - b.distanceKm);
			return candidates.slice(0, maxCandidates);
		};

		const startCandidates = findNearestNodes(fromCoords, 10);
		const destCandidates = findNearestNodes(destCoords, 10);

		const nearestStart = startCandidates[0] || null;
		const nearestDest = destCandidates[0] || null;

		currentRoadNetworkGraph = {
			nodes: nodesMap,
			adjacency,
			nodeCount: nodesMap.size,
			edgeCount: totalEdgeCount,
			bounds: { south, west, north, east },
			startNode: nearestStart,
			destNode: nearestDest,
			startCandidates,
			destCandidates,
		};

		// Detailed Console Logging
		console.log('================================================================');
		console.log('🗺️ [OSM Road-Network Graph Extracted Successfully]');
		console.log('1. Graph Nodes (Vertices):', currentRoadNetworkGraph.nodeCount);
		console.log('2. Graph Edges (Road Segments):', currentRoadNetworkGraph.edgeCount);
		console.log('3. Graph Bounding Region:', `[South: ${south}, West: ${west}, North: ${north}, East: ${east}]`);
		console.log('4. Start/End Coordinate Mapping:');
		if (nearestStart) {
			console.log(
				`   - Start (${fromCoords.lat}, ${fromCoords.lon}) -> Mapped to OSM Node #${nearestStart.id} (${nearestStart.lat}, ${nearestStart.lon}) [Offset: ${(nearestStart.distanceKm * 1000).toFixed(1)}m, Degree: ${(adjacency.get(nearestStart.id) || []).length}]`
			);
		} else {
			console.log('   - Start coordinate mapping: Not found');
		}
		if (nearestDest) {
			console.log(
				`   - Destination (${destCoords.lat}, ${destCoords.lon}) -> Mapped to OSM Node #${nearestDest.id} (${nearestDest.lat}, ${nearestDest.lon}) [Offset: ${(nearestDest.distanceKm * 1000).toFixed(1)}m, Degree: ${(adjacency.get(nearestDest.id) || []).length}]`
			);
		} else {
			console.log('   - Destination coordinate mapping: Not found');
		}
		console.log('================================================================');

		return currentRoadNetworkGraph;
	} catch (err) {
		console.warn('[OSM Graph] Overpass extraction notice:', err.message);
		throw err;
	}
}

// ======================================================
// MIN-HEAP PRIORITY QUEUE FOR IN-THREAD FALLBACK
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

// ======================================================
// DIJKSTRA COMPUTATION (WEB WORKER WITH IN-THREAD FALLBACK)
// ======================================================

function runDijkstraOnOsmGraphInThread(graph, sourceNodeId, targetNodeId, osrmDistanceKm = null) {
	const tStart = performance.now();
	if (!graph || !graph.nodes || !graph.adjacency) {
		console.error('[Dijkstra] Invalid OSM graph provided.');
		return null;
	}

	if (!sourceNodeId || !targetNodeId) {
		console.error('[Dijkstra] Invalid source or destination node ID.');
		return null;
	}

	if (!graph.nodes.has(sourceNodeId) || !graph.nodes.has(targetNodeId)) {
		console.error('[Dijkstra] Source or target node does not exist in graph.');
		return null;
	}

	const sourceNode = graph.nodes.get(sourceNodeId);
	const targetNode = graph.nodes.get(targetNodeId);

	// Edge Case: Start and Destination map to the same OSM node
	if (sourceNodeId === targetNodeId) {
		const computationTimeMs = (performance.now() - tStart).toFixed(1);
		const pointGeometry = [[sourceNode.lat, sourceNode.lon], [sourceNode.lat, sourceNode.lon]];
		return {
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
			totalGraphNodes: graph.nodeCount,
			totalGraphEdges: graph.edgeCount,
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
			startDegree: graph.adjacency.has(sourceNodeId) ? graph.adjacency.get(sourceNodeId).length : 0,
			destDegree: graph.adjacency.has(targetNodeId) ? graph.adjacency.get(targetNodeId).length : 0,
			bothExistInAdjacency: Boolean(graph.adjacency.has(sourceNodeId)),
		};
	}

	const distances = new Map();
	const previous = new Map();
	const visited = new Set();
	const pq = new MinHeap();
	const settledOrder = [];

	distances.set(sourceNodeId, 0);
	pq.push(sourceNodeId, 0);

	let destinationSettled = false;
	let settledCount = 0;

	while (!pq.isEmpty()) {
		const current = pq.pop();
		const uId = current.id;
		const uDist = current.priority;

		if (visited.has(uId)) continue;
		visited.add(uId);
		settledCount++;
		settledOrder.push({ id: uId, dist: uDist });

		if (uId === targetNodeId) {
			destinationSettled = true;
			break;
		}

		const neighbors = graph.adjacency.get(uId) || [];
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

	const startDegree = graph.adjacency.has(sourceNodeId) ? graph.adjacency.get(sourceNodeId).length : 0;
	const destDegree = graph.adjacency.has(targetNodeId) ? graph.adjacency.get(targetNodeId).length : 0;
	const bothExistInAdjacency = graph.adjacency.has(sourceNodeId) && graph.adjacency.has(targetNodeId);
	const computationTimeMs = (performance.now() - tStart).toFixed(1);

	return {
		success: true,
		pathFound,
		sourceNode: { id: sourceNodeId, lat: sourceNode.lat, lon: sourceNode.lon },
		targetNode: { id: targetNodeId, lat: targetNode.lat, lon: targetNode.lon },
		visitedCount: settledCount,
		settledSteps,
		totalGraphNodes: graph.nodeCount,
		totalGraphEdges: graph.edgeCount,
		dijkstraDistanceKm: pathFound ? totalDijkstraDistanceKm.toFixed(2) : null,
		pathEdgeCount: edgePath.length,
		nodePath,
		edgePath,
		osrmDistanceKm: osrmDistanceKm || null,
		computationTimeMs,
		startDegree,
		destDegree,
		bothExistInAdjacency,
	};
}

async function computeDijkstraOnOsmGraph(graph, sourceNodeId, targetNodeId, osrmDistanceKm = null) {
	return new Promise((resolve) => {
		if (typeof Worker !== 'undefined') {
			try {
				const worker = new Worker(new URL('./dijkstraWorker.js', import.meta.url), { type: 'module' });

				const nodesArray = [];
				for (const [id, node] of graph.nodes.entries()) {
					nodesArray.push([id, node.lat, node.lon]);
				}
				const adjacencyObj = {};
				for (const [uId, edges] of graph.adjacency.entries()) {
					adjacencyObj[uId] = edges;
				}

				worker.onmessage = (e) => {
					worker.terminate();
					if (e.data && e.data.success) {
						resolve(e.data);
					} else {
						console.warn('[Dijkstra Worker] Falling back to in-thread calculation:', e.data?.error);
						resolve(runDijkstraOnOsmGraphInThread(graph, sourceNodeId, targetNodeId, osrmDistanceKm));
					}
				};

				worker.onerror = (err) => {
					console.warn('[Dijkstra Worker] Worker error, falling back to in-thread calculation:', err);
					worker.terminate();
					resolve(runDijkstraOnOsmGraphInThread(graph, sourceNodeId, targetNodeId, osrmDistanceKm));
				};

				worker.postMessage({
					nodes: nodesArray,
					adjacency: adjacencyObj,
					sourceNodeId,
					targetNodeId,
					osrmDistanceKm,
					nodeCount: graph.nodeCount,
					edgeCount: graph.edgeCount,
				});
				return;
			} catch (workerErr) {
				console.warn('[Dijkstra Worker] Could not instantiate worker:', workerErr);
			}
		}

		// Direct in-thread calculation fallback
		resolve(runDijkstraOnOsmGraphInThread(graph, sourceNodeId, targetNodeId, osrmDistanceKm));
	});
}

function logDijkstraStats(result, graph) {
	if (!result) return;
	// Specific required console format
	console.log('================================================================');
	console.log('[Dijkstra] Graph ready');
	console.log('[Dijkstra] Nodes:', result.totalGraphNodes || graph?.nodeCount);
	console.log('[Dijkstra] Edges:', result.totalGraphEdges || graph?.edgeCount);
	console.log('[Dijkstra] Source:', `#${result.sourceNode.id}`);
	console.log('[Dijkstra] Target:', `#${result.targetNode.id}`);
	console.log('[Dijkstra] Nodes settled:', result.visitedCount);
	console.log('[Dijkstra] Final path nodes:', result.nodePath ? result.nodePath.length : 0);
	console.log('[Dijkstra] Final distance:', result.pathFound ? `${result.dijkstraDistanceKm} km` : 'No path');
	console.log('[Dijkstra] Computation time:', `${result.computationTimeMs || 0} ms`);
	if (result.osrmDistanceKm !== null) {
		console.log('[Dijkstra] OSRM Road Engine Distance:', `${result.osrmDistanceKm} km`);
		if (result.pathFound) {
			const diff = Math.abs(parseFloat(result.dijkstraDistanceKm) - parseFloat(result.osrmDistanceKm)).toFixed(2);
			console.log('[Dijkstra] Distance Difference:', `${diff} km`);
		}
	}
	console.log('================================================================');
}

// UI State machine: WAITING | LOADING GRAPH | EXPLORING | PATH FOUND | ERROR
let currentUIState = 'WAITING';

function updateDijkstraUI(stateOverride = null, messageOverride = null) {
	const visualizeBtn = document.querySelector('#visualize-dijkstra-btn');
	const pauseBtn = document.querySelector('#pause-dijkstra-btn');
	const resetBtn = document.querySelector('#reset-dijkstra-btn');
	const progressFill = document.querySelector('#dijkstra-progress-fill');
	const statusBadge = document.querySelector('#dijkstra-status-badge');
	const sidebarStatusBadge = document.querySelector('#sidebar-dijkstra-status');
	const statusText = document.querySelector('#dijkstra-status-text');
	const nodesExploredText = document.querySelector('#dijkstra-nodes-explored');
	const distanceText = document.querySelector('#dijkstra-dist-text');
	const sidebarDijkstraBtn = document.querySelector('#sidebar-visualize-dijkstra-btn');

	if (stateOverride) {
		currentUIState = stateOverride;
	} else if (osmDijkstraAnimation.isRunning) {
		currentUIState = 'EXPLORING';
	} else if (currentDijkstraResult && currentDijkstraResult.pathFound) {
		currentUIState = 'PATH FOUND';
	} else if (currentDijkstraResult && !currentDijkstraResult.pathFound) {
		currentUIState = 'ERROR';
	} else if (!currentRoadNetworkGraph) {
		currentUIState = 'WAITING';
	}

	const visualTotal = osmDijkstraAnimation.settledSteps.length || 1;
	const progressRatio = osmDijkstraAnimation.isComplete
		? 1
		: (visualTotal > 0 ? Math.min(1, osmDijkstraAnimation.currentIndex / visualTotal) : 0);
	const percent = Math.min(100, Math.max(0, progressRatio * 100));

	if (progressFill) {
		progressFill.style.width = `${percent}%`;
	}

	if (nodesExploredText) {
		const total = osmDijkstraAnimation.totalNodes || (currentDijkstraResult ? currentDijkstraResult.visitedCount : 0);
		const currentCount = osmDijkstraAnimation.isComplete
			? total
			: Math.min(total, Math.round(progressRatio * total));
		nodesExploredText.textContent = `Explored: ${currentCount.toLocaleString()} / ${total.toLocaleString()} nodes`;
	}

	if (distanceText) {
		if (currentDijkstraResult && (currentDijkstraResult.isSameLocation || currentDijkstraResult.dijkstraDistanceKm === '0.00')) {
			distanceText.textContent = osmDijkstraAnimation.isComplete
				? 'Shortest Path Found: 0.00 km (Same Location)'
				: 'Calculated Shortest: 0.00 km (Same Location)';
		} else if (osmDijkstraAnimation.isComplete && currentDijkstraResult && currentDijkstraResult.pathFound) {
			distanceText.textContent = `Shortest Path Found: ${currentDijkstraResult.dijkstraDistanceKm} km`;
		} else if (currentDijkstraResult && currentDijkstraResult.pathFound) {
			distanceText.textContent = `Calculated Shortest: ${currentDijkstraResult.dijkstraDistanceKm} km`;
		} else if (currentDijkstraResult && !currentDijkstraResult.pathFound) {
			distanceText.textContent = 'Calculated Shortest: No path found';
		} else {
			distanceText.textContent = 'Calculated Shortest: -- km';
		}
	}

	// Status text based on state
	let displayMessage = messageOverride;
	if (!displayMessage) {
		switch (currentUIState) {
			case 'WAITING':
				displayMessage = 'Awaiting route & graph extraction...';
				break;
			case 'LOADING GRAPH':
				displayMessage = 'Fetching OSM road network...';
				break;
			case 'EXPLORING':
				displayMessage = osmDijkstraAnimation.isPerformanceMode
					? 'Exploring road network (Performance Mode)...'
					: 'Exploring road network...';
				break;
			case 'PATH FOUND':
				if (currentDijkstraResult && currentDijkstraResult.isSameLocation) {
					displayMessage = 'Start and Destination are the same location (0.00 km).';
				} else {
					displayMessage = osmDijkstraAnimation.isComplete
						? 'Shortest path found!'
						: 'Ready to visualize Dijkstra exploration';
				}
				break;
			case 'ERROR':
				displayMessage = 'Could not find a path between selected points on the OSM graph.';
				break;
			default:
				displayMessage = 'Ready to visualize Dijkstra exploration';
		}
	}

	if (statusText) {
		statusText.textContent = displayMessage;
	}

	const applyBadgeState = (badgeEl) => {
		if (!badgeEl) return;
		switch (currentUIState) {
			case 'WAITING':
				badgeEl.textContent = 'Waiting';
				badgeEl.className = 'status-badge status-badge-waiting';
				break;
			case 'LOADING GRAPH':
				badgeEl.textContent = 'Loading Graph';
				badgeEl.className = 'status-badge status-badge-running';
				break;
			case 'EXPLORING':
				if (osmDijkstraAnimation.isPaused) {
					badgeEl.textContent = 'Paused';
					badgeEl.className = 'status-badge status-badge-paused';
				} else {
					badgeEl.textContent = 'Exploring...';
					badgeEl.className = 'status-badge status-badge-running';
				}
				break;
			case 'PATH FOUND':
				if (osmDijkstraAnimation.isComplete) {
					badgeEl.textContent = 'Path Found';
					badgeEl.className = 'status-badge status-badge-complete';
				} else {
					badgeEl.textContent = 'Graph Ready';
					badgeEl.className = 'status-badge status-badge-ready';
				}
				break;
			case 'ERROR':
				badgeEl.textContent = 'Error';
				badgeEl.className = 'status-badge status-badge-waiting';
				break;
		}
	};

	applyBadgeState(statusBadge);
	applyBadgeState(sidebarStatusBadge);

	// Action Buttons state
	const canVisualize =
		currentUIState === 'PATH FOUND' &&
		currentDijkstraResult &&
		currentDijkstraResult.pathFound &&
		!osmDijkstraAnimation.isRunning;

	const updateButton = (btn) => {
		if (!btn) return;
		btn.disabled = !canVisualize && !osmDijkstraAnimation.isPaused;
		if (osmDijkstraAnimation.isRunning) {
			btn.innerHTML = '<span>⚡ Exploring...</span>';
			btn.disabled = true;
		} else if (osmDijkstraAnimation.isPaused) {
			btn.innerHTML = '<span>▶ Resume</span>';
			btn.disabled = false;
		} else if (osmDijkstraAnimation.isComplete) {
			btn.innerHTML = '<span>↻ Visualize Again</span>';
			btn.disabled = false;
		} else {
			btn.innerHTML = '<span>⚡ Visualize Dijkstra</span>';
			btn.disabled = !canVisualize;
		}
	};

	updateButton(visualizeBtn);
	updateButton(sidebarDijkstraBtn);

	if (pauseBtn) {
		pauseBtn.disabled = !osmDijkstraAnimation.isRunning;
	}

	if (resetBtn) {
		resetBtn.disabled = currentUIState === 'LOADING GRAPH' || (!currentDijkstraResult && osmDijkstraAnimation.currentIndex === 0);
	}
}

function startOsmDijkstraAnimation() {
	if (!currentDijkstraResult || !currentDijkstraResult.pathFound || !currentDijkstraResult.settledSteps || currentDijkstraResult.settledSteps.length === 0) {
		console.warn('[Dijkstra Visualization] No valid Dijkstra result available to visualize.');
		updateDijkstraUI('No Dijkstra result available for this area.');
		return;
	}

	if (osmDijkstraAnimation.isRunning) return;

	// If resuming from paused state
	if (osmDijkstraAnimation.isPaused && osmDijkstraAnimation.currentIndex < osmDijkstraAnimation.settledSteps.length) {
		osmDijkstraAnimation.isRunning = true;
		osmDijkstraAnimation.isPaused = false;
		updateDijkstraUI();
		console.log('▶ [Dijkstra Visualization] Resumed exploration from node index:', osmDijkstraAnimation.currentIndex);
		osmDijkstraAnimation.animFrameId = requestAnimationFrame(stepOsmDijkstraAnimation);
		return;
	}

	// Fresh start: clean up existing visualization layers
	clearOsmDijkstraVisualization();

	const totalVisualSteps = currentDijkstraResult.settledSteps.length;
	const totalVisitedNodes = currentDijkstraResult.visitedCount || totalVisualSteps;
	const isLargeGraph = totalVisitedNodes > 50000;

	// Target frames: smooth animation in ~2-3 seconds (~120 frames at 60 FPS)
	const targetFrames = 120;
	const stepAdvance = Math.max(1, Math.ceil(totalVisualSteps / targetFrames));

	osmDijkstraAnimation.settledSteps = currentDijkstraResult.settledSteps;
	osmDijkstraAnimation.totalNodes = totalVisitedNodes;
	osmDijkstraAnimation.currentIndex = 0;
	osmDijkstraAnimation.exploredSegments = [];
	osmDijkstraAnimation.sampleInterval = 1;
	osmDijkstraAnimation.stepAdvance = stepAdvance;
	osmDijkstraAnimation.isPerformanceMode = isLargeGraph;
	osmDijkstraAnimation.isRunning = true;
	osmDijkstraAnimation.isPaused = false;
	osmDijkstraAnimation.isComplete = false;

	const renderer = getOsmCanvasRenderer();
	osmDijkstraAnimation.exploredLayer = L.polyline([], {
		renderer,
		color: '#f59e0b', // Subtle glowing amber
		weight: 3.5,
		opacity: 0.65,
		lineCap: 'round',
		lineJoin: 'round',
	}).addTo(map);

	// Required Console Logging
	console.log('================================================================');
	console.log('⚡ [Dijkstra animation started]');
	console.log('total nodes in traversal:', totalVisitedNodes.toLocaleString());
	console.log('total road graph edges:', currentDijkstraResult.totalGraphEdges.toLocaleString());
	console.log('source OSM node:', currentDijkstraResult.sourceNode.id);
	console.log('target OSM node:', currentDijkstraResult.targetNode.id);
	if (isLargeGraph) {
		console.log('⚡ [Dijkstra Performance Mode Activated]');
		console.log(`   - Graph size: ${totalVisitedNodes.toLocaleString()} settled nodes (> 50,000 threshold)`);
		console.log(`   - Exploration visual sampled steps: ${totalVisualSteps.toLocaleString()} steps`);
		console.log(`   - Logical exploration step: ${stepAdvance.toLocaleString()} steps / frame (~60 FPS)`);
	} else {
		console.log(`   - Exploration visual sampled steps: ${totalVisualSteps.toLocaleString()} steps`);
	}
	console.log('================================================================');

	updateDijkstraUI();
	osmDijkstraAnimation.animFrameId = requestAnimationFrame(stepOsmDijkstraAnimation);
}

function stepOsmDijkstraAnimation() {
	if (!osmDijkstraAnimation.isRunning) return;

	const visualTotal = osmDijkstraAnimation.settledSteps.length;
	if (visualTotal === 0) {
		completeOsmDijkstraAnimation();
		return;
	}

	const prevIndex = osmDijkstraAnimation.currentIndex;
	const nextIndex = Math.min(visualTotal, prevIndex + osmDijkstraAnimation.stepAdvance);

	let addedSegments = 0;
	for (let i = prevIndex; i < nextIndex; i++) {
		const step = osmDijkstraAnimation.settledSteps[i];
		if (step && step.geometry && Array.isArray(step.geometry)) {
			osmDijkstraAnimation.exploredSegments.push(step.geometry);
			addedSegments++;
		}
	}

	osmDijkstraAnimation.currentIndex = nextIndex;

	// Update canvas geometry efficiently without flooding the renderer
	if (addedSegments > 0 && osmDijkstraAnimation.exploredLayer) {
		osmDijkstraAnimation.exploredLayer.setLatLngs(osmDijkstraAnimation.exploredSegments);
	}

	updateDijkstraUI();

	if (osmDijkstraAnimation.currentIndex >= visualTotal) {
		completeOsmDijkstraAnimation();
	} else {
		osmDijkstraAnimation.animFrameId = requestAnimationFrame(stepOsmDijkstraAnimation);
	}
}

function completeOsmDijkstraAnimation() {
	if (osmDijkstraAnimation.animFrameId) {
		cancelAnimationFrame(osmDijkstraAnimation.animFrameId);
		osmDijkstraAnimation.animFrameId = null;
	}

	osmDijkstraAnimation.isRunning = false;
	osmDijkstraAnimation.isPaused = false;
	osmDijkstraAnimation.isComplete = true;
	osmDijkstraAnimation.currentIndex = osmDijkstraAnimation.settledSteps.length;

	// Prominently highlight the complete Dijkstra shortest path with full fidelity
	if (currentDijkstraResult && currentDijkstraResult.edgePath && currentDijkstraResult.edgePath.length > 0) {
		const renderer = getOsmCanvasRenderer();
		const finalPathCoords = currentDijkstraResult.edgePath.map((edge) => edge.geometry);

		if (osmDijkstraAnimation.finalPathLayer) {
			map.removeLayer(osmDijkstraAnimation.finalPathLayer);
		}

		osmDijkstraAnimation.finalPathLayer = L.polyline(finalPathCoords, {
			renderer,
			color: '#10b981', // Vibrant Emerald Green
			weight: 6.5,
			opacity: 0.95,
			lineCap: 'round',
			lineJoin: 'round',
		}).addTo(map);

		// Bring the shortest path layer to front for maximum visual clarity
		osmDijkstraAnimation.finalPathLayer.bringToFront();
	}

	updateDijkstraUI();

	// Required Console Logging
	console.log('================================================================');
	console.log('🏁 [Dijkstra Road-Network Visualization Completed]');
	console.log('total nodes in traversal:', osmDijkstraAnimation.totalNodes);
	console.log('total explored nodes:', osmDijkstraAnimation.currentIndex);
	console.log('total visual sampled road segments on canvas:', osmDijkstraAnimation.exploredSegments.length);
	console.log('final shortest-path edge count:', currentDijkstraResult ? currentDijkstraResult.pathEdgeCount : 0);
	console.log('final Dijkstra distance:', currentDijkstraResult ? `${currentDijkstraResult.dijkstraDistanceKm} km` : '0 km');
	console.log('animation completed: Successfully explored road network & highlighted optimal shortest path ✅');
	console.log('================================================================');
}

function pauseOsmDijkstraAnimation() {
	if (!osmDijkstraAnimation.isRunning) return;
	if (osmDijkstraAnimation.animFrameId) {
		cancelAnimationFrame(osmDijkstraAnimation.animFrameId);
		osmDijkstraAnimation.animFrameId = null;
	}
	osmDijkstraAnimation.isRunning = false;
	osmDijkstraAnimation.isPaused = true;
	updateDijkstraUI();
	console.log('⏸ [Dijkstra Visualization] Paused at step:', osmDijkstraAnimation.currentIndex);
}

function resetOsmDijkstraAnimation() {
	if (osmDijkstraAnimation.animFrameId) {
		cancelAnimationFrame(osmDijkstraAnimation.animFrameId);
		osmDijkstraAnimation.animFrameId = null;
	}
	if (osmDijkstraAnimation.exploredLayer) {
		map.removeLayer(osmDijkstraAnimation.exploredLayer);
		osmDijkstraAnimation.exploredLayer = null;
	}
	if (osmDijkstraAnimation.finalPathLayer) {
		map.removeLayer(osmDijkstraAnimation.finalPathLayer);
		osmDijkstraAnimation.finalPathLayer = null;
	}
	osmDijkstraAnimation.isRunning = false;
	osmDijkstraAnimation.isPaused = false;
	osmDijkstraAnimation.isComplete = false;
	osmDijkstraAnimation.currentIndex = 0;
	osmDijkstraAnimation.exploredSegments = [];

	if (currentDijkstraResult && currentDijkstraResult.pathFound) {
		updateDijkstraUI('PATH FOUND');
	} else {
		updateDijkstraUI('WAITING');
	}
	console.log('↻ [Dijkstra Visualization] Reset exploration visualization.');
}

function clearSearchMarkers() {
	searchMarkers.forEach((marker) => {
		map.removeLayer(marker);
	});
	searchMarkers = [];
}

const playback = {
	isPlaying: false,
	progress: 0,
	coords: [],
	cumulativeDistances: [],
	totalDistanceKm: 0,
	marker: null,
	animFrameId: null,
	lastTimestamp: null,
};

function calculateDistanceBetweenCoords(lat1, lon1, lat2, lon2) {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

function updatePlaybackUI(traveledDistKm, percent, statusText) {
	const progressFill = document.querySelector('#playback-progress-fill');
	const percentText = document.querySelector('#playback-percent-text');
	const distText = document.querySelector('#playback-dist-text');
	const statusEl = document.querySelector('#playback-status-text');
	const playBtn = document.querySelector('#play-route-btn');
	const pauseBtn = document.querySelector('#pause-route-btn');

	if (progressFill) {
		progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
	}
	if (percentText) {
		percentText.textContent = `${Math.min(100, Math.max(0, Math.round(percent)))}%`;
	}
	if (distText) {
		distText.textContent = `${traveledDistKm.toFixed(2)} km / ${playback.totalDistanceKm.toFixed(2)} km`;
	}
	if (statusEl && statusText) {
		statusEl.textContent = statusText;
	}
	if (playBtn && pauseBtn) {
		if (playback.isPlaying) {
			playBtn.textContent = '▶ Playing...';
			playBtn.disabled = true;
			pauseBtn.disabled = false;
		} else {
			playBtn.textContent = playback.progress >= 1 ? '▶ Play Again' : (playback.progress > 0 ? '▶ Resume' : '▶ Play Route');
			playBtn.disabled = false;
			pauseBtn.disabled = true;
		}
	}
}

function getCoordAtProgress(progress) {
	if (playback.coords.length === 0) return null;
	if (progress <= 0 || playback.coords.length === 1) return { coord: playback.coords[0], traveledKm: 0 };
	if (progress >= 1) return { coord: playback.coords[playback.coords.length - 1], traveledKm: playback.totalDistanceKm };

	const totalGeoDist = playback.cumulativeDistances[playback.cumulativeDistances.length - 1];
	const targetGeoDist = progress * totalGeoDist;

	let i = 0;
	while (i < playback.cumulativeDistances.length - 1 && playback.cumulativeDistances[i + 1] < targetGeoDist) {
		i++;
	}

	const p1 = playback.coords[i];
	const p2 = playback.coords[Math.min(i + 1, playback.coords.length - 1)];
	const d1 = playback.cumulativeDistances[i];
	const d2 = playback.cumulativeDistances[Math.min(i + 1, playback.cumulativeDistances.length - 1)];
	const segLen = d2 - d1;
	const segFrac = segLen > 0 ? (targetGeoDist - d1) / segLen : 0;

	const lat = p1[0] + (p2[0] - p1[0]) * segFrac;
	const lon = p1[1] + (p2[1] - p1[1]) * segFrac;
	const traveledKm = progress * playback.totalDistanceKm;

	return { coord: [lat, lon], traveledKm };
}

function ensurePlaybackMarker() {
	if (!playback.marker && playback.coords.length > 0) {
		const vehicleIcon = L.divIcon({
			className: 'custom-playback-marker',
			html: `<div class="playback-marker-dot">🚗</div>`,
			iconSize: [32, 32],
			iconAnchor: [16, 16],
		});
		playback.marker = L.marker(playback.coords[0], {
			icon: vehicleIcon,
			zIndexOffset: 1000,
		}).addTo(map);
	}
}

function stopPlaybackAnimation() {
	playback.isPlaying = false;
	if (playback.animFrameId) {
		cancelAnimationFrame(playback.animFrameId);
		playback.animFrameId = null;
	}
	playback.lastTimestamp = null;
}

function resetPlayback() {
	stopPlaybackAnimation();
	playback.progress = 0;
	if (playback.marker) {
		map.removeLayer(playback.marker);
		playback.marker = null;
	}
	playback.coords = [];
	playback.cumulativeDistances = [];
	playback.totalDistanceKm = 0;
}

function animatePlayback(timestamp) {
	if (!playback.isPlaying) return;

	if (!playback.lastTimestamp) {
		playback.lastTimestamp = timestamp;
	}

	const delta = timestamp - playback.lastTimestamp;
	playback.lastTimestamp = timestamp;

	const durationMs = Math.max(6000, Math.min(18000, playback.coords.length * 35));
	playback.progress += delta / durationMs;

	if (playback.progress >= 1) {
		playback.progress = 1;
		stopPlaybackAnimation();
		const endPos = getCoordAtProgress(1);
		if (playback.marker && endPos) {
			playback.marker.setLatLng(endPos.coord);
		}
		updatePlaybackUI(playback.totalDistanceKm, 100, 'Route completed');
		return;
	}

	const currentPos = getCoordAtProgress(playback.progress);
	if (currentPos && playback.marker) {
		playback.marker.setLatLng(currentPos.coord);
	}

	const percent = playback.progress * 100;
	const traveledKm = currentPos ? currentPos.traveledKm : 0;
	updatePlaybackUI(traveledKm, percent, 'Playing route...');

	playback.animFrameId = requestAnimationFrame(animatePlayback);
}

function handlePlayRoute() {
	if (playback.coords.length === 0) return;

	if (playback.progress >= 1) {
		playback.progress = 0;
	}

	ensurePlaybackMarker();
	const initialPos = getCoordAtProgress(playback.progress);
	if (playback.marker && initialPos) {
		playback.marker.setLatLng(initialPos.coord);
	}

	playback.isPlaying = true;
	playback.lastTimestamp = null;
	updatePlaybackUI(
		playback.progress * playback.totalDistanceKm,
		playback.progress * 100,
		'Playing route...'
	);

	playback.animFrameId = requestAnimationFrame(animatePlayback);
}

function handlePauseRoute() {
	stopPlaybackAnimation();
	const currentPos = getCoordAtProgress(playback.progress);
	const traveledKm = currentPos ? currentPos.traveledKm : 0;
	updatePlaybackUI(traveledKm, playback.progress * 100, 'Paused');
}

function handleReplayRoute() {
	stopPlaybackAnimation();
	playback.progress = 0;
	ensurePlaybackMarker();
	if (playback.marker && playback.coords.length > 0) {
		playback.marker.setLatLng(playback.coords[0]);
	}
	updatePlaybackUI(0, 0, 'Ready to play');
	handlePlayRoute();
}

function clearRouteAnalysis() {
	if (routeAnalysis) {
		routeAnalysis.innerHTML = '';
		routeAnalysis.style.display = 'none';
	}
}

function clearRouteLayer() {
	if (activeGraphFetchController) {
		activeGraphFetchController.abort();
		activeGraphFetchController = null;
	}
	activeGraphRequestId++;
	resetPlayback();
	currentCalculatedRoutes = [];
	currentRoadNetworkGraph = null;
	currentDijkstraResult = null;
	clearOsmDijkstraVisualization();
	if (currentRouteLayer) {
		map.removeLayer(currentRouteLayer);
		currentRouteLayer = null;
	}
	if (alternativeRouteLayers && alternativeRouteLayers.length > 0) {
		alternativeRouteLayers.forEach((layer) => {
			map.removeLayer(layer);
		});
		alternativeRouteLayers = [];
	}
	clearRouteAnalysis();
}

function handleResetRouteSearch() {
	if (activeGraphFetchController) {
		activeGraphFetchController.abort();
		activeGraphFetchController = null;
	}
	activeGraphRequestId++;
	resetPlayback();
	clearOsmDijkstraVisualization();
	clearSearchMarkers();
	clearRouteLayer();
	pickedStartCoords = null;
	pickedDestCoords = null;
	setPickOnMapMode(false);
	if (placeFromInput) placeFromInput.value = '';
	if (placeDestInput) placeDestInput.value = '';
	if (placeSearchStatus) {
		placeSearchStatus.textContent = '';
	}
	if (placeFromInput) placeFromInput.focus();
}

function handleClearMapSelection() {
	if (activeGraphFetchController) {
		activeGraphFetchController.abort();
		activeGraphFetchController = null;
	}
	activeGraphRequestId++;
	resetPlayback();
	clearOsmDijkstraVisualization();
	pickedStartCoords = null;
	pickedDestCoords = null;
	clearSearchMarkers();
	clearRouteLayer();
	if (placeFromInput) placeFromInput.value = '';
	if (placeDestInput) placeDestInput.value = '';
	if (placeSearchStatus) {
		placeSearchStatus.textContent = isPickOnMapMode
			? 'Pick on Map: Click the map to select Start location.'
			: '';
	}
}

function setPickOnMapMode(active) {
	isPickOnMapMode = active;
	if (isPickOnMapMode) {
		pickOnMapBtn.classList.add('active');
		pickOnMapBtn.textContent = '📍 Pick on Map: On';
		map.getContainer().classList.add('map-picking-active');
		if (!pickedStartCoords) {
			placeSearchStatus.textContent = 'Pick on Map: Click the map to select Start location.';
		} else if (!pickedDestCoords) {
			placeSearchStatus.textContent = 'Start selected. Click the map to select Destination.';
		}
		placeSearchStatus.style.color = '#2563eb';
	} else {
		pickOnMapBtn.classList.remove('active');
		pickOnMapBtn.textContent = '📍 Pick on Map';
		map.getContainer().classList.remove('map-picking-active');
	}
}

const ROUTE_COLORS = [
	{ name: 'Route 1 (Shortest)', color: '#2563eb', weight: 6, opacity: 0.95 },
	{ name: 'Route 2', color: '#a855f7', weight: 3.5, opacity: 0.75 },
	{ name: 'Route 3', color: '#06b6d4', weight: 3.5, opacity: 0.75 },
	{ name: 'Route 4', color: '#f59e0b', weight: 3.5, opacity: 0.75 },
];

function renderRouteAnalysis(fromResult, destResult, routeData) {
	if (!routeAnalysis) return;

	const primaryRoute = routeData.routes && routeData.routes[0];
	if (primaryRoute && primaryRoute.coordinates && primaryRoute.coordinates.length > 0) {
		playback.coords = primaryRoute.coordinates;
		playback.totalDistanceKm = parseFloat(routeData.distanceKm) || 0;

		const cumulative = [0];
		let runningTotal = 0;
		for (let i = 1; i < playback.coords.length; i++) {
			const seg = calculateDistanceBetweenCoords(
				playback.coords[i - 1][0],
				playback.coords[i - 1][1],
				playback.coords[i][0],
				playback.coords[i][1]
			);
			runningTotal += seg;
			cumulative.push(runningTotal);
		}
		playback.cumulativeDistances = cumulative;
	}

	const totalRoutesCount = 1 + (routeData.alternatives ? routeData.alternatives.length : 0);

	routeAnalysis.style.display = 'block';
	routeAnalysis.innerHTML = `
		<div class="route-analysis-header">
			<div class="route-analysis-title-group">
				<span class="route-analysis-badge">Real-World Road-Network Experiment</span>
				<h3 class="route-analysis-title">Map Experiment Route Analysis</h3>
			</div>
		</div>

		<!-- DIJKSTRA ROAD-NETWORK EXPLORER CARD -->
		<div class="dijkstra-control-card">
			<div class="dijkstra-card-header">
				<div class="dijkstra-title-group">
					<span class="dijkstra-badge">Dijkstra Visualizer</span>
					<h4 class="route-legend-heading">Real OSM Road-Network Traversal</h4>
					<span id="dijkstra-status-badge" class="status-badge status-badge-waiting">Preparing...</span>
				</div>
				<div class="dijkstra-buttons">
					<button id="visualize-dijkstra-btn" class="app-btn btn-visualize-dijkstra" type="button" disabled>
						<span>⚡ Visualize Dijkstra</span>
					</button>
					<button id="pause-dijkstra-btn" class="app-btn" type="button" disabled>
						⏸ Pause
					</button>
					<button id="reset-dijkstra-btn" class="app-btn" type="button">
						↻ Reset
					</button>
				</div>
			</div>

			<!-- Dynamic Status and Shortest Distance -->
			<div class="dijkstra-status-banner">
				<div class="status-banner-left">
					<span class="status-indicator-dot"></span>
					<span id="dijkstra-status-text" class="status-banner-text">Preparing Dijkstra...</span>
				</div>
				<span id="dijkstra-dist-text" class="status-banner-dist">Calculated Shortest: -- km</span>
			</div>

			<!-- Progress Bar and Settled Nodes Metric -->
			<div class="dijkstra-progress-wrapper">
				<div class="dijkstra-progress-bar-bg">
					<div id="dijkstra-progress-fill" class="dijkstra-progress-fill" style="width: 0%;"></div>
				</div>
				<div class="dijkstra-metrics">
					<span id="dijkstra-nodes-explored">Explored: 0 / 0 nodes</span>
					<span id="dijkstra-phase-text">OSM Subgraph Traversal Animation</span>
				</div>
			</div>

			<!-- Visual Legend -->
			<div class="dijkstra-legend-wrapper">
				<div class="dijkstra-legend-title">Visual Map Legend</div>
				<div class="dijkstra-legend-grid">
					<div class="legend-chip">
						<span class="legend-chip-color legend-road-normal"></span>
						<span class="legend-chip-label">Normal road</span>
					</div>
					<div class="legend-chip">
						<span class="legend-chip-color legend-road-explored"></span>
						<span class="legend-chip-label">Explored by Dijkstra</span>
					</div>
					<div class="legend-chip">
						<span class="legend-chip-color legend-road-final"></span>
						<span class="legend-chip-label">Final shortest path</span>
					</div>
					<div class="legend-chip">
						<span class="legend-marker-badge legend-badge-start">S</span>
						<span class="legend-chip-label">START</span>
					</div>
					<div class="legend-chip">
						<span class="legend-marker-badge legend-badge-dest">D</span>
						<span class="legend-chip-label">DESTINATION</span>
					</div>
				</div>
			</div>
		</div>

		<!-- Simultaneous Routes Legend -->
		<div class="route-legend-card">
			<div class="route-legend-header">
				<span class="legend-badge">Simultaneous Routes</span>
				<h4 class="route-legend-heading">Calculated Driving Routes (${totalRoutesCount} Available)</h4>
			</div>
			<div class="route-legend-grid">
				<div class="route-legend-item" style="border-left-color: ${ROUTE_COLORS[0].color};">
					<div class="legend-route-info">
						<span class="route-color-dot" style="background-color: ${ROUTE_COLORS[0].color}; box-shadow: 0 0 8px ${ROUTE_COLORS[0].color};"></span>
						<span class="route-name">Route 1 (Shortest)</span>
					</div>
					<div class="legend-route-stats">
						<span class="stat-dist">${routeData.distanceKm} km</span>
						<span class="stat-time">${routeData.durationMin} mins</span>
					</div>
				</div>
				${(routeData.alternatives || []).map((alt, idx) => {
					const colorObj = ROUTE_COLORS[idx + 1] || { color: '#64748b' };
					return `
						<div class="route-legend-item" style="border-left-color: ${colorObj.color};">
							<div class="legend-route-info">
								<span class="route-color-dot" style="background-color: ${colorObj.color};"></span>
								<span class="route-name">Route ${alt.index + 1} (Alternative)</span>
							</div>
							<div class="legend-route-stats">
								<span class="stat-dist">${alt.distanceKm} km</span>
								<span class="stat-time">${alt.durationMin} mins</span>
							</div>
						</div>
					`;
				}).join('')}
			</div>
		</div>

		<div class="playback-control-card">
			<div class="playback-header">
				<div class="playback-title-group">
					<span class="playback-badge">Route Playback</span>
					<span id="playback-status-text" class="playback-status">Ready to play</span>
				</div>
				<div class="playback-buttons">
					<button id="play-route-btn" class="app-btn btn-primary" type="button">
						▶ Play Route
					</button>
					<button id="pause-route-btn" class="app-btn" type="button" disabled>
						⏸ Pause
					</button>
					<button id="replay-route-btn" class="app-btn" type="button">
						↻ Replay
					</button>
				</div>
			</div>

			<div class="playback-progress-wrapper">
				<div class="playback-progress-bar-bg">
					<div id="playback-progress-fill" class="playback-progress-fill" style="width: 0%;"></div>
				</div>
				<div class="playback-metrics">
					<span id="playback-percent-text">0%</span>
					<span id="playback-dist-text">0.00 km / ${routeData.distanceKm} km</span>
				</div>
			</div>
		</div>

		<div class="route-analysis-grid">
			<div class="analysis-card location-card">
				<div class="analysis-card-label">📍 Start Location</div>
				<div class="analysis-location-name">${escapeHtml(fromResult.name || 'Start')}</div>
				<div class="analysis-location-detail" title="${escapeHtml(fromResult.displayName)}">${escapeHtml(fromResult.displayName)}</div>
			</div>

			<div class="analysis-card location-card">
				<div class="analysis-card-label">🏁 Destination</div>
				<div class="analysis-location-name">${escapeHtml(destResult.name || 'Destination')}</div>
				<div class="analysis-location-detail" title="${escapeHtml(destResult.displayName)}">${escapeHtml(destResult.displayName)}</div>
			</div>

			<div class="analysis-card stat-card">
				<div class="analysis-card-label">🚗 OSRM Driving Distance</div>
				<div class="analysis-stat-value">${routeData.distanceKm} <span class="analysis-stat-unit">km</span></div>
			</div>

			<div class="analysis-card stat-card">
				<div class="analysis-card-label">⏱️ Estimated Driving Time</div>
				<div class="analysis-stat-value">${routeData.durationMin} <span class="analysis-stat-unit">mins</span></div>
			</div>

			<div class="analysis-card stat-card">
				<div class="analysis-card-label">📐 Route Geometry Points</div>
				<div class="analysis-stat-value">${routeData.pointCount.toLocaleString()} <span class="analysis-stat-unit">points</span></div>
			</div>
		</div>

		<div class="route-explanation-banner">
			<div class="explanation-icon">💡</div>
			<div class="explanation-text">
				The routes shown above follow the real road network calculated simultaneously by OSRM. AlgoPath explores the underlying OpenStreetMap road graph step-by-step using Dijkstra's algorithm to reveal how the optimal route is discovered through street topology.
			</div>
		</div>
	`;

	// Attach Playback event listeners
	const playBtn = routeAnalysis.querySelector('#play-route-btn');
	if (playBtn) {
		playBtn.addEventListener('click', handlePlayRoute);
	}

	const pauseBtn = routeAnalysis.querySelector('#pause-route-btn');
	if (pauseBtn) {
		pauseBtn.addEventListener('click', handlePauseRoute);
	}

	const replayBtn = routeAnalysis.querySelector('#replay-route-btn');
	if (replayBtn) {
		replayBtn.addEventListener('click', handleReplayRoute);
	}

	// Attach Dijkstra Animation event listeners
	const visualizeBtn = routeAnalysis.querySelector('#visualize-dijkstra-btn');
	if (visualizeBtn) {
		visualizeBtn.addEventListener('click', startOsmDijkstraAnimation);
	}

	const pauseDijkstraBtn = routeAnalysis.querySelector('#pause-dijkstra-btn');
	if (pauseDijkstraBtn) {
		pauseDijkstraBtn.addEventListener('click', pauseOsmDijkstraAnimation);
	}

	const resetDijkstraBtn = routeAnalysis.querySelector('#reset-dijkstra-btn');
	if (resetDijkstraBtn) {
		resetDijkstraBtn.addEventListener('click', resetOsmDijkstraAnimation);
	}

	updateDijkstraUI();
}

async function calculateAndDisplayRoute(fromResult, destResult, boundsGroup = [], warningMsg = '') {
	placeSearchStatus.textContent = 'Calculating driving routes...';
	placeSearchStatus.style.color = '#2563eb';

	try {
		const routeData = await fetchOSRMRoute(fromResult, destResult);

		// Remove old route layer
		if (currentRouteLayer) {
			map.removeLayer(currentRouteLayer);
			currentRouteLayer = null;
		}
		if (alternativeRouteLayers && alternativeRouteLayers.length > 0) {
			alternativeRouteLayers.forEach((layer) => {
				map.removeLayer(layer);
			});
			alternativeRouteLayers = [];
		}

		const allRouteLayers = [];
		if (boundsGroup && boundsGroup.length > 0) {
			boundsGroup.forEach((m) => allRouteLayers.push(m));
		}

		// Draw alternative routes underneath
		if (routeData.alternatives && routeData.alternatives.length > 0) {
			alternativeRouteLayers = routeData.alternatives.map((alt, idx) => {
				const colorConfig = ROUTE_COLORS[idx + 1] || { color: '#94a3b8', weight: 3.5, opacity: 0.75 };
				const altLayer = L.geoJSON(alt.geometry, {
					style: {
						color: colorConfig.color,
						weight: colorConfig.weight,
						opacity: colorConfig.opacity,
						lineJoin: 'round',
					},
				}).addTo(map);

				altLayer.bindPopup(
					`<strong>Route ${alt.index + 1} (Alternative)</strong><br/>Distance: ${alt.distanceKm} km<br/>Est. Time: ${alt.durationMin} mins`
				);
				allRouteLayers.push(altLayer);
				return altLayer;
			});
		}

		// Draw primary / shortest route visually strongest on top
		currentRouteLayer = L.geoJSON(routeData.geometry, {
			style: {
				color: ROUTE_COLORS[0].color,
				weight: ROUTE_COLORS[0].weight,
				opacity: ROUTE_COLORS[0].opacity,
				lineJoin: 'round',
			},
		}).addTo(map);
		currentRouteLayer.bindPopup(
			`<strong>Route 1 (Shortest Route)</strong><br/>Distance: ${routeData.distanceKm} km<br/>Est. Time: ${routeData.durationMin} mins`
		);
		allRouteLayers.push(currentRouteLayer);

		// Automatically fit map bounds to the route network
		const groupFeature = L.featureGroup(allRouteLayers);
		map.fitBounds(groupFeature.getBounds().pad(0.15));

		const totalCount = 1 + (routeData.alternatives ? routeData.alternatives.length : 0);
		placeSearchStatus.textContent = warningMsg || (
			routeData.alternatives && routeData.alternatives.length > 0
				? `Displayed ${totalCount} routes simultaneously (Route 1 shortest).`
				: 'Driving route found successfully.'
		);
		placeSearchStatus.style.color = '#15803d';

		// Useful console logging
		console.log('--- Map Experiment Route Analysis ---');
		console.log('Start location:', fromResult.displayName || fromResult.name);
		console.log('Destination:', destResult.displayName || destResult.name);
		console.log('Shortest Route distance:', `${routeData.distanceKm} km`);
		console.log('Shortest Route duration:', `${routeData.durationMin} mins`);
		console.log('Shortest Geometry points:', routeData.pointCount);
		console.log('Total routes rendered simultaneously:', totalCount);

		renderRouteAnalysis(fromResult, destResult, routeData);
		updateDijkstraUI('LOADING GRAPH', 'Fetching OSM road network...');

		// Cancel any previous in-flight graph extraction
		if (activeGraphFetchController) {
			activeGraphFetchController.abort();
		}
		activeGraphFetchController = new AbortController();
		const currentRequestId = ++activeGraphRequestId;
		const graphSignal = activeGraphFetchController.signal;

		// Prepare & extract the bounded OSM road-network graph for the selected region
		// and run Dijkstra's shortest-path algorithm across the actual road graph
		const primaryCoordinates = routeData.routes && routeData.routes[0] ? routeData.routes[0].coordinates : null;
		fetchRoadNetworkGraph(
			fromResult,
			destResult,
			primaryCoordinates,
			(progressMsg) => {
				if (currentRequestId === activeGraphRequestId) {
					updateDijkstraUI('LOADING GRAPH', progressMsg);
				}
			},
			graphSignal
		)
			.then(async (graph) => {
				if (currentRequestId !== activeGraphRequestId || graphSignal.aborted) return;
				if (graph && graph.startNode && graph.destNode) {
					updateDijkstraUI('LOADING GRAPH', 'Computing Dijkstra shortest path...');
					const dijkstraResult = await computeDijkstraOnOsmGraph(
						graph,
						graph.startNode.id,
						graph.destNode.id,
						routeData.distanceKm
					);
					if (currentRequestId !== activeGraphRequestId || graphSignal.aborted) return;
					currentDijkstraResult = dijkstraResult;
					logDijkstraStats(dijkstraResult, graph);

					if (dijkstraResult && dijkstraResult.pathFound) {
						updateDijkstraUI('PATH FOUND');
					} else {
						updateDijkstraUI('ERROR', 'Dijkstra explored reachable network, but could not reach destination.');
					}
				} else {
					updateDijkstraUI('ERROR', 'Could not map start/destination to road network.');
				}
			})
			.catch((err) => {
				if (currentRequestId !== activeGraphRequestId || graphSignal.aborted) return;
				console.warn('[OSM Graph] Road network background fetch notice:', err.message);
				currentRoadNetworkGraph = null;
				currentDijkstraResult = null;
				const is504 = err && err.message && (err.message.includes('504') || err.message.toLowerCase().includes('timeout'));
				const message = is504
					? 'Overpass API timed out (504). Please click "Find Route" to retry.'
					: 'Overpass servers busy. You can retry with "Find Route".';
				updateDijkstraUI('ERROR', message);
			});

		return true;
	} catch (routeErr) {
		console.error('Routing error:', routeErr);
		clearRouteAnalysis();
		if (boundsGroup && boundsGroup.length > 0) {
			const group = L.featureGroup(boundsGroup);
			map.fitBounds(group.getBounds().pad(0.2));
		}
		placeSearchStatus.textContent = 'Locations selected, but could not calculate a driving route from OSRM.';
		placeSearchStatus.style.color = '#b45309';
		return false;
	}
}

async function handleFindPlaces() {
	const fromQuery = placeFromInput.value.trim();
	const destQuery = placeDestInput.value.trim();

	if (!fromQuery && !destQuery) {
		placeSearchStatus.textContent = 'Please enter at least one place name.';
		placeSearchStatus.style.color = '#b91c1c';
		clearRouteLayer();
		return;
	}

	setPickOnMapMode(false);
	pickedStartCoords = null;
	pickedDestCoords = null;

	placeSearchStatus.textContent = 'Searching places...';
	placeSearchStatus.style.color = '#4b5563';
	clearRouteLayer();
	findPlacesBtn.disabled = true;

	try {
		clearSearchMarkers();

		const [fromResult, destResult] = await Promise.all([
			fromQuery ? geocodePlace(fromQuery) : Promise.resolve(null),
			destQuery ? geocodePlace(destQuery) : Promise.resolve(null),
		]);

		const notFound = [];
		if (fromQuery && !fromResult) notFound.push(`"From" (${fromQuery})`);
		if (destQuery && !destResult) notFound.push(`"Destination" (${destQuery})`);

		if (notFound.length > 0 && !fromResult && !destResult) {
			placeSearchStatus.textContent = `Could not find location for: ${notFound.join(' and ')}.`;
			placeSearchStatus.style.color = '#b91c1c';
			findPlacesBtn.disabled = false;
			return;
		}

		const boundsGroup = [];

		if (fromResult) {
			const marker = L.marker([fromResult.lat, fromResult.lon], {
				icon: getStartMarkerIcon(),
				zIndexOffset: 500,
			})
				.addTo(map)
				.bindPopup(`<strong>Start (S):</strong> ${fromResult.name}<br/><small>${fromResult.displayName}</small>`);
			searchMarkers.push(marker);
			boundsGroup.push(marker);
		}

		if (destResult) {
			const marker = L.marker([destResult.lat, destResult.lon], {
				icon: getDestMarkerIcon(),
				zIndexOffset: 500,
			})
				.addTo(map)
				.bindPopup(`<strong>Destination (D):</strong> ${destResult.name}<br/><small>${destResult.displayName}</small>`);
			searchMarkers.push(marker);
			boundsGroup.push(marker);
		}

		if (fromResult && destResult) {
			const warningMsg = notFound.length
				? 'Found locations with warnings. Route displayed below.'
				: 'Driving route found successfully.';
			await calculateAndDisplayRoute(fromResult, destResult, boundsGroup, warningMsg);
		} else if (boundsGroup.length === 1) {
			clearRouteAnalysis();
			const target = boundsGroup[0].getLatLng();
			map.setView(target, 13);
			boundsGroup[0].openPopup();
			if (notFound.length > 0) {
				placeSearchStatus.textContent = `Found one location. Could not find: ${notFound.join(', ')}.`;
				placeSearchStatus.style.color = '#b45309';
			} else {
				placeSearchStatus.textContent = `Found location successfully. Enter both locations to calculate a route.`;
				placeSearchStatus.style.color = '#15803d';
			}
		}
	} catch (err) {
		console.error('Error during geocoding/routing:', err);
		clearRouteAnalysis();
		placeSearchStatus.textContent = 'An error occurred while searching. Please try again.';
		placeSearchStatus.style.color = '#b91c1c';
	} finally {
		findPlacesBtn.disabled = false;
	}
}

// Map Click Handler for "Pick on Map" mode
map.on('click', async (e) => {
	if (!isPickOnMapMode) {
		return;
	}

	const lat = parseFloat(e.latlng.lat.toFixed(5));
	const lon = parseFloat(e.latlng.lng.toFixed(5));

	if (!pickedStartCoords) {
		clearRouteLayer();
		clearSearchMarkers();
		pickedStartCoords = {
			name: `Start Point (${lat}, ${lon})`,
			displayName: `Coordinates: ${lat}, ${lon}`,
			lat,
			lon,
		};
		placeFromInput.value = `${lat}, ${lon}`;

		const marker = L.marker([lat, lon], {
			icon: getStartMarkerIcon(),
			zIndexOffset: 500,
		})
			.addTo(map)
			.bindPopup(`<strong>Start (S):</strong> ${pickedStartCoords.name}<br/><small>${pickedStartCoords.displayName}</small>`)
			.openPopup();
		searchMarkers.push(marker);

		placeSearchStatus.textContent = 'Start selected. Click the map to select Destination.';
		placeSearchStatus.style.color = '#2563eb';
	} else if (!pickedDestCoords) {
		pickedDestCoords = {
			name: `Destination Point (${lat}, ${lon})`,
			displayName: `Coordinates: ${lat}, ${lon}`,
			lat,
			lon,
		};
		placeDestInput.value = `${lat}, ${lon}`;

		const marker = L.marker([lat, lon], {
			icon: getDestMarkerIcon(),
			zIndexOffset: 500,
		})
			.addTo(map)
			.bindPopup(`<strong>Destination (D):</strong> ${pickedDestCoords.name}<br/><small>${pickedDestCoords.displayName}</small>`)
			.openPopup();
		searchMarkers.push(marker);

		setPickOnMapMode(false);

		await calculateAndDisplayRoute(pickedStartCoords, pickedDestCoords, searchMarkers);
	}
});

pickOnMapBtn.addEventListener('click', () => {
	setPickOnMapMode(!isPickOnMapMode);
});

clearMapSelectionBtn.addEventListener('click', () => {
	handleClearMapSelection();
});

findPlacesBtn.addEventListener('click', handleFindPlaces);

const sidebarDijkstraBtn = document.querySelector('#sidebar-visualize-dijkstra-btn');
if (sidebarDijkstraBtn) {
	sidebarDijkstraBtn.addEventListener('click', startOsmDijkstraAnimation);
}

placeFromInput.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		handleFindPlaces();
	}
});

placeDestInput.addEventListener('keydown', (e) => {
	if (e.key === 'Enter') {
		handleFindPlaces();
	}
});

// Navigation scroll spy
const navLinks = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('section.dashboard-card');

window.addEventListener('scroll', () => {
	let current = '';
	sections.forEach((section) => {
		const sectionTop = section.offsetTop - 100;
		if (window.scrollY >= sectionTop) {
			current = section.getAttribute('id');
		}
	});

	navLinks.forEach((link) => {
		link.classList.remove('active');
		if (link.getAttribute('href') === `#${current}`) {
			link.classList.add('active');
		}
	});
});