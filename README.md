# AlgoPath 🚀

An interactive graph and real-world road pathfinding visualizer built to understand how graph algorithms work through step-by-step visualizations.

## 🚀 Live Demo

🔗 **[https://algo-path-jade.vercel.app/](https://algo-path-jade.vercel.app/)**

---

## ✨ Features

- **Interactive Graph Visualization**: Create, drag, reposition, and delete custom graph nodes on an intuitive canvas.
- **Dynamic Weighted Edges**: Connect nodes with weighted edges and edit weights on the fly.
- **Custom Start & Destination**: Easily designate source and target nodes for path calculation.
- **Step-by-Step Dijkstra Visualization**: Watch Dijkstra's algorithm explore nodes, relax edges, and find the shortest path with play, pause, step-by-step, and auto-run modes.
- **Shortest Path Highlighting**: Clear visual backtracking and highlighting of the optimal path once reached.
- **Real-World Route Visualization**: Seamless integration with OpenStreetMap to test graph traversal on actual geographical networks.
- **OSM Road-Network Graph Traversal**: Convert road networks into traversable graph representations.
- **Compare Calculated vs. OSRM Driving Distance**: Compare calculated Dijkstra shortest distances directly with OSRM (Open Source Routing Machine) driving routes.
- **Animated Exploration of Road Network**: Step through road-network frontier expansions with animated progress.
- **Distinct Map Markers**: Clean visual differentiation for starting points, intermediate steps, and destinations.
- **Performance Optimization for Large Road Graphs**: Non-blocking algorithm execution using background Web Workers for smooth UI responsiveness even on large graphs.

---

## 🧠 Algorithms & Concepts

- **Dijkstra's Shortest Path Algorithm**: Greedy pathfinding algorithm ensuring the optimal path in graphs with non-negative edge weights.
- **Weighted Graphs**: Representation of networks where edges carry specific traversal costs or distances.
- **Adjacency Lists**: Efficient graph representation with node adjacency lists and weight mappings.
- **Priority Queue / Min Heap**: Fast lookup and extraction of the minimum distance unvisited node.
- **Shortest Path Reconstruction**: Backtracking predecessors to extract and highlight the final path.
- **Graph Traversal**: Systematic exploration of vertices and edge relaxation.
- **Real-World Road-Network Graphs**: Modeling physical streets, intersections, and coordinates into algorithmic graph structures.

---

## 🗺️ Real-World Routing

The **Map Experiment** bridges abstract computer science theory with practical real-world navigation:
- Extracts actual road network geometry and intersection topologies using **OpenStreetMap** and **OSRM**.
- Constructs an in-memory graph of road segments and intersections.
- Visualizes Dijkstra's traversal over the road graph live on an interactive Leaflet map.
- Measures and compares the calculated Dijkstra shortest path with practical OSRM turn-by-turn driving distances.

---

## 🛠️ Tech Stack

- **JavaScript (ES6+)**: Core logic, graph data structures, and algorithm execution.
- **HTML5 & CSS3**: Modern glassmorphism UI, interactive controls, and responsive layout.
- **OpenStreetMap**: Open-source geographical mapping data.
- **Leaflet**: Lightweight, mobile-friendly interactive map rendering.
- **OSRM (Open Source Routing Machine)**: High-performance routing engine for real-world road networks.
- **Vite**: Fast frontend tooling and development server.
- **Web Workers**: Background multithreading for heavy graph calculations.

---

## 📂 Project Structure

```text
algo-path/
├── public/                # Static assets, icons, and map markers
├── src/
│   ├── dijkstra.js        # Core Dijkstra implementation and step-by-step generator
│   ├── dijkstraWorker.js  # Dedicated Web Worker for background road-network graph traversal
│   ├── graph.js           # Graph data structure definitions and edge/node helpers
│   ├── main.js            # Main application controller, Leaflet map integration & UI logic
│   └── style.css          # Design system, theme styling, control panels, and animations
├── index.html             # Application entry point and layout shell
└── package.json           # Project configuration, scripts, and dependencies
```

---

## ⚙️ Run Locally

### Prerequisites
Make sure you have **Node.js** installed on your system.

### Setup & Run

1. **Clone the repository:**
   ```bash
   git clone https://github.com/vignesh-cp-dev/algo-path.git
   cd algo-path
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```