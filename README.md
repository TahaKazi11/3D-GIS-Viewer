# 3D Point Cloud Data and GIS Viewer

This application allows users to upload and visualize `.pcd`, `.xyz`, and `.geojson` files. It features a 3D point cloud viewer using `three.js` and a map viewer for GeoJSON data using `Leaflet.js`. 

It has been deployed using `GitHub Pages` [here](https://tahakazi11.github.io/3D-GIS-Viewer/).

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
   git clone https://github.com/TahaKazi11/3D-GIS-Viewer.git
   cd 3D-GIS-Viewer/3d-gis-viewer  
   
2. Install dependencies:
   ```sh
   npm install

3. Start the development server:
   ```sh
   npm start

This will run the app in development mode. Open http://localhost:3000 to view it in your browser.

## Usage

Click Upload Files to upload .pcd, .xyz, or .geojson files.
Use the tabs to switch between PCD Viewer and GeoJSON Map.
Interact with the point cloud using mouse controls.
View log details for uploaded files in the bottom panel.

## Technologies Used
**React.js**: Frontend framework

**three.js**: 3D rendering

**Leaflet.js**: For interactive maps

## License
This project is licensed under the MIT License.

## Author
Developed by Taha Kazi.
