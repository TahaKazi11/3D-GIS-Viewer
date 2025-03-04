# 3D Point Cloud Data and GIS Viewer

This application allows users to upload and visualize `.pcd`, `.xyz`, and `.geojson` files. It features a 3D point cloud viewer using `three.js` and a map viewer for GeoJSON data using `Leaflet.js`.

## Features
- Upload and visualize `.pcd` and `.xyz` point cloud files.
- Color points based on altitude for better visualization.
- Upload and display `.geojson` files on an interactive map.
- Switch between different views (3D viewer and map).
- Logs file upload details, including metadata.

## Setup Instructions

### Prerequisites
Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/) (v14+ recommended)
- [npm](https://www.npmjs.com/) 

### Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   
2. Install dependencies:
   ```sh
   npm install

3. Start the development server:
   ```sh
   npm start

This will run the app in development mode. Open http://localhost:3000 to view it in your browser.
