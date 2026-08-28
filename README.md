# AlgoPath 🚀

An interactive graph and pathfinding visualizer built to understand how graph algorithms work through step-by-step visualizations.

## ✨ Features

- Create and delete graph nodes
- Drag nodes around the graph
- Create weighted edges
- Edit edge weights
- Select start and destination nodes
- Visualize Dijkstra's shortest path algorithm
- Step through the algorithm manually
- Run the complete visualization automatically
- Highlight the final shortest path
- Handle cases where no path exists
- Interactive algorithm explanation panel
- Responsive and interactive SVG-based graph UI

## 🧠 Algorithm

### Dijkstra's Shortest Path Algorithm

AlgoPath uses Dijkstra's algorithm to find the shortest path between two nodes in a weighted graph.

The visualization shows how the algorithm:

1. Starts from the selected source node
2. Tracks the shortest known distance to each node
3. Selects the unvisited node with the smallest distance
4. Checks its neighboring nodes
5. Updates distances when a shorter path is found
6. Reconstructs and highlights the final shortest path

## 🛠️ Tech Stack

- HTML
- CSS
- JavaScript
- SVG
- Vite
- Git & GitHub

## 🚀 Run Locally

Clone the repository:

```bash
git clone https://github.com/vignesh-cp-dev/algo-path.git