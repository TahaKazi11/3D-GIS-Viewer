import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { PCDLoader } from "three/examples/jsm/loaders/PCDLoader";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import "./App.css";
import L from 'leaflet';

const App = () => {
  const mountRef = useRef(null);
  const [gisData, setGisData] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [log, setLog] = useState([]);
  const [pointCloud, setPointCloud] = useState(null);
  const [geoJsonData, setGeoJsonData] = useState(null);  
  const [activeTab, setActiveTab] = useState('pcd');  
  const [pointSize, setPointSize] = useState(0.05); // Default point size
  
  // Time-series animation states
  const [timeSeriesData, setTimeSeriesData] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationSpeed, setAnimationSpeed] = useState(1);
  const [currentTimeIndex, setCurrentTimeIndex] = useState(0);
  const animationRef = useRef(null);
  
  // Filtering options
  const [altitudeRange, setAltitudeRange] = useState({ min: 0, max: 100 });
  const [altitudeFilter, setAltitudeFilter] = useState({ min: 0, max: 100 });
  const [tags, setTags] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  
  // Store original point cloud colors for filtering
  const originalColorsRef = useRef(null);

  const sceneRef = useRef(null);  // Store scene
  const cameraRef = useRef(null);  // Store camera
  const rendererRef = useRef(null);  // Store renderer
  const controlsRef = useRef(null);  // Store controls
  const mapRef = useRef(null);  // Reference to the map component

  // New state to track if the current file supports time series
  const [hasTimeSeriesSupport, setHasTimeSeriesSupport] = useState(false);
  // New state to track if the current file has tags
  const [hasTagsSupport, setHasTagsSupport] = useState(false);

  // Handle window resize for the renderer
  const handleResize = () => {
    if (cameraRef.current && rendererRef.current && mountRef.current) {
      // Get container dimensions
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      // Update camera aspect ratio
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      
      // Update renderer size
      rendererRef.current.setSize(width, height);
    }
  };

  useEffect(() => {
    if (mountRef.current && !sceneRef.current) {
      // Initialize Three.js Scene, Camera, Renderer, and Controls only once on mount
      const sceneInstance = new THREE.Scene();
      sceneInstance.background = new THREE.Color(0x111111); // Dark background color
      sceneRef.current = sceneInstance;

      // Get container dimensions
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;

      const cameraInstance = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
      cameraInstance.position.set(0, 0, 5);
      cameraRef.current = cameraInstance;

      const rendererInstance = new THREE.WebGLRenderer({ antialias: true });
      rendererInstance.setSize(width, height);
      mountRef.current.appendChild(rendererInstance.domElement);
      rendererRef.current = rendererInstance;

      const controlsInstance = new OrbitControls(cameraInstance, rendererInstance.domElement);
      controlsInstance.enableDamping = true;
      controlsInstance.dampingFactor = 0.25;
      controlsInstance.screenSpacePanning = false;
      controlsRef.current = controlsInstance;

      const animate = () => {
        requestAnimationFrame(animate);
        controlsInstance.update();
        rendererInstance.render(sceneInstance, cameraInstance);
      };
      animate();

      // Add window resize listener
      window.addEventListener('resize', handleResize);
    }

    // Cleanup on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && rendererRef.current) {
        mountRef.current.removeChild(rendererRef.current.domElement);
      }
      // Clear any running animation
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);

  // Update renderer when the activeTab changes
  useEffect(() => {
    if (activeTab === 'pcd') {
      // Small delay to ensure the DOM has updated
      setTimeout(handleResize, 0);
    }
  }, [activeTab]);

  // Add this effect to handle map resizing when tab changes
  useEffect(() => {
    if (activeTab === 'geojson') {
      // Give the DOM time to update before resizing the map
      const timeout = setTimeout(() => {
        const mapElement = document.querySelector('.leaflet-container');
        if (mapElement && mapElement._leaflet_id) {
          const map = L.DomUtil.get(mapElement)._leaflet;
          if (map) {
            map.invalidateSize();
          }
        }
      }, 100);
      
      return () => clearTimeout(timeout);
    }
  }, [activeTab]);

  // Time-series animation effect
  useEffect(() => {
    if (isAnimating && timeSeriesData && timeSeriesData.length > 0) {
      const animateTimeStep = () => {
        setCurrentTimeIndex((prevIndex) => {
          const nextIndex = (prevIndex + 1) % timeSeriesData.length;
          updateVisualizationForTimeIndex(nextIndex);
          return nextIndex;
        });
        
        // Schedule the next frame based on animation speed
        const delay = 1000 / animationSpeed;
        animationRef.current = setTimeout(animateTimeStep, delay);
      };
      
      animationRef.current = setTimeout(animateTimeStep, 1000 / animationSpeed);
    } else if (animationRef.current) {
      clearTimeout(animationRef.current);
    }
    
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, [isAnimating, timeSeriesData, animationSpeed]);

  // Apply altitude filters when they change
  useEffect(() => {
    if (pointCloud && activeTab === 'pcd') {
      applyAltitudeFilter();
    }
  }, [altitudeFilter, pointCloud, activeTab]);

  // Apply tag filters when they change (for GeoJSON data)
  useEffect(() => {
    if (geoJsonData && activeTab === 'geojson') {
      // Force map to update when filters change
      if (mapRef.current) {
        setTimeout(() => {
          mapRef.current.invalidateSize();
        }, 100);
      }
    }
  }, [selectedTags, geoJsonData, activeTab]);

  const handleFileUpload = (event) => {
    const files = event.target.files;
    if (files.length > 0) {
      const file = files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const contents = e.target.result;
        
        // First, reset time series data when a new file is loaded
        setTimeSeriesData(null);
        setHasTimeSeriesSupport(false);
        setHasTagsSupport(false);
        
        if (file.name.endsWith(".pcd")) {
          loadPCD(contents, file);
        } else if (file.name.endsWith(".geojson")) {
          loadGeoJson(contents, file);
        } else if (file.name.endsWith(".xyz")) {
          loadXYZ(contents, file); // Added function for loading .xyz files
        } else if (file.name.endsWith(".json") && file.name.includes("timeseries")) {
          loadTimeSeriesData(contents, file); // Added function for loading time-series data
          setHasTimeSeriesSupport(true);
        }
        setUploadedFiles([...uploadedFiles, file]);
      };
      reader.readAsText(file); // Reading as text for GeoJSON and XYZ
    }
  };

  const loadPCD = (buffer, file) => {
    if (!sceneRef.current) return;
    
    // Clear the previous point cloud (if any) from the scene
    if (pointCloud) {
      sceneRef.current.remove(pointCloud);
    }

    const loader = new PCDLoader();
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    loader.load(url, (points) => {
      points.geometry.center();
      points.material.size = pointSize; // Use pointSize state
      if (points.geometry.attributes.position) {
        colorByAltitude(points.geometry);  // Color points based on altitude (z-axis)
        
        // Set altitude range based on the point cloud
        setAltitudeRangeFromGeometry(points.geometry);
      }
      sceneRef.current.add(points);
      setPointCloud(points); // Set point cloud data
      fitCameraToObject(points);

      // Log event for uploaded PCD file
      const boundingBox = new THREE.Box3().setFromObject(points);
      const size = boundingBox.getSize(new THREE.Vector3());
      setLog((prevLog) => [
        ...prevLog,
        `Uploaded PCD: ${file.name}, Size: ${file.size} bytes, Points: ${points.geometry.attributes.position.count}, Bounding Box: ${size.x} x ${size.y} x ${size.z}`,
      ]);
      
      // Switch to PCD tab
      setActiveTab('pcd');
    }, undefined, (error) => {
      console.error("Error loading PCD file:", error);
    });
  };

  const loadXYZ = (data, file) => {
    if (!sceneRef.current) return;

    // Clear the previous point cloud (if any) from the scene
    if (pointCloud) {
      sceneRef.current.remove(pointCloud);
    }

    // Parse the XYZ file
    const points = [];
    const lines = data.split("\n");
    lines.forEach((line) => {
      const [x, y, z] = line.trim().split(" ").map(parseFloat);
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        points.push(x, y, z);
      }
    });

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));

    const material = new THREE.PointsMaterial({ 
      size: pointSize,
      vertexColors: true // Enable vertex colors
    });
    
    const pointCloudObject = new THREE.Points(geometry, material);

    colorByAltitude(geometry);  // Color points based on altitude (z-axis)
    setAltitudeRangeFromGeometry(geometry); // Set altitude range based on the point cloud

    sceneRef.current.add(pointCloudObject);
    setPointCloud(pointCloudObject); // Set point cloud data
    fitCameraToObject(pointCloudObject);

    // Log event for uploaded XYZ file
    setLog((prevLog) => [
      ...prevLog,
      `Uploaded XYZ: ${file.name}, Size: ${file.size} bytes, Points: ${points.length / 3}`,
    ]);
    
    // Switch to PCD tab
    setActiveTab('pcd');
  };

  const fitCameraToObject = (object) => {
    if (!cameraRef.current) return;
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    cameraRef.current.position.set(center.x, center.y, size * 1.5);
    cameraRef.current.lookAt(center);
  };

  const colorByAltitude = (geometry) => {
    const positions = geometry.attributes.position.array;
    const colors = [];
    const minAltitude = Math.min(...Array.from({ length: positions.length / 3 }, (_, i) => positions[i * 3 + 2]));
    const maxAltitude = Math.max(...Array.from({ length: positions.length / 3 }, (_, i) => positions[i * 3 + 2]));

    for (let i = 0; i < positions.length; i += 3) {
      const altitude = positions[i + 2];
      const color = new THREE.Color();
      const colorFactor = (altitude - minAltitude) / (maxAltitude - minAltitude); // Normalize altitude
      color.setHSL(1 - colorFactor, 1, 0.5); // Color mapping from blue (low) to red (high)
      colors.push(color.r, color.g, color.b);
    }

    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    
    // Store original colors for filtering
    originalColorsRef.current = [...colors];
    
    geometry.attributes.color.needsUpdate = true; // Ensure the color update is applied
  };

  // Set altitude range based on the point cloud geometry
  const setAltitudeRangeFromGeometry = (geometry) => {
    const positions = geometry.attributes.position.array;
    const zValues = [];
    
    for (let i = 2; i < positions.length; i += 3) {
      zValues.push(positions[i]);
    }
    
    const min = Math.min(...zValues);
    const max = Math.max(...zValues);
    
    setAltitudeRange({ min, max });
    setAltitudeFilter({ min, max }); // Initialize filter to full range
  };

  // Fixed: Apply altitude filter to the point cloud
  const applyAltitudeFilter = () => {
    if (!pointCloud || !pointCloud.geometry || !pointCloud.geometry.attributes.position) return;
    
    const positions = pointCloud.geometry.attributes.position.array;
    
    // Make sure we have stored the original colors
    if (!originalColorsRef.current) {
      // If no original colors stored, create them
      const colors = [];
      if (pointCloud.geometry.attributes.color) {
        for (let i = 0; i < pointCloud.geometry.attributes.color.array.length; i++) {
          colors.push(pointCloud.geometry.attributes.color.array[i]);
        }
        originalColorsRef.current = colors;
      } else {
        // Default colors if no color attribute exists
        for (let i = 0; i < positions.length / 3; i++) {
          colors.push(1, 1, 1); // White
        }
        originalColorsRef.current = colors;
      }
    }
    
    // Create a new array for filtered colors
    const newColors = new Float32Array(originalColorsRef.current.length);
    
    // Copy original colors to new array
    for (let i = 0; i < originalColorsRef.current.length; i++) {
      newColors[i] = originalColorsRef.current[i];
    }
    
    // Apply filter to colors
    for (let i = 0; i < positions.length / 3; i++) {
      const z = positions[i * 3 + 2];
      
      // If point is outside filter range, make it almost invisible
      if (z < altitudeFilter.min || z > altitudeFilter.max) {
        newColors[i * 3] = 0.1;     // Very dark
        newColors[i * 3 + 1] = 0.1;
        newColors[i * 3 + 2] = 0.1;
      }
    }
    
    // Update colors in the geometry
    pointCloud.geometry.attributes.color.array = newColors;
    pointCloud.geometry.attributes.color.needsUpdate = true;
    
    // Make sure we're using vertex colors
    if (pointCloud.material) {
      pointCloud.material.vertexColors = true;
      pointCloud.material.needsUpdate = true;
    }
  };

  const loadGeoJson = (geoJsonContent, file) => {
    try {
      const data = JSON.parse(geoJsonContent);
      setGeoJsonData(data);
      
      // Extract unique tags from GeoJSON features
      const allTags = new Set();
      if (data.features) {
        data.features.forEach(feature => {
          if (feature.properties && feature.properties.tags) {
            feature.properties.tags.forEach(tag => allTags.add(tag));
          }
        });
      }
      
      setTags(Array.from(allTags));
      setSelectedTags([]);  // Add this line
      // Set hasTagsSupport if we found tags
      setHasTagsSupport(allTags.size > 0);
      
      // Log event for uploaded GeoJSON file
      setLog((prevLog) => [
        ...prevLog,
        `Uploaded GeoJSON: ${file.name}, Size: ${file.size} bytes, Features: ${data.features ? data.features.length : 0}`,
      ]);
      
      // Switch to GeoJSON tab when a geojson file is loaded
      setActiveTab('geojson');
    } catch (error) {
      console.error("Error parsing GeoJSON file:", error);
      setLog((prevLog) => [
        ...prevLog,
        `Error loading GeoJSON: ${error.message}`,
      ]);
    }
  };

  // Load time-series data from JSON file
  const loadTimeSeriesData = (content, file) => {
    try {
      const data = JSON.parse(content);
      
      if (Array.isArray(data) && data.length > 0 && data[0].timestamp) {
        setTimeSeriesData(data);
        setCurrentTimeIndex(0);
        setHasTimeSeriesSupport(true);
        
        // Check if this time-series data also has tags
        let hasTags = false;
        if (data[0].features) {
          const allTags = new Set();
          data[0].features.forEach(feature => {
            if (feature.properties && feature.properties.tags) {
              feature.properties.tags.forEach(tag => allTags.add(tag));
            }
          });
          
          if (allTags.size > 0) {
            setTags(Array.from(allTags));
            setSelectedTags([]);  // Add this line
            setHasTagsSupport(true);
            hasTags = true;
          }
        }
        
        // Log event for uploaded time-series file
        setLog((prevLog) => [
          ...prevLog,
          `Uploaded Time-Series Data: ${file.name}, Size: ${file.size} bytes, Time Points: ${data.length}${hasTags ? ', Contains Tags' : ''}`,
        ]);
        
        // Apply the first time point data
        updateVisualizationForTimeIndex(0);
      } else {
        console.error("Invalid time-series data format");
        setLog((prevLog) => [
          ...prevLog,
          `Error: Invalid time-series data format in ${file.name}`,
        ]);
      }
    } catch (error) {
      console.error("Error parsing time-series data:", error);
      setLog((prevLog) => [
        ...prevLog,
        `Error loading time-series data: ${error.message}`,
      ]);
    }
  };

  // Update visualization based on the current time index
  const updateVisualizationForTimeIndex = (index) => {
    if (!timeSeriesData || !timeSeriesData[index]) return;
    
    const timePoint = timeSeriesData[index];
    
    if (activeTab === 'pcd' && timePoint.points) {
      // Update 3D point cloud if data contains point positions
      updatePointCloudForTimePoint(timePoint);
    } else if (activeTab === 'geojson' && timePoint.features) {
      // Update GeoJSON features for the current time
      const geoJsonContent = {
        type: "FeatureCollection",
        features: timePoint.features
      };
      setGeoJsonData(geoJsonContent);
      
      // Re-extract tags if they've changed with this time point
      if (timePoint.features) {
        const allTags = new Set();
        timePoint.features.forEach(feature => {
          if (feature.properties && feature.properties.tags) {
            feature.properties.tags.forEach(tag => allTags.add(tag));
          }
        });
        
        if (allTags.size > 0) {
          setTags(Array.from(allTags));
          setHasTagsSupport(true);
        }
      }
    }
    
    // Log current timestamp
    const timestamp = new Date(timePoint.timestamp).toLocaleString();
    setLog((prevLog) => {
      const newLog = [...prevLog];
      // If the last entry is a timestamp log, replace it, otherwise add a new one
      if (newLog.length > 0 && newLog[newLog.length - 1].startsWith('Current Time:')) {
        newLog[newLog.length - 1] = `Current Time: ${timestamp} (Frame ${index + 1}/${timeSeriesData.length})`;
      } else {
        newLog.push(`Current Time: ${timestamp} (Frame ${index + 1}/${timeSeriesData.length})`);
      }
      return newLog;
    });
  };

  // Update point cloud for a specific time point
  const updatePointCloudForTimePoint = (timePoint) => {
    if (!sceneRef.current) return;
    
    // Remove existing point cloud
    if (pointCloud) {
      sceneRef.current.remove(pointCloud);
    }
    
    // Create new point cloud from time point data
    const points = [];
    timePoint.points.forEach(point => {
      points.push(point.x, point.y, point.z);
    });
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
    
    const material = new THREE.PointsMaterial({ 
      size: pointSize,
      vertexColors: true // Enable vertex colors 
    });
    const pointCloudObject = new THREE.Points(geometry, material);
    
    colorByAltitude(geometry);
    
    sceneRef.current.add(pointCloudObject);
    setPointCloud(pointCloudObject);
    
    // Apply current altitude filter to the new point cloud
    setTimeout(() => {
      applyAltitudeFilter();
    }, 0);
  };

  // Toggle animation play/pause
  const toggleAnimation = () => {
    setIsAnimating(!isAnimating);
  };

  // Handle animation speed change
  const handleSpeedChange = (e) => {
    setAnimationSpeed(parseFloat(e.target.value));
  };

  // Handle time slider change
  const handleTimeSliderChange = (e) => {
    const index = parseInt(e.target.value);
    setCurrentTimeIndex(index);
    updateVisualizationForTimeIndex(index);
    
    // Pause animation when manually sliding
    setIsAnimating(false);
  };

  // Handle altitude filter changes
  const handleAltitudeFilterChange = (min, max) => {
    setAltitudeFilter({ min, max });
  };

  // Toggle a tag in the selected tags list
  const toggleTag = (tag) => {
    setSelectedTags(prevSelectedTags => {
      if (prevSelectedTags.includes(tag)) {
        return prevSelectedTags.filter(t => t !== tag);
      } else {
        return [...prevSelectedTags, tag];
      }
    });
  };

  // Filter GeoJSON features based on selected tags
  const getFilteredGeoJsonFeatures = () => {
    if (!geoJsonData || !geoJsonData.features) return [];
    
    if (selectedTags.length === 0) {
      return geoJsonData.features; // No filtering if no tags selected
    }
    
    return geoJsonData.features.filter(feature => {
      if (!feature.properties || !feature.properties.tags) return false;
      return feature.properties.tags.some(tag => selectedTags.includes(tag));
    });
  };

  const renderPCDViewer = () => (
    <div
      className="viewer"
      ref={mountRef}
      style={{ display: activeTab === 'pcd' ? 'block' : 'none' }} // Only show when 'pcd' tab is active
    />
  );

  const renderGeoJsonMap = () => {
    // Only render the MapContainer when the geojson tab is active
    if (activeTab !== 'geojson') return null;
    
    const filteredFeatures = getFilteredGeoJsonFeatures();
    
    // Get center of features or default to [0,0]
    const mapCenter = filteredFeatures.length > 0 
      ? [filteredFeatures[0].geometry.coordinates[1], filteredFeatures[0].geometry.coordinates[0]]
      : [0, 0];
    
    return (
      <div className="map-container">
        <MapContainer
          center={mapCenter}
          zoom={3}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(mapInstance) => {
            mapRef.current = mapInstance;
            // Force a resize after the map is created
            setTimeout(() => {
              mapInstance.invalidateSize();
            }, 100);
          }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          />
          {filteredFeatures.map((feature, index) => {
            if (!feature.geometry || !feature.geometry.coordinates) return null;
            
            const { coordinates } = feature.geometry;
            const { tags, description } = feature.properties || {};

            return (
              <Marker
                key={index}
                position={[coordinates[1], coordinates[0]]} 
                icon={new L.Icon({ 
                  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png', 
                  iconSize: [25, 41], 
                  iconAnchor: [12, 41], 
                  popupAnchor: [1, -34],
                  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                  shadowSize: [41, 41]
                })}
              >
                <Popup>
                  <div>
                    <h4>Metadata:</h4>
                    <p><strong>Coordinates:</strong> {`Lat: ${coordinates[1]}, Lon: ${coordinates[0]}`}</p>
                    {tags && tags.length > 0 && (
                      <p><strong>Tags:</strong> {tags.join(', ')}</p>
                    )}
                    {description && (
                      <p><strong>Description:</strong> {description}</p>
                    )}
                    {timeSeriesData && timeSeriesData[currentTimeIndex] && timeSeriesData[currentTimeIndex].timestamp && (
                      <p><strong>Timestamp:</strong> {new Date(timeSeriesData[currentTimeIndex].timestamp).toLocaleString()}</p>
                    )}
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>
    );
  };

  // Modified: Show time-series controls based on current tab and data availability
  const renderTimeSeriesControls = () => {
    // For GeoJSON tab, only show if time series data is available
    if ((!timeSeriesData || !hasTimeSeriesSupport)) {
      return null;
    }
    // Always hide time-series controls in PCD tab regardless of data
    if (activeTab === 'pcd') {
      return null;
    }
    
    return (
      <div className="time-series-controls">
        <h4>Time-Series Animation</h4>
        <div className="time-control-row">
          <button 
            className={`play-button ${isAnimating ? 'pause' : 'play'}`} 
            onClick={toggleAnimation}
          >
            {isAnimating ? '⏸️ Pause' : '▶️ Play'}
          </button>
          <div className="speed-control">
            <label>Speed: </label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={animationSpeed}
              onChange={handleSpeedChange}
            />
            <span>{animationSpeed.toFixed(1)}x</span>
          </div>
        </div>
        <div className="timeline-slider">
          <input
            type="range"
            min="0"
            max={timeSeriesData ? timeSeriesData.length - 1 : 0}
            value={currentTimeIndex}
            onChange={handleTimeSliderChange}
            className="time-slider"
          />
          <div className="time-label">
            {timeSeriesData && timeSeriesData[currentTimeIndex]?.timestamp 
              ? new Date(timeSeriesData[currentTimeIndex].timestamp).toLocaleString() 
              : 'No timestamp'}
          </div>
        </div>
      </div>
    );
  };

  // Only render altitude filter for 3D data in PCD tab when point cloud exists
  const renderAltitudeFilter = () => {
    if (activeTab !== 'pcd' || !pointCloud) {
      return null;
    }
    
    return (
            <div className="filter-controls">
        <h4>Altitude Filtering</h4>
        <div className="altitude-range">
          <div className="range-labels">
            <span>Min: {altitudeFilter.min.toFixed(2)}</span>
            <span>Max: {altitudeFilter.max.toFixed(2)}</span>
          </div>
          <div className="dual-slider">
            <input
              type="range"
              min={altitudeRange.min}
              max={altitudeRange.max}
              step={(altitudeRange.max - altitudeRange.min) / 100}
              value={altitudeFilter.min}
              onChange={(e) => handleAltitudeFilterChange(parseFloat(e.target.value), altitudeFilter.max)}
              className="min-slider"
            />
            <input
              type="range"
              min={altitudeRange.min}
              max={altitudeRange.max}
              step={(altitudeRange.max - altitudeRange.min) / 100}
              value={altitudeFilter.max}
              onChange={(e) => handleAltitudeFilterChange(altitudeFilter.min, parseFloat(e.target.value))}
              className="max-slider"
            />
          </div>
        </div>
      </div>
    );
  };

  // Only render tag filter for GeoJSON data in GeoJSON tab when tags exist
  const renderTagFilter = () => {
    if (activeTab !== 'geojson' || !tags || tags.length === 0) {
      return null;
    }
    
    return (
      <div className="filter-controls">
        <h4>Filter by Tags</h4>
        <div className="tag-list">
          {tags.map((tag, index) => (
            <label key={index} className="tag-checkbox">
              <input
                type="checkbox"
                checked={selectedTags.includes(tag)}
                onChange={() => toggleTag(tag)}
              />
              {tag}
            </label>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="dashboard">
      <div className="main-content">
        <div className="left-panel">
          <h3>Upload Files</h3>
          <div className="tabs">
            <button
              className={activeTab === 'pcd' ? 'active' : ''}
              onClick={() => setActiveTab('pcd')}
            >
              3D Data Viewer
            </button>
            <button
              className={activeTab === 'geojson' ? 'active' : ''}
              onClick={() => setActiveTab('geojson')}
            >
              GIS Viewer
            </button>
          </div>
          <input type="file" accept=".pcd,.geojson,.xyz,.json" onChange={handleFileUpload} />
          
           {/* Time series controls - displayed for both tabs when time series data is available */}
           {renderTimeSeriesControls()}
          
            {/* Altitude filter for 3D data */}
            {renderAltitudeFilter()}
          
            {/* Tag filter for GeoJSON data */}
            {renderTagFilter()}
          
            {uploadedFiles.length > 0 && (
            <div className="uploaded-files">
              <h4>Uploaded Files:</h4>
              <ul>
                {uploadedFiles.map((file, index) => (
                  <li key={index}>{file.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="center-panel">
          {renderPCDViewer()}
          {renderGeoJsonMap()}
        </div>
      </div>
       <div className="bottom-panel">
         <h4>Logs</h4>
         <ul>
           {log.map((entry, index) => (
            <li key={index}>{entry}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default App;

