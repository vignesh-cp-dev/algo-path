const svgNS = 'http://www.w3.org/2000/svg';

// Core graph state: nodes and edges are kept separate on purpose.
const graph = {
	nodes: [
		{ id: 'A', x: 140, y: 110 },
		{ id: 'B', x: 380, y: 90 },
		{ id: 'C', x: 560, y: 240 },
		{ id: 'D', x: 260, y: 290 },
	],
	edges: [],
};

const ui = {
	selectedNodeId: null,
	draggingNodeId: null,
	addNodeMode: false,
	addEdgeMode: false,
	edgeSourceNodeId: null,
};

const app = document.querySelector('#app');

app.innerHTML = `
	<div style="max-width: 980px; margin: 0 auto; padding: 24px; box-sizing: border-box;">
		<h1 style="margin: 0 0 8px; font-size: 2rem;">SVG Graph Visualizer</h1>
		<p style="margin: 0 0 18px; opacity: 0.8;">
			Use Add Node mode to create new nodes, then drag them to reposition.
		</p>

		<div style="display: flex; align-items: center; gap: 12px; margin: 0 0 14px;">
			<button
				id="add-node-btn"
				type="button"
				style="padding: 8px 12px; border: 1px solid #0f172a; border-radius: 8px; background: #ffffff; cursor: pointer;"
			>
				Add Node: Off
			</button>
			<button
				id="add-edge-btn"
				type="button"
				style="padding: 8px 12px; border: 1px solid #0f172a; border-radius: 8px; background: #ffffff; cursor: pointer;"
			>
				Add Edge: Off
			</button>
			<span id="mode-label" style="font-size: 0.95rem; opacity: 0.8;">Mode: Select / Drag</span>
		</div>

		<svg
			id="graph-svg"
			viewBox="0 0 760 420"
			style="width: 100%; border: 1px solid #d2d2d2; border-radius: 10px; background: #fffdf9; touch-action: none;"
		></svg>
	</div>
`;

const svg = document.querySelector('#graph-svg');
const addNodeBtn = document.querySelector('#add-node-btn');
const addEdgeBtn = document.querySelector('#add-edge-btn');
const modeLabel = document.querySelector('#mode-label');

function createSvgElement(tag, attrs = {}) {
	const element = document.createElementNS(svgNS, tag);
	Object.entries(attrs).forEach(([key, value]) => {
		element.setAttribute(key, String(value));
	});
	return element;
}

function getNodeById(id) {
	return graph.nodes.find((node) => node.id === id);
}

function indexToNodeId(index) {
	let value = index + 1;
	let id = '';

	while (value > 0) {
		const remainder = (value - 1) % 26;
		id = String.fromCharCode(65 + remainder) + id;
		value = Math.floor((value - 1) / 26);
	}

	return id;
}

function getNextNodeId() {
	const usedIds = new Set(graph.nodes.map((node) => node.id));
	let index = 0;

	while (usedIds.has(indexToNodeId(index))) {
		index += 1;
	}

	return indexToNodeId(index);
}

function addNodeAtPosition(x, y) {
	const id = getNextNodeId();
	const newNode = {
		id,
		x: Math.max(24, Math.min(736, x)),
		y: Math.max(24, Math.min(396, y)),
	};

	graph.nodes.push(newNode);
	ui.selectedNodeId = id;
}

function toSvgPoint(clientX, clientY) {
	const point = svg.createSVGPoint();
	point.x = clientX;
	point.y = clientY;
	const transformedPoint = point.matrixTransform(svg.getScreenCTM().inverse());
	return { x: transformedPoint.x, y: transformedPoint.y };
}

function renderNodes() {
	graph.nodes.forEach((node) => {
		const isSelected = ui.selectedNodeId === node.id;
		const isEdgeSource = ui.edgeSourceNodeId === node.id;

		const nodeGroup = createSvgElement('g', {
			'data-node-id': node.id,
			style: 'cursor: grab;',
		});

		const circle = createSvgElement('circle', {
			cx: node.x,
			cy: node.y,
			r: 24,
			fill: isEdgeSource ? '#f59e0b' : isSelected ? '#0ea5e9' : '#22c55e',
			stroke: isEdgeSource ? '#b45309' : '#0f172a',
			'stroke-width': isEdgeSource || isSelected ? 3 : 2,
			'data-node-id': node.id,
		});

		const label = createSvgElement('text', {
			x: node.x,
			y: node.y + 5,
			'text-anchor': 'middle',
			'font-size': 14,
			'font-family': 'sans-serif',
			'font-weight': 'bold',
			fill: '#ffffff',
			'pointer-events': 'none',
		});
		label.textContent = node.id;

		nodeGroup.appendChild(circle);
		nodeGroup.appendChild(label);
		svg.appendChild(nodeGroup);
	});
}

function renderEdges() {
	graph.edges.forEach((edge) => {
		const source = getNodeById(edge.source);
		const target = getNodeById(edge.target);

		if (!source || !target) {
			return;
		}

		const line = createSvgElement('line', {
			x1: source.x,
			y1: source.y,
			x2: target.x,
			y2: target.y,
			stroke: '#64748b',
			'stroke-width': 2,
			'pointer-events': 'none',
		});
		const weight = createSvgElement('text', {
			x: (source.x + target.x) / 2,
			y: (source.y + target.y) / 2 - 8,
			'text-anchor': 'middle',
			'font-size': 13,
			'font-family': 'sans-serif',
			'font-weight': 'bold',
			fill: '#0f172a',
			'pointer-events': 'none',
		});
		weight.textContent = String(edge.weight);
		svg.appendChild(line);
		svg.appendChild(weight);
	});
}

function renderGraph() {
	svg.replaceChildren();
	renderEdges();
	renderNodes();
}

function updateModeUi() {
	addNodeBtn.textContent = `Add Node: ${ui.addNodeMode ? 'On' : 'Off'}`;
	addNodeBtn.style.background = ui.addNodeMode ? '#0f172a' : '#ffffff';
	addNodeBtn.style.color = ui.addNodeMode ? '#ffffff' : '#0f172a';
	addEdgeBtn.textContent = `Add Edge: ${ui.addEdgeMode ? 'On' : 'Off'}`;
	addEdgeBtn.style.background = ui.addEdgeMode ? '#0f172a' : '#ffffff';
	addEdgeBtn.style.color = ui.addEdgeMode ? '#ffffff' : '#0f172a';
	modeLabel.textContent = ui.addNodeMode
		? 'Mode: Add Node'
		: ui.addEdgeMode
			? ui.edgeSourceNodeId
				? `Mode: Add Edge (source: ${ui.edgeSourceNodeId})`
				: 'Mode: Add Edge (select source)'
			: 'Mode: Select / Drag';
}

function hasEdgeBetween(sourceId, targetId) {
	return graph.edges.some(
		(edge) =>
			(edge.source === sourceId && edge.target === targetId) ||
			(edge.source === targetId && edge.target === sourceId),
	);
}

function addEdgeBetween(sourceId, targetId) {
	if (sourceId === targetId || hasEdgeBetween(sourceId, targetId)) {
		return false;
	}

	const input = window.prompt(`Enter a positive weight for edge ${sourceId}-${targetId}:`);
	const weight = Number(input);

	if (input === null || input.trim() === '' || !Number.isFinite(weight) || weight <= 0) {
		return false;
	}

	graph.edges.push({ source: sourceId, target: targetId, weight });
	return true;
}

function onPointerDown(event) {
	const target = event.target;
	if (!(target instanceof SVGElement)) {
		return;
	}

	const nodeId = target.getAttribute('data-node-id');

	if (ui.addNodeMode && !nodeId) {
		const { x, y } = toSvgPoint(event.clientX, event.clientY);
		addNodeAtPosition(x, y);
		renderGraph();
		return;
	}

	if (ui.addEdgeMode) {
		if (!nodeId) {
			return;
		}

		if (!ui.edgeSourceNodeId) {
			ui.edgeSourceNodeId = nodeId;
			ui.selectedNodeId = nodeId;
		} else if (addEdgeBetween(ui.edgeSourceNodeId, nodeId)) {
			ui.selectedNodeId = nodeId;
			ui.edgeSourceNodeId = null;
		}

		updateModeUi();
		renderGraph();
		return;
	}

	if (!nodeId) {
		ui.selectedNodeId = null;
		renderGraph();
		return;
	}

	ui.selectedNodeId = nodeId;
	ui.draggingNodeId = nodeId;
	svg.setPointerCapture(event.pointerId);
	renderGraph();
}

function onPointerMove(event) {
	if (!ui.draggingNodeId) {
		return;
	}

	const activeNode = getNodeById(ui.draggingNodeId);
	if (!activeNode) {
		return;
	}

	const { x, y } = toSvgPoint(event.clientX, event.clientY);
	activeNode.x = Math.max(24, Math.min(736, x));
	activeNode.y = Math.max(24, Math.min(396, y));
	renderGraph();
}

function onPointerUp(event) {
	if (ui.draggingNodeId) {
		ui.draggingNodeId = null;
		svg.releasePointerCapture(event.pointerId);
	}
}

addNodeBtn.addEventListener('click', () => {
	ui.addNodeMode = !ui.addNodeMode;
	if (ui.addNodeMode) {
		ui.addEdgeMode = false;
		ui.edgeSourceNodeId = null;
	}
	updateModeUi();
});

addEdgeBtn.addEventListener('click', () => {
	ui.addEdgeMode = !ui.addEdgeMode;
	ui.addNodeMode = false;
	ui.edgeSourceNodeId = null;
	updateModeUi();
	renderGraph();
});

svg.addEventListener('pointerdown', onPointerDown);
svg.addEventListener('pointermove', onPointerMove);
svg.addEventListener('pointerup', onPointerUp);
svg.addEventListener('pointerleave', onPointerUp);

updateModeUi();
renderGraph();
